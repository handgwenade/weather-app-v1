import QuickSwitchModal from "@/components/quickSwitchModal";
import { RoadMapPreviewCard } from "@/components/road/RoadMapPreviewCard";
import RoadScreenV2, {
  type RoadActionDestination,
  type RoadBullet,
  type RoadMetric,
  type RoadOutlookItem,
  type RoadTone,
} from "@/components/road/RoadScreenV2";
import RoadSegmentsPrototype from "@/components/road/RoadSegmentsPrototype";
import {
  type AppLocation,
  formatCityState,
  setSelectedLocation,
  useSavedLocations,
  useSelectedLocation,
} from "@/data/locationStore";
import {
  getSharedCurrentWeather,
  getSharedHourlyForecast,
} from "@/data/weatherStore";
import { getActiveAlertsForLocation } from "@/services/nws";
import type { TomorrowHourlyForecastEntry } from "@/services/tomorrow";
import {
  getWydotRoadReport,
  type WydotOfficialRoadStatus,
  type WydotRoadReport,
  type WydotStationObservation,
} from "@/services/wydot";
import {
  buildFutureTimeLabels24Hour,
  formatTime24Hour,
  formatUpdatedTimeLabel,
} from "@/utils/dateTime";
import {
  evaluateSuggestions,
  getSuggestionPresentation,
  type RuleMatch,
  SuggestionCode,
  type SuggestionDecision,
  type SuggestionInput,
} from "@/utils/suggestions";
import { celsiusToFahrenheit, metersPerSecondToMph } from "@/utils/weather";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

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
  hourlyForecast: TomorrowHourlyForecastEntry[];
  alertEvent: string | null;
  roadSuggestionsReady: boolean;
};

const WYDOT_WEB_UNAVAILABLE_NOTICE =
  "WYDOT road data is currently unavailable on web. Check official road sources before travel.";
const WYDOT_UNAVAILABLE_RECOMMENDATION =
  "Road-specific WYDOT data could not be retrieved right now. Use alerts and weather as supplemental guidance.";

const INITIAL_CURRENT_WEATHER: RoadCurrentWeatherSnapshot = {
  temperatureLabel: "Loading...",
  windLabel: "Loading...",
  precipProbability: null,
  sourceUpdatedLabel: null,
  fallbackRefreshLabel: null,
  hasWeatherData: true,
};

const EMPTY_WYDOT_OFFICIAL_STATUS: WydotOfficialRoadStatus = {
  hasOfficialStatus: false,
  type: "none",
  impact: "none",
  title: "",
  description: "",
  source: "wydot",
  lastUpdated: null,
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

  return formatTime24Hour(value) ?? value;
}

function formatUpdatedLabel(
  sourceTimestamp: string | null,
  fallbackLabel: string | null,
) {
  return formatUpdatedTimeLabel({
    sourceTimestamp,
    fallbackLabel,
  });
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

function getOfficialRoadStatus(report: WydotRoadReport | null) {
  return (
    report?.primarySegment.officialRoadStatus ?? EMPTY_WYDOT_OFFICIAL_STATUS
  );
}

function hasOfficialWydotStatus(status: WydotOfficialRoadStatus) {
  return status.hasOfficialStatus && status.type !== "none";
}

function getOfficialStatusRouteLabel(report: WydotRoadReport | null) {
  if (!report) {
    return null;
  }

  return `${report.routeCode} near ${report.townGroup}`;
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

  const officialRoadStatus = getOfficialRoadStatus(report);

  if (hasOfficialWydotStatus(officialRoadStatus)) {
    bullets.push(
      `${officialRoadStatus.title}: ${officialRoadStatus.description}`,
    );
  } else if (restriction !== "None reported" && restriction !== "Unavailable") {
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
  const labels = buildFutureTimeLabels24Hour(5, 3);
  const deltas = [0, -2, -4, -6, -8];

  return labels.map((label, index) => ({
    id: `${label}-${index}`,
    time: label,
    temperature: `${baseTemp + deltas[index]}°`,
    condition,
  }));
}

function buildUnavailableRoadOutlookItems(): RoadOutlookItem[] {
  return buildFutureTimeLabels24Hour(5, 3).map((label, index) => ({
    id: `unavailable-${index}`,
    time: label,
    temperature: "--",
    condition: "Unavailable",
  }));
}

type RoadAlertFeature = {
  properties?: {
    event?: string;
  };
};

const STRONG_WIND_ALERT_REGEX = /\b(wind|gust|blowing)\b/i;
const WINTER_ALERT_REGEX = /\b(snow|ice|winter|blizzard)\b/i;
const FIRE_ALERT_REGEX = /\b(fire|red flag)\b/i;

function hasUsableSourceText(value: string | null) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return (
    normalized !== "" &&
    normalized !== "none" &&
    normalized !== "none reported" &&
    normalized !== "unavailable" &&
    normalized !== "loading..."
  );
}

function getAlertHazardRank(eventText: string) {
  if (WINTER_ALERT_REGEX.test(eventText)) {
    return 0;
  }

  if (STRONG_WIND_ALERT_REGEX.test(eventText)) {
    return 1;
  }

  if (FIRE_ALERT_REGEX.test(eventText)) {
    return 2;
  }

  return 3;
}

function selectPrimaryRoadAlertEvent(
  features: RoadAlertFeature[] | undefined,
): string | null {
  if (!features || features.length === 0) {
    return null;
  }

  const rankedEvents = features
    .map((feature, index) => ({
      event: feature.properties?.event?.trim() ?? null,
      index,
    }))
    .filter((item): item is { event: string; index: number } =>
      hasUsableSourceText(item.event),
    )
    .sort((left, right) => {
      const rankDelta =
        getAlertHazardRank(left.event) - getAlertHazardRank(right.event);

      if (rankDelta !== 0) {
        return rankDelta;
      }

      return left.index - right.index;
    });

  return rankedEvents[0]?.event ?? null;
}

function getRoadLocationLabel(location: AppLocation) {
  return formatCityState(location);
}

function getRoadMapFocusCoordinate(roadLocation: AppLocation | null) {
  if (!roadLocation) {
    return null;
  }

  return {
    latitude: roadLocation.latitude,
    longitude: roadLocation.longitude,
  };
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

function hasMeaningfulRoadText(value: string | null) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return (
    normalized !== "" &&
    normalized !== "none" &&
    normalized !== "none reported" &&
    normalized !== "unavailable"
  );
}

function hasMeaningfulOfficialCondition(value: string) {
  return hasMeaningfulRoadText(value) && value.trim().toLowerCase() !== "dry";
}

function buildObservedWindTitle(windValue: string) {
  return hasMeaningfulRoadText(windValue)
    ? `Observed wind: ${windValue}`
    : "Current weather observation";
}

function getRoadStatusTitle(
  primarySuggestion: RuleMatch,
  params: {
    alertEvent: string | null;
    advisory: string;
    currentWeather: RoadCurrentWeatherSnapshot;
    officialCondition: string;
    restriction: string;
    windValue: string;
    roadReport: WydotRoadReport | null;
  },
): string {
  const {
    alertEvent,
    advisory,
    currentWeather,
    officialCondition,
    restriction,
    windValue,
    roadReport,
  } = params;

  const officialRoadStatus = getOfficialRoadStatus(roadReport);

  switch (primarySuggestion?.code) {
    case SuggestionCode.ROAD_CLOSED:
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
      return hasOfficialWydotStatus(officialRoadStatus)
        ? officialRoadStatus.title
        : hasMeaningfulRoadText(restriction)
          ? "WYDOT restriction"
          : "No active WYDOT restriction reported";
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
      return hasOfficialWydotStatus(officialRoadStatus)
        ? officialRoadStatus.title
        : hasMeaningfulRoadText(advisory)
          ? "WYDOT advisory"
          : "No active WYDOT advisory reported";
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return hasUsableSourceText(alertEvent)
        ? (alertEvent ?? "Official alert reported")
        : "Official alert reported";
    case SuggestionCode.HIGH_WIND_CAUTION:
      return buildObservedWindTitle(windValue);
    case SuggestionCode.USE_CAUTION:
      return hasMeaningfulOfficialCondition(officialCondition)
        ? officialCondition
        : "Weather-based road caution";

    case SuggestionCode.DRIFTING_CONCERN:
      return hasMeaningfulOfficialCondition(officialCondition)
        ? officialCondition
        : "Drifting concern";
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
      return "WYDOT road data unavailable";
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return "Weather data unavailable";
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
    default:
      return "No active WYDOT restriction or advisory reported";
  }
}

function getRoadStatusSubtitle(
  primarySuggestion: RuleMatch,
  params: {
    alertEvent: string | null;
    advisory: string;
    officialCondition: string;
    restriction: string;
    roadReport: WydotRoadReport | null;
    weatherCaution: string;
    windValue: string;
    wydotNotice: string;
  },
) {
  const {
    alertEvent,
    advisory,
    officialCondition,
    restriction,
    roadReport,
    weatherCaution,
    windValue,
    wydotNotice,
  } = params;
  const officialRoadStatus = getOfficialRoadStatus(roadReport);

  switch (primarySuggestion?.code) {
    case SuggestionCode.ROAD_CLOSED:
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
      return hasOfficialWydotStatus(officialRoadStatus)
        ? officialRoadStatus.description
        : (getOfficialStatusRouteLabel(roadReport) ??
            "Official WYDOT status detail unavailable.");
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return hasUsableSourceText(alertEvent)
        ? "Official alert for this location."
        : "Official guidance is active for this area.";
    case SuggestionCode.HIGH_WIND_CAUTION:
      return hasMeaningfulOfficialCondition(officialCondition)
        ? `Surface: ${officialCondition}`
        : buildObservedWindTitle(windValue);
    case SuggestionCode.USE_CAUTION:
      return hasMeaningfulOfficialCondition(officialCondition)
        ? `Surface: ${officialCondition}`
        : weatherCaution;
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
      return roadReport
        ? (primarySuggestion.whyBullets[0] ?? "Road guidance is limited.")
        : wydotNotice ||
            "WYDOT road data is limited for this location right now.";
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return (
        primarySuggestion.whyBullets[0] ??
        "Weather guidance is limited for this location."
      );
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
    default:
      return roadReport
        ? `${roadReport.routeCode} near ${roadReport.townGroup}`
        : "No active restrictions or advisories reported.";
  }
}

function buildRoadRecommendationText(
  primarySuggestion: RuleMatch | null,
  params: {
    alertEvent: string | null;
    advisory: string;
    officialCondition: string;
    restriction: string;
    windValue: string;
    roadReport: WydotRoadReport | null;
    wydotNotice: string;
  },
) {
  const { advisory, officialCondition, restriction, roadReport, wydotNotice } =
    params;
  const officialRoadStatus = getOfficialRoadStatus(roadReport);

  if (hasOfficialWydotStatus(officialRoadStatus)) {
    return `${officialRoadStatus.title}: ${officialRoadStatus.description}`;
  }

  if (hasMeaningfulRoadText(restriction)) {
    return `Restriction: ${restriction}`;
  }

  if (hasMeaningfulRoadText(advisory)) {
    return `Advisory: ${advisory}`;
  }

  switch (primarySuggestion?.code) {
    case SuggestionCode.HIGH_WIND_CAUTION:
      return "Observed wind is elevated. Use extra caution on exposed road segments.";

    case SuggestionCode.USE_CAUTION:
      return hasMeaningfulOfficialCondition(officialCondition)
        ? `Current surface report: ${officialCondition}. Use extra caution and keep monitoring conditions.`
        : "Weather conditions may affect travel. Continue monitoring before travel.";

    case SuggestionCode.DRIFTING_CONCERN:
      return "Wind and snow conditions support drifting concern. Watch exposed areas.";

    case SuggestionCode.FREEZE_RISK_TONIGHT:
      return "Temperatures are forecast to drop toward freezing. Monitor overnight road conditions.";

    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
      return process.env.EXPO_OS === "web" || wydotNotice
        ? WYDOT_UNAVAILABLE_RECOMMENDATION
        : "Road-specific detail is limited right now.";

    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return "Road detail is limited right now.";

    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
      return hasMeaningfulOfficialCondition(officialCondition)
        ? `Current surface report: ${officialCondition}. Continue routine monitoring.`
        : "No active WYDOT restriction or advisory is reported right now. Continue routine monitoring.";

    default:
      return hasMeaningfulOfficialCondition(officialCondition)
        ? `Current surface report: ${officialCondition}. Continue monitoring.`
        : "No road-specific restriction or advisory is reported right now. Continue monitoring.";
  }
}

function buildRoadSourceBullets(
  fallbackBullets: RoadBullet[],
  params: {
    alertEvent: string | null;
    advisory: string;
    officialCondition: string;
    restriction: string;
    roadReport: WydotRoadReport | null;
    stationAirTemp: string;
    stationSurfaceTemp: string;
    windValue: string;
    weatherCaution: string;
    precipProbability: number | null;
  },
): RoadBullet[] {
  const {
    alertEvent,
    advisory,
    officialCondition,
    restriction,
    roadReport,
    stationAirTemp,
    stationSurfaceTemp,
    windValue,
    weatherCaution,
    precipProbability,
  } = params;
  const bulletTexts: string[] = [];
  const officialRoadStatus = getOfficialRoadStatus(roadReport);

  if (hasOfficialWydotStatus(officialRoadStatus)) {
    bulletTexts.push(
      `${officialRoadStatus.title}: ${officialRoadStatus.description}`,
    );
  } else {
    if (hasMeaningfulRoadText(restriction)) {
      bulletTexts.push(`Restriction: ${restriction}`);
    }

    if (hasMeaningfulRoadText(advisory)) {
      bulletTexts.push(`Advisory: ${advisory}`);
    }
  }

  if (hasUsableSourceText(alertEvent)) {
    bulletTexts.push(`Alert: ${alertEvent}`);
  }

  if (hasMeaningfulOfficialCondition(officialCondition)) {
    bulletTexts.push(`Surface: ${officialCondition}`);
  }

  if (weatherCaution.toLowerCase().includes("freezing")) {
    bulletTexts.push(weatherCaution.replace(/^Use caution:\s*/i, ""));
  }

  if (hasMeaningfulRoadText(stationSurfaceTemp)) {
    bulletTexts.push(`Road temp: ${stationSurfaceTemp}`);
  }

  if (hasMeaningfulRoadText(stationAirTemp)) {
    bulletTexts.push(`Air temp: ${stationAirTemp}`);
  }

  if (typeof precipProbability === "number" && precipProbability > 0) {
    bulletTexts.push(
      `Precip prob: ${formatProbabilityValue(precipProbability)}`,
    );
  }

  if (hasMeaningfulRoadText(windValue)) {
    bulletTexts.push(`Wind: ${windValue}`);
  }

  if (bulletTexts.length === 0 && roadReport) {
    bulletTexts.push(
      `Corridor: ${roadReport.routeCode} near ${roadReport.townGroup}`,
    );
  }

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
  alertEvent: string | null;
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
    alertEvent,
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
  const statusTitle = primarySuggestion
    ? getRoadStatusTitle(primarySuggestion, {
        alertEvent,
        advisory,
        currentWeather,
        officialCondition,
        restriction,
        windValue: windMetricValue,
        roadReport,
      })
    : "Collecting road guidance";
  const statusSubtitle = primarySuggestion
    ? getRoadStatusSubtitle(primarySuggestion, {
        alertEvent,
        advisory,
        officialCondition,
        restriction,
        roadReport,
        weatherCaution,
        windValue: windMetricValue,
        wydotNotice,
      })
    : "Checking current road and weather signals for this location.";
  const recommendationText = buildRoadRecommendationText(primarySuggestion, {
    alertEvent,
    advisory,
    officialCondition,
    restriction,
    windValue: windMetricValue,
    roadReport,
    wydotNotice,
  });
  const riskLevel = primaryPresentation?.levelLabel ?? "Unavailable";

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
    riskLevelLabel: riskLevel,
    riskBullets: buildRoadSourceBullets(fallbackRiskBullets, {
      alertEvent,
      advisory,
      officialCondition,
      restriction,
      roadReport,
      stationAirTemp,
      stationSurfaceTemp,
      windValue: windMetricValue,
      weatherCaution,
      precipProbability: currentWeather.precipProbability,
    }),
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

  const officialRoadStatus = getOfficialRoadStatus(report);

  if (hasOfficialWydotStatus(officialRoadStatus)) {
    return `${officialRoadStatus.title} near ${townGroup}. ${officialRoadStatus.description}`;
  }

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
  const [hourlyForecast, setHourlyForecast] = useState<
    TomorrowHourlyForecastEntry[]
  >([]);
  const [alertEvent, setAlertEvent] = useState<string | null>(null);
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
        setHourlyForecast([]);
        setAlertEvent(null);
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
      setHourlyForecast([]);
      setAlertEvent(null);
      setWydotNotice("");
      setRoadSummary("Loading road conditions...");
      setWeatherCaution("Loading weather guidance...");
      setCurrentWeather(INITIAL_CURRENT_WEATHER);
      setRoadReport(null);

      const [weatherResult, hourlyResult, wydotResult, alertsResult] =
        await Promise.allSettled([
          getSharedCurrentWeather(roadLocation),
          getSharedHourlyForecast(roadLocation),
          getWydotRoadReport(roadLocation),
          getActiveAlertsForLocation(
            roadLocation.latitude,
            roadLocation.longitude,
          ),
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

      if (hourlyResult.status === "fulfilled") {
        setHourlyForecast(hourlyResult.value.timelines?.hourly ?? []);
      } else {
        setHourlyForecast([]);
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
        setWydotNotice(
          process.env.EXPO_OS === "web"
            ? WYDOT_WEB_UNAVAILABLE_NOTICE
            : "WYDOT road data is temporarily unavailable.",
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

      if (alertsResult.status === "fulfilled") {
        setAlertEvent(
          selectPrimaryRoadAlertEvent(
            alertsResult.value.features as RoadAlertFeature[] | undefined,
          ),
        );
      } else {
        setAlertEvent(null);
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
    hourlyForecast,
    alertEvent,
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
    alertEvent,
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
              restriction: hasMeaningfulRoadText(restriction)
                ? restriction
                : null,
              advisory: hasMeaningfulRoadText(advisory) ? advisory : null,
              officialCondition: hasMeaningfulRoadText(officialCondition)
                ? officialCondition
                : null,
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
              available: alertEvent !== null,
              hasActiveAlert: alertEvent !== null,
              primaryEvent: alertEvent,
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
      alertEvent,
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
            alertEvent,
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
      alertEvent,
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
  const unavailableOutlookItems = useMemo(
    () => buildUnavailableRoadOutlookItems(),
    [],
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

  const roadMapFocusCoordinate = getRoadMapFocusCoordinate(roadLocation);

  const prototypeFallbackObservation = roadLocation
    ? {
        corridorLabel:
          routeLabel === "Loading WYDOT corridor..."
            ? "Nearest road conditions"
            : routeLabel,
        observedAt: stationObservedAt,
        airTemp: stationAirTemp,
        roadTemp: stationSurfaceTemp,
        wind:
          stationWindAvg !== "Unavailable" &&
          stationWindDirection !== "Unavailable"
            ? `${stationWindAvg} ${stationWindDirection}`
            : currentWeather.windLabel,
        note: (() => {
          const officialRoadStatus = getOfficialRoadStatus(roadReport);

          if (hasOfficialWydotStatus(officialRoadStatus)) {
            return `${officialRoadStatus.title}: ${officialRoadStatus.description}`;
          }

          if (officialCondition !== "Unavailable") {
            return `Surface: ${officialCondition}`;
          }

          return "Nearest road observation data is unavailable right now.";
        })(),
      }
    : null;

  const prototypeSection = (
    <View style={{ gap: 16 }}>
      <RoadMapPreviewCard
        routeLabel={routeLabel}
        focusCoordinate={roadMapFocusCoordinate}
      />

      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "rgba(202, 213, 226, 0.4)",
          paddingHorizontal: 17,
          paddingTop: 17,
          paddingBottom: 16,
        }}
      >
        <Text
          style={{
            color: "#0F172B",
            fontSize: 18,
            fontWeight: "700",
            lineHeight: 27,
            letterSpacing: -0.44,
          }}
        >
          Road conditions
        </Text>
        <View style={{ marginTop: 12 }}>
          <RoadSegmentsPrototype
            defaultSortMode="nearest"
            listLabel="Road conditions"
            selectedCoordinates={
              roadLocation
                ? {
                    latitude: roadLocation.latitude,
                    longitude: roadLocation.longitude,
                  }
                : null
            }
            fallbackObservation={prototypeFallbackObservation}
          />
        </View>
      </View>
    </View>
  );

  if (!selectedLocation || !roadViewModel) {
    return (
      <>
        <RoadScreenV2
          topTitle={selectedLocation?.name ?? "Road"}
          updatedLabel="Updated"
          notices={[]}
          locationFieldLabel={
            selectedLocation
              ? formatLocationFieldLabel(selectedLocation)
              : "No active location selected"
          }
          onPressSettings={() => router.push("/settings")}
          onPressLocationSearch={() => setSwitchModalVisible(true)}
          statusTitle="Collecting road guidance"
          statusSubtitle="Choose a location to see current road conditions."
          statusLabel="Unavailable"
          statusTone="neutral"
          actionLabel="Monitor"
          actionDestination="details"
          onPressAction={handleRoadAction}
          recommendationText="Select a saved location to load road guidance and the temporary segment prototype."
          currentConditions={[
            { id: "air", label: "Air Temp", value: "Unavailable" },
            { id: "road", label: "Road Temp", value: "Unavailable" },
            { id: "wind", label: "Wind", value: "Unavailable" },
            { id: "gusts", label: "Gusts", value: "Unavailable" },
            { id: "precip-prob", label: "Precip Prob", value: "--" },
            { id: "updated", label: "Last Updated", value: "Unavailable" },
          ]}
          riskLevelLabel="Unavailable"
          riskBullets={[
            {
              id: "fallback-risk-0",
              text: "Add or select a saved location to load local road guidance.",
            },
          ]}
          confidenceLabel="Confidence: Low"
          outlookItems={unavailableOutlookItems}
          extraSection={prototypeSection}
        />

        <QuickSwitchModal
          visible={switchModalVisible}
          title="Select Saved Road Location"
          subtitle="Choose which saved place Road should monitor right now."
          currentLocationId={selectedLocation?.id ?? null}
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

  return (
    <>
      <RoadScreenV2
        topTitle={roadViewModel.topTitle}
        updatedLabel={roadViewModel.updatedLabel}
        notices={roadViewModel.notices}
        locationFieldLabel={roadViewModel.locationFieldLabel}
        onPressSettings={() => router.push("/settings")}
        onPressLocationSearch={() => setSwitchModalVisible(true)}
        statusTitle={roadViewModel.statusTitle}
        statusSubtitle={roadViewModel.statusSubtitle}
        statusLabel={roadViewModel.statusLabel}
        statusTone={roadViewModel.statusTone}
        actionLabel={roadViewModel.actionLabel}
        actionDestination={actionDestination}
        onPressAction={handleRoadAction}
        recommendationText={roadViewModel.recommendationText}
        currentConditions={roadViewModel.currentConditions}
        riskLevelLabel={roadViewModel.riskLevelLabel}
        riskBullets={roadViewModel.riskBullets}
        confidenceLabel={roadViewModel.confidenceLabel}
        outlookItems={outlookItems}
        extraSection={prototypeSection}
      />

      <QuickSwitchModal
        visible={switchModalVisible}
        title="Select Saved Road Location"
        subtitle="Choose which saved place Road should monitor right now."
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
