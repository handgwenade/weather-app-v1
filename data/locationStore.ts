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
  selectedLocationId: string;
  defaultLocationId: string;
  propertyLocationId: string;
};

const STORAGE_KEY = 'weather-app-location-store-v2';

const DEFAULT_LOCATIONS: AppLocation[] = [
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

let savedLocations: AppLocation[] = DEFAULT_LOCATIONS;
let selectedLocationId = DEFAULT_LOCATIONS[0].id;
let defaultLocationId = DEFAULT_LOCATIONS[0].id;
let propertyLocationId = DEFAULT_LOCATIONS[0].id;
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

function getLocationById(id: string) {
  return savedLocations.find((location) => location.id === id);
}

function getFallbackLocation() {
  return savedLocations[0] ?? DEFAULT_LOCATIONS[0];
}

function repairIdsIfNeeded() {
  const selectedExists = savedLocations.some((location) => location.id === selectedLocationId);
  const defaultExists = savedLocations.some((location) => location.id === defaultLocationId);
  const propertyExists = savedLocations.some((location) => location.id === propertyLocationId);

  if (!selectedExists) {
    selectedLocationId = getFallbackLocation().id;
  }

  if (!defaultExists) {
    defaultLocationId = getFallbackLocation().id;
  }

  if (!propertyExists) {
    propertyLocationId = getFallbackLocation().id;
  }
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

      if (
        Array.isArray(parsed.savedLocations) &&
        parsed.savedLocations.length > 0 &&
        typeof parsed.selectedLocationId === 'string' &&
        typeof parsed.defaultLocationId === 'string'
      ) {
        savedLocations = parsed.savedLocations;
        selectedLocationId = parsed.selectedLocationId;
        defaultLocationId = parsed.defaultLocationId;
        propertyLocationId =
          typeof parsed.propertyLocationId === 'string'
            ? parsed.propertyLocationId
            : parsed.defaultLocationId;

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
  return getLocationById(selectedLocationId) ?? getFallbackLocation();
}

export function getDefaultLocation() {
  repairIdsIfNeeded();
  return getLocationById(defaultLocationId) ?? getFallbackLocation();
}

export function getPropertyLocation() {
  repairIdsIfNeeded();
  return getLocationById(propertyLocationId) ?? getFallbackLocation();
}

export async function setSelectedLocation(location: AppLocation) {
  const exists = savedLocations.some((item) => item.id === location.id);

  if (!exists) {
    savedLocations = [...savedLocations, location];
  }

  selectedLocationId = location.id;
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

  try {
    await persistState();
  } catch (error) {
    console.log('Failed to persist new saved location:', error);
  }

  emitChange();
  return newLocation;
}

export async function deleteSavedLocation(locationId: string) {
  if (savedLocations.length <= 1) {
    throw new Error('You must keep at least one saved location.');
  }

  const locationToDelete = savedLocations.find((location) => location.id === locationId);

  if (!locationToDelete) {
    return;
  }

  savedLocations = savedLocations.filter((location) => location.id !== locationId);

  if (selectedLocationId === locationId) {
    selectedLocationId = getFallbackLocation().id;
  }

  if (defaultLocationId === locationId) {
    defaultLocationId = getFallbackLocation().id;
  }

  if (propertyLocationId === locationId) {
    propertyLocationId = getFallbackLocation().id;
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
