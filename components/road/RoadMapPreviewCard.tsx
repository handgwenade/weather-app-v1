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
          <Text style={styles.badgeText}>Map</Text>
        </View>
      </View>

      <View style={styles.legendStrip}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotNormal]} />
          <Text style={styles.legendText}>Normal</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotElevated]} />
          <Text style={styles.legendText}>Elevated</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotHigh]} />
          <Text style={styles.legendText}>High</Text>
        </View>
      </View>

      <Text style={styles.body}>
        View monitored WYDOT route coverage and current weather-based risk
        markers.
      </Text>

      {routeLabel ? (
        <Text style={styles.routeLabel}>Current route focus: {routeLabel}</Text>
      ) : null}

      <View style={styles.openButton}>
        <Text style={styles.openButtonText}>Open road map</Text>
        <Text style={styles.openButtonArrow}>→</Text>
      </View>
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
  legendStrip: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#dbe4ee",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  legendDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  legendDotNormal: {
    backgroundColor: "#22c55e",
  },
  legendDotElevated: {
    backgroundColor: "#f97316",
  },
  legendDotHigh: {
    backgroundColor: "#dc2626",
  },
  legendText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
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
  openButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#0f172a",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  openButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  openButtonArrow: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: -1,
  },
});
