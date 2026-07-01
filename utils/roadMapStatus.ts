export const ROAD_MAP_LAYER_PLAN_COPY =
  "Green lines show monitored routes. Condition markers appear when a segment or sensor has a known status. Gray markers mean data is unavailable or status is unknown.";

export const ROAD_MAP_LEGEND_GROUP_LABELS = {
  routeLayer: "Route layer",
  conditionMarkers: "Condition markers",
} as const;

export const ROAD_MAP_STATUS_COLORS = {
  normal: "#22C77A",
  caution: "#FFD23F",
  elevated: "#FF7A1A",
  high: "#E22D4F",
  unknown: "#94A3B8",
} as const;

export type RoadMapStatus = string | null | undefined;

export function normalizeRoadMapStatus(status: RoadMapStatus) {
  const normalized =
    typeof status === "string" ? status.trim().toLowerCase() : "";

  switch (normalized) {
    case "normal":
    case "low":
      return "normal";
    case "caution":
    case "moderate":
      return "caution";
    case "elevated":
      return "elevated";
    case "high":
    case "closed":
      return "high";
    case "unknown":
    case "unavailable":
    default:
      return "unknown";
  }
}

export function getRoadMapStatusColor(status: RoadMapStatus) {
  switch (normalizeRoadMapStatus(status)) {
    case "normal":
      return ROAD_MAP_STATUS_COLORS.normal;
    case "caution":
      return ROAD_MAP_STATUS_COLORS.caution;
    case "elevated":
      return ROAD_MAP_STATUS_COLORS.elevated;
    case "high":
      return ROAD_MAP_STATUS_COLORS.high;
    case "unknown":
    default:
      return ROAD_MAP_STATUS_COLORS.unknown;
  }
}

export function getRoadMapStatusLabel(status: RoadMapStatus) {
  switch (normalizeRoadMapStatus(status)) {
    case "normal":
      return "Normal";
    case "caution":
      return "Caution";
    case "elevated":
      return "Elevated";
    case "high":
      return status === "closed" ? "Closed" : "High";
    case "unknown":
    default:
      return "Data unavailable";
  }
}

export function getRoadMapStatusDescription(params: {
  status: RoadMapStatus;
  hasOfficialImpact?: boolean;
  reason?: string | null;
}) {
  if (params.reason) {
    return params.reason;
  }

  if (params.hasOfficialImpact) {
    return "Official restriction/advisory";
  }

  switch (normalizeRoadMapStatus(params.status)) {
    case "normal":
      return "No active impact detected";
    case "caution":
      return "Weather-based caution";
    case "elevated":
      return "Elevated risk";
    case "high":
      return "High risk or official impact";
    case "unknown":
    default:
      return "No current road status data";
  }
}
