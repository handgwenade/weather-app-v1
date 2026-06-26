import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import HomeScreenV2 from "@/components/home/HomeScreenV2";
import QuickSwitchModal from "@/components/quickSwitchModal";
import {
    setSelectedLocation,
    usePropertyLocation,
    useSavedLocations,
    useSelectedLocation,
} from "@/data/locationStore";
import { useHomeScreenData } from "@/hooks/useHomeScreenData";
import { buildHomeRoadHourlyPoints } from "@/utils/homeRoadHourly";
import { buildHomeViewModel, type HomeViewModel } from "@/utils/homeViewModel";
import {
    getTopTitle,
    hasUsableHomeRoadObservation,
} from "@/utils/homeWeatherFormatting";
import type { RoadConditionChartPoint } from "@/utils/roadConditionChart";
import {
    evaluateSuggestions,
    SuggestionCode,
    type SuggestionDecision,
    type SuggestionInput,
} from "@/utils/suggestions";

function getHomeSuggestionRoute(code?: SuggestionCode | null) {
  switch (code) {
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return "/alerts";
    case SuggestionCode.ROAD_CLOSED:
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
    case SuggestionCode.DRIFTING_CONCERN:
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
      return "/road";
    case SuggestionCode.HIGH_WIND_CAUTION:
    case SuggestionCode.USE_CAUTION:
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
    case SuggestionCode.FREEZE_RISK_TONIGHT:
    default:
      return "/conditions";
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();
  const savedLocations = useSavedLocations();
  const propertyLocation = usePropertyLocation();

  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const {
    currentWeather,
    hourlyForecast,
    alertSummary,
    propertyRisk,
    propertyForecastLowF,
    roadReport,
    hourlyState,
    roadState,
    roadReady,
    suggestionsReady,
  } = useHomeScreenData(selectedLocation, propertyLocation);

  const topTitle = useMemo(() => {
    if (!selectedLocation) {
      return null;
    }

    return getTopTitle(roadReport, selectedLocation.name);
  }, [roadReport, selectedLocation]);
  const suggestionInput = useMemo<SuggestionInput | null>(() => {
    if (!selectedLocation || !suggestionsReady) {
      return null;
    }

    const observation = roadReport?.primaryStationObservation ?? null;
    const roadStillLoading = !roadReady;
    const effectiveWeatherTemperatureF =
      currentWeather.temperatureF ?? observation?.airTempF ?? null;
    const effectiveWeatherWindSpeedMph =
      currentWeather.windSpeedMph ??
      observation?.windAvgMph ??
      observation?.windGustMph ??
      null;
    const effectiveWeatherObservedAt =
      currentWeather.sourceTimestamp ??
      observation?.observedAt ??
      roadReport?.fetchedAt ??
      null;

    return {
      road: {
        available: roadStillLoading
          ? true
          : roadState === "fresh" && !!roadReport,
        mapped: roadStillLoading ? true : roadState === "fresh" && !!roadReport,
        restriction: roadReport?.primarySegment.restriction ?? null,
        advisory: roadReport?.primarySegment.advisory ?? null,
        officialCondition: roadReport?.primarySegment.officialCondition ?? null,
        officialRoadStatus: roadReport?.primarySegment.officialRoadStatus ?? {
          hasOfficialStatus: false,
          type: "none",
          impact: "none",
          title: "",
          description: "",
          source: "wydot",
          lastUpdated: null,
        },
        fetchedAt: roadReport?.fetchedAt ?? null,
        stationObservedAt: observation?.observedAt ?? null,
        windAvgMph: observation?.windAvgMph ?? null,
        windGustMph: observation?.windGustMph ?? null,
        windDirection: observation?.windDirection ?? null,
        visibilityFt: observation?.visibilityFt ?? null,
        airTempF: observation?.airTempF ?? null,
        surfaceTempF: observation?.surfaceTempF ?? null,
      },
      weather: {
        available:
          currentWeather.hasWeatherData ||
          hasUsableHomeRoadObservation(roadReport),
        observedAt: effectiveWeatherObservedAt,
        temperatureF: effectiveWeatherTemperatureF,
        windSpeedMph: effectiveWeatherWindSpeedMph,
        windDirection: null,
        precipProbability: currentWeather.precipProbability,
        weatherCode: currentWeather.weatherCode,
      },
      alerts: {
        available: alertSummary.status !== "unavailable",
        hasActiveAlert: alertSummary.status === "active",
        primaryEvent: alertSummary.event,
        primarySeverity: null,
        primaryCertainty: null,
      },
      forecast: {
        available: !!propertyLocation && propertyForecastLowF !== null,
        dailyLowF: propertyForecastLowF,
      },
    };
  }, [
    alertSummary.event,
    alertSummary.status,
    currentWeather,
    propertyForecastLowF,
    propertyLocation,
    roadReport,
    roadReady,
    roadState,
    selectedLocation,
    suggestionsReady,
  ]);
  const suggestionDecision = useMemo<SuggestionDecision | null>(
    () => (suggestionInput ? evaluateSuggestions(suggestionInput) : null),
    [suggestionInput],
  );
  const homeViewModel = useMemo<HomeViewModel | null>(() => {
    if (!topTitle) {
      return null;
    }

    return buildHomeViewModel({
      currentWeather,
      hourlyForecast,
      alertSummary,
      propertyForecastLowF,
      propertyRisk,
      propertyLocationName: propertyLocation?.name ?? null,
      roadReport,
      roadState,
      suggestionDecision,
      topTitle,
    });
  }, [
    alertSummary,
    currentWeather,
    hourlyForecast,
    propertyForecastLowF,
    propertyLocation,
    propertyRisk,
    roadReport,
    roadState,
    suggestionDecision,
    topTitle,
  ]);

  const roadHourly = useMemo<RoadConditionChartPoint[]>(
    () =>
      buildHomeRoadHourlyPoints({
        currentWeather,
        hourlyEntries: hourlyForecast,
        hourlyState,
        roadReport,
      }),
    [currentWeather, hourlyForecast, hourlyState, roadReport],
  );
  const roadHourlyLoading = useMemo(
    () => hourlyState === "loading" && roadHourly.length === 0,
    [hourlyState, roadHourly.length],
  );
  const statusActionRoute = useMemo(
    () => getHomeSuggestionRoute(suggestionDecision?.primary?.code),
    [suggestionDecision?.primary?.code],
  );

  async function handleQuickSwitch(locationId: string) {
    if (!selectedLocation) {
      setSwitchModalVisible(false);
      return;
    }

    const nextLocation = savedLocations.find(
      (location) => location.id === locationId,
    );

    if (!nextLocation || nextLocation.id === selectedLocation.id) {
      setSwitchModalVisible(false);
      return;
    }

    await setSelectedLocation(nextLocation);
    setSwitchModalVisible(false);
  }

  function handleStatusAction() {
    router.push(statusActionRoute);
  }

  function handleOpenMonitoredLocation() {
    router.push("/road");
  }

  if (!selectedLocation || !homeViewModel || !topTitle) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
        <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
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
                Home
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
              No active location selected
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
              Choose a location to see local conditions here.
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
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <HomeScreenV2
          topTitle={topTitle}
          updatedLabel={homeViewModel.updatedLabel}
          statusBanner={homeViewModel.statusBanner}
          metrics={homeViewModel.metrics}
          roadHourly={roadHourly}
          conditionChartDebugContext={{
            hourlyCount: hourlyForecast.length,
            currentKeys: Object.keys(currentWeather),
            firstHourly: hourlyForecast[0],
          }}
          roadHourlyLoading={roadHourlyLoading}
          monitoringCard={homeViewModel.monitoringCard}
          monitoredLocationCard={homeViewModel.monitoredLocationCard}
          onPressSettings={() => router.push("/settings")}
          onPressSwitchLocation={() => setSwitchModalVisible(true)}
          onPressStatusAction={handleStatusAction}
          onPressMonitoredLocation={handleOpenMonitoredLocation}
          onPressPrimaryAction={() => router.push("/conditions")}
          onPressSecondaryAction={() => router.push("/road")}
        />
      </View>

      <QuickSwitchModal
        visible={switchModalVisible}
        title="Switch saved location"
        subtitle="Pick a saved place to refresh the Home snapshot."
        currentLocationId={selectedLocation.id}
        savedLocations={savedLocations}
        onClose={() => setSwitchModalVisible(false)}
        onSelectLocation={handleQuickSwitch}
        onManageLocations={() => {
          setSwitchModalVisible(false);
          router.push("/manage-locations");
        }}
      />
    </View>
  );
}
