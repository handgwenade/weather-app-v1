import assert from "node:assert/strict";
import test from "node:test";

import {
  getRoadMapStatusColor,
  ROAD_MAP_LAYER_PLAN_COPY,
  ROAD_MAP_LEGEND_GROUP_LABELS,
  ROAD_MAP_STATUS_COLORS,
} from "../utils/roadMapStatus";

test("marker without risk status uses neutral gray", () => {
  assert.equal(getRoadMapStatusColor(undefined), ROAD_MAP_STATUS_COLORS.unknown);
});

test("low and normal statuses use green", () => {
  assert.equal(getRoadMapStatusColor("low"), ROAD_MAP_STATUS_COLORS.normal);
  assert.equal(getRoadMapStatusColor("normal"), ROAD_MAP_STATUS_COLORS.normal);
});

test("caution and moderate statuses use yellow", () => {
  assert.equal(getRoadMapStatusColor("caution"), ROAD_MAP_STATUS_COLORS.caution);
  assert.equal(getRoadMapStatusColor("moderate"), ROAD_MAP_STATUS_COLORS.caution);
});

test("elevated status uses orange", () => {
  assert.equal(getRoadMapStatusColor("elevated"), ROAD_MAP_STATUS_COLORS.elevated);
});

test("high and closed statuses use red", () => {
  assert.equal(getRoadMapStatusColor("high"), ROAD_MAP_STATUS_COLORS.high);
  assert.equal(getRoadMapStatusColor("closed"), ROAD_MAP_STATUS_COLORS.high);
});

test("road map legend distinguishes route layer from condition markers", () => {
  assert.equal(ROAD_MAP_LEGEND_GROUP_LABELS.routeLayer, "Route layer");
  assert.equal(
    ROAD_MAP_LEGEND_GROUP_LABELS.conditionMarkers,
    "Condition markers",
  );
  assert.match(ROAD_MAP_LAYER_PLAN_COPY, /Green lines show monitored routes/);
  assert.match(ROAD_MAP_LAYER_PLAN_COPY, /Condition markers appear/);
  assert.match(ROAD_MAP_LAYER_PLAN_COPY, /Gray markers/);
});
