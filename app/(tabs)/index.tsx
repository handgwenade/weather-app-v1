import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getActiveAlertsForLocation } from '../../services/nws';
import { getSharedCurrentWeather, getSharedForecast } from '../../data/weatherStore';
import {
  formatCityState,
  setSelectedLocation,
  usePropertyLocation,
  useSavedLocations,
  useSelectedLocation,
} from '../../data/locationStore';
import {
  getWydotRoadReport,
  type WydotRoadReport,
} from '../../services/wydot';
import {
  celsiusToFahrenheit,
  metersPerSecondToMph,
  getRoadCautionMessage,
  getFreezeRiskLabel,
} from '../../utils/weather';
import AppTopBar from '@/components/appTopBar';
import DashboardMiniCard from '@/components/dashboardMiniCard';
import SummaryCard from '@/components/summaryCard';
import QuickSwitchModal from '@/components/quickSwitchModal';

function getConditionLabel(weatherCode?: number) {
  if (weatherCode === 1000) return 'CLEAR';
  if (weatherCode === 1100) return 'MOSTLY CLEAR';
  if (weatherCode === 1101) return 'PARTLY CLOUDY';
  if (weatherCode === 1102) return 'MOSTLY CLOUDY';
  if (weatherCode === 1001) return 'CLOUDY';
  if (weatherCode === 4000) return 'DRIZZLE';
  if (weatherCode === 4001) return 'RAIN';
  if (weatherCode === 4200) return 'LIGHT RAIN';
  if (weatherCode === 4201) return 'HEAVY RAIN';
  if (weatherCode === 5000) return 'SNOW';
  if (weatherCode === 5100) return 'LIGHT SNOW';
  if (weatherCode === 5101) return 'HEAVY SNOW';
  if (weatherCode === 6000) return 'FREEZING DRIZZLE';
  if (weatherCode === 6200) return 'LIGHT FREEZING RAIN';
  if (weatherCode === 6201) return 'HEAVY FREEZING RAIN';
  if (weatherCode === 8000) return 'THUNDERSTORM';
  return 'CURRENT CONDITIONS';
}

function getIsNight(now = new Date()) {
  const hour = now.getHours();
  return hour < 6 || hour >= 19;
}

function getWeatherIconName(weatherCode?: number, isNight = false) {
  if (weatherCode === 1000) {
    return isNight ? 'moon-outline' : 'sunny-outline';
  }

  if (weatherCode === 1100 || weatherCode === 1101 || weatherCode === 1102) {
    return isNight ? 'moon-outline' : 'partly-sunny-outline';
  }

  if (weatherCode === 1001) return 'cloud-outline';

  if (
    weatherCode === 4000 ||
    weatherCode === 4001 ||
    weatherCode === 4200 ||
    weatherCode === 4201
  ) {
    return 'rainy-outline';
  }

  if (weatherCode === 5000 || weatherCode === 5100 || weatherCode === 5101) {
    return 'snow-outline';
  }

  if (weatherCode === 8000) return 'thunderstorm-outline';

  return isNight ? 'moon-outline' : 'partly-sunny-outline';
}

function getWeatherIconColor(weatherCode?: number) {
  if (weatherCode === 1000) return '#FFD166';
  if (weatherCode === 1100 || weatherCode === 1101 || weatherCode === 1102) {
    return '#F4D35E';
  }
  if (weatherCode === 1001) return '#D6E4FF';
  if (
    weatherCode === 4000 ||
    weatherCode === 4001 ||
    weatherCode === 4200 ||
    weatherCode === 4201
  ) {
    return '#7CC6FE';
  }
  if (weatherCode === 5000 || weatherCode === 5100 || weatherCode === 5101) {
    return '#BDE0FE';
  }
  if (weatherCode === 8000) return '#CDB4DB';
  return '#D6E4FF';
}

function getShortAlertStatus(message: string) {
  if (message.toLowerCase().includes('no official alerts')) return 'No alerts';
  if (message.toLowerCase().includes('temporarily unavailable')) return 'Unavailable';
  return 'Active alert';
}

function getShortRoadStatus(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('restriction')) return 'Restriction';
  if (normalized.includes('advisory')) return 'Advisory';
  if (normalized.includes('freezing')) return 'Freeze caution';
  if (normalized.includes('near freezing')) return 'Cold caution';
  if (normalized.includes('windy')) return 'Wind caution';
  if (normalized.includes('unavailable')) return 'Unavailable';
  return 'Looks okay';
}

function buildHomeRoadMessage(
  report: WydotRoadReport | null,
  weatherMessage: string
) {
  if (!report) {
    return weatherMessage;
  }

  const { primarySegment, townGroup } = report;

  if (primarySegment.restriction !== 'None') {
    return `Restriction in effect near ${townGroup}: ${primarySegment.restriction}`;
  }

  if (primarySegment.advisory !== 'None') {
    return `WYDOT advisory near ${townGroup}: ${primarySegment.advisory}`;
  }

  if (!['Dry', 'None'].includes(primarySegment.officialCondition)) {
    return `WYDOT reports ${primarySegment.officialCondition.toLowerCase()} near ${townGroup}`;
  }

  return weatherMessage;
}

function buildTodaySummary(params: {
  conditionLabel: string;
  alertMessage: string;
  roadMessage: string;
  propertyRisk: string;
}) {
  const { conditionLabel, alertMessage, roadMessage, propertyRisk } = params;
  const parts: string[] = [];
  const roadLower = roadMessage.toLowerCase();

  if (conditionLabel !== 'WEATHER UNAVAILABLE') {
    parts.push(`${conditionLabel.toLowerCase()} today`);
  } else {
    parts.push('live weather is temporarily unavailable');
  }

  if (alertMessage.toLowerCase().includes('no official alerts')) {
    parts.push('no official alerts right now');
  } else if (alertMessage.toLowerCase().includes('temporarily unavailable')) {
    parts.push('alerts are temporarily unavailable');
  } else {
    parts.push('an official alert is active');
  }

  if (roadLower.includes('restriction')) {
    parts.push('there is a road restriction near your current location');
  } else if (roadLower.includes('advisory')) {
    parts.push('wy dot has issued a travel advisory near your current location');
  } else if (roadLower.includes('freezing')) {
    parts.push('road travel may need extra caution');
  } else if (roadLower.includes('near freezing')) {
    parts.push('road conditions may need extra caution');
  } else if (roadLower.includes('windy')) {
    parts.push('wind may affect travel');
  }

  if (propertyRisk === 'High') {
    parts.push('property freeze risk is high tonight');
  } else if (propertyRisk === 'Moderate') {
    parts.push('sensitive plants may need protection tonight');
  }

  const sentence = parts.join('. ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}

function getPriorityBanner(params: {
  alertMessage: string;
  roadMessage: string;
  roadReport: WydotRoadReport | null;
  propertyRisk: string;
  propertyLocationName: string;
}) {
  const { alertMessage, roadMessage, roadReport, propertyRisk, propertyLocationName } = params;
  const alertLower = alertMessage.toLowerCase();
  const roadLower = roadMessage.toLowerCase();

  if (roadReport && roadReport.primarySegment.restriction !== 'None') {
    return {
      title: 'Restriction in Effect',
      body: `${roadReport.routeCode} near ${roadReport.townGroup}: ${roadReport.primarySegment.restriction}`,
      variant: 'road' as const,
      icon: 'warning-outline' as const,
    };
  }

  if (roadReport && roadReport.primarySegment.advisory !== 'None') {
    return {
      title: 'Travel Advisory',
      body: `${roadReport.routeCode} near ${roadReport.townGroup}: ${roadReport.primarySegment.advisory}`,
      variant: 'road' as const,
      icon: 'warning-outline' as const,
    };
  }

  if (
    !alertLower.includes('no official alerts') &&
    !alertLower.includes('temporarily unavailable') &&
    !alertLower.includes('loading')
  ) {
    return {
      title: 'Official Alert Active',
      body: alertMessage,
      variant: 'alert' as const,
      icon: 'warning-outline' as const,
    };
  }

  if (roadLower.includes('freezing')) {
    return {
      title: 'Travel Caution',
      body: 'Cold road conditions may need extra attention before heading out.',
      variant: 'road' as const,
      icon: 'snow-outline' as const,
    };
  }

  if (roadLower.includes('near freezing')) {
    return {
      title: 'Road Conditions Watch',
      body: 'Temperatures are hovering near freezing. Drive like your insurance agent is watching.',
      variant: 'road' as const,
      icon: 'thermometer-outline' as const,
    };
  }

  if (roadLower.includes('windy')) {
    return {
      title: 'Wind Caution',
      body: 'Wind may affect travel conditions today.',
      variant: 'road' as const,
      icon: 'warning-outline' as const,
    };
  }

  if (propertyRisk === 'High') {
    return {
      title: 'Freeze Risk Tonight',
      body: `${propertyLocationName} has a high freeze risk tonight. Cover sensitive plants.`,
      variant: 'property' as const,
      icon: 'snow-outline' as const,
    };
  }

  if (propertyRisk === 'Moderate') {
    return {
      title: 'Property Watch',
      body: `${propertyLocationName} may need plant protection tonight.`,
      variant: 'property' as const,
      icon: 'leaf-outline' as const,
    };
  }

  return null;
}

export default function HomeScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();
  const savedLocations = useSavedLocations();
  const propertyLocation = usePropertyLocation();

  const [liveTemperature, setLiveTemperature] = useState('Loading...');
  const [liveWind, setLiveWind] = useState('Loading...');
  const [forecastItems, setForecastItems] = useState(['Loading forecast...']);
  const [alertMessage, setAlertMessage] = useState('Loading alerts...');
  const [roadMessage, setRoadMessage] = useState('Loading road conditions...');
  const [lastUpdated, setLastUpdated] = useState('Not available');
  const [liveDataAvailable, setLiveDataAvailable] = useState(true);
  const [switchModalVisible, setSwitchModalVisible] = useState(false);

  const [conditionLabel, setConditionLabel] = useState('CURRENT CONDITIONS');
  const [weatherIconName, setWeatherIconName] = useState<
    | 'sunny-outline'
    | 'moon-outline'
    | 'partly-sunny-outline'
    | 'cloud-outline'
    | 'rainy-outline'
    | 'snow-outline'
    | 'thunderstorm-outline'
  >('cloud-outline');
  const [weatherIconColor, setWeatherIconColor] = useState('#D6E4FF');
  const [highLowLine, setHighLowLine] = useState('H --° / L --°');
  const [feelsLikeLine, setFeelsLikeLine] = useState('Feels like --°');
  const [precipLine, setPrecipLine] = useState('0%');

  const [propertyLow, setPropertyLow] = useState('--');
  const [propertyRisk, setPropertyRisk] = useState('Unavailable');
  const [roadReport, setRoadReport] = useState<WydotRoadReport | null>(null);

  useEffect(() => {
    async function loadWeather() {
      try {
        const data = await getSharedCurrentWeather(selectedLocation);
        const values = data.data.values;

        const temperatureF = celsiusToFahrenheit(values.temperature);
        const windSpeedMph = metersPerSecondToMph(values.windSpeed);
        const apparentF = celsiusToFahrenheit(values.temperatureApparent ?? values.temperature);
        const precipProbability = values.precipitationProbability ?? 0;
        const weatherCode = values.weatherCode;
        const isNight = getIsNight();

        const weatherRoadMessage = getRoadCautionMessage(temperatureF, windSpeedMph);

        setLiveTemperature(`${temperatureF}°F`);
        setLiveWind(`${windSpeedMph} mph`);
        setRoadMessage(weatherRoadMessage);
        setFeelsLikeLine(`Feels like ${apparentF}°`);
        setPrecipLine(`${Math.round(precipProbability)}%`);
        setConditionLabel(getConditionLabel(weatherCode));
        setWeatherIconName(getWeatherIconName(weatherCode, isNight));
        setWeatherIconColor(getWeatherIconColor(weatherCode));
        setLastUpdated(
          new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        );
        setLiveDataAvailable(true);
      } catch {
        setLiveTemperature('--');
        setLiveWind('Not available');
        setRoadMessage('Road conditions temporarily unavailable');
        setFeelsLikeLine('Feels like --');
        setPrecipLine('--');
        setConditionLabel('WEATHER UNAVAILABLE');
        setWeatherIconName('cloud-outline');
        setWeatherIconColor('#D6E4FF');
        setLastUpdated('Not available');
        setLiveDataAvailable(false);
      }
    }

    async function loadForecast() {
      try {
        const data = await getSharedForecast(selectedLocation);
        const dailyTimelines = data.timelines.daily;
        const firstDay = dailyTimelines[0];

        setForecastItems(
          dailyTimelines.slice(0, 3).map((day: any) => {
            const maxF = celsiusToFahrenheit(day.values.temperatureMax);
            const minF = celsiusToFahrenheit(day.values.temperatureMin);
            const dayName = new Date(day.time).toLocaleDateString('en-US', {
              weekday: 'short',
            });
            return `${dayName}: ${maxF}° / ${minF}°`;
          })
        );

        if (firstDay) {
          const highF = celsiusToFahrenheit(firstDay.values.temperatureMax);
          const lowF = celsiusToFahrenheit(firstDay.values.temperatureMin);
          setHighLowLine(`H ${highF}° / L ${lowF}°`);
        }
      } catch {
        setForecastItems(['Forecast temporarily unavailable']);
        setHighLowLine('H --° / L --°');
      }
    }

    async function loadPropertySnapshot() {
      try {
        const data = await getSharedForecast(propertyLocation);
        const firstDay = data.timelines.daily[0];

        if (!firstDay) {
          setPropertyLow('--');
          setPropertyRisk('Unavailable');
          return;
        }

        const lowF = celsiusToFahrenheit(firstDay.values.temperatureMin);
        setPropertyLow(`${lowF}°F`);
        setPropertyRisk(getFreezeRiskLabel(lowF));
      } catch {
        setPropertyLow('--');
        setPropertyRisk('Unavailable');
      }
    }

    async function loadAlerts() {
      try {
        const data = await getActiveAlertsForLocation(
          selectedLocation.latitude,
          selectedLocation.longitude
        );
        const features = data.features ?? [];

        if (features.length === 0) {
          setAlertMessage(`No official alerts right now for ${formatCityState(selectedLocation)}`);
          return;
        }

        const firstAlert = features[0];
        const event = firstAlert.properties?.event ?? 'Active alert';
        const area = firstAlert.properties?.areaDesc ?? formatCityState(selectedLocation);
        setAlertMessage(`${event} — ${area}`);
      } catch {
        setAlertMessage('Alerts temporarily unavailable');
      }
    }

    async function loadRoadReport() {
      try {
        const report = await getWydotRoadReport(selectedLocation);
        setRoadReport(report);

        setRoadMessage((currentMessage) => {
          const fallbackMessage =
            currentMessage === 'Loading road conditions...'
              ? 'Road conditions temporarily unavailable'
              : currentMessage;

          return buildHomeRoadMessage(report, fallbackMessage);
        });
      } catch {
        setRoadReport(null);
      }
    }

    loadWeather();
    loadForecast();
    loadPropertySnapshot();
    loadAlerts();
    loadRoadReport();
  }, [selectedLocation, propertyLocation]);

  const todaySummary = buildTodaySummary({
    conditionLabel,
    alertMessage,
    roadMessage,
    propertyRisk,
  });

  const priorityBanner = useMemo(
    () =>
      getPriorityBanner({
        alertMessage,
        roadMessage,
        roadReport,
        propertyRisk,
        propertyLocationName: propertyLocation.name,
      }),
    [alertMessage, roadMessage, roadReport, propertyRisk, propertyLocation.name]
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic">
        <View style={styles.hero}>
          <AppTopBar title="WyoWeather" />

          {!liveDataAvailable && (
            <Text style={styles.noticeText}>Live weather is temporarily unavailable.</Text>
          )}

          <View style={styles.iconWrap}>
            <Ionicons name={weatherIconName} size={110} color={weatherIconColor} />
          </View>

          <Pressable
            style={styles.locationSwitchButton}
            onPress={() => setSwitchModalVisible(true)}>
            <View style={styles.locationSwitchRow}>
              <Ionicons name="location-outline" size={16} color="#d6e4ff" />
              <Text style={styles.locationSwitchText}>
                {formatCityState(selectedLocation)}
              </Text>
              <Ionicons name="chevron-down-outline" size={14} color="#8fa3c2" />
            </View>
            <Text style={styles.locationSwitchHint}>tap to switch location</Text>
          </Pressable>

          <Text style={styles.tempText}>{liveTemperature}</Text>
          <Text style={styles.conditionText}>{conditionLabel}</Text>
          <Text style={styles.subConditionText}>{highLowLine}   {feelsLikeLine}</Text>
          <Text style={styles.updatedText}>updated {lastUpdated}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Wind</Text>
              <Text style={styles.statValue}>{liveWind}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>Precipitation</Text>
              <Text style={styles.statValue}>{precipLine}</Text>
            </View>
          </View>
        </View>

        {priorityBanner ? (
          <View
            style={[
              styles.priorityBanner,
              priorityBanner.variant === 'alert'
                ? styles.priorityBannerAlert
                : priorityBanner.variant === 'property'
                  ? styles.priorityBannerProperty
                  : styles.priorityBannerRoad,
            ]}>
            <View style={styles.priorityBannerTop}>
              <Ionicons name={priorityBanner.icon} size={18} color="#ffffff" />
              <Text style={styles.priorityBannerTitle}>{priorityBanner.title}</Text>
            </View>
            <Text style={styles.priorityBannerText}>{priorityBanner.body}</Text>
          </View>
        ) : null}

        <SummaryCard title="Today’s Summary">
          <Text style={styles.summaryText}>{todaySummary}</Text>
        </SummaryCard>

        <View style={styles.twoColumnRow}>
          <DashboardMiniCard
            title="Alerts"
            style={styles.alertsCard}
            titleStyle={styles.alertsCardTitle}
            minHeight={150}>
            <Text style={styles.miniCardText}>{getShortAlertStatus(alertMessage)}</Text>
            <Text style={styles.miniCardSubtext} numberOfLines={3}>
              {alertMessage}
            </Text>
          </DashboardMiniCard>

          <DashboardMiniCard
            title="Road"
            style={styles.roadCard}
            titleStyle={styles.roadCardTitle}
            minHeight={150}>
            <Text style={styles.miniCardText}>{getShortRoadStatus(roadMessage)}</Text>
            <Text style={styles.miniCardSubtext} numberOfLines={3}>
              {roadMessage}
            </Text>
          </DashboardMiniCard>
        </View>

        <View style={styles.twoColumnRow}>
          <DashboardMiniCard
            title="Forecast"
            style={styles.forecastCard}
            titleStyle={styles.forecastCardTitle}
            minHeight={150}>
            {forecastItems.slice(0, 3).map((item) => (
              <Text key={item} style={styles.forecastLine}>
                {item}
              </Text>
            ))}
          </DashboardMiniCard>

          <DashboardMiniCard
            title="Property"
            style={styles.propertyCard}
            titleStyle={styles.propertyCardTitle}
            minHeight={150}>
            <Text style={styles.miniCardText}>{propertyRisk} freeze risk</Text>
            <Text style={styles.miniCardSubtext}>Overnight low: {propertyLow}</Text>
            <Text style={styles.miniCardSubtext} numberOfLines={2}>
              {propertyLocation.name}
            </Text>
          </DashboardMiniCard>
        </View>
      </ScrollView>

      <QuickSwitchModal
        visible={switchModalVisible}
        title="Switch Current Location"
        subtitle="Choose which saved place Home, Road, and Alerts should use."
        currentLocationId={selectedLocation.id}
        savedLocations={savedLocations}
        onClose={() => setSwitchModalVisible(false)}
        onSelectLocation={handleQuickSwitch}
        onManageLocations={() => {
          setSwitchModalVisible(false);
          router.push('/manage-locations');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0A1630' },
  scrollView: { flex: 1, backgroundColor: '#0A1630' },
  container: { backgroundColor: '#0A1630', padding: 20, paddingBottom: 40 },
  hero: { marginBottom: 22 },
  noticeText: {
    color: '#d6e4ff',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  locationSwitchButton: {
    alignItems: 'center',
    marginBottom: 6,
  },
  locationSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  locationSwitchText: {
    color: '#d6e4ff',
    fontSize: 16,
    textAlign: 'center',
  },
  locationSwitchHint: {
    color: '#8fa3c2',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  tempText: {
    color: '#ffffff',
    fontSize: 82,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 90,
    marginBottom: 4,
  },
  conditionText: {
    color: '#ffffff',
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  subConditionText: {
    color: '#b8c6e0',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  updatedText: {
    color: '#8fa3c2',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 8,
  },
  statBlock: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statLabel: { color: '#b8c6e0', fontSize: 16, marginBottom: 8 },
  statValue: { color: '#ffffff', fontSize: 20, fontWeight: '600' },
  priorityBanner: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  priorityBannerAlert: {
    backgroundColor: 'rgba(176, 74, 94, 0.16)',
    borderColor: 'rgba(255, 120, 140, 0.28)',
  },
  priorityBannerRoad: {
    backgroundColor: 'rgba(244, 162, 97, 0.14)',
    borderColor: 'rgba(244, 162, 97, 0.26)',
  },
  priorityBannerProperty: {
    backgroundColor: 'rgba(143, 214, 148, 0.14)',
    borderColor: 'rgba(143, 214, 148, 0.26)',
  },
  priorityBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  priorityBannerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  priorityBannerText: {
    color: '#E5EDF9',
    fontSize: 15,
    lineHeight: 22,
  },
  summaryText: { color: '#E5EDF9', fontSize: 16, lineHeight: 24 },
  twoColumnRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  miniCardText: {
    color: '#E5EDF9',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 22,
  },
  miniCardSubtext: {
    color: '#E5EDF9',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  forecastLine: {
    color: '#E5EDF9',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  alertsCard: {
    backgroundColor: 'rgba(176, 74, 94, 0.16)',
    borderColor: 'rgba(255, 120, 140, 0.28)',
  },
  alertsCardTitle: { color: '#FFD7E0' },
  forecastCard: {
    backgroundColor: 'rgba(76, 132, 201, 0.16)',
    borderColor: 'rgba(125, 181, 255, 0.28)',
  },
  forecastCardTitle: { color: '#D8ECFF' },
  roadCard: {
    backgroundColor: 'rgba(102, 122, 148, 0.16)',
    borderColor: 'rgba(185, 204, 226, 0.20)',
  },
  roadCardTitle: { color: '#E5EDF9' },
  propertyCard: {
    backgroundColor: 'rgba(143, 214, 148, 0.12)',
    borderColor: 'rgba(143, 214, 148, 0.24)',
  },
  propertyCardTitle: { color: '#DDF7E0' },
});