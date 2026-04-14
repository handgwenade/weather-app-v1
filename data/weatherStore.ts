import type { AppLocation } from './locationStore';
import { getCurrentWeather, getDailyForecast } from '../services/tomorrow';

let cachedCurrentWeather: any = null;
let cachedCurrentWeatherKey: string | null = null;

let cachedForecast: any = null;
let cachedForecastKey: string | null = null;

function getLocationCacheKey(location: AppLocation) {
  return `${location.latitude},${location.longitude}`;
}

export async function getSharedCurrentWeather(location: AppLocation) {
  const cacheKey = getLocationCacheKey(location);

  if (cachedCurrentWeather && cachedCurrentWeatherKey === cacheKey) {
    return cachedCurrentWeather;
  }

  const data = await getCurrentWeather(location);
  cachedCurrentWeather = data;
  cachedCurrentWeatherKey = cacheKey;

  return data;
}

export async function getSharedForecast(location: AppLocation) {
  const cacheKey = getLocationCacheKey(location);

  if (cachedForecast && cachedForecastKey === cacheKey) {
    return cachedForecast;
  }

  const data = await getDailyForecast(location);
  cachedForecast = data;
  cachedForecastKey = cacheKey;

  return data;
}

export function clearWeatherCache() {
  cachedCurrentWeather = null;
  cachedCurrentWeatherKey = null;
  cachedForecast = null;
  cachedForecastKey = null;
}