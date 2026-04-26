import type { AppLocation } from "@/data/locationStore";

export type WydotOfficialStatusType =
  | "none"
  | "advisory"
  | "restriction"
  | "closure";

export type WydotOfficialImpact =
  | "none"
  | "low"
  | "moderate"
  | "high"
  | "closed"
  | "seasonal";

export type WydotOfficialRoadStatus = {
  hasOfficialStatus: boolean;
  type: WydotOfficialStatusType;
  impact: WydotOfficialImpact;
  title: string;
  description: string;
  source: "wydot";
  lastUpdated: string | null;
};

export type WydotRouteSegment = {
  routeCode: string;
  townGroup: string;
  segmentLabel: string;
  officialCondition: string;
  advisory: string;
  restriction: string;
  reportTime: string;
  cameraSiteIds: string[];
  sensorStationNames: string[];
  officialRoadStatus: WydotOfficialRoadStatus;
};

export type WydotStationObservation = {
  stationName: string;
  observedAt: string | null;
  airTempF: number | null;
  surfaceTempF: number | null;
  relativeHumidity: number | null;
  dewPointF: number | null;
  visibilityFt: number | null;
  windAvgMph: number | null;
  windGustMph: number | null;
  windDirection: string | null;
};

export type WydotRoadReport = {
  routeCode: string;
  townGroup: string;
  primarySegment: WydotRouteSegment;
  nearbySegments: WydotRouteSegment[];
  fetchedAt: string | null;
  mapLatitude: number;
  mapLongitude: number;
  primaryStationObservation: WydotStationObservation | null;
};

type WydotLocationMapping = {
  routeCode: string;
  townGroup: string;
  latitude: number;
  longitude: number;
  lookupKeys: string[];
};

type WydotHtmlCacheEntry = {
  html: string;
  fetchedAtMs: number;
};

const ROUTE_CACHE_TTL_MS = 10 * 60 * 1000;
const STATION_CACHE_TTL_MS = 10 * 60 * 1000;

const routePageCache = new Map<string, WydotHtmlCacheEntry>();

const stationPageCache = new Map<string, WydotHtmlCacheEntry>();

const COORDINATE_MATCH_MAX_DISTANCE_MILES = 45;

const WYDOT_LOCATION_MAPPINGS: WydotLocationMapping[] = [
  {
    routeCode: "I25",
    townGroup: "Cheyenne",
    latitude: 41.14,
    longitude: -104.8202,
    lookupKeys: ["cheyenne"],
  },
  {
    routeCode: "I25",
    townGroup: "Chugwater",
    latitude: 41.7565,
    longitude: -104.8219,
    lookupKeys: ["chugwater"],
  },
  {
    routeCode: "I25",
    townGroup: "Wheatland",
    latitude: 42.0544,
    longitude: -104.9527,
    lookupKeys: ["wheatland"],
  },
  {
    routeCode: "I25",
    townGroup: "Glendo",
    latitude: 42.5105,
    longitude: -104.9576,
    lookupKeys: ["glendo"],
  },
  {
    routeCode: "I25",
    townGroup: "Douglas",
    latitude: 42.7597,
    longitude: -105.3822,
    lookupKeys: ["douglas"],
  },
  {
    routeCode: "I25",
    townGroup: "Casper",
    latitude: 42.8501,
    longitude: -106.3252,
    lookupKeys: ["casper"],
  },
  {
    routeCode: "I25",
    townGroup: "Midwest",
    latitude: 43.4133,
    longitude: -106.2775,
    lookupKeys: ["midwest"],
  },
  {
    routeCode: "I25",
    townGroup: "Kaycee",
    latitude: 43.7066,
    longitude: -106.6359,
    lookupKeys: ["kaycee"],
  },
  {
    routeCode: "I80",
    townGroup: "Evanston",
    latitude: 41.2683,
    longitude: -110.9632,
    lookupKeys: ["evanston"],
  },
  {
    routeCode: "I80",
    townGroup: "Green River",
    latitude: 41.5286,
    longitude: -109.4662,
    lookupKeys: ["greenriver", "green river"],
  },
  {
    routeCode: "I80",
    townGroup: "Rock Springs",
    latitude: 41.5875,
    longitude: -109.2029,
    lookupKeys: ["rocksprings", "rock springs"],
  },
  {
    routeCode: "I80",
    townGroup: "Rawlins",
    latitude: 41.7911,
    longitude: -107.2387,
    lookupKeys: ["rawlins"],
  },
  {
    routeCode: "I80",
    townGroup: "Laramie",
    latitude: 41.3114,
    longitude: -105.5911,
    lookupKeys: ["laramie"],
  },
  {
    routeCode: "I90",
    townGroup: "Buffalo",
    latitude: 44.3483,
    longitude: -106.6989,
    lookupKeys: ["buffalo"],
  },
  {
    routeCode: "I90",
    townGroup: "Sheridan",
    latitude: 44.7972,
    longitude: -106.9562,
    lookupKeys: ["sheridan"],
  },
  {
    routeCode: "I90",
    townGroup: "Gillette",
    latitude: 44.2911,
    longitude: -105.5022,
    lookupKeys: ["gillette"],
  },
];

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x3D;/gi, "=")
    .replace(/&#39;/gi, "'")
    .replace(/&#34;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p>/gi, "\n");
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCell(value: string) {
  const cleaned = stripHtml(value);
  return cleaned === "" ? "None" : cleaned;
}

function normalizeWydotEmptyValue(value: string) {
  const normalized = value.trim();

  return normalized === "" || normalized.toLowerCase() === "none";
}

function getImpactFromClassName(className: string): WydotOfficialImpact {
  const normalized = className.toLowerCase();

  if (normalized.includes("closed")) {
    return "closed";
  }

  if (normalized.includes("extended")) {
    return "seasonal";
  }

  if (normalized.includes("high")) {
    return "high";
  }

  if (normalized.includes("mod")) {
    return "moderate";
  }

  if (normalized.includes("low")) {
    return "low";
  }

  return "none";
}

function buildWydotOfficialRoadStatus(params: {
  advisory: string;
  advisoryClassName: string | null;
  restriction: string;
  restrictionClassName: string | null;
  officialCondition: string;
  conditionClassName: string | null;
  reportTime: string;
}): WydotOfficialRoadStatus {
  const restrictionExists = !normalizeWydotEmptyValue(params.restriction);
  const advisoryExists = !normalizeWydotEmptyValue(params.advisory);
  const conditionImpact = params.conditionClassName
    ? getImpactFromClassName(params.conditionClassName)
    : "none";
  const isClosure =
    conditionImpact === "closed" ||
    params.officialCondition.toLowerCase().includes("closed");

  if (isClosure) {
    return {
      hasOfficialStatus: true,
      type: "closure",
      impact: "closed",
      title: "WYDOT closure",
      description: params.officialCondition,
      source: "wydot",
      lastUpdated: params.reportTime,
    };
  }

  if (restrictionExists) {
    return {
      hasOfficialStatus: true,
      type: "restriction",
      impact: params.restrictionClassName
        ? getImpactFromClassName(params.restrictionClassName)
        : "moderate",
      title: "WYDOT restriction",
      description: params.restriction,
      source: "wydot",
      lastUpdated: params.reportTime,
    };
  }

  if (advisoryExists) {
    return {
      hasOfficialStatus: true,
      type: "advisory",
      impact: params.advisoryClassName
        ? getImpactFromClassName(params.advisoryClassName)
        : "moderate",
      title: "WYDOT advisory",
      description: params.advisory,
      source: "wydot",
      lastUpdated: params.reportTime,
    };
  }

  return {
    hasOfficialStatus: false,
    type: "none",
    impact: "none",
    title: "",
    description: "",
    source: "wydot",
    lastUpdated: params.reportTime,
  };
}

function extractRouteCode(html: string) {
  const match = html.match(/Travel information for\s*<u>([^<]+)<\/u>/i);

  if (!match) {
    return "UNKNOWN";
  }

  const routeName = stripHtml(match[1]);

  if (routeName.toLowerCase().includes("interstate 25")) {
    return "I25";
  }

  if (routeName.toLowerCase().includes("interstate 80")) {
    return "I80";
  }

  if (routeName.toLowerCase().includes("interstate 90")) {
    return "I90";
  }

  return routeName.toUpperCase().replace(/\s+/g, "");
}

function extractConditionsTableBody(html: string) {
  const match = html.match(
    /<th class="title" colspan="8">\s*Conditions\s*<\/th>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>\s*<\/table>/i,
  );

  if (!match) {
    throw new Error("Could not find WYDOT conditions table.");
  }

  return match[1];
}

function extractRows(tableBodyHtml: string) {
  return [...tableBodyHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map(
    (match) => match[1],
  );
}

function extractTownGroup(rowHtml: string) {
  const match = rowHtml.match(/<td class="town"[\s\S]*?>([\s\S]*?)<\/td>/i);

  if (!match) {
    return null;
  }

  const townHtml = match[1].replace(/<br[\s\S]*$/i, "").trim();
  return stripHtml(townHtml);
}

function extractCellByClass(rowHtml: string, className: string) {
  const regex = new RegExp(
    `<td class="${className}"[^>]*>([\\s\\S]*?)<\\/td>`,
    "i",
  );

  const match = rowHtml.match(regex);
  return match ? match[1] : null;
}

function extractConditionCell(rowHtml: string) {
  const match = rowHtml.match(
    /<td class="([a-z]+impactcond|closedcond|extendedcond)"[^>]*>([\s\S]*?)<\/td>/i,
  );

  return match ? { className: match[1], html: match[2] } : null;
}

function extractAdvisoryCell(rowHtml: string) {
  const match = rowHtml.match(
    /<td class="(noimpact|lowimpact|modimpact|highimpact|extendedimpact)"[^>]*>([\s\S]*?)<\/td>/i,
  );

  return match ? { className: match[1], html: match[2] } : null;
}

function extractRestrictionCell(rowHtml: string) {
  const match = rowHtml.match(
    /<td class="(noimpactrestrict|lowimpactrestrict|modimpactrestrict|highimpactrestrict|closedrestrict)"[^>]*>([\s\S]*?)<\/td>/i,
  );

  return match ? { className: match[1], html: match[2] } : null;
}

function extractCameraSiteIds(rowHtml: string) {
  return [...rowHtml.matchAll(/\/highway\/webcameras\/view\?site=([^&'"]+)/gi)]
    .map((match) => decodeHtmlEntities(match[1]).trim())
    .filter(Boolean);
}

function extractSensorStationNames(rowHtml: string) {
  return [...rowHtml.matchAll(/SelectedStation=([^'"]+)/gi)]
    .map((match) => decodeHtmlEntities(match[1]).replace(/\+/g, " ").trim())
    .filter(Boolean);
}

export function parseWydotRouteSegments(html: string): WydotRouteSegment[] {
  const routeCode = extractRouteCode(html);
  const conditionsBodyHtml = extractConditionsTableBody(html);
  const rows = extractRows(conditionsBodyHtml);

  const segments: WydotRouteSegment[] = [];
  let currentTownGroup = "Unknown";

  for (const rowHtml of rows) {
    const maybeTownGroup = extractTownGroup(rowHtml);

    if (maybeTownGroup) {
      currentTownGroup = maybeTownGroup;
    }

    const segmentLabelHtml = extractCellByClass(rowHtml, "closurelocation");
    const conditionHtml = extractConditionCell(rowHtml);
    const advisoryHtml = extractAdvisoryCell(rowHtml);
    const restrictionHtml = extractRestrictionCell(rowHtml);
    const reportTimeHtml = extractCellByClass(rowHtml, "rpttime");

    if (
      !segmentLabelHtml ||
      !conditionHtml ||
      !advisoryHtml ||
      !restrictionHtml ||
      !reportTimeHtml
    ) {
      continue;
    }

    const officialCondition = cleanCell(conditionHtml.html);
    const advisory = cleanCell(advisoryHtml.html);
    const restriction = cleanCell(restrictionHtml.html);
    const reportTime = cleanCell(reportTimeHtml);

    segments.push({
      routeCode,
      townGroup: currentTownGroup,
      segmentLabel: cleanCell(segmentLabelHtml),
      officialCondition,
      advisory,
      restriction,
      reportTime,
      cameraSiteIds: extractCameraSiteIds(rowHtml),
      sensorStationNames: extractSensorStationNames(rowHtml),
      officialRoadStatus: buildWydotOfficialRoadStatus({
        advisory,
        advisoryClassName: advisoryHtml.className,
        restriction,
        restrictionClassName: restrictionHtml.className,
        officialCondition,
        conditionClassName: conditionHtml.className,
        reportTime,
      }),
    });
  }

  return segments;
}

function parseNumberFromText(value: string) {
  const cleaned = stripHtml(value);
  const match = cleaned.match(/-?\d+(\.\d+)?/);

  if (!match) {
    return null;
  }

  return Number(match[0]);
}

// WYDOT station pages are inconsistent HTML, so pull the observation timestamp
// from normalized page text instead of depending on fragile tag structure.
function extractObservedAtFromStationHtml(html: string) {
  const text = stripHtml(html)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const match = text.match(
    /([A-Z][a-z]{2}\.?\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s*[AP]M)/,
  );

  return match ? match[1] : null;
}

// WYDOT often includes stale values inside HTML comments right before the live cell.
// Strip comments first so the parser reads the current displayed value only.
function extractFieldValueFromStationHtml(html: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const htmlWithoutComments = html.replace(/<!--[\s\S]*?-->/g, "");

  const rowMatch = htmlWithoutComments.match(
    new RegExp(
      `<tr[^>]*>[\\s\\S]*?<td[^>]*>[\\s\\S]*?${escapedLabel}[\\s\\S]*?<\\/td>[\\s\\S]*?<td[^>]*>([\\s\\S]*?)<\\/td>[\\s\\S]*?<\\/tr>`,
      "i",
    ),
  );

  if (!rowMatch) {
    return null;
  }

  return stripHtml(rowMatch[1])
    .replace(/&#176;/g, "°")
    .replace(/&deg;/gi, "°")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNullableText(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (
    normalized === "" ||
    normalized.toUpperCase() === "N/A" ||
    normalized.toUpperCase() === "NA"
  ) {
    return null;
  }

  return normalized;
}

// Accept a few label variants because WYDOT station pages do not use one perfectly
// consistent naming pattern across all sensors and locations.
export function parseWydotStationObservation(
  html: string,
  stationName: string,
): WydotStationObservation {
  const observedAt = extractObservedAtFromStationHtml(html);

  const airTempText =
    extractFieldValueFromStationHtml(html, "Air temperature") ??
    extractFieldValueFromStationHtml(html, "Air Temperature") ??
    extractFieldValueFromStationHtml(html, "Air Temp");

  const surfaceTempText =
    extractFieldValueFromStationHtml(html, "Surface temperature") ??
    extractFieldValueFromStationHtml(html, "Surface Temperature") ??
    extractFieldValueFromStationHtml(html, "Surface Temp");

  const humidityText =
    extractFieldValueFromStationHtml(html, "Relative humidity") ??
    extractFieldValueFromStationHtml(html, "Relative Humidity") ??
    extractFieldValueFromStationHtml(html, "Humidity");

  const dewPointText =
    extractFieldValueFromStationHtml(html, "Dew point") ??
    extractFieldValueFromStationHtml(html, "Dew Point") ??
    extractFieldValueFromStationHtml(html, "Dewpoint");

  const visibilityText = extractFieldValueFromStationHtml(html, "Visibility");

  const windAvgText =
    extractFieldValueFromStationHtml(html, "Wind average") ??
    extractFieldValueFromStationHtml(html, "Wind Average") ??
    extractFieldValueFromStationHtml(html, "Wind Avg");

  const windGustText =
    extractFieldValueFromStationHtml(html, "Wind gust") ??
    extractFieldValueFromStationHtml(html, "Wind Gust") ??
    extractFieldValueFromStationHtml(html, "Wind Gusts");

  const windDirectionText =
    normalizeNullableText(
      extractFieldValueFromStationHtml(html, "Wind direction"),
    ) ??
    normalizeNullableText(
      extractFieldValueFromStationHtml(html, "Wind Direction"),
    ) ??
    normalizeNullableText(extractFieldValueFromStationHtml(html, "Wind Dir"));

  return {
    stationName,
    observedAt,
    airTempF: normalizeNullableText(airTempText)
      ? parseNumberFromText(airTempText!)
      : null,
    surfaceTempF: normalizeNullableText(surfaceTempText)
      ? parseNumberFromText(surfaceTempText!)
      : null,
    relativeHumidity: normalizeNullableText(humidityText)
      ? parseNumberFromText(humidityText!)
      : null,
    dewPointF: normalizeNullableText(dewPointText)
      ? parseNumberFromText(dewPointText!)
      : null,
    visibilityFt: normalizeNullableText(visibilityText)
      ? parseNumberFromText(visibilityText!)
      : null,
    windAvgMph: normalizeNullableText(windAvgText)
      ? parseNumberFromText(windAvgText!)
      : null,
    windGustMph: normalizeNullableText(windGustText)
      ? parseNumberFromText(windGustText!)
      : null,
    windDirection: windDirectionText,
  };
}

function normalizeLocationLookupKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMiles(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthRadiusMiles = 3958.8;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const startLatitude = toRadians(latitudeA);
  const endLatitude = toRadians(latitudeB);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}

function findExactWydotLocationMapping(location: AppLocation) {
  const candidates = [
    normalizeLocationLookupKey(location.city),
    normalizeLocationLookupKey(location.name),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const mapping = WYDOT_LOCATION_MAPPINGS.find((item) =>
      item.lookupKeys.some(
        (lookupKey) => normalizeLocationLookupKey(lookupKey) === candidate,
      ),
    );

    if (mapping) {
      return mapping;
    }
  }

  return null;
}

function findNearestWydotLocationMapping(location: AppLocation) {
  if (
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    return null;
  }

  let bestMatch: WydotLocationMapping | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const mapping of WYDOT_LOCATION_MAPPINGS) {
    const distance = getDistanceMiles(
      location.latitude,
      location.longitude,
      mapping.latitude,
      mapping.longitude,
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = mapping;
    }
  }

  if (!bestMatch || bestDistance > COORDINATE_MATCH_MAX_DISTANCE_MILES) {
    return null;
  }

  return bestMatch;
}

function getWydotLocationMapping(
  location: AppLocation,
): WydotLocationMapping | null {
  return (
    findExactWydotLocationMapping(location) ??
    findNearestWydotLocationMapping(location)
  );
}

async function fetchWydotHtml(url: string) {
  if (process.env.EXPO_OS === "web") {
    // WYDOT serves HTML without CORS headers, so a browser build cannot read the
    // response body directly from wyoroad.info. Web support requires a same-origin
    // backend or proxy that fetches the HTML server-side and relays structured data.
    throw new Error(
      "WYDOT web fetch is blocked because wyoroad.info does not allow browser cross-origin reads.",
    );
  }

  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "roadsignal-app",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch WYDOT HTML: ${response.status}`);
  }

  return response.text();
}

async function fetchHtmlWithCache(
  cacheKey: string,
  cache: Map<string, WydotHtmlCacheEntry>,
  ttlMs: number,
  url: string,
) {
  const existing = cache.get(cacheKey);

  if (existing && Date.now() - existing.fetchedAtMs < ttlMs) {
    return existing.html;
  }

  const html = await fetchWydotHtml(url);

  cache.set(cacheKey, {
    html,
    fetchedAtMs: Date.now(),
  });

  return html;
}

async function fetchRoutePageHtml(routeCode: string) {
  const url = `https://www.wyoroad.info/pls/Browse/WRR.RoutesResults?SelectedRoute=${encodeURIComponent(routeCode)}`;

  return fetchHtmlWithCache(
    `route:${routeCode}`,
    routePageCache,
    ROUTE_CACHE_TTL_MS,
    url,
  );
}

async function fetchStationPageHtml(stationName: string) {
  const url = `https://www.wyoroad.info/pls/Browse/Sensors.StationResults?SelectedStation=${encodeURIComponent(stationName)}`;

  return fetchHtmlWithCache(
    `station:${stationName}`,
    stationPageCache,
    STATION_CACHE_TTL_MS,
    url,
  );
}

export async function getWydotRoadReport(
  location: AppLocation,
): Promise<WydotRoadReport | null> {
  const mapping = getWydotLocationMapping(location);

  if (!mapping) {
    return null;
  }

  const routeHtml = await fetchRoutePageHtml(mapping.routeCode);
  const segments = parseWydotRouteSegments(routeHtml);

  const townSegments = segments.filter(
    (segment) =>
      segment.routeCode === mapping.routeCode &&
      segment.townGroup.toLowerCase() === mapping.townGroup.toLowerCase(),
  );

  if (townSegments.length === 0) {
    return null;
  }

  const primarySegment = townSegments[0];
  const nearbySegments = townSegments.slice(1);

  let primaryStationObservation: WydotStationObservation | null = null;
  const primaryStationName = primarySegment.sensorStationNames[0];

  if (primaryStationName) {
    try {
      const stationHtml = await fetchStationPageHtml(primaryStationName);

      primaryStationObservation = parseWydotStationObservation(
        stationHtml,
        primaryStationName,
      );
    } catch (error) {
      console.warn("Failed to fetch WYDOT station detail:", error);
      primaryStationObservation = null;
    }
  }
  return {
    routeCode: mapping.routeCode,
    townGroup: mapping.townGroup,
    primarySegment,
    nearbySegments,
    fetchedAt: primarySegment.reportTime,
    mapLatitude: mapping.latitude,
    mapLongitude: mapping.longitude,
    primaryStationObservation,
  };
}
