import { Palette, Radius, Shadows } from "@/constants/theme";
import { useScrollToTopOnFocus } from "@/hooks/useScrollToTopOnFocus";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type HomeIconName = ComponentProps<typeof Ionicons>["name"];

type Tone = "good" | "neutral" | "warning" | "alert";

export type HomeMetric = {
  label: string;
  value: string;
};

export type HomeOutlookItem = {
  id: string;
  time: string;
  temperature: string;
  condition: string;
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
  outlookItems: HomeOutlookItem[];
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

export default function HomeScreenV2({
  topTitle,
  updatedLabel,
  statusBanner,
  metrics,
  outlookItems,
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
  const locationChipStyle = getStatusChipStyle(
    monitoredLocationCard.statusTone,
  );
  const scrollViewRef = useRef<ScrollView>(null);

  useScrollToTopOnFocus(scrollViewRef);

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
        <View style={styles.card}>
          <Text style={styles.bannerTitle}>{statusBanner.title}</Text>
          <Text style={styles.bannerSubtitle}>{statusBanner.subtitle}</Text>

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

        <View style={styles.metricsCard}>
          <View style={styles.metricsGrid}>
            {metrics.map((metric) => (
              <View key={metric.label} style={styles.metricCell}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{metric.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionCardTitle}>12-Hour Outlook</Text>

          <View style={styles.outlookRow}>
            {outlookItems.map((item) => (
              <View key={item.id} style={styles.outlookItem}>
                <Text style={styles.outlookTime}>{item.time}</Text>
                <Text style={styles.outlookTemp}>{item.temperature}</Text>
                <Text style={styles.outlookCondition} numberOfLines={2}>
                  {item.condition}
                </Text>
              </View>
            ))}
          </View>
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
    gap: 18,
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
    marginTop: 12,
  },
  statusChip: {
    minHeight: 32,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
  statusChipText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    letterSpacing: -0.15,
  },
  darkChip: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Palette.midnight,
    justifyContent: "center",
  },
  darkChipText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    letterSpacing: -0.15,
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
    rowGap: 12,
    columnGap: 12,
  },
  metricCell: {
    width: "47%",
    minHeight: 40,
  },
  metricLabel: {
    color: Palette.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  metricValue: {
    color: Palette.textPrimary,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "800",
    letterSpacing: -0.35,
    marginTop: 2,
  },
  sectionCardTitle: {
    color: Palette.textPrimary,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.44,
    marginBottom: 12,
  },
  outlookRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  outlookItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    backgroundColor: Palette.backgroundCool,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  outlookTime: {
    color: Palette.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    fontWeight: "700",
  },
  outlookTemp: {
    color: Palette.primary,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: -0.31,
    textAlign: "center",
    marginTop: 4,
  },
  outlookCondition: {
    color: Palette.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 4,
    width: "100%",
  },
  sectionBlock: {
    gap: 12,
  },
  sectionHeading: {
    color: Palette.textPrimary,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.44,
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
    fontSize: 19,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
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
    fontSize: 19,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
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
