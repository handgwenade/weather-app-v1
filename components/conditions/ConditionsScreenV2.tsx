import { Palette, Radius, Shadows } from "@/constants/theme";
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
      <View style={styles.timelineRail}>
        <View style={styles.timelineDot} />
      </View>
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
              <Ionicons name="chevron-down" size={18} color={Palette.primary} />
            </Pressable>
            <Pressable
              accessibilityLabel="Open settings"
              accessibilityRole="button"
              onPress={onPressSettings}
              style={styles.iconButton}
            >
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
    backgroundColor: Palette.background,
  },
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  topBar: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(221, 227, 243, 0.75)",
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 4,
    backgroundColor: Palette.background,
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
    fontSize: 19,
    lineHeight: 28,
    fontWeight: "800",
    color: Palette.textPrimary,
    letterSpacing: -0.52,
  },
  iconButton: {
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
    fontSize: 13,
    lineHeight: 20,
    color: Palette.textSecondary,
    letterSpacing: -0.15,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 16,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.16)",
    borderRadius: Radius.xl,
    backgroundColor: Palette.primarySoft,
    paddingHorizontal: 18,
    paddingVertical: 18,
    ...Shadows.soft,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
    color: Palette.midnight,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.xl,
    backgroundColor: Palette.surface,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    ...Shadows.card,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "900",
    color: Palette.textPrimary,
    letterSpacing: -0.44,
    marginBottom: 12,
  },
  hourlyList: {
    backgroundColor: Palette.backgroundCool,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.85)",
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  hourlyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  timelineRail: {
    width: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    borderWidth: 2,
    borderColor: Palette.surface,
  },
  hourlyTime: {
    width: 52,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: Palette.textSecondary,
  },
  hourlyMain: {
    flex: 1,
    gap: 2,
  },
  hourlyTemp: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "900",
    color: Palette.primary,
    letterSpacing: -0.31,
  },
  hourlyCondition: {
    fontSize: 13,
    lineHeight: 18,
    color: Palette.textSecondary,
    fontWeight: "700",
  },
  hourlyMeta: {
    alignItems: "flex-end",
    gap: 2,
  },
  hourlyMetaText: {
    fontSize: 12,
    lineHeight: 16,
    color: Palette.textSecondary,
    fontWeight: "700",
  },
  hourlyDivider: {
    height: 1,
    backgroundColor: "rgba(221, 227, 243, 0.9)",
    marginLeft: 40,
  },
  unavailableText: {
    fontSize: 14,
    lineHeight: 20,
    color: Palette.textSecondary,
    fontWeight: "700",
  },
  takeawayCard: {
    backgroundColor: Palette.midnight,
    borderRadius: Radius.xl,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(72, 199, 244, 0.22)",
    ...Shadows.soft,
  },
  takeawayTitle: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "900",
    color: Palette.textOnDark,
    letterSpacing: -0.44,
  },
  takeawayText: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255, 255, 255, 0.88)",
    letterSpacing: -0.15,
  },
});
