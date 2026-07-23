import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

export type SettingsDefaultView = "home" | "road" | "conditions";

export type AppSettingsState = {
  defaultView: SettingsDefaultView;
  autoRefreshData: boolean;
};

type PersistedSettingsState = Partial<AppSettingsState>;

const STORAGE_KEY = "roadsignal-settings-store-v1";
const DEFAULT_SETTINGS: AppSettingsState = {
  defaultView: "home",
  autoRefreshData: true,
};

let settingsState = DEFAULT_SETTINGS;
let persistedStateLoadPromise: Promise<void> | null = null;
let persistedStateLoaded = false;

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

function canUsePersistedStorage() {
  return process.env.EXPO_OS !== "web" || typeof window !== "undefined";
}

function isSettingsDefaultView(value: unknown): value is SettingsDefaultView {
  return value === "home" || value === "road" || value === "conditions";
}

export function normalizeSettingsState(
  value: PersistedSettingsState | null | undefined,
): AppSettingsState {
  return {
    defaultView: isSettingsDefaultView(value?.defaultView)
      ? value.defaultView
      : DEFAULT_SETTINGS.defaultView,
    autoRefreshData:
      typeof value?.autoRefreshData === "boolean"
        ? value.autoRefreshData
        : DEFAULT_SETTINGS.autoRefreshData,
  };
}

async function persistState() {
  if (!canUsePersistedStorage()) {
    return;
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settingsState));
}

async function persistStateSafely() {
  try {
    await persistState();
  } catch (error) {
    console.log("[SettingsStore] Failed to persist settings", error);
  }
}

async function loadPersistedState() {
  if (persistedStateLoadPromise) {
    return persistedStateLoadPromise;
  }

  if (!canUsePersistedStorage()) {
    persistedStateLoaded = true;
    return Promise.resolve();
  }

  persistedStateLoadPromise = (async () => {
    try {
      const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

      if (rawValue) {
        settingsState = normalizeSettingsState(JSON.parse(rawValue));
      }
    } catch (error) {
      console.log("[SettingsStore] Failed to load settings", error);
      settingsState = DEFAULT_SETTINGS;
    } finally {
      persistedStateLoaded = true;
      emitChange();
    }
  })();

  return persistedStateLoadPromise;
}

export function hydrateSettingsStore() {
  return loadPersistedState();
}

export function getSettingsSnapshot() {
  return settingsState;
}

export function useSettingsStoreReady() {
  return useSyncExternalStore(
    subscribe,
    () => persistedStateLoaded,
    () => true,
  );
}

export function useAppSettings() {
  return useSyncExternalStore(
    subscribe,
    getSettingsSnapshot,
    getSettingsSnapshot,
  );
}

export async function setDefaultView(defaultView: SettingsDefaultView) {
  settingsState = {
    ...settingsState,
    defaultView,
  };
  emitChange();
  await persistStateSafely();
}

export async function setAutoRefreshData(autoRefreshData: boolean) {
  settingsState = {
    ...settingsState,
    autoRefreshData,
  };
  emitChange();
  await persistStateSafely();
}
