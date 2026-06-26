import type { TomorrowHourlyForecastEntry } from "@/services/tomorrow";
import type { WydotRoadReport } from "@/services/wydot";
import type { RoadConditionChartPoint } from "@/utils/roadConditionChart";
import type {
  HomeCurrentWeatherSnapshot,
  HomeDataState,
} from "@/utils/homeWeatherFormatting";

export function buildHomeRoadHourlyPoints(params: {
  currentWeather?: HomeCurrentWeatherSnapshot;
  hourlyEntries: TomorrowHourlyForecastEntry[];
  hourlyState: HomeDataState;
  roadReport: WydotRoadReport | null;
}): RoadConditionChartPoint[] {
  const { currentWeather, hourlyEntries, hourlyState, roadReport } = params;
  const points: RoadConditionChartPoint[] = [];
  const observation = roadReport?.primaryStationObservation ?? null;
  const observationTime = observation?.observedAt ?? roadReport?.fetchedAt;
  const hasHourlyForecast = hourlyEntries.length > 0;

  if (!hasHourlyForecast && currentWeather) {
    const currentWeatherTime =
      currentWeather.sourceTimestamp ??
      currentWeather.refreshFallbackLabel ??
      new Date().toISOString();

    if (
      currentWeather.temperatureF !== null ||
      currentWeather.windSpeedMph !== null ||
      currentWeather.precipProbability !== null
    ) {
      points.push({
        time: currentWeatherTime,
        airTemp: currentWeather.temperatureF,
        windSpeed: currentWeather.windSpeedMph,
        windGust: currentWeather.windGustMph,
        precipitationProbability: currentWeather.precipProbability,
        weatherCode: currentWeather.weatherCode,
        sourceProvider: "tomorrow",
        confidence: "observed",
      });
    }
  } else if (
    observation &&
    observationTime &&
    (typeof observation.surfaceTempF === "number" ||
      typeof observation.airTempF === "number" ||
      typeof observation.windAvgMph === "number" ||
      typeof observation.windGustMph === "number")
  ) {
    points.push({
      time: observationTime,
      roadTemp: observation.surfaceTempF,
      airTemp: observation.airTempF,
      windSpeed: observation.windAvgMph,
      windGust: observation.windGustMph,
      sourceProvider: "wydot",
      sourceStationId: observation.stationName,
      confidence: "observed",
    });
  }

  hourlyEntries.slice(0, 12).forEach((entry) => {
    points.push({
      time: entry.time,
      precipitationProbability:
        typeof entry.precipProbability === "number"
          ? entry.precipProbability
          : undefined,
      airTemp: typeof entry.temp === "number" ? entry.temp : undefined,
      windSpeed: typeof entry.windSpeed === "number" ? entry.windSpeed : undefined,
      windGust: typeof entry.windGust === "number" ? entry.windGust : undefined,
      weatherCode: typeof entry.weatherCode === "number" ? entry.weatherCode : undefined,
      sourceProvider: "tomorrow",
      confidence: hourlyState === "stale" ? "estimated" : "forecast",
    });
  });

  return points.sort((first, second) => {
    const firstTime = new Date(first.time).getTime();
    const secondTime = new Date(second.time).getTime();

    if (Number.isNaN(firstTime) || Number.isNaN(secondTime)) {
      return 0;
    }

    return firstTime - secondTime;
  });
}
