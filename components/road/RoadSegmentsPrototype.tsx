import { formatMonthDayTime24Hour } from "@/utils/dateTime";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type RoadSegmentListItem = {
  segmentId: string;
  routeName: string;
  fromLabel: string;
  toLabel: string;
  latitude?: number | null;
  longitude?: number | null;
  districtId?: string | null;
  notes?: string | null;
  impactLevel?: string | null;
  impactReason?: string | null;
  officialConditionLabel?: string | null;
  officialConditionDescription?: string | null;
  officialRestriction?: string | null;
  observedFactors?: {
    roadStateLabel?: string | null;
    windSpeedMph?: number | null;
    windGustMph?: number | null;
    roadSurfaceTempF?: number | null;
  } | null;
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

type SegmentFilterMode = "all" | "wind-prone" | "high-impact";
type SegmentSortMode = "highest-impact" | "nearest";

function getRoadMapHrefForSegment(
  segment: RoadSegmentListItem,
): "/road-map" | `/road-map?${string}` {
  if (
    typeof segment.latitude !== "number" ||
    !Number.isFinite(segment.latitude) ||
    typeof segment.longitude !== "number" ||
    !Number.isFinite(segment.longitude)
  ) {
    return "/road-map";
  }

  const latitude = encodeURIComponent(String(segment.latitude));
  const longitude = encodeURIComponent(String(segment.longitude));
  const segmentId = encodeURIComponent(segment.segmentId);

  return `/road-map?latitude=${latitude}&longitude=${longitude}&segmentId=${segmentId}`;
}

function getRoadApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_ROAD_API_BASE_URL;

  if (!baseUrl) {
    return null;
  }

  return baseUrl.replace(/\/+$/, "");
}

function buildRoadApiUrl(path: string) {
  const baseUrl = getRoadApiBaseUrl();

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}${path}`;
}

function formatCoordinatesForLog(
  coordinates: { latitude: number; longitude: number } | null,
) {
  if (!coordinates) {
    return null;
  }

  return {
    latitude: Number(coordinates.latitude.toFixed(4)),
    longitude: Number(coordinates.longitude.toFixed(4)),
  };
}

async function fetchRoadJson<T>(path: string, errorLabel: string): Promise<T> {
  const requestUrl = buildRoadApiUrl(path);

  if (!requestUrl) {
    throw new Error("Road segment service is unavailable right now.");
  }

  const response = await fetch(requestUrl);

  if (!response.ok) {
    throw new Error(`${errorLabel}: ${response.status}`);
  }

  return (await response.json()) as T;
}

function formatRoundedValue(
  value: number | null | undefined,
  unit: string,
): string {
  return value === null || value === undefined
    ? "Unavailable"
    : `${Math.round(value)}${unit}`;
}

function formatObservedAt(value: string | null | undefined): string {
  return formatMonthDayTime24Hour(value) ?? "Unavailable";
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

function hasMeaningfulText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function formatObservedFactors(segment: RoadSegmentListItem) {
  const factors = segment.observedFactors;

  if (!factors) {
    return null;
  }

  const observedText: string[] = [];

  if (hasMeaningfulText(factors.roadStateLabel)) {
    observedText.push(`Road state ${factors.roadStateLabel}`);
  }

  if (typeof factors.windGustMph === "number") {
    observedText.push(`Gusts ${Math.round(factors.windGustMph)} mph`);
  } else if (typeof factors.windSpeedMph === "number") {
    observedText.push(`Wind ${Math.round(factors.windSpeedMph)} mph`);
  }

  if (typeof factors.roadSurfaceTempF === "number") {
    observedText.push(`Surface ${Math.round(factors.roadSurfaceTempF)}°F`);
  }

  return observedText.length > 0 ? observedText.join(" · ") : null;
}

function getSegmentConditionText(segment: RoadSegmentListItem) {
  if (hasMeaningfulText(segment.officialRestriction)) {
    return segment.officialRestriction;
  }

  if (hasMeaningfulText(segment.officialConditionDescription)) {
    return segment.officialConditionDescription;
  }

  if (hasMeaningfulText(segment.officialConditionLabel)) {
    return segment.officialConditionLabel;
  }

  return null;
}

function formatFilterMode(mode: SegmentFilterMode): string {
  switch (mode) {
    case "wind-prone":
      return "Wind-prone";
    case "high-impact":
      return "High risk";
    default:
      return "All";
  }
}

function formatSortMode(mode: SegmentSortMode): string {
  switch (mode) {
    case "nearest":
      return "Nearest";
    default:
      return "Highest risk";
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

function getImpactLevelTextStyle(level: string | null | undefined) {
  switch (level) {
    case "high":
      return styles.impactHighText;
    case "moderate":
      return styles.impactModerateText;
    case "low":
      return styles.impactLowText;
    default:
      return styles.impactUnknownText;
  }
}

function getDistanceMiles(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const deltaLatitude = toRadians(toLatitude - fromLatitude);
  const deltaLongitude = toRadians(toLongitude - fromLongitude);
  const fromLatitudeRadians = toRadians(fromLatitude);
  const toLatitudeRadians = toRadians(toLatitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitudeRadians) *
      Math.cos(toLatitudeRadians) *
      Math.sin(deltaLongitude / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceLabel(
  segment: RoadSegmentListItem,
  referenceCoordinates: { latitude: number; longitude: number } | null,
) {
  if (
    !referenceCoordinates ||
    typeof segment.latitude !== "number" ||
    typeof segment.longitude !== "number"
  ) {
    return null;
  }

  const distanceMiles = getDistanceMiles(
    referenceCoordinates.latitude,
    referenceCoordinates.longitude,
    segment.latitude,
    segment.longitude,
  );

  return `${distanceMiles.toFixed(1)} mi away`;
}

type RoadSegmentsPrototypeProps = {
  defaultSortMode?: SegmentSortMode;
  listLabel?: string;
  selectedCoordinates?: {
    latitude: number;
    longitude: number;
  } | null;
  fallbackObservation?: {
    corridorLabel: string;
    observedAt: string;
    airTemp: string;
    roadTemp: string;
    wind: string;
    note: string;
  } | null;
};

export default function RoadSegmentsPrototype({
  defaultSortMode = "nearest",
  listLabel = "Road segments",
  selectedCoordinates = null,
  fallbackObservation = null,
}: RoadSegmentsPrototypeProps) {
  const [segments, setSegments] = useState<RoadSegmentListItem[]>([]);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<SegmentFilterMode>("all");
  const [sortMode, setSortMode] = useState<SegmentSortMode>(defaultSortMode);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [userCoordinates, setUserCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationFallbackNote, setLocationFallbackNote] = useState<
    string | null
  >(null);
  const [selectedSegment, setSelectedSegment] =
    useState<RoadSegmentDetail | null>(null);
  const [selectedSegmentLoadingId, setSelectedSegmentLoadingId] = useState<
    string | null
  >(null);
  const [selectedSegmentError, setSelectedSegmentError] = useState<
    string | null
  >(null);

  useEffect(() => {
    let isActive = true;

    async function loadSegments() {
      const requestPath = "/api/road/segments";
      const requestUrl = buildRoadApiUrl(requestPath) ?? "unconfigured";

      console.log("[RoadSegments] Fetch request", {
        requestPath,
        requestUrl,
        requestParams: null,
      });

      try {
        const data = await fetchRoadJson<RoadSegmentListItem[]>(
          requestPath,
          "Unable to load segments",
        );
        if (!isActive) {
          return;
        }

        console.log("[RoadSegments] Fetch response", {
          requestPath,
          requestUrl,
          rawBackendResponseCount: Array.isArray(data) ? data.length : null,
          sampleSegmentIds: Array.isArray(data)
            ? data.slice(0, 5).map((segment) => segment.segmentId)
            : [],
        });
        setSegments(data);
        setSegmentsError(null);
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.log("[RoadSegments] Fetch failed", {
          requestPath,
          requestUrl,
          error: error instanceof Error ? error.message : String(error),
        });
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

  useEffect(() => {
    setSortMode(defaultSortMode);
    setSortMenuOpen(false);
    if (defaultSortMode !== "nearest") {
      setLocationFallbackNote(null);
    }
  }, [defaultSortMode]);

  useEffect(() => {
    let isActive = true;

    async function loadUserLocation() {
      if (sortMode !== "nearest") {
        return;
      }

      if (selectedCoordinates) {
        setLocationFallbackNote(null);
        return;
      }

      if (userCoordinates) {
        setLocationFallbackNote(null);
        return;
      }

      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();

        if (!servicesEnabled) {
          if (!isActive) {
            return;
          }

          setLocationFallbackNote("Location unavailable; using Highest risk.");
          return;
        }

        const permission = await Location.requestForegroundPermissionsAsync();

        if (!isActive) {
          return;
        }

        if (permission.status !== "granted") {
          setLocationFallbackNote("Location unavailable; using Highest risk.");
          return;
        }

        const position = await Location.getCurrentPositionAsync({});

        if (!isActive) {
          return;
        }

        setUserCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationFallbackNote(null);
      } catch {
        if (!isActive) {
          return;
        }

        setLocationFallbackNote("Location unavailable; using Highest risk.");
      }
    }

    void loadUserLocation();

    return () => {
      isActive = false;
    };
  }, [sortMode, selectedCoordinates, userCoordinates]);

  function handleSelectSortMode(nextSortMode: SegmentSortMode) {
    setSortMode(nextSortMode);
    setSortMenuOpen(false);
  }

  async function handlePressSegment(segmentId: string) {
    setSelectedSegmentLoadingId(segmentId);
    setSelectedSegmentError(null);

    try {
      const data = await fetchRoadJson<RoadSegmentDetail>(
        `/api/road/segment/${segmentId}`,
        "Unable to load selected segment",
      );
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
  const referenceCoordinates = selectedCoordinates ?? userCoordinates;
  const useNearestSorting = sortMode === "nearest" && !!referenceCoordinates;
  const hasNoMappedSegments = !segmentsError && segments.length === 0;
  const segmentIdSample = segments
    .slice(0, 5)
    .map((segment) => segment.segmentId)
    .join(",");

  const mappedSegments = segments.map((segment, index) => ({ segment, index }));
  const filteredSegments = mappedSegments.filter(({ segment }) => {
    if (filterMode === "all") {
      return true;
    }

    if (filterMode === "wind-prone") {
      return /wind/i.test(segment.notes ?? "");
    }

    return segment.impactLevel === "high";
  });
  const sortedSegments = [...filteredSegments].sort((a, b) => {
    if (useNearestSorting && referenceCoordinates) {
      const aHasCoordinates =
        typeof a.segment.latitude === "number" &&
        typeof a.segment.longitude === "number";
      const bHasCoordinates =
        typeof b.segment.latitude === "number" &&
        typeof b.segment.longitude === "number";

      if (aHasCoordinates && bHasCoordinates) {
        const distanceDelta =
          getDistanceMiles(
            referenceCoordinates.latitude,
            referenceCoordinates.longitude,
            a.segment.latitude!,
            a.segment.longitude!,
          ) -
          getDistanceMiles(
            referenceCoordinates.latitude,
            referenceCoordinates.longitude,
            b.segment.latitude!,
            b.segment.longitude!,
          );

        if (distanceDelta !== 0) {
          return distanceDelta;
        }
      } else if (aHasCoordinates !== bHasCoordinates) {
        return aHasCoordinates ? -1 : 1;
      }

      return a.index - b.index;
    }

    const severityDelta =
      getImpactSeverityOrder(a.segment.impactLevel) -
      getImpactSeverityOrder(b.segment.impactLevel);

    if (severityDelta !== 0) {
      return severityDelta;
    }

    if (selectedCoordinates) {
      const aHasCoordinates =
        typeof a.segment.latitude === "number" &&
        typeof a.segment.longitude === "number";
      const bHasCoordinates =
        typeof b.segment.latitude === "number" &&
        typeof b.segment.longitude === "number";

      if (aHasCoordinates && bHasCoordinates) {
        const distanceDelta =
          getDistanceMiles(
            selectedCoordinates.latitude,
            selectedCoordinates.longitude,
            a.segment.latitude!,
            a.segment.longitude!,
          ) -
          getDistanceMiles(
            selectedCoordinates.latitude,
            selectedCoordinates.longitude,
            b.segment.latitude!,
            b.segment.longitude!,
          );

        if (distanceDelta !== 0) {
          return distanceDelta;
        }
      } else if (aHasCoordinates !== bHasCoordinates) {
        return aHasCoordinates ? -1 : 1;
      }
    }

    return a.index - b.index;
  });
  const visibleSegments = sortedSegments.map(({ segment }) => segment);
  const finalSegmentIdSample = visibleSegments
    .slice(0, 5)
    .map((segment) => segment.segmentId)
    .join(",");
  const pipelineLog = useMemo(
    () => ({
      requestPath: "/api/road/segments",
      requestParams: null,
      selectedCoordinatesUsedForRequest: null,
      selectedCoordinatesUsedForSorting:
        formatCoordinatesForLog(selectedCoordinates),
      userCoordinatesUsedForSorting: formatCoordinatesForLog(userCoordinates),
      referenceCoordinates: formatCoordinatesForLog(referenceCoordinates),
      filterMode,
      filterLabel: formatFilterMode(filterMode),
      sortMode,
      sortLabel: formatSortMode(sortMode),
      useNearestSorting,
      rawBackendResponseCount: segmentsError ? null : segments.length,
      transformedSegmentCount: segmentsError ? 0 : mappedSegments.length,
      filteredCount: segmentsError ? 0 : filteredSegments.length,
      windProneCount: segmentsError ? 0 : windProneCount,
      highImpactCount: segmentsError ? 0 : highImpactCount,
      sortedCount: segmentsError ? 0 : sortedSegments.length,
      finalRenderedCount: segmentsError ? 0 : visibleSegments.length,
      hasNoMappedSegments,
      backendRowsDisappearInFrontend:
        !segmentsError && segments.length > 0 && visibleSegments.length === 0,
      sampleSegmentIds: segmentsError
        ? []
        : segmentIdSample.split(",").filter(Boolean),
      finalSegmentIds: segmentsError
        ? []
        : finalSegmentIdSample.split(",").filter(Boolean),
      segmentsError,
    }),
    [
      filterMode,
      finalSegmentIdSample,
      filteredSegments.length,
      hasNoMappedSegments,
      highImpactCount,
      mappedSegments.length,
      referenceCoordinates,
      segmentIdSample,
      segments.length,
      segmentsError,
      selectedCoordinates,
      sortMode,
      sortedSegments.length,
      useNearestSorting,
      userCoordinates,
      visibleSegments.length,
      windProneCount,
    ],
  );

  useEffect(() => {
    console.log("[RoadSegments] Pipeline", pipelineLog);
  }, [pipelineLog]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Road Segments</Text>
      {hasNoMappedSegments ? (
        <>
          <Text style={styles.summaryText}>
            No mapped road segments for this area yet.
          </Text>
          <Text style={styles.summaryText}>
            Showing nearest road conditions instead.
          </Text>
        </>
      ) : (
        <Text style={styles.summaryText}>
          Showing {visibleSegments.length} of {segments.length} segments
        </Text>
      )}
      <View style={styles.controlsGroup}>
        <Text style={styles.controlLabel}>Filter</Text>
        <Pressable
          style={styles.controlRow}
          onPress={() => setFilterMode("all")}
        >
          <Ionicons
            name={filterMode === "all" ? "checkbox" : "square-outline"}
            size={18}
            color="#45556C"
          />
          <Text style={styles.controlOptionText}>All ({allCount})</Text>
        </Pressable>
        <Pressable
          style={styles.controlRow}
          onPress={() => setFilterMode("wind-prone")}
        >
          <Ionicons
            name={filterMode === "wind-prone" ? "checkbox" : "square-outline"}
            size={18}
            color="#45556C"
          />
          <Text style={styles.controlOptionText}>
            Wind-prone ({windProneCount})
          </Text>
        </Pressable>
        <Pressable
          style={styles.controlRow}
          onPress={() => setFilterMode("high-impact")}
        >
          <Ionicons
            name={filterMode === "high-impact" ? "checkbox" : "square-outline"}
            size={18}
            color="#45556C"
          />
          <Text style={styles.controlOptionText}>
            High risk ({highImpactCount})
          </Text>
        </Pressable>
      </View>
      {/* summaryText for filter/sort removed */}
      <View style={styles.sortGroup}>
        <Text style={styles.controlLabel}>Sort</Text>
        <View style={styles.sortMenuContainer}>
          <Pressable
            style={styles.sortButton}
            onPress={() => setSortMenuOpen((current) => !current)}
          >
            <Text style={styles.sortButtonText}>
              Sort: {formatSortMode(sortMode)}
            </Text>
            <Ionicons
              name={sortMenuOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color="#45556C"
            />
          </Pressable>
          {sortMenuOpen ? (
            <View style={styles.sortDropdown}>
              <Pressable
                style={styles.sortDropdownOption}
                onPress={() => handleSelectSortMode("highest-impact")}
              >
                <Text style={styles.sortDropdownOptionText}>Highest risk</Text>
                <Ionicons
                  name={
                    sortMode === "highest-impact"
                      ? "checkmark"
                      : "ellipse-outline"
                  }
                  size={16}
                  color="#45556C"
                />
              </Pressable>
              <Pressable
                style={styles.sortDropdownOption}
                onPress={() => handleSelectSortMode("nearest")}
              >
                <Text style={styles.sortDropdownOptionText}>Nearest</Text>
                <Ionicons
                  name={
                    sortMode === "nearest" ? "checkmark" : "ellipse-outline"
                  }
                  size={16}
                  color="#45556C"
                />
              </Pressable>
            </View>
          ) : null}
        </View>
        {sortMode === "nearest" && locationFallbackNote ? (
          <Text style={styles.locationNoteText}>{locationFallbackNote}</Text>
        ) : null}
      </View>
      <View style={styles.listBlock}>
        <Text style={styles.listLabelText}>{listLabel}</Text>
        {segmentsError ? (
          <Text style={styles.messageText}>
            Road segment data isn&apos;t available right now.
          </Text>
        ) : null}
        {hasNoMappedSegments ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>
              {fallbackObservation?.corridorLabel ?? "Nearest road conditions"}
            </Text>
            <Text style={styles.emptyStateBody}>
              Observed at: {fallbackObservation?.observedAt ?? "Unavailable"}
            </Text>
            <Text style={styles.emptyStateBody}>
              Air temp: {fallbackObservation?.airTemp ?? "Unavailable"}
            </Text>
            <Text style={styles.emptyStateBody}>
              Road temp: {fallbackObservation?.roadTemp ?? "Unavailable"}
            </Text>
            <Text style={styles.emptyStateBody}>
              Wind: {fallbackObservation?.wind ?? "Unavailable"}
            </Text>
            <Text style={styles.emptyStateNote}>
              {fallbackObservation?.note ??
                "Nearest road observation data is unavailable right now."}
            </Text>
          </View>
        ) : null}
        {!segmentsError &&
        !hasNoMappedSegments &&
        visibleSegments.length === 0 ? (
          <Text style={styles.messageText}>No road segments available.</Text>
        ) : null}
        {visibleSegments.map((segment) => (
          <View key={segment.segmentId} style={styles.segmentRowSpacing}>
            <Pressable
              style={[
                styles.segmentRowCard,
                selectedSegment?.segment.segmentId === segment.segmentId
                  ? styles.segmentRowCardSelected
                  : null,
              ]}
              onPress={() => {
                void handlePressSegment(segment.segmentId);
                router.push(getRoadMapHrefForSegment(segment));
              }}
            >
              <Text style={styles.segmentPrimaryText}>
                {selectedSegment?.segment.segmentId === segment.segmentId
                  ? `Selected: ${segment.impactLevel === "high" ? "! " : ""}${segment.routeName} · ${segment.fromLabel} → ${segment.toLabel}`
                  : `${segment.impactLevel === "high" ? "! " : ""}${segment.routeName} · ${segment.fromLabel} → ${segment.toLabel}`}
              </Text>
              {getSegmentConditionText(segment) ? (
                <Text style={styles.segmentConditionText}>
                  <Text style={styles.segmentConditionLabel}>WYDOT: </Text>
                  {getSegmentConditionText(segment)}
                </Text>
              ) : null}
              {formatObservedFactors(segment) ? (
                <Text style={styles.segmentObservedText}>
                  {formatObservedFactors(segment)}
                </Text>
              ) : null}
              <Text style={styles.segmentImpactText}>
                <Text style={styles.segmentImpactLabel}>RoadSignal risk: </Text>
                <Text style={getImpactLevelTextStyle(segment.impactLevel)}>
                  {formatImpactLevel(segment.impactLevel)}
                </Text>
              </Text>
              {sortMode === "nearest" ? (
                <Text style={styles.segmentDistanceText}>
                  {formatDistanceLabel(segment, referenceCoordinates)}
                </Text>
              ) : null}
              {segment.notes ? (
                <Text style={styles.segmentNotesText}>{segment.notes}</Text>
              ) : null}
              {selectedSegmentLoadingId === segment.segmentId ? (
                <Text style={styles.loadingText}>
                  Loading segment details...
                </Text>
              ) : null}
            </Pressable>
          </View>
        ))}
      </View>
      {selectedSegmentError ? (
        <Text style={styles.messageText}>{selectedSegmentError}</Text>
      ) : null}
      {selectedSegment ? (
        <View style={styles.detailPanel}>
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Segment</Text>
            <Text style={styles.detailBodyText}>
              Route Name: {selectedSegment.segment.routeName}
            </Text>
            <Text style={styles.detailBodyText}>
              Segment Range: {selectedSegment.segment.fromLabel} {"->"}{" "}
              {selectedSegment.segment.toLabel}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Weather risk</Text>
            <Text style={styles.detailBodyText}>
              Weather Risk Level:{" "}
              <Text
                style={getImpactLevelTextStyle(selectedSegment.impact?.level)}
              >
                {formatImpactLevel(selectedSegment.impact?.level)}
              </Text>
            </Text>
            <Text style={styles.detailBodyText}>
              Weather Risk Reason:{" "}
              {selectedSegment.impact?.reason ?? "Unavailable"}
            </Text>
          </View>
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Road</Text>
            {selectedSegment.primaryStation === null ? (
              <Text style={styles.detailBodyText}>
                Primary station data unavailable.
              </Text>
            ) : null}
            <Text style={styles.detailBodyText}>
              Observed At:{" "}
              {formatObservedAt(selectedSegment.primaryStation?.observedAt)}
            </Text>
            <Text style={styles.detailBodyText}>
              Road Surface Temp:{" "}
              {formatRoundedValue(
                selectedSegment.primaryStation?.roadSurfaceTempF,
                "°F",
              )}
            </Text>
            <Text style={styles.detailBodyText}>
              Road State Code:{" "}
              {selectedSegment.primaryStation?.roadStateCode ?? "Unavailable"}
            </Text>
            <Text style={styles.detailBodyText}>
              Road State Label:{" "}
              {selectedSegment.primaryStation?.roadStateLabel ?? "Unavailable"}
            </Text>
          </View>
          <View>
            <Text style={styles.detailSectionTitle}>Wind</Text>
            <Text style={styles.detailBodyText}>
              Wind Speed:{" "}
              {formatRoundedValue(
                selectedSegment.primaryStation?.windSpeedMph,
                " mph",
              )}
            </Text>
            <Text style={styles.detailBodyText}>
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

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  sectionTitle: {
    color: "#0F172B",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  summaryText: {
    color: "#62748E",
    fontSize: 13,
    lineHeight: 18,
  },
  controlsGroup: {
    marginBottom: 8,
    gap: 6,
  },
  sortGroup: {
    marginTop: 8,
    marginBottom: 12,
    gap: 6,
  },
  sortMenuContainer: {
    alignSelf: "flex-start",
    minWidth: 180,
  },
  controlLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 2,
  },
  controlRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  controlOptionText: {
    color: "#45556C",
    fontSize: 14,
    lineHeight: 20,
  },
  sortButton: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "rgba(202, 213, 226, 0.7)",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "space-between",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sortDropdown: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(202, 213, 226, 0.9)",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    overflow: "hidden",
  },
  sortDropdownOption: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  sortDropdownOptionText: {
    color: "#45556C",
    fontSize: 14,
    lineHeight: 20,
  },
  sortButtonText: {
    color: "#45556C",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  locationNoteText: {
    color: "#62748E",
    fontSize: 13,
    lineHeight: 18,
  },
  listBlock: {
    marginBottom: 12,
  },
  listLabelText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 8,
  },
  messageText: {
    color: "#45556C",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyStateCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(202, 213, 226, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
    marginBottom: 8,
  },
  emptyStateTitle: {
    color: "#0F172B",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  emptyStateBody: {
    color: "#45556C",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyStateNote: {
    color: "#62748E",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  segmentRowSpacing: {
    paddingBottom: 8,
    marginBottom: 8,
  },
  segmentRowCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(202, 213, 226, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  segmentRowCardSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  segmentPrimaryText: {
    color: "#0F172B",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  segmentImpactLabel: {
    color: "#45556C",
    fontSize: 13,
    lineHeight: 18,
  },
  segmentImpactText: {
    color: "#45556C",
    fontSize: 13,
    lineHeight: 18,
  },
  segmentNotesText: {
    color: "#62748E",
    fontSize: 13,
    lineHeight: 18,
  },
  segmentDistanceText: {
    color: "#62748E",
    fontSize: 13,
    lineHeight: 18,
  },
  loadingText: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 18,
  },
  impactHighText: {
    color: "#991B1B",
    fontWeight: "700",
  },
  impactModerateText: {
    color: "#92400E",
    fontWeight: "700",
  },
  impactLowText: {
    color: "#0D542B",
    fontWeight: "700",
  },
  impactUnknownText: {
    color: "#475569",
    fontWeight: "700",
  },
  segmentConditionLabel: {
    color: "#334155",
    fontWeight: "800",
  },
  segmentConditionText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  segmentObservedText: {
    color: "#62748E",
    fontSize: 13,
    lineHeight: 18,
  },
  detailPanel: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(202, 213, 226, 0.7)",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  detailSection: {
    marginBottom: 12,
  },
  detailSectionTitle: {
    color: "#0F172B",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 4,
  },
  detailBodyText: {
    color: "#45556C",
    fontSize: 14,
    lineHeight: 20,
  },
});
