import SettingsScreenV2, {
  type SettingsDefaultView,
} from "@/components/settings/SettingsScreenV2";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function SettingsScreen() {
  const router = useRouter();

  const [defaultView, setDefaultView] =
    useState<SettingsDefaultView>("home");
  const [autoRefreshData, setAutoRefreshData] = useState(true);

  return (
    <SettingsScreenV2
      defaultView={defaultView}
      autoRefreshData={autoRefreshData}
      versionText="1.2.2"
      lastSyncText="Unavailable"
      onPressClose={() => router.push("/")}
      onPressManageOperationalLocations={() =>
        router.push("/manage-locations")
      }
      onSelectDefaultView={setDefaultView}
      onToggleAutoRefreshData={() =>
        setAutoRefreshData((current) => !current)
      }
    />
  );
}
