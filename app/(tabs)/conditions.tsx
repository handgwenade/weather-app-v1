import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSelectedLocation } from "@/data/locationStore";
import { getSharedCurrentWeather } from "@/data/weatherStore";
import {
  celsiusToFahrenheit,
  metersPerSecondToMph,
} from "@/utils/weather";

type RangeOption = "12H" | "24H" | "48H" | "72H";

type ChartSeries = {
  color: string;
  values: number[];
};

type ConditionsPreset = {
  summary: string;
  takeaway: string;
  windDirection: string;
  precipType: string;
  temperatureAir: number[];
  temperatureRoad: number[];
  wind: number[];
  precipitation: number[];
};

type WeatherSnapshot = {
  currentTempF: number | null;
  currentWindMph: number | null;
  currentPrecipProbability: number | null;
  conditionLabel: string;
};

type ConditionsSnapshot = WeatherSnapshot & {
  fetchedWindDirection: string | null;
  sourceUpdatedLabel: string | null;
  fallbackRefreshLabel: string | null;
};

type ConditionsViewModel = {
  updatedLabel: string;
  summaryText: string;
  takeawayText: string;
  windDirectionFooter: string;
};

const RANGE_OPTIONS: RangeOption[] = ["12H", "24H", "48H", "72H"];
const X_AXIS_LABELS = ["6AM", "9AM", "12PM", "3PM", "6PM", "9PM", "12AM", "3AM"];
const BASE_RANGE_PRESETS: Record<RangeOption, ConditionsPreset> = {
  "12H": {
    summary: "Calm and mostly dry conditions hold through today",
    takeaway: "No maintenance action needed. Conditions remain stable.",
    windDirection: "W",
    precipType: "None expected",
    temperatureAir: [36, 39, 43, 47, 45, 41, 38, 36],
    temperatureRoad: [35, 38, 42, 46, 44, 40, 37, 35],
    wind: [6, 8, 10, 11, 10, 8, 6, 5],
    precipitation: [4, 6, 8, 10, 8, 6, 4, 3],
  },
  "24H": {
    summary: "Clear and dry conditions continue through tomorrow",
    takeaway: "No maintenance action needed. Temps stay above freezing.",
    windDirection: "WNW",
    precipType: "Light snow",
    temperatureAir: [38, 41, 49, 53, 46, 40, 36, 34],
    temperatureRoad: [39, 42, 50, 54, 47, 41, 37, 35],
    wind: [8, 10, 12, 14, 12, 10, 8, 6],
    precipitation: [10, 14, 18, 30, 40, 24, 14, 9],
  },
  "48H": {
    summary: "Cooling conditions build with a light snow window tomorrow night",
    takeaway: "Monitoring recommended. Cold pavement may need attention later.",
    windDirection: "NW",
    precipType: "Light snow",
    temperatureAir: [35, 38, 43, 47, 39, 34, 31, 29],
    temperatureRoad: [36, 39, 44, 48, 41, 35, 32, 30],
    wind: [10, 12, 15, 17, 16, 13, 11, 9],
    precipitation: [8, 12, 18, 26, 34, 28, 18, 12],
  },
  "72H": {
    summary: "An unsettled stretch remains possible with colder overnight temperatures",
    takeaway: "Keep crews on standby. Conditions may change more quickly overnight.",
    windDirection: "NNW",
    precipType: "Mixed precip",
    temperatureAir: [34, 36, 40, 43, 37, 32, 28, 26],
    temperatureRoad: [35, 37, 41, 44, 38, 33, 29, 27],
    wind: [11, 13, 16, 18, 16, 14, 12, 10],
    precipitation: [12, 16, 22, 28, 32, 30, 22, 16],
  },
};

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
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % directions.length;
  return directions[index];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function shiftSeries(values: number[], delta: number, min?: number) {
  return values.map((value) => {
    const shifted = Math.round((value + delta) * 10) / 10;
    return min === undefined ? shifted : Math.max(min, shifted);
  });
}

function buildConditionsPreset(
  range: RangeOption,
  snapshot: WeatherSnapshot,
): ConditionsPreset {
  const base = BASE_RANGE_PRESETS[range];
  const summaryLower = snapshot.conditionLabel.toLowerCase();
  const tempDelta =
    snapshot.currentTempF === null
      ? 0
      : clamp(snapshot.currentTempF - base.temperatureAir[0], -8, 8);
  const windDelta =
    snapshot.currentWindMph === null
      ? 0
      : clamp(snapshot.currentWindMph - base.wind[0], -5, 5);
  const precipDelta =
    snapshot.currentPrecipProbability === null
      ? 0
      : clamp(snapshot.currentPrecipProbability - base.precipitation[0], -10, 10);

  const adjustedSummary = (() => {
    if (summaryLower.includes("snow")) {
      return "Light snow remains the main watch item through tomorrow";
    }

    if (summaryLower.includes("rain") || summaryLower.includes("drizzle")) {
      return "Wet conditions remain possible through tomorrow";
    }

    if ((snapshot.currentWindMph ?? 0) >= 25) {
      return "Windier conditions continue through tomorrow";
    }

    if ((snapshot.currentTempF ?? 99) <= 32) {
      return "Cold conditions may trend near freezing overnight";
    }

    return base.summary;
  })();

  const adjustedTakeaway = (() => {
    if ((snapshot.currentTempF ?? 99) <= 32) {
      return "Monitoring recommended. Temps may slip near freezing.";
    }

    if (summaryLower.includes("snow") || summaryLower.includes("rain")) {
      return "Monitoring recommended. Crews should stay weather-aware.";
    }

    if ((snapshot.currentWindMph ?? 0) >= 25) {
      return "No immediate action needed. Wind remains the main watch item.";
    }

    return base.takeaway;
  })();

  const precipType =
    summaryLower.includes("snow")
      ? snapshot.conditionLabel
      : summaryLower.includes("rain") || summaryLower.includes("drizzle")
        ? snapshot.conditionLabel
        : base.precipType;

  return {
    summary: adjustedSummary,
    takeaway: adjustedTakeaway,
    windDirection: base.windDirection,
    precipType,
    temperatureAir: shiftSeries(base.temperatureAir, tempDelta),
    temperatureRoad: shiftSeries(base.temperatureRoad, tempDelta + 1),
    wind: shiftSeries(base.wind, windDelta, 0),
    precipitation: shiftSeries(base.precipitation, precipDelta, 0),
  };
}

function buildConditionsViewModel(
  range: RangeOption,
  snapshot: ConditionsSnapshot,
): ConditionsViewModel {
  const preset = buildConditionsPreset(range, snapshot);
  const updatedLabel = snapshot.sourceUpdatedLabel
    ? `Updated ${snapshot.sourceUpdatedLabel}`
    : snapshot.fallbackRefreshLabel
      ? `Last refresh ${snapshot.fallbackRefreshLabel}`
      : "Update time unavailable";

  const summaryParts: string[] = [];

  if (
    snapshot.conditionLabel !== "Current conditions" &&
    snapshot.conditionLabel !== "Weather unavailable"
  ) {
    summaryParts.push(`${snapshot.conditionLabel} now`);
  }

  if (snapshot.currentTempF !== null) {
    summaryParts.push(`${Math.round(snapshot.currentTempF)}°F`);
  }

  if (snapshot.currentWindMph !== null) {
    summaryParts.push(`wind ${Math.round(snapshot.currentWindMph)} mph`);
  }

  if (snapshot.currentPrecipProbability !== null) {
    summaryParts.push(`precip prob ${Math.round(snapshot.currentPrecipProbability)}%`);
  }

  const summaryText =
    summaryParts.length > 0
      ? summaryParts.join(", ")
      : "Current weather details are limited right now";

  const takeawayText = (() => {
    if (snapshot.currentTempF !== null && snapshot.currentTempF <= 32) {
      return `Current temperature is ${Math.round(snapshot.currentTempF)}°F. Monitor temperature-sensitive work.`;
    }

    if (
      snapshot.currentPrecipProbability !== null &&
      snapshot.currentPrecipProbability >= 50
    ) {
      return `Precipitation probability is ${Math.round(snapshot.currentPrecipProbability)}%. Keep weather-sensitive work under watch.`;
    }

    if (
      snapshot.conditionLabel.toLowerCase().includes("snow") ||
      snapshot.conditionLabel.toLowerCase().includes("rain") ||
      snapshot.conditionLabel.toLowerCase().includes("drizzle")
    ) {
      return `${snapshot.conditionLabel} is the main weather signal right now. Continue monitoring current conditions.`;
    }

    if (snapshot.currentWindMph !== null && snapshot.currentWindMph >= 25) {
      return `Wind is running ${Math.round(snapshot.currentWindMph)} mph. Wind is the main watch item right now.`;
    }

    if (
      snapshot.currentTempF !== null ||
      snapshot.currentWindMph !== null ||
      snapshot.currentPrecipProbability !== null
    ) {
      return "No immediate weather-driven action is indicated by current conditions.";
    }

    return preset.takeaway;
  })();

  return {
    updatedLabel,
    summaryText,
    takeawayText,
    windDirectionFooter: snapshot.fetchedWindDirection
      ? `Direction: ${snapshot.fetchedWindDirection}`
      : "Direction unavailable",
  };
}

function LegendItem({
  color,
  dashed = false,
  label,
}: {
  color: string;
  dashed?: boolean;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          dashed
            ? {
                backgroundColor: "transparent",
                borderColor: color,
                borderStyle: "dashed",
                borderTopWidth: 2,
                height: 0,
              }
            : { backgroundColor: color },
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function ChartCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <View style={styles.chartCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
      {footer ? <View style={styles.cardFooter}>{footer}</View> : null}
    </View>
  );
}

function ConditionsLineChart({
  height,
  yTicks,
  series,
  thresholdValue,
  thresholdColor,
}: {
  height: number;
  yTicks: number[];
  series: ChartSeries[];
  thresholdValue?: number;
  thresholdColor?: string;
}) {
  const { width } = useWindowDimensions();
  const axisWidth = 34;
  const axisHeight = 28;
  const plotWidth = Math.max(width - 108, 228);
  const minY = yTicks[0];
  const maxY = yTicks[yTicks.length - 1];
  const totalHeight = height + axisHeight;

  function getPoint(index: number, value: number) {
    const x = axisWidth + (plotWidth * index) / (X_AXIS_LABELS.length - 1);
    const ratio = (value - minY) / (maxY - minY || 1);
    const y = height - ratio * height;

    return { x, y };
  }

  return (
    <View style={[styles.chartSurface, { width: axisWidth + plotWidth, height: totalHeight }]}>
      <View style={[styles.plotArea, { left: axisWidth, width: plotWidth, height }]}>
        {yTicks.map((tick) => {
          const point = getPoint(0, tick);

          return (
            <View
              key={`horizontal-${tick}`}
              style={[
                styles.horizontalGridLine,
                { top: point.y, width: plotWidth },
              ]}
            />
          );
        })}
        {X_AXIS_LABELS.map((label, index) => {
          const point = getPoint(index, minY);

          return (
            <View
              key={`vertical-${label}`}
              style={[
                styles.verticalGridLine,
                { left: point.x - axisWidth, height },
              ]}
            />
          );
        })}
        {thresholdValue !== undefined ? (
          <View
            style={[
              styles.thresholdLine,
              {
                top: getPoint(0, thresholdValue).y,
                width: plotWidth,
                borderColor: thresholdColor ?? "#3B82F6",
              },
            ]}
          />
        ) : null}
        {series.map((seriesItem) =>
          seriesItem.values.map((value, index) => {
            if (index === seriesItem.values.length - 1) {
              return null;
            }

            const start = getPoint(index, value);
            const end = getPoint(index + 1, seriesItem.values[index + 1]);
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;

            return (
              <View
                key={`${seriesItem.color}-${index}`}
                style={[
                  styles.seriesSegment,
                  {
                    backgroundColor: seriesItem.color,
                    left: midX - axisWidth - length / 2,
                    top: midY - 1,
                    width: length,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          }),
        )}
        {series.map((seriesItem) =>
          seriesItem.values.map((value, index) => {
            const point = getPoint(index, value);

            return (
              <View
                key={`${seriesItem.color}-point-${index}`}
                style={[
                  styles.seriesPoint,
                  {
                    borderColor: seriesItem.color,
                    left: point.x - axisWidth - 3,
                    top: point.y - 3,
                  },
                ]}
              />
            );
          }),
        )}
      </View>
      {yTicks.map((tick) => {
        const point = getPoint(0, tick);

        return (
          <Text
            key={`y-label-${tick}`}
            style={[styles.yAxisLabel, { top: point.y - 8 }]}
          >
            {tick}
          </Text>
        );
      })}
      {X_AXIS_LABELS.map((label, index) => {
        const point = getPoint(index, minY);

        return (
          <Text
            key={`x-label-${label}`}
            style={[
              styles.xAxisLabel,
              {
                left: point.x - axisWidth - 18,
                top: height + 8,
              },
            ]}
          >
            {label}
          </Text>
        );
      })}
    </View>
  );
}

export default function ConditionsScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();

  const [selectedRange, setSelectedRange] = useState<RangeOption>("24H");
  const [conditionLabel, setConditionLabel] = useState("Clear");
  const [currentTempF, setCurrentTempF] = useState<number | null>(null);
  const [currentWindMph, setCurrentWindMph] = useState<number | null>(null);
  const [currentWindDirection, setCurrentWindDirection] = useState<string | null>(null);
  const [currentPrecipProbability, setCurrentPrecipProbability] = useState<number | null>(null);
  const [sourceUpdatedLabel, setSourceUpdatedLabel] = useState<string | null>(null);
  const [fallbackRefreshLabel, setFallbackRefreshLabel] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentWeather() {
      const fallbackLabel = formatClockLabel(new Date());

      try {
        const result = await getSharedCurrentWeather(selectedLocation);

        if (!isActive) {
          return;
        }

        const values = result.data.values;

        if (typeof values.temperature === "number") {
          setCurrentTempF(celsiusToFahrenheit(values.temperature));
        }

        if (typeof values.windSpeed === "number") {
          setCurrentWindMph(metersPerSecondToMph(values.windSpeed));
        }

        if (typeof values.precipitationProbability === "number") {
          setCurrentPrecipProbability(Math.round(values.precipitationProbability));
        }

        if (typeof values.weatherCode === "number") {
          setConditionLabel(getConditionLabel(values.weatherCode));
        }

        if (typeof values.windDirection === "number") {
          setCurrentWindDirection(degreesToCompass(values.windDirection));
        } else {
          setCurrentWindDirection(null);
        }

        setSourceUpdatedLabel(
          typeof result.data.time === "string"
            ? formatClockLabel(result.data.time)
            : null,
        );
        setFallbackRefreshLabel(fallbackLabel);
      } catch (error) {
        console.log("Conditions screen weather fetch failed:", error);
        if (!isActive) {
          return;
        }

        setSourceUpdatedLabel(null);
        setFallbackRefreshLabel(fallbackLabel);
      }
    }

    void loadCurrentWeather();

    return () => {
      isActive = false;
    };
  }, [selectedLocation]);

  const preset = useMemo(
    () =>
      buildConditionsPreset(selectedRange, {
        currentTempF,
        currentWindMph,
        currentPrecipProbability,
        conditionLabel,
      }),
    [selectedRange, currentTempF, currentWindMph, currentPrecipProbability, conditionLabel],
  );
  const viewModel = useMemo(
    () =>
      buildConditionsViewModel(selectedRange, {
        currentTempF,
        currentWindMph,
        currentPrecipProbability,
        conditionLabel,
        fetchedWindDirection: currentWindDirection,
        sourceUpdatedLabel,
        fallbackRefreshLabel,
      }),
    [
      selectedRange,
      currentTempF,
      currentWindMph,
      currentPrecipProbability,
      conditionLabel,
      currentWindDirection,
      sourceUpdatedLabel,
      fallbackRefreshLabel,
    ],
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/manage-locations")}
              style={styles.locationButton}
            >
              <Text style={styles.locationTitle}>{selectedLocation.name}</Text>
              <Ionicons name="chevron-down" size={18} color="#0F172B" />
            </Pressable>
            <Pressable
              accessibilityLabel="Open settings"
              accessibilityRole="button"
              onPress={() => router.push("/settings")}
              style={styles.iconButton}
            >
              <Ionicons name="settings-outline" size={22} color="#475569" />
            </Pressable>
          </View>
          <Text style={styles.updatedText}>{viewModel.updatedLabel}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.segmentedControl}>
            {RANGE_OPTIONS.map((option) => {
              const isSelected = option === selectedRange;

              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  onPress={() => setSelectedRange(option)}
                  style={[
                    styles.segmentButton,
                    isSelected ? styles.segmentButtonSelected : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentLabel,
                      isSelected ? styles.segmentLabelSelected : null,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{viewModel.summaryText}</Text>
          </View>

          <ChartCard
            title="Temperature"
            footer={
              <View style={styles.legendRow}>
                <LegendItem color="#24324A" label="Air Temp" />
                <LegendItem color="#64748B" label="Road Temp" />
                <LegendItem color="#3B82F6" dashed label="Freezing (32°F)" />
              </View>
            }
          >
            <ConditionsLineChart
              height={120}
              yTicks={[0, 15, 30, 45, 60]}
              series={[
                { color: "#24324A", values: preset.temperatureAir },
                { color: "#64748B", values: preset.temperatureRoad },
              ]}
              thresholdColor="#3B82F6"
              thresholdValue={32}
            />
          </ChartCard>

          <ChartCard
            title="Wind"
            footer={<Text style={styles.footerLabel}>{viewModel.windDirectionFooter}</Text>}
          >
            <ConditionsLineChart
              height={100}
              yTicks={[0, 5, 10, 15, 20]}
              series={[{ color: "#F59E0B", values: preset.wind }]}
            />
          </ChartCard>

          <ChartCard
            title="Precipitation Probability"
            footer={<Text style={styles.footerLabel}>Type: {preset.precipType}</Text>}
          >
            <ConditionsLineChart
              height={100}
              yTicks={[0, 10, 20, 30, 40]}
              series={[{ color: "#3B82F6", values: preset.precipitation }]}
            />
          </ChartCard>

          <View style={styles.takeawayCard}>
            <Text style={styles.takeawayTitle}>Operational Takeaway</Text>
            <Text style={styles.takeawayText}>{viewModel.takeawayText}</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 4,
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    height: 36,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonSelected: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: "#45556C",
    letterSpacing: -0.15,
  },
  segmentLabelSelected: {
    color: "#0F172B",
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
  chartCard: {
    borderWidth: 1,
    borderColor: "#CAD5E2",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "700",
    color: "#0F172B",
    letterSpacing: -0.44,
    marginBottom: 12,
  },
  chartSurface: {
    position: "relative",
    alignSelf: "center",
  },
  plotArea: {
    position: "absolute",
    top: 0,
  },
  horizontalGridLine: {
    position: "absolute",
    left: 0,
    borderTopWidth: 1,
    borderColor: "#D7E3F0",
    borderStyle: "dotted",
  },
  verticalGridLine: {
    position: "absolute",
    top: 0,
    borderLeftWidth: 1,
    borderColor: "#D7E3F0",
    borderStyle: "dotted",
  },
  thresholdLine: {
    position: "absolute",
    left: 0,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
  },
  seriesSegment: {
    position: "absolute",
    height: 2,
    borderRadius: 999,
  },
  seriesPoint: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
  },
  yAxisLabel: {
    position: "absolute",
    left: 0,
    width: 26,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 16,
    color: "#64748B",
  },
  xAxisLabel: {
    position: "absolute",
    width: 36,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    color: "#64748B",
  },
  cardFooter: {
    marginTop: 10,
  },
  footerLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: "#45556C",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendSwatch: {
    width: 14,
    height: 2,
    borderRadius: 999,
  },
  legendLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: "#45556C",
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
