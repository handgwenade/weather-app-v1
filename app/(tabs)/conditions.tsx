import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSelectedLocation } from "@/data/locationStore";
import {
  getSharedCurrentWeather,
  getSharedHourlyForecast,
} from "@/data/weatherStore";
import type { TomorrowHourlyForecastEntry } from "@/services/tomorrow";
import { celsiusToFahrenheit, metersPerSecondToMph } from "@/utils/weather";

type HourlyForecastStatus = "loading" | "ready" | "unavailable";

type HourlyConditionsRow = {
  id: string;
  timeLabel: string;
  conditionLabel: string;
  temperatureText: string;
  windText: string;
  precipText: string;
};

type ConditionsViewModel = {
  updatedLabel: string;
  summaryText: string;
  takeawayText: string;
  rows: HourlyConditionsRow[];
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
  rows: HourlyConditionsRow[];
  onPressSettings: () => void;
  onPressLocationSearch: () => void;
};
function ConditionsScreenV2({
  locationName,
  updatedLabel,
  summaryText,
  takeawayText,
  rows,
  onPressSettings,
  onPressLocationSearch,
}: ConditionsScreenV2Props) {
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
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{summaryText}</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.cardTitle}>Next 12 Hours</Text>

            {rows.length > 0 ? (
              <View style={styles.hourlyList}>
                {rows.map((row, index) => (
                  <View key={row.id}>
                    <HourlyRow row={row} />
                    {index < rows.length - 1 ? (
                      <View style={styles.hourlyDivider} />
                    ) : null}
                  </View>
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
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function degreesToCompass(degrees: number) {
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % directions.length;
  return directions[index];
}

function formatTemperatureText(value?: number) {
  return typeof value === "number"
    ? `${Math.round(celsiusToFahrenheit(value))}°F`
    : "--";
}

function formatWindText(speed?: number, direction?: number) {
  if (typeof speed !== "number") {
    return "--";
  }

  const speedText = `${Math.round(metersPerSecondToMph(speed))} mph`;

  if (typeof direction !== "number") {
    return speedText;
  }

  return `${speedText} ${degreesToCompass(direction)}`;
}

function formatPrecipText(value?: number) {
  return typeof value === "number" ? `${Math.round(value)}%` : "--";
}

function buildHourlyConditionsRows(
  hourlyEntries: TomorrowHourlyForecastEntry[],
): HourlyConditionsRow[] {
  return hourlyEntries.slice(0, 12).map((entry, index) => ({
    id: `${entry.time}-${index}`,
    timeLabel: formatClockLabel(entry.time) ?? "Time unavailable",
    conditionLabel:
      typeof entry.values.weatherCode === "number"
        ? getConditionLabel(entry.values.weatherCode)
        : "Unavailable",
    temperatureText: formatTemperatureText(entry.values.temperature),
    windText: formatWindText(
      entry.values.windSpeed,
      entry.values.windDirection,
    ),
    precipText: formatPrecipText(entry.values.precipitationProbability),
  }));
}

function buildSummaryText(hourlyEntries: TomorrowHourlyForecastEntry[]) {
  if (hourlyEntries.length === 0) {
    return "Hourly forecast is unavailable right now.";
  }

  const nextTwelveHours = hourlyEntries.slice(0, 12);
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

  const nextTwelveHours = hourlyEntries.slice(0, 12);
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
    return `Precipitation probability reaches ${Math.round(maxPrecipProbability)}% in the next 12 hours. Weather-sensitive work should stay under watch.`;
  }

  if (minTempF !== null && minTempF <= 32) {
    return `Hourly forecast temperatures dip to ${Math.round(minTempF)}°F in the next 12 hours. Cold weather is the main factor to watch.`;
  }

  if (maxWindMph !== null && maxWindMph >= 25) {
    return `Hourly wind peaks near ${Math.round(maxWindMph)} mph in the next 12 hours. Wind is the main weather factor to watch.`;
  }

  return "No major weather issues are indicated in the next 12 hours.";
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

  const updatedLabel = sourceUpdatedLabel
    ? `Updated ${sourceUpdatedLabel}`
    : fallbackRefreshLabel
      ? `Last refresh ${fallbackRefreshLabel}`
      : "Update time unavailable";

  if (hourlyStatus === "loading" && hourlyEntries.length === 0) {
    return {
      updatedLabel,
      summaryText: "Loading hourly forecast for this location.",
      takeawayText: "Collecting hourly weather guidance now.",
      rows: [],
    };
  }

  return {
    updatedLabel,
    summaryText: buildSummaryText(hourlyEntries),
    takeawayText: buildTakeawayText(hourlyEntries),
    rows: buildHourlyConditionsRows(hourlyEntries),
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
            ? formatClockLabel(currentResult.value.data.time)
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

function HourlyRow({ row }: { row: HourlyConditionsRow }) {
  return (
    <View style={styles.hourlyRow}>
      <View style={styles.hourlyTimeBlock}>
        <Text style={styles.hourlyTime}>{row.timeLabel}</Text>
        <Text style={styles.hourlyCondition}>{row.conditionLabel}</Text>
      </View>

      <View style={styles.hourlyMetricBlock}>
        <Text style={styles.hourlyMetricLabel}>Air Temp</Text>
        <Text style={styles.hourlyMetricValue}>{row.temperatureText}</Text>
      </View>

      <View style={styles.hourlyMetricBlock}>
        <Text style={styles.hourlyMetricLabel}>Wind</Text>
        <Text style={styles.hourlyMetricValue}>{row.windText}</Text>
      </View>

      <View style={styles.hourlyMetricBlock}>
        <Text style={styles.hourlyMetricLabel}>Precip Prob</Text>
        <Text style={styles.hourlyMetricValue}>{row.precipText}</Text>
      </View>
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
      rows={viewModel.rows}
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
  hourlyList: {
    gap: 0,
  },
  hourlyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  hourlyDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  hourlyTimeBlock: {
    flex: 1.4,
    gap: 4,
  },
  hourlyTime: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#0F172B",
  },
  hourlyCondition: {
    fontSize: 13,
    lineHeight: 18,
    color: "#556274",
  },
  hourlyMetricBlock: {
    flex: 1,
    gap: 4,
  },
  hourlyMetricLabel: {
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: "#64748B",
  },
  hourlyMetricValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: "#0F172B",
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
