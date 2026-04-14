import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type AppLocation = {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

type PersistedLocationState = {
  savedLocations: AppLocation[];
  selectedLocationId: string | null;
  defaultLocationId: string | null;
  propertyLocationId: string | null;
};

const STORAGE_KEY = 'weather-app-location-store-v2';

const LEGACY_SEEDED_LOCATIONS: AppLocation[] = [
  {
    id: 'home-nursery',
    name: 'Home Nursery',
    city: 'Wheatland',
    state: 'WY',
    latitude: 42.0544,
    longitude: -104.9527,
  },
  {
    id: 'cheyenne',
    name: 'Cheyenne',
    city: 'Cheyenne',
    state: 'WY',
    latitude: 41.14,
    longitude: -104.8202,
  },
  {
    id: 'casper',
    name: 'Casper',
    city: 'Casper',
    state: 'WY',
    latitude: 42.8501,
    longitude: -106.3252,
  },
];

let savedLocations: AppLocation[] = [];
let selectedLocationId: string | null = null;
let defaultLocationId: string | null = null;
let propertyLocationId: string | null = null;
let persistedStateLoadPromise: Promise<void> | null = null;

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function normalizeState(state: string) {
  return state.trim().toUpperCase();
}

function buildLocationId() {
  return `location-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getLocationById(id: string | null) {
  if (!id) {
    return null;
  }

  return savedLocations.find((location) => location.id === id) ?? null;
}

function getFirstSavedLocation() {
  return savedLocations[0] ?? null;
}

function repairIdsIfNeeded() {
  if (
    selectedLocationId &&
    !savedLocations.some((location) => location.id === selectedLocationId)
  ) {
    selectedLocationId = null;
  }

  if (
    defaultLocationId &&
    !savedLocations.some((location) => location.id === defaultLocationId)
  ) {
    defaultLocationId = null;
  }

  if (
    propertyLocationId &&
    !savedLocations.some((location) => location.id === propertyLocationId)
  ) {
    propertyLocationId = null;
  }
}

function isLegacySeededLocation(location: AppLocation, index: number) {
  const legacyLocation = LEGACY_SEEDED_LOCATIONS[index];

  return (
    !!legacyLocation &&
    location.id === legacyLocation.id &&
    location.name === legacyLocation.name &&
    location.city === legacyLocation.city &&
    location.state === legacyLocation.state &&
    location.latitude === legacyLocation.latitude &&
    location.longitude === legacyLocation.longitude
  );
}

function isLegacySeededState(locations: AppLocation[]) {
  return (
    locations.length === LEGACY_SEEDED_LOCATIONS.length &&
    locations.every((location, index) => isLegacySeededLocation(location, index))
  );
}

async function persistState() {
  const payload: PersistedLocationState = {
    savedLocations,
    selectedLocationId,
    defaultLocationId,
    propertyLocationId,
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

async function loadPersistedState() {
  if (persistedStateLoadPromise) {
    return persistedStateLoadPromise;
  }

  persistedStateLoadPromise = (async () => {
    try {
      const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

      if (!rawValue) {
        return;
      }

      const parsed = JSON.parse(rawValue) as Partial<PersistedLocationState>;

      if (Array.isArray(parsed.savedLocations)) {
        if (isLegacySeededState(parsed.savedLocations)) {
          savedLocations = [];
          selectedLocationId = null;
          defaultLocationId = null;
          propertyLocationId = null;
        } else {
          savedLocations = parsed.savedLocations;
          selectedLocationId =
            typeof parsed.selectedLocationId === 'string'
              ? parsed.selectedLocationId
              : null;
          defaultLocationId =
            typeof parsed.defaultLocationId === 'string'
              ? parsed.defaultLocationId
              : null;
          propertyLocationId =
            typeof parsed.propertyLocationId === 'string'
              ? parsed.propertyLocationId
              : null;
        }

        repairIdsIfNeeded();
        emitChange();
      }
    } catch (error) {
      console.log('Failed to load saved locations:', error);
    }
  })();

  return persistedStateLoadPromise;
}

void loadPersistedState();

export function getSavedLocations() {
  return savedLocations;
}

export function getSelectedLocation() {
  repairIdsIfNeeded();
  return getLocationById(selectedLocationId);
}

export function getDefaultLocation() {
  repairIdsIfNeeded();
  return getLocationById(defaultLocationId);
}

export function getPropertyLocation() {
  repairIdsIfNeeded();
  return getLocationById(propertyLocationId);
}

export async function setSelectedLocation(location: AppLocation) {
  const exists = savedLocations.some((item) => item.id === location.id);

  if (!exists) {
    savedLocations = [...savedLocations, location];
  }

  selectedLocationId = location.id;

  if (!defaultLocationId) {
    defaultLocationId = location.id;
  }

  if (!propertyLocationId) {
    propertyLocationId = location.id;
  }

  repairIdsIfNeeded();

  try {
    await persistState();
  } catch (error) {
    console.log('Failed to persist selected location:', error);
  }

  emitChange();
}

export async function setDefaultLocation(locationId: string) {
  const exists = savedLocations.some((location) => location.id === locationId);

  if (!exists) {
    return;
  }

  defaultLocationId = locationId;
  repairIdsIfNeeded();

  try {
    await persistState();
  } catch (error) {
    console.log('Failed to persist default location:', error);
  }

  emitChange();
}

export async function setPropertyLocation(locationId: string) {
  const exists = savedLocations.some((location) => location.id === locationId);

  if (!exists) {
    return;
  }

  propertyLocationId = locationId;
  repairIdsIfNeeded();

  try {
    await persistState();
  } catch (error) {
    console.log('Failed to persist property location:', error);
  }

  emitChange();
}

export async function addSavedLocation(input: {
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}) {
  const newLocation: AppLocation = {
    id: buildLocationId(),
    name: input.name.trim(),
    city: input.city.trim(),
    state: normalizeState(input.state),
    latitude: input.latitude,
    longitude: input.longitude,
  };

  savedLocations = [...savedLocations, newLocation];

  if (!selectedLocationId) {
    selectedLocationId = newLocation.id;
  }

  if (!defaultLocationId) {
    defaultLocationId = newLocation.id;
  }

  if (!propertyLocationId) {
    propertyLocationId = newLocation.id;
  }

  try {
    await persistState();
  } catch (error) {
    console.log('Failed to persist new saved location:', error);
  }

  emitChange();
  return newLocation;
}

export async function deleteSavedLocation(locationId: string) {
  const locationToDelete = savedLocations.find((location) => location.id === locationId);

  if (!locationToDelete) {
    return;
  }

  savedLocations = savedLocations.filter((location) => location.id !== locationId);
  const nextFallbackLocation = getFirstSavedLocation();

  if (selectedLocationId === locationId) {
    selectedLocationId = nextFallbackLocation?.id ?? null;
  }

  if (defaultLocationId === locationId) {
    defaultLocationId = nextFallbackLocation?.id ?? null;
  }

  if (propertyLocationId === locationId) {
    propertyLocationId = nextFallbackLocation?.id ?? null;
  }

  repairIdsIfNeeded();

  try {
    await persistState();
  } catch (error) {
    console.log('Failed to persist deleted location:', error);
  }

  emitChange();
}

export function useSavedLocations() {
  return useSyncExternalStore(subscribe, getSavedLocations);
}

export function useSelectedLocation() {
  return useSyncExternalStore(subscribe, getSelectedLocation);
}

export function useDefaultLocation() {
  return useSyncExternalStore(subscribe, getDefaultLocation);
}

export function usePropertyLocation() {
  return useSyncExternalStore(subscribe, getPropertyLocation);
}

export function formatCityState(location: AppLocation) {
  return `${location.city}, ${location.state}`;
}
