import { Palette, Radius, Shadows } from "@/constants/theme";
import { useScrollToTopOnFocus } from "@/hooks/useScrollToTopOnFocus";
import Ionicons from "@expo/vector-icons/Ionicons";
import { type ReactNode, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type RoadTone = "good" | "caution" | "high" | "neutral";
export type RoadActionDestination = "details" | "alerts" | "conditions";

export type RoadMetric = {
  id: string;
  label: string;
  value: string;
};

export type RoadBullet = {
  id: string;
  text: string;
};

export type RoadOutlookItem = {
  id: string;
  time: string;
  temperature: string;
  condition: string;
};

type RoadScreenV2Props = {
  topTitle: string;
  updatedLabel: string;
  notices: string[];
  locationFieldLabel: string;
  onPressSettings: () => void;
  onPressLocationSearch: () => void;
  statusTitle: string;
  statusSubtitle: string;
  statusLabel: string;
  statusTone: RoadTone;
  actionLabel: string;
  actionDestination: RoadActionDestination;
  onPressAction: () => void;
  recommendationText: string;
  currentConditions: RoadMetric[];
  riskLevelLabel: string;
  riskBullets: RoadBullet[];
  confidenceLabel: string;
  outlookItems: RoadOutlookItem[];
  extraSection?: ReactNode;
};

function getStatusChipStyle(tone: RoadTone) {
  switch (tone) {
    case "high":
      return {
        backgroundColor: "#FCE7F0",
        borderColor: "#F5A3BD",
        textColor: Palette.high,
      };
    case "caution":
      return {
        backgroundColor: "#FFF7D6",
        borderColor: Palette.caution,
        textColor: "#8A4B00",
      };
    case "good":
      return {
        backgroundColor: "#DFFBEF",
        borderColor: "#8EF0C2",
        textColor: "#087A4A",
      };
    default:
      return {
        backgroundColor: Palette.surfaceSoft,
        borderColor: Palette.border,
        textColor: Palette.midnight,
      };
  }
}

export default function RoadScreenV2({
  topTitle,
  updatedLabel,
  notices,
  locationFieldLabel,
  onPressSettings,
  onPressLocationSearch,
  statusTitle,
  statusSubtitle,
  statusLabel,
  statusTone,
  actionLabel,
  actionDestination,
  onPressAction,
  recommendationText,
  currentConditions,
  riskLevelLabel,
  riskBullets,
  confidenceLabel,
  outlookItems,
  extraSection,
}: RoadScreenV2Props) {
  const statusChipStyle = getStatusChipStyle(statusTone);
  const scrollViewRef = useRef<ScrollView>(null);
  const [detailsSectionY, setDetailsSectionY] = useState(0);

  useScrollToTopOnFocus(scrollViewRef);

  function handleActionPress() {
    if (actionDestination === "details") {
      scrollViewRef.current?.scrollTo({
        y: Math.max(detailsSectionY - 16, 0),
        animated: true,
      });
      return;
    }

    onPressAction();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <Pressable
            style={styles.topTitleButton}
            onPress={onPressLocationSearch}
          >
            <Text style={styles.topTitle} numberOfLines={1}>
              {topTitle}
            </Text>
            <Ionicons
              name="chevron-down-outline"
              size={20}
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

        <Text style={styles.updatedText}>{updatedLabel}</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        {notices.length > 0 ? (
          <View style={styles.noticeStack}>
            {notices.map((notice) => (
              <View key={notice} style={styles.noticeCard}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location</Text>

          <Pressable style={styles.searchField} onPress={onPressLocationSearch}>
            <Ionicons
              name="location-outline"
              size={18}
              color={Palette.primary}
            />
            <Text style={styles.searchFieldText} numberOfLines={1}>
              {locationFieldLabel}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.statusTitle}>{statusTitle}</Text>
          <Text style={styles.statusSubtitle}>{statusSubtitle}</Text>

          <View style={styles.statusActions}>
            <View
              style={[
                styles.statusChip,
                {
                  backgroundColor: statusChipStyle.backgroundColor,
                  borderColor: statusChipStyle.borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  { color: statusChipStyle.textColor },
                ]}
              >
                {statusLabel}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={handleActionPress}
              style={styles.actionChip}
            >
              <Text style={styles.actionChipText}>{actionLabel}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.recommendationCard}>
          <Text style={styles.recommendationTitle}>Recommendation</Text>
          <Text style={styles.recommendationText}>{recommendationText}</Text>
        </View>

        <View
          style={styles.conditionsCard}
          onLayout={(event) => {
            setDetailsSectionY(event.nativeEvent.layout.y);
          }}
        >
          <Text style={styles.cardTitle}>Current Road Conditions</Text>

          <View style={styles.conditionsGrid}>
            {currentConditions.map((item) => (
              <View key={item.id} style={styles.metricCell}>
                <Text style={styles.metricLabel}>{item.label}</Text>
                <Text style={styles.metricValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Risk Assessment</Text>

          <View style={styles.riskCard}>
            <Text style={styles.cardTitle}>Weather-based road risk</Text>
            <Text style={styles.riskLevel}>{riskLevelLabel}</Text>

            <View style={styles.bulletList}>
              {riskBullets.map((bullet) => (
                <Text key={bullet.id} style={styles.bulletText}>
                  • {bullet.text}
                </Text>
              ))}
            </View>

            <View style={styles.riskFooter}>
              <Pressable
                accessibilityRole="button"
                onPress={handleActionPress}
                style={styles.actionChip}
              >
                <Text style={styles.actionChipText}>{actionLabel}</Text>
              </Pressable>

              <Text style={styles.confidenceText}>{confidenceLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>12-Hour Road Outlook</Text>

          <View style={styles.outlookRow}>
            {outlookItems.map((item) => (
              <View key={item.id} style={styles.outlookItem}>
                <Text style={styles.outlookTime}>{item.time}</Text>
                <Text style={styles.outlookTemp}>{item.temperature}</Text>
                <Text style={styles.outlookCondition}>{item.condition}</Text>
              </View>
            ))}
          </View>
        </View>

        {extraSection ? extraSection : null}
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
  },
  topTitleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    marginRight: 12,
  },
  topTitle: {
    color: Palette.textPrimary,
    fontSize: 19,
    fontWeight: "800",
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
    gap: 16,
  },
  noticeStack: {
    gap: 8,
  },
  noticeCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.caution,
    backgroundColor: "#FFF7D6",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noticeText: {
    color: "#8A4B00",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.85)",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 17,
    ...Shadows.card,
  },
  cardTitle: {
    color: Palette.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 27,
    letterSpacing: -0.44,
  },
  searchField: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.backgroundCool,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  searchFieldText: {
    flex: 1,
    color: Palette.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  statusTitle: {
    color: Palette.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 31,
    letterSpacing: -0.75,
  },
  statusSubtitle: {
    color: Palette.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: -0.25,
    marginTop: 6,
  },
  statusActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  statusChip: {
    height: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  actionChip: {
    height: 34,
    borderRadius: Radius.pill,
    backgroundColor: Palette.midnight,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChipText: {
    color: Palette.textOnDark,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  recommendationCard: {
    backgroundColor: Palette.midnight,
    borderRadius: Radius.xl,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 19,
    borderWidth: 1,
    borderColor: "rgba(72, 199, 244, 0.22)",
    ...Shadows.soft,
  },
  recommendationTitle: {
    color: Palette.textOnDark,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 27,
    letterSpacing: -0.44,
  },
  recommendationText: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.15,
    marginTop: 8,
  },
  conditionsCard: {
    backgroundColor: Palette.surfaceRaised,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.9)",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 17,
  },
  conditionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    rowGap: 12,
    columnGap: 12,
  },
  metricCell: {
    width: "47%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.85)",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  metricLabel: {
    color: Palette.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  metricValue: {
    color: Palette.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: -0.31,
    marginTop: 3,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionTitle: {
    color: Palette.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 27,
    letterSpacing: -0.44,
  },
  riskCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.85)",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 17,
    ...Shadows.card,
  },
  riskLevel: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.15,
    marginTop: 4,
  },
  bulletList: {
    gap: 4,
    marginTop: 12,
  },
  bulletText: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.15,
  },
  riskFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  confidenceText: {
    color: Palette.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  outlookRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },
  outlookItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: Palette.backgroundCool,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  outlookTime: {
    color: Palette.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  outlookTemp: {
    color: Palette.primary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 24,
    letterSpacing: -0.31,
    marginTop: 4,
  },
  outlookCondition: {
    color: Palette.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    textAlign: "center",
  },
});
