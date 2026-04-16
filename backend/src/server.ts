import Database from "better-sqlite3";
import express from "express";

const app = express();
const db = new Database("weatherapp.db");
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

  INSERT OR IGNORE INTO route_segments (
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
    'i80-arlington-wagonhound-eb',
    'I-80',
    'EB',
    'Arlington',
    'Wagonhound',
    'WY21',
    'D1',
    'High wind corridor'
  ),
  (
    'i80-wagonhound-elk-mountain-eb',
    'I-80',
    'EB',
    'Wagonhound',
    'Elk Mountain',
    'WY19',
    'D1',
    'High wind corridor'
  ),
  (
    'i80-elk-mountain-foote-creek-eb',
    'I-80',
    'EB',
    'Elk Mountain',
    'Foote Creek',
    'WY22',
    'D1',
    'High wind corridor'
  ),
  (
    'i25-bordeaux-twenty-mile-hill-nb',
    'I-25',
    'NB',
    'Bordeaux',
    'Twenty Mile Hill',
    'KTMH',
    'D2',
    'Wind exposure'
  ),
  (
    'wy28-south-pass-red-canyon',
    'WY-28',
    NULL,
    'South Pass area',
    'Lower Red Canyon',
    'KREC',
    'D5',
    'Wind-prone'
  );
`);

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
    .all() as Array<{
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
  }>;

  res.json(
    rows.map((row) => {
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
        impactLevel: impact.level,
        impactReason: impact.reason,
      };
    }),
  );
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

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
