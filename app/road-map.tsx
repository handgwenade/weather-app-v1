import { RoadMapView } from "@/components/road/RoadMapView";
import { Palette, Radius, Shadows } from "@/constants/theme";
import {
  getRoadMapStatusColor,
  ROAD_MAP_LAYER_PLAN_COPY,
  ROAD_MAP_LEGEND_GROUP_LABELS,
} from "@/utils/roadMapStatus";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const CONDITION_LEGEND_ITEMS = [
  {
    label: "Normal / Low",
    description: "No active impact detected",
    color: getRoadMapStatusColor("normal"),
  },
  {
    label: "Caution / Moderate",
    description: "Weather-based caution",
    color: getRoadMapStatusColor("caution"),
  },
  {
    label: "Elevated",
    description: "Elevated risk",
    color: getRoadMapStatusColor("elevated"),
  },
  {
    label: "High / Closed",
    description: "High risk or official impact",
    color: getRoadMapStatusColor("high"),
  },
  {
    label: "Unknown",
    description: "Data unavailable or status unknown",
    color: getRoadMapStatusColor("unknown"),
  },
] as const;

function getFocusCoordinateFromParams(params: {
  latitude?: string | string[];
  longitude?: string | string[];
}): [number, number] | null {
  const rawLatitude = Array.isArray(params.latitude)
    ? params.latitude[0]
    : params.latitude;
  const rawLongitude = Array.isArray(params.longitude)
    ? params.longitude[0]
    : params.longitude;

  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return [longitude, latitude];
}

export default function RoadMapScreen() {
  const params = useLocalSearchParams<{
    latitude?: string;
    longitude?: string;
    segmentId?: string;
  }>();
  const focusCoordinate = getFocusCoordinateFromParams(params);
  const selectedSegmentId = Array.isArray(params.segmentId)
    ? params.segmentId[0]
    : params.segmentId;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Road map</Text>
          <Text style={styles.subtitle}>Monitored routes</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mapLane}>
          <RoadMapView
            focusCoordinate={focusCoordinate}
            focusZoomLevel={8.2}
            selectedSegmentId={selectedSegmentId ?? null}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Layer plan</Text>
          <Text style={styles.cardBody}>{ROAD_MAP_LAYER_PLAN_COPY}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Legend</Text>
          <Text style={styles.legendGroupTitle}>
            {ROAD_MAP_LEGEND_GROUP_LABELS.routeLayer}
          </Text>
          <View style={styles.legendItem}>
            <View style={styles.legendLine} />
            <View style={styles.legendTextWrap}>
              <Text style={styles.legendLabel}>Monitored route</Text>
              <Text style={styles.legendDescription}>
                Green line showing route coverage
              </Text>
            </View>
          </View>
          <Text style={[styles.legendGroupTitle, styles.legendGroupSpacing]}>
            {ROAD_MAP_LEGEND_GROUP_LABELS.conditionMarkers}
          </Text>
          <View style={styles.legendList}>
            {CONDITION_LEGEND_ITEMS.map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: item.color }]}
                />
                <View style={styles.legendTextWrap}>
                  <Text style={styles.legendLabel}>{item.label}</Text>
                  <Text style={styles.legendDescription}>
                    {item.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Palette.background,
    flex: 1,
  },
  header: {
    alignItems: "center",
    backgroundColor: Palette.background,
    borderBottomColor: "rgba(221, 227, 243, 0.75)",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: Palette.primarySoft,
    borderColor: "rgba(86, 55, 255, 0.16)",
    borderRadius: Radius.pill,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  backButtonText: {
    color: Palette.primary,
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 38,
    marginTop: -4,
  },
  headerTextWrap: {
    alignItems: "center",
    flex: 1,
  },
  title: {
    color: Palette.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.55,
  },
  subtitle: {
    color: Palette.textSecondary,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    gap: 16,
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 40,
  },
  mapLane: {
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: Palette.surface,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.xl,
    borderWidth: 1,
    marginHorizontal: 20,
    padding: 18,
    ...Shadows.card,
  },
  cardTitle: {
    color: Palette.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.35,
    marginBottom: 8,
  },
  cardBody: {
    color: Palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  legendList: {
    gap: 12,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  legendDot: {
    borderColor: Palette.surface,
    borderRadius: Radius.pill,
    borderWidth: 2,
    height: 18,
    width: 18,
  },
  legendLine: {
    backgroundColor: Palette.normal,
    borderRadius: Radius.pill,
    height: 5,
    width: 34,
  },
  legendGroupTitle: {
    color: Palette.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  legendGroupSpacing: {
    marginTop: 18,
  },
  legendTextWrap: {
    flex: 1,
  },
  legendLabel: {
    color: Palette.textPrimary,
    fontSize: 15,
    fontWeight: "900",
  },
  legendDescription: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1,
  },
});
