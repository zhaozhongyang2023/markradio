import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { defaultTaste, demoTracks } from './defaults.js';
import { getDefaultSpecialDateConfig } from './special-dates.js';

const dataDir = path.resolve(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

export class StateStore {
  constructor(dbPath = path.join(dataDir, 'markradio.db')) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS plays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id TEXT,
        title TEXT,
        artist TEXT,
        mood TEXT,
        played_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tts_cache (
        hash TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        mood TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    this.seed();
  }

  seed() {
    if (!this.get('taste')) this.set('taste', defaultTaste);
    if (!this.get('mood')) this.set('mood', { current: '平静', updatedAt: new Date().toISOString() });
    if (!this.get('voice')) this.set('voice', { provider: 'local-voice', voiceId: 'chuanglaoli', style: defaultVoiceStyle });
    if (!this.get('specialDates')) this.set('specialDates', getDefaultSpecialDateConfig());
    if (!this.get('tracks')) this.set('tracks', demoTracks);
    if (!this.get('plan-radio')) this.set('plan-radio', null);
    if (!this.get('plan-search')) this.set('plan-search', null);
    if (!this.get('plan-game')) this.set('plan-game', null);
    if (!this.get('now-radio')) this.set('now-radio', null);
    if (!this.get('now-search')) this.set('now-search', null);
    if (!this.get('now-game')) this.set('now-game', null);
  }

  get(key) {
    const row = this.db.prepare('SELECT value FROM kv WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : null;
  }

  set(key, value) {
    this.db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
    return value;
  }

  addPlay(track, mood) {
    this.db
      .prepare('INSERT INTO plays (track_id, title, artist, mood, played_at) VALUES (?, ?, ?, ?, ?)')
      .run(track.id, track.title, track.artist, mood, new Date().toISOString());
  }

  recentPlays(limit = 20) {
    return this.db
      .prepare('SELECT track_id AS trackId, title, artist, mood, played_at AS playedAt FROM plays ORDER BY id DESC LIMIT ?')
      .all(limit);
  }

  getTtsCache(hash) {
    return this.db.prepare('SELECT hash, text, mood, path, created_at AS createdAt FROM tts_cache WHERE hash = ?').get(hash);
  }

  putTtsCache({ hash, text, mood, filePath }) {
    this.db
      .prepare('INSERT OR REPLACE INTO tts_cache (hash, text, mood, path, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(hash, text, mood, filePath, new Date().toISOString());
  }
}

const defaultVoiceStyle = [
  '声音目标：温柔、简短、低刺激，像 Steam Deck 深夜 AI 电台 DJ。',
  '句子要短，停顿自然，不要连续解释太多。',
  '悲伤、忧郁时更慢，开心时可以带轻微笑意，治愈时更柔和。',
  '不要夸张播音腔，不要营销口吻，不要解释算法。',
  '称呼电台为“MoodWave”。'
].join('\n');
