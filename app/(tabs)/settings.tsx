import SettingsScreenV2, {
  type SettingsDefaultView,
} from "@/components/settings/SettingsScreenV2";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function SettingsScreen() {
  const router = useRouter();

  const [defaultView, setDefaultView] =
    useState<SettingsDefaultView>("home");
  const [showConfidenceLevels, setShowConfidenceLevels] = useState(false);
  const [autoRefreshData, setAutoRefreshData] = useState(true);

  return (
    <SettingsScreenV2
      defaultView={defaultView}
      showConfidenceLevels={showConfidenceLevels}
      autoRefreshData={autoRefreshData}
      versionText="1.2.4"
      lastSyncText="6:42 AM"
      onPressClose={() => router.push("/")}
      onPressManageOperationalLocations={() =>
        router.push("/manage-locations")
      }
      onSelectDefaultView={setDefaultView}
      onToggleShowConfidenceLevels={() =>
        setShowConfidenceLevels((current) => !current)
      }
      onToggleAutoRefreshData={() =>
        setAutoRefreshData((current) => !current)
      }
    />
  );
}
