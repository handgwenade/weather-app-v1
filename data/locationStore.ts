import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

export type AppLocation = {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

type PersistedLocationState = {
  activeLocation: AppLocation | null;
  savedLocations: AppLocation[];
  defaultLocationId: string | null;
  propertyLocationId: string | null;
};

const STORAGE_KEY = "weather-app-location-store-v2";

const LEGACY_SEEDED_LOCATIONS: AppLocation[] = [
  {
    id: "home-nursery",
    name: "Home Nursery",
    city: "Wheatland",
    state: "WY",
    latitude: 42.0544,
    longitude: -104.9527,
  },
  {
    id: "cheyenne",
    name: "Cheyenne",
    city: "Cheyenne",
    state: "WY",
    latitude: 41.14,
    longitude: -104.8202,
  },
  {
    id: "casper",
    name: "Casper",
    city: "Casper",
    state: "WY",
    latitude: 42.8501,
    longitude: -106.3252,
  },
];

let savedLocations: AppLocation[] = [];
let activeLocation: AppLocation | null = null;
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

function getEffectiveActiveLocation() {
  if (activeLocation) {
    const matchingSavedLocation = getLocationById(activeLocation.id);

    if (matchingSavedLocation) {
      return matchingSavedLocation;
    }
  }

  const defaultLocation = getLocationById(defaultLocationId);

  if (defaultLocation) {
    return defaultLocation;
  }

  return getFirstSavedLocation();
}

function repairIdsIfNeeded() {
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

function repairActiveLocationIfNeeded() {
  activeLocation = getEffectiveActiveLocation();
}

function isValidAppLocation(value: unknown): value is AppLocation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AppLocation>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.city === "string" &&
    typeof candidate.state === "string" &&
    typeof candidate.latitude === "number" &&
    typeof candidate.longitude === "number"
  );
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
    locations.every((location, index) =>
      isLegacySeededLocation(location, index),
    )
  );
}

async function persistState() {
  const payload: PersistedLocationState = {
    activeLocation,
    savedLocations,
    defaultLocationId,
    propertyLocationId,
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

async function persistStateSafely(errorMessage: string) {
  try {
    await persistState();
  } catch (error) {
    console.log(errorMessage, error);
  }
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
        const validSavedLocations =
          parsed.savedLocations.filter(isValidAppLocation);

        if (isLegacySeededState(validSavedLocations)) {
          activeLocation = null;
          savedLocations = [];
          defaultLocationId = null;
          propertyLocationId = null;
        } else {
          savedLocations = validSavedLocations;
          activeLocation = isValidAppLocation(parsed.activeLocation)
            ? parsed.activeLocation
            : (() => {
                const legacySelectedLocationId =
                  typeof (parsed as { selectedLocationId?: unknown })
                    .selectedLocationId === "string"
                    ? ((parsed as { selectedLocationId?: string })
                        .selectedLocationId ?? null)
                    : null;

                return getLocationById(legacySelectedLocationId);
              })();
          defaultLocationId =
            typeof parsed.defaultLocationId === "string"
              ? parsed.defaultLocationId
              : null;
          propertyLocationId =
            typeof parsed.propertyLocationId === "string"
              ? parsed.propertyLocationId
              : null;
        }

        repairIdsIfNeeded();
        repairActiveLocationIfNeeded();
        emitChange();
      }
    } catch (error) {
      console.log("Failed to load saved locations:", error);
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
  repairActiveLocationIfNeeded();
  return activeLocation;
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
  const matchingSavedLocation = getLocationById(location.id);

  if (!matchingSavedLocation) {
    return;
  }

  activeLocation = matchingSavedLocation;

  repairIdsIfNeeded();
  repairActiveLocationIfNeeded();

  await persistStateSafely("Failed to persist selected location:");
  emitChange();
}

export async function setDefaultLocation(locationId: string) {
  const exists = savedLocations.some((location) => location.id === locationId);

  if (!exists) {
    return;
  }

  defaultLocationId = locationId;
  repairIdsIfNeeded();

  await persistStateSafely("Failed to persist default location:");
  emitChange();
}

export async function setPropertyLocation(locationId: string) {
  const exists = savedLocations.some((location) => location.id === locationId);

  if (!exists) {
    return;
  }

  propertyLocationId = locationId;
  repairIdsIfNeeded();

  await persistStateSafely("Failed to persist property location:");
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

  if (!activeLocation) {
    activeLocation = newLocation;
  }

  if (!defaultLocationId) {
    defaultLocationId = newLocation.id;
  }

  if (!propertyLocationId) {
    propertyLocationId = newLocation.id;
  }

  repairActiveLocationIfNeeded();

  await persistStateSafely("Failed to persist new saved location:");

  emitChange();
  return newLocation;
}

export async function deleteSavedLocation(locationId: string) {
  const locationToDelete = savedLocations.find(
    (location) => location.id === locationId,
  );

  if (!locationToDelete) {
    return;
  }

  savedLocations = savedLocations.filter(
    (location) => location.id !== locationId,
  );
  const nextFallbackLocation = getFirstSavedLocation();

  if (defaultLocationId === locationId) {
    defaultLocationId = nextFallbackLocation?.id ?? null;
  }

  if (propertyLocationId === locationId) {
    propertyLocationId = nextFallbackLocation?.id ?? null;
  }

  repairIdsIfNeeded();
  repairActiveLocationIfNeeded();

  await persistStateSafely("Failed to persist deleted location:");

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
