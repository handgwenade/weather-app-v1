import Database from "better-sqlite3";
import express from "express";
import path from "node:path";

const dbPath = path.resolve(__dirname, "..", "weatherapp.db");
const app = express();
const db = new Database(dbPath);
const TOMORROW_API_KEY = process.env.TOMORROW_API_KEY;
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

console.log("[Server] Opening SQLite database", {
  dbPath,
});
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

    console.log("[WeatherAPI] Hourly Tomorrow request", {
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

    console.log(
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

    console.log("[WeatherAPI] Combined current/hourly Tomorrow requests", {
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

    console.log(
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

app.get("/api/road/segments", (_req, res) => {
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

    const responsePayload = rows.map((row) => {
      const impact = computeImpact(
        row.stationId
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
          : null,
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
      };
    });

    console.log("[RoadSegmentsAPI] Returning segments", {
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

app.get("/api/road/segment/:segmentId", (req, res) => {
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
  });
});

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
