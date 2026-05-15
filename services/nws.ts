export type NwsAlertProperties = {
  event?: string;
  areaDesc?: string;
  severity?: string;
  certainty?: string;
  effective?: string;
  onset?: string;
  ends?: string;
  expires?: string;
  headline?: string;
  description?: string;
  senderName?: string;
};

export type NwsAlertFeature = {
  id?: string;
  properties?: NwsAlertProperties;
};

export type NwsActiveAlertsResponse = {
  features?: NwsAlertFeature[];
};

const NWS_ALERTS_TIMEOUT_MS = 2500;

function buildActiveAlertsUrl(latitude: number, longitude: number) {
  const point = `${latitude},${longitude}`;
  return `https://api.weather.gov/alerts/active?point=${encodeURIComponent(point)}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchNwsJson<T>(url: string, errorLabel: string): Promise<T> {
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: "application/geo+json",
        ...(process.env.EXPO_OS === "web"
          ? null
          : { "User-Agent": "roadsignal-app" }),
      },
    },
    NWS_ALERTS_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`${errorLabel}: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getActiveAlertsForLocation(
  latitude: number,
  longitude: number,
): Promise<NwsActiveAlertsResponse> {
  const url = buildActiveAlertsUrl(latitude, longitude);
  return fetchNwsJson<NwsActiveAlertsResponse>(
    url,
    "Failed to fetch NWS alerts",
  );
}
