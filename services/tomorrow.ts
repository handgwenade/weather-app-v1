import type { AppLocation } from "@/data/locationStore";

const apiKey = process.env.EXPO_PUBLIC_TOMORROW_API_KEY;
const TOMORROW_WEATHER_BASE_URL = "https://api.tomorrow.io/v4/weather";
const TOMORROW_TIMELINES_URL = "https://api.tomorrow.io/v4/timelines";
const COMBINED_CURRENT_AND_HOURLY_FIELDS = [
  "temperature",
  "weatherCode",
  "windSpeed",
  "windDirection",
  "windGust",
  "precipitationProbability",
  "humidity",
  "visibility",
  "temperatureApparent",
] as const;

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

type TomorrowCombinedForecastResponse = {
  data?: {
    timelines?: {
      timestep?: "current" | "1h";
      intervals?: {
        startTime?: string;
        values?: TomorrowRealtimeValues;
      }[];
    }[];
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

function buildTomorrowUrl(
  location: AppLocation,
  timesteps?: "1h" | "1d",
) {
  const key = assertApiKey();
  const locationQuery = getLocationQuery(location);

  if (!timesteps) {
    return `${TOMORROW_WEATHER_BASE_URL}/realtime?location=${locationQuery}&apikey=${key}`;
  }

  return `${TOMORROW_WEATHER_BASE_URL}/forecast?location=${locationQuery}&timesteps=${timesteps}&apikey=${key}`;
}

function buildTomorrowTimelinesUrl() {
  return `${TOMORROW_TIMELINES_URL}?apikey=${assertApiKey()}`;
}

async function fetchTomorrowJson<T>(
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

export async function getCurrentAndHourlyWeather(
  location: AppLocation,
): Promise<{
  currentWeather: TomorrowRealtimeResponse;
  hourlyForecast: TomorrowHourlyForecastResponse;
}> {
  const url = buildTomorrowTimelinesUrl();
  const requestBody = {
    location: getLocationQuery(location),
    fields: [...COMBINED_CURRENT_AND_HOURLY_FIELDS],
    units: "metric",
    timesteps: ["current", "1h"],
    startTime: "now",
    endTime: "nowPlus6h",
  };

  console.log("[Tomorrow] Combined current+hourly request", {
    endpoint: TOMORROW_TIMELINES_URL,
    body: requestBody,
  });

  const response = await fetchTomorrowJson<TomorrowCombinedForecastResponse>(
    url,
    "Failed to fetch combined current and hourly weather data",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    },
  );
  const timelines = response.data?.timelines ?? [];
  const currentEntry = timelines.find(
    (timeline) => timeline.timestep === "current",
  )?.intervals?.[0];
  const hourlyEntries =
    timelines.find((timeline) => timeline.timestep === "1h")?.intervals ?? [];

  return {
    currentWeather: {
      data: {
        time: currentEntry?.startTime,
        values: currentEntry?.values ?? {},
      },
    },
    hourlyForecast: {
      timelines: {
        hourly: hourlyEntries.map((entry) => ({
          time: entry.startTime ?? "",
          values: entry.values ?? {},
        })),
      },
    },
  };
}
