import { EventEmitter } from 'node:events';
import ssdp from 'node-ssdp';
import MediaRendererClient from 'upnp-mediarenderer-client';
import { networkInterfaces } from 'node:os';

const SSDP_SEARCH = 'urn:schemas-upnp-org:device:MediaRenderer:1';
const DISCOVER_TIMEOUT_MS = 6000;

class CastManager extends EventEmitter {
  constructor() {
    super();
    this.ssdp = null;
    this.client = null;
    this.currentDevice = null;
    this.devices = [];
    this.state = 'idle'; // idle | connecting | playing | paused
    this._discoverTimer = null;
  }

  _getInterfaces() {
    const ifaces = networkInterfaces();
    const candidates = [];
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          candidates.push({ name, address: addr.address });
          break;
        }
      }
    }
    return candidates;
  }

  async discover() {
    return new Promise((resolve) => {
      this.devices = [];
      const found = new Map();
      let searches = 0;
      const maxSearches = 3;
      const ifaces = this._getInterfaces();
      const ifaceNames = ifaces.map((i) => i.name);
      
      const doSearch = () => {
        if (searches >= maxSearches) return;
        searches += 1;
        const types = [
          'urn:schemas-upnp-org:device:MediaRenderer:1',
          'urn:schemas-upnp-org:service:AVTransport:1',
          'ssdp:all'
        ];
        types.forEach((st) => client.search(st));
      };

      const client = new ssdp.Client({ log: false, interfaces: ifaceNames, explicitSocketBind: true });
      
      const timer = setTimeout(() => {
        client.stop();
        clearInterval(interval);
        resolve(this.devices);
      }, DISCOVER_TIMEOUT_MS);

      // Multiple search waves
      const interval = setInterval(doSearch, 1200);
      doSearch();

      client.on('response', (headers, _code, rinfo) => {
        const st = headers.ST || headers.NT || '';
        // 只保留 MediaRenderer 设备，过滤路由器 IGD / WANDevice 等
        if (!st.includes('MediaRenderer')) return;
        // 同一设备去重（按 LOCATION 中的 host，同物理设备多 IP 会指向同一 host）
        let locHost = '';
        try { locHost = new URL(headers.LOCATION || '').hostname; } catch (_) {}
        const devKey = locHost || rinfo.address;
        if (found.has(devKey)) return;
        found.set(devKey, true);

        const raw = headers.SERVER
          || headers['X-AV-Physical-Unit-Info']
          || headers['Friendly-Name']
          || (headers.USN || '').split('::')[1]
          || 'Audio Renderer';

        // 清理设备名称
        let name = String(raw)
          .replace(/^DLNADOC\/[\d.]+ /, '')
          .replace(/\s*UPnP\/[\d.]+/g, '')
          .replace(/^Linux\/[\d._a-zA-Z]+/g, '')
          .replace(/Portable SDK for UPnP devices\/[\d.]+/g, '')
          .replace(/\s*Cling\/[\d.]+/g, '')
          .replace(/,\s*,/g, ',')
          .replace(/^[,\s]+/, '')
          .replace(/[,\s]+$/, '')
          .replace(/^[^\w\u4e00-\u9fff]+/, '')
          .trim();
        if (!name) name = '智能音箱'; // 智能音箱

        let locationUrl = null;
        try { locationUrl = new URL(headers.LOCATION || ''); } catch (_) {}

        this.devices.push({
          usn: headers.USN || headers.LOCATION || '',
          name,
          location: headers.LOCATION || '',
          host: locationUrl?.hostname || rinfo.address,
          port: Number(locationUrl?.port || 80)
        });
      });

      this.ssdp = client;
      this._discoverTimer = timer;
    });
  }

  async connect(host, port) {
    this.disconnect();
    try {
      const device = this.devices.find((item) =>
        item.host === host && Number(item.port) === Number(port)
      );
      const descriptionUrl = device?.location || `http://${host}:${port}/description.xml`;
      const client = new MediaRendererClient(descriptionUrl);
      await this._waitReady(client);
      this.client = client;
      this.currentDevice = device || { host, port: Number(port), name: '智能音箱' };
      this.state = 'idle';
      return true;
    } catch (err) {
      this.client = null;
      throw err;
    }
  }

  _waitReady(client, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('UPnP connection timeout')), timeoutMs);
      client.on('status', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async play(url, metadata = {}) {
    if (!this.client) throw new Error('No UPnP device connected');
    const options = {
      autoplay: true,
      contentType: 'audio/mpeg',
      metadata: {
        title: metadata.title || 'MarkRadio',
        creator: metadata.artist || '',
        album: metadata.album || '',
        ...metadata
      }
    };
    return new Promise((resolve, reject) => {
      this.client.load(url, options, (err) => {
        if (err) {
          this.state = 'idle';
          if (this.listenerCount('error')) this.emit('error', err);
          reject(err);
          return;
        }
        this.state = 'playing';
        this.emit('state', 'playing');
        resolve(this.getStatus());
      });
    });
  }

  pause() {
    if (!this.client) throw new Error('No UPnP device connected');
    this.client.pause();
    this.state = 'paused';
    this.emit('state', 'paused');
  }

  resume() {
    if (!this.client) throw new Error('No UPnP device connected');
    this.client.play();
    this.state = 'playing';
    this.emit('state', 'playing');
  }

  stop() {
    if (!this.client) {
      this.state = 'idle';
      return;
    }
    this.client.stop();
    this.state = 'idle';
    this.emit('state', 'idle');
  }

  setVolume(vol) {
    if (!this.client) return;
    const v = Math.max(0, Math.min(100, Math.round(vol)));
    this.client.setVolume(v);
  }

  disconnect() {
    if (this.client) {
      try { this.client.stop(); } catch (_) { /* ignore */ }
      this.client = null;
    }
    this.currentDevice = null;
    this.state = 'idle';
  }

  getStatus() {
    return {
      enabled: true,
      state: this.state,
      device: this.currentDevice,
      devices: this.devices
    };
  }
}

const castManager = new CastManager();
export { castManager };
export function getCastStatus() {
  return castManager.getStatus();
}
