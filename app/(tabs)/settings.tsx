import SettingsScreenV2, {
  type SettingsDefaultView,
} from "@/components/settings/SettingsScreenV2";
import {
  hydrateSettingsStore,
  setAutoRefreshData,
  setDefaultView,
  useAppSettings,
  useSettingsStoreReady,
} from "@/data/settingsStore";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect } from "react";

function getVersionText() {
  return Constants.expoConfig?.version ?? "Unavailable";
}

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useAppSettings();
  useSettingsStoreReady();

  useEffect(() => {
    void hydrateSettingsStore();
  }, []);

  async function handleSelectDefaultView(defaultView: SettingsDefaultView) {
    await setDefaultView(defaultView);
  }

  async function handleToggleAutoRefreshData() {
    await setAutoRefreshData(!settings.autoRefreshData);
  }

  return (
    <SettingsScreenV2
      defaultView={settings.defaultView}
      autoRefreshData={settings.autoRefreshData}
      versionText={getVersionText()}
      lastSyncText="Unavailable"
      onPressClose={() => router.push("/")}
      onPressManageOperationalLocations={() =>
        router.push("/manage-locations")
      }
      onSelectDefaultView={handleSelectDefaultView}
      onToggleAutoRefreshData={handleToggleAutoRefreshData}
    />
  );
}
