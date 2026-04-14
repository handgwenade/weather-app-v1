export async function getActiveAlertsForLocation(latitude: number, longitude: number) {
  const point = `${latitude},${longitude}`;
  const url = `https://api.weather.gov/alerts/active?point=${encodeURIComponent(point)}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/geo+json',
      'User-Agent': 'weather-app-learning-project',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch NWS alerts: ${response.status}`);
  }

  const data = await response.json();
  return data;
}