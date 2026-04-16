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
  console.error("Usage: npx tsx src/jobs/parseMadis.ts <path-to-netcdf-file>");
  process.exit(1);
}

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

const rows = [];

for (let i = 0; i < stationId.length; i++) {
  const roadStateCode = firstScalar(roadState1[i]);
  const roadSurfaceTempF = kelvinToF(roadTemperature1[i]);

  rows.push({
    stationId: cleanText(stationId[i]),
    stationName: cleanText(stationName[i]),
    latitude: latitude[i] ?? null,
    longitude: longitude[i] ?? null,
    observedAt: unixSecondsToIso(observationTime[i]),
    airTempF: kelvinToF(temperature[i]),
    windSpeedMph: msToMph(windSpeed[i]),
    windGustMph: msToMph(windGust[i]),
    visibilityMi: metersToMiles(visibility[i]),
    roadSurfaceTempF,
    roadStateCode,
    roadStateLabel: roadStateLabel(roadStateCode),
  });
}

const usefulRows = rows.filter(
  (row) => row.roadSurfaceTempF != null && row.roadStateCode != null,
);

console.log(JSON.stringify(usefulRows.slice(0, 10), null, 2));
