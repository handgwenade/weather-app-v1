import type { AppLocation } from '../data/locationStore';

const apiKey = process.env.EXPO_PUBLIC_TOMORROW_API_KEY;

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

function getLocationQuery(location: AppLocation) {
  return `${location.latitude},${location.longitude}`;
}

export async function getCurrentWeather(location: AppLocation) {
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_TOMORROW_API_KEY');
  }

  const locationQuery = getLocationQuery(location);

  const url =
    `https://api.tomorrow.io/v4/weather/realtime?location=${locationQuery}&apikey=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch current weather data: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

export async function getDailyForecast(location: AppLocation) {
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_TOMORROW_API_KEY');
  }

  const locationQuery = getLocationQuery(location);

  const url =
    `https://api.tomorrow.io/v4/weather/forecast?location=${locationQuery}&timesteps=1d&apikey=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch daily forecast data: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

export async function getHourlyForecast(
  location: AppLocation,
): Promise<TomorrowHourlyForecastResponse> {
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_TOMORROW_API_KEY');
  }

  const locationQuery = getLocationQuery(location);

  const url =
    `https://api.tomorrow.io/v4/weather/forecast?location=${locationQuery}&timesteps=1h&apikey=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch hourly forecast data: ${response.status}`);
  }

  const data = await response.json();
  return data;
}
