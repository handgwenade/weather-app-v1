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

function getTopTitle(report: WydotRoadReport | null, fallback: string) {
  if (report) {
    return `${report.routeCode} ${report.townGroup}`;
  }

  return fallback;
}

function buildStatusBanner(params: {
  alertMessage: string;
  roadMessage: string;
  roadReport: WydotRoadReport | null;
  propertyRisk: string;
}): HomeStatusBanner {
  const { alertMessage, roadMessage, roadReport, propertyRisk } = params;
  const alertLower = alertMessage.toLowerCase();
  const roadLower = roadMessage.toLowerCase();

  if (roadReport?.primarySegment.restriction !== 'None') {
    return {
      title: 'Travel restrictions in effect',
      subtitle: `${roadReport?.routeCode} near ${roadReport?.townGroup} needs immediate attention`,
      statusLabel: 'Action',
      statusTone: 'alert',
      actionLabel: 'Review now',
    };
  }

  if (roadReport?.primarySegment.advisory !== 'None') {
    return {
      title: 'Travel advisory posted',
      subtitle: `${roadReport.routeCode} conditions need a closer look before heading out`,
      statusLabel: 'Watch',
      statusTone: 'warning',
      actionLabel: 'Monitor only',
    };
  }

  if (
    !alertLower.includes('no official alerts') &&
    !alertLower.includes('temporarily unavailable') &&
    !alertLower.includes('loading')
  ) {
    return {
      title: 'Active weather alerts posted',
      subtitle: 'Review official guidance before travel or outdoor work',
      statusLabel: 'Alert',
      statusTone: 'alert',
      actionLabel: 'Review now',
    };
  }

  if (propertyRisk === 'High') {
    return {
      title: 'Freeze-sensitive conditions tonight',
      subtitle: 'Cold temperatures may affect exposed surfaces and plants',
      statusLabel: 'Watch',
      statusTone: 'warning',
      actionLabel: 'Monitor only',
    };
  }

  if (
    roadLower.includes('freezing') ||
    roadLower.includes('near freezing') ||
    roadLower.includes('windy')
  ) {
    return {
      title: 'Minor maintenance concern',
      subtitle: roadMessage,
      statusLabel: 'Watch',
      statusTone: 'warning',
      actionLabel: 'Monitor only',
    };
  }

  return {
    title: 'No major maintenance concerns',
    subtitle: 'Conditions stable across monitored corridors',
    statusLabel: 'Good',
    statusTone: 'good',
    actionLabel: 'Monitor only',
  };
}

function buildMonitoringCard(params: {
  propertyRisk: string;
  propertyLocationName: string;
  roadMessage: string;
}): HomeMonitoringCard {
  const { propertyRisk, propertyLocationName, roadMessage } = params;
  const roadLower = roadMessage.toLowerCase();

  if (propertyRisk === 'High') {
    return {
      title: 'Freeze risk is elevated',
      body: `${propertyLocationName} may need protection before temperatures drop below freezing.`,
    };
  }

  if (propertyRisk === 'Moderate') {
    return {
      title: 'Freeze risk remains manageable',
      body: `${propertyLocationName} is close to caution range, so keep an eye on overnight temperatures.`,
    };
  }

  if (roadLower.includes('freezing') || roadLower.includes('near freezing')) {
    return {
      title: 'Cold pavement is being watched',
      body: 'Temperatures are trending lower, but monitored surfaces are not showing major impacts yet.',
    };
  }

  return {
    title: 'Freeze risk remains low',
    body: 'Temperatures are holding above freezing and pavement is dry.',
  };
}

function buildLocationBullets(params: {
  liveTemperature: string;
  roadReport: WydotRoadReport | null;
  alertMessage: string;
  roadMessage: string;
}): HomeBullet[] {
  const { liveTemperature, roadReport, alertMessage, roadMessage } = params;
  const bullets: HomeBullet[] = [];

  if (liveTemperature !== '--') {
    bullets.push({
      id: 'temp',
      text: `Air temps holding near ${liveTemperature}`,
    });
  }

  if (roadReport?.primarySegment.officialCondition && !['None'].includes(roadReport.primarySegment.officialCondition)) {
    bullets.push({
      id: 'surface',
      text:
        roadReport.primarySegment.officialCondition === 'Dry'
          ? 'Surface dry'
          : roadReport.primarySegment.officialCondition,
    });
  }

  if (roadMessage.toLowerCase().includes('windy')) {
    bullets.push({
      id: 'wind',
      text: 'Wind remains worth watching',
    });
  } else if (!alertMessage.toLowerCase().includes('no official alerts')) {
    bullets.push({
      id: 'alerts',
      text: 'Official guidance remains in view',
    });
  } else {
    bullets.push({
      id: 'drift',
      text: 'No drifting concern right now',
    });
  }

  return bullets.slice(0, 3);
}

function buildLocationCard(params: {
  topTitle: string;
  liveTemperature: string;
  roadReport: WydotRoadReport | null;
  alertMessage: string;
  roadMessage: string;
}): HomeLocationCard {
  const { topTitle, liveTemperature, roadReport, alertMessage, roadMessage } = params;
  const roadLower = roadMessage.toLowerCase();

  const statusTone =
    roadLower.includes('restriction') || roadLower.includes('advisory')
      ? 'warning'
      : 'good';

  return {
    title: topTitle,
    bullets: buildLocationBullets({
      liveTemperature,
      roadReport,
      alertMessage,
      roadMessage,
    }),
    statusLabel: statusTone === 'warning' ? 'Watch' : 'Monitor',
    statusTone,
    impactLabel:
      statusTone === 'warning' ? 'Impact possible soon' : 'Impact in 6+ hrs',
  };
}

function buildMetrics(params: {
  liveTemperature: string;
  roadReport: WydotRoadReport | null;
  liveWind: string;
  precipLine: string;
  humidityValue: string;
}): HomeMetric[] {
  const { liveTemperature, roadReport, liveWind, precipLine, humidityValue } = params;
  const observation = roadReport?.primaryStationObservation;
  const roadTemp = formatRoundedNumber(observation?.surfaceTempF, '°F');
  const gusts = formatRoundedNumber(observation?.windGustMph, ' mph');
  const wind = observation?.windDirection
    ? `${formatRoundedNumber(observation.windAvgMph, ' mph')} ${observation.windDirection}`
    : liveWind;

  return [
    { label: 'Air Temp', value: liveTemperature === '--' ? '--' : `${liveTemperature}F` },
    { label: 'Road Temp', value: roadTemp },
    { label: 'Wind', value: wind },
    { label: 'Gusts', value: gusts },
    { label: 'Precip', value: precipLine.replace('Precip ', '') || '--' },
    { label: 'Humidity', value: humidityValue },
  ];
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

  const [liveTemperature, setLiveTemperature] = useState('--');
  const [liveWind, setLiveWind] = useState('Unavailable');
  const [forecastItems, setForecastItems] = useState<string[]>([
    'Today: Forecast pending',
    'Tomorrow: Forecast pending',
    'Next: Forecast pending',
  ]);
  const [alertMessage, setAlertMessage] = useState('Loading alerts...');
  const [roadMessage, setRoadMessage] = useState('Loading road conditions...');
  const [lastUpdated, setLastUpdated] = useState('Updating now');
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [conditionLabel, setConditionLabel] = useState('Current conditions');
  const [precipLine, setPrecipLine] = useState('Precip --');
  const [humidityValue, setHumidityValue] = useState('--');
  const [propertyRisk, setPropertyRisk] = useState('Unavailable');
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

        setLiveTemperature(`${temperatureF}°`);
        setLiveWind(`${windSpeedMph} mph`);
        setPrecipLine(`Precip ${precipProbability}%`);
        setHumidityValue(`${Math.round(values.humidity ?? 0)}%`);
        setConditionLabel(getConditionLabel(weatherCode));
        setRoadMessage(getRoadCautionMessage(temperatureF, windSpeedMph));
        setLastUpdated(
          new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        );
      } else {
        setLiveTemperature('--');
        setLiveWind('Unavailable');
        setPrecipLine('Precip --');
        setHumidityValue('--');
        setConditionLabel('Weather unavailable');
        setRoadMessage('Road conditions temporarily unavailable');
        setLastUpdated('Waiting for data');
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
          setAlertMessage(`No official alerts right now for ${formatCityState(selectedLocation)}`);
        } else {
          const firstAlert = features[0];
          const event = firstAlert.properties?.event ?? 'Active alert';
          const area = firstAlert.properties?.areaDesc ?? formatCityState(selectedLocation);
          setAlertMessage(`${event} - ${area}`);
        }
      } else {
        setAlertMessage('Official alerts are temporarily unavailable');
      }

      if (roadResult.status === 'fulfilled') {
        const report = roadResult.value;
        setRoadReport(report);

        if (!report) {
          setRoadReport(null);
        } else if (report.primarySegment.restriction !== 'None') {
          setRoadMessage(`Restriction in effect near ${report.townGroup}`);
        } else if (report.primarySegment.advisory !== 'None') {
          setRoadMessage(`Advisory posted near ${report.townGroup}`);
        } else if (!['Dry', 'None'].includes(report.primarySegment.officialCondition)) {
          setRoadMessage(`${report.primarySegment.officialCondition} near ${report.townGroup}`);
        }
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
  const statusBanner = useMemo(
    () =>
      buildStatusBanner({
        alertMessage,
        roadMessage,
        roadReport,
        propertyRisk,
      }),
    [alertMessage, roadMessage, roadReport, propertyRisk]
  );
  const metrics = useMemo<HomeMetric[]>(
    () =>
      buildMetrics({
        liveTemperature,
        roadReport,
        liveWind,
        precipLine,
        humidityValue,
      }),
    [humidityValue, liveTemperature, liveWind, precipLine, roadReport]
  );
  const outlookItems = useMemo<HomeOutlookItem[]>(
    () =>
      buildOutlookItems({
        forecastItems,
        liveTemperature,
        conditionLabel,
      }),
    [conditionLabel, forecastItems, liveTemperature]
  );
  const monitoringCard = useMemo<HomeMonitoringCard>(
    () =>
      buildMonitoringCard({
        propertyRisk,
        propertyLocationName: propertyLocation.name,
        roadMessage,
      }),
    [propertyLocation.name, propertyRisk, roadMessage]
  );
  const monitoredLocationCard = useMemo<HomeLocationCard>(
    () =>
      buildLocationCard({
        topTitle,
        liveTemperature,
        roadReport,
        alertMessage,
        roadMessage,
      }),
    [alertMessage, liveTemperature, roadMessage, roadReport, topTitle]
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
        updatedLabel={lastUpdated}
        statusBanner={statusBanner}
        metrics={metrics}
        outlookItems={outlookItems}
        monitoringCard={monitoringCard}
        monitoredLocationCard={monitoredLocationCard}
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
