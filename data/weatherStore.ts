import type { AppLocation } from './locationStore';
import { getCurrentWeather, getDailyForecast, getHourlyForecast } from '../services/tomorrow';

type WeatherCacheEntry<T> = {
  cacheKey: string;
  data: T;
  fetchedAtMs: number;
};

const CURRENT_WEATHER_TTL_MS = 5 * 60 * 1000;
const HOURLY_FORECAST_TTL_MS = 15 * 60 * 1000;
const DAILY_FORECAST_TTL_MS = 30 * 60 * 1000;

let cachedCurrentWeather: WeatherCacheEntry<any> | null = null;
let cachedHourlyForecast: WeatherCacheEntry<any> | null = null;
let cachedForecast: WeatherCacheEntry<any> | null = null;

function getLocationCacheKey(location: AppLocation) {
  return `${location.latitude},${location.longitude}`;
}

function getFreshCachedData<T>(
  entry: WeatherCacheEntry<T> | null,
  cacheKey: string,
  ttlMs: number,
) {
  if (!entry || entry.cacheKey !== cacheKey) {
    return null;
  }

  if (Date.now() - entry.fetchedAtMs >= ttlMs) {
    return null;
  }

  return entry.data;
}

function buildCacheEntry<T>(cacheKey: string, data: T): WeatherCacheEntry<T> {
  return {
    cacheKey,
    data,
    fetchedAtMs: Date.now(),
  };
}

export async function getSharedCurrentWeather(location: AppLocation) {
  const cacheKey = getLocationCacheKey(location);
  const cachedData = getFreshCachedData(
    cachedCurrentWeather,
    cacheKey,
    CURRENT_WEATHER_TTL_MS,
  );

  if (cachedData) {
    return cachedData;
  }

  const data = await getCurrentWeather(location);
  cachedCurrentWeather = buildCacheEntry(cacheKey, data);

  return data;
}

export async function getSharedHourlyForecast(location: AppLocation) {
  const cacheKey = getLocationCacheKey(location);
  const cachedData = getFreshCachedData(
    cachedHourlyForecast,
    cacheKey,
    HOURLY_FORECAST_TTL_MS,
  );

  if (cachedData) {
    return cachedData;
  }

  const data = await getHourlyForecast(location);
  cachedHourlyForecast = buildCacheEntry(cacheKey, data);

  return data;
}

export async function getSharedForecast(location: AppLocation) {
  const cacheKey = getLocationCacheKey(location);
  const cachedData = getFreshCachedData(
    cachedForecast,
    cacheKey,
    DAILY_FORECAST_TTL_MS,
  );

  if (cachedData) {
    return cachedData;
  }

  const data = await getDailyForecast(location);
  cachedForecast = buildCacheEntry(cacheKey, data);

  return data;
}

export function clearWeatherCache() {
  cachedCurrentWeather = null;
  cachedHourlyForecast = null;
  cachedForecast = null;
}
