import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const ROAD_API_BASE_URL = process.env.EXPO_PUBLIC_ROAD_API_BASE_URL;

export type PushRegistrationResult =
  | {
      ok: true;
      expoPushToken: string;
    }
  | {
      ok: false;
      reason: string;
    };

function getExpoProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("official-alerts", {
    name: "Official alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2F7FD8",
  });
}

export async function registerForOfficialAlertPushNotifications(): Promise<PushRegistrationResult> {
  if (!Device.isDevice) {
    return {
      ok: false,
      reason: "Push notifications require a physical device.",
    };
  }

  await ensureAndroidNotificationChannel();

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (existingPermissions.status !== "granted") {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== "granted") {
    return {
      ok: false,
      reason: "Notification permission was not granted.",
    };
  }

  const projectId = getExpoProjectId();

  if (!projectId) {
    return {
      ok: false,
      reason: "Expo project ID is unavailable.",
    };
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return {
    ok: true,
    expoPushToken: tokenResponse.data,
  };
}

export async function registerOfficialAlertPushTokenWithBackend(
  expoPushToken: string,
) {
  if (!ROAD_API_BASE_URL) {
    throw new Error("Road API base URL is not configured.");
  }

  const response = await fetch(
    `${ROAD_API_BASE_URL}/api/notifications/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expoPushToken,
        platform: Platform.OS,
        notificationTypes: ["official-alerts"],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Push token registration failed: ${response.status}`);
  }

  return response.json() as Promise<{ ok: true }>;
}

export async function initializeOfficialAlertPushNotifications() {
  const registration = await registerForOfficialAlertPushNotifications();

  if (!registration.ok) {
    console.log("[PushNotifications] Registration skipped", {
      reason: registration.reason,
    });
    return registration;
  }

  await registerOfficialAlertPushTokenWithBackend(registration.expoPushToken);

  console.log("[PushNotifications] Registered official alert push token");

  return registration;
}
