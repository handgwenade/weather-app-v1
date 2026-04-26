import Mapbox from "@rnmapbox/maps";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

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
};

type RoadSegmentFeatureCollection = FeatureCollection<
  Geometry,
  GeoJsonProperties
>;

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const ROAD_API_BASE_URL = process.env.EXPO_PUBLIC_ROAD_API_BASE_URL;
const WYOMING_CENTER: [number, number] = [-107.5512, 42.9996];

function assertRoadApiBaseUrl() {
  if (!ROAD_API_BASE_URL) {
    throw new Error("Missing EXPO_PUBLIC_ROAD_API_BASE_URL");
  }

  return ROAD_API_BASE_URL.replace(/\/$/, "");
}

export function RoadMapView() {
  const [geometry, setGeometry] =
    useState<RoadGeometryFeatureCollection | null>(null);
  const [segmentMarkers, setSegmentMarkers] =
    useState<RoadSegmentFeatureCollection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasMapboxToken = Boolean(MAPBOX_ACCESS_TOKEN);

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
  }, []);

  const featureCountLabel = useMemo(() => {
    if (!geometry) {
      return null;
    }

    return `${geometry.features.length.toLocaleString()} road lines · ${segmentMarkers?.features.length ?? 0} risk markers`;
  }, [geometry, segmentMarkers]);

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
          centerCoordinate={WYOMING_CENTER}
          zoomLevel={5.2}
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
          <Mapbox.ShapeSource id="road-segments-source" shape={segmentMarkers}>
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
                circleRadius: 4.5,
                circleStrokeColor: "#ffffff",
                circleStrokeWidth: 1.5,
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}
      </Mapbox.MapView>

      {featureCountLabel ? (
        <View style={styles.statusPill} pointerEvents="none">
          <Text style={styles.statusPillText}>{featureCountLabel}</Text>
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
  statusPill: {
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 999,
    bottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: "absolute",
  },
  statusPillText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
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
