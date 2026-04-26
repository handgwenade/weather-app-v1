import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

type RoadMapPreviewCardProps = {
  routeLabel?: string | null;
};

export function RoadMapPreviewCard({ routeLabel }: RoadMapPreviewCardProps) {
  return (
    <Pressable
      accessibilityHint="Opens the full road map preview"
      accessibilityRole="button"
      onPress={() => router.push("/road-map")}
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.cardPressed : null,
      ]}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Road map</Text>
          <Text style={styles.title}>Monitored routes</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Preview</Text>
        </View>
      </View>

      <View style={styles.mapMock}>
        <View style={[styles.routeLine, styles.routeLineTop]} />
        <View style={[styles.routeLine, styles.routeLineMiddle]} />
        <View style={[styles.routeLine, styles.routeLineBottom]} />
        <View style={[styles.statusDot, styles.statusDotNormal]} />
        <View style={[styles.statusDot, styles.statusDotCaution]} />
        <View style={[styles.statusDot, styles.statusDotElevated]} />
      </View>

      <Text style={styles.body}>
        Map layer will show monitored road segments in green, with caution and
        elevated-risk areas highlighted as conditions change.
      </Text>

      {routeLabel ? (
        <Text style={styles.routeLabel}>Current route focus: {routeLabel}</Text>
      ) : null}

      <Text style={styles.openHint}>Open road map →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ee",
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  cardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }],
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2,
  },
  badge: {
    backgroundColor: "#e0f2fe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: "#0369a1",
    fontSize: 12,
    fontWeight: "800",
  },
  mapMock: {
    backgroundColor: "#ecfdf5",
    borderColor: "#bbf7d0",
    borderRadius: 18,
    borderWidth: 1,
    height: 128,
    overflow: "hidden",
    position: "relative",
  },
  routeLine: {
    backgroundColor: "#22c55e",
    borderRadius: 999,
    height: 8,
    left: 18,
    position: "absolute",
    right: 18,
    transform: [{ rotate: "-13deg" }],
  },
  routeLineTop: {
    top: 34,
  },
  routeLineMiddle: {
    opacity: 0.75,
    top: 61,
  },
  routeLineBottom: {
    opacity: 0.5,
    top: 88,
  },
  statusDot: {
    borderColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 3,
    height: 22,
    position: "absolute",
    width: 22,
  },
  statusDotNormal: {
    backgroundColor: "#22c55e",
    left: 60,
    top: 41,
  },
  statusDotCaution: {
    backgroundColor: "#facc15",
    right: 78,
    top: 62,
  },
  statusDotElevated: {
    backgroundColor: "#f97316",
    left: 138,
    top: 84,
  },
  body: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 20,
  },
  routeLabel: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  openHint: {
    color: "#0369a1",
    fontSize: 13,
    fontWeight: "800",
  },
});
