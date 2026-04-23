import 'expo-dev-client';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import {
  upsertCurrentLocationSelection,
  useLocationStoreReady,
  useSelectedLocation,
} from '@/data/locationStore';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

let didAttemptCurrentLocationBootstrap = false;
let blockedCurrentLocationBootstrapForSession = false;

function buildCurrentLocationLabels(
  placemark: Location.LocationGeocodedAddress | null,
) {
  const city =
    placemark?.city?.trim() ||
    placemark?.district?.trim() ||
    placemark?.subregion?.trim() ||
    'Current Area';
  const state =
    placemark?.region?.trim() ||
    placemark?.isoCountryCode?.trim() ||
    'GPS';
  const name =
    placemark?.name?.trim() ||
    placemark?.city?.trim() ||
    'Current Location';

  return {
    name,
    city,
    state,
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const locationStoreReady = useLocationStoreReady();
  const selectedLocation = useSelectedLocation();

  useEffect(() => {
    let isActive = true;

    async function bootstrapCurrentLocation() {
      if (!locationStoreReady || selectedLocation) {
        return;
      }

      if (
        didAttemptCurrentLocationBootstrap ||
        blockedCurrentLocationBootstrapForSession
      ) {
        return;
      }

      didAttemptCurrentLocationBootstrap = true;

      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();

        if (!isActive || !servicesEnabled) {
          return;
        }

        const permission =
          await Location.requestForegroundPermissionsAsync();

        if (!isActive) {
          return;
        }

        if (permission.status !== 'granted') {
          blockedCurrentLocationBootstrapForSession = true;
          return;
        }

        const position = await Location.getCurrentPositionAsync({});

        if (!isActive) {
          return;
        }

        let firstPlacemark: Location.LocationGeocodedAddress | null = null;

        try {
          const placemarks = await Location.reverseGeocodeAsync({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });

          if (!isActive) {
            return;
          }

          firstPlacemark = placemarks[0] ?? null;
        } catch {
          firstPlacemark = null;
        }

        const labels = buildCurrentLocationLabels(firstPlacemark);

        await upsertCurrentLocationSelection({
          ...labels,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.log('Failed to bootstrap current location:', error);
      }
    }

    void bootstrapCurrentLocation();

    return () => {
      isActive = false;
    };
  }, [locationStoreReady, selectedLocation]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
