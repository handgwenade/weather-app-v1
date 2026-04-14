import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  formatCityState,
  usePropertyLocation,
  useSelectedLocation,
} from '../../data/locationStore';

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

export default function SettingsScreen() {
  const router = useRouter();
  const selectedLocation = useSelectedLocation();
  const propertyLocation = usePropertyLocation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <View style={styles.topRow}>
            <Pressable style={styles.circleButton} onPress={() => router.push('/')}>
              <Ionicons name="home-outline" size={24} color="#ffffff" />
            </Pressable>

            <Text style={styles.appTitle}>Settings</Text>

            <Pressable
              style={styles.circleButton}
              onPress={() => router.push('/manage-locations')}>
              <Ionicons name="location-outline" size={24} color="#ffffff" />
            </Pressable>
          </View>

          <Text style={styles.pageTitle}>App Preferences</Text>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#d6e4ff" />
            <Text style={styles.locationText}>
              Current location: {formatCityState(selectedLocation)}
            </Text>
          </View>

          <Text style={styles.pageSubtext}>
            Manage your saved places and review how the app is currently set up.
          </Text>
        </View>

        <View style={styles.primaryCard}>
          <Text style={styles.primaryCardTitle}>Locations</Text>

          <View style={styles.locationBlock}>
            <Text style={styles.sectionLabel}>CURRENT LOCATION</Text>
            <Text style={styles.locationName}>{selectedLocation.name}</Text>
            <Text style={styles.locationDetails}>{formatCityState(selectedLocation)}</Text>
            <Text style={styles.locationUsage}>Used by Home, Road, and Alerts</Text>
          </View>

          <View style={styles.locationDivider} />

          <View style={styles.locationBlock}>
            <Text style={styles.sectionLabel}>PROPERTY LOCATION</Text>
            <Text style={styles.locationName}>{propertyLocation.name}</Text>
            <Text style={styles.locationDetails}>{formatCityState(propertyLocation)}</Text>
            <Text style={styles.locationUsage}>Used by Property</Text>
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/manage-locations')}>
            <Ionicons name="location-outline" size={18} color="#EAF4FF" />
            <Text style={styles.primaryButtonText}>Manage Locations</Text>
          </Pressable>
        </View>

        <View style={styles.twoColumnRow}>
          <MiniCard
            title="Units"
            style={styles.unitsCard}
            titleStyle={styles.unitsCardTitle}>
            <Text style={styles.miniCardText}>Temperature: °F</Text>
            <Text style={styles.miniCardText}>Wind: mph</Text>
            <Text style={styles.miniCardSubtext}>Fixed for now</Text>
          </MiniCard>

          <MiniCard
            title="Data Sources"
            style={styles.sourceCard}
            titleStyle={styles.sourceCardTitle}>
            <Text style={styles.miniCardText}>Weather: Tomorrow.io</Text>
            <Text style={styles.miniCardText}>Alerts: NWS</Text>
            <Text style={styles.miniCardText}>Road: WYDOT</Text>
          </MiniCard>
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>How it Works</Text>
          <Text style={styles.noteText}>
            Home, Road, and Alerts follow your current location. Property stays tied to your
            nursery or home base.
          </Text>
        </View>
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
  header: {
    marginBottom: 22,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
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
  pageTitle: {
    color: '#ffffff',
    fontSize: 22,
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  locationText: {
    color: '#d6e4ff',
    fontSize: 16,
    flexShrink: 1,
  },
  pageSubtext: {
    color: '#b8c6e0',
    fontSize: 16,
    lineHeight: 24,
  },
  primaryCard: {
    backgroundColor: 'rgba(143, 211, 255, 0.10)',
    borderColor: 'rgba(143, 211, 255, 0.22)',
    borderWidth: 1,
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  primaryCardTitle: {
    color: '#D8F3FF',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 18,
  },
  locationBlock: {
    marginBottom: 14,
  },
  sectionLabel: {
    color: '#9EB5D8',
    fontSize: 13,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationDetails: {
    color: '#E5EDF9',
    fontSize: 16,
    marginBottom: 6,
  },
  locationUsage: {
    color: '#9EB5D8',
    fontSize: 14,
    lineHeight: 20,
  },
  locationDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: 'rgba(125, 181, 255, 0.22)',
    borderColor: 'rgba(160, 205, 255, 0.34)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#EAF4FF',
    fontSize: 18,
    fontWeight: '600',
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
    minHeight: 150,
  },
  miniCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  miniCardText: {
    color: '#E5EDF9',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
  },
  miniCardSubtext: {
    color: '#9EB5D8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  unitsCard: {
    backgroundColor: 'rgba(102, 122, 148, 0.16)',
    borderColor: 'rgba(185, 204, 226, 0.20)',
  },
  unitsCardTitle: {
    color: '#E5EDF9',
  },
  sourceCard: {
    backgroundColor: 'rgba(120, 146, 186, 0.12)',
    borderColor: 'rgba(190, 210, 235, 0.18)',
  },
  sourceCardTitle: {
    color: '#D8ECFF',
  },
  noteCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  noteTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  noteText: {
    color: '#E5EDF9',
    fontSize: 16,
    lineHeight: 24,
  },
});