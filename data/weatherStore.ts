import type { AppLocation } from "@/data/locationStore";
import {
  getCurrentAndHourlyWeather,
  getCurrentWeather,
  getDailyForecast,
  getHourlyForecast,
  type TomorrowDailyForecastResponse,
  type TomorrowHourlyForecastResponse,
  type TomorrowRealtimeResponse,
} from "@/services/tomorrow";

type WeatherCacheEntry<T> = {
  cacheKey: string;
  data: T;
  fetchedAtMs: number;
};

type WeatherFailureEntry = {
  error: Error;
  failedAtMs: number;
};

const REQUEST_DEDUPE_WINDOW_MS = 60 * 1000;
const CURRENT_WEATHER_TTL_MS = 5 * 60 * 1000;
const HOURLY_FORECAST_TTL_MS = 15 * 60 * 1000;
const DAILY_FORECAST_TTL_MS = 30 * 60 * 1000;
const COMBINED_CURRENT_HOURLY_TTL_MS = CURRENT_WEATHER_TTL_MS;
const FAILURE_RETRY_DELAY_MS = 60 * 1000;
let devWeatherFailureCacheBypass = false;
type CombinedCurrentAndHourlyWeather = {
  currentWeather: TomorrowRealtimeResponse;
  hourlyForecast: TomorrowHourlyForecastResponse;
};

const cachedCurrentAndHourlyWeather = new Map<
  string,
  WeatherCacheEntry<CombinedCurrentAndHourlyWeather>
>();

const inFlightCurrentAndHourlyWeather = new Map<
  string,
  Promise<CombinedCurrentAndHourlyWeather>
>();

const failedCurrentAndHourlyWeather = new Map<string, WeatherFailureEntry>();

const cachedCurrentWeather = new Map<
  string,
  WeatherCacheEntry<TomorrowRealtimeResponse>
>();
const cachedHourlyForecast = new Map<
  string,
  WeatherCacheEntry<TomorrowHourlyForecastResponse>
>();
const cachedDailyForecast = new Map<
  string,
  WeatherCacheEntry<TomorrowDailyForecastResponse>
>();

const inFlightCurrentWeather = new Map<
  string,
  Promise<TomorrowRealtimeResponse>
>();
const inFlightHourlyForecast = new Map<
  string,
  Promise<TomorrowHourlyForecastResponse>
>();
const inFlightDailyForecast = new Map<
  string,
  Promise<TomorrowDailyForecastResponse>
>();

const failedCurrentWeather = new Map<string, WeatherFailureEntry>();
const failedHourlyForecast = new Map<string, WeatherFailureEntry>();
const failedDailyForecast = new Map<string, WeatherFailureEntry>();

function getLocationCacheKey(location: AppLocation) {
  return `${location.latitude},${location.longitude}`;
}

function getFreshCachedData<T>(
  entries: Map<string, WeatherCacheEntry<T>>,
  cacheKey: string,
  ttlMs: number,
) {
  const entry = entries.get(cacheKey);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.fetchedAtMs >= ttlMs) {
    entries.delete(cacheKey);
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

function getRecentFailure(
  failures: Map<string, WeatherFailureEntry>,
  cacheKey: string,
) {
  const failure = failures.get(cacheKey);

  if (!failure) {
    return null;
  }

  if (Date.now() - failure.failedAtMs >= FAILURE_RETRY_DELAY_MS) {
    failures.delete(cacheKey);
    return null;
  }

  return failure.error;
}

function shouldBypassWeatherFailureCache() {
  return (
    process.env.NODE_ENV !== "production" &&
    (devWeatherFailureCacheBypass ||
      process.env.EXPO_PUBLIC_BYPASS_WEATHER_FAILURE_CACHE === "1" ||
      process.env.EXPO_PUBLIC_WEATHER_DEBUG_BYPASS_CACHE === "1")
  );
}

async function getSharedWeatherData<T>(params: {
  cacheKey: string;
  cacheEntries: Map<string, WeatherCacheEntry<T>>;
  ttlMs: number;
  fetcher: () => Promise<T>;
  inFlight: Map<string, Promise<T>>;
  failures: Map<string, WeatherFailureEntry>;
}) {
  const { cacheKey, cacheEntries, ttlMs, fetcher, inFlight, failures } =
    params;
  const reuseWindowMs = Math.max(ttlMs, REQUEST_DEDUPE_WINDOW_MS);
  const bypassFailureCache = shouldBypassWeatherFailureCache();

  const cachedData = getFreshCachedData(cacheEntries, cacheKey, reuseWindowMs);

  if (cachedData) {
    return cachedData;
  }

  if (bypassFailureCache) {
    failures.delete(cacheKey);
  }

  const recentFailure = bypassFailureCache
    ? null
    : getRecentFailure(failures, cacheKey);

  if (recentFailure) {
    throw recentFailure;
  }

  const inFlightRequest = inFlight.get(cacheKey);

  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = fetcher()
    .then((data) => {
      cacheEntries.set(cacheKey, buildCacheEntry(cacheKey, data));
      failures.delete(cacheKey);
      return data;
    })
    .catch((error: unknown) => {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));

      if (bypassFailureCache) {
        failures.delete(cacheKey);
      } else {
        failures.set(cacheKey, {
          error: normalizedError,
          failedAtMs: Date.now(),
        });
      }

      throw normalizedError;
    })
    .finally(() => {
      inFlight.delete(cacheKey);
    });

  inFlight.set(cacheKey, request);

  return request;
}

export async function getSharedCurrentWeather(
  location: AppLocation,
): Promise<TomorrowRealtimeResponse> {
  const cacheKey = getLocationCacheKey(location);
  return getSharedWeatherData({
    cacheKey,
    cacheEntries: cachedCurrentWeather,
    ttlMs: CURRENT_WEATHER_TTL_MS,
    fetcher: () => getCurrentWeather(location),
    inFlight: inFlightCurrentWeather,
    failures: failedCurrentWeather,
  });
}

export async function getSharedHourlyForecast(
  location: AppLocation,
): Promise<TomorrowHourlyForecastResponse> {
  const cacheKey = getLocationCacheKey(location);
  return getSharedWeatherData({
    cacheKey,
    cacheEntries: cachedHourlyForecast,
    ttlMs: HOURLY_FORECAST_TTL_MS,
    fetcher: () => getHourlyForecast(location),
    inFlight: inFlightHourlyForecast,
    failures: failedHourlyForecast,
  });
}

/**
 * Returns { currentWeather, hourlyForecast } for a given location, using a shared network request.
 * Uses stricter (current-weather) TTL for cache.
 */
export async function getSharedCurrentAndHourlyWeather(
  location: AppLocation,
): Promise<CombinedCurrentAndHourlyWeather> {
  const cacheKey = getLocationCacheKey(location);
  const bypassFailureCache = shouldBypassWeatherFailureCache();

  const cachedData = getFreshCachedData(
    cachedCurrentAndHourlyWeather,
    cacheKey,
    Math.max(COMBINED_CURRENT_HOURLY_TTL_MS, REQUEST_DEDUPE_WINDOW_MS),
  );

  if (cachedData) {
    return cachedData;
  }

  if (bypassFailureCache) {
    failedCurrentAndHourlyWeather.delete(cacheKey);
  }

  const recentFailure = bypassFailureCache
    ? null
    : getRecentFailure(failedCurrentAndHourlyWeather, cacheKey);

  if (recentFailure) {
    throw recentFailure;
  }

  const inFlightRequest = inFlightCurrentAndHourlyWeather.get(cacheKey);

  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = getCurrentAndHourlyWeather(location)
    .then((data: CombinedCurrentAndHourlyWeather) => {
      cachedCurrentAndHourlyWeather.set(cacheKey, buildCacheEntry(cacheKey, data));
      failedCurrentAndHourlyWeather.delete(cacheKey);
      return data;
    })
    .catch((error: unknown) => {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));

      if (bypassFailureCache) {
        failedCurrentAndHourlyWeather.delete(cacheKey);
      } else {
        failedCurrentAndHourlyWeather.set(cacheKey, {
          error: normalizedError,
          failedAtMs: Date.now(),
        });
      }

      throw normalizedError;
    })
    .finally(() => {
      inFlightCurrentAndHourlyWeather.delete(cacheKey);
    });

  inFlightCurrentAndHourlyWeather.set(cacheKey, request);

  return request;
}

export async function getSharedForecast(
  location: AppLocation,
): Promise<TomorrowDailyForecastResponse> {
  const cacheKey = getLocationCacheKey(location);
  return getSharedWeatherData({
    cacheKey,
    cacheEntries: cachedDailyForecast,
    ttlMs: DAILY_FORECAST_TTL_MS,
    fetcher: () => getDailyForecast(location),
    inFlight: inFlightDailyForecast,
    failures: failedDailyForecast,
  });
}

export function clearWeatherCache() {
  cachedCurrentWeather.clear();
  cachedHourlyForecast.clear();
  cachedDailyForecast.clear();
  cachedCurrentAndHourlyWeather.clear();
  inFlightCurrentWeather.clear();
  inFlightHourlyForecast.clear();
  inFlightDailyForecast.clear();
  inFlightCurrentAndHourlyWeather.clear();
  failedCurrentWeather.clear();
  failedHourlyForecast.clear();
  failedDailyForecast.clear();
  failedCurrentAndHourlyWeather.clear();
}

export function setWeatherFailureCacheBypassForDev(enabled: boolean) {
  devWeatherFailureCacheBypass = enabled;
}
