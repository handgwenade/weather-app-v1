import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type SettingsDefaultView = "home" | "conditions" | "road";

type SettingsScreenV2Props = {
  defaultView: SettingsDefaultView;
  showConfidenceLevels: boolean;
  autoRefreshData: boolean;
  versionText: string;
  lastSyncText: string;
  onPressClose: () => void;
  onPressManageOperationalLocations: () => void;
  onSelectDefaultView: (value: SettingsDefaultView) => void;
  onToggleShowConfidenceLevels: () => void;
  onToggleAutoRefreshData: () => void;
};

type RadioOption = {
  id: SettingsDefaultView;
  label: string;
};

const RADIO_OPTIONS: RadioOption[] = [
  { id: "home", label: "Home (Snapshot)" },
  { id: "conditions", label: "Conditions (Graph)" },
  { id: "road", label: "Road (Point Detail)" },
];

export default function SettingsScreenV2({
  defaultView,
  showConfidenceLevels,
  autoRefreshData,
  versionText,
  lastSyncText,
  onPressClose,
  onPressManageOperationalLocations,
  onSelectDefaultView,
  onToggleShowConfidenceLevels,
  onToggleAutoRefreshData,
}: SettingsScreenV2Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <Text style={styles.topTitle}>Settings</Text>

          <Pressable style={styles.closeButton} onPress={onPressClose}>
            <Ionicons name="close-outline" size={24} color="#F8FAFC" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="location-outline" size={24} color="#64748B" />
          </View>

          <Text style={styles.heroTitle}>Operational Locations</Text>
          <Text style={styles.heroBody}>
            Add locations to quickly monitor key corridors, trouble spots, and
            shop areas.
          </Text>

          <Pressable
            style={styles.heroButton}
            onPress={onPressManageOperationalLocations}
          >
            <Text style={styles.heroButtonText}>
              Manage operational locations
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Default Operational View</Text>

          <View style={styles.radioList}>
            {RADIO_OPTIONS.map((option) => {
              const selected = option.id === defaultView;

              return (
                <Pressable
                  key={option.id}
                  style={styles.radioRow}
                  onPress={() => onSelectDefaultView(option.id)}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      selected ? styles.radioOuterSelected : null,
                    ]}
                  >
                    {selected ? <View style={styles.radioInner} /> : null}
                  </View>

                  <Text
                    style={[
                      styles.radioLabel,
                      selected ? styles.radioLabelSelected : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Display Options</Text>

          <View style={styles.toggleList}>
            <Pressable
              style={styles.toggleRow}
              onPress={onToggleShowConfidenceLevels}
            >
              <Text style={styles.toggleLabel}>Show confidence levels</Text>

              <View style={styles.checkboxShell}>
                {showConfidenceLevels ? (
                  <Ionicons name="checkmark" size={18} color="#2E6FC7" />
                ) : null}
              </View>
            </Pressable>

            <Pressable
              style={styles.toggleRow}
              onPress={onToggleAutoRefreshData}
            >
              <Text style={styles.toggleLabel}>Auto-refresh data</Text>

              <View
                style={[
                  styles.checkboxShell,
                  autoRefreshData ? styles.checkboxShellActive : null,
                ]}
              >
                {autoRefreshData ? (
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                ) : null}
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Version</Text>
            <Text style={styles.metaValue}>{versionText}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Last Data Sync</Text>
            <Text style={styles.metaValue}>{lastSyncText}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#334155",
  },
  topBar: {
    backgroundColor: "#334155",
    borderBottomWidth: 1,
    borderBottomColor: "#CAD5E2",
    paddingHorizontal: 16,
    minHeight: 60,
    justifyContent: "center",
  },
  topBarRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitle: {
    color: "#F0F8FE",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 28,
    letterSpacing: -0.44,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#334155",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CAD5E2",
    borderRadius: 10,
    minHeight: 257,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 34,
    alignItems: "center",
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    color: "#1C304F",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 27,
    letterSpacing: -0.44,
    textAlign: "center",
    marginTop: 20,
  },
  heroBody: {
    color: "#45556C",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 320,
  },
  heroButton: {
    marginTop: 16,
    minHeight: 40,
    borderRadius: 38,
    backgroundColor: "#1D293D",
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  heroButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
    letterSpacing: -0.31,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CAD5E2",
    borderRadius: 10,
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 16,
  },
  cardTitle: {
    color: "#1C304F",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 27,
    letterSpacing: -0.44,
  },
  radioList: {
    gap: 8,
    marginTop: 12,
  },
  radioRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: "#3573C9",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: "#3573C9",
  },
  radioLabel: {
    color: "#1C304F",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
    letterSpacing: -0.31,
  },
  radioLabelSelected: {
    fontWeight: "700",
  },
  toggleList: {
    gap: 12,
    marginTop: 12,
  },
  toggleRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleLabel: {
    color: "#1C304F",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
    letterSpacing: -0.31,
  },
  checkboxShell: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxShellActive: {
    backgroundColor: "#3573C9",
    borderColor: "#3573C9",
  },
  metaCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CAD5E2",
    borderRadius: 10,
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 16,
    gap: 8,
  },
  metaRow: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metaLabel: {
    color: "#45556C",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  metaValue: {
    color: "#1C304F",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    letterSpacing: -0.15,
  },
});
