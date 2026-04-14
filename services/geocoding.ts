export type GeocodingResult = {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
};

type MapboxContextItem = {
  id?: string;
  text?: string;
  short_code?: string;
};

type MapboxFeature = {
  id?: string;
  place_name?: string;
  text?: string;
  center?: [number, number];
  context?: MapboxContextItem[];
};

type MapboxGeocodingResponse = {
  features?: MapboxFeature[];
};

function getContextValue(feature: MapboxFeature, prefix: string) {
  return feature.context?.find((item) => item.id?.startsWith(prefix));
}

function getStateFromFeature(feature: MapboxFeature) {
  const region = getContextValue(feature, 'region');

  if (!region) {
    return '';
  }

  if (region.short_code) {
    const shortCodeParts = region.short_code.split('-');
    return shortCodeParts[1]?.toUpperCase() ?? region.text ?? '';
  }

  return region.text ?? '';
}

function getCountryFromFeature(feature: MapboxFeature) {
  const country = getContextValue(feature, 'country');
  return country?.text ?? '';
}

function getCityFromFeature(feature: MapboxFeature) {
  const place = getContextValue(feature, 'place');
  const locality = getContextValue(feature, 'locality');
  const district = getContextValue(feature, 'district');

  return place?.text ?? locality?.text ?? district?.text ?? feature.text ?? 'Unknown';
}

export async function searchLocations(query: string) {
  const trimmedQuery = query.trim();
  const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!trimmedQuery) {
    return [];
  }

  if (!accessToken) {
    throw new Error('Missing EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN');
  }

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmedQuery)}.json` +
    `?access_token=${encodeURIComponent(accessToken)}` +
    `&autocomplete=true` +
    `&limit=8` +
    `&types=place,locality,neighborhood,address,poi` +
    `&country=US`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to search locations: ${response.status}`);
  }

  const data: MapboxGeocodingResponse = await response.json();

  const results = (data.features ?? [])
    .filter((feature) => {
      return (
        typeof feature.text === 'string' &&
        Array.isArray(feature.center) &&
        feature.center.length === 2 &&
        typeof feature.center[0] === 'number' &&
        typeof feature.center[1] === 'number'
      );
    })
    .map((feature) => {
      const [longitude, latitude] = feature.center!;
      const city = getCityFromFeature(feature);
      const state = getStateFromFeature(feature);
      const country = getCountryFromFeature(feature);

      return {
        id: feature.id ?? `${feature.text}-${latitude}-${longitude}`,
        name: feature.text ?? 'Saved Location',
        city,
        state,
        country,
        latitude,
        longitude,
      } satisfies GeocodingResult;
    });

  return results;
}