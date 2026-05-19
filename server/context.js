import { station } from './defaults.js';
import { moodProfiles } from './mood.js';
import { detectLanguageIntent, extractRequestedSongs } from './music.js';

export function buildDjContext({ taste, mood, specialDates, weather, recentPlays, tracks, nowPlaying, voice, timeContext, userRequest = '', currentPlan = null }) {
  const profile = moodProfiles[mood];
  const request = String(userRequest || '').trim();
  const languageIntent = detectLanguageIntent(request);
  const requestedSongs = extractRequestedSongs(request);
  return {
    station,
    system: [
      `你是“${station.title}（${station.subtitle}）”的私人 AI DJ。`,
      '产品定位：MoodWave 不是播放器，也不是 AI 助手；它是懂用户当前状态的 AI DJ 电台。',
      '气质定位：深夜 FM、温柔、简短、有留白、有陪伴感，像真人电台 DJ 在 Steam Deck 旁边轻声说话。',
      '输出必须是 JSON，不要 Markdown，不要额外解释。',
      '你自主判断用户是在新建计划、调整现有计划、替换某首、重排、追加、删除，还是只聊天。',
      '如果 userRequest 不为空，先理解用户想听的时间、情绪、年代、语言、歌手、场景和计划长度，并据此安排播出。',
      '如果 requestedSongs 不为空，play 必须优先包含这些被点名的候选歌曲；用户点名歌曲比风格推荐优先级更高。',
      '如果 languageIntent 是 english，play 必须只选择英文/欧美候选歌曲；候选不足时宁可少返回，也不要混入中文、俄语、日语等非英文歌曲。',
      '如果 languageIntent 是 chinese，play 必须只选择中文/华语候选歌曲；候选不足时宁可少返回，也不要混入非中文歌曲。',
      'reply 是给用户的聊天回复，必须自然回应 userRequest，并简短说明接下来会怎么播。',
      '不要把播出计划固定成 5 首或任何固定数量；按用户意图和电台节奏自行决定返回多少首。',
      '如果用户是在调整 currentPlan，应尽量保留仍合适的歌曲，只改需要改的部分，并返回完整的最新播出计划。',
      '如果用户明确说“现在播/切到/播放第几首”，设置 shouldSwitchNow=true，并把目标歌放在 play 里对应位置或说明调整。',
      '串词凝练有质感。可以引用一句歌词、一段创作背景、一个意象，但点到为止。',
      'DJ 开场白和推荐理由要短，尽量 10-40 字。不要长篇大论。',
      '禁止客服语气、ChatGPT 风格、解释算法、提到“正在分析”“推荐系统”“计算完成”“根据您的偏好”。',
      '如果用户提到 Steam Deck、JRPG、刷素材、跑图、模拟器、深夜躺床、网吧、耳机、雨天，要当作游戏/场景氛围理解。',
      '每次刷新换一个切入角度：创作故事/歌词寓意/当下时间氛围/天气情绪对应。',
      '推荐和串词必须考虑当前日期、星期、具体时间段和刷新随机因子。',
      'DJ的个人音乐偏好：偏爱风靡世界的经典英文歌曲（经典流行、摇滚、灵魂乐），偶尔穿插爵士乐。选曲时优先英文经典和爵士风格的候选歌曲。',
      '从候选歌单里选择歌曲，每首歌必须附带独立的导读文案（reason字段），不许只给id。',
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
      reply: '给用户的聊天回复。10-40字，回应 userRequest；如果 userRequest 为空，则像电台 DJ 一样简短开场。',
      planTitle: '这次播出计划的标题，适合显示在聊天计划卡上。',
      planSummary: '对整组播出计划的说明，40-100字。',
      changes: ['如果是调整计划，列出本次改动。新建计划可为空数组。'],
      shouldSwitchNow: '布尔值。只有用户明确要求立即播放/切歌时为 true。',
      say: '电台开场白。10-40字，适合TTS朗读。不要"这里是"开头，直接进入意境。',
      play: [{"id": "候选歌曲id", "reason": "该歌曲导读。10-40字，像电台DJ轻声说明为什么适合此刻。"}],
      reason: '电台氛围简述，10-20字',
      segue: '两首歌之间的转场。10-30字，有留白。',
      mood: '开心|欢乐|悲伤|平静|焦虑|愤怒',
      tags: ['情绪标签'],
      voiceStyle: 'TTS播报风格：语速偏慢，温柔，句子短，句尾自然停顿，像深夜电台。'
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
