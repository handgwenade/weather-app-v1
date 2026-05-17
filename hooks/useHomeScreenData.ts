import { useEffect, useRef, useState } from "react";

import type { AppLocation } from "@/data/locationStore";
import { formatCityState } from "@/data/locationStore";
import {
    getCachedHomeInitialWeather,
    getCachedHourlyForecast,
    getSharedForecast,
    getSharedHomeInitialWeather,
    getSharedHourlyForecast,
    hydrateCachedHomeWeather,
} from "@/data/weatherStore";
import { getActiveAlertsForLocation } from "@/services/nws";
import type { TomorrowHourlyForecastEntry } from "@/services/tomorrow";
import { getWydotRoadReport, type WydotRoadReport } from "@/services/wydot";
import {
    getRoadFallbackState,
    getWeatherFailureState,
} from "@/utils/homePerformance";
import {
    buildHomeWeatherSnapshotFromInitialPayload,
    formatClockLabel,
    getHomeForecastLowFFromHourlyEntries,
    getHomePropertyRiskFromLowF,
    getHomeWeatherSnapshotKey,
    INITIAL_ALERT_SUMMARY,
    INITIAL_CURRENT_WEATHER,
    mergeHomeWeatherSnapshot,
    sameHomeLocation,
    type HomeAlertSummary,
    type HomeCurrentWeatherSnapshot,
    type HomeDataState,
    type PropertyRisk,
} from "@/utils/homeWeatherFormatting";

export type UseHomeScreenDataResult = {
  currentWeather: HomeCurrentWeatherSnapshot;
  hourlyForecast: TomorrowHourlyForecastEntry[];
  alertSummary: HomeAlertSummary;
  propertyRisk: PropertyRisk;
  propertyForecastLowF: number | null;
  roadReport: WydotRoadReport | null;
  hourlyState: HomeDataState;
  roadState: HomeDataState;
  homeSuggestionsReady: boolean;
  weatherReady: boolean;
  hourlyReady: boolean;
  alertsReady: boolean;
  roadReady: boolean;
  suggestionsReady: boolean;
};

export function useHomeScreenData(
  selectedLocation: AppLocation | null,
  propertyLocation: AppLocation | null,
): UseHomeScreenDataResult {
  const [currentWeather, setCurrentWeather] =
    useState<HomeCurrentWeatherSnapshot>(INITIAL_CURRENT_WEATHER);
  const [hourlyForecast, setHourlyForecast] = useState<
    TomorrowHourlyForecastEntry[]
  >([]);
  const [alertSummary, setAlertSummary] = useState<HomeAlertSummary>(
    INITIAL_ALERT_SUMMARY,
  );
  const [propertyRisk, setPropertyRisk] = useState<PropertyRisk>("Unavailable");
  const [propertyForecastLowF, setPropertyForecastLowF] = useState<
    number | null
  >(null);
  const [roadReport, setRoadReport] = useState<WydotRoadReport | null>(null);
  const [hourlyState, setHourlyState] = useState<HomeDataState>("loading");
  const [roadState, setRoadState] = useState<HomeDataState>("loading");
  const [homeSuggestionsReady, setHomeSuggestionsReady] = useState(false);
  const [weatherSnapshotLocationKey, setWeatherSnapshotLocationKey] = useState<
    string | null
  >(null);
  const [hourlyForecastLocationKey, setHourlyForecastLocationKey] = useState<
    string | null
  >(null);
  const [alertSummaryLocationKey, setAlertSummaryLocationKey] = useState<
    string | null
  >(null);
  const [roadDataLocationKey, setRoadDataLocationKey] = useState<string | null>(
    null,
  );
  const currentWeatherRef = useRef(currentWeather);
  const weatherSnapshotLocationKeyRef = useRef(weatherSnapshotLocationKey);

  useEffect(() => {
    currentWeatherRef.current = currentWeather;
    weatherSnapshotLocationKeyRef.current = weatherSnapshotLocationKey;
  }, [currentWeather, weatherSnapshotLocationKey]);

  useEffect(() => {
    let isActive = true;

    if (!selectedLocation) {
      setCurrentWeather(INITIAL_CURRENT_WEATHER);
      setHourlyForecast([]);
      setHourlyState("loading");
      setAlertSummary(INITIAL_ALERT_SUMMARY);
      setPropertyRisk("Unavailable");
      setPropertyForecastLowF(null);
      setRoadReport(null);
      setRoadState("loading");
      setWeatherSnapshotLocationKey(null);
      setHourlyForecastLocationKey(null);
      setAlertSummaryLocationKey(null);
      setRoadDataLocationKey(null);
      setHomeSuggestionsReady(false);
      return () => {
        isActive = false;
      };
    }

    const activeLocation = selectedLocation;
    const selectedLocationWeatherKey =
      getHomeWeatherSnapshotKey(activeLocation);
    const latestCurrentWeather = currentWeatherRef.current;
    const latestWeatherSnapshotLocationKey =
      weatherSnapshotLocationKeyRef.current;
    const hasPreviousWeatherForLocation =
      latestWeatherSnapshotLocationKey === selectedLocationWeatherKey &&
      latestCurrentWeather.hasWeatherData;
    const cachedCurrent = getCachedHomeInitialWeather(activeLocation);
    const cachedHourly = getCachedHourlyForecast(activeLocation);

    setWeatherSnapshotLocationKey(selectedLocationWeatherKey);
    setAlertSummaryLocationKey(selectedLocationWeatherKey);
    setRoadDataLocationKey(selectedLocationWeatherKey);
    setAlertSummary(INITIAL_ALERT_SUMMARY);
    setRoadReport(null);
    setRoadState(process.env.EXPO_OS === "web" ? "unavailable" : "loading");
    setHomeSuggestionsReady(false);

    if (cachedCurrent) {
      setCurrentWeather(
        buildHomeWeatherSnapshotFromInitialPayload(
          cachedCurrent.data,
          cachedCurrent.freshness,
        ),
      );
      setHomeSuggestionsReady(true);
    } else if (hasPreviousWeatherForLocation) {
      setCurrentWeather({
        ...latestCurrentWeather,
        dataState: "stale",
      });
      setHomeSuggestionsReady(true);
    } else {
      setCurrentWeather(INITIAL_CURRENT_WEATHER);
    }

    if (cachedHourly) {
      const hourlyEntries = cachedHourly.data.timelines?.hourly ?? [];
      setHourlyForecast(hourlyEntries);
      setHourlyState(cachedHourly.freshness);
      setHourlyForecastLocationKey(selectedLocationWeatherKey);
      const nextPropertyForecastLowF = sameHomeLocation(
        propertyLocation,
        activeLocation,
      )
        ? getHomeForecastLowFFromHourlyEntries(hourlyEntries)
        : null;
      setPropertyForecastLowF(nextPropertyForecastLowF);
      setPropertyRisk(getHomePropertyRiskFromLowF(nextPropertyForecastLowF));
    } else {
      setHourlyForecast([]);
      setHourlyState("loading");
      setHourlyForecastLocationKey(selectedLocationWeatherKey);
      setPropertyForecastLowF(null);
      setPropertyRisk("Unavailable");
    }

    async function loadPersistedCache() {
      const persistedCache = await hydrateCachedHomeWeather(activeLocation);

      if (!isActive) {
        return;
      }

      if (
        persistedCache.current &&
        currentWeatherRef.current.dataState !== "fresh"
      ) {
        setCurrentWeather(
          buildHomeWeatherSnapshotFromInitialPayload(
            persistedCache.current.data,
            persistedCache.current.freshness,
          ),
        );
        setHomeSuggestionsReady(true);
      }

      if (persistedCache.hourly) {
        const hourlyEntries =
          persistedCache.hourly.data.timelines?.hourly ?? [];
        const nextPropertyForecastLowF = sameHomeLocation(
          propertyLocation,
          activeLocation,
        )
          ? getHomeForecastLowFFromHourlyEntries(hourlyEntries)
          : null;

        setHourlyForecast(hourlyEntries);
        setHourlyState(persistedCache.hourly.freshness);
        setHourlyForecastLocationKey(selectedLocationWeatherKey);
        setPropertyForecastLowF(nextPropertyForecastLowF);
        setPropertyRisk(getHomePropertyRiskFromLowF(nextPropertyForecastLowF));
      }
    }

    async function loadCurrentWeather() {
      try {
        const payload = await getSharedHomeInitialWeather(activeLocation);

        if (!isActive) {
          return;
        }

        setCurrentWeather((previousWeatherState) =>
          mergeHomeWeatherSnapshot(
            previousWeatherState,
            buildHomeWeatherSnapshotFromInitialPayload(payload, "fresh"),
          ),
        );
        setWeatherSnapshotLocationKey(selectedLocationWeatherKey);
        setHomeSuggestionsReady(true);
      } catch (error) {
        const fallbackLabel = formatClockLabel(new Date());

        console.log("[Home] Current weather request failed", {
          reason: error instanceof Error ? error.message : String(error),
        });

        if (!isActive) {
          return;
        }

        if (cachedCurrent) {
          setCurrentWeather({
            ...buildHomeWeatherSnapshotFromInitialPayload(
              cachedCurrent.data,
              getWeatherFailureState({ hasLastKnownGood: true }),
            ),
            refreshFallbackLabel: fallbackLabel,
          });
        } else if (hasPreviousWeatherForLocation) {
          setCurrentWeather({
            ...latestCurrentWeather,
            dataState: getWeatherFailureState({ hasLastKnownGood: true }),
            refreshFallbackLabel:
              latestCurrentWeather.refreshFallbackLabel ?? fallbackLabel,
          });
        } else {
          setCurrentWeather({
            ...INITIAL_CURRENT_WEATHER,
            hasWeatherData: false,
            conditionLabel: "Weather unavailable",
            dataState: getWeatherFailureState({ hasLastKnownGood: false }),
            refreshFallbackLabel: fallbackLabel,
          });
        }

        setHomeSuggestionsReady(true);
      }
    }

    async function loadHourlyForecast() {
      try {
        const result = await getSharedHourlyForecast(activeLocation);

        if (!isActive) {
          return;
        }

        const hourlyEntries = result.timelines?.hourly ?? [];
        const nextPropertyForecastLowF = sameHomeLocation(
          propertyLocation,
          activeLocation,
        )
          ? getHomeForecastLowFFromHourlyEntries(hourlyEntries)
          : null;

        setHourlyForecast(hourlyEntries);
        setHourlyState("fresh");
        setHourlyForecastLocationKey(selectedLocationWeatherKey);
        setPropertyForecastLowF(nextPropertyForecastLowF);
        setPropertyRisk(getHomePropertyRiskFromLowF(nextPropertyForecastLowF));
        setHomeSuggestionsReady(true);
      } catch (error) {
        const fallbackHourly = getCachedHourlyForecast(activeLocation);

        console.log("[Home] Hourly forecast request failed", {
          reason: error instanceof Error ? error.message : String(error),
        });

        if (!isActive) {
          return;
        }

        if (fallbackHourly) {
          const hourlyEntries = fallbackHourly.data.timelines?.hourly ?? [];
          const nextPropertyForecastLowF = sameHomeLocation(
            propertyLocation,
            activeLocation,
          )
            ? getHomeForecastLowFFromHourlyEntries(hourlyEntries)
            : null;

          setHourlyForecast(hourlyEntries);
          setHourlyState("stale");
          setHourlyForecastLocationKey(selectedLocationWeatherKey);
          setPropertyForecastLowF(nextPropertyForecastLowF);
          setPropertyRisk(
            getHomePropertyRiskFromLowF(nextPropertyForecastLowF),
          );
        } else {
          setHourlyForecast([]);
          setHourlyState("unavailable");
          setHourlyForecastLocationKey(selectedLocationWeatherKey);
          setPropertyForecastLowF(null);
          setPropertyRisk("Unavailable");
        }

        setHomeSuggestionsReady(true);
      }
    }

    async function loadAlerts() {
      try {
        const result = await getActiveAlertsForLocation(
          activeLocation.latitude,
          activeLocation.longitude,
        );

        if (!isActive) {
          return;
        }

        const features = result.features ?? [];

        if (features.length === 0) {
          setAlertSummary({
            status: "none",
            event: null,
            area: formatCityState(activeLocation),
            severity: null,
            certainty: null,
            headline: null,
            description: null,
            effective: null,
            ends: null,
          });
        } else {
          const firstAlert = features[0];
          const event = firstAlert.properties?.event ?? "Active alert";
          const area =
            firstAlert.properties?.areaDesc ?? formatCityState(activeLocation);
          setAlertSummary({
            status: "active",
            event,
            area,
            severity: firstAlert.properties?.severity ?? null,
            certainty: firstAlert.properties?.certainty ?? null,
            headline: firstAlert.properties?.headline ?? null,
            description: firstAlert.properties?.description ?? null,
            effective: firstAlert.properties?.effective ?? null,
            ends: firstAlert.properties?.ends ?? null,
          });
        }

        setAlertSummaryLocationKey(selectedLocationWeatherKey);
        setHomeSuggestionsReady(true);
      } catch (error) {
        console.log("[Home] Alerts request failed", {
          reason: error instanceof Error ? error.message : String(error),
        });

        if (!isActive) {
          return;
        }

        setAlertSummary({
          status: "unavailable",
          event: null,
          area: null,
          severity: null,
          certainty: null,
          headline: null,
          description: null,
          effective: null,
          ends: null,
        });
        setAlertSummaryLocationKey(selectedLocationWeatherKey);
        setHomeSuggestionsReady(true);
      }
    }

    async function loadDailyForecast() {
      try {
        await getSharedForecast(activeLocation);
      } catch (error) {
        console.log("[Home] Daily forecast request failed", {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    async function loadRoadData() {
      if (process.env.EXPO_OS === "web") {
        setRoadReport(null);
        setRoadState("unavailable");
        setRoadDataLocationKey(selectedLocationWeatherKey);
        return;
      }

      try {
        const report = await getWydotRoadReport(activeLocation);

        if (!isActive) {
          return;
        }

        setRoadReport(report);
        setRoadState(
          getRoadFallbackState({
            hasRoadData: !!report,
            hasWeatherEstimate: currentWeatherRef.current.hasWeatherData,
          }),
        );
        setRoadDataLocationKey(selectedLocationWeatherKey);
      } catch (error) {
        console.log("[Home] Road report request failed", {
          reason: error instanceof Error ? error.message : String(error),
        });

        if (!isActive) {
          return;
        }

        setRoadReport(null);
        setRoadState(
          getRoadFallbackState({
            hasRoadData: false,
            hasWeatherEstimate: currentWeatherRef.current.hasWeatherData,
          }),
        );
        setRoadDataLocationKey(selectedLocationWeatherKey);
      }

      setHomeSuggestionsReady(true);
    }

    void loadPersistedCache();
    void loadCurrentWeather();
    void loadHourlyForecast();
    void loadAlerts();
    void loadDailyForecast();
    void loadRoadData();

    return () => {
      isActive = false;
    };
  }, [selectedLocation, propertyLocation]);

  const selectedLocationWeatherKey = selectedLocation
    ? getHomeWeatherSnapshotKey(selectedLocation)
    : null;
  const currentWeatherMatches =
    selectedLocationWeatherKey !== null &&
    weatherSnapshotLocationKey === selectedLocationWeatherKey;
  const hourlyMatches =
    selectedLocationWeatherKey !== null &&
    hourlyForecastLocationKey === selectedLocationWeatherKey;
  const alertsMatch =
    selectedLocationWeatherKey !== null &&
    alertSummaryLocationKey === selectedLocationWeatherKey;
  const roadMatches =
    selectedLocationWeatherKey !== null &&
    roadDataLocationKey === selectedLocationWeatherKey;

  const scopedCurrentWeather = currentWeatherMatches
    ? currentWeather
    : INITIAL_CURRENT_WEATHER;
  const scopedHourlyForecast = hourlyMatches ? hourlyForecast : [];
  const scopedHourlyState = hourlyMatches ? hourlyState : "loading";
  const scopedAlertSummary = alertsMatch ? alertSummary : INITIAL_ALERT_SUMMARY;
  const scopedRoadReport = roadMatches ? roadReport : null;
  const scopedRoadState = roadMatches ? roadState : "loading";
  const weatherReady = scopedCurrentWeather.dataState !== "loading";
  const hourlyReady = scopedHourlyState !== "loading";
  const alertsReady = scopedAlertSummary.status !== "loading";
  const roadReady = scopedRoadState !== "loading";
  const suggestionsReady =
    homeSuggestionsReady &&
    (weatherReady || roadReady || scopedAlertSummary.status === "active");

  return {
    currentWeather: scopedCurrentWeather,
    hourlyForecast: scopedHourlyForecast,
    alertSummary: scopedAlertSummary,
    propertyRisk: hourlyMatches ? propertyRisk : "Unavailable",
    propertyForecastLowF: hourlyMatches ? propertyForecastLowF : null,
    roadReport: scopedRoadReport,
    hourlyState: scopedHourlyState,
    roadState: scopedRoadState,
    homeSuggestionsReady,
    weatherReady,
    hourlyReady,
    alertsReady,
    roadReady,
    suggestionsReady,
  };
}
