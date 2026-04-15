import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import QuickSwitchModal from '@/components/quickSwitchModal';
import HomeScreenV2, {
  type HomeBullet,
  type HomeMetric,
  type HomeLocationCard,
  type HomeMonitoringCard,
  type HomeOutlookItem,
  type HomeStatusBanner,
} from '@/components/home/HomeScreenV2';
import { getSharedCurrentWeather, getSharedForecast } from '@/data/weatherStore';
import {
  formatCityState,
  setSelectedLocation,
  usePropertyLocation,
  useSavedLocations,
  useSelectedLocation,
} from '@/data/locationStore';
import { getActiveAlertsForLocation } from '@/services/nws';
import { getWydotRoadReport, type WydotRoadReport } from '@/services/wydot';
import {
  evaluateSuggestions,
  getSuggestionPresentation,
  type RuleMatch,
  type SuggestionDecision,
  SuggestionCode,
  type SuggestionInput,
} from '@/utils/suggestions';
import {
  celsiusToFahrenheit,
  getFreezeRiskLabel,
  metersPerSecondToMph,
} from '@/utils/weather';

function getConditionLabel(weatherCode?: number) {
  if (weatherCode === 1000) return 'Clear';
  if (weatherCode === 1100) return 'Mostly clear';
  if (weatherCode === 1101) return 'Partly cloudy';
  if (weatherCode === 1102) return 'Mostly cloudy';
  if (weatherCode === 1001) return 'Cloudy';
  if (weatherCode === 4000) return 'Drizzle';
  if (weatherCode === 4001) return 'Rain';
  if (weatherCode === 4200) return 'Light rain';
  if (weatherCode === 4201) return 'Heavy rain';
  if (weatherCode === 5000) return 'Snow';
  if (weatherCode === 5100) return 'Light snow';
  if (weatherCode === 5101) return 'Heavy snow';
  if (weatherCode === 6000) return 'Freezing drizzle';
  if (weatherCode === 6200) return 'Light freezing rain';
  if (weatherCode === 6201) return 'Heavy freezing rain';
  if (weatherCode === 8000) return 'Thunderstorm';
  return 'Current conditions';
}


function formatRoundedNumber(value?: number | null, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return `${Math.round(value)}${suffix}`;
}

type PropertyRisk = 'High' | 'Moderate' | 'Low' | 'Unavailable';

type HomeCurrentWeatherSnapshot = {
  hasWeatherData: boolean;
  temperatureF: number | null;
  windSpeedMph: number | null;
  precipProbability: number | null;
  humidity: number | null;
  weatherCode: number | null;
  conditionLabel: string;
  sourceTimestamp: string | null;
  refreshFallbackLabel: string | null;
};

type HomeAlertSummary = {
  status: 'loading' | 'none' | 'active' | 'unavailable';
  event: string | null;
  area: string | null;
};

type HomeViewModel = {
  updatedLabel: string;
  metrics: HomeMetric[];
  statusBanner: HomeStatusBanner;
  monitoringCard: HomeMonitoringCard;
  monitoredLocationCard: HomeLocationCard;
};

const INITIAL_CURRENT_WEATHER: HomeCurrentWeatherSnapshot = {
  hasWeatherData: false,
  temperatureF: null,
  windSpeedMph: null,
  precipProbability: null,
  humidity: null,
  weatherCode: null,
  conditionLabel: 'Current conditions',
  sourceTimestamp: null,
  refreshFallbackLabel: null,
};

const INITIAL_ALERT_SUMMARY: HomeAlertSummary = {
  status: 'loading',
  event: null,
  area: null,
};

function formatClockLabel(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTemperatureValue(value?: number | null) {
  return value === null || value === undefined || Number.isNaN(value)
    ? '--'
    : `${Math.round(value)}°F`;
}

function formatPercentValue(value?: number | null) {
  return value === null || value === undefined || Number.isNaN(value)
    ? '--'
    : `${Math.round(value)}%`;
}

function formatWindValue(value?: number | null, direction?: string | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  const baseValue = `${Math.round(value)} mph`;
  return direction ? `${baseValue} ${direction}` : baseValue;
}

function getTopTitle(report: WydotRoadReport | null, fallback: string) {
  if (report) {
    return `${report.routeCode} ${report.townGroup}`;
  }

  return fallback;
}

function getHomeStatusSubtitle(
  primarySuggestion: RuleMatch,
  params: {
    alertSummary: HomeAlertSummary;
    currentWeather: HomeCurrentWeatherSnapshot;
    propertyLocationName: string;
    propertyRisk: PropertyRisk;
    roadReport: WydotRoadReport | null;
  },
) {
  const { alertSummary, currentWeather, propertyLocationName, propertyRisk, roadReport } = params;

  switch (primarySuggestion.code) {
    case SuggestionCode.ROAD_CLOSED:
    case SuggestionCode.TRAVEL_RESTRICTION_POSTED:
    case SuggestionCode.TRAVEL_ADVISORY_POSTED:
      return roadReport
        ? `${roadReport.routeCode} near ${roadReport.townGroup}`
        : primarySuggestion.whyBullets[0] ?? 'Road guidance is active';
    case SuggestionCode.OFFICIAL_WEATHER_ALERT_ACTIVE:
      return alertSummary.area ?? 'Official guidance is active for this area';
    case SuggestionCode.FREEZE_RISK_TONIGHT:
      return propertyRisk === 'High'
        ? `${propertyLocationName} forecast low is in the freeze-risk range.`
        : `${propertyLocationName} forecast low is near the freeze threshold.`;
    case SuggestionCode.HIGH_WIND_CAUTION:
      return currentWeather.windSpeedMph !== null
        ? `Observed wind: ${Math.round(currentWeather.windSpeedMph)} mph`
        : primarySuggestion.whyBullets[0] ?? 'Observed wind is elevated';
    case SuggestionCode.USE_CAUTION:
      return currentWeather.temperatureF !== null
        ? `Current air temp: ${formatTemperatureValue(currentWeather.temperatureF)}`
        : primarySuggestion.whyBullets[0] ?? 'Current conditions deserve caution';
    case SuggestionCode.DRIFTING_CONCERN:
      return 'Wind and snow-related conditions are worth watching.';
    case SuggestionCode.ROAD_DATA_UNAVAILABLE:
    case SuggestionCode.WEATHER_DATA_UNAVAILABLE:
      return primarySuggestion.whyBullets[0] ?? 'Data for this location is limited right now.';
    case SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS:
    default:
      return 'Conditions stable at this location.';
  }
}

function getHomeMonitoringCard(
  decision: SuggestionDecision | null,
  params: {
    propertyLocationName: string;
    propertyRisk: PropertyRisk;
  },
): HomeMonitoringCard {
  if (!decision) {
    return {
      title: 'Collecting current guidance',
      body: 'Checking road, weather, and forecast signals for this location.',
    };
  }

  const freezeSuggestion =
    decision.primary?.code === SuggestionCode.FREEZE_RISK_TONIGHT
      ? decision.primary
      : decision.secondary.find(
          (match) => match.code === SuggestionCode.FREEZE_RISK_TONIGHT,
        ) ?? null;

  if (freezeSuggestion) {
    return {
      title: freezeSuggestion.title,
      body:
        params.propertyRisk === 'High'
          ? `${params.propertyLocationName} forecast low supports freeze protection planning.`
          : `${params.propertyLocationName} forecast low is close enough to freezing to keep under watch.`,
    };
  }

  const focusSuggestion =
    decision.secondary[0] ??
    decision.primary ??
    null;

  if (!focusSuggestion) {
    return {
      title: 'Conditions stable at this location',
      body: `No major weather issues are active for ${params.propertyLocationName} right now.`,
    };
  }

  const focusPresentation = getSuggestionPresentation(focusSuggestion);

  return {
    title: focusSuggestion.title,
    body: focusPresentation.recommendationText,
  };
}

function buildHomeViewModel(params: {
  currentWeather: HomeCurrentWeatherSnapshot;
  alertSummary: HomeAlertSummary;
  propertyRisk: PropertyRisk;
  propertyLocationName: string;
  roadReport: WydotRoadReport | null;
  suggestionDecision: SuggestionDecision | null;
  topTitle: string;
}): HomeViewModel {
  const {
    currentWeather,
    alertSummary,
    propertyRisk,
    propertyLocationName,
    roadReport,
    suggestionDecision,
    topTitle,
  } = params;
  const observation = roadReport?.primaryStationObservation;
  const surfaceCondition =
    roadReport?.primarySegment.officialCondition &&
    !['None'].includes(roadReport.primarySegment.officialCondition)
      ? roadReport.primarySegment.officialCondition
      : null;
  const windMetric = observation?.windDirection
    ? formatWindValue(observation.windAvgMph, observation.windDirection)
    : formatWindValue(currentWeather.windSpeedMph);
  const metrics: HomeMetric[] = [
    { label: 'Air Temp', value: formatTemperatureValue(currentWeather.temperatureF) },
    { label: 'Road Temp', value: formatRoundedNumber(observation?.surfaceTempF, '°F') },
    { label: 'Wind', value: windMetric },
    { label: 'Gusts', value: formatRoundedNumber(observation?.windGustMph, ' mph') },
    { label: 'Precip Prob', value: formatPercentValue(currentWeather.precipProbability) },
    { label: 'Humidity', value: formatPercentValue(currentWeather.humidity) },
  ];

  const updatedLabel = (() => {
    const sourceLabel = currentWeather.sourceTimestamp
      ? formatClockLabel(currentWeather.sourceTimestamp)
      : null;

    if (sourceLabel) {
      return sourceLabel;
    }

    if (currentWeather.refreshFallbackLabel) {
      return `Last refresh ${currentWeather.refreshFallbackLabel}`;
    }

    return 'Waiting for data';
  })();

  const statusBanner: HomeStatusBanner = (() => {
    if (!suggestionDecision?.primary) {
      return {
        title: 'Collecting current guidance',
        subtitle: 'Checking road, weather, and forecast signals for this location.',
        statusLabel: 'Loading',
        statusTone: 'neutral',
        actionLabel: 'Monitor',
      };
    }

    const primarySuggestion = suggestionDecision.primary;
    const presentation = getSuggestionPresentation(primarySuggestion);

    return {
      title: primarySuggestion.title,
      subtitle: getHomeStatusSubtitle(primarySuggestion, {
        alertSummary,
        currentWeather,
        propertyLocationName,
        propertyRisk,
        roadReport,
      }),
      statusLabel: presentation.levelLabel,
      statusTone: presentation.homeTone,
      actionLabel: presentation.actionLabel,
    };
  })();

  const monitoringCard = getHomeMonitoringCard(suggestionDecision, {
    propertyLocationName,
    propertyRisk,
  });

  const bullets: HomeBullet[] = [];

  if (currentWeather.temperatureF !== null) {
    bullets.push({
      id: 'air-temp',
      text: `Air temp: ${formatTemperatureValue(currentWeather.temperatureF)}`,
    });
  }

  if (surfaceCondition) {
    bullets.push({
      id: 'surface',
      text: `Surface: ${surfaceCondition === 'Dry' ? 'Dry' : surfaceCondition}`,
    });
  }

  if (alertSummary.status === 'active' && alertSummary.event) {
    bullets.push({
      id: 'alert',
      text: `Alert: ${alertSummary.event}`,
    });
  } else if (windMetric !== '--') {
    bullets.push({
      id: 'wind',
      text: `Wind: ${windMetric}`,
    });
  } else if (currentWeather.precipProbability !== null) {
    bullets.push({
      id: 'precip-prob',
      text: `Precip prob: ${formatPercentValue(currentWeather.precipProbability)}`,
    });
  }

  const monitoredLocationCard: HomeLocationCard = {
    title: topTitle,
    bullets: bullets.slice(0, 3),
    statusLabel: suggestionDecision?.primary
      ? getSuggestionPresentation(suggestionDecision.primary).levelLabel
      : 'Unavailable',
    statusTone: suggestionDecision?.primary
      ? getSuggestionPresentation(suggestionDecision.primary).homeTone
      : 'neutral',
    impactLabel:
      suggestionDecision?.secondary.find(
        (match) => match.code === SuggestionCode.FREEZE_RISK_TONIGHT,
      )
        ? 'Forecast concern tonight'
        : suggestionDecision?.primary?.code === SuggestionCode.NO_ACTIVE_TRAVEL_IMPACTS
          ? 'Conditions stable'
          : suggestionDecision?.primary
            ? 'Active concern'
            : 'Awaiting data',
  };

  return {
    updatedLabel,
    metrics,
    statusBanner,
    monitoringCard,
    monitoredLocationCard,
  };
}

function buildOutlookItems(params: {
  forecastItems: string[];
  liveTemperature: string;
  conditionLabel: string;
}): HomeOutlookItem[] {
  const { forecastItems, liveTemperature, conditionLabel } = params;
  const currentTemp = parseInt(liveTemperature, 10);
  const safeCurrent = Number.isFinite(currentTemp) ? currentTemp : 36;
  const shortCondition = conditionLabel.split(' ')[0] || 'Clear';
  const labels = ['Now', '3 PM', '6 PM', '9 PM', '12 AM', '3 AM'];
  const deltas = [0, 2, -2, -8, -12, -14];

  return labels.map((label, index) => ({
    id: `${label}-${index}`,
    time: label,
    temperature: `${safeCurrent + deltas[index]}°`,
    condition: forecastItems[index % Math.max(forecastItems.length, 1)]?.includes('unavailable')
      ? '--'
      : shortCondition,
  }));
}

export default function HomeScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();
  const savedLocations = useSavedLocations();
  const propertyLocation = usePropertyLocation();

  const [currentWeather, setCurrentWeather] = useState<HomeCurrentWeatherSnapshot>(
    INITIAL_CURRENT_WEATHER
  );
  const [forecastItems, setForecastItems] = useState<string[]>([
    'Today: Forecast pending',
    'Tomorrow: Forecast pending',
    'Next: Forecast pending',
  ]);
  const [alertSummary, setAlertSummary] = useState<HomeAlertSummary>(
    INITIAL_ALERT_SUMMARY
  );
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [propertyRisk, setPropertyRisk] = useState<PropertyRisk>('Unavailable');
  const [propertyForecastLowF, setPropertyForecastLowF] = useState<number | null>(null);
  const [roadReport, setRoadReport] = useState<WydotRoadReport | null>(null);
  const [homeSuggestionsReady, setHomeSuggestionsReady] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadHome() {
      setHomeSuggestionsReady(false);

      if (!selectedLocation || !propertyLocation) {
        setCurrentWeather(INITIAL_CURRENT_WEATHER);
        setForecastItems([
          'Today: Forecast pending',
          'Tomorrow: Forecast pending',
          'Next: Forecast pending',
        ]);
        setAlertSummary(INITIAL_ALERT_SUMMARY);
        setPropertyRisk('Unavailable');
        setPropertyForecastLowF(null);
        setRoadReport(null);
        return;
      }

      const results = await Promise.allSettled([
        getSharedCurrentWeather(selectedLocation),
        getSharedForecast(selectedLocation),
        getSharedForecast(propertyLocation),
        getActiveAlertsForLocation(selectedLocation.latitude, selectedLocation.longitude),
        getWydotRoadReport(selectedLocation),
      ]);

      if (!isActive) {
        return;
      }

      const [currentResult, forecastResult, propertyResult, alertsResult, roadResult] = results;

      if (currentResult.status === 'fulfilled') {
        const values = currentResult.value.data.values;
        const temperatureF = celsiusToFahrenheit(values.temperature);
        const windSpeedMph = metersPerSecondToMph(values.windSpeed);
        const precipProbability = Math.round(values.precipitationProbability ?? 0);
        const weatherCode = values.weatherCode;
        const sourceTimestamp =
          typeof currentResult.value.data.time === 'string'
            ? currentResult.value.data.time
            : null;
        const fallbackLabel = sourceTimestamp
          ? null
          : formatClockLabel(new Date());

        setCurrentWeather({
          hasWeatherData: true,
          temperatureF,
          windSpeedMph,
          precipProbability,
          humidity:
            typeof values.humidity === 'number' ? Math.round(values.humidity) : null,
          weatherCode: typeof weatherCode === 'number' ? weatherCode : null,
          conditionLabel: getConditionLabel(weatherCode),
          sourceTimestamp,
          refreshFallbackLabel: fallbackLabel,
        });
      } else {
        setCurrentWeather({
          ...INITIAL_CURRENT_WEATHER,
          hasWeatherData: false,
          conditionLabel: 'Weather unavailable',
        });
      }

      if (forecastResult.status === 'fulfilled') {
        const daily = forecastResult.value.timelines.daily ?? [];

        setForecastItems(
          daily.slice(0, 3).map((day: any) => {
            const maxF = celsiusToFahrenheit(day.values.temperatureMax);
            const minF = celsiusToFahrenheit(day.values.temperatureMin);
            const dayName = new Date(day.time).toLocaleDateString('en-US', {
              weekday: 'short',
            });

            return `${dayName}: ${maxF}° / ${minF}°`;
          })
        );
      } else {
        setForecastItems([
          'Today: Forecast unavailable',
          'Tomorrow: Forecast unavailable',
          'Next: Forecast unavailable',
        ]);
      }

      if (propertyResult.status === 'fulfilled') {
        const firstDay = propertyResult.value.timelines.daily?.[0];

        if (firstDay) {
          const lowF = celsiusToFahrenheit(firstDay.values.temperatureMin);
          setPropertyRisk(getFreezeRiskLabel(lowF));
          setPropertyForecastLowF(lowF);
        } else {
          setPropertyRisk('Unavailable');
          setPropertyForecastLowF(null);
        }
      } else {
        setPropertyRisk('Unavailable');
        setPropertyForecastLowF(null);
      }

      if (alertsResult.status === 'fulfilled') {
        const features = alertsResult.value.features ?? [];

        if (features.length === 0) {
          setAlertSummary({
            status: 'none',
            event: null,
            area: formatCityState(selectedLocation),
          });
        } else {
          const firstAlert = features[0];
          const event = firstAlert.properties?.event ?? 'Active alert';
          const area = firstAlert.properties?.areaDesc ?? formatCityState(selectedLocation);
          setAlertSummary({
            status: 'active',
            event,
            area,
          });
        }
      } else {
        setAlertSummary({
          status: 'unavailable',
          event: null,
          area: null,
        });
      }

      if (roadResult.status === 'fulfilled') {
        setRoadReport(roadResult.value);
      } else {
        setRoadReport(null);
      }

      setHomeSuggestionsReady(true);
    }

    void loadHome();

    return () => {
      isActive = false;
    };
  }, [selectedLocation, propertyLocation]);

  const topTitle = useMemo(() => {
    if (!selectedLocation) {
      return null;
    }

    return getTopTitle(roadReport, selectedLocation.name);
  }, [roadReport, selectedLocation]);
  const suggestionInput = useMemo<SuggestionInput | null>(() => {
    if (!selectedLocation || !propertyLocation || !homeSuggestionsReady) {
      return null;
    }

    const observation = roadReport?.primaryStationObservation ?? null;

    return {
      road: {
        available: !!roadReport,
        mapped: !!roadReport,
        restriction: roadReport?.primarySegment.restriction ?? null,
        advisory: roadReport?.primarySegment.advisory ?? null,
        officialCondition: roadReport?.primarySegment.officialCondition ?? null,
        fetchedAt: roadReport?.fetchedAt ?? null,
        stationObservedAt: observation?.observedAt ?? null,
        windAvgMph: observation?.windAvgMph ?? null,
        windGustMph: observation?.windGustMph ?? null,
        windDirection: observation?.windDirection ?? null,
        visibilityFt: observation?.visibilityFt ?? null,
        airTempF: observation?.airTempF ?? null,
        surfaceTempF: observation?.surfaceTempF ?? null,
      },
      weather: {
        available: currentWeather.hasWeatherData,
        observedAt: currentWeather.sourceTimestamp,
        temperatureF: currentWeather.temperatureF,
        windSpeedMph: currentWeather.windSpeedMph,
        windDirection: null,
        precipProbability: currentWeather.precipProbability,
        weatherCode: currentWeather.weatherCode,
      },
      alerts: {
        available: alertSummary.status !== 'unavailable',
        hasActiveAlert: alertSummary.status === 'active',
        primaryEvent: alertSummary.event,
        primarySeverity: null,
        primaryCertainty: null,
      },
      forecast: {
        available: propertyForecastLowF !== null,
        dailyLowF: propertyForecastLowF,
      },
    };
  }, [
    alertSummary.event,
    alertSummary.status,
    currentWeather,
    homeSuggestionsReady,
    propertyForecastLowF,
    propertyLocation,
    roadReport,
    selectedLocation,
  ]);
  const suggestionDecision = useMemo<SuggestionDecision | null>(
    () => (suggestionInput ? evaluateSuggestions(suggestionInput) : null),
    [suggestionInput]
  );
  const homeViewModel = useMemo<HomeViewModel | null>(() => {
    if (!topTitle || !propertyLocation) {
      return null;
    }

    return buildHomeViewModel({
      currentWeather,
      alertSummary,
      propertyRisk,
      propertyLocationName: propertyLocation.name,
      roadReport,
      suggestionDecision,
      topTitle,
    });
  }, [alertSummary, currentWeather, propertyLocation, propertyRisk, roadReport, suggestionDecision, topTitle]);
  const outlookItems = useMemo<HomeOutlookItem[]>(
    () =>
      buildOutlookItems({
        forecastItems,
        liveTemperature:
          currentWeather.temperatureF === null ? '--' : `${currentWeather.temperatureF}°`,
        conditionLabel: currentWeather.conditionLabel,
      }),
    [currentWeather.conditionLabel, currentWeather.temperatureF, forecastItems]
  );

  async function handleQuickSwitch(locationId: string) {
    if (!selectedLocation) {
      setSwitchModalVisible(false);
      return;
    }

    const nextLocation = savedLocations.find((location) => location.id === locationId);

    if (!nextLocation || nextLocation.id === selectedLocation.id) {
      setSwitchModalVisible(false);
      return;
    }

    await setSelectedLocation(nextLocation);
    setSwitchModalVisible(false);
  }

  if (!selectedLocation || !propertyLocation || !homeViewModel || !topTitle) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderBottomWidth: 1,
              borderBottomColor: '#CAD5E2',
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 14,
            }}>
            <View
              style={{
                minHeight: 28,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <Text
                style={{
                  color: '#0F172B',
                  fontSize: 18,
                  fontWeight: '700',
                  lineHeight: 28,
                  letterSpacing: -0.44,
                }}>
                Home
              </Text>

              <Pressable onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={24} color="#2F5DA8" />
              </Pressable>
            </View>
          </View>

          <View
            style={{
              flex: 1,
              paddingHorizontal: 24,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text
              style={{
                color: '#0F172B',
                fontSize: 22,
                fontWeight: '700',
                lineHeight: 30,
                textAlign: 'center',
              }}>
              No saved location selected
            </Text>
            <Text
              style={{
                color: '#556274',
                fontSize: 15,
                lineHeight: 22,
                textAlign: 'center',
                marginTop: 8,
                maxWidth: 280,
              }}>
              Add a location to see local conditions here.
            </Text>
            <Pressable
              onPress={() => router.push('/manage-locations')}
              style={{
                marginTop: 20,
                minHeight: 44,
                borderRadius: 12,
                backgroundColor: '#2E6FC7',
                paddingHorizontal: 18,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: '600',
                  lineHeight: 20,
                }}>
                Manage Locations
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <HomeScreenV2
        topTitle={topTitle}
        updatedLabel={homeViewModel.updatedLabel}
        statusBanner={homeViewModel.statusBanner}
        metrics={homeViewModel.metrics}
        outlookItems={outlookItems}
        monitoringCard={homeViewModel.monitoringCard}
        monitoredLocationCard={homeViewModel.monitoredLocationCard}
        onPressSettings={() => router.push('/settings')}
        onPressSwitchLocation={() => setSwitchModalVisible(true)}
        onPressPrimaryAction={() => router.push('/alerts')}
        onPressSecondaryAction={() => router.push('/road')}
      />

      <QuickSwitchModal
        visible={switchModalVisible}
        title="Switch location"
        subtitle="Pick a saved place to refresh the Home snapshot."
        currentLocationId={selectedLocation.id}
        savedLocations={savedLocations}
        onClose={() => setSwitchModalVisible(false)}
        onSelectLocation={handleQuickSwitch}
        onManageLocations={() => {
          setSwitchModalVisible(false);
          router.push('/manage-locations');
        }}
      />
    </>
  );
}
