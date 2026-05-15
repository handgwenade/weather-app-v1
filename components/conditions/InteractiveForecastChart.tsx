import { Palette, Radius } from "@/constants/theme";
import {
  formatForecastChartValue,
  getForecastYDomain,
  getNearestForecastPointIndex,
  getValidForecastChartPoints,
  type ForecastChartHour,
  type ForecastChartMetric,
  type ForecastChartUnits,
} from "@/utils/forecastChart";
import { formatTime24Hour } from "@/utils/dateTime";
import { scaleLinear } from "d3-scale";
import {
  area as d3Area,
  curveMonotoneX,
  line as d3Line,
} from "d3-shape";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

export type InteractiveForecastChartProps = {
  hourly: ForecastChartHour[];
  metric: ForecastChartMetric;
  units: ForecastChartUnits;
  isLoading?: boolean;
};

const CHART_HEIGHT = 238;
const PLOT_TOP = 56;
const PLOT_RIGHT = 18;
const PLOT_BOTTOM = 42;
const PLOT_LEFT = 18;
const TOOLTIP_HEIGHT = 30;

function getMetricColor(metric: ForecastChartMetric) {
  switch (metric) {
    case "temperature":
      return Palette.elevated;
    case "precipitationProbability":
      return Palette.cyan;
    case "windSpeed":
    default:
      return Palette.primary;
  }
}

function formatTimeLabel(value: string) {
  return formatTime24Hour(value) ?? "Time unavailable";
}

function getTimeLabels(points: ReturnType<typeof getValidForecastChartPoints>) {
  if (points.length === 0) {
    return [];
  }

  const first = points[0];
  const middle = points[Math.floor(points.length / 2)];
  const last = points[points.length - 1];

  return [first, middle, last].filter((point, index, labels) => {
    return labels.findIndex((candidate) => candidate.index === point.index) === index;
  });
}

export default function InteractiveForecastChart({
  hourly,
  metric,
  units,
  isLoading = false,
}: InteractiveForecastChartProps) {
  const [chartWidth, setChartWidth] = useState(0);
  const points = useMemo(
    () => getValidForecastChartPoints(hourly, metric),
    [hourly, metric],
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    points[0]?.index ?? null,
  );

  useEffect(() => {
    setSelectedIndex(points[0]?.index ?? null);
  }, [points]);

  const chart = useMemo(() => {
    if (chartWidth <= 0 || hourly.length === 0 || points.length === 0) {
      return null;
    }

    const color = getMetricColor(metric);
    const maxIndex = Math.max(1, hourly.length - 1);
    const xScale = scaleLinear()
      .domain([0, maxIndex])
      .range([PLOT_LEFT, chartWidth - PLOT_RIGHT])
      .clamp(true);
    const yDomain = getForecastYDomain(
      points.map((point) => point.value),
      metric,
    );
    const yScale = scaleLinear()
      .domain(yDomain)
      .range([CHART_HEIGHT - PLOT_BOTTOM, PLOT_TOP])
      .clamp(true);
    const linePath =
      d3Line<(typeof points)[number]>()
        .x((point) => xScale(point.index))
        .y((point) => yScale(point.value))
        .curve(curveMonotoneX)(points) ?? "";
    const areaPath =
      d3Area<(typeof points)[number]>()
        .x((point) => xScale(point.index))
        .y0(CHART_HEIGHT - PLOT_BOTTOM)
        .y1((point) => yScale(point.value))
        .curve(curveMonotoneX)(points) ?? "";
    const selectedPoint =
      points.find((point) => point.index === selectedIndex) ?? points[0];

    return {
      color,
      areaPath,
      linePath,
      xScale,
      yScale,
      selectedPoint,
      timeLabels: getTimeLabels(points),
    };
  }, [chartWidth, hourly.length, metric, points, selectedIndex]);

  const updateSelectionFromX = useCallback(
    (rawX: number) => {
      if (!chart) {
        return;
      }

      const clampedX = Math.max(
        PLOT_LEFT,
        Math.min(chartWidth - PLOT_RIGHT, rawX),
      );
      const rawIndex = chart.xScale.invert(clampedX);
      const nearestIndex = getNearestForecastPointIndex(rawIndex, points);

      if (nearestIndex !== null) {
        setSelectedIndex(nearestIndex);
      }
    },
    [chart, chartWidth, points],
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin((event) => {
        runOnJS(updateSelectionFromX)(event.x);
      })
      .onUpdate((event) => {
        runOnJS(updateSelectionFromX)(event.x);
      });
    const tap = Gesture.Tap().onEnd((event) => {
      runOnJS(updateSelectionFromX)(event.x);
    });

    return Gesture.Simultaneous(pan, tap);
  }, [updateSelectionFromX]);

  function handleLayout(event: LayoutChangeEvent) {
    setChartWidth(event.nativeEvent.layout.width);
  }

  if (isLoading) {
    return (
      <View style={styles.stateCard}>
        <View style={styles.skeletonHeader} />
        <View style={styles.skeletonChart}>
          <View style={[styles.skeletonLine, styles.skeletonLineTop]} />
          <View style={[styles.skeletonLine, styles.skeletonLineMid]} />
          <View style={[styles.skeletonLine, styles.skeletonLineBottom]} />
        </View>
      </View>
    );
  }

  if (hourly.length === 0 || points.length === 0) {
    return (
      <View style={styles.stateCard}>
        <Text style={styles.unavailableTitle}>Hourly forecast unavailable</Text>
        <Text style={styles.unavailableText}>
          No valid hourly values are available for this view.
        </Text>
      </View>
    );
  }

  const selectedPoint = chart?.selectedPoint ?? points[0];
  const selectedX = chart ? chart.xScale(selectedPoint.index) : PLOT_LEFT;
  const selectedY = chart ? chart.yScale(selectedPoint.value) : PLOT_TOP;
  const tooltipLabel = formatForecastChartValue({
    value: selectedPoint.value,
    metric,
    units,
  });
  const tooltipWidth = Math.max(64, Math.min(104, tooltipLabel.length * 8 + 24));
  const tooltipX = Math.max(
    6,
    Math.min(chartWidth - tooltipWidth - 6, selectedX - tooltipWidth / 2),
  );
  const tooltipY = Math.max(12, selectedY - TOOLTIP_HEIGHT - 12);
  const gradientId = `forecastGradient-${metric}`;

  return (
    <View style={styles.chartShell} onLayout={handleLayout}>
      <GestureDetector gesture={gesture}>
        <View style={styles.gestureSurface}>
          {chart && chartWidth > 0 ? (
            <Svg width="100%" height={CHART_HEIGHT}>
              <Defs>
                <LinearGradient
                  id={gradientId}
                  x1="0"
                  y1={PLOT_TOP}
                  x2="0"
                  y2={CHART_HEIGHT - PLOT_BOTTOM}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={chart.color} stopOpacity="0.28" />
                  <Stop offset="1" stopColor={chart.color} stopOpacity="0.02" />
                </LinearGradient>
              </Defs>

              <Line
                x1={PLOT_LEFT}
                y1={CHART_HEIGHT - PLOT_BOTTOM}
                x2={chartWidth - PLOT_RIGHT}
                y2={CHART_HEIGHT - PLOT_BOTTOM}
                stroke="rgba(101, 112, 138, 0.16)"
                strokeWidth="1"
              />
              <Line
                x1={PLOT_LEFT}
                y1={(PLOT_TOP + CHART_HEIGHT - PLOT_BOTTOM) / 2}
                x2={chartWidth - PLOT_RIGHT}
                y2={(PLOT_TOP + CHART_HEIGHT - PLOT_BOTTOM) / 2}
                stroke="rgba(101, 112, 138, 0.1)"
                strokeDasharray="6 8"
                strokeWidth="1"
              />
              <Path d={chart.areaPath} fill={`url(#${gradientId})`} />
              <Path
                d={chart.linePath}
                fill="none"
                stroke={chart.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
              />
              <Line
                x1={selectedX}
                y1={PLOT_TOP - 8}
                x2={selectedX}
                y2={CHART_HEIGHT - PLOT_BOTTOM}
                stroke="rgba(16, 20, 46, 0.13)"
                strokeDasharray="5 7"
                strokeWidth="1.5"
              />
              <Circle
                cx={selectedX}
                cy={selectedY}
                r="8"
                fill={chart.color}
                stroke={Palette.surface}
                strokeWidth="3"
              />
              <G>
                <Rect
                  x={tooltipX}
                  y={tooltipY}
                  width={tooltipWidth}
                  height={TOOLTIP_HEIGHT}
                  rx={Radius.sm}
                  fill={Palette.midnight}
                />
                <SvgText
                  x={tooltipX + tooltipWidth / 2}
                  y={tooltipY + 20}
                  textAnchor="middle"
                  fill={Palette.textOnDark}
                  fontSize="13"
                  fontWeight="900"
                >
                  {tooltipLabel}
                </SvgText>
              </G>
            </Svg>
          ) : (
            <View style={{ height: CHART_HEIGHT }} />
          )}
        </View>
      </GestureDetector>

      <View style={styles.axisLabels}>
        {chart?.timeLabels.map((point) => (
          <Text key={point.index} style={styles.axisText}>
            {formatTimeLabel(point.time)}
          </Text>
        ))}
      </View>

      <Text style={styles.selectedTime}>
        Selected {formatTimeLabel(selectedPoint.time)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chartShell: {
    marginTop: 12,
  },
  gestureSurface: {
    minHeight: CHART_HEIGHT,
  },
  axisLabels: {
    minHeight: 18,
    marginTop: -26,
    paddingHorizontal: PLOT_LEFT,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  axisText: {
    color: Palette.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
  },
  selectedTime: {
    color: Palette.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
    marginTop: 8,
    textAlign: "center",
  },
  stateCard: {
    minHeight: 224,
    borderRadius: Radius.lg,
    backgroundColor: Palette.backgroundCool,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.82)",
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: "center",
  },
  skeletonHeader: {
    width: 112,
    height: 18,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(199, 208, 230, 0.45)",
    marginBottom: 24,
  },
  skeletonChart: {
    height: 142,
    justifyContent: "space-between",
  },
  skeletonLine: {
    height: 18,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(199, 208, 230, 0.36)",
  },
  skeletonLineTop: {
    width: "74%",
    marginLeft: "8%",
  },
  skeletonLineMid: {
    width: "92%",
  },
  skeletonLineBottom: {
    width: "58%",
    marginLeft: "28%",
  },
  unavailableTitle: {
    color: Palette.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  unavailableText: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },
});
