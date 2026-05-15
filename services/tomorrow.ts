import type { AppLocation } from "@/data/locationStore";

const ROAD_API_BASE_URL = process.env.EXPO_PUBLIC_ROAD_API_BASE_URL;
const CURRENT_WEATHER_REQUEST_TIMEOUT_MS = 1500;
const FORECAST_REQUEST_TIMEOUT_MS = 3000;
const COMBINED_WEATHER_REQUEST_TIMEOUT_MS = 3500;
const WEATHER_TRANSPORT_RETRY_DELAY_MS = 750;
const WEATHER_TRANSPORT_RETRY_ATTEMPTS = 1;
const WEATHER_DEBUG_LOGGING_ENABLED = __DEV__;

export type TomorrowRealtimeResponse = {
  data: {
    time?: string;
    values: TomorrowRealtimeValues;
  };
};

type TomorrowRealtimeValues = {
  temperature?: number;
  weatherCode?: number;
  windSpeed?: number;
  windDirection?: number;
  windGust?: number;
  precipitationProbability?: number;
  humidity?: number;
  visibility?: number;
  temperatureApparent?: number;
};

export type TomorrowDailyForecastEntry = {
  time: string;
  values: {
    temperatureMax?: number;
    temperatureMin?: number;
    weatherCodeMax?: number;
    precipitationProbabilityAvg?: number;
  };
};

export type TomorrowDailyForecastResponse = {
  timelines?: {
    daily?: TomorrowDailyForecastEntry[];
  };
};

export type TomorrowHourlyForecastEntry = {
  time: string;
  values: {
    temperature?: number;
    weatherCode?: number;
    windSpeed?: number;
    windDirection?: number;
    windGust?: number;
    precipitationProbability?: number;
    humidity?: number;
  };
};

export type TomorrowHourlyForecastResponse = {
  timelines?: {
    hourly?: TomorrowHourlyForecastEntry[];
  };
};

export type RoadSignalWeatherBranchMeta = {
  ok: boolean;
  status: number | null;
  statusText: string | null;
  elapsedMs: number | null;
  error: {
    message: string;
    status: number | null;
    statusText: string | null;
    elapsedMs: number;
    bodyPreview: string | null;
  } | null;
};

type RoadSignalCombinedWeatherResponse = {
  current?: RoadSignalWeatherBranchMeta;
  hourly?: RoadSignalWeatherBranchMeta;
  currentWeather: TomorrowRealtimeResponse;
  hourlyForecast: TomorrowHourlyForecastResponse;
};

export type RoadSignalHomeInitialResponse = {
  location: {
    name: string;
    lat: number;
    lon: number;
  };
  current: {
    currentTemp: number | null;
    feelsLike: number | null;
    windSpeed: number | null;
    windGust: number | null;
    humidity: number | null;
    precipProbability: number | null;
    visibility: number | null;
    weatherCode: number | null;
    condition: string;
  };
  summary: {
    headline: string;
    impactLevel: "Low" | "Moderate" | "High";
    recommendation: string;
  };
  freshness: {
    weatherUpdatedAt: string | null;
    alertsUpdatedAt: string | null;
    roadUpdatedAt: string | null;
  };
  status: {
    current: "fresh" | "unavailable";
    alerts: "loading" | "fresh" | "unavailable";
    hourly: "loading" | "fresh" | "unavailable";
    daily: "loading" | "fresh" | "unavailable";
    roadRisk: "loading" | "fresh" | "unavailable" | "estimated";
  };
};

function assertRoadApiBaseUrl() {
  if (!ROAD_API_BASE_URL) {
    throw new Error("Missing EXPO_PUBLIC_ROAD_API_BASE_URL");
  }

  return ROAD_API_BASE_URL.replace(/\/$/, "");
}

function buildRoadSignalUrl(
  path: string,
  location: AppLocation,
  extras?: Record<string, string>,
) {
  const baseUrl = assertRoadApiBaseUrl();
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
    ...extras,
  });

  return `${baseUrl}${path}?${params.toString()}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRoadSignalJson<T>(
  url: string,
  errorLabel: string,
  init?: RequestInit,
  timeoutMs = FORECAST_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const startedAt = Date.now();
  let lastTransportError: unknown = null;

  try {
    for (
      let attempt = 0;
      attempt <= WEATHER_TRANSPORT_RETRY_ATTEMPTS;
      attempt += 1
    ) {
      const attemptStartedAt = Date.now();

      if (WEATHER_DEBUG_LOGGING_ENABLED) {
        console.log("[WeatherClient] Request", {
          url,
          attempt: attempt + 1,
          startedAt: new Date(attemptStartedAt).toISOString(),
        });
      }

      try {
        const response = await fetch(url, {
          ...init,
          signal: init?.signal ?? controller.signal,
        });

        const elapsedMs = Date.now() - attemptStartedAt;

        if (WEATHER_DEBUG_LOGGING_ENABLED) {
          console.log("[WeatherClient] Response", {
            url,
            attempt: attempt + 1,
            status: response.status,
            ok: response.ok,
            elapsedMs,
          });
        }

        if (!response.ok) {
          let responseText = "";

          try {
            responseText = await response.text();
          } catch {
            responseText = "";
          }

          throw new Error(
            `${errorLabel}: ${response.status}${responseText ? ` ${responseText.slice(0, 240)}` : ""}`,
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        const elapsedMs = Date.now() - attemptStartedAt;
        const isAbortError =
          error instanceof Error && error.name === "AbortError";

        if (isAbortError) {
          throw new Error(
            `${errorLabel}: request timed out after ${Date.now() - startedAt}ms`,
          );
        }

        lastTransportError = error;

        if (WEATHER_DEBUG_LOGGING_ENABLED) {
          console.log("[WeatherClient] Network failure", {
            url,
            attempt: attempt + 1,
            elapsedMs,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (attempt < WEATHER_TRANSPORT_RETRY_ATTEMPTS) {
          await wait(WEATHER_TRANSPORT_RETRY_DELAY_MS);
          continue;
        }
      }
    }

    throw lastTransportError;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getCurrentWeather(
  location: AppLocation,
): Promise<TomorrowRealtimeResponse> {
  const url = buildRoadSignalUrl("/api/weather/current", location);
  return fetchRoadSignalJson<TomorrowRealtimeResponse>(
    url,
    "Failed to fetch current weather data",
    undefined,
    CURRENT_WEATHER_REQUEST_TIMEOUT_MS,
  );
}

export async function getHomeInitialWeather(
  location: AppLocation,
): Promise<RoadSignalHomeInitialResponse> {
  const url = buildRoadSignalUrl("/api/home/initial", location, {
    name: location.name,
  });
  return fetchRoadSignalJson<RoadSignalHomeInitialResponse>(
    url,
    "Failed to fetch home initial weather data",
    undefined,
    CURRENT_WEATHER_REQUEST_TIMEOUT_MS,
  );
}

export async function getDailyForecast(
  location: AppLocation,
): Promise<TomorrowDailyForecastResponse> {
  const url = buildRoadSignalUrl("/api/weather/daily", location);
  return fetchRoadSignalJson<TomorrowDailyForecastResponse>(
    url,
    "Failed to fetch daily forecast data",
    undefined,
    FORECAST_REQUEST_TIMEOUT_MS,
  );
}

export async function getHourlyForecast(
  location: AppLocation,
): Promise<TomorrowHourlyForecastResponse> {
  const url = buildRoadSignalUrl("/api/weather/hourly", location);
  return fetchRoadSignalJson<TomorrowHourlyForecastResponse>(
    url,
    "Failed to fetch hourly forecast data",
    undefined,
    FORECAST_REQUEST_TIMEOUT_MS,
  );
}

export async function getCurrentAndHourlyWeather(
  location: AppLocation,
): Promise<RoadSignalCombinedWeatherResponse> {
  const url = buildRoadSignalUrl("/api/weather/current-hourly", location);
  return fetchRoadSignalJson<RoadSignalCombinedWeatherResponse>(
    url,
    "Failed to fetch combined current and hourly weather data",
    undefined,
    COMBINED_WEATHER_REQUEST_TIMEOUT_MS,
  );
}
