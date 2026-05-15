export type HomeCardDataState =
  | "loading"
  | "fresh"
  | "stale"
  | "unavailable"
  | "estimated";

export function getHomeCardStateLabel(state: HomeCardDataState) {
  switch (state) {
    case "fresh":
      return "Fresh";
    case "stale":
      return "Stale";
    case "estimated":
      return "Estimated";
    case "unavailable":
      return "Unavailable";
    case "loading":
    default:
      return "Loading";
  }
}

export function getCachedRenderState(params: {
  hasCachedData: boolean;
  isFresh: boolean;
}): HomeCardDataState {
  if (!params.hasCachedData) {
    return "loading";
  }

  return params.isFresh ? "fresh" : "stale";
}

export function getWeatherFailureState(params: {
  hasLastKnownGood: boolean;
}): HomeCardDataState {
  return params.hasLastKnownGood ? "stale" : "unavailable";
}

export function getRoadFallbackState(params: {
  hasRoadData: boolean;
  hasWeatherEstimate: boolean;
}): HomeCardDataState {
  if (params.hasRoadData) {
    return "fresh";
  }

  return params.hasWeatherEstimate ? "estimated" : "unavailable";
}

export function canRenderCurrentWeatherIndependently(params: {
  currentState: HomeCardDataState;
  hourlyState: HomeCardDataState;
  alertsState: HomeCardDataState;
  roadState: HomeCardDataState;
}) {
  const currentIsUsable =
    params.currentState === "fresh" || params.currentState === "stale";

  return (
    currentIsUsable &&
    (params.hourlyState === "loading" ||
      params.alertsState === "loading" ||
      params.roadState === "loading")
  );
}
