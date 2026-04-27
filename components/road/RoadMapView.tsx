import Mapbox from "@rnmapbox/maps";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type ObservedFactors = {
  observedAt: string | null;
  stationId: string | null;
  stationName: string | null;
  sourceProvider: string | null;
  airTempF: number | null;
  windSpeedMph: number | null;
  windGustMph: number | null;
  visibilityMi: number | null;
  roadSurfaceTempF: number | null;
  roadStateCode: number | null;
  roadStateLabel: string | null;
};

type RoadGeometryFeatureCollection = FeatureCollection<
  Geometry,
  GeoJsonProperties
>;

type RoadSegment = {
  segmentId: string;
  routeName: string;
  fromLabel: string;
  toLabel: string;
  latitude: number;
  longitude: number;
  impactLevel: "low" | "moderate" | "high" | string;
  impactReason: string;
  officialConditionLabel: string | null;
  officialConditionDescription: string | null;
  officialRestriction: string | null;
  computedImpactLevel: "low" | "moderate" | "high" | string;
  computedImpactReason: string;
  observedFactors: ObservedFactors;
};

type RoadSegmentFeatureCollection = FeatureCollection<
  Geometry,
  GeoJsonProperties
>;

type SelectedMapSegment = {
  segmentId: string;
  routeName?: string | null;
  fromLabel?: string | null;
  toLabel?: string | null;
  impactLevel?: string | null;
  impactReason?: string | null;
  officialConditionLabel?: string | null;
  officialConditionDescription?: string | null;
  officialRestriction?: string | null;
  computedImpactReason?: string | null;
  observedFactors?: ObservedFactors | null;
};

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const ROAD_API_BASE_URL = process.env.EXPO_PUBLIC_ROAD_API_BASE_URL;

const WYOMING_CENTER: [number, number] = [-107.5512, 42.9996];

type RoadMapViewProps = {
  focusCoordinate?: [number, number] | null;
  focusZoomLevel?: number;
  selectedSegmentId?: string | null;
};

function assertRoadApiBaseUrl() {
  if (!ROAD_API_BASE_URL) {
    throw new Error("Missing EXPO_PUBLIC_ROAD_API_BASE_URL");
  }

  return ROAD_API_BASE_URL.replace(/\/$/, "");
}

function getImpactColor(impactLevel?: string | null) {
  switch (impactLevel) {
    case "high":
      return "#dc2626";
    case "moderate":
      return "#f97316";
    case "low":
      return "#22c55e";
    default:
      return "#64748b";
  }
}

function formatNumber(
  value: number | null | undefined,
  maximumFractionDigits = 0,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

function buildObservedFactorText(observedFactors?: ObservedFactors | null) {
  if (!observedFactors) {
    return "Station observations unavailable";
  }

  const factors: string[] = [];
  const visibility = formatNumber(observedFactors.visibilityMi, 1);
  const gust = formatNumber(observedFactors.windGustMph);
  const sustainedWind = formatNumber(observedFactors.windSpeedMph);
  const roadSurfaceTemp = formatNumber(observedFactors.roadSurfaceTempF);

  if (observedFactors.roadStateLabel) {
    factors.push(`Road state ${observedFactors.roadStateLabel}`);
  }

  if (visibility) {
    factors.push(`Visibility ${visibility} mi`);
  }

  if (gust) {
    factors.push(`Gusts ${gust} mph`);
  } else if (sustainedWind) {
    factors.push(`Wind ${sustainedWind} mph`);
  }

  if (roadSurfaceTemp) {
    factors.push(`Surface ${roadSurfaceTemp}°F`);
  }

  if (factors.length === 0) {
    return "No observed road factors reported";
  }

  return factors.join(" · ");
}

function getOfficialConditionText(segment: SelectedMapSegment) {
  return (
    segment.officialConditionDescription ??
    segment.officialConditionLabel ??
    "No matched WYDOT condition"
  );
}

export function RoadMapView({
  focusCoordinate = null,
  focusZoomLevel = 8,
  selectedSegmentId = null,
}: RoadMapViewProps) {
  const [geometry, setGeometry] =
    useState<RoadGeometryFeatureCollection | null>(null);
  const [segmentMarkers, setSegmentMarkers] =
    useState<RoadSegmentFeatureCollection | null>(null);
  const [selectedMapSegment, setSelectedMapSegment] =
    useState<SelectedMapSegment | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasMapboxToken = Boolean(MAPBOX_ACCESS_TOKEN);
  const cameraCenter = focusCoordinate ?? WYOMING_CENTER;
  const cameraZoomLevel = focusCoordinate ? focusZoomLevel : 5.2;

  useEffect(() => {
    if (MAPBOX_ACCESS_TOKEN) {
      Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadRoadGeometry() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const baseUrl = assertRoadApiBaseUrl();
        const response = await fetch(`${baseUrl}/api/road/geometry`);

        if (!response.ok) {
          throw new Error(`Road geometry request failed: ${response.status}`);
        }

        const payload =
          (await response.json()) as RoadGeometryFeatureCollection;

        if (
          payload.type !== "FeatureCollection" ||
          !Array.isArray(payload.features)
        ) {
          throw new Error("Road geometry response was not a FeatureCollection");
        }

        if (isMounted) {
          setGeometry(payload);
        }

        const segmentsResponse = await fetch(`${baseUrl}/api/road/segments`);

        if (!segmentsResponse.ok) {
          throw new Error(
            `Road segments request failed: ${segmentsResponse.status}`,
          );
        }

        const segmentsPayload =
          (await segmentsResponse.json()) as RoadSegment[];
        const markerPayload: RoadSegmentFeatureCollection = {
          type: "FeatureCollection",
          features: segmentsPayload
            .filter(
              (segment) =>
                typeof segment.latitude === "number" &&
                typeof segment.longitude === "number",
            )
            .map((segment) => ({
              type: "Feature",
              properties: {
                segmentId: segment.segmentId,
                routeName: segment.routeName,
                fromLabel: segment.fromLabel,
                toLabel: segment.toLabel,
                impactLevel: segment.impactLevel,
                impactReason: segment.impactReason,
                officialConditionLabel: segment.officialConditionLabel,
                officialConditionDescription:
                  segment.officialConditionDescription,
                officialRestriction: segment.officialRestriction,
                computedImpactReason: segment.computedImpactReason,
                observedFactors: JSON.stringify(segment.observedFactors),
              },
              geometry: {
                type: "Point",
                coordinates: [segment.longitude, segment.latitude],
              },
            })),
        };

        if (isMounted) {
          setSegmentMarkers(markerPayload);
        }

        if (isMounted && selectedSegmentId) {
          const selectedSegment = segmentsPayload.find(
            (segment) => segment.segmentId === selectedSegmentId,
          );

          if (selectedSegment) {
            setSelectedMapSegment({
              segmentId: selectedSegment.segmentId,
              routeName: selectedSegment.routeName,
              fromLabel: selectedSegment.fromLabel,
              toLabel: selectedSegment.toLabel,
              impactLevel: selectedSegment.impactLevel,
              impactReason: selectedSegment.impactReason,
              officialConditionLabel: selectedSegment.officialConditionLabel,
              officialConditionDescription:
                selectedSegment.officialConditionDescription,
              officialRestriction: selectedSegment.officialRestriction,
              computedImpactReason: selectedSegment.computedImpactReason,
              observedFactors: selectedSegment.observedFactors,
            });
          }
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRoadGeometry();

    return () => {
      isMounted = false;
    };
  }, [selectedSegmentId]);

  if (!hasMapboxToken) {
    return (
      <View style={styles.fallbackPanel}>
        <Text style={styles.fallbackTitle}>Mapbox token missing</Text>
        <Text style={styles.fallbackBody}>
          Add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to the app environment to render
          the road map.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.fallbackPanel}>
        <ActivityIndicator />
        <Text style={styles.fallbackBody}>
          Loading monitored road geometry…
        </Text>
      </View>
    );
  }

  if (errorMessage || !geometry) {
    return (
      <View style={styles.fallbackPanel}>
        <Text style={styles.fallbackTitle}>Road map unavailable</Text>
        <Text style={styles.fallbackBody}>
          {errorMessage ?? "Road geometry could not be loaded."}
        </Text>
      </View>
    );
  }

  function handlePressSegmentMarker(event: { features?: GeoJSON.Feature[] }) {
    const feature = event.features?.[0];
    const properties = feature?.properties;

    if (!properties) {
      return;
    }

    let observedFactors: ObservedFactors | null = null;

    if (typeof properties.observedFactors === "string") {
      try {
        observedFactors = JSON.parse(
          properties.observedFactors,
        ) as ObservedFactors;
      } catch {
        observedFactors = null;
      }
    }

    setSelectedMapSegment({
      segmentId: String(properties.segmentId ?? ""),
      routeName:
        typeof properties.routeName === "string" ? properties.routeName : null,
      fromLabel:
        typeof properties.fromLabel === "string" ? properties.fromLabel : null,
      toLabel:
        typeof properties.toLabel === "string" ? properties.toLabel : null,
      impactLevel:
        typeof properties.impactLevel === "string"
          ? properties.impactLevel
          : null,
      impactReason:
        typeof properties.impactReason === "string"
          ? properties.impactReason
          : null,
      officialConditionLabel:
        typeof properties.officialConditionLabel === "string"
          ? properties.officialConditionLabel
          : null,
      officialConditionDescription:
        typeof properties.officialConditionDescription === "string"
          ? properties.officialConditionDescription
          : null,
      officialRestriction:
        typeof properties.officialRestriction === "string"
          ? properties.officialRestriction
          : null,
      computedImpactReason:
        typeof properties.computedImpactReason === "string"
          ? properties.computedImpactReason
          : null,
      observedFactors,
    });
  }

  return (
    <View style={styles.mapWrap}>
      <Mapbox.MapView
        attributionEnabled={false}
        compassEnabled
        logoEnabled={false}
        rotateEnabled={false}
        scaleBarEnabled={false}
        scrollEnabled
        style={styles.map}
        styleURL={Mapbox.StyleURL.Outdoors}
        zoomEnabled
      >
        <Mapbox.Camera
          animationMode="flyTo"
          centerCoordinate={cameraCenter}
          zoomLevel={cameraZoomLevel}
        />
        <Mapbox.ShapeSource id="road-geometry-source" shape={geometry}>
          <Mapbox.LineLayer
            id="road-geometry-line"
            style={{
              lineCap: "round",
              lineColor: "#22c55e",
              lineJoin: "round",
              lineOpacity: 0.68,
              lineWidth: 2.6,
            }}
          />
        </Mapbox.ShapeSource>
        {segmentMarkers ? (
          <Mapbox.ShapeSource
            id="road-segments-source"
            onPress={handlePressSegmentMarker}
            shape={segmentMarkers}
          >
            <Mapbox.CircleLayer
              id="road-segments-circle"
              style={{
                circleColor: [
                  "match",
                  ["get", "impactLevel"],
                  "high",
                  "#dc2626",
                  "moderate",
                  "#f97316",
                  "low",
                  "#22c55e",
                  "#64748b",
                ],
                circleOpacity: 0.92,
                circleRadius: [
                  "case",
                  [
                    "==",
                    ["get", "segmentId"],
                    selectedMapSegment?.segmentId ?? "",
                  ],
                  7,
                  4.5,
                ],
                circleStrokeColor: "#ffffff",
                circleStrokeWidth: [
                  "case",
                  [
                    "==",
                    ["get", "segmentId"],
                    selectedMapSegment?.segmentId ?? "",
                  ],
                  3,
                  1.5,
                ],
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}
      </Mapbox.MapView>

      {selectedMapSegment ? (
        <View
          style={[
            styles.segmentPill,
            { borderLeftColor: getImpactColor(selectedMapSegment.impactLevel) },
          ]}
        >
          <Pressable
            accessibilityLabel="Close selected road segment"
            accessibilityRole="button"
            onPress={() => setSelectedMapSegment(null)}
            style={styles.segmentPillCloseButton}
          >
            <Text style={styles.segmentPillCloseText}>×</Text>
          </Pressable>

          <View style={styles.segmentPillTitleRow}>
            <View
              style={[
                styles.segmentPillImpactDot,
                {
                  backgroundColor: getImpactColor(
                    selectedMapSegment.impactLevel,
                  ),
                },
              ]}
            />
            <Text style={styles.segmentPillTitle}>
              {selectedMapSegment.routeName ?? "Road segment"}
            </Text>
          </View>
          <Text style={styles.segmentPillBody}>
            {selectedMapSegment.fromLabel ?? "Unknown"} →{" "}
            {selectedMapSegment.toLabel ?? "Unknown"}
          </Text>

          <Text style={styles.segmentPillSectionLabel}>WYDOT condition</Text>
          <Text style={styles.segmentPillMeta}>
            {getOfficialConditionText(selectedMapSegment)}
          </Text>

          {selectedMapSegment.officialRestriction ? (
            <>
              <Text style={styles.segmentPillSectionLabel}>Restriction</Text>
              <Text style={styles.segmentPillMeta}>
                {selectedMapSegment.officialRestriction}
              </Text>
            </>
          ) : null}

          <Text style={styles.segmentPillSectionLabel}>Detected factors</Text>
          <Text style={styles.segmentPillMeta}>
            {buildObservedFactorText(selectedMapSegment.observedFactors)}
          </Text>

          <Text style={styles.segmentPillSectionLabel}>Computed reason</Text>
          <Text style={styles.segmentPillMeta}>
            {selectedMapSegment.computedImpactReason ??
              selectedMapSegment.impactReason ??
              "No impact reason available"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    borderColor: "#bbf7d0",
    borderRadius: 24,
    borderWidth: 1,
    height: 430,
    overflow: "hidden",
    position: "relative",
  },
  map: {
    flex: 1,
  },
  segmentPill: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderColor: "rgba(202, 213, 226, 0.9)",
    borderLeftWidth: 6,
    borderRadius: 16,
    borderWidth: 1,
    bottom: 16,
    left: 14,
    paddingLeft: 14,
    paddingRight: 46,
    paddingVertical: 10,
    position: "absolute",
    right: 14,
    minHeight: 156,
    maxHeight: 210,
  },
  segmentPillCloseButton: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 10,
    top: 10,
    width: 28,
  },
  segmentPillCloseText: {
    color: "#334155",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 22,
    marginTop: -2,
  },
  segmentPillTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  segmentPillImpactDot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  segmentPillTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  segmentPillBody: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 2,
  },
  segmentPillSectionLabel: {
    color: "#475569",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    marginTop: 8,
    textTransform: "uppercase",
  },
  segmentPillMeta: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2,
  },
  fallbackPanel: {
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderColor: "#bbf7d0",
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    height: 430,
    justifyContent: "center",
    padding: 20,
  },
  fallbackTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  fallbackBody: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
