import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

type RoadSegmentListItem = {
  segmentId: string;
  routeName: string;
  fromLabel: string;
  toLabel: string;
  notes?: string | null;
  impactLevel?: string | null;
  impactReason?: string | null;
};

type RoadSegmentDetail = {
  segment: RoadSegmentListItem;
  primaryStation: {
    observedAt: string | null;
    roadSurfaceTempF: number | null;
    roadStateCode: number | null;
    roadStateLabel: string | null;
    windSpeedMph: number | null;
    windGustMph: number | null;
  } | null;
  impact?: {
    level: string;
    reason: string;
  } | null;
};

const ROAD_API_BASE_URL = "http://localhost:3000";

type SegmentFilterMode = "all" | "wind-prone" | "high-impact";
type SegmentSortMode = "highest-impact" | "route-order";

function formatRoundedValue(
  value: number | null | undefined,
  unit: string,
): string {
  return value === null || value === undefined
    ? "Unavailable"
    : `${Math.round(value)}${unit}`;
}

function formatObservedAt(value: string | null | undefined): string {
  if (!value) {
    return "Unavailable";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatImpactLevel(level: string | null | undefined): string {
  switch (level) {
    case "high":
      return "High";
    case "moderate":
      return "Moderate";
    case "low":
      return "Low";
    default:
      return level ?? "Unavailable";
  }
}

function formatFilterMode(mode: SegmentFilterMode): string {
  switch (mode) {
    case "wind-prone":
      return "Wind-prone";
    case "high-impact":
      return "High impact";
    default:
      return "All";
  }
}

function formatSortMode(mode: SegmentSortMode): string {
  switch (mode) {
    case "route-order":
      return "Route order";
    default:
      return "Highest impact";
  }
}

function getImpactSeverityOrder(level: string | null | undefined): number {
  switch (level) {
    case "high":
      return 0;
    case "moderate":
      return 1;
    case "low":
      return 2;
    default:
      return 3;
  }
}

export default function RoadSegmentsPrototype() {
  const [segments, setSegments] = useState<RoadSegmentListItem[]>([]);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<SegmentFilterMode>("all");
  const [sortMode, setSortMode] = useState<SegmentSortMode>("highest-impact");
  const [selectedSegment, setSelectedSegment] = useState<RoadSegmentDetail | null>(
    null,
  );
  const [selectedSegmentLoadingId, setSelectedSegmentLoadingId] = useState<
    string | null
  >(null);
  const [selectedSegmentError, setSelectedSegmentError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let isActive = true;

    async function loadSegments() {
      try {
        const response = await fetch(`${ROAD_API_BASE_URL}/api/road/segments`);
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }

        const data = (await response.json()) as RoadSegmentListItem[];
        if (!isActive) {
          return;
        }

        setSegments(data);
        setSegmentsError(null);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setSegments([]);
        setSegmentsError(
          error instanceof Error ? error.message : "Unable to load segments",
        );
      }
    }

    void loadSegments();

    return () => {
      isActive = false;
    };
  }, []);

  async function handlePressSegment(segmentId: string) {
    setSelectedSegmentLoadingId(segmentId);
    setSelectedSegmentError(null);

    try {
      const response = await fetch(
        `${ROAD_API_BASE_URL}/api/road/segment/${segmentId}`,
      );
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const data = (await response.json()) as RoadSegmentDetail;
      setSelectedSegment(data);
    } catch (error) {
      setSelectedSegment(null);
      setSelectedSegmentError(
        error instanceof Error
          ? error.message
          : "Unable to load selected segment",
      );
    } finally {
      setSelectedSegmentLoadingId(null);
    }
  }

  const allCount = segments.length;
  const windProneCount = segments.filter((segment) =>
    /wind/i.test(segment.notes ?? ""),
  ).length;
  const highImpactCount = segments.filter(
    (segment) => segment.impactLevel === "high",
  ).length;

  const visibleSegments = segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => {
      if (filterMode === "all") {
        return true;
      }

      if (filterMode === "wind-prone") {
        return /wind/i.test(segment.notes ?? "");
      }

      return segment.impactLevel === "high";
    })
    .sort((a, b) => {
      if (sortMode === "route-order") {
        const routeDelta = a.segment.routeName.localeCompare(b.segment.routeName);
        if (routeDelta !== 0) {
          return routeDelta;
        }

        const fromDelta = a.segment.fromLabel.localeCompare(b.segment.fromLabel);
        if (fromDelta !== 0) {
          return fromDelta;
        }

        const toDelta = a.segment.toLabel.localeCompare(b.segment.toLabel);
        if (toDelta !== 0) {
          return toDelta;
        }

        return a.index - b.index;
      }

      const severityDelta =
        getImpactSeverityOrder(a.segment.impactLevel) -
        getImpactSeverityOrder(b.segment.impactLevel);

      if (severityDelta !== 0) {
        return severityDelta;
      }

      return a.index - b.index;
    })
    .map(({ segment }) => segment);

  return (
    <View>
      <Text>Road Segments</Text>
      <Text>
        Showing {visibleSegments.length} of {segments.length} segments
      </Text>
      <View>
        <Text>Filter</Text>
        <Pressable onPress={() => setFilterMode("all")}>
          <Text>
            {filterMode === "all"
              ? `Selected: All (${allCount})`
              : `All (${allCount})`}
          </Text>
        </Pressable>
        <Pressable onPress={() => setFilterMode("wind-prone")}>
          <Text>
            {filterMode === "wind-prone"
              ? `Selected: Wind-prone (${windProneCount})`
              : `Wind-prone (${windProneCount})`}
          </Text>
        </Pressable>
        <Pressable onPress={() => setFilterMode("high-impact")}>
          <Text>
            {filterMode === "high-impact"
              ? `Selected: High impact (${highImpactCount})`
              : `High impact (${highImpactCount})`}
          </Text>
        </Pressable>
      </View>
      <Text>
        Filter: {formatFilterMode(filterMode)} {"·"} Sort:{" "}
        {formatSortMode(sortMode)}
      </Text>
      <View>
        <Text>Sort</Text>
        <Pressable onPress={() => setSortMode("highest-impact")}>
          <Text>
            {sortMode === "highest-impact"
              ? "Selected: Highest impact"
              : "Highest impact"}
          </Text>
        </Pressable>
        <Pressable onPress={() => setSortMode("route-order")}>
          <Text>
            {sortMode === "route-order"
              ? "Selected: Route order"
              : "Route order"}
          </Text>
        </Pressable>
      </View>
      {segmentsError ? <Text>Unable to load segment list: {segmentsError}</Text> : null}
      {!segmentsError && visibleSegments.length === 0 ? (
        <Text>No road segments available.</Text>
      ) : null}
      {visibleSegments.map((segment) => (
        <Pressable
          key={segment.segmentId}
          onPress={() => {
            void handlePressSegment(segment.segmentId);
          }}
        >
          <Text>
            {selectedSegment?.segment.segmentId === segment.segmentId
              ? `Selected: ${segment.impactLevel === "high" ? "! " : ""}${segment.routeName} · ${segment.fromLabel} -> ${segment.toLabel}`
              : `${segment.impactLevel === "high" ? "! " : ""}${segment.routeName} · ${segment.fromLabel} -> ${segment.toLabel}`}
          </Text>
          <Text>{segment.segmentId}</Text>
          {segment.notes ? <Text>{segment.notes}</Text> : null}
          <Text>
            Impact: {formatImpactLevel(segment.impactLevel)} -{" "}
            {segment.impactReason ?? "Unavailable"}
          </Text>
          {selectedSegmentLoadingId === segment.segmentId ? (
            <Text>Loading segment details...</Text>
          ) : null}
        </Pressable>
      ))}
      {selectedSegmentError ? <Text>{selectedSegmentError}</Text> : null}
      {selectedSegment ? (
        <View>
          <View>
            <Text>Segment</Text>
            <Text>Route Name: {selectedSegment.segment.routeName}</Text>
            <Text>
              Segment Range: {selectedSegment.segment.fromLabel} {"->"}{" "}
              {selectedSegment.segment.toLabel}
            </Text>
          </View>
          <View>
            <Text>Impact</Text>
            <Text>
              Impact Level: {formatImpactLevel(selectedSegment.impact?.level)}
            </Text>
            <Text>
              Impact Reason: {selectedSegment.impact?.reason ?? "Unavailable"}
            </Text>
          </View>
          <View>
            <Text>Road</Text>
            {selectedSegment.primaryStation === null ? (
              <Text>Primary station data unavailable.</Text>
            ) : null}
            <Text>
              Observed At:{" "}
              {formatObservedAt(selectedSegment.primaryStation?.observedAt)}
            </Text>
            <Text>
              Road Surface Temp:{" "}
              {formatRoundedValue(
                selectedSegment.primaryStation?.roadSurfaceTempF,
                "°F",
              )}
            </Text>
            <Text>
              Road State Code:{" "}
              {selectedSegment.primaryStation?.roadStateCode ?? "Unavailable"}
            </Text>
            <Text>
              Road State Label:{" "}
              {selectedSegment.primaryStation?.roadStateLabel ?? "Unavailable"}
            </Text>
          </View>
          <View>
            <Text>Wind</Text>
            <Text>
              Wind Speed:{" "}
              {formatRoundedValue(
                selectedSegment.primaryStation?.windSpeedMph,
                " mph",
              )}
            </Text>
            <Text>
              Wind Gust:{" "}
              {formatRoundedValue(
                selectedSegment.primaryStation?.windGustMph,
                " mph",
              )}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
