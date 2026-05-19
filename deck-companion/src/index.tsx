import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses,
  TextField
} from '@decky/ui';
import { definePlugin } from '@decky/api';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';

type Track = {
  id?: string;
  title?: string;
  artist?: string;
  reason?: string;
};

type NowPayload = {
  now?: {
    track?: Track | null;
    playing?: boolean;
    mood?: string;
  };
  plan?: {
    mood?: string;
    tts?: { text?: string };
    queue?: Track[];
    plan?: { say?: string; reply?: string };
  };
};

const DEFAULT_API_BASE = 'http://127.0.0.1:38765';
const API_BASE_KEY = 'moodwave.deck.apiBase';
const moods = ['开心', '平静', '忧郁', '悲伤', '治愈', '愤怒'];
const searchExamples = ['适合 JRPG 夜晚探索', '深夜戴耳机', '小时候网吧风格', '雨天适合发呆', '像千与千寻一样'];

function normalizeBase(value: string) {
  return (value || DEFAULT_API_BASE).replace(/\/+$/, '');
}

async function apiRequest<T>(apiBase: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${normalizeBase(apiBase)}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

function useMoodWave(apiBase: string) {
  const [now, setNow] = useState<NowPayload>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('连接 MoodWave 后端');

  async function refresh() {
    const payload = await apiRequest<NowPayload>(apiBase, '/api/now');
    setNow(payload);
    setMessage('MoodWave 在线');
  }

  async function run(label: string, task: () => Promise<unknown>) {
    setBusy(true);
    setMessage(label);
    try {
      await task();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '请求失败');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error instanceof Error ? error.message : '连接失败'));
    const timer = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [apiBase]);

  return { now, busy, message, run, refresh };
}

function Content() {
  const [apiBase, setApiBase] = useState(() => localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE);
  const [query, setQuery] = useState(searchExamples[0]);
  const { now, busy, message, run } = useMoodWave(apiBase);
  const track = now.now?.track || now.plan?.queue?.[0] || {};
  const djText = now.plan?.tts?.text || now.plan?.plan?.say || now.plan?.plan?.reply || '今晚适合慢一点。';
  const playing = Boolean(now.now?.playing);
  const currentLine = useMemo(() => {
    const title = track.title || '等待电台开始';
    const artist = track.artist ? ` - ${track.artist}` : '';
    return `${title}${artist}`;
  }, [track.title, track.artist]);

  function saveApiBase(value: string) {
    const next = normalizeBase(value);
    setApiBase(next);
    localStorage.setItem(API_BASE_KEY, next);
  }

  return (
    <div className={staticClasses.PanelSection}>
      <PanelSection title="MoodWave">
        <PanelSectionRow>
          <div style={{ fontSize: 13, opacity: 0.74 }}>AI Radio for Steam Deck</div>
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField
            label="API Base"
            value={apiBase}
            onChange={(event: ChangeEvent<HTMLInputElement>) => saveApiBase(event.target.value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <div style={{ fontSize: 12, opacity: 0.72 }}>{message}</div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="AI Radio">
        {moods.map((mood) => (
          <PanelSectionRow key={mood}>
            <ButtonItem
              disabled={busy}
              layout="below"
              onClick={() => run(`正在按${mood}开台`, () => apiRequest(apiBase, '/api/ai/radio', { mood, mode: 'steamdeck' }))}
            >
              {mood}
            </ButtonItem>
          </PanelSectionRow>
        ))}
      </PanelSection>

      <PanelSection title="AI 寻歌">
        <PanelSectionRow>
          <TextField
            label="告诉 AI 想听什么"
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem disabled={busy || !query.trim()} onClick={() => run('正在找这段氛围', () => apiRequest(apiBase, '/api/ai/search', { query, mode: 'steamdeck' }))}>
            开始电台
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="当前播放">
        <PanelSectionRow>
          <div>
            <div style={{ fontWeight: 700 }}>{currentLine}</div>
            <div style={{ marginTop: 8, opacity: 0.78 }}>AI DJ：{djText}</div>
            {track.reason ? <div style={{ marginTop: 8, opacity: 0.64 }}>{track.reason}</div> : null}
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem disabled={busy} onClick={() => run(playing ? '暂停' : '播放', () => apiRequest(apiBase, playing ? '/api/pause' : '/api/play', {}))}>
            {playing ? '暂停' : '播放'}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem disabled={busy} onClick={() => run('下一首', () => apiRequest(apiBase, '/api/next', {}))}>
            下一首
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem disabled={busy} onClick={() => run('换个氛围', () => apiRequest(apiBase, '/api/ai/next-radio', { mode: 'steamdeck' }))}>
            换个氛围
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
}

export default definePlugin(() => ({
  name: 'MoodWave Deck Companion',
  titleView: <div className={staticClasses.Title}>MoodWave</div>,
  content: <Content />,
  icon: <span style={{ fontWeight: 800 }}>MW</span>
}));
