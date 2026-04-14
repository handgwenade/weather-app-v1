import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getActiveAlertsForLocation } from '../../services/nws';
import { formatCityState, useSelectedLocation } from '../../data/locationStore';

type AlertItem = {
  event: string;
  area: string;
};

function buildAlertsSummary(params: {
  loading: boolean;
  alertsAvailable: boolean;
  alerts: AlertItem[];
  locationLabel: string;
}) {
  const { loading, alertsAvailable, alerts, locationLabel } = params;

  if (loading) {
    return `Checking official alerts for ${locationLabel}.`;
  }

  if (!alertsAvailable) {
    return 'Official alerts are temporarily unavailable.';
  }

  if (alerts.length === 0) {
    return `No official alerts are active right now for ${locationLabel}.`;
  }

  if (alerts.length === 1) {
    return `${alerts[0].event} is active for ${locationLabel}. Review it before travel or outdoor work.`;
  }

  return `${alerts[0].event} is active, along with ${alerts.length - 1} more alert${alerts.length - 1 === 1 ? '' : 's'}, for ${locationLabel}. Review them before travel or outdoor work.`;
}

function getAlertHeadline(params: {
  loading: boolean;
  alertsAvailable: boolean;
  alertCount: number;
}) {
  const { loading, alertsAvailable, alertCount } = params;

  if (loading) {
    return 'LOADING ALERTS';
  }

  if (!alertsAvailable) {
    return 'ALERTS UNAVAILABLE';
  }

  if (alertCount === 0) {
    return 'NO ACTIVE ALERTS';
  }

  if (alertCount === 1) {
    return '1 ACTIVE ALERT';
  }

  return `${alertCount} ACTIVE ALERTS`;
}

function getAlertStatusText(params: {
  loading: boolean;
  alertsAvailable: boolean;
  alertCount: number;
}) {
  const { loading, alertsAvailable, alertCount } = params;

  if (loading) return 'Checking';
  if (!alertsAvailable) return 'Unavailable';
  if (alertCount === 0) return 'Clear';
  return 'Action needed';
}

type MiniCardProps = {
  title: string;
  children: React.ReactNode;
  style?: object;
  titleStyle?: object;
};

function MiniCard({ title, children, style, titleStyle }: MiniCardProps) {
  return (
    <View style={[styles.miniCard, style]}>
      <Text style={[styles.miniCardTitle, titleStyle]}>{title}</Text>
      {children}
    </View>
  );
}

export default function AlertsScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState('Not available');
  const [loading, setLoading] = useState(true);
  const [alertsAvailable, setAlertsAvailable] = useState(true);

  useEffect(() => {
    async function loadAlerts() {
      setLoading(true);

      try {
        const data = await getActiveAlertsForLocation(
          selectedLocation.latitude,
          selectedLocation.longitude
        );

        const features = data.features ?? [];

        if (features.length === 0) {
          setAlerts([]);
        } else {
          const alertItems = features.map((feature: any) => ({
            event: feature.properties?.event ?? 'Active alert',
            area: feature.properties?.areaDesc ?? formatCityState(selectedLocation),
          }));

          setAlerts(alertItems);
        }

        const now = new Date();
        const formattedTime = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        setLastUpdated(formattedTime);
        setAlertsAvailable(true);
      } catch (error) {
        console.log('Alerts screen fetch failed:', error);
        setAlerts([]);
        setLastUpdated('Not available');
        setAlertsAvailable(false);
      } finally {
        setLoading(false);
      }
    }

    loadAlerts();
  }, [selectedLocation]);

  const locationLabel = formatCityState(selectedLocation);
  const alertCount = alerts.length;
  const firstAlert = alerts[0]?.event ?? 'None';
  const alertSummary = buildAlertsSummary({
    loading,
    alertsAvailable,
    alerts,
    locationLabel,
  });
  const alertHeadline = getAlertHeadline({
    loading,
    alertsAvailable,
    alertCount,
  });
  const alertStatusText = getAlertStatusText({
    loading,
    alertsAvailable,
    alertCount,
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic">
        <View style={styles.hero}>
          <View style={styles.topRow}>
            <Pressable style={styles.circleButton} onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" size={24} color="#ffffff" />
            </Pressable>

            <Text style={styles.appTitle}>Alerts</Text>

            <Pressable style={styles.circleButton} onPress={() => router.push('/manage-locations')}>
              <Ionicons name="location-outline" size={24} color="#ffffff" />
            </Pressable>
          </View>

          {!alertsAvailable && (
            <Text style={styles.noticeText}>Official alerts are temporarily unavailable.</Text>
          )}

          <View style={styles.iconWrap}>
            <Ionicons
              name={alertCount > 0 ? 'warning-outline' : 'notifications-outline'}
              size={110}
              color={alertCount > 0 ? '#FFD6DE' : '#D6E4FF'}
            />
          </View>

          <View style={styles.centerMeta}>
            <View style={styles.centerLocationRow}>
              <Ionicons name="location-outline" size={16} color="#d6e4ff" />
              <Text style={styles.centerLocationText}>{locationLabel}</Text>
            </View>
          </View>

          <Text style={styles.heroTitleText}>{alertHeadline}</Text>
          <Text style={styles.updatedText}>updated {lastUpdated}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Alert Summary</Text>
          <Text style={styles.summaryText}>{alertSummary}</Text>
        </View>

        <View style={styles.twoColumnRow}>
          <MiniCard
            title="Status"
            style={styles.alertStatusCard}
            titleStyle={styles.alertStatusCardTitle}>
            <Text style={styles.miniCardText}>{alertStatusText}</Text>
            <Text style={styles.miniCardSubtext}>
              {alertsAvailable ? 'Official NWS alert status' : 'Feed unavailable'}
            </Text>
          </MiniCard>

          <MiniCard
            title="Primary Alert"
            style={styles.alertCountCard}
            titleStyle={styles.alertCountCardTitle}>
            <Text style={styles.miniCardText} numberOfLines={2}>
              {loading ? 'Loading...' : alertCount > 0 ? firstAlert : 'None'}
            </Text>
            <Text style={styles.miniCardSubtext}>
              {loading
                ? 'Checking now'
                : alertCount > 0
                  ? 'Most urgent visible alert'
                  : 'No active alerts'}
            </Text>
          </MiniCard>
        </View>

        {alertCount > 0 ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Active Alerts</Text>
            {alerts.map((alert, index) => (
              <View
                key={`${alert.event}-${index}`}
                style={[
                  styles.alertRow,
                  index < alerts.length - 1 ? styles.alertDivider : null,
                ]}>
                <Text style={styles.alertCardTitle}>{alert.event}</Text>
                <Text style={styles.alertCardText}>{alert.area}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Active Alerts</Text>
            <Text style={styles.infoCardText}>
              {loading
                ? 'Loading official alerts...'
                : !alertsAvailable
                  ? 'Could not load official alerts.'
                  : 'No official alerts right now.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A1630',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#0A1630',
  },
  container: {
    backgroundColor: '#0A1630',
    padding: 20,
    paddingBottom: 40,
  },
  hero: {
    marginBottom: 22,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  circleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '500',
  },
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
  centerMeta: {
    alignItems: 'center',
    marginBottom: 8,
  },
  centerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  centerLocationText: {
    color: '#d6e4ff',
    fontSize: 16,
    textAlign: 'center',
  },
  heroTitleText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 8,
  },
  updatedText: {
    color: '#8fa3c2',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  summaryTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  summaryText: {
    color: '#E5EDF9',
    fontSize: 16,
    lineHeight: 24,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  miniCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 136,
  },
  miniCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  miniCardText: {
    color: '#E5EDF9',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 6,
  },
  miniCardSubtext: {
    color: '#E5EDF9',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  alertStatusCard: {
    backgroundColor: 'rgba(176, 74, 94, 0.16)',
    borderColor: 'rgba(255, 120, 140, 0.28)',
  },
  alertStatusCardTitle: {
    color: '#FFD7E0',
  },
  alertCountCard: {
    backgroundColor: 'rgba(255, 214, 222, 0.10)',
    borderColor: 'rgba(255, 214, 222, 0.22)',
  },
  alertCountCardTitle: {
    color: '#FFE4EA',
  },
  infoCard: {
    backgroundColor: 'rgba(176, 74, 94, 0.10)',
    borderColor: 'rgba(255, 120, 140, 0.22)',
    borderWidth: 1,
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  infoCardTitle: {
    color: '#FFD7E0',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  infoCardText: {
    color: '#E5EDF9',
    fontSize: 16,
    lineHeight: 24,
  },
  alertRow: {
    paddingVertical: 8,
  },
  alertDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  alertCardTitle: {
    color: '#FFD7E0',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  alertCardText: {
    color: '#E5EDF9',
    fontSize: 16,
    lineHeight: 22,
  },
});
