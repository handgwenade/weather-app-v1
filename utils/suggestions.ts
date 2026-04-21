export enum SuggestionCode {
  ROAD_CLOSED = "ROAD_CLOSED",
  TRAVEL_RESTRICTION_POSTED = "TRAVEL_RESTRICTION_POSTED",
  TRAVEL_ADVISORY_POSTED = "TRAVEL_ADVISORY_POSTED",
  OFFICIAL_WEATHER_ALERT_ACTIVE = "OFFICIAL_WEATHER_ALERT_ACTIVE",
  HIGH_WIND_CAUTION = "HIGH_WIND_CAUTION",
  USE_CAUTION = "USE_CAUTION",
  DRIFTING_CONCERN = "DRIFTING_CONCERN",
  ROAD_DATA_UNAVAILABLE = "ROAD_DATA_UNAVAILABLE",
  WEATHER_DATA_UNAVAILABLE = "WEATHER_DATA_UNAVAILABLE",
  NO_ACTIVE_TRAVEL_IMPACTS = "NO_ACTIVE_TRAVEL_IMPACTS",
  FREEZE_RISK_TONIGHT = "FREEZE_RISK_TONIGHT",
}

export enum SuggestionPriority {
  P0 = "P0",
  P1 = "P1",
  P2 = "P2",
  P3 = "P3",
  P4 = "P4",
}

export enum SuggestionConfidence {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
  UNSUPPORTED = "UNSUPPORTED",
}

export enum SupportStatus {
  SUPPORTED_NOW = "SUPPORTED_NOW",
  HEURISTIC_NOW = "HEURISTIC_NOW",
}

export enum SuggestionBasis {
  OBSERVATION = "OBSERVATION",
  FORECAST = "FORECAST",
}

export enum RuleSourceStrength {
  DIRECT_SOURCE = "DIRECT_SOURCE",
  SYNTHESIZED_FACT = "SYNTHESIZED_FACT",
  HEURISTIC = "HEURISTIC",
  SYSTEM_STATUS = "SYSTEM_STATUS",
}

export const FIRST_IMPLEMENTATION_RULES: SuggestionCode[] = [
  SuggestionCode.ROAD_CLOSED,
  SuggestionCode.TRAVEL_RESTRICTION_POSTED,
  SuggestionCode.TRAVEL_ADVISORY_POSTED,
  SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE,
  SuggestionCode.HIGH_WIND_CAUTION,
  SuggestionCode.USE_CAUTION,
  SuggestionCode.FREEZE_RISK_TONIGHT,
  SuggestionCode.DRIFTING_CONCERN,
  SuggestionCode.ROAD_DATA_UNAVAILABLE,
  SuggestionCode.WEATHER_DATA_UNAVAILABLE,
  SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS,
];

export const SUGGESTION_THRESHOLDS = {
  wind: {
    cautionMph: 25,
    highGustMph: 35,
    driftingWindMph: 25,
  },
  freeze: {
    highRiskLowF: 32,
    moderateRiskLowF: 36,
    nearFreezingF: 40,
  },
} as const;

export type SuggestionInput = {
  road: {
    available: boolean;
    mapped: boolean;
    restriction: string | null;
    advisory: string | null;
    officialCondition: string | null;
    fetchedAt: string | null;
    stationObservedAt: string | null;
    windAvgMph: number | null;
    windGustMph: number | null;
    windDirection: string | null;
    visibilityFt: number | null;
    airTempF: number | null;
    surfaceTempF: number | null;
  };
  weather: {
    available: boolean;
    observedAt: string | null;
    temperatureF: number | null;
    windSpeedMph: number | null;
    windDirection: string | null;
    precipProbability: number | null;
    weatherCode: number | null;
  };
  alerts: {
    available: boolean;
    hasActiveAlert: boolean;
    primaryEvent: string | null;
    primarySeverity: string | null;
    primaryCertainty: string | null;
  };
  forecast: {
    available: boolean;
    dailyLowF: number | null;
  };
};

export type RuleEvaluationContext = {
  input: SuggestionInput;
};

export type RuleMatch = {
  code: SuggestionCode;
  title: string;
  basis: SuggestionBasis;
  priority: SuggestionPriority;
  confidence: SuggestionConfidence;
  supportStatus: SupportStatus;
  sourceStrength: RuleSourceStrength;
  whyBullets: string[];
};

export type SuggestionRuleConfig = {
  code: SuggestionCode;
  title: string;
  basis: SuggestionBasis;
  priority: SuggestionPriority;
  supportStatus: SupportStatus;
  sourceStrength: RuleSourceStrength;
  blockers?: SuggestionCode[];
  evaluate: (context: RuleEvaluationContext) => RuleMatch | null;
};

export type SuggestionDecision = {
  primary: RuleMatch | null;
  secondary: RuleMatch[];
  systemStates: RuleMatch[];
};

export type SuggestionPresentation = {
  actionLabel: string;
  recommendationText: string;
  levelLabel: "High" | "Moderate" | "Low" | "Unavailable";
  homeTone: "alert" | "warning" | "good" | "neutral";
  roadTone: "high" | "caution" | "good" | "neutral";
};

const PRIORITY_ORDER: Record<SuggestionPriority, number> = {
  [SuggestionPriority.P0]: 0,
  [SuggestionPriority.P1]: 1,
  [SuggestionPriority.P2]: 2,
  [SuggestionPriority.P3]: 3,
  [SuggestionPriority.P4]: 4,
};

const SOURCE_STRENGTH_ORDER: Record<RuleSourceStrength, number> = {
  [RuleSourceStrength.DIRECT_SOURCE]: 0,
  [RuleSourceStrength.SYNTHESIZED_FACT]: 1,
  [RuleSourceStrength.HEURISTIC]: 2,
  [RuleSourceStrength.SYSTEM_STATUS]: 3,
};

const CONFIDENCE_ORDER: Record<SuggestionConfidence, number> = {
  [SuggestionConfidence.HIGH]: 0,
  [SuggestionConfidence.MEDIUM]: 1,
  [SuggestionConfidence.LOW]: 2,
  [SuggestionConfidence.UNSUPPORTED]: 3,
};

const CLOSURE_REGEX = /\b(closed|closure|road closed|impassable)\b/i;
const VEHICLE_SPECIFIC_RESTRICTION_REGEX =
  /\b(high-?profile|light trailer|light trailers|trailers?\b|vehicles?\s+under|weight threshold|gross vehicle|gvw|semi|tractor trailer|commercial vehicles?|commercial traffic|oversize|overweight|hazmat|motorcycles?)\b/i;
const GENERAL_TRAVEL_CLOSURE_REGEX =
  /\b(road closed|highway closed|interstate closed|closed to all|closed for all|all vehicles|all traffic|through traffic|general travel|no travel|closed both directions|closed in both directions|full closure|fully closed|impassable|road closure)\b/i;
const SNOW_CONTEXT_REGEX = /\b(snow|blowing snow|drifting|slick|icy|ice)\b/i;

function isNeutralRoadCondition(value: string | null) {
  if (!value) {
    return true;
  }

  return ["dry", "none", "clear"].includes(value.trim().toLowerCase());
}

function isVehicleSpecificRestriction(value: string | null) {
  if (!value) {
    return false;
  }

  return VEHICLE_SPECIFIC_RESTRICTION_REGEX.test(value);
}

function isGeneralTravelClosure(value: string | null) {
  if (!value) {
    return false;
  }

  if (isVehicleSpecificRestriction(value)) {
    return false;
  }

  if (GENERAL_TRAVEL_CLOSURE_REGEX.test(value)) {
    return true;
  }

  return CLOSURE_REGEX.test(value) && !/\bclosed to\b/i.test(value);
}

function buildRuleMatch(
  config: SuggestionRuleConfig,
  confidence: SuggestionConfidence,
  whyBullets: string[],
): RuleMatch {
  return {
    code: config.code,
    title: config.title,
    basis: config.basis,
    priority: config.priority,
    confidence,
    supportStatus: config.supportStatus,
    sourceStrength: config.sourceStrength,
    whyBullets,
  };
}

export const OBSERVATION_RULES: SuggestionRuleConfig[] = [
  {
    code: SuggestionCode.ROAD_CLOSED,
    title: "Road closed",
    basis: SuggestionBasis.OBSERVATION,
    priority: SuggestionPriority.P0,
    supportStatus: SupportStatus.SUPPORTED_NOW,
    sourceStrength: RuleSourceStrength.DIRECT_SOURCE,
    evaluate: ({ input }) => {
      const restriction = input.road.restriction?.trim() ?? "";
      if (!restriction || restriction === "None") {
        return null;
      }

      if (!isGeneralTravelClosure(restriction)) {
        return null;
      }

      return buildRuleMatch(
        OBSERVATION_RULES[0],
        SuggestionConfidence.HIGH,
        [
          "WYDOT restriction indicates full road closure",
          "Travel should not continue on this segment",
        ],
      );
    },
  },
  {
    code: SuggestionCode.TRAVEL_RESTRICTION_POSTED,
    title: "Travel restriction posted",
    basis: SuggestionBasis.OBSERVATION,
    priority: SuggestionPriority.P1,
    supportStatus: SupportStatus.SUPPORTED_NOW,
    sourceStrength: RuleSourceStrength.DIRECT_SOURCE,
    blockers: [SuggestionCode.ROAD_CLOSED],
    evaluate: ({ input }) => {
      const restriction = input.road.restriction?.trim() ?? "";
      if (
        !restriction ||
        restriction === "None" ||
        isGeneralTravelClosure(restriction)
      ) {
        return null;
      }

      return buildRuleMatch(
        OBSERVATION_RULES[1],
        SuggestionConfidence.HIGH,
        [
          isVehicleSpecificRestriction(restriction)
            ? "WYDOT restriction limits travel for some vehicle classes"
            : "WYDOT restriction limits travel on this segment",
          "Travel is limited on this segment",
        ],
      );
    },
  },
  {
    code: SuggestionCode.TRAVEL_ADVISORY_POSTED,
    title: "Travel advisory posted",
    basis: SuggestionBasis.OBSERVATION,
    priority: SuggestionPriority.P1,
    supportStatus: SupportStatus.SUPPORTED_NOW,
    sourceStrength: RuleSourceStrength.DIRECT_SOURCE,
    blockers: [
      SuggestionCode.ROAD_CLOSED,
      SuggestionCode.TRAVEL_RESTRICTION_POSTED,
    ],
    evaluate: ({ input }) => {
      const advisory = input.road.advisory?.trim() ?? "";
      if (!advisory || advisory === "None") {
        return null;
      }

      return buildRuleMatch(
        OBSERVATION_RULES[2],
        SuggestionConfidence.HIGH,
        [
          "WYDOT advisory is active",
          "Conditions require elevated caution",
        ],
      );
    },
  },
  {
    code: SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE,
    title: "Official weather alert active",
    basis: SuggestionBasis.OBSERVATION,
    priority: SuggestionPriority.P1,
    supportStatus: SupportStatus.SUPPORTED_NOW,
    sourceStrength: RuleSourceStrength.DIRECT_SOURCE,
    blockers: [
      SuggestionCode.ROAD_CLOSED,
      SuggestionCode.TRAVEL_RESTRICTION_POSTED,
    ],
    evaluate: ({ input }) => {
      if (!input.alerts.hasActiveAlert) {
        return null;
      }

      return buildRuleMatch(
        OBSERVATION_RULES[3],
        SuggestionConfidence.HIGH,
        [
          "An official alert is active for this area",
          "Agency guidance should be reviewed",
        ],
      );
    },
  },
  {
    code: SuggestionCode.HIGH_WIND_CAUTION,
    title: "High wind caution",
    basis: SuggestionBasis.OBSERVATION,
    priority: SuggestionPriority.P2,
    supportStatus: SupportStatus.SUPPORTED_NOW,
    sourceStrength: RuleSourceStrength.SYNTHESIZED_FACT,
    evaluate: ({ input }) => {
      const stationWind = input.road.windAvgMph;
      const stationGust = input.road.windGustMph;
      const weatherWind = input.weather.windSpeedMph;

      const highByStation =
        (typeof stationWind === "number" &&
          stationWind >= SUGGESTION_THRESHOLDS.wind.cautionMph) ||
        (typeof stationGust === "number" &&
          stationGust >= SUGGESTION_THRESHOLDS.wind.highGustMph);
      const highByWeather =
        typeof weatherWind === "number" &&
        weatherWind >= SUGGESTION_THRESHOLDS.wind.cautionMph;

      if (!highByStation && !highByWeather) {
        return null;
      }

      return buildRuleMatch(
        OBSERVATION_RULES[4],
        highByStation ? SuggestionConfidence.HIGH : SuggestionConfidence.MEDIUM,
        [
          "Observed wind is elevated",
          "Travel handling may be affected",
        ],
      );
    },
  },
  {
    code: SuggestionCode.USE_CAUTION,
    title: "Use caution",
    basis: SuggestionBasis.OBSERVATION,
    priority: SuggestionPriority.P2,
    supportStatus: SupportStatus.HEURISTIC_NOW,
    sourceStrength: RuleSourceStrength.SYNTHESIZED_FACT,
    blockers: [
      SuggestionCode.ROAD_CLOSED,
      SuggestionCode.TRAVEL_RESTRICTION_POSTED,
      SuggestionCode.TRAVEL_ADVISORY_POSTED,
    ],
    evaluate: ({ input }) => {
      const officialCondition = input.road.officialCondition;
      const tempF = input.road.airTempF ?? input.weather.temperatureF;
      const windMph = input.road.windAvgMph ?? input.weather.windSpeedMph;
      const freezing =
        typeof tempF === "number" &&
        tempF <= SUGGESTION_THRESHOLDS.freeze.highRiskLowF;
      const nearFreezing =
        typeof tempF === "number" &&
        tempF <= SUGGESTION_THRESHOLDS.freeze.nearFreezingF;
      const windy =
        typeof windMph === "number" &&
        windMph >= SUGGESTION_THRESHOLDS.wind.cautionMph;

      if (
        isNeutralRoadCondition(officialCondition) &&
        !freezing &&
        !nearFreezing &&
        !windy
      ) {
        return null;
      }

      return buildRuleMatch(
        OBSERVATION_RULES[5],
        !isNeutralRoadCondition(officialCondition) || freezing
          ? SuggestionConfidence.HIGH
          : SuggestionConfidence.MEDIUM,
        [
          "Observed conditions are not fully stable",
          "Current road or weather factors may affect travel",
        ],
      );
    },
  },
  {
    code: SuggestionCode.DRIFTING_CONCERN,
    title: "Drifting concern",
    basis: SuggestionBasis.OBSERVATION,
    priority: SuggestionPriority.P2,
    supportStatus: SupportStatus.HEURISTIC_NOW,
    sourceStrength: RuleSourceStrength.HEURISTIC,
    evaluate: ({ input }) => {
      const wind =
        input.road.windAvgMph ?? input.road.windGustMph ?? input.weather.windSpeedMph;
      const roadText = [
        input.road.officialCondition,
        input.road.advisory,
        input.road.restriction,
      ]
        .filter(Boolean)
        .join(" ");
      const snowWeatherCodes = new Set([5000, 5100, 5101]);
      const hasWind =
        typeof wind === "number" &&
        wind >= SUGGESTION_THRESHOLDS.wind.driftingWindMph;
      const hasSnowContext =
        SNOW_CONTEXT_REGEX.test(roadText) ||
        (typeof input.weather.weatherCode === "number" &&
          snowWeatherCodes.has(input.weather.weatherCode));

      if (!hasWind || !hasSnowContext) {
        return null;
      }

      return buildRuleMatch(
        OBSERVATION_RULES[6],
        SuggestionConfidence.MEDIUM,
        [
          "Wind is elevated",
          "Snow-related conditions are present",
          "Drifting impacts are more likely",
        ],
      );
    },
  },
  {
    code: SuggestionCode.ROAD_DATA_UNAVAILABLE,
    title: "Road data unavailable",
    basis: SuggestionBasis.OBSERVATION,
    priority: SuggestionPriority.P3,
    supportStatus: SupportStatus.SUPPORTED_NOW,
    sourceStrength: RuleSourceStrength.SYSTEM_STATUS,
    evaluate: ({ input }) => {
      if (input.road.available && input.road.mapped) {
        return null;
      }

      return buildRuleMatch(
        OBSERVATION_RULES[7],
        SuggestionConfidence.HIGH,
        [
          "WYDOT road data could not be loaded",
          "Road-specific guidance is limited",
        ],
      );
    },
  },
  {
    code: SuggestionCode.WEATHER_DATA_UNAVAILABLE,
    title: "Weather data unavailable",
    basis: SuggestionBasis.OBSERVATION,
    priority: SuggestionPriority.P3,
    supportStatus: SupportStatus.SUPPORTED_NOW,
    sourceStrength: RuleSourceStrength.SYSTEM_STATUS,
    evaluate: ({ input }) => {
      if (input.weather.available) {
        return null;
      }

      return buildRuleMatch(
        OBSERVATION_RULES[8],
        SuggestionConfidence.HIGH,
        [
          "Current weather data could not be loaded",
          "Weather-based guidance is limited",
        ],
      );
    },
  },
  {
    code: SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS,
    title: "No active travel impacts",
    basis: SuggestionBasis.OBSERVATION,
    priority: SuggestionPriority.P4,
    supportStatus: SupportStatus.SUPPORTED_NOW,
    sourceStrength: RuleSourceStrength.SYNTHESIZED_FACT,
    evaluate: ({ input }) => {
      const roadSufficient =
        input.road.available &&
        input.road.mapped &&
        !!input.road.restriction &&
        !!input.road.advisory &&
        !!input.road.officialCondition;
      const weatherSufficient =
        input.weather.available &&
        input.weather.temperatureF !== null &&
        input.weather.windSpeedMph !== null &&
        input.weather.weatherCode !== null;

      if (!roadSufficient) {
        return null;
      }

      return buildRuleMatch(
        OBSERVATION_RULES[9],
        weatherSufficient ? SuggestionConfidence.HIGH : SuggestionConfidence.MEDIUM,
        [
          "No restriction reported",
          "No advisory reported",
          "No major weather issue is currently flagged",
        ],
      );
    },
  },
];

export const FORECAST_RULES: SuggestionRuleConfig[] = [
  {
    code: SuggestionCode.FREEZE_RISK_TONIGHT,
    title: "Freeze risk tonight",
    basis: SuggestionBasis.FORECAST,
    priority: SuggestionPriority.P2,
    supportStatus: SupportStatus.SUPPORTED_NOW,
    sourceStrength: RuleSourceStrength.SYNTHESIZED_FACT,
    evaluate: ({ input }) => {
      const lowF = input.forecast.dailyLowF;
      if (
        !input.forecast.available ||
        typeof lowF !== "number" ||
        lowF > SUGGESTION_THRESHOLDS.freeze.moderateRiskLowF
      ) {
        return null;
      }

      return buildRuleMatch(
        FORECAST_RULES[0],
        SuggestionConfidence.MEDIUM,
        [
          "Forecast low is in or near freeze range",
          "Cold-sensitive planning may be needed",
        ],
      );
    },
  },
];

export function isObservationBasedCaution(match: RuleMatch) {
  return (
    match.basis === SuggestionBasis.OBSERVATION &&
    [
      SuggestionCode.ROAD_CLOSED,
      SuggestionCode.TRAVEL_RESTRICTION_POSTED,
      SuggestionCode.TRAVEL_ADVISORY_POSTED,
      SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE,
      SuggestionCode.HIGH_WIND_CAUTION,
      SuggestionCode.USE_CAUTION,
      SuggestionCode.DRIFTING_CONCERN,
    ].includes(match.code)
  );
}

function applyBlockers(matches: RuleMatch[]) {
  const present = new Set(matches.map((match) => match.code));

  return matches.filter((match) => {
    const rule = [...OBSERVATION_RULES, ...FORECAST_RULES].find(
      (item) => item.code === match.code,
    );

    if (!rule?.blockers?.length) {
      return true;
    }

    return !rule.blockers.some((blockedBy) => present.has(blockedBy));
  });
}

function sortMatches(matches: RuleMatch[]) {
  return [...matches].sort((a, b) => {
    const priorityDelta = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const sourceDelta =
      SOURCE_STRENGTH_ORDER[a.sourceStrength] -
      SOURCE_STRENGTH_ORDER[b.sourceStrength];
    if (sourceDelta !== 0) {
      return sourceDelta;
    }

    const confidenceDelta =
      CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence];
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    return a.title.localeCompare(b.title);
  });
}

export function evaluateSuggestions(input: SuggestionInput): SuggestionDecision {
  const context = { input };

  const observationMatches = OBSERVATION_RULES.map((rule) => rule.evaluate(context)).filter(
    (match): match is RuleMatch => Boolean(match),
  );
  const forecastMatches = FORECAST_RULES.map((rule) => rule.evaluate(context)).filter(
    (match): match is RuleMatch => Boolean(match),
  );

  const filtered = applyBlockers([...observationMatches, ...forecastMatches]);
  const sorted = sortMatches(filtered);

  const primary =
    sorted.find(
      (match) =>
        match.sourceStrength !== RuleSourceStrength.SYSTEM_STATUS &&
        !(
          match.code === SuggestionCode.FREEZE_RISK_TONIGHT &&
          sorted.some(isObservationBasedCaution)
        ),
    ) ??
    sorted.find((match) => match.sourceStrength !== RuleSourceStrength.SYSTEM_STATUS) ??
    sorted[0] ??
    null;

  const secondary = sorted
    .filter((match) => match.code !== primary?.code)
    .filter((match) => {
      if (
        match.code === SuggestionCode.FREEZE_RISK_TONIGHT &&
        primary &&
        isObservationBasedCaution(primary)
      ) {
        return true;
      }

      return match.priority !== SuggestionPriority.P4;
    })
    .slice(0, 3);

  const systemStates = sorted.filter(
    (match) => match.sourceStrength === RuleSourceStrength.SYSTEM_STATUS,
  );

  return { primary, secondary, systemStates };
}

export function getSuggestionPresentation(match: RuleMatch): SuggestionPresentation {
  switch (match.code) {
    case SuggestionCode.ROAD_CLOSED:
      return {
        actionLabel: "Review now",
        recommendationText: "Road is closed. Do not route travel through this segment.",
        levelLabel: "High",
        homeTone: "alert",
        roadTone: "high",
      };
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
      return {
        actionLabel: "Review now",
        recommendationText:
          "Travel restriction is posted. Review WYDOT guidance before travel.",
        levelLabel: "High",
        homeTone: "alert",
        roadTone: "high",
      };
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
      return {
        actionLabel: "Monitor",
        recommendationText: "Advisory is active. Continue monitoring before travel.",
        levelLabel: "Moderate",
        homeTone: "warning",
        roadTone: "caution",
      };
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return {
        actionLabel: "Review now",
        recommendationText: "Official weather guidance is active. Review alert details before travel.",
        levelLabel: "High",
        homeTone: "alert",
        roadTone: "high",
      };
    case SuggestionCode.HIGH_WIND_CAUTION:
      return {
        actionLabel: "Monitor",
        recommendationText: "Observed wind is elevated. Use extra caution on exposed routes.",
        levelLabel: "Moderate",
        homeTone: "warning",
        roadTone: "caution",
      };
    case SuggestionCode.USE_CAUTION:
      return {
        actionLabel: "Monitor",
        recommendationText: "Current road or weather factors may affect travel. Continue monitoring.",
        levelLabel: "Moderate",
        homeTone: "warning",
        roadTone: "caution",
      };
    case SuggestionCode.DRIFTING_CONCERN:
      return {
        actionLabel: "Monitor",
        recommendationText: "Wind and snow conditions support drifting concern. Watch exposed areas.",
        levelLabel: "Moderate",
        homeTone: "warning",
        roadTone: "caution",
      };
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
      return {
        actionLabel: "Check data",
        recommendationText:
          "Road-specific WYDOT data could not be retrieved right now. Use alerts and weather as supplemental guidance.",
        levelLabel: "Unavailable",
        homeTone: "neutral",
        roadTone: "neutral",
      };
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return {
        actionLabel: "Check data",
        recommendationText: "Weather-based guidance is limited right now. Check again before travel.",
        levelLabel: "Unavailable",
        homeTone: "neutral",
        roadTone: "neutral",
      };
    case SuggestionCode.FREEZE_RISK_TONIGHT:
      return {
        actionLabel: "Monitor",
        recommendationText: "Forecast temperatures drop into the freeze-risk range tonight.",
        levelLabel: "Moderate",
        homeTone: "warning",
        roadTone: "caution",
      };
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
    default:
      return {
        actionLabel: "Monitor",
        recommendationText: "No active travel impacts. Continue routine monitoring.",
        levelLabel: "Low",
        homeTone: "good",
        roadTone: "good",
      };
  }
}
