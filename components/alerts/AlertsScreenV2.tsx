import { Palette, Radius, Shadows } from "@/constants/theme";
import { useScrollToTopOnFocus } from "@/hooks/useScrollToTopOnFocus";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type AlertTone = "warning" | "advisory" | "watch" | "neutral";

export type AlertCardItem = {
  id: string;
  tone: AlertTone;
  badgeLabel: string;
  title: string;
  area: string;
  starts: string;
  ends: string;
  summary: string;
  source: string;
};

type AlertsScreenV2Props = {
  title: string;
  subtitle: string;
  alerts: AlertCardItem[];
  footerNote: string;
  fallbackMessage?: string;
  onPressSettings: () => void;
};

function getBadgeStyle(tone: AlertTone) {
  switch (tone) {
    case "warning":
      return {
        backgroundColor: "#FCE7F0",
        borderColor: "#F5A3BD",
        textColor: Palette.high,
      };
    case "advisory":
      return {
        backgroundColor: "#FFF7D6",
        borderColor: Palette.caution,
        textColor: "#8A4B00",
      };
    case "watch":
      return {
        backgroundColor: Palette.primarySoft,
        borderColor: "rgba(86, 55, 255, 0.18)",
        textColor: Palette.primary,
      };
    default:
      return {
        backgroundColor: Palette.surfaceSoft,
        borderColor: Palette.border,
        textColor: Palette.midnight,
      };
  }
}

export default function AlertsScreenV2({
  title,
  subtitle,
  alerts,
  footerNote,
  fallbackMessage,
  onPressSettings,
}: AlertsScreenV2Props) {
  const scrollViewRef = useRef<ScrollView>(null);

  useScrollToTopOnFocus(scrollViewRef);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.screenTitle}>{title}</Text>
            <Text style={styles.screenSubtitle}>{subtitle}</Text>
          </View>

          <Pressable style={styles.settingsButton} onPress={onPressSettings}>
            <Ionicons
              name="settings-outline"
              size={22}
              color={Palette.primary}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        {alerts.length > 0 ? (
          alerts.map((alert) => {
            const badgeStyle = getBadgeStyle(alert.tone);

            return (
              <View key={alert.id} style={styles.alertCard}>
                <View style={styles.alertCardHeader}>
                  <View style={styles.alertCopy}>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: badgeStyle.backgroundColor,
                          borderColor: badgeStyle.borderColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: badgeStyle.textColor },
                        ]}
                      >
                        {alert.badgeLabel}
                      </Text>
                    </View>

                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text style={styles.alertArea}>{alert.area}</Text>
                  </View>
                </View>

                <View style={styles.timeRow}>
                  <View style={styles.timeCell}>
                    <Text style={styles.timeLabel}>Starts</Text>
                    <Text style={styles.timeValue}>{alert.starts}</Text>
                  </View>

                  <View style={styles.timeCell}>
                    <Text style={styles.timeLabel}>Ends</Text>
                    <Text style={styles.timeValue}>{alert.ends}</Text>
                  </View>
                </View>

                <Text style={styles.summaryText}>{alert.summary}</Text>

                <View style={styles.sourceRow}>
                  <Text style={styles.sourceLabel}>Source:</Text>
                  <Text style={styles.sourceValue}>{alert.source}</Text>
                </View>
              </View>
            );
          })
        ) : fallbackMessage ? (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>No official alerts</Text>
            <Text style={styles.summaryText}>{fallbackMessage}</Text>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>{footerNote}</Text>
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
  },
  topBarRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleBlock: {
    flex: 1,
    marginRight: 12,
  },
  screenTitle: {
    color: Palette.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 31,
    letterSpacing: -0.75,
  },
  screenSubtitle: {
    color: Palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.2,
    marginTop: 0,
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
  scrollView: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 16,
  },
  alertCard: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.xl,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    ...Shadows.card,
  },
  alertCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  alertCopy: {
    flex: 1,
  },
  badge: {
    alignSelf: "flex-start",
    minHeight: 28,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 11,
    justifyContent: "center",
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  alertTitle: {
    color: Palette.textPrimary,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  alertArea: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
    marginTop: 4,
  },
  timeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  timeCell: {
    flex: 1,
    backgroundColor: Palette.backgroundCool,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.8)",
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeLabel: {
    color: Palette.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  timeValue: {
    color: Palette.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
    fontWeight: "800",
    marginTop: 2,
  },
  summaryText: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.15,
    marginTop: 16,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  sourceLabel: {
    color: Palette.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  sourceValue: {
    color: Palette.midnight,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  infoCard: {
    backgroundColor: Palette.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.16)",
    borderRadius: Radius.xl,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 14,
  },
  infoText: {
    color: Palette.midnight,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    letterSpacing: -0.15,
  },
});
