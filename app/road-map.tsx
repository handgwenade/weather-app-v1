import { router } from "expo-router";
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

export default function RoadMapScreen() {
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
        <View style={styles.mapPanel}>
          <View style={[styles.routeLine, styles.routeLineOne]} />
          <View style={[styles.routeLine, styles.routeLineTwo]} />
          <View style={[styles.routeLine, styles.routeLineThree]} />
          <View style={[styles.marker, styles.markerNormal]} />
          <View style={[styles.marker, styles.markerCaution]} />
          <View style={[styles.marker, styles.markerElevated]} />
          <View style={[styles.marker, styles.markerHigh]} />
          <Text style={styles.mapLabel}>
            Live Mapbox layer will render here
          </Text>
        </View>

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
    backgroundColor: "#f8fafc",
    flex: 1,
  },
  header: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#dbe4ee",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "#e0f2fe",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  backButtonText: {
    color: "#0f172a",
    fontSize: 36,
    lineHeight: 38,
    marginTop: -4,
  },
  headerTextWrap: {
    alignItems: "center",
    flex: 1,
  },
  title: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700",
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
  mapPanel: {
    backgroundColor: "#ecfdf5",
    borderColor: "#bbf7d0",
    borderRadius: 24,
    borderWidth: 1,
    height: 360,
    overflow: "hidden",
    position: "relative",
  },
  routeLine: {
    backgroundColor: "#22c55e",
    borderRadius: 999,
    height: 10,
    left: -40,
    position: "absolute",
    right: -40,
  },
  routeLineOne: {
    top: 92,
    transform: [{ rotate: "-16deg" }],
  },
  routeLineTwo: {
    opacity: 0.75,
    top: 170,
    transform: [{ rotate: "9deg" }],
  },
  routeLineThree: {
    opacity: 0.55,
    top: 248,
    transform: [{ rotate: "-8deg" }],
  },
  marker: {
    borderColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 4,
    height: 28,
    position: "absolute",
    width: 28,
  },
  markerNormal: {
    backgroundColor: "#22c55e",
    left: 74,
    top: 102,
  },
  markerCaution: {
    backgroundColor: "#facc15",
    right: 80,
    top: 158,
  },
  markerElevated: {
    backgroundColor: "#f97316",
    left: 132,
    top: 231,
  },
  markerHigh: {
    backgroundColor: "#dc2626",
    right: 132,
    top: 262,
  },
  mapLabel: {
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    borderRadius: 999,
    bottom: 18,
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: "absolute",
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ee",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  cardBody: {
    color: "#475569",
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
    borderRadius: 999,
    height: 16,
    width: 16,
  },
  normal: {
    backgroundColor: "#22c55e",
  },
  caution: {
    backgroundColor: "#facc15",
  },
  elevated: {
    backgroundColor: "#f97316",
  },
  high: {
    backgroundColor: "#dc2626",
  },
  legendTextWrap: {
    flex: 1,
  },
  legendLabel: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  legendDescription: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1,
  },
});
