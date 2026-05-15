import { Palette, Radius } from "@/constants/theme";
import { formatTime24Hour } from "@/utils/dateTime";
import {
  formatRoadConditionValue,
  getNearestRoadConditionPointIndex,
  getRoadConditionLineSegments,
  getRoadConditionYDomain,
  getValidRoadConditionPoints,
  isRoadConditionSegmentObserved,
  type RoadConditionChartMetric,
  type RoadConditionChartPoint,
  type RoadConditionChartUnits,
} from "@/utils/roadConditionChart";
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

type InteractiveRoadConditionChartProps = {
  points: RoadConditionChartPoint[];
  metric: RoadConditionChartMetric;
  units: RoadConditionChartUnits;
  isLoading?: boolean;
};

const CHART_HEIGHT = 166;
const PLOT_TOP = 34;
const PLOT_RIGHT = 14;
const PLOT_BOTTOM = 36;
const PLOT_LEFT = 14;
const TOOLTIP_HEIGHT = 28;

function getMetricColor(metric: RoadConditionChartMetric) {
  switch (metric) {
    case "precipitationProbability":
      return Palette.primary;
    case "roadTemp":
      return Palette.elevated;
    case "airTemp":
      return Palette.cyan;
    case "windSpeed":
    default:
      return Palette.primary;
  }
}

function formatTimeLabel(value: string) {
  return formatTime24Hour(value) ?? "Time unavailable";
}

export default function InteractiveRoadConditionChart({
  points,
  metric,
  units,
  isLoading = false,
}: InteractiveRoadConditionChartProps) {
  const [chartWidth, setChartWidth] = useState(0);
  const validPoints = useMemo(
    () => getValidRoadConditionPoints(points, metric),
    [metric, points],
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    validPoints[0]?.index ?? null,
  );

  useEffect(() => {
    setSelectedIndex(validPoints[0]?.index ?? null);
  }, [validPoints]);

  const chart = useMemo(() => {
    if (chartWidth <= 0 || points.length === 0 || validPoints.length === 0) {
      return null;
    }

    const color = getMetricColor(metric);
    const maxIndex = Math.max(1, points.length - 1);
    const xScale = scaleLinear()
      .domain([0, maxIndex])
      .range([PLOT_LEFT, chartWidth - PLOT_RIGHT])
      .clamp(true);
    const yScale = scaleLinear()
      .domain(
        getRoadConditionYDomain(
          validPoints.map((point) => point.value),
          metric,
        ),
      )
      .range([CHART_HEIGHT - PLOT_BOTTOM, PLOT_TOP])
      .clamp(true);
    const selectedPoint =
      validPoints.find((point) => point.index === selectedIndex) ??
      validPoints[0];
    const segments = getRoadConditionLineSegments(validPoints).map(
      (segment, index) => {
        const linePath =
          segment.length > 1
            ? d3Line<(typeof segment)[number]>()
                .x((point) => xScale(point.index))
                .y((point) => yScale(point.value))
                .curve(curveMonotoneX)(segment) ?? ""
            : "";
        const areaPath =
          segment.length > 1
            ? d3Area<(typeof segment)[number]>()
                .x((point) => xScale(point.index))
                .y0(CHART_HEIGHT - PLOT_BOTTOM)
                .y1((point) => yScale(point.value))
                .curve(curveMonotoneX)(segment) ?? ""
            : "";

        return {
          id: `${segment[0]?.index ?? 0}-${index}`,
          points: segment,
          linePath,
          areaPath,
          isObserved: isRoadConditionSegmentObserved(segment),
        };
      },
    );

    return {
      color,
      xScale,
      yScale,
      selectedPoint,
      segments,
    };
  }, [chartWidth, metric, points.length, selectedIndex, validPoints]);

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
      const nearestIndex = getNearestRoadConditionPointIndex(
        rawIndex,
        validPoints,
      );

      if (nearestIndex !== null) {
        setSelectedIndex(nearestIndex);
      }
    },
    [chart, chartWidth, validPoints],
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
      <View style={styles.stateBox}>
        <View style={styles.skeletonLineWide} />
        <View style={styles.skeletonLineMid} />
        <View style={styles.skeletonLineShort} />
      </View>
    );
  }

  if (points.length === 0 || validPoints.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.unavailableTitle}>Data unavailable</Text>
        <Text style={styles.unavailableText}>
          No available points for this road condition.
        </Text>
      </View>
    );
  }

  const selectedPoint = chart?.selectedPoint ?? validPoints[0];
  const selectedX = chart ? chart.xScale(selectedPoint.index) : PLOT_LEFT;
  const selectedY = chart ? chart.yScale(selectedPoint.value) : PLOT_TOP;
  const label = formatRoadConditionValue({
    value: selectedPoint.value,
    metric,
    units,
  });
  const labelWidth = Math.max(58, Math.min(96, label.length * 8 + 22));
  const labelX = Math.max(
    6,
    Math.min(chartWidth - labelWidth - 6, selectedX - labelWidth / 2),
  );
  const labelY = Math.max(4, selectedY - TOOLTIP_HEIGHT - 10);
  const gradientId = `roadConditionGradient-${metric}`;
  const hasMixedConfidence =
    validPoints.some((point) => point.confidence === "observed") &&
    validPoints.some((point) => point.confidence !== "observed");

  return (
    <View style={styles.chartWrap} onLayout={handleLayout}>
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
                  <Stop offset="0" stopColor={chart.color} stopOpacity="0.22" />
                  <Stop offset="1" stopColor={chart.color} stopOpacity="0.02" />
                </LinearGradient>
              </Defs>

              <Line
                x1={PLOT_LEFT}
                y1={CHART_HEIGHT - PLOT_BOTTOM}
                x2={chartWidth - PLOT_RIGHT}
                y2={CHART_HEIGHT - PLOT_BOTTOM}
                stroke="rgba(105, 106, 112, 0.14)"
                strokeWidth="1.5"
              />
              <Line
                x1={PLOT_LEFT}
                y1={(PLOT_TOP + CHART_HEIGHT - PLOT_BOTTOM) / 2}
                x2={chartWidth - PLOT_RIGHT}
                y2={(PLOT_TOP + CHART_HEIGHT - PLOT_BOTTOM) / 2}
                stroke="rgba(105, 106, 112, 0.11)"
                strokeDasharray="6 8"
                strokeWidth="1.5"
              />

              {chart.segments.map((segment) =>
                segment.areaPath ? (
                  <Path
                    key={`${segment.id}-area`}
                    d={segment.areaPath}
                    fill={`url(#${gradientId})`}
                  />
                ) : null,
              )}
              {chart.segments.map((segment) =>
                segment.linePath ? (
                  <Path
                    key={`${segment.id}-line`}
                    d={segment.linePath}
                    fill="none"
                    stroke={chart.color}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={segment.isObserved ? undefined : "7 7"}
                  />
                ) : null,
              )}
              {validPoints.map((point) => (
                <Circle
                  key={point.index}
                  cx={chart.xScale(point.index)}
                  cy={chart.yScale(point.value)}
                  r="3"
                  fill={
                    point.confidence === "observed"
                      ? chart.color
                      : "rgba(105, 106, 112, 0.42)"
                  }
                />
              ))}
              <Line
                x1={selectedX}
                y1={PLOT_TOP - 10}
                x2={selectedX}
                y2={CHART_HEIGHT - PLOT_BOTTOM}
                stroke="rgba(105, 106, 112, 0.2)"
                strokeDasharray="5 7"
                strokeWidth="1.5"
              />
              <Circle
                cx={selectedX}
                cy={selectedY}
                r="8"
                fill={chart.color}
                stroke="rgba(255, 255, 255, 0.94)"
                strokeWidth="3"
              />
              <G>
                <Rect
                  x={labelX}
                  y={labelY}
                  width={labelWidth}
                  height={TOOLTIP_HEIGHT}
                  rx={Radius.sm}
                  fill={Palette.midnight}
                />
                <SvgText
                  x={labelX + labelWidth / 2}
                  y={labelY + 19}
                  textAnchor="middle"
                  fill={Palette.textOnDark}
                  fontSize="13"
                  fontWeight="900"
                >
                  {label}
                </SvgText>
              </G>
            </Svg>
          ) : (
            <View style={{ height: CHART_HEIGHT }} />
          )}
        </View>
      </GestureDetector>

      <Text style={styles.selectedTime}>
        Selected {formatTimeLabel(selectedPoint.time)}
      </Text>
      {hasMixedConfidence ? (
        <Text style={styles.confidenceLegend}>
          Solid observed / Dashed forecast or estimated
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: {
    minHeight: CHART_HEIGHT + 38,
  },
  gestureSurface: {
    minHeight: CHART_HEIGHT,
  },
  selectedTime: {
    color: Palette.textPrimary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
    textAlign: "center",
    marginTop: -18,
  },
  confidenceLegend: {
    color: Palette.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 3,
  },
  stateBox: {
    minHeight: CHART_HEIGHT + 20,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(245, 248, 255, 0.74)",
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.72)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  skeletonLineWide: {
    height: 16,
    width: "86%",
    borderRadius: Radius.pill,
    backgroundColor: "rgba(199, 208, 230, 0.36)",
    marginBottom: 18,
  },
  skeletonLineMid: {
    height: 16,
    width: "64%",
    borderRadius: Radius.pill,
    backgroundColor: "rgba(199, 208, 230, 0.42)",
    marginLeft: "18%",
    marginBottom: 18,
  },
  skeletonLineShort: {
    height: 16,
    width: "48%",
    borderRadius: Radius.pill,
    backgroundColor: "rgba(199, 208, 230, 0.3)",
    marginLeft: "42%",
  },
  unavailableTitle: {
    color: Palette.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  unavailableText: {
    color: Palette.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },
});
