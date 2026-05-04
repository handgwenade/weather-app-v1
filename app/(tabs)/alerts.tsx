import AlertsScreenV2, {
  type AlertCardItem,
  type AlertTone,
} from "@/components/alerts/AlertsScreenV2";
import { Palette, Radius, Shadows } from "@/constants/theme";
import { useSelectedLocation } from "@/data/locationStore";
import { getActiveAlertsForLocation } from "@/services/nws";
import { formatMonthDayTime24Hour } from "@/utils/dateTime";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type NwsAlertFeature = {
  id?: string;
  properties?: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    certainty?: string;
    effective?: string;
    onset?: string;
    ends?: string;
    expires?: string;
    headline?: string;
    description?: string;
    senderName?: string;
  };
};

type UseAlertsScreenDataResult = {
  alerts: AlertCardItem[];
  alertsAvailable: boolean;
};

function formatAlertCount(count: number, alertsAvailable: boolean) {
  if (!alertsAvailable) {
    return "Alerts unavailable";
  }

  return `${count} alert${count === 1 ? "" : "s"} active`;
}

function formatAlertTime(value?: string) {
  return formatMonthDayTime24Hour(value) ?? "Not available";
}

function getAlertTone(
  severity?: string,
  certainty?: string,
  event?: string,
): AlertTone {
  const severityValue = severity?.toLowerCase() ?? "";
  const certaintyValue = certainty?.toLowerCase() ?? "";
  const eventValue = event?.toLowerCase() ?? "";

  if (
    severityValue === "severe" ||
    severityValue === "extreme" ||
    eventValue.includes("warning")
  ) {
    return "warning";
  }

  if (eventValue.includes("watch") || certaintyValue === "possible") {
    return "watch";
  }

  if (eventValue.includes("advisory") || severityValue === "moderate") {
    return "advisory";
  }

  return "neutral";
}

function getBadgeLabel(event?: string, severity?: string) {
  const eventValue = event?.toLowerCase() ?? "";

  if (eventValue.includes("warning")) {
    return "Warning";
  }

  if (eventValue.includes("watch")) {
    return "Watch";
  }

  if (eventValue.includes("advisory")) {
    return "Advisory";
  }

  if (severity) {
    return severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
  }

  return "Alert";
}

function buildAlertSummary(properties: NwsAlertFeature["properties"]) {
  const headline = properties?.headline?.trim();

  if (headline) {
    return headline.replace(/\s+/g, " ");
  }

  const description = properties?.description?.trim();

  if (!description) {
    return "Official details available from the alert source.";
  }

  const firstLine = description
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "Official details available from the alert source.";
  }

  return firstLine.replace(/\s+/g, " ");
}

function mapFeatureToCard(
  feature: NwsAlertFeature,
  index: number,
): AlertCardItem {
  const properties = feature.properties ?? {};
  const tone = getAlertTone(
    properties.severity,
    properties.certainty,
    properties.event,
  );

  return {
    id: feature.id ?? `${properties.event ?? "alert"}-${index}`,
    tone,
    badgeLabel: getBadgeLabel(properties.event, properties.severity),
    title: properties.event ?? "Official alert",
    area: properties.areaDesc ?? "Area not specified",
    starts: formatAlertTime(properties.onset ?? properties.effective),
    ends: formatAlertTime(properties.ends ?? properties.expires),
    summary: buildAlertSummary(properties),
    source: properties.senderName?.trim() || "Official agency",
  };
}

function useAlertsScreenData(
  selectedLocation: ReturnType<typeof useSelectedLocation>,
): UseAlertsScreenDataResult {
  const [alerts, setAlerts] = useState<AlertCardItem[]>([]);
  const [alertsAvailable, setAlertsAvailable] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadAlerts() {
      if (!selectedLocation) {
        setAlerts([]);
        setAlertsAvailable(true);
        return;
      }

      try {
        const data = await getActiveAlertsForLocation(
          selectedLocation.latitude,
          selectedLocation.longitude,
        );

        if (!isActive) {
          return;
        }

        const features = Array.isArray(data.features)
          ? (data.features as NwsAlertFeature[])
          : [];

        setAlerts(features.map(mapFeatureToCard));
        setAlertsAvailable(true);
      } catch (error) {
        console.log("Alerts screen fetch failed:", error);

        if (!isActive) {
          return;
        }

        setAlerts([]);
        setAlertsAvailable(false);
      }
    }

    void loadAlerts();

    return () => {
      isActive = false;
    };
  }, [selectedLocation]);

  return {
    alerts,
    alertsAvailable,
  };
}

export default function AlertsScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();

  const { alerts, alertsAvailable } = useAlertsScreenData(selectedLocation);
  const fallbackMessage = alertsAvailable
    ? "No official alerts are active for this location right now."
    : "Official alerts are temporarily unavailable for this location.";

  if (!selectedLocation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Official Alerts</Text>

              <Pressable
                accessibilityLabel="Open settings"
                accessibilityRole="button"
                onPress={() => router.push("/settings")}
                style={styles.settingsButton}
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={Palette.primary}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.emptyStateWrap}>
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name="notifications-outline"
                  size={28}
                  color={Palette.primary}
                />
              </View>
              <Text style={styles.emptyStateTitle}>
                No active location selected
              </Text>
              <Text style={styles.emptyStateBody}>
                Choose a location to see official alerts for your area.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/manage-locations")}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Choose Location</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AlertsScreenV2
      title="Official Alerts"
      subtitle={formatAlertCount(alerts.length, alertsAvailable)}
      alerts={alerts}
      fallbackMessage={fallbackMessage}
      footerNote="Official alerts from NWS and other agencies. Always use local observation and professional judgment."
      onPressSettings={() => router.push("/settings")}
    />
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
  header: {
    backgroundColor: Palette.background,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(221, 227, 243, 0.75)",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
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
  emptyStateWrap: {
    flex: 1,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: "rgba(221, 227, 243, 0.9)",
    borderRadius: Radius.xl,
    paddingHorizontal: 24,
    paddingVertical: 28,
    ...Shadows.card,
  },
  emptyIconWrap: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.16)",
    marginBottom: 14,
  },
  emptyStateTitle: {
    color: Palette.textPrimary,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 30,
    letterSpacing: -0.55,
    textAlign: "center",
  },
  emptyStateBody: {
    color: Palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 280,
  },
  primaryButton: {
    marginTop: 22,
    minHeight: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    borderWidth: 1,
    borderColor: "rgba(86, 55, 255, 0.2)",
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.soft,
  },
  primaryButtonText: {
    color: Palette.textOnDark,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
    letterSpacing: -0.15,
  },
});
