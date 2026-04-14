import QuickSwitchModal from "@/components/quickSwitchModal";
import Ionicons from "@expo/vector-icons/Ionicons";
import Mapbox from "@rnmapbox/maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  type AppLocation,
  formatCityState,
  setSelectedLocation,
  useSavedLocations,
  useSelectedLocation,
} from "../../data/locationStore";
import { getSharedCurrentWeather } from "../../data/weatherStore";
import {
  getWydotRoadReport,
  type WydotRoadReport,
  type WydotRouteSegment,
  type WydotStationObservation,
} from "../../services/wydot";
import {
  celsiusToFahrenheit,
  getRoadCautionMessage,
  metersPerSecondToMph,
} from "../../utils/weather";

const mapboxAccessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

if (mapboxAccessToken) {
  Mapbox.setAccessToken(mapboxAccessToken);
}

function getRoadIconName(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("restriction")) return "warning-outline";
  if (normalized.includes("advisory")) return "warning-outline";
  if (normalized.includes("closed")) return "warning-outline";
  if (normalized.includes("freezing")) return "snow-outline";
  if (normalized.includes("near freezing")) return "thermometer-outline";
  if (normalized.includes("windy")) return "warning-outline";
  if (normalized.includes("unavailable")) return "cloud-offline-outline";
  return "car-outline";
}

function getRoadIconColor(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("restriction")) return "#F4A261";
  if (normalized.includes("advisory")) return "#F4A261";
  if (normalized.includes("closed")) return "#F28482";
  if (normalized.includes("freezing")) return "#BDE0FE";
  if (normalized.includes("near freezing")) return "#FFD166";
  if (normalized.includes("windy")) return "#F4A261";
  if (normalized.includes("unavailable")) return "#D6E4FF";
  return "#8FD3FF";
}

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

function getRoadRiskTone(label: string) {
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
function getHeroHeadline(
  report: WydotRoadReport | null,
  weatherMessage: string,
) {
  if (report?.primarySegment.restriction !== "None") {
    return "RESTRICTION IN EFFECT";
  }

  if (report?.primarySegment.advisory !== "None") {
    return "TRAVEL ADVISORY";
  }

  if (
    report?.primarySegment.officialCondition &&
    !["Dry", "None"].includes(report.primarySegment.officialCondition)
  ) {
    return report.primarySegment.officialCondition.toUpperCase();
  }

  if (weatherMessage.includes("freezing")) {
    return "FREEZE CAUTION";
  }

  if (weatherMessage.includes("near freezing")) {
    return "COLD ROAD CAUTION";
  }

  if (weatherMessage.includes("windy")) {
    return "WIND CAUTION";
  }

  if (report) {
    return "DRY CONDITIONS";
  }

  if (weatherMessage.includes("unavailable")) {
    return "ROAD DATA UNAVAILABLE";
  }

  return "ROAD CONDITIONS";
}

function buildWeatherCaution(weatherMessage: string) {
  if (weatherMessage === "Road conditions look okay right now") {
    return "No weather-based caution right now";
  }

  return weatherMessage;
}

function buildCurrentRoadLocation(
  coords: Location.LocationObjectCoords,
  geocodedAddress: Location.LocationGeocodedAddress | null,
): AppLocation {
  const city =
    geocodedAddress?.city ??
    geocodedAddress?.district ??
    geocodedAddress?.subregion ??
    "Current location";

  const state = geocodedAddress?.region ?? "Current location";
  const name =
    geocodedAddress?.name ?? geocodedAddress?.city ?? "Current Location";

  return {
    id: "road-current-location",
    name,
    city,
    state,
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

function getRoadLocationLabel(location: AppLocation) {
  return formatCityState(location);
}

function getRoadLocationHint(
  location: AppLocation | null,
  isUsingCurrentLocation: boolean,
) {
  if (!location) {
    return "location unavailable";
  }

  if (isUsingCurrentLocation) {
    return "using current device location";
  }

  return "using selected saved location";
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
function getCameraAvailabilityText(segment: WydotRouteSegment | null) {
  if (!segment) {
    return "Unavailable";
  }

  const count = segment.cameraSiteIds?.length ?? 0;

  if (count === 0) {
    return "No cameras linked";
  }

  if (count === 1) {
    return "Available (1 nearby)";
  }

  return `Available (${count} nearby)`;
}

function getNearbySegmentCameraText(segment: WydotRouteSegment) {
  const count = segment.cameraSiteIds?.length ?? 0;

  if (count === 0) {
    return "No cameras linked";
  }

  if (count === 1) {
    return "1 camera linked";
  }

  return `${count} cameras linked`;
}

function getNearestSensorStationText(segment: WydotRouteSegment | null) {
  if (!segment) {
    return "Unavailable";
  }

  const firstStation = segment.sensorStationNames?.[0];

  if (!firstStation) {
    return "No sensor linked";
  }

  return firstStation;
}

function getNearbySegmentSensorText(segment: WydotRouteSegment) {
  const count = segment.sensorStationNames?.length ?? 0;

  if (count === 0) {
    return "No sensor linked";
  }

  if (count === 1) {
    return `Sensor: ${segment.sensorStationNames[0]}`;
  }

  return `Sensors: ${segment.sensorStationNames.join(", ")}`;
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

type MiniCardProps = {
  title: string;
  children: React.ReactNode;
};

function MiniCard({ title, children }: MiniCardProps) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniCardTitle}>{title}</Text>
      {children}
    </View>
  );
}

type RoadMapCardProps = {
  latitude: number;
  longitude: number;
  routeLabel: string;
};

function RoadMapCard({ latitude, longitude, routeLabel }: RoadMapCardProps) {
  const hasValidCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  if (!hasValidCoordinates) {
    return (
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Road Map</Text>
        <Text style={styles.infoCardText}>
          Map is unavailable until this location has valid coordinates.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.infoCard}>
      <View style={styles.mapCardHeader}>
        <Text style={styles.infoCardTitle}>Road Map</Text>
        <Text style={styles.mapCardSubtitle}>{routeLabel}</Text>
      </View>

      <View style={styles.mapWrap}>
        <Mapbox.MapView
          style={styles.map}
          styleURL={Mapbox.StyleURL.Street}
          compassEnabled
          scaleBarEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          surfaceView={Platform.OS === "android"}
        >
          <Mapbox.Camera
            zoomLevel={9}
            centerCoordinate={[longitude, latitude]}
            animationMode="none"
          />

          <Mapbox.ShapeSource
            id="selected-location-source"
            shape={{
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [longitude, latitude],
              },
              properties: {},
            }}
          >
            <Mapbox.CircleLayer
              id="selected-location-outer"
              style={{
                circleRadius: 11,
                circleColor: "#0A84FF",
                circleStrokeWidth: 2,
                circleStrokeColor: "#FFFFFF",
              }}
            />
            <Mapbox.CircleLayer
              id="selected-location-inner"
              style={{
                circleRadius: 4,
                circleColor: "#FFFFFF",
              }}
            />
          </Mapbox.ShapeSource>
        </Mapbox.MapView>
      </View>

      <Text style={styles.mapHelperText}>
        The map is centered on the location used for this road report now.
        Segment highlights plus camera and sensor markers can be added as soon
        as the WYDOT service returns coordinates for them.
      </Text>
    </View>
  );
}

export default function RoadScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();
  const savedLocations = useSavedLocations();
  const [currentRoadLocation, setCurrentRoadLocation] =
    useState<AppLocation | null>(null);
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(false);
  const [locationNotice, setLocationNotice] = useState("");
  const [isResolvingCurrentLocation, setIsResolvingCurrentLocation] =
    useState(false);

  const roadLocation = isUsingCurrentLocation
    ? (currentRoadLocation ?? selectedLocation)
    : selectedLocation;
  const locationStatusText = getRoadLocationHint(
    roadLocation,
    isUsingCurrentLocation,
  );
  async function handleUseCurrentLocation() {
    try {
      setIsResolvingCurrentLocation(true);
      setLocationNotice("");

      let permission = await Location.getForegroundPermissionsAsync();

      if (permission.status === Location.PermissionStatus.UNDETERMINED) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationNotice(
          "Current location permission is turned off, so Road is still using your saved place.",
        );
        setIsUsingCurrentLocation(false);
        setCurrentRoadLocation(null);
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let geocodedAddress: Location.LocationGeocodedAddress | null = null;

      try {
        const geocodedResults = await Location.reverseGeocodeAsync({
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
        });

        geocodedAddress = geocodedResults[0] ?? null;
      } catch (error) {
        console.warn(
          "Reverse geocode failed for Road current location:",
          error,
        );
      }

      setCurrentRoadLocation(
        buildCurrentRoadLocation(currentPosition.coords, geocodedAddress),
      );
      setIsUsingCurrentLocation(true);
      setLocationNotice("");
    } catch (error) {
      console.warn(
        "Failed to resolve current device location for Road:",
        error,
      );
      setLocationNotice(
        "Current device location is unavailable right now, so Road is still using your saved place.",
      );
      setIsUsingCurrentLocation(false);
      setCurrentRoadLocation(null);
    } finally {
      setIsResolvingCurrentLocation(false);
    }
  }

  function handleUseSavedLocation() {
    setIsUsingCurrentLocation(false);
    setCurrentRoadLocation(null);
    setLocationNotice("");
  }

  const [temperature, setTemperature] = useState("Loading...");
  const [wind, setWind] = useState("Loading...");
  const [roadSummary, setRoadSummary] = useState("Loading road conditions...");
  const [weatherCaution, setWeatherCaution] = useState(
    "Loading weather guidance...",
  );
  const [heroHeadline, setHeroHeadline] = useState("LOADING ROAD CONDITIONS");
  const [roadRiskLabel, setRoadRiskLabel] = useState("Loading...");
  const [roadMode, setRoadMode] = useState<"location" | "route">("location");
  const roadRiskTone = getRoadRiskTone(roadRiskLabel);
  const [lastUpdated, setLastUpdated] = useState("Not available");
  const [mapLatitude, setMapLatitude] = useState(roadLocation.latitude);
  const [mapLongitude, setMapLongitude] = useState(roadLocation.longitude);
  const [weatherDataAvailable, setWeatherDataAvailable] = useState(true);
  const [wydotNotice, setWydotNotice] = useState("");
  const [routeLabel, setRouteLabel] = useState("Loading WYDOT corridor...");
  const [segmentLabel, setSegmentLabel] = useState("Loading segment...");
  const [officialCondition, setOfficialCondition] = useState("Loading...");
  const [advisory, setAdvisory] = useState("Loading...");
  const [restriction, setRestriction] = useState("Loading...");
  const [cameraAvailability, setCameraAvailability] = useState("Loading...");
  const [nearestSensorStation, setNearestSensorStation] =
    useState("Loading...");
  const [stationObservedAt, setStationObservedAt] = useState("Loading...");
  const [stationAirTemp, setStationAirTemp] = useState("Loading...");
  const [stationSurfaceTemp, setStationSurfaceTemp] = useState("Loading...");
  const [stationVisibility, setStationVisibility] = useState("Loading...");
  const [stationWindAvg, setStationWindAvg] = useState("Loading...");
  const [stationWindGust, setStationWindGust] = useState("Loading...");
  const [stationWindDirection, setStationWindDirection] =
    useState("Loading...");
  const [isRoadSensorExpanded, setIsRoadSensorExpanded] = useState(false);
  const [nearbySegments, setNearbySegments] = useState<WydotRouteSegment[]>([]);
  const [roadIconName, setRoadIconName] = useState<
    | "snow-outline"
    | "thermometer-outline"
    | "warning-outline"
    | "cloud-offline-outline"
    | "car-outline"
  >("car-outline");
  const [roadIconColor, setRoadIconColor] = useState("#8FD3FF");
  const [switchModalVisible, setSwitchModalVisible] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadRoadConditions() {
      setRouteLabel("Loading WYDOT corridor...");
      setSegmentLabel("Loading segment...");
      setOfficialCondition("Loading...");
      setAdvisory("Loading...");
      setRestriction("Loading...");
      setCameraAvailability("Loading...");
      setNearestSensorStation("Loading...");
      setStationObservedAt("Loading...");
      setStationAirTemp("Loading...");
      setStationSurfaceTemp("Loading...");
      setStationVisibility("Loading...");
      setStationWindAvg("Loading...");
      setStationWindGust("Loading...");
      setStationWindDirection("Loading...");
      setNearbySegments([]);
      setWydotNotice("");
      setRoadSummary("Loading road conditions...");
      setWeatherCaution("Loading weather guidance...");
      setHeroHeadline("LOADING ROAD CONDITIONS");
      setRoadRiskLabel("Loading...");
      setMapLatitude(roadLocation.latitude);
      setMapLongitude(roadLocation.longitude);
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
          setSegmentLabel(report.primarySegment.segmentLabel);
          setOfficialCondition(getOfficialConditionLabel(report));
          setAdvisory(formatImpactText(report.primarySegment.advisory));
          setRestriction(formatImpactText(report.primarySegment.restriction));
          setCameraAvailability(
            getCameraAvailabilityText(report.primarySegment),
          );
          setNearestSensorStation(
            getNearestSensorStationText(report.primarySegment),
          );
          setNearbySegments(report.nearbySegments);
          setLastUpdated(report.fetchedAt || fallbackUpdated);
          setMapLatitude(report.mapLatitude);
          setMapLongitude(report.mapLongitude);
          if (station) {
            setStationObservedAt(formatObservationText(station.observedAt));
            setStationAirTemp(formatObservationValue(station.airTempF, "°F"));
            setStationSurfaceTemp(
              formatObservationValue(station.surfaceTempF, "°F"),
            );
            setStationVisibility(
              formatObservationValue(station.visibilityFt, " ft"),
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
            setStationVisibility("Unavailable");
            setStationWindAvg("Unavailable");
            setStationWindGust("Unavailable");
            setStationWindDirection("Unavailable");
          }
        } else {
          setWydotNotice(
            "WYDOT corridor mapping is not available for this location yet.",
          );
          setRouteLabel("Weather-based road guidance");
          setSegmentLabel("No mapped WYDOT corridor for this location");
          setOfficialCondition("Unavailable");
          setAdvisory("Unavailable");
          setRestriction("Unavailable");
          setCameraAvailability("Unavailable");
          setNearestSensorStation("Unavailable");
          setStationObservedAt("Unavailable");
          setStationAirTemp("Unavailable");
          setStationSurfaceTemp("Unavailable");
          setStationVisibility("Unavailable");
          setStationWindAvg("Unavailable");
          setStationWindGust("Unavailable");
          setStationWindDirection("Unavailable");
          setNearbySegments([]);
          setLastUpdated(fallbackUpdated);
        }
      } else {
        console.log("WYDOT road fetch failed:", wydotResult.reason);
        setWydotNotice("WYDOT road data is temporarily unavailable.");
        setRouteLabel("Weather-based road guidance");
        setSegmentLabel("WYDOT segment details unavailable");
        setOfficialCondition("Unavailable");
        setAdvisory("Unavailable");
        setRestriction("Unavailable");
        setCameraAvailability("Unavailable");
        setNearestSensorStation("Unavailable");
        setStationObservedAt("Unavailable");
        setStationAirTemp("Unavailable");
        setStationSurfaceTemp("Unavailable");
        setStationVisibility("Unavailable");
        setStationWindAvg("Unavailable");
        setStationWindGust("Unavailable");
        setStationWindDirection("Unavailable");
        setNearbySegments([]);
        setLastUpdated(fallbackUpdated);
      }

      const summary = buildRoadSummary(report, weatherMessage);
      const caution = buildWeatherCaution(weatherMessage);
      const headline = getHeroHeadline(report, weatherMessage);
      const riskLabel = getRoadRiskLabel(report, weatherMessage);

      setRoadSummary(summary);
      setWeatherCaution(caution);
      setHeroHeadline(headline);
      setRoadRiskLabel(riskLabel);
      setRoadIconName(getRoadIconName(summary));
      setRoadIconColor(getRoadIconColor(summary));
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

    setIsUsingCurrentLocation(false);
    setCurrentRoadLocation(null);
    setLocationNotice("");
    await setSelectedLocation(nextLocation);
    setSwitchModalVisible(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.hero}>
          <View style={styles.topRow}>
            <Pressable
              style={styles.circleButton}
              onPress={() => router.push("/settings")}
            >
              <Ionicons name="settings-outline" size={24} color="#ffffff" />
            </Pressable>

            <Text style={styles.appTitle}>Road</Text>

            <Pressable
              style={styles.circleButton}
              onPress={() => router.push("/manage-locations")}
            >
              <Ionicons name="location-outline" size={24} color="#ffffff" />
            </Pressable>
          </View>

          {!weatherDataAvailable && (
            <Text style={styles.noticeText}>
              Road weather is temporarily unavailable.
            </Text>
          )}

          {locationNotice ? (
            <Text style={styles.noticeText}>{locationNotice}</Text>
          ) : null}

          {wydotNotice ? (
            <Text style={styles.noticeText}>{wydotNotice}</Text>
          ) : null}

          <View style={styles.iconWrap}>
            <Ionicons name={roadIconName} size={110} color={roadIconColor} />
          </View>

          <Pressable
            style={styles.locationSwitchButton}
            onPress={() => setSwitchModalVisible(true)}
          >
            <View style={styles.locationSwitchRow}>
              <Ionicons name="location-outline" size={16} color="#d6e4ff" />
              <Text style={styles.locationSwitchText}>
                {getRoadLocationLabel(roadLocation)}
              </Text>
              <Ionicons name="chevron-down-outline" size={14} color="#8fa3c2" />
            </View>
            <Text style={styles.locationSwitchHint}>{locationStatusText}</Text>
          </Pressable>

          <View style={styles.locationModeRow}>
            <Pressable
              style={[
                styles.locationModeButton,
                isUsingCurrentLocation ? styles.locationModeButtonActive : null,
              ]}
              onPress={() => void handleUseCurrentLocation()}
              disabled={isResolvingCurrentLocation}
            >
              <Ionicons name="navigate-outline" size={16} color="#d6e4ff" />
              <Text style={styles.locationModeButtonText}>
                {isResolvingCurrentLocation
                  ? "Finding location..."
                  : "Use Current Location"}
              </Text>
            </Pressable>

            {isUsingCurrentLocation ? (
              <Pressable
                style={styles.locationModeButton}
                onPress={handleUseSavedLocation}
              >
                <Ionicons name="bookmark-outline" size={16} color="#d6e4ff" />
                <Text style={styles.locationModeButtonText}>
                  Use Saved Location
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.modeSwitchRow}>
            <Pressable
              style={[
                styles.modeSwitchButton,
                roadMode === "location" ? styles.modeSwitchButtonActive : null,
              ]}
              onPress={() => setRoadMode("location")}
            >
              <Text
                style={[
                  styles.modeSwitchButtonText,
                  roadMode === "location"
                    ? styles.modeSwitchButtonTextActive
                    : null,
                ]}
              >
                Location
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.modeSwitchButton,
                roadMode === "route" ? styles.modeSwitchButtonActive : null,
              ]}
              onPress={() => setRoadMode("route")}
            >
              <Text
                style={[
                  styles.modeSwitchButtonText,
                  roadMode === "route"
                    ? styles.modeSwitchButtonTextActive
                    : null,
                ]}
              >
                Route
              </Text>
            </Pressable>
          </View>
          <Text style={styles.tempText}>{temperature}</Text>
          <Text style={styles.conditionText}>{heroHeadline}</Text>
          <Text style={styles.subText}>{routeLabel}</Text>
          <Text style={styles.updatedText}>
            WYDOT segment updated {lastUpdated}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Current Temp</Text>
              <Text style={styles.statValue}>{temperature}</Text>
            </View>

            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Wind</Text>
              <Text style={styles.statValue}>{wind}</Text>
            </View>
          </View>
        </View>
        {roadMode === "location" ? (
          <>
            <RoadMapCard
              latitude={mapLatitude}
              longitude={mapLongitude}
              routeLabel={routeLabel}
            />

            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Road Summary</Text>
              <Text style={styles.infoCardText}>{roadSummary}</Text>
            </View>

            <View
              style={[
                styles.infoCard,
                styles.roadRiskCard,
                roadRiskTone === "good"
                  ? styles.roadRiskCardGood
                  : roadRiskTone === "caution"
                    ? styles.roadRiskCardCaution
                    : roadRiskTone === "high"
                      ? styles.roadRiskCardHigh
                      : null,
              ]}
            >
              <Text style={styles.infoCardTitle}>Road Risk</Text>
              <Text
                style={[
                  styles.roadRiskValue,
                  roadRiskTone === "good"
                    ? styles.roadRiskValueGood
                    : roadRiskTone === "caution"
                      ? styles.roadRiskValueCaution
                      : roadRiskTone === "high"
                        ? styles.roadRiskValueHigh
                        : null,
                ]}
              >
                {roadRiskLabel}
              </Text>
              <Text style={styles.roadRiskHelperText}>
                {roadRiskTone === "good"
                  ? "No major road impacts are showing right now."
                  : roadRiskTone === "caution"
                    ? "Travel is still possible, but conditions deserve extra attention."
                    : roadRiskTone === "high"
                      ? "Conditions or restrictions could seriously affect travel right now."
                      : "Road risk is unavailable right now."}
              </Text>
            </View>

            <View style={styles.twoColumnRow}>
              <MiniCard title="Official Condition">
                <Text style={styles.miniCardText}>{officialCondition}</Text>
              </MiniCard>

              <MiniCard title="Advisory">
                <Text style={styles.miniCardText}>{advisory}</Text>
              </MiniCard>
            </View>

            <View style={styles.infoCard}>
              <Pressable
                style={styles.accordionHeader}
                onPress={() => setIsRoadSensorExpanded((current) => !current)}
              >
                <View style={styles.accordionHeaderTextWrap}>
                  <Text style={styles.infoCardTitle}>Road Sensor Details</Text>
                  <Text style={styles.accordionHintText}>
                    {isRoadSensorExpanded ? "Tap to collapse" : "Tap to expand"}
                  </Text>
                </View>
                <Ionicons
                  name={
                    isRoadSensorExpanded
                      ? "chevron-up-outline"
                      : "chevron-down-outline"
                  }
                  size={20}
                  color="#D8F3FF"
                />
              </Pressable>

              {isRoadSensorExpanded ? (
                <View style={styles.sensorGrid}>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>Sensor Station</Text>
                    <Text style={styles.sensorValue}>
                      {nearestSensorStation}
                    </Text>
                  </View>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>Observed</Text>
                    <Text style={styles.sensorValue}>{stationObservedAt}</Text>
                  </View>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>Road Sensor Air Temp</Text>
                    <Text style={styles.sensorValue}>{stationAirTemp}</Text>
                  </View>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>Road Surface Temp</Text>
                    <Text style={styles.sensorValue}>{stationSurfaceTemp}</Text>
                  </View>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>Visibility</Text>
                    <Text style={styles.sensorValue}>{stationVisibility}</Text>
                  </View>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>Wind Avg</Text>
                    <Text style={styles.sensorValue}>{stationWindAvg}</Text>
                  </View>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>Wind Gust</Text>
                    <Text style={styles.sensorValue}>{stationWindGust}</Text>
                  </View>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>Current Weather Temp</Text>
                    <Text style={styles.sensorValue}>{temperature}</Text>
                  </View>
                  <View style={styles.sensorItem}>
                    <Text style={styles.sensorLabel}>Current Weather Wind</Text>
                    <Text style={styles.sensorValue}>{wind}</Text>
                  </View>
                  <View style={styles.sensorItemWide}>
                    <Text style={styles.sensorLabel}>Wind Direction</Text>
                    <Text style={styles.sensorValue}>
                      {stationWindDirection}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.twoColumnRow}>
              <MiniCard title="Restriction">
                <Text style={styles.miniCardText}>{restriction}</Text>
              </MiniCard>

              <MiniCard title="Cameras">
                <Text style={styles.miniCardText}>{cameraAvailability}</Text>
              </MiniCard>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Weather Caution</Text>
              <Text style={styles.infoCardText}>{weatherCaution}</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>WYDOT Segment</Text>
              <Text style={styles.infoCardText}>{segmentLabel}</Text>
            </View>

            {nearbySegments.length > 0 ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Nearby Segments</Text>
                {nearbySegments.map((segment, index) => (
                  <View
                    key={`${segment.townGroup}-${segment.segmentLabel}-${index}`}
                    style={[
                      styles.segmentRow,
                      index < nearbySegments.length - 1
                        ? styles.segmentDivider
                        : null,
                    ]}
                  >
                    <Text style={styles.segmentLabel}>
                      {segment.segmentLabel}
                    </Text>
                    <Text style={styles.segmentMeta}>
                      {segment.officialCondition} |{" "}
                      {formatImpactText(segment.advisory)}
                    </Text>
                    <Text style={styles.segmentMeta}>
                      Restriction: {formatImpactText(segment.restriction)}
                    </Text>
                    <Text style={styles.segmentMeta}>
                      Cameras: {getNearbySegmentCameraText(segment)}
                    </Text>
                    <Text style={styles.segmentMeta}>
                      {getNearbySegmentSensorText(segment)}
                    </Text>
                    <Text style={styles.segmentMeta}>
                      Updated: {segment.reportTime}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Route Check</Text>

              <View style={styles.routeInputGroup}>
                <Text style={styles.routeInputLabel}>From</Text>
                <Pressable style={styles.routeInputButton}>
                  <Text style={styles.routeInputButtonText}>
                    Select starting point
                  </Text>
                </Pressable>
              </View>

              <View style={styles.routeInputGroup}>
                <Text style={styles.routeInputLabel}>To</Text>
                <Pressable style={styles.routeInputButton}>
                  <Text style={styles.routeInputButtonText}>
                    Select destination
                  </Text>
                </Pressable>
              </View>

              <View style={styles.routeInputGroup}>
                <Text style={styles.routeInputLabel}>Departure</Text>
                <Pressable style={styles.routeInputButton}>
                  <Text style={styles.routeInputButtonText}>Leave now</Text>
                </Pressable>
              </View>

              <Pressable style={styles.routeCheckButton}>
                <Ionicons
                  name="git-compare-outline"
                  size={18}
                  color="#ffffff"
                />
                <Text style={styles.routeCheckButtonText}>Check Route</Text>
              </Pressable>
            </View>

            <View style={[styles.infoCard, styles.routeRiskCardShell]}>
              <Text style={styles.infoCardTitle}>Route Risk</Text>
              <Text style={styles.routeRiskHeadline}>Use caution</Text>
              <Text style={styles.routeRiskSummary}>
                Strong wind and near-freezing temperatures may affect part of
                this drive.
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Route Summary</Text>
              <Text style={styles.infoCardText}>Distance: 72 miles</Text>
              <Text style={styles.infoCardText}>
                Estimated drive: 1 hr 10 min
              </Text>
              <Text style={styles.infoCardText}>
                Worst stretch: Wheatland to Chugwater
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Route Checkpoints</Text>

              <View style={styles.routeCheckpointRow}>
                <View style={styles.routeCheckpointHeader}>
                  <Text style={styles.routeCheckpointTitle}>
                    Start • Wheatland
                  </Text>
                  <Text style={styles.routeCheckpointEta}>Now</Text>
                </View>
                <Text style={styles.routeCheckpointMeta}>Temp: 41°F</Text>
                <Text style={styles.routeCheckpointMeta}>Wind: 24 mph</Text>
                <Text style={styles.routeCheckpointMeta}>Precip: None</Text>
              </View>

              <View
                style={[
                  styles.routeCheckpointRow,
                  styles.routeCheckpointDivider,
                ]}
              >
                <View style={styles.routeCheckpointHeader}>
                  <Text style={styles.routeCheckpointTitle}>
                    Mid-route • Chugwater
                  </Text>
                  <Text style={styles.routeCheckpointEta}>+28 min</Text>
                </View>
                <Text style={styles.routeCheckpointMeta}>Temp: 35°F</Text>
                <Text style={styles.routeCheckpointMeta}>Wind: 32 mph</Text>
                <Text style={styles.routeCheckpointMeta}>
                  Caution: Strong crosswinds
                </Text>
              </View>

              <View style={styles.routeCheckpointRow}>
                <View style={styles.routeCheckpointHeader}>
                  <Text style={styles.routeCheckpointTitle}>
                    Destination • Cheyenne
                  </Text>
                  <Text style={styles.routeCheckpointEta}>+1 hr 10 min</Text>
                </View>
                <Text style={styles.routeCheckpointMeta}>Temp: 37°F</Text>
                <Text style={styles.routeCheckpointMeta}>Wind: 27 mph</Text>
                <Text style={styles.routeCheckpointMeta}>
                  Precip: Light snow possible
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>Route Map</Text>
              <Text style={styles.infoCardText}>
                Route line and caution markers can go here once the route data
                is wired.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <QuickSwitchModal
        visible={switchModalVisible}
        title="Switch Current Location"
        subtitle="Choose which saved place Road should use right now."
        currentLocationId={selectedLocation.id}
        savedLocations={savedLocations}
        onClose={() => setSwitchModalVisible(false)}
        onSelectLocation={handleQuickSwitch}
        onManageLocations={() => {
          setSwitchModalVisible(false);
          router.push("/manage-locations");
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0A1630",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#0A1630",
  },
  container: {
    backgroundColor: "#0A1630",
    padding: 20,
    paddingBottom: 40,
  },
  hero: {
    marginBottom: 22,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  circleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.28)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  appTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "500",
  },
  noticeText: {
    color: "#d6e4ff",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  iconWrap: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 10,
  },
  locationSwitchButton: {
    alignItems: "center",
    marginBottom: 6,
  },
  locationSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  locationSwitchText: {
    color: "#d6e4ff",
    fontSize: 16,
    textAlign: "center",
  },
  locationSwitchHint: {
    color: "#8fa3c2",
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
  locationModeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  locationModeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  locationModeButtonActive: {
    backgroundColor: "rgba(10, 132, 255, 0.20)",
    borderColor: "rgba(143, 211, 255, 0.40)",
  },
  locationModeButtonText: {
    color: "#d6e4ff",
    fontSize: 13,
    fontWeight: "500",
  },
  modeSwitchRow: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 999,
    padding: 4,
    gap: 6,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  modeSwitchButton: {
    minWidth: 110,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  modeSwitchButtonActive: {
    backgroundColor: "rgba(10, 132, 255, 0.24)",
    borderWidth: 1,
    borderColor: "rgba(143, 211, 255, 0.3)",
  },
  modeSwitchButtonText: {
    color: "#9EB5D8",
    fontSize: 14,
    fontWeight: "600",
  },
  modeSwitchButtonTextActive: {
    color: "#FFFFFF",
  },
  tempText: {
    color: "#ffffff",
    fontSize: 82,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 90,
    marginBottom: 4,
  },
  conditionText: {
    color: "#ffffff",
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: 8,
  },
  subText: {
    color: "#b8c6e0",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 8,
  },
  updatedText: {
    color: "#8fa3c2",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 28,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 8,
  },
  statBlock: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statLabel: {
    color: "#b8c6e0",
    fontSize: 16,
    marginBottom: 8,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: "rgba(143, 211, 255, 0.10)",
    borderColor: "rgba(143, 211, 255, 0.22)",
    borderWidth: 1,
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  infoCardTitle: {
    color: "#D8F3FF",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 10,
  },
  infoCardText: {
    color: "#E5EDF9",
    fontSize: 16,
    marginBottom: 2,
    lineHeight: 24,
  },
  roadRiskCard: {
    paddingTop: 18,
    paddingBottom: 18,
  },
  roadRiskCardGood: {
    backgroundColor: "rgba(102, 214, 154, 0.16)",
    borderColor: "rgba(102, 214, 154, 0.34)",
  },
  roadRiskCardCaution: {
    backgroundColor: "rgba(255, 209, 102, 0.16)",
    borderColor: "rgba(255, 209, 102, 0.34)",
  },
  roadRiskCardHigh: {
    backgroundColor: "rgba(242, 132, 130, 0.16)",
    borderColor: "rgba(242, 132, 130, 0.34)",
  },
  roadRiskValue: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    marginBottom: 8,
    color: "#ffffff",
  },
  roadRiskValueGood: {
    color: "#CFF7DD",
  },
  roadRiskValueCaution: {
    color: "#FFE2A8",
  },
  roadRiskValueHigh: {
    color: "#FFD2D1",
  },
  roadRiskHelperText: {
    color: "#E5EDF9",
    fontSize: 14,
    lineHeight: 22,
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accordionHeaderTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  accordionHintText: {
    color: "#9EB5D8",
    fontSize: 13,
    lineHeight: 18,
  },
  mapCardHeader: {
    marginBottom: 12,
  },
  mapCardSubtitle: {
    color: "#9EB5D8",
    fontSize: 14,
    lineHeight: 20,
  },
  mapWrap: {
    height: 360,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    marginBottom: 12,
  },
  map: {
    flex: 1,
  },
  mapHelperText: {
    color: "#9EB5D8",
    fontSize: 13,
    lineHeight: 20,
  },
  mapLoadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  mapLoadingText: {
    color: "#9EB5D8",
    fontSize: 14,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  miniCard: {
    flex: 1,
    backgroundColor: "rgba(143, 211, 255, 0.10)",
    borderColor: "rgba(143, 211, 255, 0.22)",
    borderWidth: 1,
    padding: 16,
    borderRadius: 20,
    minHeight: 108,
  },
  miniCardTitle: {
    color: "#D8F3FF",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  miniCardText: {
    color: "#E5EDF9",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 2,
  },
  routeInputGroup: {
    marginBottom: 14,
  },
  routeInputLabel: {
    color: "#9EB5D8",
    fontSize: 13,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  routeInputButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  routeInputButtonText: {
    color: "#E5EDF9",
    fontSize: 15,
  },
  routeCheckButton: {
    marginTop: 6,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#0A84FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  routeCheckButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  routeRiskCardShell: {
    backgroundColor: "rgba(255, 209, 102, 0.14)",
    borderColor: "rgba(255, 209, 102, 0.28)",
  },
  routeRiskHeadline: {
    color: "#FFE2A8",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  routeRiskSummary: {
    color: "#FFF4DA",
    fontSize: 15,
    lineHeight: 22,
  },
  routeCheckpointRow: {
    paddingVertical: 12,
  },
  routeCheckpointDivider: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  routeCheckpointHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  routeCheckpointTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  routeCheckpointEta: {
    color: "#9EB5D8",
    fontSize: 13,
    fontWeight: "600",
  },
  routeCheckpointMeta: {
    color: "#D6E4FF",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 2,
  },
  sensorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  sensorItem: {
    width: "47%",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  sensorItemWide: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  sensorLabel: {
    color: "#9EB5D8",
    fontSize: 13,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sensorValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  segmentRow: {
    paddingVertical: 8,
  },
  segmentDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 8,
  },
  segmentLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
    lineHeight: 24,
  },
  segmentMeta: {
    color: "#D6E4FF",
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
});
