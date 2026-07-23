import Constants from "expo-constants";
import * as Device from "expo-device";
import type { AppLocation } from "@/data/locationStore";
import { Platform } from "react-native";

const ROAD_API_BASE_URL = process.env.EXPO_PUBLIC_ROAD_API_BASE_URL;
type NotificationsModule = typeof import("expo-notifications");
let notificationHandlerConfigured = false;

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

async function loadNotificationsModule() {
  if (Platform.OS === "web") {
    return null;
  }

  return import("expo-notifications");
}

function configureNotificationPresentation(
  Notifications: NotificationsModule,
) {
  if (notificationHandlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  notificationHandlerConfigured = true;
}

async function ensureAndroidNotificationChannel(
  Notifications: NotificationsModule,
) {
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
  const Notifications = await loadNotificationsModule();

  if (!Notifications) {
    return {
      ok: false,
      reason: "Push notifications are not enabled on web.",
    };
  }

  if (!Device.isDevice) {
    return {
      ok: false,
      reason: "Push notifications require a physical device.",
    };
  }

  configureNotificationPresentation(Notifications);
  await ensureAndroidNotificationChannel(Notifications);

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
  alertLocation?: AppLocation | null,
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
        alertLocation: alertLocation
          ? {
              id: alertLocation.id,
              name: alertLocation.name,
              latitude: alertLocation.latitude,
              longitude: alertLocation.longitude,
            }
          : null,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Push token registration failed: ${response.status}`);
  }

  return response.json() as Promise<{ ok: true }>;
}

export async function initializeOfficialAlertPushNotifications(
  alertLocation?: AppLocation | null,
) {
  const registration = await registerForOfficialAlertPushNotifications();

  if (!registration.ok) {
    console.log("[PushNotifications] Registration skipped", {
      reason: registration.reason,
    });
    return registration;
  }

  await registerOfficialAlertPushTokenWithBackend(
    registration.expoPushToken,
    alertLocation,
  );

  console.log("[PushNotifications] Registered official alert push token");

  return registration;
}
