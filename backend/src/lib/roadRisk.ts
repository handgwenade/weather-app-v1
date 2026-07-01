import { ROAD_RISK_THRESHOLDS } from "../../../utils/roadRiskThresholds";

export type SegmentPrimaryStation = {
  stationId: string;
  stationName: string | null;
  latitude: number | null;
  longitude: number | null;
  observedAt: string | null;
  airTempF: number | null;
  windSpeedMph: number | null;
  windGustMph: number | null;
  visibilityMi: number | null;
  roadSurfaceTempF: number | null;
  roadStateCode: number | null;
  roadStateLabel: string | null;
  sourceProvider: string | null;
};

export type OfficialSegmentCondition = {
  officialConditionLabel: string | null;
  officialConditionDescription: string | null;
  officialRestriction: string | null;
};

export type SegmentImpact = {
  level: "unknown" | "low" | "moderate" | "high" | "closed";
  reason: string;
};

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function isDryRoadState(code: number | null, label: string | null) {
  const normalizedLabel = label?.trim().toLowerCase() ?? "";

  return (
    code === 1 ||
    normalizedLabel === "dry" ||
    normalizedLabel === "clear" ||
    normalizedLabel === "none" ||
    normalizedLabel === "none reported"
  );
}

function hasRoadStateSignal(code: number | null, label: string | null) {
  return code !== null || hasText(label);
}

function formatVisibility(value: number) {
  return value.toFixed(1);
}

function getOfficialConditionImpact(
  officialCondition: OfficialSegmentCondition,
): SegmentImpact | null {
  if (hasText(officialCondition.officialRestriction)) {
    return {
      level: "high",
      reason: `Official WYDOT restriction: ${officialCondition.officialRestriction}`,
    };
  }

  const officialText = [
    officialCondition.officialConditionLabel,
    officialCondition.officialConditionDescription,
  ]
    .filter(hasText)
    .join(" ");

  if (!officialText) {
    return null;
  }

  if (/\b(closed|closure|black ice|no unnecessary travel)\b/i.test(officialText)) {
    return {
      level: "high",
      reason: `Official WYDOT condition: ${officialCondition.officialConditionDescription ?? officialCondition.officialConditionLabel}`,
    };
  }

  return {
    level: "moderate",
    reason: `Official WYDOT condition: ${officialCondition.officialConditionDescription ?? officialCondition.officialConditionLabel}`,
  };
}

export function computeSegmentImpact(
  primaryStation: SegmentPrimaryStation | null,
  officialCondition: OfficialSegmentCondition = {
    officialConditionLabel: null,
    officialConditionDescription: null,
    officialRestriction: null,
  },
): SegmentImpact {
  const officialImpact = getOfficialConditionImpact(officialCondition);

  if (officialImpact?.level === "high" || officialImpact?.level === "closed") {
    return officialImpact;
  }

  if (!primaryStation) {
    return (
      officialImpact ?? {
        level: "unknown",
        reason: "Primary station observations unavailable",
      }
    );
  }

  const {
    windSpeedMph,
    windGustMph,
    visibilityMi,
    roadStateCode,
    roadStateLabel,
    roadSurfaceTempF,
  } = primaryStation;

  const nonDryRoad =
    hasRoadStateSignal(roadStateCode, roadStateLabel) &&
    !isDryRoadState(roadStateCode, roadStateLabel);
  const severeVisibility =
    visibilityMi !== null &&
    visibilityMi <= ROAD_RISK_THRESHOLDS.visibility.highMi;
  const reducedVisibility =
    visibilityMi !== null &&
    visibilityMi <= ROAD_RISK_THRESHOLDS.visibility.moderateMi;
  const severeSustainedWind =
    windSpeedMph !== null &&
    windSpeedMph >= ROAD_RISK_THRESHOLDS.wind.highSustainedMph;
  const severeWindGust =
    windGustMph !== null &&
    windGustMph >= ROAD_RISK_THRESHOLDS.wind.highGustMph;
  const elevatedSustainedWind =
    windSpeedMph !== null &&
    windSpeedMph >= ROAD_RISK_THRESHOLDS.wind.moderateSustainedMph;
  const elevatedWindGust =
    windGustMph !== null &&
    windGustMph >= ROAD_RISK_THRESHOLDS.wind.moderateGustMph;
  const highFreezeRisk =
    nonDryRoad &&
    roadSurfaceTempF !== null &&
    roadSurfaceTempF <= ROAD_RISK_THRESHOLDS.roadSurface.highNonDryF;
  const moderateFreezeRisk =
    nonDryRoad &&
    roadSurfaceTempF !== null &&
    roadSurfaceTempF <= ROAD_RISK_THRESHOLDS.roadSurface.moderateNonDryF;

  if (severeWindGust) {
    return {
      level: "high",
      reason: `Severe wind gusts at ${Math.round(windGustMph)} mph`,
    };
  }

  if (severeSustainedWind) {
    return {
      level: "high",
      reason: `Severe sustained wind near ${Math.round(windSpeedMph)} mph`,
    };
  }

  if (severeVisibility) {
    return {
      level: "high",
      reason: `Visibility severely reduced to ${formatVisibility(visibilityMi)} miles`,
    };
  }

  if (highFreezeRisk) {
    return {
      level: "high",
      reason: `Road surface ${Math.round(roadSurfaceTempF)}°F with ${roadStateLabel ?? "non-dry"} conditions`,
    };
  }

  if (officialImpact) {
    return officialImpact;
  }

  if (elevatedWindGust) {
    return {
      level: "moderate",
      reason: `Wind gusts at ${Math.round(windGustMph)} mph`,
    };
  }

  if (elevatedSustainedWind) {
    return {
      level: "moderate",
      reason: `Sustained wind near ${Math.round(windSpeedMph)} mph`,
    };
  }

  if (reducedVisibility) {
    return {
      level: "moderate",
      reason: `Visibility reduced to ${formatVisibility(visibilityMi)} miles`,
    };
  }

  if (moderateFreezeRisk) {
    return {
      level: "moderate",
      reason: `Road surface ${Math.round(roadSurfaceTempF)}°F with ${roadStateLabel ?? "non-dry"} conditions`,
    };
  }

  if (nonDryRoad) {
    return {
      level: "moderate",
      reason: roadStateLabel ?? "Non-dry road state reported",
    };
  }

  return {
    level: "low",
    reason: "No elevated road risk detected from current station observations",
  };
}
