import QuickSwitchModal from "@/components/quickSwitchModal";
import InteractiveForecastChart from "@/components/conditions/InteractiveForecastChart";
import { Palette, Radius, Shadows } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  setSelectedLocation,
  useSavedLocations,
  useSelectedLocation,
} from "@/data/locationStore";
import {
  getSharedCurrentWeather,
  getSharedHourlyForecast,
} from "@/data/weatherStore";
import { useScrollToTopOnFocus } from "@/hooks/useScrollToTopOnFocus";
import {
  getHourlyForecastEntries,
  type TomorrowHourlyForecastEntry,
} from "@/services/tomorrow";
import { formatTime24Hour, formatUpdatedTimeLabel } from "@/utils/dateTime";
import type {
  ForecastChartHour,
  ForecastChartMetric,
  ForecastChartUnits,
} from "@/utils/forecastChart";

type HourlyForecastStatus = "loading" | "fresh" | "unavailable" | "error";

type ConditionsViewModel = {
  updatedLabel: string;
  summaryText: string;
  takeawayText: string;
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
  hourlyForecast: ForecastChartHour[];
  hourlyStatus: HourlyForecastStatus;
  onPressSettings: () => void;
  onPressLocationSearch: () => void;
};

const CONDITIONS_FIELD_LOGGED_KEYS = new Set<string>();

function warnMissingConditionsWeatherField(params: {
  locationName: string;
  response: unknown;
  entries: TomorrowHourlyForecastEntry[];
}) {
  if (typeof __DEV__ === "undefined" || !__DEV__) {
    return;
  }

  const missingFields = params.entries.slice(0, 12).flatMap((entry, index) => {
    const checks = [
      ["temp", entry.temp],
      ["windSpeed", entry.windSpeed],
      ["windGust", entry.windGust],
      ["precipProbability", entry.precipProbability],
      ["weatherCode", entry.weatherCode],
    ] as const;

    return checks
      .filter(([, value]) => value === null || value === undefined)
      .map(([field, value]) => ({
        index,
        field,
        value,
        valueKind: value === null ? "null" : typeof value,
      }));
  });

  if (params.entries.length > 0 && missingFields.length === 0) {
    return;
  }

  const logKey = [
    params.locationName,
    params.entries.length,
    missingFields.map((field) => `${field.index}:${field.field}`).join(","),
  ].join(":");

  if (CONDITIONS_FIELD_LOGGED_KEYS.has(logKey)) {
    return;
  }

  CONDITIONS_FIELD_LOGGED_KEYS.add(logKey);
  console.warn("[WeatherFieldMissing]", {
    screen: "Conditions",
    activeLocation: params.locationName,
    endpoint: "/api/weather/hourly",
    status: "fulfilled",
    responseKeys:
      params.response && typeof params.response === "object"
        ? Object.keys(params.response)
        : [],
    hourlyCount: params.entries.length,
    missingFields:
      params.entries.length === 0
        ? [{ field: "hourlyForecast", value: undefined, valueKind: "undefined" }]
        : missingFields,
  });
}

const CONDITIONS_CHART_UNITS: ForecastChartUnits = {
  temperature: "F",
  windSpeed: "mph",
};

const FORECAST_METRIC_TABS: {
  metric: ForecastChartMetric;
  label: string;
}[] = [
  { metric: "temperature", label: "Temperature" },
  { metric: "precipitationProbability", label: "Precipitation" },
  { metric: "windSpeed", label: "Wind" },
];

function ConditionsScreenV2({
  locationName,
  updatedLabel,
  summaryText,
  takeawayText,
  hourlyForecast,
  hourlyStatus,
  onPressSettings,
  onPressLocationSearch,
}: ConditionsScreenV2Props) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeMetric, setActiveMetric] =
    useState<ForecastChartMetric>("temperature");

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
              <Ionicons name="chevron-down" size={18} color={Palette.primary} />
            </Pressable>
            <Pressable
              accessibilityLabel="Open settings"
              accessibilityRole="button"
              onPress={onPressSettings}
              style={styles.iconButton}
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color={Palette.primary}
              />
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

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.metricTabs}
            >
              {FORECAST_METRIC_TABS.map((tab) => {
                const isActive = activeMetric === tab.metric;

                return (
                  <Pressable
                    key={tab.metric}
                    accessibilityRole="button"
                    onPress={() => setActiveMetric(tab.metric)}
                    style={
                      isActive ? styles.metricTabActive : styles.metricTab
                    }
                  >
                    <Text
                      style={
                        isActive
                          ? styles.metricTabActiveText
                          : styles.metricTabText
                      }
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <InteractiveForecastChart
              hourly={hourlyForecast}
              metric={activeMetric}
              units={CONDITIONS_CHART_UNITS}
              isLoading={hourlyStatus === "loading"}
              unavailableTitle={
                hourlyStatus === "error"
                  ? "Hourly forecast request failed"
                  : hourlyStatus === "unavailable"
                    ? "Hourly forecast unavailable"
                    : "Hourly data unavailable"
              }
              unavailableMessage={
                hourlyStatus === "error"
                  ? "Weather data could not be loaded right now. Try again before making travel decisions."
                  : hourlyStatus === "unavailable"
                    ? "The provider did not return usable hourly forecast data for this location."
                    : "No valid hourly values are available for this view."
              }
            />
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

function isWintryConditionLabel(label: string) {
  const normalized = label.toLowerCase();

  return normalized.includes("snow") || normalized.includes("freezing");
}

function isWetConditionLabel(label: string) {
  const normalized = label.toLowerCase();

  return (
    normalized.includes("rain") ||
    normalized.includes("drizzle") ||
    normalized.includes("snow") ||
    normalized.includes("freezing")
  );
}

function getNextPrecipSignal(hourlyEntries: TomorrowHourlyForecastEntry[]) {
  const nextTwelveHours = getNextTwelveHours(hourlyEntries);

  for (const entry of nextTwelveHours) {
    const conditionLabel =
      typeof entry.weatherCode === "number"
        ? getConditionLabel(entry.weatherCode)
        : null;
    const precipProbability =
      typeof entry.precipProbability === "number"
        ? entry.precipProbability
        : null;

    if (
      conditionLabel &&
      isWetConditionLabel(conditionLabel) &&
      typeof precipProbability === "number" &&
      precipProbability > 0
    ) {
      return {
        conditionLabel,
        probability: Math.round(precipProbability),
        timeLabel: formatClockLabel(entry.time) ?? "soon",
      };
    }
  }

  return null;
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

function buildInteractiveHourlyForecast(
  hourlyEntries: TomorrowHourlyForecastEntry[],
): ForecastChartHour[] {
  return getNextTwelveHours(hourlyEntries).map((entry) => ({
    time: entry.time,
    temperature: entry.temp,
    windSpeed: entry.windSpeed,
    windGust: entry.windGust,
    precipitationProbability:
      entry.precipProbability,
    weatherCode: entry.weatherCode,
  }));
}

function buildSummaryText(hourlyEntries: TomorrowHourlyForecastEntry[]) {
  if (hourlyEntries.length === 0) {
    return "Hourly forecast is unavailable right now.";
  }

  const nextTwelveHours = getNextTwelveHours(hourlyEntries);
  const firstEntry = nextTwelveHours[0];
  const temperatures = nextTwelveHours
    .map((entry) => entry.temp)
    .filter((value): value is number => value !== null);
  const windSpeeds = nextTwelveHours
    .map((entry) => entry.windSpeed)
    .filter((value): value is number => value !== null);
  const precipProbabilities = nextTwelveHours
    .map((entry) => entry.precipProbability)
    .filter((value): value is number => value !== null);

  const conditionLabel =
    typeof firstEntry?.weatherCode === "number"
      ? getConditionLabel(firstEntry.weatherCode)
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

  const nextPrecipSignal = getNextPrecipSignal(nextTwelveHours);
  const precipSignalText = nextPrecipSignal
    ? ` ${nextPrecipSignal.conditionLabel} signal around ${nextPrecipSignal.timeLabel} at ${nextPrecipSignal.probability}%.`
    : "";

  return `${conditionLabel} leads the next 12 hours. Temps range ${minTemp} to ${maxTemp}, wind peaks near ${maxWind}, and precip probability peaks near ${maxPrecip}.${precipSignalText}`;
}

function buildTakeawayText(hourlyEntries: TomorrowHourlyForecastEntry[]) {
  if (hourlyEntries.length === 0) {
    return "Hourly forecast is unavailable, so no forward-looking weather takeaway is available right now.";
  }

  const nextTwelveHours = getNextTwelveHours(hourlyEntries);
  const minTempF = nextTwelveHours.reduce<number | null>((lowest, entry) => {
    if (typeof entry.temp !== "number") {
      return lowest;
    }

    return lowest === null ? entry.temp : Math.min(lowest, entry.temp);
  }, null);
  const maxWindMph = nextTwelveHours.reduce<number | null>((highest, entry) => {
    if (typeof entry.windSpeed !== "number") {
      return highest;
    }

    return highest === null ? entry.windSpeed : Math.max(highest, entry.windSpeed);
  }, null);
  const maxPrecipProbability = nextTwelveHours.reduce<number | null>(
    (highest, entry) => {
      if (typeof entry.precipProbability !== "number") {
        return highest;
      }

      return highest === null
        ? entry.precipProbability
        : Math.max(highest, entry.precipProbability);
    },
    null,
  );
  const weatherLabels = nextTwelveHours.map((entry) =>
    typeof entry.weatherCode === "number"
      ? getConditionLabel(entry.weatherCode)
      : "",
  );
  const hasWetSignal = weatherLabels.some(isWetConditionLabel);
  const nextPrecipSignal = getNextPrecipSignal(nextTwelveHours);

  if (
    nextPrecipSignal &&
    isWintryConditionLabel(nextPrecipSignal.conditionLabel)
  ) {
    return `${nextPrecipSignal.conditionLabel} is possible around ${nextPrecipSignal.timeLabel}, with precipitation probability near ${nextPrecipSignal.probability}%.`;
  }

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
    maxPrecipProbability !== null
      ? `${Math.round(maxPrecipProbability)}%`
      : "--";
  const minTempText = minTempF !== null ? `${Math.round(minTempF)}°F` : "--";
  const maxWindText =
    maxWindMph !== null ? `${Math.round(maxWindMph)} mph` : "--";

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
    };
  }

  if (hourlyStatus === "error" && hourlyEntries.length === 0) {
    return {
      updatedLabel,
      summaryText: "Hourly forecast request failed.",
      takeawayText:
        "Weather data could not be loaded right now, so no forward-looking weather takeaway is available.",
    };
  }

  if (hourlyStatus === "unavailable" && hourlyEntries.length === 0) {
    return {
      updatedLabel,
      summaryText: "Hourly forecast is unavailable for this location.",
      takeawayText:
        "The provider did not return usable hourly forecast data, so no forward-looking weather takeaway is available.",
    };
  }

  return {
    updatedLabel,
    summaryText: buildSummaryText(hourlyEntries),
    takeawayText: buildTakeawayText(hourlyEntries),
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
          typeof currentResult.value.updatedAt === "string"
            ? currentResult.value.updatedAt
            : null,
        );
        setFallbackRefreshLabel(
          typeof currentResult.value.updatedAt === "string"
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
        const nextHourly = getHourlyForecastEntries(hourlyResult.value);
        warnMissingConditionsWeatherField({
          locationName: selectedLocation.name,
          response: hourlyResult.value,
          entries: nextHourly,
        });
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.log(
            "[Conditions] Hourly payload sample",
            nextHourly.slice(0, 12).map((entry) => ({
              time: entry.time,
              temperature: entry.temp,
              windSpeed: entry.windSpeed,
              windGust: entry.windGust,
              precipProbability: entry.precipProbability,
              weatherCode: entry.weatherCode,
              conditionLabel:
                typeof entry.weatherCode === "number"
                  ? getConditionLabel(entry.weatherCode)
                  : null,
            })),
          );
        }
        setHourlyForecast(nextHourly);
        setHourlyStatus(nextHourly.length > 0 ? "fresh" : "unavailable");
      } else {
        console.error(
          "Conditions screen hourly weather fetch failed:",
          hourlyResult.reason,
        );
        setHourlyForecast([]);
        setHourlyStatus("error");
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

export default function ConditionsScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();
  const savedLocations = useSavedLocations();
  const [switchModalVisible, setSwitchModalVisible] = useState(false);

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
  const interactiveHourlyForecast = useMemo(
    () => buildInteractiveHourlyForecast(hourlyForecast),
    [hourlyForecast],
  );

  async function handleQuickSwitch(locationId: string) {
    const nextLocation = savedLocations.find(
      (location) => location.id === locationId,
    );

    if (!nextLocation) {
      setSwitchModalVisible(false);
      return;
    }

    if (selectedLocation && nextLocation.id === selectedLocation.id) {
      setSwitchModalVisible(false);
      return;
    }

    await setSelectedLocation(nextLocation);
    setSwitchModalVisible(false);
  }

  const quickSwitchModal = (
    <QuickSwitchModal
      visible={switchModalVisible}
      title="Select Saved Location"
      subtitle="Choose which saved place Conditions should show right now."
      currentLocationId={selectedLocation?.id ?? null}
      savedLocations={savedLocations}
      onClose={() => setSwitchModalVisible(false)}
      onSelectLocation={handleQuickSwitch}
      onManageLocations={() => {
        setSwitchModalVisible(false);
        router.push("/manage-locations");
      }}
    />
  );

  if (!selectedLocation) {
    return (
      <>
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
                  <Ionicons
                    name="settings-outline"
                    size={22}
                    color={Palette.primary}
                  />
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
                onPress={() => setSwitchModalVisible(true)}
                style={styles.emptyStateButton}
              >
                <Text style={styles.emptyStateButtonText}>Choose Location</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
        {quickSwitchModal}
      </>
    );
  }

  return (
    <>
      <ConditionsScreenV2
        locationName={selectedLocation.name}
        updatedLabel={viewModel.updatedLabel}
        summaryText={viewModel.summaryText}
        takeawayText={viewModel.takeawayText}
        hourlyForecast={interactiveHourlyForecast}
        hourlyStatus={hourlyStatus}
        onPressSettings={() => router.push("/settings")}
        onPressLocationSearch={() => setSwitchModalVisible(true)}
      />
      {quickSwitchModal}
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  topBar: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(221, 227, 243, 0.75)",
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 4,
    backgroundColor: Palette.background,
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
    fontSize: 19,
    lineHeight: 28,
    fontWeight: "800",
    color: Palette.textPrimary,
    letterSpacing: -0.52,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.16)",
  },
  updatedText: {
    fontSize: 13,
    lineHeight: 20,
    color: Palette.textSecondary,
    letterSpacing: -0.15,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: Palette.background,
  },
  emptyStateTitle: {
    color: Palette.textPrimary,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.55,
    textAlign: "center",
  },
  emptyStateBody: {
    color: Palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 280,
  },
  emptyStateButton: {
    minHeight: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.2)",
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    ...Shadows.soft,
  },
  emptyStateButtonText: {
    color: Palette.textOnDark,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 16,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.16)",
    borderRadius: Radius.xl,
    backgroundColor: Palette.primarySoft,
    paddingHorizontal: 18,
    paddingVertical: 18,
    ...Shadows.soft,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
    color: Palette.midnight,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.72)",
    borderRadius: 36,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    gap: 14,
    overflow: "hidden",
    ...Shadows.card,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "900",
    color: Palette.textPrimary,
    letterSpacing: -0.44,
  },
  metricTabs: {
    flexDirection: "row",
    gap: 8,
    minWidth: "100%",
  },
  metricTab: {
    minWidth: 112,
    minHeight: 38,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.16)",
    borderRadius: Radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  metricTabActive: {
    minWidth: 112,
    minHeight: 38,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.32)",
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  metricTabText: {
    color: Palette.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  metricTabActiveText: {
    color: Palette.primary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  takeawayCard: {
    backgroundColor: Palette.midnight,
    borderRadius: Radius.xl,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(72, 199, 244, 0.22)",
    ...Shadows.soft,
  },
  takeawayTitle: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "900",
    color: Palette.textOnDark,
    letterSpacing: -0.44,
  },
  takeawayText: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255, 255, 255, 0.88)",
    letterSpacing: -0.15,
  },
});
