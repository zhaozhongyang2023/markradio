import { EventEmitter } from 'node:events';
import ssdp from 'node-ssdp';
import MediaRendererClient from 'upnp-mediarenderer-client';

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

  async discover() {
    return new Promise((resolve) => {
      this.devices = [];
      const found = new Map();
      let searches = 0;
      const maxSearches = 3;
      
      const doSearch = () => {
        if (searches >= maxSearches) return;
        searches += 1;
        // Try multiple UPnP service types
        const types = [
          'urn:schemas-upnp-org:device:MediaRenderer:1',
          'urn:schemas-upnp-org:service:AVTransport:1',
          'ssdp:all'
        ];
        types.forEach((st) => client.search(st));
      };

      const client = new ssdp.Client({ log: false });
      
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
        const usn = headers.USN || headers.LOCATION || '';
        if (found.has(usn)) return;
        found.set(usn, true);
        
        const name = headers.SERVER 
          || headers['X-AV-Physical-Unit-Info'] 
          || headers['Friendly-Name']
          || (usn.includes('::') ? usn.split('::')[1] : usn) 
          || 'Unknown Device';
        
        this.devices.push({
          usn,
          name: String(name).replace(/^DLNADOC\/[\d.]+ /, '').replace(/ UPnP\/[\d.]+/, ''),
          location: headers.LOCATION || '',
          host: rinfo.address,
          port: rinfo.port
        });
      });

      this.ssdp = client;
      this._discoverTimer = timer;
    });
  }

  async connect(host, port) {
    this.disconnect();
    try {
      const client = new MediaRendererClient(`http://${host}:${port}/description.xml`);
      await this._waitReady(client);
      this.client = client;
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
    this.client.load(url, options, (err) => {
      if (err) {
        this.state = 'idle';
        this.emit('error', err);
        return;
      }
      this.state = 'playing';
      this.emit('state', 'playing');
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
