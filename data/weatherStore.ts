import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AppLocation } from "@/data/locationStore";
import {
  getCurrentAndHourlyWeather,
  getCurrentWeather,
  getDailyForecast,
  getHomeInitialWeather,
  getHourlyForecast,
  type RoadSignalHomeInitialResponse,
  type TomorrowDailyForecastResponse,
  type TomorrowHourlyForecastResponse,
  type TomorrowRealtimeResponse,
} from "@/services/tomorrow";

type WeatherCacheEntry<T> = {
  cacheKey: string;
  data: T;
  fetchedAtMs: number;
};

export type WeatherCacheSnapshot<T> = {
  data: T;
  fetchedAtMs: number;
  ageMs: number;
  freshness: "fresh" | "stale";
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
const WEATHER_CACHE_STORAGE_KEY = "roadsignal-weather-cache-v1";
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

const cachedHomeInitialWeather = new Map<
  string,
  WeatherCacheEntry<RoadSignalHomeInitialResponse>
>();
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
const failedHomeInitialWeather = new Map<string, WeatherFailureEntry>();

const inFlightHomeInitialWeather = new Map<
  string,
  Promise<RoadSignalHomeInitialResponse>
>();

type PersistedWeatherCache = {
  homeInitialWeather?: WeatherCacheEntry<RoadSignalHomeInitialResponse>[];
  hourlyForecast?: WeatherCacheEntry<TomorrowHourlyForecastResponse>[];
  dailyForecast?: WeatherCacheEntry<TomorrowDailyForecastResponse>[];
};

let weatherCacheHydrationPromise: Promise<void> | null = null;
let weatherCacheHydrated = false;

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

function getCachedDataSnapshot<T>(
  entries: Map<string, WeatherCacheEntry<T>>,
  cacheKey: string,
  ttlMs: number,
): WeatherCacheSnapshot<T> | null {
  const entry = entries.get(cacheKey);

  if (!entry) {
    return null;
  }

  const ageMs = Date.now() - entry.fetchedAtMs;

  return {
    data: entry.data,
    fetchedAtMs: entry.fetchedAtMs,
    ageMs,
    freshness: ageMs < ttlMs ? "fresh" : "stale",
  };
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

function canUseWeatherStorage() {
  return process.env.EXPO_OS !== "web" || typeof window !== "undefined";
}

function restoreWeatherCacheMap<T>(
  entries: WeatherCacheEntry<T>[] | undefined,
  target: Map<string, WeatherCacheEntry<T>>,
) {
  if (!Array.isArray(entries)) {
    return;
  }

  entries.forEach((entry) => {
    if (
      typeof entry?.cacheKey === "string" &&
      typeof entry.fetchedAtMs === "number" &&
      entry.data
    ) {
      const existing = target.get(entry.cacheKey);

      if (!existing || existing.fetchedAtMs < entry.fetchedAtMs) {
        target.set(entry.cacheKey, entry);
      }
    }
  });
}

function serializeWeatherCacheMap<T>(
  entries: Map<string, WeatherCacheEntry<T>>,
) {
  return Array.from(entries.values()).slice(-25);
}

async function hydrateWeatherCache() {
  if (weatherCacheHydrated) {
    return;
  }

  if (!canUseWeatherStorage()) {
    weatherCacheHydrated = true;
    return;
  }

  if (!weatherCacheHydrationPromise) {
    weatherCacheHydrationPromise = AsyncStorage.getItem(
      WEATHER_CACHE_STORAGE_KEY,
    )
      .then((rawValue) => {
        if (!rawValue) {
          return;
        }

        const parsed = JSON.parse(rawValue) as PersistedWeatherCache;
        restoreWeatherCacheMap(
          parsed.homeInitialWeather,
          cachedHomeInitialWeather,
        );
        restoreWeatherCacheMap(parsed.hourlyForecast, cachedHourlyForecast);
        restoreWeatherCacheMap(parsed.dailyForecast, cachedDailyForecast);
      })
      .catch((error: unknown) => {
        console.log("[WeatherStore] Failed to hydrate weather cache", {
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        weatherCacheHydrated = true;
      });
  }

  return weatherCacheHydrationPromise;
}

async function persistWeatherCache() {
  if (!canUseWeatherStorage()) {
    return;
  }

  const payload: PersistedWeatherCache = {
    homeInitialWeather: serializeWeatherCacheMap(cachedHomeInitialWeather),
    hourlyForecast: serializeWeatherCacheMap(cachedHourlyForecast),
    dailyForecast: serializeWeatherCacheMap(cachedDailyForecast),
  };

  await AsyncStorage.setItem(WEATHER_CACHE_STORAGE_KEY, JSON.stringify(payload));
}

function persistWeatherCacheSafely() {
  void persistWeatherCache().catch((error: unknown) => {
    console.log("[WeatherStore] Failed to persist weather cache", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
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
      persistWeatherCacheSafely();
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

export async function getSharedHomeInitialWeather(
  location: AppLocation,
): Promise<RoadSignalHomeInitialResponse> {
  const cacheKey = getLocationCacheKey(location);
  return getSharedWeatherData({
    cacheKey,
    cacheEntries: cachedHomeInitialWeather,
    ttlMs: CURRENT_WEATHER_TTL_MS,
    fetcher: () => getHomeInitialWeather(location),
    inFlight: inFlightHomeInitialWeather,
    failures: failedHomeInitialWeather,
  });
}

export function getCachedHomeInitialWeather(
  location: AppLocation,
): WeatherCacheSnapshot<RoadSignalHomeInitialResponse> | null {
  const cacheKey = getLocationCacheKey(location);
  return getCachedDataSnapshot(
    cachedHomeInitialWeather,
    cacheKey,
    CURRENT_WEATHER_TTL_MS,
  );
}

export async function hydrateCachedHomeWeather(location: AppLocation) {
  await hydrateWeatherCache();

  return {
    current: getCachedHomeInitialWeather(location),
    hourly: getCachedHourlyForecast(location),
    daily: getCachedDailyForecast(location),
  };
}

export function getCachedCurrentWeather(
  location: AppLocation,
): WeatherCacheSnapshot<TomorrowRealtimeResponse> | null {
  const cacheKey = getLocationCacheKey(location);
  return getCachedDataSnapshot(
    cachedCurrentWeather,
    cacheKey,
    CURRENT_WEATHER_TTL_MS,
  );
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

export function getCachedHourlyForecast(
  location: AppLocation,
): WeatherCacheSnapshot<TomorrowHourlyForecastResponse> | null {
  const cacheKey = getLocationCacheKey(location);
  return getCachedDataSnapshot(
    cachedHourlyForecast,
    cacheKey,
    HOURLY_FORECAST_TTL_MS,
  );
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
      cachedCurrentWeather.set(
        cacheKey,
        buildCacheEntry(cacheKey, data.currentWeather),
      );
      cachedHourlyForecast.set(
        cacheKey,
        buildCacheEntry(cacheKey, data.hourlyForecast),
      );
      failedCurrentAndHourlyWeather.delete(cacheKey);
      failedCurrentWeather.delete(cacheKey);
      failedHourlyForecast.delete(cacheKey);
      persistWeatherCacheSafely();
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

export function getCachedDailyForecast(
  location: AppLocation,
): WeatherCacheSnapshot<TomorrowDailyForecastResponse> | null {
  const cacheKey = getLocationCacheKey(location);
  return getCachedDataSnapshot(
    cachedDailyForecast,
    cacheKey,
    DAILY_FORECAST_TTL_MS,
  );
}

export function clearWeatherCache() {
  cachedCurrentWeather.clear();
  cachedHomeInitialWeather.clear();
  cachedHourlyForecast.clear();
  cachedDailyForecast.clear();
  cachedCurrentAndHourlyWeather.clear();
  inFlightCurrentWeather.clear();
  inFlightHomeInitialWeather.clear();
  inFlightHourlyForecast.clear();
  inFlightDailyForecast.clear();
  inFlightCurrentAndHourlyWeather.clear();
  failedCurrentWeather.clear();
  failedHomeInitialWeather.clear();
  failedHourlyForecast.clear();
  failedDailyForecast.clear();
  failedCurrentAndHourlyWeather.clear();
  if (canUseWeatherStorage()) {
    void AsyncStorage.removeItem(WEATHER_CACHE_STORAGE_KEY);
  }
}

export function setWeatherFailureCacheBypassForDev(enabled: boolean) {
  devWeatherFailureCacheBypass = enabled;
}
