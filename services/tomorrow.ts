import type { AppLocation } from "@/data/locationStore";

const ROAD_API_BASE_URL = process.env.EXPO_PUBLIC_ROAD_API_BASE_URL;

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

type RoadSignalCombinedWeatherResponse = {
  currentWeather: TomorrowRealtimeResponse;
  hourlyForecast: TomorrowHourlyForecastResponse;
};

function assertRoadApiBaseUrl() {
  if (!ROAD_API_BASE_URL) {
    throw new Error("Missing EXPO_PUBLIC_ROAD_API_BASE_URL");
  }

  return ROAD_API_BASE_URL.replace(/\/$/, "");
}

function buildRoadSignalUrl(path: string, location: AppLocation) {
  const baseUrl = assertRoadApiBaseUrl();
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
  });

  return `${baseUrl}${path}?${params.toString()}`;
}

async function fetchRoadSignalJson<T>(
  url: string,
  errorLabel: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`${errorLabel}: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getCurrentWeather(
  location: AppLocation,
): Promise<TomorrowRealtimeResponse> {
  const url = buildRoadSignalUrl("/api/weather/current", location);
  return fetchRoadSignalJson<TomorrowRealtimeResponse>(
    url,
    "Failed to fetch current weather data",
  );
}

export async function getDailyForecast(
  location: AppLocation,
): Promise<TomorrowDailyForecastResponse> {
  const url = buildRoadSignalUrl("/api/weather/daily", location);
  return fetchRoadSignalJson<TomorrowDailyForecastResponse>(
    url,
    "Failed to fetch daily forecast data",
  );
}

export async function getHourlyForecast(
  location: AppLocation,
): Promise<TomorrowHourlyForecastResponse> {
  const url = buildRoadSignalUrl("/api/weather/hourly", location);
  return fetchRoadSignalJson<TomorrowHourlyForecastResponse>(
    url,
    "Failed to fetch hourly forecast data",
  );
}

export async function getCurrentAndHourlyWeather(
  location: AppLocation,
): Promise<RoadSignalCombinedWeatherResponse> {
  const url = buildRoadSignalUrl("/api/weather/current-hourly", location);
  return fetchRoadSignalJson<RoadSignalCombinedWeatherResponse>(
    url,
    "Failed to fetch combined current and hourly weather data",
  );
}
