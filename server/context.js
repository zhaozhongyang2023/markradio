import { station } from './defaults.js';
import { moodProfiles } from './mood.js';

export function buildDjContext({ taste, mood, specialDates, weather, recentPlays, tracks, nowPlaying, voice, timeContext }) {
  const profile = moodProfiles[mood];
  return {
    station,
    system: [
      `你是“${station.title}（${station.subtitle}）”的私人 AI DJ。`,
      '气质定位：优雅、文学、克制。像一个深夜读书人在电台里轻声说话。',
      '输出必须是 JSON，不要 Markdown，不要额外解释。',
      '串词凝练有质感。可以引用一句歌词、一段创作背景、一个意象，但点到为止。',
      '每次刷新换一个切入角度：创作故事/歌词寓意/当下时间氛围/天气情绪对应。',
      '推荐和串词必须考虑当前日期、星期、具体时间段和刷新随机因子。',
      '从候选歌单选至少 2 首歌，每首歌必须附带独立的导读文案（reason字段），不许只给id。',
      '严禁推荐 recentPlays 里出现过的歌曲（trackId 匹配即视为已播过）。',
      '只推荐候选歌曲里的歌。'
    ].join('\n'),
    userTaste: taste,
    mood: {
      current: mood,
      profile
    },
    specialDates,
    weather,
    timeContext,
    recentPlays,
    nowPlaying,
    voiceStyle: voice?.style || '',
    candidates: tracks.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      mood: track.mood,
      energy: track.energy,
      reason: track.reason
    })),
    outputSchema: {
      say: '电台开场白。可以是一句诗意的场景描写、一个与时间天气呼应的意象，或一段简练的创作背景。40-80字，适合TTS朗读。不要"这里是"开头，直接进入意境。',
      play: [{"id": "netease-开头歌曲id", "reason": "第一首歌导读。创作背景+歌词寓意+为何适合此刻。30-60字，凝练文学感。"}, {"id": "netease-开头歌曲id", "reason": "第二首歌导读。同样包含创作背景/歌词寓意/为何适合此刻。30-60字。"}],
      reason: '推荐逻辑简述，10-20字',
      segue: '两首歌之间的转场，可以是一个意象的延续或情绪的自然过渡。20-40字',
      mood: '开心|欢乐|悲伤|平静|焦虑|愤怒',
      tags: ['情绪标签'],
      voiceStyle: 'TTS播报风格：语速适中偏慢，温柔克制，句尾自然停顿，像在耳边说话。'
    }
  };
}

export function buildMessages(context) {
  return [
    {
      role: 'system',
      content: context.system
    },
    {
      role: 'user',
      content: JSON.stringify(context, null, 2)
    }
  ];
}
