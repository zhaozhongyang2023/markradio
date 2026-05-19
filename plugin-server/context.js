import { station } from './defaults.js';
import { moodProfiles } from './mood.js';
import { detectLanguageIntent, extractRequestedSongs } from './music.js';
import { buildSystemPrompt, buildOutputSchema, TIME_ATMOSPHERE_MAP, WEATHER_ATMOSPHERE_MAP } from './prompts.js';

export function buildDjContext({ taste, mood, specialDates, weather, recentPlays, tracks, nowPlaying, voice, timeContext, userRequest = '', currentPlan = null, mode = 'radio', neteaseTaste = null }) {
  const profile = moodProfiles[mood];
  const request = String(userRequest || '').trim();
  const languageIntent = detectLanguageIntent(request);
  const requestedSongs = extractRequestedSongs(request);

  // 时间/天气氛围文案
  const timePeriod = timeContext?.period || '';
  const weatherCondition = weather?.condition || '';
  const timeAtmosphere = timePeriod ? (TIME_ATMOSPHERE_MAP[timePeriod] || '') : '';
  const weatherAtmosphere = resolveWeatherAtmosphere(weatherCondition);

  // 构建 system prompt
  const system = buildSystemPrompt({
    mode,
    timePeriod,
    weather: weatherAtmosphere ? weatherCondition : '',
    neteaseTaste,
    configuredTaste: taste
  });

  return {
    station,
    system,
    userTaste: {
      configured: taste,
      netease: neteaseTaste
    },
    mood: {
      current: mood,
      profile
    },
    specialDates,
    weather,
    timeContext,
    timeAtmosphere,
    weatherAtmosphere: weatherAtmosphere || '',
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
    outputSchema: buildOutputSchema(mode)
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

function resolveWeatherAtmosphere(condition) {
  if (!condition) return '';
  if (condition.includes('雨')) return WEATHER_ATMOSPHERE_MAP['雨'];
  if (condition.includes('雪')) return WEATHER_ATMOSPHERE_MAP['雪'];
  if (condition.includes('晴')) return WEATHER_ATMOSPHERE_MAP['晴'];
  if (condition.includes('云') || condition.includes('阴')) return WEATHER_ATMOSPHERE_MAP['阴'];
  return '';
}
