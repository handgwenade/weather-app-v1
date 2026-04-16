import Database from "better-sqlite3";
import { NetCDFReader } from "netcdfjs";
import fs from "node:fs";
import {
    cleanText,
    kelvinToF,
    metersToMiles,
    msToMph,
    unixSecondsToIso,
} from "../lib/conversions";
import { roadStateLabel } from "../lib/roadState";

function getVar<T = any>(reader: NetCDFReader, name: string): T | null {
  try {
    return reader.getDataVariable(name) as T;
  } catch {
    return null;
  }
}

function firstScalar(value: unknown): number | null {
  let n: number | null = null;

  if (Array.isArray(value)) {
    const first = value[0];
    n = typeof first === "number" ? first : null;
  } else {
    n = typeof value === "number" ? value : null;
  }

  if (n == null) return null;
  if (!Number.isFinite(n)) return null;
  if (n <= -32767) return null;
  if (Math.abs(n) >= 1e20) return null;

  return n;
}

const filePath = process.argv[2];
if (!filePath) {
  console.error(
    "Usage: npx tsx src/jobs/loadMadisToDb.ts <path-to-netcdf-file>",
  );
  process.exit(1);
}

const db = new Database("weatherapp.db");

db.exec(`
CREATE TABLE IF NOT EXISTS station_observations_latest (
  station_id TEXT PRIMARY KEY,
  station_name TEXT,
  latitude REAL,
  longitude REAL,
  observed_at TEXT,
  air_temp_f REAL,
  wind_speed_mph REAL,
  wind_gust_mph REAL,
  visibility_mi REAL,
  road_surface_temp_f REAL,
  road_state_code INTEGER,
  road_state_label TEXT,
  source_provider TEXT DEFAULT 'madis'
);
`);

const insert = db.prepare(`
INSERT INTO station_observations_latest (
  station_id,
  station_name,
  latitude,
  longitude,
  observed_at,
  air_temp_f,
  wind_speed_mph,
  wind_gust_mph,
  visibility_mi,
  road_surface_temp_f,
  road_state_code,
  road_state_label,
  source_provider
) VALUES (
  @station_id,
  @station_name,
  @latitude,
  @longitude,
  @observed_at,
  @air_temp_f,
  @wind_speed_mph,
  @wind_gust_mph,
  @visibility_mi,
  @road_surface_temp_f,
  @road_state_code,
  @road_state_label,
  'madis'
)
ON CONFLICT(station_id) DO UPDATE SET
  station_name = excluded.station_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  observed_at = excluded.observed_at,
  air_temp_f = excluded.air_temp_f,
  wind_speed_mph = excluded.wind_speed_mph,
  wind_gust_mph = excluded.wind_gust_mph,
  visibility_mi = excluded.visibility_mi,
  road_surface_temp_f = excluded.road_surface_temp_f,
  road_state_code = excluded.road_state_code,
  road_state_label = excluded.road_state_label,
  source_provider = excluded.source_provider
`);

const buffer = fs.readFileSync(filePath);
const reader = new NetCDFReader(buffer);

const stationId = getVar<any[]>(reader, "stationId") ?? [];
const stationName = getVar<any[]>(reader, "stationName") ?? [];
const latitude = getVar<number[]>(reader, "latitude") ?? [];
const longitude = getVar<number[]>(reader, "longitude") ?? [];
const observationTime = getVar<number[]>(reader, "observationTime") ?? [];
const temperature = getVar<number[]>(reader, "temperature") ?? [];
const windSpeed = getVar<number[]>(reader, "windSpeed") ?? [];
const windGust = getVar<number[]>(reader, "windGust") ?? [];
const visibility = getVar<number[]>(reader, "visibility") ?? [];
const roadTemperature1 = getVar<number[]>(reader, "roadTemperature1") ?? [];
const roadState1 = getVar<any[]>(reader, "roadState1") ?? [];

const tx = db.transaction(() => {
  for (let i = 0; i < stationId.length; i++) {
    const roadStateCode = firstScalar(roadState1[i]);
    const roadSurfaceTempF = kelvinToF(roadTemperature1[i]);

    if (roadSurfaceTempF == null && roadStateCode == null) continue;

    insert.run({
      station_id: cleanText(stationId[i]),
      station_name: cleanText(stationName[i]),
      latitude: latitude[i] ?? null,
      longitude: longitude[i] ?? null,
      observed_at: unixSecondsToIso(observationTime[i]),
      air_temp_f: kelvinToF(temperature[i]),
      wind_speed_mph: msToMph(windSpeed[i]),
      wind_gust_mph: msToMph(windGust[i]),
      visibility_mi: metersToMiles(visibility[i]),
      road_surface_temp_f: roadSurfaceTempF,
      road_state_code: roadStateCode,
      road_state_label: roadStateLabel(roadStateCode),
    });
  }
});

tx();

const count = db
  .prepare(`SELECT COUNT(*) as count FROM station_observations_latest`)
  .get() as { count: number };
console.log(`Loaded ${count.count} road-capable stations into SQLite.`);
