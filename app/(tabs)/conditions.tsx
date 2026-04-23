import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { BarChart, LineChart } from "react-native-chart-kit";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSelectedLocation } from "@/data/locationStore";
import {
  getSharedCurrentWeather,
  getSharedHourlyForecast,
} from "@/data/weatherStore";
import { useScrollToTopOnFocus } from "@/hooks/useScrollToTopOnFocus";
import type { TomorrowHourlyForecastEntry } from "@/services/tomorrow";
import { formatTime24Hour, formatUpdatedTimeLabel } from "@/utils/dateTime";
import { celsiusToFahrenheit, metersPerSecondToMph } from "@/utils/weather";

type HourlyForecastStatus = "loading" | "ready" | "unavailable";

type HourlyChartPoint = {
  id: string;
  timeLabel: string;
  temperatureF: number | null;
  windSpeedMph: number | null;
  precipitationProbability: number | null;
};

type ConditionsChartCardModel = {
  id: string;
  title: string;
  chartType: "line" | "bar";
  labels: string[];
  values: number[];
  valueOffset: number;
  segments: number;
  emptyText: string;
  noteText: string | null;
  yAxisSuffix: string;
  color: string;
};

type ConditionsViewModel = {
  updatedLabel: string;
  summaryText: string;
  takeawayText: string;
  chartCards: ConditionsChartCardModel[];
};

type UseConditionsScreenDataResult = {
  hourlyForecast: TomorrowHourlyForecastEntry[];
  hourlyStatus: HourlyForecastStatus;
  sourceUpdatedLabel: string | null;
  fallbackRefreshLabel: string | null;
};

type ConditionsScreenV2Props = {
  locationName: string;
  updatedLabel: string;
  summaryText: string;
  takeawayText: string;
  chartCards: ConditionsChartCardModel[];
  onPressSettings: () => void;
  onPressLocationSearch: () => void;
};
function ConditionsScreenV2({
  locationName,
  updatedLabel,
  summaryText,
  takeawayText,
  chartCards,
  onPressSettings,
  onPressLocationSearch,
}: ConditionsScreenV2Props) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.max(screenWidth - 72, 260);
  const scrollViewRef = useRef<ScrollView>(null);

  useScrollToTopOnFocus(scrollViewRef);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              onPress={onPressLocationSearch}
              style={styles.locationButton}
            >
              <Text style={styles.locationTitle}>{locationName}</Text>
              <Ionicons name="chevron-down" size={18} color="#0F172B" />
            </Pressable>
            <Pressable
              accessibilityLabel="Open settings"
              accessibilityRole="button"
              onPress={onPressSettings}
              style={styles.iconButton}
            >
              <Ionicons name="settings-outline" size={22} color="#475569" />
            </Pressable>
          </View>
          <Text style={styles.updatedText}>{updatedLabel}</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{summaryText}</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.cardTitle}>Next 12 Hours</Text>

            {chartCards.length > 0 ? (
              <View style={styles.chartStack}>
                {chartCards.map((card) => (
                  <ConditionsChartCard
                    key={card.id}
                    card={card}
                    chartWidth={chartWidth}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.unavailableText}>
                Hourly forecast is unavailable right now.
              </Text>
            )}
          </View>

          <View style={styles.takeawayCard}>
            <Text style={styles.takeawayTitle}>Operational Takeaway</Text>
            <Text style={styles.takeawayText}>{takeawayText}</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function getConditionLabel(weatherCode?: number) {
  if (weatherCode === 1000) return "Clear";
  if (weatherCode === 1100) return "Mostly clear";
  if (weatherCode === 1101) return "Partly cloudy";
  if (weatherCode === 1102) return "Mostly cloudy";
  if (weatherCode === 1001) return "Cloudy";
  if (weatherCode === 4000) return "Drizzle";
  if (weatherCode === 4001) return "Rain";
  if (weatherCode === 4200) return "Light rain";
  if (weatherCode === 4201) return "Heavy rain";
  if (weatherCode === 5000) return "Snow";
  if (weatherCode === 5100) return "Light snow";
  if (weatherCode === 5101) return "Heavy snow";
  if (weatherCode === 6000) return "Freezing drizzle";
  if (weatherCode === 6200) return "Light freezing rain";
  if (weatherCode === 6201) return "Heavy freezing rain";
  if (weatherCode === 8000) return "Thunderstorm";
  return "Current conditions";
}

function formatClockLabel(value: string | Date) {
  return formatTime24Hour(value);
}

function formatUpdatedLabel(
  sourceTimestamp: string | null,
  fallbackLabel: string | null,
) {
  return formatUpdatedTimeLabel({
    sourceTimestamp,
    fallbackLabel,
  });
}

function getNextTwelveHours(hourlyEntries: TomorrowHourlyForecastEntry[]) {
  return hourlyEntries.slice(0, 12);
}

function buildHourlyChartPoints(
  hourlyEntries: TomorrowHourlyForecastEntry[],
): HourlyChartPoint[] {
  return getNextTwelveHours(hourlyEntries).map((entry, index) => ({
    id: `${entry.time}-${index}`,
    timeLabel: formatClockLabel(entry.time) ?? "Time unavailable",
    temperatureF:
      typeof entry.values.temperature === "number"
        ? celsiusToFahrenheit(entry.values.temperature)
        : null,
    windSpeedMph:
      typeof entry.values.windSpeed === "number"
        ? metersPerSecondToMph(entry.values.windSpeed)
        : null,
    precipitationProbability:
      typeof entry.values.precipitationProbability === "number"
        ? entry.values.precipitationProbability
        : null,
  }));
}

function buildChartLabels(labels: string[]) {
  return labels.map((label, index) => (index % 2 === 0 ? label : ""));
}

function buildLineChartCard(params: {
  id: string;
  title: string;
  points: HourlyChartPoint[];
  emptyText: string;
  yAxisSuffix: string;
  color: string;
  valueSelector: (point: HourlyChartPoint) => number | null;
}) {
  const { id, title, points, emptyText, yAxisSuffix, color, valueSelector } =
    params;
  const availablePoints = points.filter((point) => {
    const value = valueSelector(point);
    return typeof value === "number" && Number.isFinite(value);
  });

  if (availablePoints.length === 0) {
    return {
      id,
      title,
      chartType: "line",
      labels: [],
      values: [],
      valueOffset: 0,
      segments: 3,
      emptyText,
      noteText: null,
      yAxisSuffix,
      color,
    } satisfies ConditionsChartCardModel;
  }

  const actualValues = availablePoints.map((point) =>
    Math.round(valueSelector(point) ?? 0),
  );
  const minValue = Math.min(...actualValues);
  const maxValue = Math.max(...actualValues);
  const missingCount = points.length - availablePoints.length;

  return {
    id,
    title,
    chartType: "line",
    labels: buildChartLabels(availablePoints.map((point) => point.timeLabel)),
    values: actualValues,
    valueOffset: 0,
    segments: 3,
    emptyText,
    noteText:
      missingCount > 0
        ? `Showing ${availablePoints.length} of ${points.length} available hourly points.`
        : `Visible range ${minValue}${yAxisSuffix} to ${maxValue}${yAxisSuffix}.`,
    yAxisSuffix,
    color,
  } satisfies ConditionsChartCardModel;
}

function buildPrecipChartCard(points: HourlyChartPoint[]) {
  const values = points.map((point) =>
    point.precipitationProbability === null
      ? 0
      : Math.round(point.precipitationProbability),
  );
  const availableCount = points.filter(
    (point) => point.precipitationProbability !== null,
  ).length;

  return {
    id: "precip",
    title: "Precip Probability",
    chartType: "line",
    labels: buildChartLabels(points.map((point) => point.timeLabel)),
    values,
    valueOffset: 0,
    segments: 4,
    emptyText: "Precipitation probability is unavailable for the next 12 hours.",
    noteText:
      availableCount < points.length
        ? `Across all ${points.length} visible hours. Missing precip values are shown on the 0% baseline.`
        : `Across all ${points.length} visible hours. Flat periods indicate 0% precip probability.`,
    yAxisSuffix: "%",
    color: "#0F766E",
  } satisfies ConditionsChartCardModel;
}

function buildSummaryText(hourlyEntries: TomorrowHourlyForecastEntry[]) {
  if (hourlyEntries.length === 0) {
    return "Hourly forecast is unavailable right now.";
  }

  const nextTwelveHours = getNextTwelveHours(hourlyEntries);
  const firstEntry = nextTwelveHours[0];
  const temperatures = nextTwelveHours
    .map((entry) =>
      typeof entry.values.temperature === "number"
        ? celsiusToFahrenheit(entry.values.temperature)
        : null,
    )
    .filter((value): value is number => value !== null);
  const windSpeeds = nextTwelveHours
    .map((entry) =>
      typeof entry.values.windSpeed === "number"
        ? metersPerSecondToMph(entry.values.windSpeed)
        : null,
    )
    .filter((value): value is number => value !== null);
  const precipProbabilities = nextTwelveHours
    .map((entry) =>
      typeof entry.values.precipitationProbability === "number"
        ? entry.values.precipitationProbability
        : null,
    )
    .filter((value): value is number => value !== null);

  const conditionLabel =
    typeof firstEntry?.values.weatherCode === "number"
      ? getConditionLabel(firstEntry.values.weatherCode)
      : "Hourly forecast";
  const minTemp =
    temperatures.length > 0
      ? `${Math.round(Math.min(...temperatures))}°F`
      : "--";
  const maxTemp =
    temperatures.length > 0
      ? `${Math.round(Math.max(...temperatures))}°F`
      : "--";
  const maxWind =
    windSpeeds.length > 0 ? `${Math.round(Math.max(...windSpeeds))} mph` : "--";
  const maxPrecip =
    precipProbabilities.length > 0
      ? `${Math.round(Math.max(...precipProbabilities))}%`
      : "--";

  return `${conditionLabel} leads the next 12 hours. Temps range ${minTemp} to ${maxTemp}, wind peaks near ${maxWind}, and precip probability peaks near ${maxPrecip}.`;
}

function buildTakeawayText(hourlyEntries: TomorrowHourlyForecastEntry[]) {
  if (hourlyEntries.length === 0) {
    return "Hourly forecast is unavailable, so no forward-looking weather takeaway is available right now.";
  }

  const nextTwelveHours = getNextTwelveHours(hourlyEntries);
  const minTempF = nextTwelveHours.reduce<number | null>((lowest, entry) => {
    if (typeof entry.values.temperature !== "number") {
      return lowest;
    }

    const value = celsiusToFahrenheit(entry.values.temperature);
    return lowest === null ? value : Math.min(lowest, value);
  }, null);
  const maxWindMph = nextTwelveHours.reduce<number | null>((highest, entry) => {
    if (typeof entry.values.windSpeed !== "number") {
      return highest;
    }

    const value = metersPerSecondToMph(entry.values.windSpeed);
    return highest === null ? value : Math.max(highest, value);
  }, null);
  const maxPrecipProbability = nextTwelveHours.reduce<number | null>(
    (highest, entry) => {
      if (typeof entry.values.precipitationProbability !== "number") {
        return highest;
      }

      return highest === null
        ? entry.values.precipitationProbability
        : Math.max(highest, entry.values.precipitationProbability);
    },
    null,
  );
  const weatherLabels = nextTwelveHours.map((entry) =>
    typeof entry.values.weatherCode === "number"
      ? getConditionLabel(entry.values.weatherCode).toLowerCase()
      : "",
  );
  const hasWetSignal = weatherLabels.some(
    (label) =>
      label.includes("rain") ||
      label.includes("drizzle") ||
      label.includes("snow") ||
      label.includes("freezing"),
  );

  if (
    maxPrecipProbability !== null &&
    maxPrecipProbability >= 50 &&
    hasWetSignal
  ) {
    return `Forecast precipitation probability reaches ${Math.round(maxPrecipProbability)}% in the next 12 hours, with rain or wintry signals in the hourly outlook.`;
  }

  if (minTempF !== null && minTempF <= 32) {
    return `Hourly forecast temperatures dip to ${Math.round(minTempF)}°F in the next 12 hours.`;
  }

  if (maxWindMph !== null && maxWindMph >= 25) {
    return `Hourly forecast wind peaks near ${Math.round(maxWindMph)} mph in the next 12 hours.`;
  }

  const minPrecipText =
    maxPrecipProbability !== null ? `${Math.round(maxPrecipProbability)}%` : "--";
  const minTempText = minTempF !== null ? `${Math.round(minTempF)}°F` : "--";
  const maxWindText = maxWindMph !== null ? `${Math.round(maxWindMph)} mph` : "--";

  return `Next-12-hour forecast keeps precipitation probability at or below ${minPrecipText}, temperatures above ${minTempText}, and wind below ${maxWindText}.`;
}

function buildConditionsViewModel(params: {
  hourlyEntries: TomorrowHourlyForecastEntry[];
  hourlyStatus: HourlyForecastStatus;
  sourceUpdatedLabel: string | null;
  fallbackRefreshLabel: string | null;
}): ConditionsViewModel {
  const {
    hourlyEntries,
    hourlyStatus,
    sourceUpdatedLabel,
    fallbackRefreshLabel,
  } = params;

  const updatedLabel = formatUpdatedLabel(
    sourceUpdatedLabel,
    fallbackRefreshLabel,
  );

  if (hourlyStatus === "loading" && hourlyEntries.length === 0) {
    return {
      updatedLabel,
      summaryText: "Loading hourly forecast for this location.",
      takeawayText: "Collecting hourly weather guidance now.",
      chartCards: [],
    };
  }

  const chartPoints = buildHourlyChartPoints(hourlyEntries);

  return {
    updatedLabel,
    summaryText: buildSummaryText(hourlyEntries),
    takeawayText: buildTakeawayText(hourlyEntries),
    chartCards: [
      buildLineChartCard({
        id: "temperature",
        title: "Temperature",
        points: chartPoints,
        emptyText: "Temperature data is unavailable for the next 12 hours.",
        yAxisSuffix: "°F",
        color: "#C2410C",
        valueSelector: (point) => point.temperatureF,
      }),
      buildLineChartCard({
        id: "wind",
        title: "Wind",
        points: chartPoints,
        emptyText: "Wind data is unavailable for the next 12 hours.",
        yAxisSuffix: " mph",
        color: "#1D4ED8",
        valueSelector: (point) => point.windSpeedMph,
      }),
      buildPrecipChartCard(chartPoints),
    ],
  };
}

function useConditionsScreenData(
  selectedLocation: ReturnType<typeof useSelectedLocation>,
): UseConditionsScreenDataResult {
  const [hourlyForecast, setHourlyForecast] = useState<
    TomorrowHourlyForecastEntry[]
  >([]);
  const [hourlyStatus, setHourlyStatus] =
    useState<HourlyForecastStatus>("loading");
  const [sourceUpdatedLabel, setSourceUpdatedLabel] = useState<string | null>(
    null,
  );
  const [fallbackRefreshLabel, setFallbackRefreshLabel] = useState<
    string | null
  >(null);

  useEffect(() => {
    let isActive = true;

    async function loadConditions() {
      if (!selectedLocation) {
        setHourlyForecast([]);
        setHourlyStatus("loading");
        setSourceUpdatedLabel(null);
        setFallbackRefreshLabel(null);
        return;
      }

      setHourlyStatus("loading");
      const fallbackLabel = formatClockLabel(new Date());

      const [currentResult, hourlyResult] = await Promise.allSettled([
        getSharedCurrentWeather(selectedLocation),
        getSharedHourlyForecast(selectedLocation),
      ]);

      if (!isActive) {
        return;
      }

      if (currentResult.status === "fulfilled") {
        setSourceUpdatedLabel(
          typeof currentResult.value.data.time === "string"
            ? currentResult.value.data.time
            : null,
        );
        setFallbackRefreshLabel(
          typeof currentResult.value.data.time === "string"
            ? null
            : fallbackLabel,
        );
      } else {
        console.log(
          "Conditions screen current weather fetch failed:",
          currentResult.reason,
        );
        setSourceUpdatedLabel(null);
        setFallbackRefreshLabel(fallbackLabel);
      }

      if (hourlyResult.status === "fulfilled") {
        const nextHourly = hourlyResult.value.timelines?.hourly ?? [];
        console.log(
          "[Conditions] Hourly payload sample",
          nextHourly.slice(0, 12).map((entry) => ({
            time: entry.time,
            temperature: entry.values.temperature ?? null,
            windSpeed: entry.values.windSpeed ?? null,
            windGust: entry.values.windGust ?? null,
            precipitationProbability:
              entry.values.precipitationProbability ?? null,
          })),
        );
        setHourlyForecast(nextHourly);
        setHourlyStatus(nextHourly.length > 0 ? "ready" : "unavailable");
      } else {
        console.log(
          "Conditions screen hourly weather fetch failed:",
          hourlyResult.reason,
        );
        setHourlyForecast([]);
        setHourlyStatus("unavailable");
      }
    }

    void loadConditions();

    return () => {
      isActive = false;
    };
  }, [selectedLocation]);

  return {
    hourlyForecast,
    hourlyStatus,
    sourceUpdatedLabel,
    fallbackRefreshLabel,
  };
}

function ConditionsChartCard({
  card,
  chartWidth,
}: {
  card: ConditionsChartCardModel;
  chartWidth: number;
}) {
  const chartConfig = {
    backgroundColor: "#FFFFFF",
    backgroundGradientFrom: "#FFFFFF",
    backgroundGradientTo: "#FFFFFF",
    decimalPlaces: 0,
    formatYLabel: (value: string) =>
      `${Math.round(Number(value) + card.valueOffset)}`,
    color: () => card.color,
    labelColor: () => "#556274",
    fillShadowGradientFrom: card.color,
    fillShadowGradientTo: card.color,
    fillShadowGradientFromOpacity: 0.12,
    fillShadowGradientToOpacity: 0.12,
    propsForBackgroundLines: {
      stroke: "#E2E8F0",
      strokeWidth: 1,
    },
    propsForLabels: {
      fontSize: 10,
    },
    propsForDots: {
      r: "3",
      strokeWidth: "1",
      stroke: card.color,
    },
    barPercentage: 0.6,
  };

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{card.title}</Text>
      {card.noteText ? <Text style={styles.chartNote}>{card.noteText}</Text> : null}

      {card.values.length === 0 ? (
        <Text style={styles.unavailableText}>{card.emptyText}</Text>
      ) : card.chartType === "line" ? (
        <LineChart
          data={{
            labels: card.labels,
            datasets: [
              {
                data: card.values,
                color: () => card.color,
                strokeWidth: 2,
              },
            ],
          }}
          width={chartWidth}
          height={220}
          yAxisLabel=""
          yAxisSuffix={card.yAxisSuffix}
          chartConfig={chartConfig}
          bezier={false}
          withShadow={false}
          withInnerLines={false}
          withOuterLines
          withVerticalLines={false}
          withHorizontalLines
          transparent
          fromZero
          style={styles.chart}
        />
      ) : (
        <BarChart
          data={{
            labels: card.labels,
            datasets: [
              {
                data: card.values,
              },
            ],
          }}
          width={chartWidth}
          height={220}
          yAxisLabel=""
          yAxisSuffix={card.yAxisSuffix}
          chartConfig={chartConfig}
          withInnerLines={false}
          withHorizontalLabels
          withVerticalLabels
          fromZero
          showBarTops={false}
          showValuesOnTopOfBars={false}
          flatColor
          style={styles.chart}
        />
      )}
    </View>
  );
}

export default function ConditionsScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();

  const {
    hourlyForecast,
    hourlyStatus,
    sourceUpdatedLabel,
    fallbackRefreshLabel,
  } = useConditionsScreenData(selectedLocation);

  const viewModel = useMemo(
    () =>
      buildConditionsViewModel({
        hourlyEntries: hourlyForecast,
        hourlyStatus,
        sourceUpdatedLabel,
        fallbackRefreshLabel,
      }),
    [fallbackRefreshLabel, hourlyForecast, hourlyStatus, sourceUpdatedLabel],
  );

  if (!selectedLocation) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.screen}>
          <View style={styles.topBar}>
            <View style={styles.topRow}>
              <Text style={styles.locationTitle}>Conditions</Text>
              <Pressable
                accessibilityLabel="Open settings"
                accessibilityRole="button"
                onPress={() => router.push("/settings")}
                style={styles.iconButton}
              >
                <Ionicons name="settings-outline" size={22} color="#475569" />
              </Pressable>
            </View>
          </View>

          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>
              No active location selected
            </Text>
            <Text style={styles.emptyStateBody}>
              Choose a location to see local conditions here.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/manage-locations")}
              style={styles.emptyStateButton}
            >
              <Text style={styles.emptyStateButtonText}>Manage Locations</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ConditionsScreenV2
      locationName={selectedLocation.name}
      updatedLabel={viewModel.updatedLabel}
      summaryText={viewModel.summaryText}
      takeawayText={viewModel.takeawayText}
      chartCards={viewModel.chartCards}
      onPressSettings={() => router.push("/settings")}
      onPressLocationSearch={() => router.push("/manage-locations")}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    borderBottomWidth: 1,
    borderBottomColor: "#CAD5E2",
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 4,
    backgroundColor: "#FFFFFF",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationTitle: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "700",
    color: "#0F172B",
    letterSpacing: -0.44,
  },
  iconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  updatedText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#62748E",
    letterSpacing: -0.15,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    color: "#0F172B",
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyStateBody: {
    color: "#556274",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 280,
  },
  emptyStateButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#2E6FC7",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  emptyStateButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: "#CAD5E2",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#314158",
    letterSpacing: -0.15,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: "#CAD5E2",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "700",
    color: "#0F172B",
    letterSpacing: -0.44,
  },
  chartStack: {
    gap: 16,
  },
  chartCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  chartTitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: "#0F172B",
  },
  chartNote: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: "#556274",
  },
  chart: {
    marginTop: 8,
    marginLeft: -14,
  },
  unavailableText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#556274",
  },
  takeawayCard: {
    backgroundColor: "#1D293D",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 8,
  },
  takeawayTitle: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.44,
  },
  takeawayText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFF",
    letterSpacing: -0.15,
  },
});
