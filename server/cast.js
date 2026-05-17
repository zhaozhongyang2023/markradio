import { EventEmitter } from 'node:events';
import ssdp from 'node-ssdp';
import MediaRendererClient from 'upnp-mediarenderer-client';
import { networkInterfaces } from 'node:os';

const SSDP_SEARCH = 'urn:schemas-upnp-org:device:MediaRenderer:1';
const DISCOVER_TIMEOUT_MS = 6000;

function decodeXmlEntity(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildAudioMetadata(url, metadata = {}, contentType = 'audio/mpeg') {
  const protocolInfo = `http-get:*:${contentType}:*`;
  const title = metadata.title || 'MarkRadio';
  const creator = metadata.artist || metadata.creator || 'MarkRadio';
  const album = metadata.album || '';
  return [
    '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">',
    '<item id="0" parentID="0" restricted="1">',
    `<dc:title>${escapeXml(title)}</dc:title>`,
    `<dc:creator>${escapeXml(creator)}</dc:creator>`,
    album ? `<upnp:album>${escapeXml(album)}</upnp:album>` : '',
    '<upnp:class>object.item.audioItem.musicTrack</upnp:class>',
    `<res protocolInfo="${escapeXml(protocolInfo)}">${escapeXml(url)}</res>`,
    '</item>',
    '</DIDL-Lite>'
  ].join('');
}

export function parseUpnpFriendlyName(xml = '') {
  const match = String(xml).match(/<friendlyName[^>]*>([^<]+)<\/friendlyName>/i);
  return match ? decodeXmlEntity(match[1]) : '';
}

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
      const nameLookups = [];
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
      
      const timer = setTimeout(async () => {
        client.stop();
        clearInterval(interval);
        await Promise.allSettled(nameLookups);
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

        const device = {
          usn: headers.USN || headers.LOCATION || '',
          name,
          location: headers.LOCATION || '',
          host: locationUrl?.hostname || rinfo.address,
          port: Number(locationUrl?.port || 80)
        };
        this.devices.push(device);

        if (device.location) {
          nameLookups.push(
            fetch(device.location, { signal: AbortSignal.timeout(2200) })
              .then((response) => response.ok ? response.text() : '')
              .then((xml) => {
                const friendlyName = parseUpnpFriendlyName(xml);
                if (friendlyName) device.name = friendlyName;
              })
              .catch(() => {})
          );
        }
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
    try {
      return await this._loadWithClient(url, options);
    } catch (err) {
      if (!this._isPrepareFallbackError(err)) throw err;
      return this._loadDirect(url, options);
    }
  }

  _isPrepareFallbackError(err) {
    return (err?.code === 'EUPNP' && String(err.errorCode || '').trim() === '501') ||
      err?.code === 'ECONNRESET';
  }

  _callAction(service, action, params, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error(`UPnP ${action} timeout`));
      }, timeoutMs);
      this.client.callAction(service, action, params, (err, result) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  _getDeviceDescription() {
    return new Promise((resolve, reject) => {
      this.client.getDeviceDescription((err, desc) => {
        if (err) reject(err);
        else resolve(desc);
      });
    });
  }

  async _postSoap(serviceId, action, params, timeoutMs = 15000) {
    const resolvedId = serviceId.includes(':') ? serviceId : `urn:upnp-org:serviceId:${serviceId}`;
    const desc = await this._getDeviceDescription();
    const service = desc.services?.[resolvedId];
    if (!service) throw new Error(`UPnP service missing: ${serviceId}`);
    const body = Object.entries(params)
      .map(([key, value]) => `<${key}>${escapeXml(value ?? '')}</${key}>`)
      .join('');
    const xml = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${action} xmlns:u="${service.serviceType}">${body}</u:${action}></s:Body></s:Envelope>`;
    const response = await fetch(service.controlURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        SOAPACTION: `"${service.serviceType}#${action}"`
      },
      body: xml,
      signal: AbortSignal.timeout(timeoutMs)
    });
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      const errorCode = text.match(/<errorCode>([^<]+)<\/errorCode>/i)?.[1] || response.status;
      const errorDescription = text.match(/<errorDescription>([^<]+)<\/errorDescription>/i)?.[1] || response.statusText;
      const err = new Error(`${errorDescription} (${errorCode})`);
      err.code = 'EUPNP';
      err.statusCode = response.status;
      err.errorCode = errorCode;
      throw err;
    }
    return text;
  }

  _loadWithClient(url, options) {
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

  async _loadDirect(url, options = {}) {
    const instanceId = Number(this.client?.instanceId || 0);
    const metadata = buildAudioMetadata(url, options.metadata || {}, options.contentType || 'audio/mpeg');
    const params = {
      InstanceID: instanceId,
      CurrentURI: url,
      CurrentURIMetaData: ''
    };
    try {
      await this._postSoap('AVTransport', 'SetAVTransportURI', params);
    } catch (err) {
      await this._postSoap('AVTransport', 'SetAVTransportURI', {
        ...params,
        CurrentURIMetaData: metadata
      });
    }
    await this._postSoap('AVTransport', 'Play', { InstanceID: instanceId, Speed: 1 });
    this.state = 'playing';
    this.emit('state', 'playing');
    return this.getStatus();
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
