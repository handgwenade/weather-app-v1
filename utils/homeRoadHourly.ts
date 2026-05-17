import type { TomorrowHourlyForecastEntry } from "@/services/tomorrow";
import type { WydotRoadReport } from "@/services/wydot";
import type { RoadConditionChartPoint } from "@/utils/roadConditionChart";
import type { HomeDataState } from "@/utils/homeWeatherFormatting";
import { celsiusToFahrenheit, metersPerSecondToMph } from "@/utils/weather";

export function buildHomeRoadHourlyPoints(params: {
  hourlyEntries: TomorrowHourlyForecastEntry[];
  hourlyState: HomeDataState;
  roadReport: WydotRoadReport | null;
}): RoadConditionChartPoint[] {
  const { hourlyEntries, hourlyState, roadReport } = params;
  const points: RoadConditionChartPoint[] = [];
  const observation = roadReport?.primaryStationObservation ?? null;
  const observationTime = observation?.observedAt ?? roadReport?.fetchedAt;

  if (
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

  const currentHour = new Date();
  currentHour.setMinutes(0, 0, 0);

  const futureOrCurrentEntries = hourlyEntries.filter((entry) => {
    const entryDate = new Date(entry.time);

    if (Number.isNaN(entryDate.getTime())) {
      return true;
    }

    return entryDate.getTime() >= currentHour.getTime();
  });

  const visibleEntries =
    futureOrCurrentEntries.length > 0 ? futureOrCurrentEntries : hourlyEntries;

  visibleEntries.slice(0, 12).forEach((entry) => {
    points.push({
      time: entry.time,
      precipitationProbability:
        typeof entry.values.precipitationProbability === "number"
          ? entry.values.precipitationProbability
          : undefined,
      airTemp:
        typeof entry.values.temperature === "number"
          ? celsiusToFahrenheit(entry.values.temperature)
          : undefined,
      windSpeed:
        typeof entry.values.windSpeed === "number"
          ? metersPerSecondToMph(entry.values.windSpeed)
          : undefined,
      windGust:
        typeof entry.values.windGust === "number"
          ? metersPerSecondToMph(entry.values.windGust)
          : undefined,
      weatherCode:
        typeof entry.values.weatherCode === "number"
          ? entry.values.weatherCode
          : undefined,
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
