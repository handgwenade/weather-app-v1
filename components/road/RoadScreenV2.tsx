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
        backgroundColor: "#FEE2E2",
        borderColor: "#FCA5A5",
        textColor: "#991B1B",
      };
    case "caution":
      return {
        backgroundColor: "#FEF3C7",
        borderColor: "#FCD34D",
        textColor: "#92400E",
      };
    case "good":
      return {
        backgroundColor: "#DCFCE7",
        borderColor: "#7BF1A8",
        textColor: "#0D542B",
      };
    default:
      return {
        backgroundColor: "#E2E8F0",
        borderColor: "#CBD5E1",
        textColor: "#334155",
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
            <Ionicons name="chevron-down-outline" size={20} color="#0F172B" />
          </Pressable>

          <Pressable style={styles.settingsButton} onPress={onPressSettings}>
            <Ionicons name="settings-outline" size={24} color="#2F5DA8" />
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
            <Ionicons name="location-outline" size={18} color="#475569" />
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
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#CAD5E2",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
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
    color: "#0F172B",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.44,
  },
  settingsButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  updatedText: {
    color: "#62748E",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  noticeStack: {
    gap: 8,
  },
  noticeCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noticeText: {
    color: "#92400E",
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(202, 213, 226, 0.4)",
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 16,
  },
  cardTitle: {
    color: "#0F172B",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 27,
    letterSpacing: -0.44,
  },
  searchField: {
    marginTop: 12,
    minHeight: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#CAD5E2",
    backgroundColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  searchFieldText: {
    flex: 1,
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  statusTitle: {
    color: "#0F172B",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    letterSpacing: -0.45,
  },
  statusSubtitle: {
    color: "#45556C",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.31,
    marginTop: 2,
  },
  statusActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  statusChip: {
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  actionChip: {
    height: 32,
    borderRadius: 10,
    backgroundColor: "#1D293D",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChipText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  recommendationCard: {
    backgroundColor: "#1D293D",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 17,
  },
  recommendationTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 27,
    letterSpacing: -0.44,
  },
  recommendationText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
    marginTop: 8,
  },
  conditionsCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(202, 213, 226, 0.4)",
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 16,
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
  },
  metricLabel: {
    color: "#62748E",
    fontSize: 12,
    lineHeight: 16,
  },
  metricValue: {
    color: "#0F172B",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
    letterSpacing: -0.31,
    marginTop: 0,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionTitle: {
    color: "#0F172B",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 27,
    letterSpacing: -0.44,
  },
  riskCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(202, 213, 226, 0.4)",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  riskLevel: {
    color: "#45556C",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
    marginTop: 2,
  },
  bulletList: {
    gap: 4,
    marginTop: 12,
  },
  bulletText: {
    color: "#314158",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  riskFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  confidenceText: {
    color: "#62748E",
    fontSize: 12,
    lineHeight: 16,
  },
  outlookRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },
  outlookItem: {
    width: 60,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  outlookTime: {
    color: "#62748E",
    fontSize: 12,
    lineHeight: 16,
  },
  outlookTemp: {
    color: "#0F172B",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
    letterSpacing: -0.31,
    marginTop: 4,
  },
  outlookCondition: {
    color: "#45556C",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
});
