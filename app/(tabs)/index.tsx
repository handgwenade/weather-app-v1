import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import HomeScreenV2, {
  type HomeBullet,
  type HomeLocationCard,
  type HomeMetric,
  type HomeMonitoringCard,
  type HomeOutlookItem,
  type HomeStatusBanner,
} from "@/components/home/HomeScreenV2";
import QuickSwitchModal from "@/components/quickSwitchModal";
import {
  formatCityState,
  setSelectedLocation,
  usePropertyLocation,
  useSavedLocations,
  useSelectedLocation,
} from "@/data/locationStore";
import {
  getSharedCurrentWeather,
  getSharedForecast,
  getSharedHourlyForecast,
} from "@/data/weatherStore";
import { getActiveAlertsForLocation } from "@/services/nws";
import type { TomorrowHourlyForecastEntry } from "@/services/tomorrow";
import { getWydotRoadReport, type WydotRoadReport } from "@/services/wydot";
import {
  evaluateSuggestions,
  getSuggestionPresentation,
  SuggestionCode,
  type RuleMatch,
  type SuggestionDecision,
  type SuggestionInput,
} from "@/utils/suggestions";
import {
  celsiusToFahrenheit,
  getFreezeRiskLabel,
  metersPerSecondToMph,
} from "@/utils/weather";

function getConditionLabel(weatherCode?: number) {
  if (weatherCode === 1000) return "Clear";
  if (weatherCode === 1100) return "Mostly clear";
  if (weatherCode === 1101) return "Partly cloudy";
  if (weatherCode === 1102) return "Mostly cloudy";
  if (weatherCode === 1001) return "Cloudy";
  if (weatherCode === 4000) return "Drizzle";
  if (weatherCode === 4001) return "Rain";
  if (weatherCode === 4200) return "Light rain";
  if (weatherCode === 4201) return "Heavy rain";
  if (weatherCode === 5000) return "Snow";
  if (weatherCode === 5100) return "Light snow";
  if (weatherCode === 5101) return "Heavy snow";
  if (weatherCode === 6000) return "Freezing drizzle";
  if (weatherCode === 6200) return "Light freezing rain";
  if (weatherCode === 6201) return "Heavy freezing rain";
  if (weatherCode === 8000) return "Thunderstorm";
  return "Current conditions";
}

function formatRoundedNumber(value?: number | null, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return `${Math.round(value)}${suffix}`;
}

type PropertyRisk = "High" | "Moderate" | "Low" | "Unavailable";

type HomeCurrentWeatherSnapshot = {
  hasWeatherData: boolean;
  temperatureF: number | null;
  windSpeedMph: number | null;
  precipProbability: number | null;
  humidity: number | null;
  weatherCode: number | null;
  conditionLabel: string;
  sourceTimestamp: string | null;
  refreshFallbackLabel: string | null;
};

type HomeAlertSummary = {
  status: "loading" | "none" | "active" | "unavailable";
  event: string | null;
  area: string | null;
};

type HomeViewModel = {
  updatedLabel: string;
  metrics: HomeMetric[];
  statusBanner: HomeStatusBanner;
  monitoringCard: HomeMonitoringCard;
  monitoredLocationCard: HomeLocationCard;
};

type UseHomeScreenDataResult = {
  currentWeather: HomeCurrentWeatherSnapshot;
  hourlyForecast: TomorrowHourlyForecastEntry[];
  alertSummary: HomeAlertSummary;
  propertyRisk: PropertyRisk;
  propertyForecastLowF: number | null;
  roadReport: WydotRoadReport | null;
  homeSuggestionsReady: boolean;
};

const INITIAL_CURRENT_WEATHER: HomeCurrentWeatherSnapshot = {
  hasWeatherData: false,
  temperatureF: null,
  windSpeedMph: null,
  precipProbability: null,
  humidity: null,
  weatherCode: null,
  conditionLabel: "Current conditions",
  sourceTimestamp: null,
  refreshFallbackLabel: null,
};

const INITIAL_ALERT_SUMMARY: HomeAlertSummary = {
  status: "loading",
  event: null,
  area: null,
};

function formatClockLabel(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHourLabel(value: string) {
  const formatted = formatClockLabel(value);
  return formatted ?? "Time unavailable";
}

function formatTemperatureValue(value?: number | null) {
  return value === null || value === undefined || Number.isNaN(value)
    ? "--"
    : `${Math.round(value)}°F`;
}

function formatPercentValue(value?: number | null) {
  return value === null || value === undefined || Number.isNaN(value)
    ? "--"
    : `${Math.round(value)}%`;
}

function formatWindValue(value?: number | null, direction?: string | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  const baseValue = `${Math.round(value)} mph`;
  return direction ? `${baseValue} ${direction}` : baseValue;
}

function getTopTitle(report: WydotRoadReport | null, fallback: string) {
  if (report) {
    return `${report.routeCode} ${report.townGroup}`;
  }

  return fallback;
}

function getHomeStatusSubtitle(
  primarySuggestion: RuleMatch,
  params: {
    alertSummary: HomeAlertSummary;
    currentWeather: HomeCurrentWeatherSnapshot;
    propertyLocationName: string | null;
    propertyRisk: PropertyRisk;
    roadReport: WydotRoadReport | null;
  },
) {
  const {
    alertSummary,
    currentWeather,
    propertyLocationName,
    propertyRisk,
    roadReport,
  } = params;

  switch (primarySuggestion.code) {
    case SuggestionCode.ROAD_CLOSED:
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
      return roadReport
        ? `${roadReport.routeCode} near ${roadReport.townGroup}`
        : (primarySuggestion.whyBullets[0] ?? "Road guidance is active");
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return alertSummary.area ?? "Official guidance is active for this area";
    case SuggestionCode.FREEZE_RISK_TONIGHT:
      return propertyRisk === "High"
        ? `${propertyLocationName ?? "Property location"} forecast low is in the freeze-risk range.`
        : `${propertyLocationName ?? "Property location"} forecast low is near the freeze threshold.`;
    case SuggestionCode.HIGH_WIND_CAUTION:
      return currentWeather.windSpeedMph !== null
        ? `Observed wind: ${Math.round(currentWeather.windSpeedMph)} mph`
        : (primarySuggestion.whyBullets[0] ?? "Observed wind is elevated");
    case SuggestionCode.USE_CAUTION:
      return currentWeather.temperatureF !== null
        ? `Current air temp: ${formatTemperatureValue(currentWeather.temperatureF)}`
        : (primarySuggestion.whyBullets[0] ??
            "Current conditions deserve caution");
    case SuggestionCode.DRIFTING_CONCERN:
      return "Wind and snow-related conditions are worth watching.";
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return (
        primarySuggestion.whyBullets[0] ??
        "Data for this location is limited right now."
      );
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
    default:
      return "Conditions stable at this location.";
  }
}

function getHomeMonitoringCard(
  decision: SuggestionDecision | null,
  params: {
    propertyLocationName: string | null;
    propertyRisk: PropertyRisk;
  },
): HomeMonitoringCard {
  if (!decision) {
    return {
      title: "Collecting current guidance",
      body: "Checking road, weather, and forecast signals for this location.",
    };
  }

  const freezeSuggestion =
    decision.primary?.code === SuggestionCode.FREEZE_RISK_TONIGHT
      ? decision.primary
      : (decision.secondary.find(
          (match) => match.code === SuggestionCode.FREEZE_RISK_TONIGHT,
        ) ?? null);

  if (freezeSuggestion) {
    return {
      title: freezeSuggestion.title,
      body:
        params.propertyRisk === "High"
          ? `${params.propertyLocationName ?? "Property location"} forecast low supports freeze protection planning.`
          : `${params.propertyLocationName ?? "Property location"} forecast low is close enough to freezing to keep under watch.`,
    };
  }

  const focusSuggestion = decision.secondary[0] ?? decision.primary ?? null;

  if (!focusSuggestion) {
    return {
      title: params.propertyLocationName
        ? "Conditions stable at this location"
        : "No property location set",
      body: params.propertyLocationName
        ? `No major weather issues are active for ${params.propertyLocationName} right now.`
        : "Set a saved property location when you want freeze-sensitive monitoring on Home.",
    };
  }

  const focusPresentation = getSuggestionPresentation(focusSuggestion);

  return {
    title: focusSuggestion.title,
    body: focusPresentation.recommendationText,
  };
}

function buildHomeViewModel(params: {
  currentWeather: HomeCurrentWeatherSnapshot;
  alertSummary: HomeAlertSummary;
  propertyRisk: PropertyRisk;
  propertyLocationName: string | null;
  roadReport: WydotRoadReport | null;
  suggestionDecision: SuggestionDecision | null;
  topTitle: string;
}): HomeViewModel {
  const {
    currentWeather,
    alertSummary,
    propertyRisk,
    propertyLocationName,
    roadReport,
    suggestionDecision,
    topTitle,
  } = params;
  const observation = roadReport?.primaryStationObservation;
  const surfaceCondition =
    roadReport?.primarySegment.officialCondition &&
    !["None"].includes(roadReport.primarySegment.officialCondition)
      ? roadReport.primarySegment.officialCondition
      : null;
  const windMetric = observation?.windDirection
    ? formatWindValue(observation.windAvgMph, observation.windDirection)
    : formatWindValue(currentWeather.windSpeedMph);
  const metrics: HomeMetric[] = [
    {
      label: "Air Temp",
      value: formatTemperatureValue(currentWeather.temperatureF),
    },
    {
      label: "Road Temp",
      value: formatRoundedNumber(observation?.surfaceTempF, "°F"),
    },
    { label: "Wind", value: windMetric },
    {
      label: "Gusts",
      value: formatRoundedNumber(observation?.windGustMph, " mph"),
    },
    {
      label: "Precip Prob",
      value: formatPercentValue(currentWeather.precipProbability),
    },
    { label: "Humidity", value: formatPercentValue(currentWeather.humidity) },
  ];

  const updatedLabel = (() => {
    const sourceLabel = currentWeather.sourceTimestamp
      ? formatClockLabel(currentWeather.sourceTimestamp)
      : null;

    if (sourceLabel) {
      return sourceLabel;
    }

    if (currentWeather.refreshFallbackLabel) {
      return `Last refresh ${currentWeather.refreshFallbackLabel}`;
    }

    return "Waiting for data";
  })();

  const statusBanner: HomeStatusBanner = (() => {
    if (!suggestionDecision?.primary) {
      return {
        title: "Collecting current guidance",
        subtitle:
          "Checking road, weather, and forecast signals for this location.",
        statusLabel: "Loading",
        statusTone: "neutral",
        actionLabel: "Monitor",
      };
    }

    const primarySuggestion = suggestionDecision.primary;
    const presentation = getSuggestionPresentation(primarySuggestion);

    return {
      title: primarySuggestion.title,
      subtitle: getHomeStatusSubtitle(primarySuggestion, {
        alertSummary,
        currentWeather,
        propertyLocationName,
        propertyRisk,
        roadReport,
      }),
      statusLabel: presentation.levelLabel,
      statusTone: presentation.homeTone,
      actionLabel: presentation.actionLabel,
    };
  })();

  const monitoringCard = getHomeMonitoringCard(suggestionDecision, {
    propertyLocationName,
    propertyRisk,
  });

  const bullets: HomeBullet[] = [];

  if (currentWeather.temperatureF !== null) {
    bullets.push({
      id: "air-temp",
      text: `Air temp: ${formatTemperatureValue(currentWeather.temperatureF)}`,
    });
  }

  if (surfaceCondition) {
    bullets.push({
      id: "surface",
      text: `Surface: ${surfaceCondition === "Dry" ? "Dry" : surfaceCondition}`,
    });
  }

  if (alertSummary.status === "active" && alertSummary.event) {
    bullets.push({
      id: "alert",
      text: `Alert: ${alertSummary.event}`,
    });
  } else if (windMetric !== "--") {
    bullets.push({
      id: "wind",
      text: `Wind: ${windMetric}`,
    });
  } else if (currentWeather.precipProbability !== null) {
    bullets.push({
      id: "precip-prob",
      text: `Precip prob: ${formatPercentValue(currentWeather.precipProbability)}`,
    });
  }

  const monitoredLocationCard: HomeLocationCard = {
    title: topTitle,
    bullets: bullets.slice(0, 3),
    statusLabel: suggestionDecision?.primary
      ? getSuggestionPresentation(suggestionDecision.primary).levelLabel
      : "Unavailable",
    statusTone: suggestionDecision?.primary
      ? getSuggestionPresentation(suggestionDecision.primary).homeTone
      : "neutral",
    impactLabel: suggestionDecision?.secondary.find(
      (match) => match.code === SuggestionCode.FREEZE_RISK_TONIGHT,
    )
      ? "Forecast concern tonight"
      : suggestionDecision?.primary?.code ===
          SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS
        ? "Conditions stable"
        : suggestionDecision?.primary
          ? "Active concern"
          : "Awaiting data",
  };

  return {
    updatedLabel,
    metrics,
    statusBanner,
    monitoringCard,
    monitoredLocationCard,
  };
}

function buildOutlookItems(params: {
  hourlyEntries: TomorrowHourlyForecastEntry[];
}): HomeOutlookItem[] {
  const { hourlyEntries } = params;

  if (hourlyEntries.length === 0) {
    return [
      {
        id: "hourly-unavailable",
        time: "Hourly",
        temperature: "--",
        condition: "Unavailable",
      },
    ];
  }

  return hourlyEntries.slice(0, 6).map((entry, index) => ({
    id: `${entry.time}-${index}`,
    time: formatHourLabel(entry.time),
    temperature:
      typeof entry.values.temperature === "number"
        ? `${Math.round(celsiusToFahrenheit(entry.values.temperature))}°`
        : "--",
    condition:
      typeof entry.values.weatherCode === "number"
        ? getConditionLabel(entry.values.weatherCode)
        : "Unavailable",
  }));
}

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

function useHomeScreenData(
  selectedLocation: ReturnType<typeof useSelectedLocation>,
  propertyLocation: ReturnType<typeof usePropertyLocation>,
): UseHomeScreenDataResult {
  const [currentWeather, setCurrentWeather] =
    useState<HomeCurrentWeatherSnapshot>(INITIAL_CURRENT_WEATHER);
  const [hourlyForecast, setHourlyForecast] = useState<
    TomorrowHourlyForecastEntry[]
  >([]);
  const [alertSummary, setAlertSummary] = useState<HomeAlertSummary>(
    INITIAL_ALERT_SUMMARY,
  );
  const [propertyRisk, setPropertyRisk] = useState<PropertyRisk>("Unavailable");
  const [propertyForecastLowF, setPropertyForecastLowF] = useState<
    number | null
  >(null);
  const [roadReport, setRoadReport] = useState<WydotRoadReport | null>(null);
  const [homeSuggestionsReady, setHomeSuggestionsReady] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadHome() {
      setHomeSuggestionsReady(false);

      if (!selectedLocation) {
        setCurrentWeather(INITIAL_CURRENT_WEATHER);
        setHourlyForecast([]);
        setAlertSummary(INITIAL_ALERT_SUMMARY);
        setPropertyRisk("Unavailable");
        setPropertyForecastLowF(null);
        setRoadReport(null);
        return;
      }

      const [
        currentResult,
        hourlyResult,
        alertsResult,
        roadResult,
        propertyResult,
      ] = await Promise.allSettled([
        getSharedCurrentWeather(selectedLocation),
        getSharedHourlyForecast(selectedLocation),
        getActiveAlertsForLocation(
          selectedLocation.latitude,
          selectedLocation.longitude,
        ),
        getWydotRoadReport(selectedLocation),
        propertyLocation
          ? getSharedForecast(propertyLocation)
          : Promise.resolve(null),
      ]);

      if (!isActive) {
        return;
      }

      if (currentResult.status === "fulfilled") {
        const values = currentResult.value.data.values;
        const temperatureF = celsiusToFahrenheit(values.temperature);
        const windSpeedMph = metersPerSecondToMph(values.windSpeed);
        const precipProbability = Math.round(
          values.precipitationProbability ?? 0,
        );
        const weatherCode = values.weatherCode;
        const sourceTimestamp =
          typeof currentResult.value.data.time === "string"
            ? currentResult.value.data.time
            : null;
        const fallbackLabel = sourceTimestamp
          ? null
          : formatClockLabel(new Date());

        setCurrentWeather({
          hasWeatherData: true,
          temperatureF,
          windSpeedMph,
          precipProbability,
          humidity:
            typeof values.humidity === "number"
              ? Math.round(values.humidity)
              : null,
          weatherCode: typeof weatherCode === "number" ? weatherCode : null,
          conditionLabel: getConditionLabel(weatherCode),
          sourceTimestamp,
          refreshFallbackLabel: fallbackLabel,
        });
      } else {
        setCurrentWeather({
          ...INITIAL_CURRENT_WEATHER,
          hasWeatherData: false,
          conditionLabel: "Weather unavailable",
        });
      }

      if (hourlyResult.status === "fulfilled") {
        setHourlyForecast(hourlyResult.value.timelines?.hourly ?? []);
      } else {
        setHourlyForecast([]);
      }

      if (
        propertyLocation &&
        propertyResult.status === "fulfilled" &&
        propertyResult.value
      ) {
        const firstDay = propertyResult.value.timelines.daily?.[0];

        if (firstDay) {
          const lowF = celsiusToFahrenheit(firstDay.values.temperatureMin);
          setPropertyRisk(getFreezeRiskLabel(lowF));
          setPropertyForecastLowF(lowF);
        } else {
          setPropertyRisk("Unavailable");
          setPropertyForecastLowF(null);
        }
      } else {
        setPropertyRisk("Unavailable");
        setPropertyForecastLowF(null);
      }

      if (alertsResult.status === "fulfilled") {
        const features = alertsResult.value.features ?? [];

        if (features.length === 0) {
          setAlertSummary({
            status: "none",
            event: null,
            area: formatCityState(selectedLocation),
          });
        } else {
          const firstAlert = features[0];
          const event = firstAlert.properties?.event ?? "Active alert";
          const area =
            firstAlert.properties?.areaDesc ??
            formatCityState(selectedLocation);
          setAlertSummary({
            status: "active",
            event,
            area,
          });
        }
      } else {
        setAlertSummary({
          status: "unavailable",
          event: null,
          area: null,
        });
      }

      if (roadResult.status === "fulfilled") {
        setRoadReport(roadResult.value);
      } else {
        setRoadReport(null);
      }

      setHomeSuggestionsReady(true);
    }

    void loadHome();

    return () => {
      isActive = false;
    };
  }, [selectedLocation, propertyLocation]);

  return {
    currentWeather,
    hourlyForecast,
    alertSummary,
    propertyRisk,
    propertyForecastLowF,
    roadReport,
    homeSuggestionsReady,
  };
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
    homeSuggestionsReady,
  } = useHomeScreenData(selectedLocation, propertyLocation);

  const topTitle = useMemo(() => {
    if (!selectedLocation) {
      return null;
    }

    return getTopTitle(roadReport, selectedLocation.name);
  }, [roadReport, selectedLocation]);
  const suggestionInput = useMemo<SuggestionInput | null>(() => {
    if (!selectedLocation || !homeSuggestionsReady) {
      return null;
    }

    const observation = roadReport?.primaryStationObservation ?? null;

    return {
      road: {
        available: !!roadReport,
        mapped: !!roadReport,
        restriction: roadReport?.primarySegment.restriction ?? null,
        advisory: roadReport?.primarySegment.advisory ?? null,
        officialCondition: roadReport?.primarySegment.officialCondition ?? null,
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
        available: currentWeather.hasWeatherData,
        observedAt: currentWeather.sourceTimestamp,
        temperatureF: currentWeather.temperatureF,
        windSpeedMph: currentWeather.windSpeedMph,
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
    homeSuggestionsReady,
    propertyForecastLowF,
    propertyLocation,
    roadReport,
    selectedLocation,
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
      alertSummary,
      propertyRisk,
      propertyLocationName: propertyLocation?.name ?? null,
      roadReport,
      suggestionDecision,
      topTitle,
    });
  }, [
    alertSummary,
    currentWeather,
    propertyLocation,
    propertyRisk,
    roadReport,
    suggestionDecision,
    topTitle,
  ]);
  const outlookItems = useMemo<HomeOutlookItem[]>(
    () =>
      buildOutlookItems({
        hourlyEntries: hourlyForecast,
      }),
    [hourlyForecast],
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
    <>
      <HomeScreenV2
        topTitle={topTitle}
        updatedLabel={homeViewModel.updatedLabel}
        statusBanner={homeViewModel.statusBanner}
        metrics={homeViewModel.metrics}
        outlookItems={outlookItems}
        monitoringCard={homeViewModel.monitoringCard}
        monitoredLocationCard={homeViewModel.monitoredLocationCard}
        onPressSettings={() => router.push("/settings")}
        onPressSwitchLocation={() => setSwitchModalVisible(true)}
        onPressStatusAction={handleStatusAction}
        onPressMonitoredLocation={handleOpenMonitoredLocation}
        onPressPrimaryAction={() => router.push("/conditions")}
        onPressSecondaryAction={() => router.push("/road")}
      />

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
    </>
  );
}
