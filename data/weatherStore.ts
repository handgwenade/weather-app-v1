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

const CURRENT_WEATHER_TTL_MS = 5 * 60 * 1000;
const HOURLY_FORECAST_TTL_MS = 15 * 60 * 1000;
const DAILY_FORECAST_TTL_MS = 30 * 60 * 1000;
const COMBINED_CURRENT_HOURLY_TTL_MS = CURRENT_WEATHER_TTL_MS;
const FAILURE_RETRY_DELAY_MS = 60 * 1000;
type CombinedCurrentAndHourlyWeather = {
  currentWeather: TomorrowRealtimeResponse;
  hourlyForecast: TomorrowHourlyForecastResponse;
};

let cachedCurrentAndHourlyWeather: WeatherCacheEntry<CombinedCurrentAndHourlyWeather> | null =
  null;

const inFlightCurrentAndHourlyWeather = new Map<
  string,
  Promise<CombinedCurrentAndHourlyWeather>
>();

const failedCurrentAndHourlyWeather = new Map<string, WeatherFailureEntry>();

let cachedCurrentWeather: WeatherCacheEntry<TomorrowRealtimeResponse> | null =
  null;
let cachedHourlyForecast: WeatherCacheEntry<TomorrowHourlyForecastResponse> | null =
  null;
let cachedDailyForecast: WeatherCacheEntry<TomorrowDailyForecastResponse> | null =
  null;

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

async function getSharedWeatherData<T>(params: {
  cacheKey: string;
  cachedEntry: WeatherCacheEntry<T> | null;
  ttlMs: number;
  fetcher: () => Promise<T>;
  onCache: (entry: WeatherCacheEntry<T>) => void;
  inFlight: Map<string, Promise<T>>;
  failures: Map<string, WeatherFailureEntry>;
}) {
  const { cacheKey, cachedEntry, ttlMs, fetcher, onCache, inFlight, failures } =
    params;

  const cachedData = getFreshCachedData(cachedEntry, cacheKey, ttlMs);

  if (cachedData) {
    return cachedData;
  }

  const recentFailure = getRecentFailure(failures, cacheKey);

  if (recentFailure) {
    throw recentFailure;
  }

  const inFlightRequest = inFlight.get(cacheKey);

  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = fetcher()
    .then((data) => {
      onCache(buildCacheEntry(cacheKey, data));
      failures.delete(cacheKey);
      return data;
    })
    .catch((error: unknown) => {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      failures.set(cacheKey, {
        error: normalizedError,
        failedAtMs: Date.now(),
      });
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
    cachedEntry: cachedCurrentWeather,
    ttlMs: CURRENT_WEATHER_TTL_MS,
    fetcher: () => getCurrentWeather(location),
    onCache: (entry) => {
      cachedCurrentWeather = entry;
    },
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
    cachedEntry: cachedHourlyForecast,
    ttlMs: HOURLY_FORECAST_TTL_MS,
    fetcher: () => getHourlyForecast(location),
    onCache: (entry) => {
      cachedHourlyForecast = entry;
    },
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

  const cachedData = getFreshCachedData(
    cachedCurrentAndHourlyWeather,
    cacheKey,
    COMBINED_CURRENT_HOURLY_TTL_MS,
  );

  if (cachedData) {
    return cachedData;
  }

  const recentFailure = getRecentFailure(
    failedCurrentAndHourlyWeather,
    cacheKey,
  );

  if (recentFailure) {
    throw recentFailure;
  }

  const inFlightRequest = inFlightCurrentAndHourlyWeather.get(cacheKey);

  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = getCurrentAndHourlyWeather(location)
    .then((data: CombinedCurrentAndHourlyWeather) => {
      cachedCurrentAndHourlyWeather = buildCacheEntry(cacheKey, data);
      failedCurrentAndHourlyWeather.delete(cacheKey);
      return data;
    })
    .catch((error: unknown) => {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      failedCurrentAndHourlyWeather.set(cacheKey, {
        error: normalizedError,
        failedAtMs: Date.now(),
      });
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
    cachedEntry: cachedDailyForecast,
    ttlMs: DAILY_FORECAST_TTL_MS,
    fetcher: () => getDailyForecast(location),
    onCache: (entry) => {
      cachedDailyForecast = entry;
    },
    inFlight: inFlightDailyForecast,
    failures: failedDailyForecast,
  });
}

export function clearWeatherCache() {
  cachedCurrentWeather = null;
  cachedHourlyForecast = null;
  cachedDailyForecast = null;
  cachedCurrentAndHourlyWeather = null;
  inFlightCurrentWeather.clear();
  inFlightHourlyForecast.clear();
  inFlightDailyForecast.clear();
  inFlightCurrentAndHourlyWeather.clear();
  failedCurrentWeather.clear();
  failedHourlyForecast.clear();
  failedDailyForecast.clear();
  failedCurrentAndHourlyWeather.clear();
}
