import Database from "better-sqlite3";
import express from "express";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(__dirname, "..", "weatherapp.db");
const roadGeometryPath = path.resolve(
  __dirname,
  "..",
  "..",
  "data",
  "road-geometry.cleaned.geojson",
);
const app = express();
app.use(express.json());
const db = new Database(dbPath);
const TOMORROW_API_KEY = process.env.TOMORROW_API_KEY;
const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
const TOMORROW_WEATHER_BASE_URL = "https://api.tomorrow.io/v4/weather";
const TOMORROW_TIMELINES_URL = "https://api.tomorrow.io/v4/timelines";
const COMBINED_CURRENT_AND_HOURLY_FIELDS = [
  "temperature",
  "weatherCode",
  "windSpeed",
  "windDirection",
  "windGust",
  "precipitationProbability",
  "humidity",
  "visibility",
  "temperatureApparent",
] as const;

const WYDOT_MEDIA_STATEWIDE_URL =
  "https://www.wyoroad.info/pls/Browse/MEDIA.Statewide";
const WYDOT_MEDIA_CACHE_MS = 5 * 60 * 1000;
const WYDOT_CONDITION_HEADINGS = new Set([
  "Closed to Light, High Profile Vehicles",
  "Chain Law - Level 1",
  "No Unnecessary Travel",
  "No Trailer Traffic",
  "Black Ice",
  "Slick",
  "Slick in Spots",
  "Reduced Visibility",
  "Falling Rock",
  "Drifted Snow",
  "Strong Winds",
  "Fog",
  "Blowing Snow",
]);
const WYDOT_RESTRICTION_HEADINGS = new Set([
  "Closed to Light, High Profile Vehicles",
  "Chain Law - Level 1",
  "No Unnecessary Travel",
  "No Trailer Traffic",
]);
const WYDOT_REGION_NAMES = new Set([
  "Central",
  "Northeast",
  "Northwest",
  "Southeast",
  "Southwest",
]);

console.log("[Server] Opening SQLite database", {
  dbPath,
});

const ENABLE_DEBUG_LOGS = process.env.NODE_ENV !== "production";

function debugLog(message: string, payload?: unknown) {
  if (!ENABLE_DEBUG_LOGS) {
    return;
  }

  if (payload === undefined) {
    console.log(message);
    return;
  }

  console.log(message, payload);
}
const STATION_SELECT = `
  SELECT
    station_id AS stationId,
    station_name AS stationName,
    latitude AS latitude,
    longitude AS longitude,
    observed_at AS observedAt,
    air_temp_f AS airTempF,
    wind_speed_mph AS windSpeedMph,
    wind_gust_mph AS windGustMph,
    visibility_mi AS visibilityMi,
    road_surface_temp_f AS roadSurfaceTempF,
    road_state_code AS roadStateCode,
    road_state_label AS roadStateLabel,
    source_provider AS sourceProvider
  FROM station_observations_latest
`;

type SegmentPrimaryStation = {
  stationId: string;
  stationName: string | null;
  latitude: number | null;
  longitude: number | null;
  observedAt: string | null;
  airTempF: number | null;
  windSpeedMph: number | null;
  windGustMph: number | null;
  visibilityMi: number | null;
  roadSurfaceTempF: number | null;
  roadStateCode: number | null;
  roadStateLabel: string | null;
  sourceProvider: string | null;
};

type WydotMediaConditionRecord = {
  category: string;
  region: string | null;
  routeName: string;
  direction: string | null;
  fromLabel: string;
  toLabel: string;
  rawText: string;
};

type OfficialSegmentCondition = {
  officialConditionLabel: string | null;
  officialConditionDescription: string | null;
  officialRestriction: string | null;
};

let wydotMediaCache: {
  fetchedAt: number;
  records: WydotMediaConditionRecord[];
} | null = null;

type RegisteredPushToken = {
  expoPushToken: string;
  platform: string | null;
  notificationTypes: string[];
  registeredAt: string;
  updatedAt: string;
};

const registeredPushTokens = new Map<string, RegisteredPushToken>();

function computeImpact(primaryStation: SegmentPrimaryStation | null) {
  if (!primaryStation) {
    return {
      level: "unknown",
      reason: "Primary station data unavailable",
    };
  }

  const {
    windSpeedMph,
    windGustMph,
    visibilityMi,
    roadStateCode,
    roadStateLabel,
    roadSurfaceTempF,
  } = primaryStation;

  const nonDryRoad = roadStateCode !== null && roadStateCode !== 1;
  const lowVisibility = visibilityMi !== null && visibilityMi < 2;
  const strongSustainedWind = windSpeedMph !== null && windSpeedMph >= 25;
  const highWindGust = windGustMph !== null && windGustMph >= 40;
  const nearFreezingSurface =
    roadSurfaceTempF !== null && roadSurfaceTempF <= 34;

  if (
    highWindGust ||
    (nonDryRoad && nearFreezingSurface) ||
    (lowVisibility && strongSustainedWind)
  ) {
    if (highWindGust) {
      return {
        level: "high",
        reason: `High wind gusts at ${Math.round(windGustMph!)} mph`,
      };
    }

    if (nonDryRoad && nearFreezingSurface) {
      return {
        level: "high",
        reason: `Road surface near freezing with ${roadStateLabel ?? "non-dry"} conditions`,
      };
    }

    return {
      level: "high",
      reason: "Reduced visibility combined with strong wind",
    };
  }

  if (
    strongSustainedWind ||
    lowVisibility ||
    nonDryRoad ||
    (windGustMph !== null && windGustMph >= 30)
  ) {
    if (strongSustainedWind) {
      return {
        level: "moderate",
        reason: `Sustained wind near ${Math.round(windSpeedMph!)} mph`,
      };
    }

    if (windGustMph !== null && windGustMph >= 30) {
      return {
        level: "moderate",
        reason: `Wind gusts at ${Math.round(windGustMph)} mph`,
      };
    }

    if (lowVisibility) {
      return {
        level: "moderate",
        reason: `Visibility reduced to ${visibilityMi!.toFixed(1)} miles`,
      };
    }

    return {
      level: "moderate",
      reason: roadStateLabel ?? "Non-dry road state reported",
    };
  }

  return {
    level: "low",
    reason: "No major impact detected from the primary station",
  };
}

function buildObservedFactors(primaryStation: SegmentPrimaryStation | null) {
  if (!primaryStation) {
    return {
      observedAt: null,
      stationId: null,
      stationName: null,
      sourceProvider: null,
      airTempF: null,
      windSpeedMph: null,
      windGustMph: null,
      visibilityMi: null,
      roadSurfaceTempF: null,
      roadStateCode: null,
      roadStateLabel: null,
    };
  }

  return {
    observedAt: primaryStation.observedAt,
    stationId: primaryStation.stationId,
    stationName: primaryStation.stationName,
    sourceProvider: primaryStation.sourceProvider,
    airTempF: primaryStation.airTempF,
    windSpeedMph: primaryStation.windSpeedMph,
    windGustMph: primaryStation.windGustMph,
    visibilityMi: primaryStation.visibilityMi,
    roadSurfaceTempF: primaryStation.roadSurfaceTempF,
    roadStateCode: primaryStation.roadStateCode,
    roadStateLabel: primaryStation.roadStateLabel,
  };
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeRouteName(value: string) {
  return normalizeWhitespace(value)
    .toUpperCase()
    .replace(/INTERSTATE\s+/g, "I ")
    .replace(/U\.S\.\s*/g, "US ")
    .replace(/WYOMING\s+/g, "WY ")
    .replace(/-/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ");
}

function routeNamesMatch(segmentRouteName: string, officialRouteName: string) {
  const segmentRoute = normalizeRouteName(segmentRouteName);
  const officialRoute = normalizeRouteName(officialRouteName);
  const officialParts = officialRoute.split(" / ").map((part) => part.trim());

  return segmentRoute === officialRoute || officialParts.includes(segmentRoute);
}

function normalizeComparableText(value: string | null | undefined) {
  return normalizeWhitespace(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function labelsOverlap(segmentLabel: string, officialLabel: string) {
  const segment = normalizeComparableText(segmentLabel);
  const official = normalizeComparableText(officialLabel);

  if (!segment || !official) {
    return false;
  }

  return official.includes(segment) || segment.includes(official);
}

function stripHtmlToLines(html: string) {
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeBasicHtmlEntities(bodyText)
    .split("\n")
    .map(normalizeWhitespace)
    .filter(Boolean);
}

function isWydotMediaBoilerplateLine(line: string) {
  const normalized = normalizeComparableText(line);

  return (
    normalized.includes("MOTORISTS TRAVELING ON A CLOSED ROAD") ||
    normalized.includes("WITHOUT PERMISSION FROM WYDOT OR WHP") ||
    normalized.includes("MAY BE SUBJECT TO A FINE") ||
    normalized.includes("WYOMING STATUTE") ||
    normalized.includes("24 1 109") ||
    normalized.includes("CLOSED ROAD WITHOUT PERMISSION")
  );
}

function parseWydotMediaConditions(html: string) {
  const lines = stripHtmlToLines(html);
  const records: WydotMediaConditionRecord[] = [];
  let currentCategory: string | null = null;
  let currentRegion: string | null = null;
  let currentRouteName: string | null = null;

  for (const line of lines) {
    if (WYDOT_CONDITION_HEADINGS.has(line)) {
      currentCategory = line;
      currentRegion = null;
      currentRouteName = null;
      continue;
    }

    if (!currentCategory || line === "Region Route Direction From To") {
      continue;
    }

    if (isWydotMediaBoilerplateLine(line)) {
      continue;
    }

    // Skip lines that match 24-1-109 or 24 1 109 (with optional dashes/spaces)
    if (/\b24\s*-?\s*1\s*-?\s*109\b/i.test(line)) {
      continue;
    }

    const tokens = line.split(" ").filter(Boolean);
    const firstToken = tokens[0];
    const startsWithRegion = WYDOT_REGION_NAMES.has(firstToken);
    const region: string | null = startsWithRegion ? firstToken : currentRegion;
    const content = startsWithRegion
      ? normalizeWhitespace(line.slice(firstToken.length))
      : line;

    if (!region || !content) {
      continue;
    }

    const routeMatch = content.match(
      /^((?:I|US|WY)\s+\d+[A-Z]?(?:\s*\/\s*(?:(?:I|US|WY)\s+)?\d+[A-Z]?)*|Casper Service Road|I\s+90\s+Business)\s+(.+)$/i,
    );

    let routeName: string | null = currentRouteName;
    let fromToText = content;

    if (routeMatch) {
      routeName = normalizeWhitespace(routeMatch[1]);
      fromToText = normalizeWhitespace(routeMatch[2]);
    }

    if (!routeName) {
      continue;
    }

    currentRegion = region;
    currentRouteName = routeName;

    const directionalMatch = fromToText.match(
      /^(Eastbound|Westbound|Northbound|Southbound)\s+(.+)$/i,
    );
    const direction = directionalMatch ? directionalMatch[1] : null;
    const routeText = directionalMatch
      ? normalizeWhitespace(directionalMatch[2])
      : fromToText;
    const labelParts = routeText.split(/\s{2,}|\s+to\s+/i).filter(Boolean);
    let fromLabel = "";
    let toLabel = "";

    if (labelParts.length >= 2) {
      fromLabel = normalizeWhitespace(labelParts[0]);
      toLabel = normalizeWhitespace(labelParts.slice(1).join(" "));
    } else {
      const parts = routeText.split(" ");
      const midpoint = Math.ceil(parts.length / 2);
      fromLabel = normalizeWhitespace(parts.slice(0, midpoint).join(" "));
      toLabel = normalizeWhitespace(parts.slice(midpoint).join(" "));
    }

    if (!fromLabel || !toLabel) {
      continue;
    }

    records.push({
      category: currentCategory,
      region,
      routeName,
      direction,
      fromLabel,
      toLabel,
      rawText: line,
    });
  }

  return records;
}

async function getWydotMediaConditions() {
  const now = Date.now();

  if (
    wydotMediaCache &&
    now - wydotMediaCache.fetchedAt < WYDOT_MEDIA_CACHE_MS
  ) {
    return wydotMediaCache.records;
  }

  try {
    const response = await fetch(WYDOT_MEDIA_STATEWIDE_URL, {
      headers: {
        Accept: "text/html",
        "User-Agent": "RoadSignal/1.1 (+https://roadsignal.app)",
      },
    });

    if (!response.ok) {
      throw new Error(`WYDOT media request failed: ${response.status}`);
    }

    const html = await response.text();
    const records = parseWydotMediaConditions(html);
    wydotMediaCache = {
      fetchedAt: now,
      records,
    };

    debugLog("[WYDOTMedia] Parsed official condition records", {
      recordCount: records.length,
      sample: records.slice(0, 5),
    });

    return records;
  } catch (error) {
    console.log("[WYDOTMedia] Failed to fetch official conditions", {
      error: error instanceof Error ? error.message : String(error),
    });

    return wydotMediaCache?.records ?? [];
  }
}

function findOfficialConditionForSegment(
  row: {
    routeName: string;
    fromLabel: string;
    toLabel: string;
  },
  officialRecords: WydotMediaConditionRecord[],
): OfficialSegmentCondition {
  const matchedRecords = officialRecords.filter((record) => {
    if (
      isWydotMediaBoilerplateLine(record.rawText) ||
      /\b24\s*-?\s*1\s*-?\s*109\b/i.test(record.rawText)
    ) {
      return false;
    }
    if (!routeNamesMatch(row.routeName, record.routeName)) {
      return false;
    }

    return (
      labelsOverlap(row.fromLabel, record.fromLabel) ||
      labelsOverlap(row.fromLabel, record.toLabel) ||
      labelsOverlap(row.toLabel, record.fromLabel) ||
      labelsOverlap(row.toLabel, record.toLabel)
    );
  });

  const restriction = matchedRecords.find(
    (record) =>
      WYDOT_RESTRICTION_HEADINGS.has(record.category) &&
      !isWydotMediaBoilerplateLine(record.rawText),
  );
  const condition = matchedRecords.find(
    (record) =>
      !WYDOT_RESTRICTION_HEADINGS.has(record.category) &&
      !isWydotMediaBoilerplateLine(record.rawText),
  );

  return {
    officialConditionLabel: condition?.category ?? null,
    officialConditionDescription: condition
      ? `${condition.category}: ${condition.rawText}`
      : null,
    officialRestriction: restriction
      ? `${restriction.category}: ${restriction.rawText}`
      : null,
  };
}

function getRequiredLatLon(req: express.Request, res: express.Response) {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res
      .status(400)
      .json({ error: "lat and lon query parameters are required" });
    return null;
  }

  return { lat, lon };
}

function assertTomorrowApiKey(res: express.Response) {
  if (!TOMORROW_API_KEY) {
    res.status(500).json({ error: "TOMORROW_API_KEY is not configured" });
    return null;
  }

  return TOMORROW_API_KEY;
}

function assertMapboxAccessToken(res: express.Response) {
  if (!MAPBOX_ACCESS_TOKEN) {
    res.status(500).json({ error: "MAPBOX_ACCESS_TOKEN is not configured" });
    return null;
  }

  return MAPBOX_ACCESS_TOKEN;
}

async function fetchTomorrowJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Tomorrow.io request failed: ${response.status} ${responseText}`,
    );
  }

  return (await response.json()) as T;
}

function buildTomorrowWeatherUrl(
  lat: number,
  lon: number,
  apiKey: string,
  timesteps?: "1h" | "1d",
) {
  const location = `${lat},${lon}`;
  const params = new URLSearchParams({ location, apikey: apiKey });

  if (timesteps) {
    params.set("timesteps", timesteps);
    return `${TOMORROW_WEATHER_BASE_URL}/forecast?${params.toString()}`;
  }

  return `${TOMORROW_WEATHER_BASE_URL}/realtime?${params.toString()}`;
}

type TomorrowCombinedForecastResponse = {
  data?: {
    timelines?: {
      timestep?: "current" | "1h";
      intervals?: {
        startTime?: string;
        values?: Record<string, number | string | null>;
      }[];
    }[];
  };
};

type TomorrowHourlyTimelinesResponse = {
  data?: {
    timelines?: {
      timestep?: "1h";
      intervals?: {
        startTime?: string;
        values?: Record<string, number | string | null>;
      }[];
    }[];
  };
};

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "roadsignal-backend",
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/notifications/register", (req, res) => {
  const expoPushToken =
    typeof req.body?.expoPushToken === "string"
      ? req.body.expoPushToken.trim()
      : "";
  const platform =
    typeof req.body?.platform === "string" ? req.body.platform : null;
  const notificationTypes = Array.isArray(req.body?.notificationTypes)
    ? req.body.notificationTypes.filter(
        (value: unknown): value is string => typeof value === "string",
      )
    : ["official-alerts"];

  if (!expoPushToken) {
    res.status(400).json({ error: "expoPushToken is required" });
    return;
  }

  const existingToken = registeredPushTokens.get(expoPushToken);
  const now = new Date().toISOString();

  registeredPushTokens.set(expoPushToken, {
    expoPushToken,
    platform,
    notificationTypes,
    registeredAt: existingToken?.registeredAt ?? now,
    updatedAt: now,
  });

  console.log("[NotificationsAPI] Registered push token", {
    platform,
    notificationTypes,
    tokenCount: registeredPushTokens.size,
  });

  res.json({ ok: true });
});

app.get("/api/notifications/registrations", (_req, res) => {
  res.json({
    count: registeredPushTokens.size,
    registrations: Array.from(registeredPushTokens.values()).map(
      (registration) => ({
        platform: registration.platform,
        notificationTypes: registration.notificationTypes,
        registeredAt: registration.registeredAt,
        updatedAt: registration.updatedAt,
      }),
    ),
  });
});

// Test push notification route
app.post("/api/notifications/test", async (_req, res) => {
  const tokens = Array.from(registeredPushTokens.values());

  if (tokens.length === 0) {
    res.status(400).json({ error: "No registered push tokens" });
    return;
  }

  const messages = tokens.map((registration) => ({
    to: registration.expoPushToken,
    sound: "default",
    title: "RoadSignal test alert",
    body: "Official alert push plumbing is connected.",
    data: {
      type: "official-alert-test",
      sentAt: new Date().toISOString(),
    },
    channelId: "official-alerts",
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const payload = await response.json();

    if (!response.ok) {
      console.log("[NotificationsAPI] Test push failed", {
        status: response.status,
        payload,
      });

      res.status(502).json({
        error: "Failed to send test push notification",
        expoStatus: response.status,
        expoResponse: payload,
      });
      return;
    }

    console.log("[NotificationsAPI] Sent test push", {
      tokenCount: tokens.length,
      payload,
    });

    res.json({
      ok: true,
      tokenCount: tokens.length,
      expoResponse: payload,
    });
  } catch (error) {
    console.log("[NotificationsAPI] Test push request failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(502).json({ error: "Failed to send test push notification" });
  }
});

app.get("/api/geocoding/search", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const accessToken = assertMapboxAccessToken(res);

  if (!accessToken) {
    return;
  }

  if (!query) {
    res.json({ features: [] });
    return;
  }

  try {
    const params = new URLSearchParams({
      access_token: accessToken,
      autocomplete: "true",
      limit: "8",
      types: "place,locality,neighborhood,address,poi",
      country: "US",
    });
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query,
    )}.json?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `Mapbox geocoding request failed: ${response.status} ${responseText}`,
      );
    }

    const payload = await response.json();
    res.json(payload);
  } catch (error) {
    console.log("[GeocodingAPI] Search failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(502).json({ error: "Failed to search locations" });
  }
});

db.exec(`
  CREATE TABLE IF NOT EXISTS route_segments (
    segment_id TEXT PRIMARY KEY,
    route_name TEXT NOT NULL,
    direction TEXT,
    from_label TEXT NOT NULL,
    to_label TEXT NOT NULL,
    primary_station_id TEXT NOT NULL,
    district_id TEXT,
    notes TEXT
  );

  DELETE FROM route_segments;

  INSERT INTO route_segments (
    segment_id,
    route_name,
    direction,
    from_label,
    to_label,
    primary_station_id,
    district_id,
    notes
  ) VALUES
  (
    'i80-evanston-bear-river',
    'I-80',
    NULL,
    'Evanston',
    'Bear River Drive',
    'WY58',
    'D3',
    'Wind exposure'
  ),
  (
    'i80-bear-river-painter',
    'I-80',
    NULL,
    'Bear River Drive',
    'Painter',
    'WY57',
    'D3',
    'Wind exposure'
  ),
  (
    'i80-painter-first-divide',
    'I-80',
    NULL,
    'Painter',
    'First Divide',
    'WY31',
    'D3',
    'Pass exposure'
  ),
  (
    'i80-first-divide-green-river-tunnel',
    'I-80',
    NULL,
    'First Divide',
    'Green River Tunnel East',
    'KFIR',
    'D3',
    'Pass exposure'
  ),
  (
    'i80-green-river-tunnel-bitter-creek',
    'I-80',
    NULL,
    'Green River Tunnel East',
    'Bitter Creek',
    'KPER',
    'D3',
    'Tunnel / canyon exposure'
  ),
  (
    'i80-bitter-creek-point-of-rocks',
    'I-80',
    NULL,
    'Bitter Creek',
    'Point of Rocks',
    'KBIT',
    'D3',
    'Open prairie exposure'
  ),
  (
    'i80-point-of-rocks-tipton',
    'I-80',
    NULL,
    'Point of Rocks',
    'Tipton',
    'WY12',
    'D3',
    'High wind corridor'
  ),
  (
    'i80-tipton-walcott-junction',
    'I-80',
    NULL,
    'Tipton',
    'Walcott Junction',
    'WY13',
    'D3',
    'Open prairie exposure'
  ),
  (
    'i80-walcott-junction-elk-mountain',
    'I-80',
    NULL,
    'Walcott Junction',
    'Elk Mountain',
    'WY15',
    'D3',
    'High wind corridor'
  ),
  (
    'i80-elk-mountain-foote-creek',
    'I-80',
    NULL,
    'Elk Mountain',
    'Foote Creek',
    'WY19',
    'D1',
    'High wind corridor'
  ),
  (
    'i80-foote-creek-arlington',
    'I-80',
    NULL,
    'Foote Creek',
    'Arlington',
    'WY22',
    'D1',
    'High wind corridor'
  ),
  (
    'i80-arlington-vedauwoo',
    'I-80',
    NULL,
    'Arlington',
    'Vedauwoo',
    'KARL',
    'D1',
    'High wind corridor'
  ),
  (
    'i80-vedauwoo-summit-east',
    'I-80',
    NULL,
    'Vedauwoo',
    'Summit East',
    'KVDW',
    'D1',
    'High wind corridor'
  ),
  (
    'i80-summit-east-cheyenne-east',
    'I-80',
    NULL,
    'Summit East',
    'Cheyenne East',
    'WY28',
    'D1',
    'Wind exposure'
  ),
  (
    'i25-bordeaux-bear-creek',
    'I-25',
    NULL,
    'Bordeaux',
    'Bear Creek',
    'KBRX',
    'D2',
    'Wind exposure'
  ),
  (
    'i25-bear-creek-platte-converse',
    'I-25',
    NULL,
    'Bear Creek',
    'Platte/Converse',
    'WY40',
    'D2',
    'Open prairie exposure'
  ),
  (
    'i25-platte-converse-twenty-mile-hill',
    'I-25',
    NULL,
    'Platte/Converse',
    'Twenty Mile Hill',
    'WY56',
    'D2',
    'Wind exposure'
  ),
  (
    'i25-twenty-mile-hill-tisdale-divide',
    'I-25',
    NULL,
    'Twenty Mile Hill',
    'Tisdale Divide',
    'KTMH',
    'D2',
    'High wind corridor'
  ),
  (
    'i25-tisdale-divide-smokey-gap',
    'I-25',
    NULL,
    'Tisdale Divide',
    'Smokey Gap',
    'WY63',
    'D2',
    'Open prairie exposure'
  ),
  (
    'i25-smokey-gap-hat-six',
    'I-25',
    NULL,
    'Smokey Gap',
    'Hat Six',
    'WY62',
    'D2',
    'Open prairie exposure'
  ),
  (
    'i25-hat-six-coleman',
    'I-25',
    NULL,
    'Hat Six',
    'Coleman',
    'WY61',
    'D2',
    'Wind exposure'
  ),
  (
    'i90-buffalo-dead-horse',
    'I-90',
    NULL,
    'Buffalo',
    'Dead Horse',
    'KDHS',
    'D4',
    'Open prairie exposure'
  ),
  (
    'i90-buffalo-indian-creek',
    'I-90',
    NULL,
    'Buffalo',
    'Indian Creek Road',
    'WY3',
    'D4',
    'Wind exposure'
  ),
  (
    'i90-sheridan-pompey-creek',
    'I-90',
    NULL,
    'Sheridan',
    'Pompey Creek',
    'WY55',
    'D4',
    'Wind exposure'
  ),
  (
    'i90-gillette-mile-marker-108',
    'I-90',
    NULL,
    'Gillette',
    'Mile Marker 108',
    'WY4',
    'D4',
    'Open prairie exposure'
  ),
  (
    'i90-sundance-inyan-kara',
    'I-90',
    NULL,
    'Sundance',
    'Inyan Kara',
    'KIKA',
    'D4',
    'Open prairie exposure'
  ),
  (
    'i90-beulah-state-line',
    'I-90',
    NULL,
    'Beulah Interchange',
    'South Dakota line',
    'WY6',
    'D4',
    'Wind exposure'
  ),
  (
    'us14-granite-pass',
    'US-14',
    NULL,
    'Bighorn foothills',
    'Granite Pass',
    'WY52',
    'D4',
    'Pass exposure'
  ),
  (
    'us14-16-ucross',
    'US-14/16',
    NULL,
    'Sheridan',
    'Ucross',
    'WY59',
    'D4',
    'Open prairie exposure'
  ),
  (
    'us20-26-hiland',
    'US-20/26',
    NULL,
    'Casper east',
    'Hiland',
    'KHLD',
    'D2',
    'Open prairie exposure'
  ),
  (
    'us30-sage-junction',
    'US-30',
    NULL,
    'Kemmerer',
    'Sage Junction',
    'KSGE',
    'D3',
    'Wind exposure'
  ),
  (
    'us30-nugget-canyon',
    'US-30',
    NULL,
    'Rock Springs',
    'Nugget Canyon',
    'WY30',
    'D3',
    'Tunnel / canyon exposure'
  ),
  (
    'us85-gun-barrel',
    'US-85',
    NULL,
    'Cheyenne north',
    'Gun Barrel',
    'KGUN',
    'D1',
    'Wind exposure'
  ),
  (
    'us85-four-corners',
    'US-85',
    NULL,
    'Gillette north',
    'Four Corners',
    'WY64',
    'D4',
    'Open prairie exposure'
  ),
  (
    'us191-farson',
    'US-191',
    NULL,
    'Farson',
    'Green River Basin',
    'WY42',
    'D3',
    'Open prairie exposure'
  ),
  (
    'us287-pumpkin-vine',
    'US-287',
    NULL,
    'South Pass approach',
    'Pumpkin Vine',
    'KPUM',
    'D5',
    'Wind exposure'
  ),
  (
    'wy22-teton-pass',
    'WY-22',
    NULL,
    'Wilson',
    'Teton Pass',
    'KTET',
    'D5',
    'Pass exposure'
  ),
  (
    'wy28-south-pass-red-canyon',
    'WY-28',
    NULL,
    'South Pass area',
    'Lower Red Canyon',
    'KREC',
    'D5',
    'Pass exposure'
  ),
  (
    'wy220-pathfinder',
    'WY-220',
    NULL,
    'Casper south',
    'Pathfinder',
    'KPAT',
    'D2',
    'Open prairie exposure'
  ),
  (
    'wy372-shute-creek',
    'WY-372',
    NULL,
    'Green River Basin',
    'Shute Creek',
    'KSHC',
    'D3',
    'Wind exposure'
  ),
  (
    'wy387-pine-tree-junction',
    'WY-387',
    NULL,
    'Pine Tree Junction',
    'central WY-387',
    'WY5',
    'D2',
    'Open prairie exposure'
  ),
  (
    'wy487-shirley-rim',
    'WY-487',
    NULL,
    'Shirley Basin',
    'Shirley Rim',
    'WY44',
    'D2',
    'Wind exposure'
  ),
  (
    'wy120-meeteetse-rim',
    'WY-120',
    NULL,
    'Meeteetse',
    'Meeteetse Rim',
    'KMTR',
    'D4',
    'Wind exposure'
  ),
  (
    'wy210-wildcat-trail',
    'WY-210',
    NULL,
    'Cheyenne',
    'Wildcat Trail',
    'WY48',
    'D1',
    'Wind exposure'
  );
`);

app.get("/api/weather/current", async (req, res) => {
  const coordinates = getRequiredLatLon(req, res);
  const apiKey = assertTomorrowApiKey(res);

  if (!coordinates || !apiKey) {
    return;
  }

  try {
    const url = buildTomorrowWeatherUrl(
      coordinates.lat,
      coordinates.lon,
      apiKey,
    );
    const payload = await fetchTomorrowJson(url);
    res.json(payload);
  } catch (error) {
    console.log("[WeatherAPI] Current weather request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(502).json({ error: "Failed to fetch current weather data" });
  }
});

app.get("/api/weather/hourly", async (req, res) => {
  const coordinates = getRequiredLatLon(req, res);
  const apiKey = assertTomorrowApiKey(res);

  if (!coordinates || !apiKey) {
    return;
  }

  try {
    const url = `${TOMORROW_TIMELINES_URL}?apikey=${encodeURIComponent(apiKey)}`;
    const requestBody = {
      location: `${coordinates.lat},${coordinates.lon}`,
      fields: [...COMBINED_CURRENT_AND_HOURLY_FIELDS],
      units: "metric",
      timesteps: ["1h"],
      startTime: "now",
      endTime: "nowPlus12h",
    };

    debugLog("[WeatherAPI] Hourly Tomorrow request", {
      location: requestBody.location,
      fields: requestBody.fields,
      timesteps: requestBody.timesteps,
      startTime: requestBody.startTime,
      endTime: requestBody.endTime,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `Tomorrow.io hourly timelines request failed: ${response.status} ${responseText}`,
      );
    }

    const payload = (await response.json()) as TomorrowHourlyTimelinesResponse;
    const hourlyEntries =
      payload.data?.timelines?.find((timeline) => timeline.timestep === "1h")
        ?.intervals ?? [];

    debugLog(
      "[WeatherAPI] Hourly Tomorrow response sample",
      hourlyEntries.slice(0, 12).map((entry) => ({
        time: entry.startTime ?? null,
        weatherCode: entry.values?.weatherCode ?? null,
        precipitationProbability:
          entry.values?.precipitationProbability ?? null,
        temperature: entry.values?.temperature ?? null,
        windSpeed: entry.values?.windSpeed ?? null,
        windGust: entry.values?.windGust ?? null,
      })),
    );

    res.json({
      timelines: {
        hourly: hourlyEntries.map((entry) => ({
          time: entry.startTime ?? "",
          values: entry.values ?? {},
        })),
      },
    });
  } catch (error) {
    console.log("[WeatherAPI] Hourly forecast request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(502).json({ error: "Failed to fetch hourly forecast data" });
  }
});

app.get("/api/weather/daily", async (req, res) => {
  const coordinates = getRequiredLatLon(req, res);
  const apiKey = assertTomorrowApiKey(res);

  if (!coordinates || !apiKey) {
    return;
  }

  try {
    const url = buildTomorrowWeatherUrl(
      coordinates.lat,
      coordinates.lon,
      apiKey,
      "1d",
    );
    const payload = await fetchTomorrowJson(url);
    res.json(payload);
  } catch (error) {
    console.log("[WeatherAPI] Daily forecast request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(502).json({ error: "Failed to fetch daily forecast data" });
  }
});

app.get("/api/weather/current-hourly", async (req, res) => {
  const coordinates = getRequiredLatLon(req, res);
  const apiKey = assertTomorrowApiKey(res);

  if (!coordinates || !apiKey) {
    return;
  }

  try {
    const url = `${TOMORROW_TIMELINES_URL}?apikey=${encodeURIComponent(apiKey)}`;
    const baseRequestBody = {
      location: `${coordinates.lat},${coordinates.lon}`,
      fields: [...COMBINED_CURRENT_AND_HOURLY_FIELDS],
      units: "metric",
      startTime: "now",
    };
    const currentRequestBody = {
      ...baseRequestBody,
      timesteps: ["current"],
    };
    const hourlyRequestBody = {
      ...baseRequestBody,
      timesteps: ["1h"],
      endTime: "nowPlus12h",
    };

    debugLog("[WeatherAPI] Combined current/hourly Tomorrow requests", {
      location: baseRequestBody.location,
      fields: baseRequestBody.fields,
      currentTimesteps: currentRequestBody.timesteps,
      hourlyTimesteps: hourlyRequestBody.timesteps,
      startTime: hourlyRequestBody.startTime,
      hourlyEndTime: hourlyRequestBody.endTime,
    });

    const [currentResponse, hourlyResponse] = await Promise.all([
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(currentRequestBody),
      }),
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(hourlyRequestBody),
      }),
    ]);

    if (!currentResponse.ok) {
      const responseText = await currentResponse.text();
      throw new Error(
        `Tomorrow.io current timelines request failed: ${currentResponse.status} ${responseText}`,
      );
    }

    if (!hourlyResponse.ok) {
      const responseText = await hourlyResponse.text();
      throw new Error(
        `Tomorrow.io hourly timelines request failed: ${hourlyResponse.status} ${responseText}`,
      );
    }

    const currentPayload =
      (await currentResponse.json()) as TomorrowCombinedForecastResponse;
    const hourlyPayload =
      (await hourlyResponse.json()) as TomorrowHourlyTimelinesResponse;
    const currentEntry = currentPayload.data?.timelines?.find(
      (timeline) => timeline.timestep === "current",
    )?.intervals?.[0];
    const hourlyEntries =
      hourlyPayload.data?.timelines?.find(
        (timeline) => timeline.timestep === "1h",
      )?.intervals ?? [];

    debugLog(
      "[WeatherAPI] Combined current/hourly Tomorrow response sample",
      hourlyEntries.slice(0, 12).map((entry) => ({
        time: entry.startTime ?? null,
        weatherCode: entry.values?.weatherCode ?? null,
        precipitationProbability:
          entry.values?.precipitationProbability ?? null,
        temperature: entry.values?.temperature ?? null,
        windSpeed: entry.values?.windSpeed ?? null,
        windGust: entry.values?.windGust ?? null,
      })),
    );

    res.json({
      currentWeather: {
        data: {
          time: currentEntry?.startTime,
          values: currentEntry?.values ?? {},
        },
      },
      hourlyForecast: {
        timelines: {
          hourly: hourlyEntries.map((entry) => ({
            time: entry.startTime ?? "",
            values: entry.values ?? {},
          })),
        },
      },
    });
  } catch (error) {
    console.log("[WeatherAPI] Combined current/hourly request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(502).json({
      error: "Failed to fetch combined current and hourly weather data",
    });
  }
});

app.get("/api/road/stations", (_req, res) => {
  const rows = db
    .prepare(
      `
    ${STATION_SELECT}
    ORDER BY observed_at DESC, station_id ASC
    LIMIT 100
  `,
    )
    .all();

  res.json(rows);
});

app.get("/api/road/stations/wyoming", (_req, res) => {
  const rows = db
    .prepare(
      `
    ${STATION_SELECT}
    WHERE latitude BETWEEN 40.9 AND 45.1
      AND longitude BETWEEN -111.1 AND -104.0
    ORDER BY observed_at DESC, station_id ASC
  `,
    )
    .all();

  res.json(rows);
});

app.get("/api/road/stations/wydot", (_req, res) => {
  const rows = db
    .prepare(
      `
    ${STATION_SELECT}
    WHERE station_name LIKE '%WYDOT%'
    ORDER BY observed_at DESC, station_id ASC
  `,
    )
    .all();

  res.json(rows);
});

app.get("/api/road/stations/:stationId", (req, res) => {
  const row = db
    .prepare(
      `
    ${STATION_SELECT}
    WHERE station_id = ?
  `,
    )
    .get(req.params.stationId);

  if (!row) {
    res.status(404).json({ error: "Station not found" });
    return;
  }

  res.json(row);
});

app.get("/api/road/geometry", (_req, res) => {
  try {
    const geoJson = JSON.parse(fs.readFileSync(roadGeometryPath, "utf8"));
    res.json(geoJson);
  } catch (error) {
    console.log("[RoadGeometryAPI] Failed to load road geometry", {
      roadGeometryPath,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Failed to load road geometry" });
  }
});

app.get("/api/road/segments", async (_req, res) => {
  try {
    const rows = db
      .prepare(
        `
    SELECT
      rs.segment_id AS segmentId,
      rs.route_name AS routeName,
      rs.direction AS direction,
      rs.from_label AS fromLabel,
      rs.to_label AS toLabel,
      rs.primary_station_id AS primaryStationId,
      rs.district_id AS districtId,
      rs.notes AS notes,
      s.station_id AS stationId,
      s.station_name AS stationName,
      s.latitude AS latitude,
      s.longitude AS longitude,
      s.observed_at AS observedAt,
      s.air_temp_f AS airTempF,
      s.wind_speed_mph AS windSpeedMph,
      s.wind_gust_mph AS windGustMph,
      s.visibility_mi AS visibilityMi,
      s.road_surface_temp_f AS roadSurfaceTempF,
      s.road_state_code AS roadStateCode,
      s.road_state_label AS roadStateLabel,
      s.source_provider AS sourceProvider
    FROM route_segments rs
    LEFT JOIN station_observations_latest s
      ON s.station_id = rs.primary_station_id
    ORDER BY route_name ASC, from_label ASC, to_label ASC
  `,
      )
      .all() as {
      segmentId: string;
      routeName: string;
      direction: string | null;
      fromLabel: string;
      toLabel: string;
      primaryStationId: string;
      districtId: string | null;
      notes: string | null;
      stationId: string | null;
      stationName: string | null;
      latitude: number | null;
      longitude: number | null;
      observedAt: string | null;
      airTempF: number | null;
      windSpeedMph: number | null;
      windGustMph: number | null;
      visibilityMi: number | null;
      roadSurfaceTempF: number | null;
      roadStateCode: number | null;
      roadStateLabel: string | null;
      sourceProvider: string | null;
    }[];

    const officialRecords = await getWydotMediaConditions();

    const responsePayload = rows.map((row) => {
      const primaryStation: SegmentPrimaryStation | null = row.stationId
        ? {
            stationId: row.stationId,
            stationName: row.stationName,
            latitude: row.latitude,
            longitude: row.longitude,
            observedAt: row.observedAt,
            airTempF: row.airTempF,
            windSpeedMph: row.windSpeedMph,
            windGustMph: row.windGustMph,
            visibilityMi: row.visibilityMi,
            roadSurfaceTempF: row.roadSurfaceTempF,
            roadStateCode: row.roadStateCode,
            roadStateLabel: row.roadStateLabel,
            sourceProvider: row.sourceProvider,
          }
        : null;
      const impact = computeImpact(primaryStation);
      const officialCondition = findOfficialConditionForSegment(
        {
          routeName: row.routeName,
          fromLabel: row.fromLabel,
          toLabel: row.toLabel,
        },
        officialRecords,
      );

      return {
        segmentId: row.segmentId,
        routeName: row.routeName,
        direction: row.direction,
        fromLabel: row.fromLabel,
        toLabel: row.toLabel,
        primaryStationId: row.primaryStationId,
        districtId: row.districtId,
        notes: row.notes,
        latitude: row.latitude,
        longitude: row.longitude,
        impactLevel: impact.level,
        impactReason: impact.reason,
        officialConditionLabel: officialCondition.officialConditionLabel,
        officialConditionDescription:
          officialCondition.officialConditionDescription,
        officialRestriction: officialCondition.officialRestriction,
        computedImpactLevel: impact.level,
        computedImpactReason: impact.reason,
        observedFactors: buildObservedFactors(primaryStation),
      };
    });

    debugLog("[RoadSegmentsAPI] Returning segments", {
      rowCount: responsePayload.length,
      sampleSegmentIds: responsePayload.slice(0, 5).map((row) => row.segmentId),
    });

    res.json(responsePayload);
  } catch (error) {
    console.log("[RoadSegmentsAPI] Query failed", {
      dbPath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});

app.get("/api/road/segment/:segmentId", async (req, res) => {
  const row = db
    .prepare(
      `
    SELECT
      rs.segment_id AS segment_id,
      rs.route_name AS route_name,
      rs.direction AS direction,
      rs.from_label AS from_label,
      rs.to_label AS to_label,
      rs.primary_station_id AS primary_station_id,
      rs.district_id AS district_id,
      rs.notes AS notes,
      s.station_id AS stationId,
      s.station_name AS stationName,
      s.latitude AS latitude,
      s.longitude AS longitude,
      s.observed_at AS observedAt,
      s.air_temp_f AS airTempF,
      s.wind_speed_mph AS windSpeedMph,
      s.wind_gust_mph AS windGustMph,
      s.visibility_mi AS visibilityMi,
      s.road_surface_temp_f AS roadSurfaceTempF,
      s.road_state_code AS roadStateCode,
      s.road_state_label AS roadStateLabel,
      s.source_provider AS sourceProvider
    FROM route_segments rs
    LEFT JOIN station_observations_latest s
      ON s.station_id = rs.primary_station_id
    WHERE rs.segment_id = ?
  `,
    )
    .get(req.params.segmentId) as
    | {
        segment_id: string;
        route_name: string;
        direction: string | null;
        from_label: string;
        to_label: string;
        primary_station_id: string;
        district_id: string | null;
        notes: string | null;
        stationId: string | null;
        stationName: string | null;
        latitude: number | null;
        longitude: number | null;
        observedAt: string | null;
        airTempF: number | null;
        windSpeedMph: number | null;
        windGustMph: number | null;
        visibilityMi: number | null;
        roadSurfaceTempF: number | null;
        roadStateCode: number | null;
        roadStateLabel: string | null;
        sourceProvider: string | null;
      }
    | undefined;

  if (!row) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }

  const primaryStation: SegmentPrimaryStation | null = row.stationId
    ? {
        stationId: row.stationId,
        stationName: row.stationName,
        latitude: row.latitude,
        longitude: row.longitude,
        observedAt: row.observedAt,
        airTempF: row.airTempF,
        windSpeedMph: row.windSpeedMph,
        windGustMph: row.windGustMph,
        visibilityMi: row.visibilityMi,
        roadSurfaceTempF: row.roadSurfaceTempF,
        roadStateCode: row.roadStateCode,
        roadStateLabel: row.roadStateLabel,
        sourceProvider: row.sourceProvider,
      }
    : null;

  const officialRecords = await getWydotMediaConditions();
  const officialCondition = findOfficialConditionForSegment(
    {
      routeName: row.route_name,
      fromLabel: row.from_label,
      toLabel: row.to_label,
    },
    officialRecords,
  );

  res.json({
    segment: {
      segmentId: row.segment_id,
      routeName: row.route_name,
      direction: row.direction,
      fromLabel: row.from_label,
      toLabel: row.to_label,
      primaryStationId: row.primary_station_id,
      districtId: row.district_id,
      notes: row.notes,
    },
    primaryStation,
    impact: computeImpact(primaryStation),
    officialConditionLabel: officialCondition.officialConditionLabel,
    officialConditionDescription:
      officialCondition.officialConditionDescription,
    officialRestriction: officialCondition.officialRestriction,
    observedFactors: buildObservedFactors(primaryStation),
  });
});

app.get("/api/road/official-conditions", async (_req, res) => {
  const records = await getWydotMediaConditions();
  res.json({
    sourceUrl: WYDOT_MEDIA_STATEWIDE_URL,
    count: records.length,
    records,
  });
});

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
