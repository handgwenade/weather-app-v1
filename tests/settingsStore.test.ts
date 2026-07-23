import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSettingsState } from "../data/settingsStore";

test("settings state normalizes persisted values", () => {
  assert.deepEqual(
    normalizeSettingsState({
      defaultView: "road",
      autoRefreshData: false,
    }),
    {
      defaultView: "road",
      autoRefreshData: false,
    },
  );
});

test("settings state falls back when persisted values are invalid", () => {
  assert.deepEqual(
    normalizeSettingsState({
      defaultView: "map" as never,
      autoRefreshData: "yes" as never,
    }),
    {
      defaultView: "home",
      autoRefreshData: true,
    },
  );
});
