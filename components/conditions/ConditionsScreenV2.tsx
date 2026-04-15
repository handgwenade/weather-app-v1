import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type HourlyConditionsRow = {
  id: string;
  time: string;
  temperature: string;
  condition: string;
  wind: string;
  precipitation: string;
};

function HourlyRow({ row }: { row: HourlyConditionsRow }) {
  return (
    <View style={styles.hourlyRow}>
      <Text style={styles.hourlyTime}>{row.time}</Text>
      <View style={styles.hourlyMain}>
        <Text style={styles.hourlyTemp}>{row.temperature}</Text>
        <Text style={styles.hourlyCondition}>{row.condition}</Text>
      </View>
      <View style={styles.hourlyMeta}>
        <Text style={styles.hourlyMetaText}>{row.wind}</Text>
        <Text style={styles.hourlyMetaText}>{row.precipitation}</Text>
      </View>
    </View>
  );
}

type ConditionsScreenV2Props = {
  locationName: string;
  updatedLabel: string;
  summaryText: string;
  takeawayText: string;
  rows: HourlyConditionsRow[];
  onPressSettings: () => void;
  onPressLocationSearch: () => void;
};

export default function ConditionsScreenV2({
  locationName,
  updatedLabel,
  summaryText,
  takeawayText,
  rows,
  onPressSettings,
  onPressLocationSearch,
}: ConditionsScreenV2Props) {
  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              onPress={onPressLocationSearch}
              style={styles.locationButton}
            >
              <Text style={styles.locationTitle}>{locationName}</Text>
              <Ionicons name="chevron-down" size={18} color="#0F172B" />
            </Pressable>
            <Pressable
              accessibilityLabel="Open settings"
              accessibilityRole="button"
              onPress={onPressSettings}
              style={styles.iconButton}
            >
              <Ionicons name="settings-outline" size={22} color="#475569" />
            </Pressable>
          </View>
          <Text style={styles.updatedText}>{updatedLabel}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{summaryText}</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.cardTitle}>Next 12 Hours</Text>

            {rows.length > 0 ? (
              <View style={styles.hourlyList}>
                {rows.map((row, index) => (
                  <View key={row.id}>
                    <HourlyRow row={row} />
                    {index < rows.length - 1 ? (
                      <View style={styles.hourlyDivider} />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.unavailableText}>
                Hourly forecast is unavailable right now.
              </Text>
            )}
          </View>

          <View style={styles.takeawayCard}>
            <Text style={styles.takeawayTitle}>Operational Takeaway</Text>
            <Text style={styles.takeawayText}>{takeawayText}</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    borderBottomWidth: 1,
    borderBottomColor: "#CAD5E2",
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 4,
    backgroundColor: "#FFFFFF",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationTitle: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "700",
    color: "#0F172B",
    letterSpacing: -0.44,
  },
  iconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  updatedText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#62748E",
    letterSpacing: -0.15,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: "#CAD5E2",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#314158",
    letterSpacing: -0.15,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: "#CAD5E2",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "700",
    color: "#0F172B",
    letterSpacing: -0.44,
    marginBottom: 12,
  },
  hourlyList: {
    gap: 0,
  },
  hourlyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  hourlyTime: {
    width: 52,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: "#0F172B",
  },
  hourlyMain: {
    flex: 1,
    gap: 2,
  },
  hourlyTemp: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: "#0F172B",
  },
  hourlyCondition: {
    fontSize: 13,
    lineHeight: 18,
    color: "#556274",
  },
  hourlyMeta: {
    alignItems: "flex-end",
    gap: 2,
  },
  hourlyMetaText: {
    fontSize: 12,
    lineHeight: 16,
    color: "#556274",
  },
  hourlyDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  unavailableText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#556274",
  },
  takeawayCard: {
    backgroundColor: "#1D293D",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 8,
  },
  takeawayTitle: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.44,
  },
  takeawayText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFF",
    letterSpacing: -0.15,
  },
});
