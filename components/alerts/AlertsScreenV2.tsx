import Ionicons from "@expo/vector-icons/Ionicons";
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
        backgroundColor: "#FFE2E2",
        borderColor: "#FFA2A2",
        textColor: "#82181A",
      };
    case "advisory":
      return {
        backgroundColor: "#FEF9C2",
        borderColor: "#FFDF20",
        textColor: "#733E0A",
      };
    case "watch":
      return {
        backgroundColor: "#DBEAFE",
        borderColor: "#93C5FD",
        textColor: "#1D4ED8",
      };
    default:
      return {
        backgroundColor: "#F1F5F9",
        borderColor: "#CAD5E2",
        textColor: "#45556C",
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
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.screenTitle}>{title}</Text>
            <Text style={styles.screenSubtitle}>{subtitle}</Text>
          </View>

          <Pressable style={styles.settingsButton} onPress={onPressSettings}>
            <Ionicons name="settings-outline" size={24} color="#2F5DA8" />
          </Pressable>
        </View>
      </View>

      <ScrollView
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
                      <Text style={[styles.badgeText, { color: badgeStyle.textColor }]}>
                        {alert.badgeLabel}
                      </Text>
                    </View>

                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text style={styles.alertArea}>{alert.area}</Text>
                  </View>

                  <Ionicons
                    name="chevron-down-outline"
                    size={20}
                    color="#94A3B8"
                  />
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
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#CAD5E2",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
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
    color: "#0F172B",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    letterSpacing: -0.45,
  },
  screenSubtitle: {
    color: "#45556C",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
    marginTop: 0,
  },
  settingsButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  alertCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#CAD5E2",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  alertCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  alertCopy: {
    flex: 1,
  },
  badge: {
    alignSelf: "flex-start",
    minHeight: 26,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 9,
    justifyContent: "center",
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  alertTitle: {
    color: "#0F172B",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 27,
    letterSpacing: -0.44,
  },
  alertArea: {
    color: "#45556C",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
    marginTop: 4,
  },
  timeRow: {
    flexDirection: "row",
    gap: 18,
    marginTop: 16,
  },
  timeCell: {
    flex: 1,
  },
  timeLabel: {
    color: "#62748E",
    fontSize: 12,
    lineHeight: 16,
  },
  timeValue: {
    color: "#0F172B",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
    fontWeight: "500",
    marginTop: 0,
  },
  summaryText: {
    color: "#314158",
    fontSize: 14,
    lineHeight: 20,
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
    color: "#62748E",
    fontSize: 12,
    lineHeight: 16,
  },
  sourceValue: {
    color: "#314158",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  infoCard: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BEDBFF",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 12,
  },
  infoText: {
    color: "#1C398E",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
});
