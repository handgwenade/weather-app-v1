import QuickSwitchModal from "@/components/quickSwitchModal";
import RoadScreenV2, {
  type RoadBullet,
  type RoadMetric,
  type RoadOutlookItem,
  type RoadTone,
} from "@/components/road/RoadScreenV2";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  formatCityState,
  setSelectedLocation,
  useSavedLocations,
  useSelectedLocation,
} from "../../data/locationStore";
import { getSharedCurrentWeather } from "../../data/weatherStore";
import {
  getWydotRoadReport,
  type WydotRoadReport,
  type WydotStationObservation,
} from "../../services/wydot";
import {
  celsiusToFahrenheit,
  getRoadCautionMessage,
  metersPerSecondToMph,
} from "../../utils/weather";

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

const INITIAL_CURRENT_WEATHER: RoadCurrentWeatherSnapshot = {
  temperatureLabel: "Loading...",
  windLabel: "Loading...",
  precipProbability: null,
  sourceUpdatedLabel: null,
  fallbackRefreshLabel: null,
  hasWeatherData: true,
};

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

function formatLocationFieldLabel(
  location: ReturnType<typeof useSelectedLocation>,
) {
  const cityState = formatCityState(location);

  if (location.name.trim().toLowerCase() === cityState.trim().toLowerCase()) {
    return cityState;
  }

  if (location.name.trim().toLowerCase() === location.city.trim().toLowerCase()) {
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

function getRoadRiskLabel(
  report: WydotRoadReport | null,
  weatherMessage: string,
) {
  if (report?.primarySegment.restriction !== "None") {
    return "High risk";
  }

  if (report?.primarySegment.advisory !== "None") {
    return "Use caution";
  }

  if (
    report?.primarySegment.officialCondition &&
    !["Dry", "None"].includes(report.primarySegment.officialCondition)
  ) {
    return "Use caution";
  }

  if (
    weatherMessage.includes("freezing") ||
    weatherMessage.includes("near freezing") ||
    weatherMessage.includes("windy")
  ) {
    return "Use caution";
  }

  if (weatherMessage.includes("unavailable")) {
    return "Unavailable";
  }

  if (report) {
    return "Good";
  }

  return "Unavailable";
}

function getRoadRiskTone(label: string): RoadTone {
  const normalized = label.toLowerCase();

  if (normalized.includes("high risk")) {
    return "high";
  }

  if (normalized.includes("use caution")) {
    return "caution";
  }

  if (normalized.includes("good")) {
    return "good";
  }

  return "neutral";
}

function buildWeatherCaution(weatherMessage: string) {
  if (weatherMessage === "Road conditions look okay right now") {
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

function getRoadActionLabel(tone: RoadTone) {
  if (tone === "high") {
    return "Review now";
  }

  if (tone === "neutral") {
    return "Check data";
  }

  return "Monitor";
}

function getRiskLevelLabel(tone: RoadTone) {
  if (tone === "high") {
    return "High";
  }

  if (tone === "caution") {
    return "Moderate";
  }

  if (tone === "good") {
    return "Low";
  }

  return "Unavailable";
}

function getConfidenceLabel(
  hasWeatherData: boolean,
  hasRoadReport: boolean,
  stationObservedAt: string,
) {
  if (
    hasWeatherData &&
    hasRoadReport &&
    stationObservedAt !== "Unavailable"
  ) {
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
  const combined = `${officialCondition} ${weatherCaution} ${roadSummary}`.toLowerCase();

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
  } else if (fallbackTemperature !== "Not available" && fallbackTemperature !== "--") {
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

function getRoadLocationLabel(location: ReturnType<typeof useSelectedLocation>) {
  return formatCityState(location);
}

function buildRoadViewModel(params: {
  selectedLocation: ReturnType<typeof useSelectedLocation>;
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
    weatherCaution,
  } = params;
  const statusBaseLabel = getRoadRiskLabel(roadReport, weatherCaution);
  const statusTone = getRoadRiskTone(statusBaseLabel);
  const riskLevelLabel = getRiskLevelLabel(statusTone);
  const actionLabel = getRoadActionLabel(statusTone);
  const locationLabel = getRoadLocationLabel(selectedLocation);
  const topTitle = getRoadTopTitle(routeLabel, locationLabel);
  const locationFieldLabel = formatLocationFieldLabel(selectedLocation);
  const effectiveSourceUpdatedLabel =
    formatTimestampLabel(roadReport?.fetchedAt ?? undefined) ??
    currentWeather.sourceUpdatedLabel;
  const updatedLabel = effectiveSourceUpdatedLabel
    ? `Updated ${effectiveSourceUpdatedLabel}`
    : currentWeather.fallbackRefreshLabel
      ? `Last refresh ${currentWeather.fallbackRefreshLabel}`
      : "Update time unavailable";
  const lastUpdatedMetricValue = effectiveSourceUpdatedLabel
    ? effectiveSourceUpdatedLabel
    : currentWeather.fallbackRefreshLabel
      ? `Last refresh ${currentWeather.fallbackRefreshLabel}`
      : "Unavailable";
  const windMetricValue =
    stationWindAvg !== "Unavailable" && stationWindDirection !== "Unavailable"
      ? `${stationWindAvg} ${stationWindDirection}`
      : currentWeather.windLabel;
  const notices = [
    !currentWeather.hasWeatherData ? "Road weather is temporarily unavailable." : null,
    wydotNotice || null,
  ].filter(Boolean) as string[];

  const hasRestriction =
    restriction !== "None reported" && restriction !== "Unavailable";
  const hasAdvisory = advisory !== "None reported" && advisory !== "Unavailable";
  const hasSurfaceIssue =
    officialCondition !== "Unavailable" &&
    !["Dry", "None"].includes(officialCondition);
  const hasWeatherCaution =
    weatherCaution !== "Loading weather guidance..." &&
    weatherCaution !== "No weather-based caution right now" &&
    weatherCaution !== "Road conditions temporarily unavailable";

  const statusTitle = hasRestriction
    ? "Travel restriction posted"
    : hasAdvisory
      ? "Travel advisory posted"
      : hasSurfaceIssue
        ? "Surface condition reported"
        : hasWeatherCaution
          ? "Weather caution active"
          : roadReport
            ? "No active road flags"
            : "Road data unavailable";

  const statusSubtitle = hasRestriction
    ? `Restriction: ${restriction}`
    : hasAdvisory
      ? `Advisory: ${advisory}`
      : hasSurfaceIssue
        ? `Surface: ${officialCondition}`
        : hasWeatherCaution
          ? weatherCaution
          : roadReport
            ? `No restriction or advisory reported near ${roadReport.townGroup}.`
            : "WYDOT road data is limited for this location right now.";

  const recommendationText = hasRestriction
    ? "Restriction is active. Review WYDOT guidance before travel."
    : hasAdvisory
      ? "Advisory is active. Continue monitoring before travel."
      : hasSurfaceIssue
        ? "Surface conditions may affect travel. Use caution and keep monitoring."
        : hasWeatherCaution
          ? "Weather conditions may affect pavement. Continue monitoring before travel."
          : roadReport
            ? "No restriction or advisory is active. Continue routine monitoring."
            : "Road data is limited right now. Check again before travel.";

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

  return {
    topTitle,
    updatedLabel,
    notices,
    locationFieldLabel,
    statusTitle,
    statusSubtitle,
    statusLabel: riskLevelLabel,
    statusTone,
    actionLabel,
    recommendationText,
    currentConditions,
    riskLevelLabel,
    riskBullets: buildRiskBullets(
      roadReport,
      officialCondition,
      advisory,
      restriction,
      stationAirTemp,
      currentWeather.temperatureLabel,
      windMetricValue,
      currentWeather.precipProbability,
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

  if (weatherMessage !== "Road conditions look okay right now") {
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

export default function RoadScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();
  const savedLocations = useSavedLocations();

  const [currentWeather, setCurrentWeather] = useState<RoadCurrentWeatherSnapshot>(
    INITIAL_CURRENT_WEATHER,
  );
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
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const roadLocation = selectedLocation;
  const precipLabel = inferPrecipLabel(
    officialCondition,
    weatherCaution,
    roadSummary,
  );
  const roadViewModel = buildRoadViewModel({
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
    weatherCaution,
  });

  const outlookItems = buildRoadOutlookItems(
    stationAirTemp !== "Unavailable"
      ? stationAirTemp
      : currentWeather.temperatureLabel,
    precipLabel,
  );

  useEffect(() => {
    let isActive = true;

    async function loadRoadConditions() {
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
      let fallbackUpdatedLabel = formatTimestampLabel(new Date().toISOString());
      let weatherSourceUpdatedLabel: string | null = null;

      if (weatherResult.status === "fulfilled") {
        const values = weatherResult.value.data.values;
        const temperatureF = celsiusToFahrenheit(values.temperature);
        const windSpeedMph = metersPerSecondToMph(values.windSpeed);

        weatherMessage = getRoadCautionMessage(temperatureF, windSpeedMph);
        weatherSourceUpdatedLabel = formatTimestampLabel(
          typeof weatherResult.value.data.time === "string"
            ? weatherResult.value.data.time
            : null,
        );

        setCurrentWeather({
          temperatureLabel: `${temperatureF}°F`,
          windLabel: `${windSpeedMph} mph`,
          precipProbability:
            typeof values.precipitationProbability === "number"
              ? Math.round(values.precipitationProbability)
              : null,
          sourceUpdatedLabel: weatherSourceUpdatedLabel,
          fallbackRefreshLabel: fallbackUpdatedLabel,
          hasWeatherData: true,
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

      const summary = buildRoadSummary(report, weatherMessage);
      const caution = buildWeatherCaution(weatherMessage);

      setRoadSummary(summary);
      setWeatherCaution(caution);
    }

    void loadRoadConditions();

    return () => {
      isActive = false;
    };
  }, [roadLocation]);

  async function handleQuickSwitch(locationId: string) {
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
        recommendationText={roadViewModel.recommendationText}
        currentConditions={roadViewModel.currentConditions}
        riskLevelLabel={roadViewModel.riskLevelLabel}
        riskBullets={roadViewModel.riskBullets}
        confidenceLabel={roadViewModel.confidenceLabel}
        outlookItems={outlookItems}
      />

      <QuickSwitchModal
        visible={switchModalVisible}
        title="Select Road Location"
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
