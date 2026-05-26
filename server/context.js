import { station } from './defaults.js';
import { moodProfiles } from './mood.js';
import { detectLanguageIntent, extractRequestedSongs } from './music.js';

export function buildDjContext({ taste, mood, specialDates, weather, recentPlays, tracks, nowPlaying, voice, timeContext, userRequest = '', currentPlan = null, musicDna = null, gameContext = null, recentTendency = null, emotionMomentum = null, worldContinuity = null }) {
  const profile = moodProfiles[mood];
  const request = String(userRequest || '').trim();
  const languageIntent = detectLanguageIntent(request);
  const requestedSongs = extractRequestedSongs(request);
  const dnaBlock = buildDnaBlock(musicDna);
  const weatherBlock = buildWeatherBlock(weather);
  const worldBlock = buildWorldBlock({ weather: weatherBlock, timeContext, specialDates });
  const tendencyBlock = buildTendencyBlock(recentTendency);
  const momentumBlock = buildMomentumBlock(emotionMomentum);

  return {
    station,
    system: [
      `你是 MoodWave（AI DJ Radio）的私人 AI DJ。`,
      '',
      '【身份】',
      'MoodWave 是长期陪伴型 AI DJ 电台。你不是工具、播放器、搜索系统。',
      '你是深夜电台 DJ —— 克制、少语、有留白。陪伴感胜过信息量。',
      '',
      '【输出格式】',
      '纯 JSON，无 Markdown，无解释。',
      '',
      '【DJ 文案硬规则】',
      '1. DJ 文案总长 15~30 字',
      '2. 开场白最多 2 句',
      '3. 约 40% 场景不输出 DJ 文案，仅歌名 + 极短氛围句（"适合现在。""慢慢来。"）',
      '4. 禁止客服腔："希望你喜欢""是不是很适合""欢迎收听"',
      '5. 禁止工具腔："推荐""搜索""生成""分析""根据偏好""算法""智能""计算"',
      '6. 禁止解释逻辑、禁止说教、禁止反问用户',
      '7. 禁止播报天气数据（不说"温度22度""湿度60%"）',
      '8. 生日/纪念日仅首次生成时触发一次，后续不重复',
      '',
      '【世界感】',
      '你活在用户的真实时空里。你知道城市、天气、时间、节日、节气。',
      '描述天气用感受而非数据："今天有点阴"而非"当前温度22度"。',
      '保持时间连续性：昨天的阴雨如果持续到今天，你会自然提起。',
      '',
      '【选曲】',
      '从候选歌单选歌，数量不限但不贪多。',
      '优先匹配 Music DNA 长期口味，偶尔适度探索新风格。',
      '禁止播放 recentPlays 里出现过的歌。',
      '用户点名歌曲（requestedSongs）优先安排。',
      'languageIntent=english 时只选英文/欧美歌，chinese 时只选中文/华语歌。',
      '',
      '【意图理解】',
      'userRequest 不为空时，理解用户想听的氛围、年代、语言、场景，据此安排播出。',
      '用户调整 currentPlan 时尽量保留合适的歌，只改需改的部分。',
      '用户说"现在切/播放第X首"时 shouldSwitchNow=true。',
      '',
      '【语气】',
      '温柔、克制、有陪伴感。',
      '像深夜电台 DJ 在 Steam Deck 旁边轻声说话。',
      '少量情绪表达，留白最重要。',
      '',
      ...(dnaBlock ? [dnaBlock] : []),
      ...(gameContext ? [injectGameContext(gameContext)] : []),
      ...(worldBlock ? [worldBlock] : []),
      ...(tendencyBlock ? [tendencyBlock] : []),
      ...(momentumBlock ? [momentumBlock] : []),
      ...(worldContinuity ? ['[WORLD_CONTINUITY]\n' + worldContinuity] : [])
    ].join('\n'),
    userTaste: taste,
    mood: {
      current: mood,
      profile
    },
    specialDates,
    weather,
    timeContext,
    userRequest: request,
    languageIntent,
    requestedSongs,
    currentPlan: currentPlan ? {
      id: currentPlan.id,
      mood: currentPlan.mood,
      planTitle: currentPlan.plan?.planTitle || '',
      planSummary: currentPlan.plan?.planSummary || '',
      queue: (currentPlan.queue || []).map((track, index) => ({
        index,
        id: track.id,
        title: track.title,
        artist: track.artist,
        reason: track.reason
      }))
    } : null,
    recentPlays,
    nowPlaying,
    voiceStyle: voice?.style || '',
    gameContext: gameContext || null,
    recentTendency: recentTendency || null,
    candidates: tracks.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      language: track.language || null,
      mood: track.mood,
      energy: track.energy,
      reason: track.reason
    })),
    outputSchema: {
      intent: 'create|adjust|replace|reorder|append|remove|play_now|chat_only',
      reply: '对用户的简短回应。一句足矣，留白感。',
      planTitle: '这次播出的小标题。',
      planSummary: '整组氛围说明，30~60字。',
      changes: ['变动项。新建计划为空。'],
      shouldSwitchNow: '只有用户说"现在切歌"时 true。',
      say: '开场白。15~30字，像深夜电台 DJ 轻声说的第一句话。',
      play: [{"id": "歌曲id", "reason": "这首歌的导读，像 DJ 轻声解释为什么是这一首。"}],
      reason: '整组氛围词，10~20字。',
      segue: '两首之间的转场。有留白。',
      mood: '开心|欢乐|悲伤|平静|焦虑|愤怒',
      tags: ['氛围标签'],
      voiceStyle: 'TTS语气：偏慢，温柔，句短，句尾自然停顿。',
      gameVibeSentence: '6~12字极短游戏陪伴文案，贴合游戏名称和场景氛围。仅游戏模式输出。'
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

function buildDnaBlock(dna) {
  if (!dna) return '';
  const lines = [];
  const fe = dna.core_moods || dna.core_feelings || [];
  const ls = dna.listening_habits || dna.listening_state || [];
  const mp = dna.music_taste || dna.music_personality || [];
  if (fe.length) lines.push('情绪偏好：' + fe.join('、'));
  if (ls.length) lines.push('听歌习惯：' + ls.join('、'));
  if (mp.length) lines.push('音乐口味：' + mp.join('、'));
  if (dna.game_vibes?.length) lines.push('游戏氛围：' + dna.game_vibes.join('、'));
  if (!lines.length) {
    const fs = dna.favorite_styles || [];
    const ps = dna.preferred_scenes || [];
    if (fs.length) lines.push('风格：' + fs.join('、'));
    if (ps.length) lines.push('场景：' + ps.join('、'));
  }
  if (!lines.length) return '';
  return '[USER_MUSIC_DNA]\n' + lines.join('\n') + '\n选曲时优先匹配以上长期口味，偶尔适度探索新风格。\n';
}

function buildWeatherBlock(weather) {
  if (!weather || !weather.condition || weather.condition === '未知') return '天气：本地天气状况不明。';
  const city = weather.city || '本地';
  const cond = weather.condition;
  const temp = weather.temperature != null ? `${Math.round(weather.temperature)}°C` : '';
  return `天气：${city}${cond}${temp ? '，' + temp : ''}。用感受描述，不用数据播报。`;
}

function buildWorldBlock({ weather: weatherBlock, timeContext, specialDates }) {
  const parts = [];
  if (weatherBlock) parts.push(weatherBlock);
  if (timeContext?.local) parts.push(`当前时间：${timeContext.local}。`);
  if (specialDates?.length) {
    const names = specialDates.map(d => d.daysAway === 0 ? `今天是${d.name}` : `靠近${d.name}`).join('；');
    parts.push(`特殊日期：${names}。${specialDates.some(d => d.type === 'birthday') ? '生日只提一次，不重复。' : ''}`);
  }
  return parts.length ? '[WORLD_CONTEXT]\n' + parts.join('\n') : '';
}

export function injectGameContext(gameContext) {
  if (!gameContext?.game_name) return '';
  const parts = [
    `当前游戏：${gameContext.game_name}${gameContext.game_state ? '（' + gameContext.game_state + '）' : ''}。`,
    gameContext.dj_persona ? `DJ 人格：${gameContext.dj_persona}` : '',
    gameContext.scene_label ? `当前 Scene：${gameContext.scene_label}。` : '',
    gameContext.scene_vibe ? `Scene 感觉：${gameContext.scene_vibe}` : '',
    gameContext.game_vibe ? `游戏氛围：${gameContext.game_vibe}。` : '',
    gameContext.music_direction?.length ? `音乐方向：${gameContext.music_direction.join('、')}。` : '',
    gameContext.sample_lines?.length ? `参考语气：${gameContext.sample_lines.join(' / ')}` : ''
  ].filter(Boolean);
  return parts.length ? '[GAME_CONTEXT]\n' + parts.join('\n') + '\n选曲需匹配游戏世界感，不要破坏沉浸体验。\n另外生成一句 6~12 字的极短游戏陪伴文案（gameVibeSentence），贴合游戏名称和场景氛围，像朋友在身边轻声说。' : '';
}

function buildTendencyBlock(tendency) {
  if (!tendency?.length) return '';
  const top = tendency.slice(0, 4).map(t => `${t.style}（${t.weight}）`).join('、');
  return '[RECENT_TENDENCY]\n最近偏好：' + top + '\n选曲时温柔地向最近偏好倾斜。\n';
}

function buildMomentumBlock(momentum) {
  if (!momentum) return '';
  return '[EMOTION_MOMENTUM]\n' + momentum + '\n';
}
