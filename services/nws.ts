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

function buildActiveAlertsUrl(latitude: number, longitude: number) {
  const point = `${latitude},${longitude}`;
  return `https://api.weather.gov/alerts/active?point=${encodeURIComponent(point)}`;
}

async function fetchNwsJson<T>(url: string, errorLabel: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/geo+json",
      "User-Agent": "weather-app-learning-project",
    },
  });

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
