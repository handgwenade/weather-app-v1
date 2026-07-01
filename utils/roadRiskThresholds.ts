export const ROAD_RISK_THRESHOLDS = {
  wind: {
    cautionMph: 25,
    driftingWindMph: 25,
    moderateSustainedMph: 30,
    highSustainedMph: 40,
    moderateGustMph: 40,
    highGustMph: 50,
    highProfileModerateGustMph: 40,
    highProfileModerateSustainedMph: 30,
    highProfileHighGustMph: 50,
    highProfileHighSustainedMph: 40,
  },
  freeze: {
    highRiskLowF: 32,
    moderateRiskLowF: 36,
    nearFreezingF: 40,
  },
  roadSurface: {
    moderateNonDryF: 36,
    highNonDryF: 32,
  },
  visibility: {
    moderateMi: 0.5,
    highMi: 0.25,
    moderateFt: 2640,
    highFt: 1320,
  },
  homeSummary: {
    moderatePrecipProbability: 40,
    highPrecipProbability: 95,
  },
} as const;
