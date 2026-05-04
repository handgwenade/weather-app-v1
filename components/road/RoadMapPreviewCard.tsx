import { Palette, Radius, Shadows } from "@/constants/theme";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

type RoadMapPreviewCardProps = {
  routeLabel?: string | null;
  focusCoordinate?: {
    latitude: number;
    longitude: number;
  } | null;
};

function getRoadMapHref(
  focusCoordinate: RoadMapPreviewCardProps["focusCoordinate"],
): "/road-map" | `/road-map?${string}` {
  if (!focusCoordinate) {
    return "/road-map";
  }

  const latitude = encodeURIComponent(String(focusCoordinate.latitude));
  const longitude = encodeURIComponent(String(focusCoordinate.longitude));

  return `/road-map?latitude=${latitude}&longitude=${longitude}`;
}

export function RoadMapPreviewCard({
  routeLabel,
  focusCoordinate = null,
}: RoadMapPreviewCardProps) {
  return (
    <Pressable
      accessibilityHint="Opens the full road map preview"
      accessibilityRole="button"
      onPress={() => router.push(getRoadMapHref(focusCoordinate))}
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
    backgroundColor: Palette.surface,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: 14,
    padding: 18,
    ...Shadows.card,
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
    color: Palette.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    color: Palette.textPrimary,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.55,
    marginTop: 2,
  },
  badge: {
    backgroundColor: Palette.primarySoft,
    borderColor: "rgba(86, 55, 255, 0.16)",
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  badgeText: {
    color: Palette.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  legendStrip: {
    alignItems: "center",
    backgroundColor: Palette.backgroundCool,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.lg,
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
    backgroundColor: Palette.normal,
  },
  legendDotElevated: {
    backgroundColor: Palette.elevated,
  },
  legendDotHigh: {
    backgroundColor: Palette.high,
  },
  legendText: {
    color: Palette.textSecondary,
    fontSize: 12,
    fontWeight: "800",
  },
  body: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.15,
  },
  routeLabel: {
    color: Palette.midnight,
    fontSize: 13,
    fontWeight: "800",
  },
  openButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: Palette.primary,
    borderColor: "rgba(86, 55, 255, 0.2)",
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 11,
    ...Shadows.soft,
  },
  openButtonText: {
    color: Palette.textOnDark,
    fontSize: 13,
    fontWeight: "900",
  },
  openButtonArrow: {
    color: Palette.textOnDark,
    fontSize: 15,
    fontWeight: "900",
    marginTop: -1,
  },
});
