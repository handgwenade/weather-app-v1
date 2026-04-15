import type { AppLocation } from "@/data/locationStore";

const apiKey = process.env.EXPO_PUBLIC_TOMORROW_API_KEY;

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

export type TomorrowRealtimeResponse = {
  data: {
    time?: string;
    values: TomorrowRealtimeValues;
  };
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

function assertApiKey() {
  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_TOMORROW_API_KEY");
  }

  return apiKey;
}

function getLocationQuery(location: AppLocation) {
  return `${location.latitude},${location.longitude}`;
}

function buildTomorrowUrl(location: AppLocation, timesteps?: "1h" | "1d") {
  const key = assertApiKey();
  const locationQuery = getLocationQuery(location);
  const baseUrl = "https://api.tomorrow.io/v4/weather";

  if (!timesteps) {
    return `${baseUrl}/realtime?location=${locationQuery}&apikey=${key}`;
  }

  return `${baseUrl}/forecast?location=${locationQuery}&timesteps=${timesteps}&apikey=${key}`;
}

async function fetchTomorrowJson<T>(
  url: string,
  errorLabel: string,
): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${errorLabel}: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getCurrentWeather(
  location: AppLocation,
): Promise<TomorrowRealtimeResponse> {
  const url = buildTomorrowUrl(location);
  return fetchTomorrowJson<TomorrowRealtimeResponse>(
    url,
    "Failed to fetch current weather data",
  );
}

export async function getDailyForecast(
  location: AppLocation,
): Promise<TomorrowDailyForecastResponse> {
  const url = buildTomorrowUrl(location, "1d");
  return fetchTomorrowJson<TomorrowDailyForecastResponse>(
    url,
    "Failed to fetch daily forecast data",
  );
}

export async function getHourlyForecast(
  location: AppLocation,
): Promise<TomorrowHourlyForecastResponse> {
  const url = buildTomorrowUrl(location, "1h");
  return fetchTomorrowJson<TomorrowHourlyForecastResponse>(
    url,
    "Failed to fetch hourly forecast data",
  );
}
