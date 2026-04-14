import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

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
  celsiusToFahrenheit,
  getFreezeRiskLabel,
  getRoadCautionMessage,
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
  temperatureF: number | null;
  windSpeedMph: number | null;
  precipProbability: number | null;
  humidity: number | null;
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
  temperatureF: null,
  windSpeedMph: null,
  precipProbability: null,
  humidity: null,
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

function buildHomeViewModel(params: {
  currentWeather: HomeCurrentWeatherSnapshot;
  alertSummary: HomeAlertSummary;
  propertyRisk: PropertyRisk;
  propertyLocationName: string;
  roadReport: WydotRoadReport | null;
  topTitle: string;
}): HomeViewModel {
  const {
    currentWeather,
    alertSummary,
    propertyRisk,
    propertyLocationName,
    roadReport,
    topTitle,
  } = params;
  const observation = roadReport?.primaryStationObservation;
  const hasRestriction =
    !!roadReport && roadReport.primarySegment.restriction !== 'None';
  const hasAdvisory = !!roadReport && roadReport.primarySegment.advisory !== 'None';
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
    if (hasRestriction && roadReport) {
      return {
        title: 'Travel restriction posted',
        subtitle: `${roadReport.routeCode} near ${roadReport.townGroup}`,
        statusLabel: 'Restriction',
        statusTone: 'alert',
        actionLabel: 'Review now',
      };
    }

    if (hasAdvisory && roadReport) {
      return {
        title: 'Travel advisory posted',
        subtitle: `${roadReport.routeCode} near ${roadReport.townGroup}`,
        statusLabel: 'Advisory',
        statusTone: 'warning',
        actionLabel: 'Monitor',
      };
    }

    if (alertSummary.status === 'active') {
      return {
        title: alertSummary.event ?? 'Official weather alert active',
        subtitle: alertSummary.area ?? 'Official guidance is active for this area',
        statusLabel: 'Alert',
        statusTone: 'alert',
        actionLabel: 'Review now',
      };
    }

    if (propertyRisk === 'High') {
      return {
        title: 'Freeze-sensitive conditions possible',
        subtitle: `${propertyLocationName} forecast low is in the freeze-risk range.`,
        statusLabel: 'Freeze',
        statusTone: 'warning',
        actionLabel: 'Monitor',
      };
    }

    if (propertyRisk === 'Moderate') {
      return {
        title: 'Freeze watch remains in range',
        subtitle: `${propertyLocationName} forecast low is near the freeze threshold.`,
        statusLabel: 'Freeze',
        statusTone: 'warning',
        actionLabel: 'Monitor',
      };
    }

    return {
      title: 'No active operational flags',
      subtitle: 'No restrictions, advisories, or official alerts are active right now.',
      statusLabel: 'Stable',
      statusTone: 'good',
      actionLabel: 'Monitor',
    };
  })();

  const monitoringCard: HomeMonitoringCard = (() => {
    if (propertyRisk === 'High') {
      return {
        title: 'Freeze risk is elevated',
        body: `${propertyLocationName} forecast low supports freeze protection planning.`,
      };
    }

    if (propertyRisk === 'Moderate') {
      return {
        title: 'Freeze risk remains near threshold',
        body: `${propertyLocationName} forecast low is close enough to freezing to keep under watch.`,
      };
    }

    if ((hasRestriction || hasAdvisory) && roadReport) {
      return {
        title: 'Road conditions deserve a check',
        body: `${roadReport.routeCode} near ${roadReport.townGroup} has active WYDOT guidance.`,
      };
    }

    if (surfaceCondition && surfaceCondition !== 'Dry' && roadReport) {
      return {
        title: 'Road surface is not fully dry',
        body: `${surfaceCondition} is the latest surface report for ${roadReport.townGroup}.`,
      };
    }

    if ((currentWeather.temperatureF ?? 99) <= 32) {
      return {
        title: 'Cold air is being watched',
        body: `Current air temperature is ${formatTemperatureValue(currentWeather.temperatureF)}.`,
      };
    }

    return {
      title: 'No immediate freeze concern',
      body: `${propertyLocationName} currently has no freeze-driven monitoring flag.`,
    };
  })();

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
    statusLabel: hasRestriction
      ? 'Restriction'
      : hasAdvisory || (surfaceCondition !== null && surfaceCondition !== 'Dry')
        ? 'Advisory'
        : alertSummary.status === 'active'
          ? 'Alert'
          : 'Normal',
    statusTone: hasRestriction
      ? 'alert'
      : hasAdvisory || (surfaceCondition !== null && surfaceCondition !== 'Dry')
        ? 'warning'
        : alertSummary.status === 'active'
          ? 'alert'
          : 'good',
    impactLabel:
      hasRestriction || hasAdvisory ? 'Impact possible soon' : 'Impact in 6+ hrs',
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
  const [roadReport, setRoadReport] = useState<WydotRoadReport | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadHome() {
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
          temperatureF,
          windSpeedMph,
          precipProbability,
          humidity:
            typeof values.humidity === 'number' ? Math.round(values.humidity) : null,
          conditionLabel: getConditionLabel(weatherCode),
          sourceTimestamp,
          refreshFallbackLabel: fallbackLabel,
        });
      } else {
        setCurrentWeather({
          ...INITIAL_CURRENT_WEATHER,
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
        } else {
          setPropertyRisk('Unavailable');
        }
      } else {
        setPropertyRisk('Unavailable');
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
    }

    void loadHome();

    return () => {
      isActive = false;
    };
  }, [selectedLocation, propertyLocation]);

  const topTitle = useMemo(
    () => getTopTitle(roadReport, selectedLocation.name),
    [roadReport, selectedLocation.name]
  );
  const homeViewModel = useMemo<HomeViewModel>(
    () =>
      buildHomeViewModel({
        currentWeather,
        alertSummary,
        propertyRisk,
        propertyLocationName: propertyLocation.name,
        roadReport,
        topTitle,
      }),
    [alertSummary, currentWeather, propertyLocation.name, propertyRisk, roadReport, topTitle]
  );
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
    const nextLocation = savedLocations.find((location) => location.id === locationId);

    if (!nextLocation || nextLocation.id === selectedLocation.id) {
      setSwitchModalVisible(false);
      return;
    }

    await setSelectedLocation(nextLocation);
    setSwitchModalVisible(false);
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
