import { RoadMapView } from "@/components/road/RoadMapView";
import { Palette, Radius, Shadows } from "@/constants/theme";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const LEGEND_ITEMS = [
  {
    label: "Normal",
    description: "Monitored route, no active impact detected",
    style: "normal",
  },
  { label: "Caution", description: "Weather-based caution", style: "caution" },
  {
    label: "Elevated",
    description: "Elevated weather risk",
    style: "elevated",
  },
  { label: "High", description: "High risk or official impact", style: "high" },
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
        <RoadMapView
          focusCoordinate={focusCoordinate}
          focusZoomLevel={8.2}
          selectedSegmentId={selectedSegmentId ?? null}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Layer plan</Text>
          <Text style={styles.cardBody}>
            Monitored roads will show as a green base layer. Caution, elevated,
            and high-risk markers will appear above the route layer as road
            conditions change.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Legend</Text>
          <View style={styles.legendList}>
            {LEGEND_ITEMS.map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, styles[item.style]]} />
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
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Palette.surface,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.xl,
    borderWidth: 1,
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
  normal: {
    backgroundColor: Palette.normal,
  },
  caution: {
    backgroundColor: Palette.caution,
  },
  elevated: {
    backgroundColor: Palette.elevated,
  },
  high: {
    backgroundColor: Palette.high,
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
