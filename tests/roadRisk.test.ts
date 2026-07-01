import assert from "node:assert/strict";
import test from "node:test";

import {
  computeSegmentImpact,
  type SegmentPrimaryStation,
} from "../backend/src/lib/roadRisk";

function station(
  overrides: Partial<SegmentPrimaryStation> = {},
): SegmentPrimaryStation {
  return {
    stationId: "station-1",
    stationName: "Station 1",
    latitude: 42,
    longitude: -105,
    observedAt: "2026-06-30T22:30:00.000Z",
    airTempF: 72,
    windSpeedMph: 3,
    windGustMph: 4,
    visibilityMi: 10,
    roadSurfaceTempF: 58,
    roadStateCode: 1,
    roadStateLabel: "Dry",
    sourceProvider: "madis",
    ...overrides,
  };
}

test("calm and dry observed weather does not produce red", () => {
  const impact = computeSegmentImpact(station());

  assert.equal(impact.level, "low");
  assert.match(impact.reason, /No elevated road risk/);
});

test("unknown station data does not become elevated", () => {
  const impact = computeSegmentImpact(null);

  assert.equal(impact.level, "unknown");
  assert.match(impact.reason, /observations unavailable/);
});

test("unavailable station fields do not become elevated by default", () => {
  const impact = computeSegmentImpact(
    station({
      visibilityMi: null,
      windGustMph: null,
      windSpeedMph: null,
      roadSurfaceTempF: null,
      roadStateCode: null,
      roadStateLabel: null,
    }),
  );

  assert.equal(impact.level, "low");
});

test("yellow status explanation matches the actual observed factor", () => {
  const impact = computeSegmentImpact(station({ windGustMph: 42 }));

  assert.equal(impact.level, "moderate");
  assert.equal(impact.reason, "Wind gusts at 42 mph");
});

test("mild visibility is not elevated without a stronger trigger", () => {
  const impact = computeSegmentImpact(station({ visibilityMi: 1.2 }));

  assert.equal(impact.level, "low");
});

test("red status requires an explicit severe or official trigger", () => {
  const nearSevere = computeSegmentImpact(
    station({
      visibilityMi: 0.4,
      windGustMph: 49,
      windSpeedMph: 39,
      roadStateCode: 1,
      roadStateLabel: "Dry",
      roadSurfaceTempF: 58,
    }),
  );
  const severe = computeSegmentImpact(station({ windGustMph: 50 }));
  const official = computeSegmentImpact(station(), {
    officialConditionLabel: null,
    officialConditionDescription: null,
    officialRestriction: "No Trailer Traffic: I 25 restriction posted",
  });

  assert.notEqual(nearSevere.level, "high");
  assert.equal(severe.level, "high");
  assert.equal(official.level, "high");
});

test("severe visibility threshold is a defensible red trigger", () => {
  const impact = computeSegmentImpact(station({ visibilityMi: 0.2 }));

  assert.equal(impact.level, "high");
  assert.equal(impact.reason, "Visibility severely reduced to 0.2 miles");
});
