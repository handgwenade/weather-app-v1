import type {
  HomeBullet,
  HomeLocationCard,
  HomeMetric,
  HomeMonitoringCard,
  HomeStatusBanner,
} from "@/components/home/HomeScreenV2";
import type { TomorrowHourlyForecastEntry } from "@/services/tomorrow";
import type {
  WydotOfficialRoadStatus,
  WydotRoadReport,
} from "@/services/wydot";
import { getHomeCardStateLabel } from "@/utils/homePerformance";
import {
  formatPercentValue,
  formatRoundedNumber,
  formatTemperatureValue,
  formatUpdatedLabel,
  formatWindValue,
  getHomeMetricFreshnessLabel,
  getNextHomePrecipSignal,
  isHomeWintryConditionLabel,
  type HomeAlertSummary,
  type HomeCurrentWeatherSnapshot,
  type HomeDataState,
  type PropertyRisk,
} from "@/utils/homeWeatherFormatting";
import {
  getSuggestionPresentation,
  SuggestionCode,
  type RuleMatch,
  type SuggestionDecision,
} from "@/utils/suggestions";

export type HomeViewModel = {
  updatedLabel: string;
  nextPrecipSignal: ReturnType<typeof getNextHomePrecipSignal>;
  metrics: HomeMetric[];
  statusBanner: HomeStatusBanner;
  monitoringCard: HomeMonitoringCard;
  monitoredLocationCard: HomeLocationCard;
};

const EMPTY_HOME_WYDOT_OFFICIAL_STATUS: WydotOfficialRoadStatus = {
  hasOfficialStatus: false,
  type: "none",
  impact: "none",
  title: "",
  description: "",
  source: "wydot",
  lastUpdated: null,
};

function formatHomeAlertAreaSubtitle(area: string | null) {
  if (!area) {
    return "Affects nearby areas";
  }

  const primaryArea = area
    .split(";")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find((part) => part.length > 0);

  if (!primaryArea) {
    return "Affects nearby areas";
  }

  return `${primaryArea} & surrounding travel areas`;
}

function hasMeaningfulHomeText(value: string | null) {
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

function hasMeaningfulHomeSurfaceCondition(report: WydotRoadReport | null) {
  const condition = report?.primarySegment.officialCondition ?? null;

  return (
    condition !== null &&
    hasMeaningfulHomeText(condition) &&
    condition.trim().toLowerCase() !== "dry"
  );
}

function getHomeOfficialRoadStatus(report: WydotRoadReport | null) {
  return (
    report?.primarySegment.officialRoadStatus ??
    EMPTY_HOME_WYDOT_OFFICIAL_STATUS
  );
}

function hasHomeOfficialWydotStatus(status: WydotOfficialRoadStatus) {
  return status.hasOfficialStatus && status.type !== "none";
}

function getHomeOfficialStatusSubtitle(
  officialRoadStatus: WydotOfficialRoadStatus,
): string | null {
  if (!hasHomeOfficialWydotStatus(officialRoadStatus)) {
    return null;
  }

  if (hasMeaningfulHomeText(officialRoadStatus.description)) {
    return officialRoadStatus.description;
  }

  return null;
}

function getHomeOfficialStatusRecommendation(
  officialRoadStatus: WydotOfficialRoadStatus,
): string | null {
  if (!hasHomeOfficialWydotStatus(officialRoadStatus)) {
    return null;
  }

  if (hasMeaningfulHomeText(officialRoadStatus.description)) {
    return `${officialRoadStatus.title}: ${officialRoadStatus.description}.`;
  }

  if (hasMeaningfulHomeText(officialRoadStatus.title)) {
    return `${officialRoadStatus.title}.`;
  }

  return null;
}

function getHomeObservedConditionTitle(
  currentWeather: HomeCurrentWeatherSnapshot,
) {
  if (hasMeaningfulHomeText(currentWeather.conditionLabel)) {
    return currentWeather.conditionLabel;
  }

  if (currentWeather.windSpeedMph !== null) {
    return `Observed wind: ${Math.round(currentWeather.windSpeedMph)} mph`;
  }

  return "Current weather observation";
}

function getHomeMonitoredImpactLabel(params: {
  alertSummary: HomeAlertSummary;
  roadReport: WydotRoadReport | null;
  suggestionDecision: SuggestionDecision | null;
}) {
  const { alertSummary, roadReport, suggestionDecision } = params;

  const officialRoadStatus = getHomeOfficialRoadStatus(roadReport);

  if (hasHomeOfficialWydotStatus(officialRoadStatus)) {
    return "Official WYDOT status";
  }

  if (
    suggestionDecision?.secondary.find(
      (match) => match.code === SuggestionCode.FREEZE_RISK_TONIGHT,
    )
  ) {
    return "Forecast outlook";
  }

  const restriction = roadReport?.primarySegment.restriction ?? null;
  const advisory = roadReport?.primarySegment.advisory ?? null;

  if (hasMeaningfulHomeText(restriction) || hasMeaningfulHomeText(advisory)) {
    return "WYDOT update";
  }

  if (
    alertSummary.status === "active" &&
    hasMeaningfulHomeText(alertSummary.event)
  ) {
    return "Official alert";
  }

  if (
    suggestionDecision?.primary?.code ===
    SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS
  ) {
    return "Current conditions";
  }

  return suggestionDecision?.primary ? "Observed conditions" : "Awaiting data";
}

function getHomeStatusTitle(
  primarySuggestion: RuleMatch,
  params: {
    alertSummary: HomeAlertSummary;
    currentWeather: HomeCurrentWeatherSnapshot;
    propertyForecastLowF: number | null;
    roadReport: WydotRoadReport | null;
  },
): string {
  const { alertSummary, currentWeather, propertyForecastLowF, roadReport } =
    params;
  const restriction = roadReport?.primarySegment.restriction ?? null;
  const advisory = roadReport?.primarySegment.advisory ?? null;
  const surfaceCondition = roadReport?.primarySegment.officialCondition ?? null;
  const officialRoadStatus = getHomeOfficialRoadStatus(roadReport);

  switch (primarySuggestion.code) {
    case SuggestionCode.ROAD_CLOSED:
      return hasHomeOfficialWydotStatus(officialRoadStatus)
        ? officialRoadStatus.title
        : "WYDOT: Road closed";
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
      return hasHomeOfficialWydotStatus(officialRoadStatus)
        ? officialRoadStatus.title
        : "WYDOT: Travel restriction in effect";
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
      return hasHomeOfficialWydotStatus(officialRoadStatus)
        ? officialRoadStatus.title
        : "WYDOT advisory in effect";
    case SuggestionCode.VISIBILITY_RISK:
      return "Reduced visibility reported";
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return hasMeaningfulHomeText(alertSummary.event)
        ? (alertSummary.event ?? "Official alert active")
        : "Official alert active";
    case SuggestionCode.HIGH_PROFILE_VEHICLE_RISK:
      return currentWeather.windSpeedMph !== null
        ? `Observed wind: ${Math.round(currentWeather.windSpeedMph)} mph`
        : getHomeObservedConditionTitle(currentWeather);
    case SuggestionCode.FREEZE_RISK_TONIGHT:
      return propertyForecastLowF !== null
        ? `Tonight low: ${Math.round(propertyForecastLowF)}°F`
        : "Tonight forecast low";
    case SuggestionCode.HIGH_WIND_CAUTION:
      return currentWeather.windSpeedMph !== null
        ? `Observed wind: ${Math.round(currentWeather.windSpeedMph)} mph`
        : getHomeObservedConditionTitle(currentWeather);
    case SuggestionCode.USE_CAUTION:
    case SuggestionCode.DRIFTING_CONCERN:
      if (hasMeaningfulHomeSurfaceCondition(roadReport) && surfaceCondition) {
        return surfaceCondition;
      }

      return getHomeObservedConditionTitle(currentWeather);
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
      return "WYDOT road data unavailable";
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return "Weather data unavailable";
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
    default:
      return "No active WYDOT restriction or advisory reported";
  }
}

function getHomeStatusSubtitle(
  primarySuggestion: RuleMatch,
  params: {
    alertSummary: HomeAlertSummary;
    currentWeather: HomeCurrentWeatherSnapshot;
    propertyForecastLowF: number | null;
    propertyLocationName: string | null;
    propertyRisk: PropertyRisk;
    roadReport: WydotRoadReport | null;
  },
) {
  const {
    alertSummary,
    currentWeather,
    propertyForecastLowF,
    propertyLocationName,
    propertyRisk,
    roadReport,
  } = params;

  const officialRoadStatus = getHomeOfficialRoadStatus(roadReport);

  switch (primarySuggestion.code) {
    case SuggestionCode.ROAD_CLOSED:
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
    case SuggestionCode.TRAVEL_ADVISORY_POSTED: {
      const officialSubtitle =
        getHomeOfficialStatusSubtitle(officialRoadStatus);
      return officialSubtitle
        ? officialSubtitle
        : roadReport
          ? `${roadReport.routeCode} near ${roadReport.townGroup}`
          : (primarySuggestion.whyBullets[0] ?? "Road guidance is active");
    }
    case SuggestionCode.VISIBILITY_RISK:
      return roadReport
        ? `${roadReport.routeCode} near ${roadReport.townGroup}`
        : "Expect limited sight distance. Reduce speed and use extra caution.";
    case SuggestionCode.HIGH_PROFILE_VEHICLE_RISK:
      return "High-profile vehicle wind risk is present. High-profile vehicles may be at risk on exposed routes.";
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return formatHomeAlertAreaSubtitle(alertSummary.area);
    case SuggestionCode.FREEZE_RISK_TONIGHT:
      return propertyForecastLowF !== null
        ? `${propertyLocationName ?? "Property location"} forecast low: ${Math.round(propertyForecastLowF)}°F`
        : propertyRisk === "High"
          ? `${propertyLocationName ?? "Property location"} forecast low is in the freeze-risk range.`
          : `${propertyLocationName ?? "Property location"} forecast low is near the freeze threshold.`;
    case SuggestionCode.HIGH_WIND_CAUTION:
      return `Condition: ${currentWeather.conditionLabel}`;
    case SuggestionCode.USE_CAUTION:
      return hasMeaningfulHomeSurfaceCondition(roadReport)
        ? `Surface: ${roadReport?.primarySegment.officialCondition}`
        : "Weather may affect travel";
    case SuggestionCode.DRIFTING_CONCERN:
      return hasMeaningfulHomeSurfaceCondition(roadReport)
        ? `Surface: ${roadReport?.primarySegment.officialCondition}`
        : "Wind and wintry conditions may affect travel";
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return (
        primarySuggestion.whyBullets[0] ??
        "Data for this location is limited right now."
      );
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
    default:
      return roadReport
        ? `${roadReport.routeCode} near ${roadReport.townGroup}`
        : "No active restrictions or alerts reported.";
  }
}

function getHomeRecommendationText(
  primarySuggestion: RuleMatch | null,
  params: {
    alertSummary: HomeAlertSummary;
    currentWeather: HomeCurrentWeatherSnapshot;
    propertyForecastLowF: number | null;
    propertyLocationName: string | null;
    roadReport: WydotRoadReport | null;
  },
): string {
  if (!primarySuggestion) {
    return "Checking road, weather, and forecast signals for this location.";
  }

  const {
    alertSummary,
    currentWeather,
    propertyForecastLowF,
    propertyLocationName,
    roadReport,
  } = params;
  const restriction = roadReport?.primarySegment.restriction ?? null;
  const advisory = roadReport?.primarySegment.advisory ?? null;
  const surfaceCondition = roadReport?.primarySegment.officialCondition ?? null;
  const officialRoadStatus = getHomeOfficialRoadStatus(roadReport);

  switch (primarySuggestion.code) {
    case SuggestionCode.ROAD_CLOSED: {
      const officialText =
        getHomeOfficialStatusRecommendation(officialRoadStatus);
      return officialText
        ? officialText
        : hasMeaningfulHomeText(restriction)
          ? `WYDOT restriction: ${restriction}.`
          : "WYDOT: Road closed. Do not travel this segment.";
    }
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED: {
      const officialText =
        getHomeOfficialStatusRecommendation(officialRoadStatus);
      return officialText
        ? officialText
        : hasMeaningfulHomeText(restriction)
          ? `WYDOT restriction: ${restriction}.`
          : "WYDOT: Travel restriction in effect. Check WYDOT guidance before travel.";
    }
    case SuggestionCode.TRAVEL_ADVISORY_POSTED: {
      const officialText =
        getHomeOfficialStatusRecommendation(officialRoadStatus);
      return officialText
        ? officialText
        : hasMeaningfulHomeText(advisory)
          ? `WYDOT advisory: ${advisory}.`
          : "WYDOT advisory in effect. Monitor WYDOT guidance before travel.";
    }
    case SuggestionCode.VISIBILITY_RISK:
      return "Reduced visibility reported. Expect limited sight distance. Reduce speed and use extra caution.";
    case SuggestionCode.HIGH_PROFILE_VEHICLE_RISK:
      return "High-profile vehicle wind risk is present. High-profile vehicles may be at risk on exposed routes.";
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return hasMeaningfulHomeText(alertSummary.event)
        ? `Official alert: ${alertSummary.event ?? "Active alert"}.`
        : "Official alert active. Review alert details and follow agency guidance.";
    case SuggestionCode.FREEZE_RISK_TONIGHT:
      return propertyForecastLowF !== null
        ? `${propertyLocationName ?? "Property location"} forecast low is ${Math.round(propertyForecastLowF)}°F tonight.`
        : "Tonight's forecast low is near the freeze threshold.";
    case SuggestionCode.HIGH_WIND_CAUTION:
      return currentWeather.windSpeedMph !== null
        ? `Observed wind: ${Math.round(currentWeather.windSpeedMph)} mph.`
        : `Current weather observation: ${currentWeather.conditionLabel}.`;
    case SuggestionCode.USE_CAUTION:
    case SuggestionCode.DRIFTING_CONCERN:
      return hasMeaningfulHomeText(surfaceCondition)
        ? `Current road surface: ${surfaceCondition}. Weather may still affect travel.`
        : `Current weather: ${currentWeather.conditionLabel}. Continue monitoring conditions.`;
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
      return "Road-specific guidance is limited right now. Check again before travel.";
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return "Weather-based guidance is limited right now. Check again before travel.";
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
      return "No active WYDOT restrictions, advisories, or official alerts are posted right now.";
    default:
      return "Checking road, weather, and forecast signals for this location.";
  }
}

function getHomeMonitoringCard(
  decision: SuggestionDecision | null,
  params: {
    currentWeather: HomeCurrentWeatherSnapshot;
    propertyForecastLowF: number | null;
    propertyLocationName: string | null;
    propertyRisk: PropertyRisk;
    roadReport: WydotRoadReport | null;
    alertSummary: HomeAlertSummary;
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
      title:
        params.propertyForecastLowF !== null
          ? `Tonight low: ${Math.round(params.propertyForecastLowF)}°F`
          : "Tonight forecast low",
      body:
        params.propertyForecastLowF !== null
          ? `${params.propertyLocationName ?? "Property location"} forecast low is ${Math.round(params.propertyForecastLowF)}°F tonight.`
          : params.propertyRisk === "High"
            ? `${params.propertyLocationName ?? "Property location"} forecast low supports freeze protection planning.`
            : `${params.propertyLocationName ?? "Property location"} forecast low is close enough to freezing to keep under watch.`,
    };
  }

  const focusSuggestion = decision.secondary[0] ?? decision.primary ?? null;

  if (!focusSuggestion) {
    return {
      title: params.propertyLocationName
        ? "No active source signal"
        : "No property location set",
      body: params.propertyLocationName
        ? `No active WYDOT restrictions, advisories, or official alerts are posted for ${params.propertyLocationName} right now.`
        : "Set a saved property location when you want freeze-sensitive monitoring on Home.",
    };
  }

  const focusTitle = getHomeStatusTitle(focusSuggestion, {
    alertSummary: params.alertSummary,
    currentWeather: params.currentWeather,
    propertyForecastLowF: params.propertyForecastLowF,
    roadReport: params.roadReport,
  });
  const monitoringTitle =
    focusSuggestion.code === SuggestionCode.USE_CAUTION ||
    focusSuggestion.code === SuggestionCode.DRIFTING_CONCERN
      ? "Road Conditions"
      : focusTitle;

  return {
    title: monitoringTitle,
    body: getHomeRecommendationText(focusSuggestion, {
      alertSummary: params.alertSummary,
      currentWeather: params.currentWeather,
      propertyForecastLowF: params.propertyForecastLowF,
      propertyLocationName: params.propertyLocationName,
      roadReport: params.roadReport,
    }),
  };
}

export function buildHomeViewModel(params: {
  currentWeather: HomeCurrentWeatherSnapshot;
  hourlyForecast: TomorrowHourlyForecastEntry[];
  alertSummary: HomeAlertSummary;
  propertyForecastLowF: number | null;
  propertyRisk: PropertyRisk;
  propertyLocationName: string | null;
  roadReport: WydotRoadReport | null;
  roadState: HomeDataState;
  suggestionDecision: SuggestionDecision | null;
  topTitle: string;
}): HomeViewModel {
  const {
    currentWeather,
    hourlyForecast,
    alertSummary,
    propertyForecastLowF,
    propertyRisk,
    propertyLocationName,
    roadReport,
    roadState,
    suggestionDecision,
    topTitle,
  } = params;
  const observation = roadReport?.primaryStationObservation;
  const effectiveAirTempF =
    currentWeather.temperatureF ?? observation?.airTempF ?? null;
  const surfaceCondition =
    roadReport?.primarySegment.officialCondition &&
    !["None"].includes(roadReport.primarySegment.officialCondition)
      ? roadReport.primarySegment.officialCondition
      : null;
  const weatherFreshnessLabel = getHomeMetricFreshnessLabel({
    state: currentWeather.dataState,
    sourceTimestamp: currentWeather.sourceTimestamp,
    fallbackLabel: currentWeather.refreshFallbackLabel,
  });
  const roadFreshnessLabel = getHomeMetricFreshnessLabel({
    state: roadState,
    sourceTimestamp: observation?.observedAt ?? roadReport?.fetchedAt ?? null,
    fallbackLabel: null,
  });
  const windMetric = observation?.windDirection
    ? formatWindValue(observation.windAvgMph, observation.windDirection)
    : formatWindValue(currentWeather.windSpeedMph);
  const metrics: HomeMetric[] = [
    {
      label: "Air Temp",
      value: formatTemperatureValue(effectiveAirTempF),
      state:
        currentWeather.temperatureF !== null || !observation
          ? currentWeather.dataState
          : roadState,
      freshnessLabel:
        currentWeather.temperatureF !== null || !observation
          ? weatherFreshnessLabel
          : roadFreshnessLabel,
    },
    {
      label: "Road Temp",
      value:
        roadState === "loading"
          ? "--"
          : formatRoundedNumber(observation?.surfaceTempF, "°F"),
      state: roadState,
      freshnessLabel: roadFreshnessLabel,
    },
    {
      label: "Wind",
      value: windMetric,
      state: observation ? roadState : currentWeather.dataState,
      freshnessLabel: observation ? roadFreshnessLabel : weatherFreshnessLabel,
    },
    {
      label: "Gusts",
      value:
        observation?.windGustMph !== undefined &&
        observation?.windGustMph !== null
          ? formatRoundedNumber(observation.windGustMph, " mph")
          : formatRoundedNumber(currentWeather.windGustMph, " mph"),
      state: observation ? roadState : currentWeather.dataState,
      freshnessLabel: observation ? roadFreshnessLabel : weatherFreshnessLabel,
    },
    {
      label: "Precip Prob",
      value: formatPercentValue(currentWeather.precipProbability),
      state: currentWeather.dataState,
      freshnessLabel: weatherFreshnessLabel,
    },
    {
      label: "Humidity",
      value: formatPercentValue(currentWeather.humidity),
      state: currentWeather.dataState,
      freshnessLabel: weatherFreshnessLabel,
    },
  ];

  const baseUpdatedLabel = formatUpdatedLabel(
    currentWeather.sourceTimestamp,
    currentWeather.refreshFallbackLabel,
  );
  const updatedLabel =
    currentWeather.dataState === "stale" && baseUpdatedLabel !== "--"
      ? `${baseUpdatedLabel} (cached)`
      : baseUpdatedLabel;

  const nextPrecipSignal = getNextHomePrecipSignal(hourlyForecast);

  const statusBanner: HomeStatusBanner = (() => {
    if (!suggestionDecision?.primary) {
      if (currentWeather.hasWeatherData) {
        return {
          title: currentWeather.conditionLabel,
          subtitle:
            roadState === "loading" || alertSummary.status === "loading"
              ? "Road guidance and alerts are still loading."
              : "Weather is loaded while slower guidance catches up.",
          statusLabel: getHomeCardStateLabel(currentWeather.dataState),
          statusTone: currentWeather.dataState === "fresh" ? "good" : "neutral",
          actionLabel: "Monitor",
        };
      }

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
    const statusTitle = getHomeStatusTitle(primarySuggestion, {
      alertSummary,
      currentWeather,
      propertyForecastLowF,
      roadReport,
    });
    const statusSubtitle = getHomeStatusSubtitle(primarySuggestion, {
      alertSummary,
      currentWeather,
      propertyForecastLowF,
      propertyLocationName,
      propertyRisk,
      roadReport,
    });
    const shouldUsePrecipSignalFallback =
      nextPrecipSignal &&
      primarySuggestion.code === SuggestionCode.USE_CAUTION &&
      statusTitle === "Current conditions";

    return {
      title: shouldUsePrecipSignalFallback
        ? "Weather-based road caution"
        : statusTitle,
      subtitle: shouldUsePrecipSignalFallback
        ? `${nextPrecipSignal.conditionLabel} possible around ${nextPrecipSignal.timeLabel}`
        : statusSubtitle,
      statusLabel: presentation.levelLabel,
      statusTone: presentation.homeTone,
      actionLabel: presentation.actionLabel,
    };
  })();

  const baseMonitoringCard = getHomeMonitoringCard(suggestionDecision, {
    alertSummary,
    currentWeather,
    propertyForecastLowF,
    propertyLocationName,
    propertyRisk,
    roadReport,
  });
  const monitoringCard =
    nextPrecipSignal &&
    isHomeWintryConditionLabel(nextPrecipSignal.conditionLabel)
      ? {
          title: `${nextPrecipSignal.conditionLabel} possible`,
          body: `Around ${nextPrecipSignal.timeLabel}, precipitation probability is near ${nextPrecipSignal.probability}%. Current road surface: ${surfaceCondition ?? "unknown"}.`,
        }
      : baseMonitoringCard;

  const bullets: HomeBullet[] = [];

  if (effectiveAirTempF !== null) {
    bullets.push({
      id: "air-temp",
      text: `Air temp: ${formatTemperatureValue(effectiveAirTempF)}`,
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
      : roadState === "loading"
        ? "Loading"
        : getHomeCardStateLabel(currentWeather.dataState),
    statusTone: suggestionDecision?.primary
      ? getSuggestionPresentation(suggestionDecision.primary).homeTone
      : currentWeather.dataState === "fresh"
        ? "good"
        : "neutral",
    impactLabel: suggestionDecision?.primary
      ? getHomeMonitoredImpactLabel({
          alertSummary,
          roadReport,
          suggestionDecision,
        })
      : roadState === "loading"
        ? "Checking road data"
        : getHomeCardStateLabel(roadState),
  };

  return {
    updatedLabel,
    nextPrecipSignal,
    metrics,
    statusBanner,
    monitoringCard,
    monitoredLocationCard,
  };
}
