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

function formatImpactText(value: string) {
  return value === "None" ? "None reported" : value;
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

function getRoadStatusTitle(tone: RoadTone) {
  if (tone === "high") {
    return "Road conditions impacted";
  }

  if (tone === "caution") {
    return "Road conditions need attention";
  }

  if (tone === "good") {
    return "Road conditions stable";
  }

  return "Road conditions unavailable";
}

function getRoadStatusSubtitle(
  tone: RoadTone,
  advisory: string,
  restriction: string,
  weatherCaution: string,
) {
  if (restriction !== "None reported" && restriction !== "Unavailable") {
    return restriction;
  }

  if (advisory !== "None reported" && advisory !== "Unavailable") {
    return advisory;
  }

  if (
    weatherCaution &&
    weatherCaution !== "Loading weather guidance..." &&
    weatherCaution !== "No weather-based caution right now"
  ) {
    return weatherCaution;
  }

  if (tone === "good") {
    return "No maintenance concerns at this location";
  }

  if (tone === "neutral") {
    return "Road monitoring data is limited right now";
  }

  return "Conditions should be reviewed before travel";
}

function getRoadActionLabel(tone: RoadTone) {
  if (tone === "high") {
    return "Review now";
  }

  if (tone === "neutral") {
    return "Check data";
  }

  return "Monitor only";
}

function getRecommendationText(tone: RoadTone) {
  if (tone === "high") {
    return "Review restrictions and delay travel if conditions worsen.";
  }

  if (tone === "caution") {
    return "Use caution and keep monitoring this location before travel.";
  }

  if (tone === "good") {
    return "No action needed. Continue routine monitoring.";
  }

  return "Check back soon for the next road conditions update.";
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
  officialCondition: string,
  stationObservedAt: string,
) {
  if (
    hasWeatherData &&
    officialCondition !== "Unavailable" &&
    stationObservedAt !== "Unavailable"
  ) {
    return "Confidence: High";
  }

  if (hasWeatherData || officialCondition !== "Unavailable") {
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
  officialCondition: string,
  weatherCaution: string,
  advisory: string,
  restriction: string,
): RoadBullet[] {
  const bullets: string[] = [];

  if (restriction !== "None reported" && restriction !== "Unavailable") {
    bullets.push(`Restriction: ${restriction}`);
  } else if (advisory !== "None reported" && advisory !== "Unavailable") {
    bullets.push(advisory);
  } else if (officialCondition.toLowerCase().includes("dry")) {
    bullets.push("Dry pavement");
  } else if (officialCondition !== "Unavailable") {
    bullets.push(officialCondition);
  } else {
    bullets.push("Latest corridor report unavailable");
  }

  if (weatherCaution === "No weather-based caution right now") {
    bullets.push("Temps stable");
  } else if (weatherCaution.toLowerCase().includes("wind")) {
    bullets.push("Wind may affect travel");
  } else if (
    weatherCaution.toLowerCase().includes("freez") ||
    weatherCaution.toLowerCase().includes("cold")
  ) {
    bullets.push("Cold temps may affect pavement");
  } else if (weatherCaution !== "Loading weather guidance...") {
    bullets.push("Weather caution active");
  }

  return bullets.slice(0, 2).map((text, index) => ({
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

  const [temperature, setTemperature] = useState("Loading...");
  const [wind, setWind] = useState("Loading...");
  const [roadSummary, setRoadSummary] = useState("Loading road conditions...");
  const [weatherCaution, setWeatherCaution] = useState(
    "Loading weather guidance...",
  );
  const [roadRiskLabel, setRoadRiskLabel] = useState("Loading...");
  const [lastUpdated, setLastUpdated] = useState("Not available");
  const [weatherDataAvailable, setWeatherDataAvailable] = useState(true);
  const [wydotNotice, setWydotNotice] = useState("");
  const [routeLabel, setRouteLabel] = useState("Loading WYDOT corridor...");
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
  const roadRiskTone = getRoadRiskTone(roadRiskLabel);
  const actionLabel = getRoadActionLabel(roadRiskTone);
  const precipLabel = inferPrecipLabel(
    officialCondition,
    weatherCaution,
    roadSummary,
  );
  const notices = [
    !weatherDataAvailable ? "Road weather is temporarily unavailable." : null,
    wydotNotice || null,
  ].filter(Boolean) as string[];

  const currentConditions: RoadMetric[] = [
    { id: "air", label: "Air Temp", value: stationAirTemp },
    { id: "road", label: "Road Temp", value: stationSurfaceTemp },
    {
      id: "wind",
      label: "Wind",
      value:
        stationWindAvg !== "Unavailable" && stationWindDirection !== "Unavailable"
          ? `${stationWindAvg} ${stationWindDirection}`
          : wind,
    },
    { id: "gusts", label: "Gusts", value: stationWindGust },
    { id: "precip", label: "Precip", value: precipLabel },
    { id: "updated", label: "Last Updated", value: lastUpdated },
  ];

  const riskBullets = buildRiskBullets(
    officialCondition,
    weatherCaution,
    advisory,
    restriction,
  );

  const outlookItems = buildRoadOutlookItems(
    stationAirTemp !== "Unavailable" ? stationAirTemp : temperature,
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
      setRoadRiskLabel("Loading...");
      setTemperature("Loading...");
      setWind("Loading...");
      setWeatherDataAvailable(true);

      const [weatherResult, wydotResult] = await Promise.allSettled([
        getSharedCurrentWeather(roadLocation),
        getWydotRoadReport(roadLocation),
      ]);

      if (!isActive) {
        return;
      }

      let weatherMessage = "Road conditions temporarily unavailable";
      let fallbackUpdated = "Not available";

      if (weatherResult.status === "fulfilled") {
        const values = weatherResult.value.data.values;
        const temperatureF = celsiusToFahrenheit(values.temperature);
        const windSpeedMph = metersPerSecondToMph(values.windSpeed);

        weatherMessage = getRoadCautionMessage(temperatureF, windSpeedMph);
        fallbackUpdated = new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        setTemperature(`${temperatureF}°F`);
        setWind(`${windSpeedMph} mph`);
        setWeatherDataAvailable(true);
      } else {
        console.log("Road screen weather fetch failed:", weatherResult.reason);
        setTemperature("--");
        setWind("Not available");
        setWeatherDataAvailable(false);
      }

      let report: WydotRoadReport | null = null;

      if (wydotResult.status === "fulfilled") {
        report = wydotResult.value;

        if (report) {
          const station: WydotStationObservation | null =
            report.primaryStationObservation;

          setWydotNotice("");
          setRouteLabel(`${report.routeCode} near ${report.townGroup}`);
          setOfficialCondition(getOfficialConditionLabel(report));
          setAdvisory(formatImpactText(report.primarySegment.advisory));
          setRestriction(formatImpactText(report.primarySegment.restriction));
          setLastUpdated(report.fetchedAt || fallbackUpdated);

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
          setLastUpdated(fallbackUpdated);
        }
      } else {
        console.log("WYDOT road fetch failed:", wydotResult.reason);
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
        setLastUpdated(fallbackUpdated);
      }

      const summary = buildRoadSummary(report, weatherMessage);
      const caution = buildWeatherCaution(weatherMessage);
      const riskLabel = getRoadRiskLabel(report, weatherMessage);

      setRoadSummary(summary);
      setWeatherCaution(caution);
      setRoadRiskLabel(riskLabel);
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
        topTitle={getRoadTopTitle(
          routeLabel,
          getRoadLocationLabel(roadLocation),
        )}
        updatedLabel={`Updated ${lastUpdated}`}
        notices={notices}
        locationFieldLabel="Search by town, road point, or saved location"
        onPressSettings={() => router.push("/settings")}
        onPressLocationSearch={() => setSwitchModalVisible(true)}
        statusTitle={getRoadStatusTitle(roadRiskTone)}
        statusSubtitle={getRoadStatusSubtitle(
          roadRiskTone,
          advisory,
          restriction,
          weatherCaution,
        )}
        statusLabel={roadRiskTone === "good" ? "Good" : getRiskLevelLabel(roadRiskTone)}
        statusTone={roadRiskTone}
        actionLabel={actionLabel}
        recommendationText={getRecommendationText(roadRiskTone)}
        currentConditions={currentConditions}
        riskLevelLabel={getRiskLevelLabel(roadRiskTone)}
        riskBullets={riskBullets}
        confidenceLabel={getConfidenceLabel(
          weatherDataAvailable,
          officialCondition,
          stationObservedAt,
        )}
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
