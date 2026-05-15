import assert from "node:assert/strict";
import test from "node:test";

import {
  canRenderCurrentWeatherIndependently,
  getCachedRenderState,
  getHomeCardStateLabel,
  getRoadFallbackState,
  getWeatherFailureState,
} from "../utils/homePerformance";

test("cached render path uses fresh or stale cache without waiting", () => {
  assert.equal(
    getCachedRenderState({ hasCachedData: true, isFresh: true }),
    "fresh",
  );
  assert.equal(
    getCachedRenderState({ hasCachedData: true, isFresh: false }),
    "stale",
  );
  assert.equal(
    getCachedRenderState({ hasCachedData: false, isFresh: false }),
    "loading",
  );
});

test("timeout fallback path keeps last-known-good weather as stale", () => {
  assert.equal(getWeatherFailureState({ hasLastKnownGood: true }), "stale");
  assert.equal(
    getWeatherFailureState({ hasLastKnownGood: false }),
    "unavailable",
  );
});

test("road data unavailable path is estimated when weather can support fallback", () => {
  assert.equal(
    getRoadFallbackState({ hasRoadData: false, hasWeatherEstimate: true }),
    "estimated",
  );
  assert.equal(
    getRoadFallbackState({ hasRoadData: false, hasWeatherEstimate: false }),
    "unavailable",
  );
});

test("stale weather display path has explicit freshness label", () => {
  assert.equal(getHomeCardStateLabel("stale"), "Stale");
});

test("current weather can render while slower sources are still loading", () => {
  assert.equal(
    canRenderCurrentWeatherIndependently({
      currentState: "fresh",
      hourlyState: "loading",
      alertsState: "loading",
      roadState: "loading",
    }),
    true,
  );
});
