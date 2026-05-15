import { Palette, Radius, Shadows } from "@/constants/theme";
import { useScrollToTopOnFocus } from "@/hooks/useScrollToTopOnFocus";
import InteractiveRoadConditionChart from "@/components/home/InteractiveRoadConditionChart";
import type {
  RoadConditionChartMetric,
  RoadConditionChartPoint,
} from "@/utils/roadConditionChart";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type HomeIconName = ComponentProps<typeof Ionicons>["name"];

type Tone = "good" | "neutral" | "warning" | "alert";
type HomeCardState =
  | "loading"
  | "fresh"
  | "stale"
  | "unavailable"
  | "estimated";

export type HomeMetric = {
  label: string;
  value: string;
  state?: HomeCardState;
  freshnessLabel?: string;
};

export type HomeBullet = {
  id: string;
  text: string;
};

export type HomeStatusBanner = {
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone: Tone;
  actionLabel: string;
};

export type HomeMonitoringCard = {
  title: string;
  body: string;
};

export type HomeLocationCard = {
  title: string;
  bullets: HomeBullet[];
  statusLabel: string;
  statusTone: Tone;
  impactLabel: string;
};

type HomeScreenV2Props = {
  topTitle: string;
  updatedLabel: string;
  statusBanner: HomeStatusBanner;
  metrics: HomeMetric[];
  roadHourly: RoadConditionChartPoint[];
  roadHourlyLoading: boolean;
  monitoringCard: HomeMonitoringCard;
  monitoredLocationCard: HomeLocationCard;
  onPressSettings: () => void;
  onPressSwitchLocation: () => void;
  onPressStatusAction: () => void;
  onPressMonitoredLocation: () => void;
  onPressPrimaryAction: () => void;
  onPressSecondaryAction: () => void;
};

function getStatusChipStyle(tone: Tone) {
  switch (tone) {
    case "alert":
      return {
        backgroundColor: "#FCE7F0",
        borderColor: "#F5A3BD",
        textColor: Palette.high,
      };
    case "warning":
      return {
        backgroundColor: "#FFF7D6",
        borderColor: Palette.caution,
        textColor: "#8A4B00",
      };
    case "neutral":
      return {
        backgroundColor: Palette.surfaceSoft,
        borderColor: Palette.border,
        textColor: Palette.midnight,
      };
    default:
      return {
        backgroundColor: "#DFFBEF",
        borderColor: "#8EF0C2",
        textColor: "#087A4A",
      };
  }
}

function getMetricIcon(label: string): HomeIconName {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("humid")) {
    return "water-outline";
  }

  if (normalizedLabel.includes("road") || normalizedLabel.includes("surface")) {
    return "trail-sign-outline";
  }

  if (normalizedLabel.includes("wind") || normalizedLabel.includes("gust")) {
    return "partly-sunny-outline";
  }

  if (normalizedLabel.includes("precip") || normalizedLabel.includes("rain")) {
    return "rainy-outline";
  }

  if (normalizedLabel.includes("alert")) {
    return "notifications-outline";
  }

  if (normalizedLabel.includes("temp")) {
    return "thermometer-outline";
  }

  return "speedometer-outline";
}

function getHeroMetric(metrics: HomeMetric[]) {
  return (
    metrics.find((metric) => metric.label.toLowerCase().includes("temp")) ??
    metrics[0] ?? {
      label: "Current",
      value: "--",
    }
  );
}

export default function HomeScreenV2({
  topTitle,
  updatedLabel,
  statusBanner,
  metrics,
  roadHourly,
  roadHourlyLoading,
  monitoringCard,
  monitoredLocationCard,
  onPressSettings,
  onPressSwitchLocation,
  onPressStatusAction,
  onPressMonitoredLocation,
  onPressPrimaryAction,
  onPressSecondaryAction,
}: HomeScreenV2Props) {
  const bannerChipStyle = getStatusChipStyle(statusBanner.statusTone);
  const heroMetric = getHeroMetric(metrics);
  const visibleMetrics = metrics
    .filter((metric) => metric.label !== heroMetric.label)
    .slice(0, 6);
  const locationChipStyle = getStatusChipStyle(
    monitoredLocationCard.statusTone,
  );
  const scrollViewRef = useRef<ScrollView>(null);

  useScrollToTopOnFocus(scrollViewRef);

  const [forecastMode, setForecastMode] =
    useState<RoadConditionChartMetric>("precipitationProbability");

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <Pressable style={styles.titleButton} onPress={onPressSwitchLocation}>
            <Text style={styles.topTitle} numberOfLines={1}>
              {topTitle}
            </Text>
            <Ionicons
              name="chevron-down-outline"
              size={18}
              color={Palette.primary}
            />
          </Pressable>

          <Pressable style={styles.settingsButton} onPress={onPressSettings}>
            <Ionicons
              name="settings-outline"
              size={22}
              color={Palette.primary}
            />
          </Pressable>
        </View>

        <Text style={styles.updatedText}>Updated {updatedLabel}</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroCopyBlock}>
            <Text style={styles.heroMetricValue}>{heroMetric.value}</Text>
            <Text style={styles.heroTitle}>{statusBanner.title}</Text>
            <Text style={styles.heroSubtitle}>{statusBanner.subtitle}</Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons
              name="partly-sunny-outline"
              size={60}
              color={Palette.primary}
            />
          </View>

          <View style={styles.bannerActions}>
            <View
              style={[
                styles.statusChip,
                {
                  backgroundColor: bannerChipStyle.backgroundColor,
                  borderColor: bannerChipStyle.borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  { color: bannerChipStyle.textColor },
                ]}
              >
                {statusBanner.statusLabel}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onPressStatusAction}
              style={styles.darkChip}
            >
              <Text style={styles.darkChipText}>
                {statusBanner.actionLabel}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          {visibleMetrics.map((metric) => (
            <View
              key={metric.label}
              style={[
                styles.metricTile,
                metric.state === "loading" ? styles.metricTileLoading : null,
                metric.state === "stale" || metric.state === "estimated"
                  ? styles.metricTileStale
                  : null,
              ]}
            >
              <View style={styles.metricIconWrap}>
                <Ionicons
                  name={getMetricIcon(metric.label)}
                  size={24}
                  color={Palette.textSecondary}
                />
              </View>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              {metric.freshnessLabel ? (
                <Text style={styles.metricFreshness} numberOfLines={1}>
                  {metric.freshnessLabel}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.forecastCard}>
          <View style={styles.forecastHeaderRow}>
            {[
              ["precipitationProbability", "Precipitation"],
              ["windSpeed", "Wind"],
              ["airTemp", "Air Temp"],
            ].map(([mode, label]) => {
              const isActive = forecastMode === mode;

              return (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  onPress={() =>
                    setForecastMode(mode as RoadConditionChartMetric)
                  }
                  style={
                    isActive ? styles.forecastTabActive : styles.forecastTab
                  }
                >
                  <Text
                    style={
                      isActive
                        ? styles.forecastTabActiveText
                        : styles.forecastTabText
                    }
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <InteractiveRoadConditionChart
            points={roadHourly}
            metric={forecastMode}
            units={{ temperature: "F", windSpeed: "mph" }}
            isLoading={roadHourlyLoading}
          />
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>What we&apos;re monitoring</Text>

          <View style={styles.monitoringCard}>
            <Text style={styles.monitoringTitle}>{monitoringCard.title}</Text>
            <Text style={styles.monitoringBody}>{monitoringCard.body}</Text>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Monitored locations</Text>

          <View style={styles.locationCard}>
            <Pressable
              accessibilityRole="button"
              onPress={onPressMonitoredLocation}
              style={styles.locationCardHeader}
            >
              <Text style={styles.locationCardTitle}>
                {monitoredLocationCard.title}
              </Text>
              <Ionicons
                name="arrow-forward-outline"
                size={20}
                color={Palette.primary}
              />
            </Pressable>

            <View style={styles.bulletsList}>
              {monitoredLocationCard.bullets.map((bullet) => (
                <View key={bullet.id} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{bullet.text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.locationFooter}>
              <View
                style={[
                  styles.locationStatusChip,
                  {
                    backgroundColor: locationChipStyle.backgroundColor,
                    borderColor: locationChipStyle.borderColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.locationStatusText,
                    { color: locationChipStyle.textColor },
                  ]}
                >
                  {monitoredLocationCard.statusLabel}
                </Text>
              </View>

              <Text style={styles.impactText}>
                {monitoredLocationCard.impactLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={styles.primaryButton}
            onPress={onPressPrimaryAction}
          >
            <Text style={styles.primaryButtonText}>Open Conditions</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={onPressSecondaryAction}
          >
            <Text style={styles.secondaryButtonText}>Open Road</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  topBar: {
    backgroundColor: Palette.background,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(221, 227, 243, 0.75)",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 4,
  },
  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 28,
  },
  titleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "82%",
  },
  topTitle: {
    color: Palette.textPrimary,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 28,
    letterSpacing: -0.52,
  },
  settingsButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.16)",
  },
  updatedText: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 26,
  },
  card: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.85)",
    borderRadius: Radius.xl,
    paddingHorizontal: 18,
    paddingVertical: 18,
    ...Shadows.card,
  },
  heroCard: {
    minHeight: 214,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.72)",
    borderRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    overflow: "hidden",
    ...Shadows.card,
  },
  heroCopyBlock: {
    maxWidth: "64%",
  },
  heroMetricValue: {
    color: "#696A70",
    fontSize: 48,
    lineHeight: 54,
    fontWeight: "900",
    letterSpacing: -1.8,
  },
  heroTitle: {
    color: "#696A70",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
    letterSpacing: -0.35,
    marginTop: 12,
  },
  heroSubtitle: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.15,
    marginTop: 6,
  },
  heroIconWrap: {
    position: "absolute",
    right: 22,
    top: 58,
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.xl,
    backgroundColor: "rgba(86, 55, 255, 0.06)",
  },
  bannerTitle: {
    color: Palette.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 31,
    letterSpacing: -0.75,
  },
  bannerSubtitle: {
    color: Palette.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: -0.25,
    marginTop: 6,
  },
  bannerActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
    flexWrap: "wrap",
  },
  statusChip: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
  statusChipText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
    letterSpacing: -0.05,
  },
  darkChip: {
    minHeight: 32,
    paddingHorizontal: 13,
    borderRadius: Radius.pill,
    backgroundColor: Palette.midnight,
    justifyContent: "center",
  },
  darkChipText: {
    color: Palette.textOnDark,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
    letterSpacing: -0.05,
  },
  metricsCard: {
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 14,
    columnGap: 14,
  },
  metricCell: {
    width: "47%",
    minHeight: 40,
  },
  metricTile: {
    width: "30.7%",
    minHeight: 126,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.65)",
    borderRadius: Radius.lg,
    paddingHorizontal: 8,
    paddingVertical: 14,
  },
  metricTileLoading: {
    backgroundColor: "rgba(248, 250, 252, 0.88)",
  },
  metricTileStale: {
    borderColor: "rgba(202, 213, 226, 0.95)",
  },
  metricIconWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    marginBottom: 12,
  },
  metricValue: {
    color: "#8A8796",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.25,
    textAlign: "center",
  },
  metricLabel: {
    color: "#696A70",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 6,
  },
  metricFreshness: {
    color: Palette.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
    maxWidth: "100%",
  },
  forecastCard: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.72)",
    borderRadius: Radius.xl,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    overflow: "hidden",
    ...Shadows.card,
  },
  forecastHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  forecastTabActive: {
    flex: 1,
    minHeight: 38,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "rgba(105, 106, 112, 0.42)",
    backgroundColor: "rgba(105, 106, 112, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  forecastTab: {
    flex: 1,
    minHeight: 38,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "rgba(105, 106, 112, 0.42)",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  forecastTabActiveText: {
    color: Palette.textPrimary,
    fontSize: 12,
    fontWeight: "900",
  },
  forecastTabText: {
    color: "#74757D",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionCardTitle: {
    color: Palette.textPrimary,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.44,
    marginBottom: 12,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionHeading: {
    color: Palette.textPrimary,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "800",
    letterSpacing: -0.38,
  },
  monitoringCard: {
    backgroundColor: Palette.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.16)",
    borderRadius: Radius.xl,
    paddingHorizontal: 18,
    paddingVertical: 18,
    minHeight: 104,
    ...Shadows.soft,
  },
  monitoringTitle: {
    color: Palette.midnight,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: -0.42,
  },
  monitoringBody: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.15,
    marginTop: 6,
    maxWidth: "92%",
  },
  locationCard: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.xl,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    ...Shadows.card,
  },
  locationCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  locationCardTitle: {
    color: Palette.textPrimary,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: -0.42,
  },
  bulletsList: {
    gap: 6,
    marginBottom: 14,
    paddingRight: 18,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    color: Palette.primary,
    fontSize: 16,
    lineHeight: 20,
    marginTop: -1,
  },
  bulletText: {
    flex: 1,
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  locationFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  locationStatusChip: {
    minHeight: 28,
    paddingHorizontal: 14,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: "center",
  },
  locationStatusText: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: "500",
    letterSpacing: -0.15,
  },
  impactText: {
    color: Palette.textSecondary,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.soft,
  },
  primaryButtonText: {
    color: Palette.textOnDark,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    letterSpacing: -0.15,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: Palette.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    letterSpacing: -0.15,
  },
});
