import { config } from './config.js';
import { assertServiceAvailable, markServiceFailure, markServiceSuccess } from './circuit-breaker.js';

export async function getWeather() {
  if (!config.openWeatherApiKey || !config.openWeatherCity) {
    return {
      source: 'demo',
      city: config.openWeatherCity || '本地',
      condition: '未知',
      temperature: null,
      summary: '未配置 OpenWeather，使用本地默认天气上下文。'
    };
  }

  assertServiceAvailable('weather');
  const url = new URL('https://api.openweathermap.org/data/2.5/weather');
  url.searchParams.set('q', config.openWeatherCity);
  url.searchParams.set('appid', config.openWeatherApiKey);
  url.searchParams.set('units', 'metric');
  url.searchParams.set('lang', 'zh_cn');

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    markServiceSuccess('weather');
  } catch (error) {
    markServiceFailure('weather');
    throw error;
  }
  if (!response.ok) throw new Error(`OpenWeather ${response.status}`);
  const data = await response.json();
  return {
    source: 'openweather',
    city: config.openWeatherCity,
    condition: data.weather?.[0]?.description || '未知',
    temperature: data.main?.temp ?? null,
    summary: `${data.weather?.[0]?.description || '天气'}，${Math.round(data.main?.temp ?? 0)}°C`
  };
}
