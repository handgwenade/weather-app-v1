import Ionicons from "@expo/vector-icons/Ionicons";
import AlertsScreenV2, {
  type AlertCardItem,
  type AlertTone,
} from "@/components/alerts/AlertsScreenV2";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getActiveAlertsForLocation } from "../../services/nws";
import { useSelectedLocation } from "../../data/locationStore";

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

function formatAlertCount(count: number, alertsAvailable: boolean) {
  if (!alertsAvailable) {
    return "Alerts unavailable";
  }

  return `${count} alert${count === 1 ? "" : "s"} active`;
}

function formatAlertTime(value?: string) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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

function mapFeatureToCard(feature: NwsAlertFeature, index: number): AlertCardItem {
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

export default function AlertsScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();

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

  if (!selectedLocation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FCFF" }}>
        <View style={{ flex: 1, backgroundColor: "#F9FCFF" }}>
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderBottomWidth: 1,
              borderBottomColor: "#CAD5E2",
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 14,
            }}
          >
            <View
              style={{
                minHeight: 28,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: "#0F172B",
                  fontSize: 18,
                  fontWeight: "700",
                  lineHeight: 28,
                  letterSpacing: -0.44,
                }}
              >
                Official Alerts
              </Text>

              <Pressable onPress={() => router.push("/settings")}>
                <Ionicons name="settings-outline" size={24} color="#2F5DA8" />
              </Pressable>
            </View>
          </View>

          <View
            style={{
              flex: 1,
              paddingHorizontal: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: "#0F172B",
                fontSize: 22,
                fontWeight: "700",
                lineHeight: 30,
                textAlign: "center",
              }}
            >
              No saved location selected
            </Text>
            <Text
              style={{
                color: "#556274",
                fontSize: 15,
                lineHeight: 22,
                textAlign: "center",
                marginTop: 8,
                maxWidth: 280,
              }}
            >
              Add a location to see local conditions here.
            </Text>
            <Pressable
              onPress={() => router.push("/manage-locations")}
              style={{
                marginTop: 20,
                minHeight: 44,
                borderRadius: 12,
                backgroundColor: "#2E6FC7",
                paddingHorizontal: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: "600",
                  lineHeight: 20,
                }}
              >
                Manage Locations
              </Text>
            </Pressable>
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
      fallbackMessage={
        alertsAvailable
          ? "No official alerts are active for this location right now."
          : "Official alerts are temporarily unavailable for this location."
      }
      footerNote="Official alerts from NWS and other agencies. Always use local observation and professional judgment."
      onPressSettings={() => router.push("/settings")}
    />
  );
}
