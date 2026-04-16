import QuickSwitchModal from "@/components/quickSwitchModal";
import RoadSegmentsPrototype from "@/components/road/RoadSegmentsPrototype";
import RoadScreenV2, {
  type RoadActionDestination,
  type RoadBullet,
  type RoadMetric,
  type RoadOutlookItem,
  type RoadTone,
} from "@/components/road/RoadScreenV2";
import {
  type AppLocation,
  formatCityState,
  setSelectedLocation,
  useSavedLocations,
  useSelectedLocation,
} from "@/data/locationStore";
import { getSharedCurrentWeather } from "@/data/weatherStore";
import {
  getWydotRoadReport,
  type WydotRoadReport,
  type WydotStationObservation,
} from "@/services/wydot";
import {
  evaluateSuggestions,
  getSuggestionPresentation,
  type RuleMatch,
  SuggestionCode,
  type SuggestionDecision,
  type SuggestionInput,
} from "@/utils/suggestions";
import { celsiusToFahrenheit, metersPerSecondToMph } from "@/utils/weather";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type RoadCurrentWeatherSnapshot = {
  temperatureLabel: string;
  windLabel: string;
  precipProbability: number | null;
  sourceUpdatedLabel: string | null;
  fallbackRefreshLabel: string | null;
  hasWeatherData: boolean;
};

type RoadViewModel = {
  topTitle: string;
  updatedLabel: string;
  notices: string[];
  locationFieldLabel: string;
  statusTitle: string;
  statusSubtitle: string;
  statusLabel: string;
  statusTone: RoadTone;
  actionLabel: string;
  recommendationText: string;
  currentConditions: RoadMetric[];
  riskLevelLabel: string;
  riskBullets: RoadBullet[];
  confidenceLabel: string;
};

type UseRoadScreenDataResult = {
  currentWeather: RoadCurrentWeatherSnapshot;
  roadSummary: string;
  weatherCaution: string;
  wydotNotice: string;
  routeLabel: string;
  roadReport: WydotRoadReport | null;
  officialCondition: string;
  advisory: string;
  restriction: string;
  stationObservedAt: string;
  stationAirTemp: string;
  stationSurfaceTemp: string;
  stationWindAvg: string;
  stationWindGust: string;
  stationWindDirection: string;
  roadSuggestionsReady: boolean;
};

const INITIAL_CURRENT_WEATHER: RoadCurrentWeatherSnapshot = {
  temperatureLabel: "Loading...",
  windLabel: "Loading...",
  precipProbability: null,
  sourceUpdatedLabel: null,
  fallbackRefreshLabel: null,
  hasWeatherData: true,
};
function getRoadCautionResult(temperatureF: number, windSpeedMph: number) {
  if (temperatureF <= 32) {
    return {
      level: "caution" as const,
      message: "Use caution: freezing temperatures",
    };
  }

  if (temperatureF <= 40) {
    return {
      level: "caution" as const,
      message: "Use caution: temps near freezing",
    };
  }

  if (windSpeedMph >= 25) {
    return {
      level: "caution" as const,
      message: "Use caution: windy conditions",
    };
  }

  return {
    level: "ok" as const,
    message: "Road conditions look okay right now",
  };
}
function formatImpactText(value: string) {
  return value === "None" ? "None reported" : value;
}

function formatTimestampLabel(value: string | null | undefined) {
  if (!value || value.trim() === "") {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUpdatedLabel(
  sourceTimestamp: string | null,
  fallbackLabel: string | null,
) {
  if (sourceTimestamp) {
    const date = new Date(sourceTimestamp);

    if (!Number.isNaN(date.getTime())) {
      const now = new Date();
      const isSameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

      const formatted = isSameDay
        ? date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });

      return `Updated ${formatted}`;
    }
  }

  if (fallbackLabel) {
    return `Updated ${fallbackLabel}`;
  }

  return "Updated";
}

function formatLocationFieldLabel(location: AppLocation) {
  const cityState = formatCityState(location);

  if (location.name.trim().toLowerCase() === cityState.trim().toLowerCase()) {
    return cityState;
  }

  if (
    location.name.trim().toLowerCase() === location.city.trim().toLowerCase()
  ) {
    return cityState;
  }

  return `${location.name} · ${cityState}`;
}

function formatProbabilityValue(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }

  return `${Math.round(value)}%`;
}

function getOfficialConditionLabel(report: WydotRoadReport | null) {
  if (!report) {
    return "Unavailable";
  }

  return report.primarySegment.officialCondition;
}

function buildWeatherCaution(
  cautionLevel: "ok" | "caution",
  weatherMessage: string,
) {
  if (cautionLevel === "ok") {
    return "No weather-based caution right now";
  }

  return weatherMessage;
}

function getRoadTopTitle(routeLabel: string, locationLabel: string) {
  if (
    !routeLabel ||
    routeLabel.includes("Loading") ||
    routeLabel === "Weather-based road guidance"
  ) {
    return locationLabel;
  }

  return routeLabel.replace(" near ", " ");
}

function getConfidenceLabel(
  hasWeatherData: boolean,
  hasRoadReport: boolean,
  stationObservedAt: string,
) {
  if (hasWeatherData && hasRoadReport && stationObservedAt !== "Unavailable") {
    return "Confidence: High";
  }

  if (hasWeatherData || hasRoadReport) {
    return "Confidence: Medium";
  }

  return "Confidence: Low";
}

function inferPrecipLabel(
  officialCondition: string,
  weatherCaution: string,
  roadSummary: string,
) {
  const combined =
    `${officialCondition} ${weatherCaution} ${roadSummary}`.toLowerCase();

  if (combined.includes("snow")) {
    return "Snow";
  }

  if (combined.includes("rain")) {
    return "Rain";
  }

  if (combined.includes("ice") || combined.includes("freezing")) {
    return "Wintry";
  }

  if (combined.includes("dry")) {
    return "None";
  }

  return "None";
}

function buildRiskBullets(
  report: WydotRoadReport | null,
  officialCondition: string,
  advisory: string,
  restriction: string,
  stationAirTemp: string,
  fallbackTemperature: string,
  windValue: string,
  precipProbability: number | null,
): RoadBullet[] {
  const bullets: string[] = [];

  if (restriction !== "None reported" && restriction !== "Unavailable") {
    bullets.push(`Restriction: ${restriction}`);
  } else if (advisory !== "None reported" && advisory !== "Unavailable") {
    bullets.push(`Advisory: ${advisory}`);
  } else if (officialCondition.toLowerCase().includes("dry")) {
    bullets.push("Surface: Dry");
  } else if (officialCondition !== "Unavailable") {
    bullets.push(`Surface: ${officialCondition}`);
  } else if (report) {
    bullets.push(`Corridor: ${report.routeCode} near ${report.townGroup}`);
  } else {
    bullets.push("Latest corridor report unavailable");
  }

  if (stationAirTemp !== "Unavailable") {
    bullets.push(`Air temp: ${stationAirTemp}`);
  } else if (
    fallbackTemperature !== "Not available" &&
    fallbackTemperature !== "--"
  ) {
    bullets.push(`Air temp: ${fallbackTemperature}`);
  }

  if (precipProbability !== null) {
    bullets.push(`Precip prob: ${formatProbabilityValue(precipProbability)}`);
  } else if (windValue !== "Not available" && windValue !== "Unavailable") {
    bullets.push(`Wind: ${windValue}`);
  }

  return bullets.slice(0, 3).map((text, index) => ({
    id: `risk-${index}`,
    text,
  }));
}

function buildRoadOutlookItems(
  temperature: string,
  precipLabel: string,
): RoadOutlookItem[] {
  const match = temperature.match(/-?\d+/);
  const baseTemp = match ? Number.parseInt(match[0], 10) : 32;
  const condition = precipLabel === "None" ? "Clear" : precipLabel;
  const labels = ["Now", "9AM", "12PM", "3PM", "6PM"];
  const deltas = [0, -2, -4, -6, -8];

  return labels.map((label, index) => ({
    id: label,
    time: label,
    temperature: `${baseTemp + deltas[index]}°`,
    condition,
  }));
}

function getRoadLocationLabel(location: AppLocation) {
  return formatCityState(location);
}

function getRoadActionDestination(
  code?: SuggestionCode | null,
): RoadActionDestination {
  switch (code) {
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return "alerts";
    case SuggestionCode.HIGH_WIND_CAUTION:
    case SuggestionCode.USE_CAUTION:
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
    case SuggestionCode.FREEZE_RISK_TONIGHT:
      return "conditions";
    case SuggestionCode.ROAD_CLOSED:
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
    case SuggestionCode.DRIFTING_CONCERN:
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
    default:
      return "details";
  }
}

function getRoadStatusSubtitle(
  primarySuggestion: RuleMatch,
  params: {
    advisory: string;
    officialCondition: string;
    restriction: string;
    roadReport: WydotRoadReport | null;
    weatherCaution: string;
  },
) {
  const {
    advisory,
    officialCondition,
    restriction,
    roadReport,
    weatherCaution,
  } = params;

  switch (primarySuggestion.code) {
    case SuggestionCode.ROAD_CLOSED:
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
      return `Restriction: ${restriction}`;
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
      return `Advisory: ${advisory}`;
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return (
        primarySuggestion.whyBullets[0] ??
        "Official guidance is active for this area."
      );
    case SuggestionCode.HIGH_WIND_CAUTION:
      return primarySuggestion.whyBullets[0] ?? "Observed wind is elevated.";
    case SuggestionCode.DRIFTING_CONCERN:
      return "Wind and snow-related conditions are supporting drifting concern.";
    case SuggestionCode.USE_CAUTION:
      return officialCondition !== "Unavailable" && officialCondition !== "None"
        ? `Surface: ${officialCondition}`
        : weatherCaution;
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
      return roadReport
        ? (primarySuggestion.whyBullets[0] ?? "Road guidance is limited.")
        : "WYDOT road data is limited for this location right now.";
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return (
        primarySuggestion.whyBullets[0] ??
        "Weather guidance is limited for this location."
      );
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
    default:
      return "Conditions stable at this location.";
  }
}

function buildRoadSuggestionBullets(
  primarySuggestion: RuleMatch | null,
  secondarySuggestions: RuleMatch[],
  fallbackBullets: RoadBullet[],
): RoadBullet[] {
  if (!primarySuggestion) {
    return fallbackBullets;
  }

  const bulletTexts = [
    ...primarySuggestion.whyBullets,
    ...secondarySuggestions.map((suggestion) => suggestion.title),
  ];

  if (bulletTexts.length === 0) {
    return fallbackBullets;
  }

  return bulletTexts.slice(0, 3).map((text, index) => ({
    id: `suggestion-${index}`,
    text,
  }));
}

function buildRoadViewModel(params: {
  selectedLocation: AppLocation;
  routeLabel: string;
  currentWeather: RoadCurrentWeatherSnapshot;
  roadReport: WydotRoadReport | null;
  wydotNotice: string;
  officialCondition: string;
  advisory: string;
  restriction: string;
  stationObservedAt: string;
  stationAirTemp: string;
  stationSurfaceTemp: string;
  stationWindAvg: string;
  stationWindGust: string;
  stationWindDirection: string;
  suggestionDecision: SuggestionDecision | null;
  weatherCaution: string;
}): RoadViewModel {
  const {
    selectedLocation,
    routeLabel,
    currentWeather,
    roadReport,
    wydotNotice,
    officialCondition,
    advisory,
    restriction,
    stationObservedAt,
    stationAirTemp,
    stationSurfaceTemp,
    stationWindAvg,
    stationWindGust,
    stationWindDirection,
    suggestionDecision,
    weatherCaution,
  } = params;
  const locationLabel = getRoadLocationLabel(selectedLocation);
  const topTitle = getRoadTopTitle(routeLabel, locationLabel);
  const locationFieldLabel = formatLocationFieldLabel(selectedLocation);
  const effectiveSourceUpdatedLabel =
    formatTimestampLabel(roadReport?.fetchedAt ?? undefined) ??
    currentWeather.sourceUpdatedLabel;
  const updatedLabel = formatUpdatedLabel(
    roadReport?.fetchedAt ?? currentWeather.sourceUpdatedLabel,
    currentWeather.fallbackRefreshLabel,
  );
  const lastUpdatedMetricValue = effectiveSourceUpdatedLabel
    ? effectiveSourceUpdatedLabel
    : (currentWeather.fallbackRefreshLabel ?? "Unavailable");
  const windMetricValue =
    stationWindAvg !== "Unavailable" && stationWindDirection !== "Unavailable"
      ? `${stationWindAvg} ${stationWindDirection}`
      : currentWeather.windLabel;
  const currentConditions: RoadMetric[] = [
    { id: "air", label: "Air Temp", value: stationAirTemp },
    { id: "road", label: "Road Temp", value: stationSurfaceTemp },
    { id: "wind", label: "Wind", value: windMetricValue },
    { id: "gusts", label: "Gusts", value: stationWindGust },
    {
      id: "precip-prob",
      label: "Precip Prob",
      value: formatProbabilityValue(currentWeather.precipProbability),
    },
    { id: "updated", label: "Last Updated", value: lastUpdatedMetricValue },
  ];
  const fallbackRiskBullets = buildRiskBullets(
    roadReport,
    officialCondition,
    advisory,
    restriction,
    stationAirTemp,
    currentWeather.temperatureLabel,
    windMetricValue,
    currentWeather.precipProbability,
  );
  const primarySuggestion = suggestionDecision?.primary ?? null;
  const primaryPresentation = primarySuggestion
    ? getSuggestionPresentation(primarySuggestion)
    : null;
  const notices = suggestionDecision
    ? suggestionDecision.systemStates.map((match) => {
        if (
          match.code === SuggestionCode.ROAD_DATA_UNAVAILABLE &&
          wydotNotice
        ) {
          return wydotNotice;
        }

        return match.whyBullets[0] ?? match.title;
      })
    : [];
  const statusTitle = primarySuggestion?.title ?? "Collecting road guidance";
  const statusSubtitle = primarySuggestion
    ? getRoadStatusSubtitle(primarySuggestion, {
        advisory,
        officialCondition,
        restriction,
        roadReport,
        weatherCaution,
      })
    : "Checking current road and weather signals for this location.";
  const recommendationText = primaryPresentation
    ? primaryPresentation.recommendationText
    : "Checking current road and weather signals for this location.";

  return {
    topTitle,
    updatedLabel,
    notices,
    locationFieldLabel,
    statusTitle,
    statusSubtitle,
    statusLabel: primaryPresentation?.levelLabel ?? "Unavailable",
    statusTone: primaryPresentation?.roadTone ?? "neutral",
    actionLabel: primaryPresentation?.actionLabel ?? "Monitor",
    recommendationText,
    currentConditions,
    riskLevelLabel: primaryPresentation?.levelLabel ?? "Unavailable",
    riskBullets: buildRoadSuggestionBullets(
      primarySuggestion,
      suggestionDecision?.secondary ?? [],
      fallbackRiskBullets,
    ),
    confidenceLabel: getConfidenceLabel(
      currentWeather.hasWeatherData,
      !!roadReport,
      stationObservedAt,
    ),
  };
}

function buildRoadSummary(
  report: WydotRoadReport | null,
  cautionLevel: "ok" | "caution",
  weatherMessage: string,
) {
  if (!report) {
    return weatherMessage;
  }

  const { primarySegment, townGroup } = report;

  if (primarySegment.restriction !== "None") {
    return `Restriction in effect near ${townGroup}. ${primarySegment.restriction}`;
  }

  if (primarySegment.advisory !== "None") {
    return `Use caution near ${townGroup}. WYDOT advisory: ${primarySegment.advisory}`;
  }

  if (!["Dry", "None"].includes(primarySegment.officialCondition)) {
    return `${primarySegment.officialCondition} reported near ${townGroup}.`;
  }

  if (cautionLevel !== "ok") {
    return `Roads are dry near ${townGroup}, but weather conditions still suggest caution.`;
  }

  return `Dry road conditions reported near ${townGroup}.`;
}

function formatObservationValue(
  value: number | null,
  suffix: string,
  emptyText = "Unavailable",
) {
  if (value === null || Number.isNaN(value)) {
    return emptyText;
  }

  return `${value}${suffix}`;
}

function formatObservationText(
  value: string | null,
  emptyText = "Unavailable",
) {
  if (!value || value.trim() === "") {
    return emptyText;
  }

  return value;
}

function useRoadScreenData(
  roadLocation: AppLocation | null,
): UseRoadScreenDataResult {
  const [currentWeather, setCurrentWeather] =
    useState<RoadCurrentWeatherSnapshot>(INITIAL_CURRENT_WEATHER);
  const [roadSummary, setRoadSummary] = useState("Loading road conditions...");
  const [weatherCaution, setWeatherCaution] = useState(
    "Loading weather guidance...",
  );
  const [wydotNotice, setWydotNotice] = useState("");
  const [routeLabel, setRouteLabel] = useState("Loading WYDOT corridor...");
  const [roadReport, setRoadReport] = useState<WydotRoadReport | null>(null);
  const [officialCondition, setOfficialCondition] = useState("Loading...");
  const [advisory, setAdvisory] = useState("Loading...");
  const [restriction, setRestriction] = useState("Loading...");
  const [stationObservedAt, setStationObservedAt] = useState("Loading...");
  const [stationAirTemp, setStationAirTemp] = useState("Loading...");
  const [stationSurfaceTemp, setStationSurfaceTemp] = useState("Loading...");
  const [stationWindAvg, setStationWindAvg] = useState("Unavailable");
  const [stationWindGust, setStationWindGust] = useState("Loading...");
  const [stationWindDirection, setStationWindDirection] =
    useState("Unavailable");
  const [roadSuggestionsReady, setRoadSuggestionsReady] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadRoadConditions() {
      setRoadSuggestionsReady(false);

      if (!roadLocation) {
        setRouteLabel("Add a location to view road conditions");
        setOfficialCondition("Unavailable");
        setAdvisory("Unavailable");
        setRestriction("Unavailable");
        setStationObservedAt("Unavailable");
        setStationAirTemp("Unavailable");
        setStationSurfaceTemp("Unavailable");
        setStationWindAvg("Unavailable");
        setStationWindGust("Unavailable");
        setStationWindDirection("Unavailable");
        setWydotNotice("");
        setRoadSummary("No active location selected.");
        setWeatherCaution("Choose a location to see local conditions here.");
        setCurrentWeather(INITIAL_CURRENT_WEATHER);
        setRoadReport(null);
        return;
      }

      setRouteLabel("Loading WYDOT corridor...");
      setOfficialCondition("Loading...");
      setAdvisory("Loading...");
      setRestriction("Loading...");
      setStationObservedAt("Loading...");
      setStationAirTemp("Loading...");
      setStationSurfaceTemp("Loading...");
      setStationWindAvg("Loading...");
      setStationWindGust("Loading...");
      setStationWindDirection("Loading...");
      setWydotNotice("");
      setRoadSummary("Loading road conditions...");
      setWeatherCaution("Loading weather guidance...");
      setCurrentWeather(INITIAL_CURRENT_WEATHER);
      setRoadReport(null);

      const [weatherResult, wydotResult] = await Promise.allSettled([
        getSharedCurrentWeather(roadLocation),
        getWydotRoadReport(roadLocation),
      ]);

      if (!isActive) {
        return;
      }

      let weatherMessage = "Road conditions temporarily unavailable";
      let cautionLevel: "ok" | "caution" = "caution";
      const fallbackUpdatedLabel = formatTimestampLabel(
        new Date().toISOString(),
      );
      let weatherSourceUpdatedLabel: string | null = null;

      if (weatherResult.status === "fulfilled") {
        const values = weatherResult.value.data.values;
        const temperatureF =
          typeof values.temperature === "number"
            ? celsiusToFahrenheit(values.temperature)
            : null;
        const windSpeedMph =
          typeof values.windSpeed === "number"
            ? metersPerSecondToMph(values.windSpeed)
            : null;

        if (temperatureF !== null && windSpeedMph !== null) {
          const cautionResult = getRoadCautionResult(
            temperatureF,
            windSpeedMph,
          );
          cautionLevel = cautionResult.level;
          weatherMessage = cautionResult.message;
        }

        weatherSourceUpdatedLabel = formatTimestampLabel(
          typeof weatherResult.value.data.time === "string"
            ? weatherResult.value.data.time
            : null,
        );

        setCurrentWeather({
          temperatureLabel: temperatureF === null ? "--" : `${temperatureF}°F`,
          windLabel:
            windSpeedMph === null ? "Not available" : `${windSpeedMph} mph`,
          precipProbability:
            typeof values.precipitationProbability === "number"
              ? Math.round(values.precipitationProbability)
              : null,
          sourceUpdatedLabel: weatherSourceUpdatedLabel,
          fallbackRefreshLabel: fallbackUpdatedLabel,
          hasWeatherData: temperatureF !== null || windSpeedMph !== null,
        });
      } else {
        console.log("Road screen weather fetch failed:", weatherResult.reason);
        setCurrentWeather({
          temperatureLabel: "--",
          windLabel: "Not available",
          precipProbability: null,
          sourceUpdatedLabel: null,
          fallbackRefreshLabel: fallbackUpdatedLabel,
          hasWeatherData: false,
        });
      }

      let report: WydotRoadReport | null = null;

      if (wydotResult.status === "fulfilled") {
        report = wydotResult.value;

        if (report) {
          const station: WydotStationObservation | null =
            report.primaryStationObservation;

          setRoadReport(report);
          setWydotNotice("");
          setRouteLabel(`${report.routeCode} near ${report.townGroup}`);
          setOfficialCondition(getOfficialConditionLabel(report));
          setAdvisory(formatImpactText(report.primarySegment.advisory));
          setRestriction(formatImpactText(report.primarySegment.restriction));

          if (station) {
            setStationObservedAt(formatObservationText(station.observedAt));
            setStationAirTemp(formatObservationValue(station.airTempF, "°F"));
            setStationSurfaceTemp(
              formatObservationValue(station.surfaceTempF, "°F"),
            );
            setStationWindAvg(
              formatObservationValue(station.windAvgMph, " mph"),
            );
            setStationWindGust(
              formatObservationValue(station.windGustMph, " mph"),
            );
            setStationWindDirection(
              formatObservationText(station.windDirection),
            );
          } else {
            setStationObservedAt("Unavailable");
            setStationAirTemp("Unavailable");
            setStationSurfaceTemp("Unavailable");
            setStationWindAvg("Unavailable");
            setStationWindGust("Unavailable");
            setStationWindDirection("Unavailable");
          }
        } else {
          setRoadReport(null);
          setWydotNotice(
            "WYDOT corridor mapping is not available for this location yet.",
          );
          setRouteLabel("Weather-based road guidance");
          setOfficialCondition("Unavailable");
          setAdvisory("Unavailable");
          setRestriction("Unavailable");
          setStationObservedAt("Unavailable");
          setStationAirTemp("Unavailable");
          setStationSurfaceTemp("Unavailable");
          setStationWindAvg("Unavailable");
          setStationWindGust("Unavailable");
          setStationWindDirection("Unavailable");
        }
      } else {
        console.log("WYDOT road fetch failed:", wydotResult.reason);
        setRoadReport(null);
        setWydotNotice("WYDOT road data is temporarily unavailable.");
        setRouteLabel("Weather-based road guidance");
        setOfficialCondition("Unavailable");
        setAdvisory("Unavailable");
        setRestriction("Unavailable");
        setStationObservedAt("Unavailable");
        setStationAirTemp("Unavailable");
        setStationSurfaceTemp("Unavailable");
        setStationWindAvg("Unavailable");
        setStationWindGust("Unavailable");
        setStationWindDirection("Unavailable");
      }

      const summary = buildRoadSummary(report, cautionLevel, weatherMessage);
      const caution = buildWeatherCaution(cautionLevel, weatherMessage);

      setRoadSummary(summary);
      setWeatherCaution(caution);
      setRoadSuggestionsReady(true);
    }

    void loadRoadConditions();

    return () => {
      isActive = false;
    };
  }, [roadLocation]);

  return {
    currentWeather,
    roadSummary,
    weatherCaution,
    wydotNotice,
    routeLabel,
    roadReport,
    officialCondition,
    advisory,
    restriction,
    stationObservedAt,
    stationAirTemp,
    stationSurfaceTemp,
    stationWindAvg,
    stationWindGust,
    stationWindDirection,
    roadSuggestionsReady,
  };
}

export default function RoadScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();
  const savedLocations = useSavedLocations();
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const roadLocation = selectedLocation;
  const {
    currentWeather,
    roadSummary,
    weatherCaution,
    wydotNotice,
    routeLabel,
    roadReport,
    officialCondition,
    advisory,
    restriction,
    stationObservedAt,
    stationAirTemp,
    stationSurfaceTemp,
    stationWindAvg,
    stationWindGust,
    stationWindDirection,
    roadSuggestionsReady,
  } = useRoadScreenData(roadLocation);

  const precipLabel = useMemo(
    () => inferPrecipLabel(officialCondition, weatherCaution, roadSummary),
    [officialCondition, weatherCaution, roadSummary],
  );

  const suggestionInput = useMemo<SuggestionInput | null>(
    () =>
      roadLocation && roadSuggestionsReady
        ? {
            road: {
              available: !!roadReport,
              mapped: !!roadReport,
              restriction: restriction === "Unavailable" ? null : restriction,
              advisory: advisory === "Unavailable" ? null : advisory,
              officialCondition:
                officialCondition === "Unavailable" ? null : officialCondition,
              fetchedAt: roadReport?.fetchedAt ?? null,
              stationObservedAt:
                stationObservedAt === "Unavailable" ? null : stationObservedAt,
              windAvgMph:
                roadReport?.primaryStationObservation?.windAvgMph ?? null,
              windGustMph:
                roadReport?.primaryStationObservation?.windGustMph ?? null,
              windDirection:
                roadReport?.primaryStationObservation?.windDirection ?? null,
              visibilityFt:
                roadReport?.primaryStationObservation?.visibilityFt ?? null,
              airTempF: roadReport?.primaryStationObservation?.airTempF ?? null,
              surfaceTempF:
                roadReport?.primaryStationObservation?.surfaceTempF ?? null,
            },
            weather: {
              available: currentWeather.hasWeatherData,
              observedAt: currentWeather.sourceUpdatedLabel,
              temperatureF:
                currentWeather.temperatureLabel === "--"
                  ? null
                  : Number.parseInt(currentWeather.temperatureLabel, 10),
              windSpeedMph:
                currentWeather.windLabel === "Not available"
                  ? null
                  : Number.parseInt(currentWeather.windLabel, 10),
              windDirection:
                stationWindDirection === "Unavailable"
                  ? null
                  : stationWindDirection,
              precipProbability: currentWeather.precipProbability,
              weatherCode: null,
            },
            alerts: {
              available: false,
              hasActiveAlert: false,
              primaryEvent: null,
              primarySeverity: null,
              primaryCertainty: null,
            },
            forecast: {
              available: false,
              dailyLowF: null,
            },
          }
        : null,
    [
      advisory,
      currentWeather,
      officialCondition,
      restriction,
      roadLocation,
      roadReport,
      roadSuggestionsReady,
      stationObservedAt,
      stationWindDirection,
    ],
  );

  const suggestionDecision = useMemo(
    () => (suggestionInput ? evaluateSuggestions(suggestionInput) : null),
    [suggestionInput],
  );

  const roadViewModel = useMemo(
    () =>
      roadLocation
        ? buildRoadViewModel({
            selectedLocation: roadLocation,
            routeLabel,
            currentWeather,
            roadReport,
            wydotNotice,
            officialCondition,
            advisory,
            restriction,
            stationObservedAt,
            stationAirTemp,
            stationSurfaceTemp,
            stationWindAvg,
            stationWindGust,
            stationWindDirection,
            suggestionDecision,
            weatherCaution,
          })
        : null,
    [
      advisory,
      currentWeather,
      officialCondition,
      restriction,
      roadLocation,
      roadReport,
      routeLabel,
      stationAirTemp,
      stationObservedAt,
      stationSurfaceTemp,
      stationWindAvg,
      stationWindDirection,
      stationWindGust,
      suggestionDecision,
      weatherCaution,
      wydotNotice,
    ],
  );

  const outlookItems = useMemo(
    () =>
      buildRoadOutlookItems(
        stationAirTemp !== "Unavailable"
          ? stationAirTemp
          : currentWeather.temperatureLabel,
        precipLabel,
      ),
    [currentWeather.temperatureLabel, precipLabel, stationAirTemp],
  );

  const actionDestination = useMemo(
    () => getRoadActionDestination(suggestionDecision?.primary?.code),
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

  function handleRoadAction() {
    if (actionDestination === "alerts") {
      router.push("/alerts");
      return;
    }

    if (actionDestination === "conditions") {
      router.push("/conditions");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
        <Text>
          Title: {roadViewModel?.topTitle ?? selectedLocation?.name ?? "Road"}
        </Text>
        <Text>
          Updated:{" "}
          {roadViewModel?.updatedLabel ??
            (selectedLocation
              ? formatCityState(selectedLocation)
              : "No active location selected")}
        </Text>
        <Text>Status: {roadViewModel?.statusTitle ?? "Collecting road guidance"}</Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text>---</Text>
      </View>
      <RoadSegmentsPrototype />
    </SafeAreaView>
  );
}
