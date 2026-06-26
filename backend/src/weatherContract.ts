export type TomorrowValues = Record<string, number | string | null>;

export type TomorrowTimelineEntry = {
  startTime?: string;
  time?: string;
  values?: TomorrowValues;
};

export type TomorrowDailyPayload = {
  data?: {
    timelines?: {
      timestep?: string;
      intervals?: TomorrowTimelineEntry[];
    }[];
  };
  timelines?: {
    daily?: {
      time?: string;
      values?: TomorrowValues;
    }[];
  };
};

export function getFiniteTomorrowNumber(
  values: TomorrowValues | undefined,
  field: string,
) {
  const value = values?.[field];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function celsiusToFahrenheit(value: number | null) {
  return value === null ? null : (value * 9) / 5 + 32;
}

function metersPerSecondToMph(value: number | null) {
  return value === null ? null : value * 2.2369362920544;
}

function kilometersToMiles(value: number | null) {
  return value === null ? null : value * 0.62137119223733;
}

function roundNullable(value: number | null, digits = 0) {
  if (value === null) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function getConditionLabelFromWeatherCode(weatherCode: number | null) {
  switch (weatherCode) {
    case 1000:
      return "Clear";
    case 1100:
      return "Mostly clear";
    case 1101:
      return "Partly cloudy";
    case 1102:
      return "Mostly cloudy";
    case 1001:
      return "Cloudy";
    case 4000:
      return "Drizzle";
    case 4001:
      return "Rain";
    case 4200:
      return "Light rain";
    case 4201:
      return "Heavy rain";
    case 5000:
      return "Snow";
    case 5001:
      return "Flurries";
    case 5100:
      return "Light snow";
    case 5101:
      return "Heavy snow";
    case 6000:
      return "Freezing drizzle";
    case 6001:
      return "Freezing rain";
    case 6200:
      return "Light freezing rain";
    case 6201:
      return "Heavy freezing rain";
    case 7000:
      return "Ice pellets";
    case 7101:
      return "Heavy ice pellets";
    case 7102:
      return "Light ice pellets";
    case 8000:
      return "Thunderstorm";
    default:
      return "Current conditions";
  }
}

export function toHomeCurrentPayload(values: TomorrowValues | undefined) {
  const weatherCode = getFiniteTomorrowNumber(values, "weatherCode");
  const windSpeedMph = roundNullable(
    metersPerSecondToMph(getFiniteTomorrowNumber(values, "windSpeed")),
    1,
  );
  const windGustMph = roundNullable(
    metersPerSecondToMph(getFiniteTomorrowNumber(values, "windGust")),
    1,
  );

  return {
    currentTemp: roundNullable(
      celsiusToFahrenheit(getFiniteTomorrowNumber(values, "temperature")),
    ),
    feelsLike: roundNullable(
      celsiusToFahrenheit(
        getFiniteTomorrowNumber(values, "temperatureApparent"),
      ),
    ),
    windSpeed: windSpeedMph,
    windGust: windGustMph,
    humidity: roundNullable(getFiniteTomorrowNumber(values, "humidity")),
    precipProbability: roundNullable(
      getFiniteTomorrowNumber(values, "precipitationProbability"),
    ),
    visibility: roundNullable(
      kilometersToMiles(getFiniteTomorrowNumber(values, "visibility")),
      1,
    ),
    weatherCode,
    condition: getConditionLabelFromWeatherCode(weatherCode),
  };
}

export function toAppCurrentWeatherResponse(
  entry: TomorrowTimelineEntry | undefined,
) {
  return {
    ...toHomeCurrentPayload(entry?.values),
    updatedAt: entry?.startTime ?? entry?.time ?? null,
  };
}

export function toAppHourlyForecastResponse(entries: TomorrowTimelineEntry[]) {
  const hourlyForecast = entries.map((entry) => {
    const values = entry.values;

    return {
      time: entry.startTime ?? entry.time ?? "",
      temp: roundNullable(
        celsiusToFahrenheit(getFiniteTomorrowNumber(values, "temperature")),
      ),
      windSpeed: roundNullable(
        metersPerSecondToMph(getFiniteTomorrowNumber(values, "windSpeed")),
        1,
      ),
      windGust: roundNullable(
        metersPerSecondToMph(getFiniteTomorrowNumber(values, "windGust")),
        1,
      ),
      precipProbability: roundNullable(
        getFiniteTomorrowNumber(values, "precipitationProbability"),
      ),
      weatherCode: getFiniteTomorrowNumber(values, "weatherCode"),
      precipType: getFiniteTomorrowNumber(values, "precipitationType"),
    };
  });

  return {
    hourlyForecast,
    updatedAt: hourlyForecast[0]?.time || null,
  };
}

function getDailyEntries(payload: TomorrowDailyPayload) {
  return (
    payload.timelines?.daily ??
    payload.data?.timelines?.find((timeline) => timeline.timestep === "1d")
      ?.intervals ??
    []
  );
}

export function toAppDailyForecastResponse(payload: TomorrowDailyPayload) {
  const dailyForecast = getDailyEntries(payload).map((entry) => {
    const values = entry.values;

    return {
      date:
        "time" in entry && typeof entry.time === "string"
          ? entry.time
          : "startTime" in entry && typeof entry.startTime === "string"
            ? entry.startTime
            : "",
      highTemp: roundNullable(
        celsiusToFahrenheit(getFiniteTomorrowNumber(values, "temperatureMax")),
      ),
      lowTemp: roundNullable(
        celsiusToFahrenheit(getFiniteTomorrowNumber(values, "temperatureMin")),
      ),
      precipProbability: roundNullable(
        getFiniteTomorrowNumber(values, "precipitationProbabilityAvg"),
      ),
      weatherCode:
        getFiniteTomorrowNumber(values, "weatherCodeMax") ??
        getFiniteTomorrowNumber(values, "weatherCode"),
    };
  });

  return {
    dailyForecast,
    updatedAt: dailyForecast[0]?.date || null,
  };
}

export function withWeatherDebug<T extends object>(
  response: T,
  params: {
    includeDebug: boolean;
    provider: string;
    raw: unknown;
  },
) {
  if (!params.includeDebug) {
    return response;
  }

  return {
    ...response,
    debug: {
      provider: params.provider,
      raw: params.raw,
    },
  };
}
