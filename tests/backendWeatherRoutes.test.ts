import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";

process.env.TOMORROW_API_KEY = "test-key";
process.env.ROADSIGNAL_DB_PATH = path.join(
  tmpdir(),
  `roadsignal-weather-routes-${process.pid}.db`,
);

const originalFetch = globalThis.fetch;
let appModulePromise: Promise<typeof import("../backend/src/server")> | null =
  null;

async function getApp() {
  appModulePromise ??= import("../backend/src/server");
  const module = await appModulePromise;

  return module.app;
}

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
}

async function withServer<T>(callback: (baseUrl: string) => Promise<T>) {
  const app = await getApp();
  const server = await new Promise<Server>((resolve) => {
    const nextServer = app.listen(0, () => resolve(nextServer));
  });

  try {
    const address = server.address() as AddressInfo;
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

function installProviderFetchMock(
  handlers: ((url: string, init?: RequestInit) => Response | Promise<Response>)[],
) {
  const queue = [...handlers];

  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.startsWith("http://127.0.0.1:")) {
      return originalFetch(input, init);
    }

    const handler = queue.shift();

    if (!handler) {
      throw new Error(`Unexpected provider request: ${url}`);
    }

    return handler(url, init);
  };

  return () => queue.length;
}

function tomorrowHourlyPayload(intervals: unknown[]) {
  return {
    data: {
      timelines: [
        {
          timestep: "1h",
          intervals,
        },
      ],
    },
  };
}

function nwsPointsPayload() {
  return {
    properties: {
      forecastHourly:
        "https://api.weather.gov/gridpoints/CYS/39,49/forecast/hourly",
    },
  };
}

function nwsHourlyPayload() {
  return {
    properties: {
      periods: [
        {
          startTime: "2026-07-06T17:00:00-06:00",
          temperature: 91,
          temperatureUnit: "F",
          windSpeed: "10 to 15 mph",
          shortForecast: "Slight Chance T-storms",
          probabilityOfPrecipitation: {
            value: 30,
          },
        },
      ],
    },
  };
}

function nwsAlertsPayload() {
  return {
    features: [
      {
        id: "urn:oid:alert-1",
        properties: {
          event: "Severe Thunderstorm Warning",
          headline: "Severe thunderstorms are possible near Cheyenne.",
          areaDesc: "Laramie County",
          severity: "Severe",
          certainty: "Likely",
          ends: "2026-07-06T19:00:00-06:00",
        },
      },
    ],
  };
}

async function getJson(baseUrl: string, path: string) {
  const response = await originalFetch(`${baseUrl}${path}`);
  const payload = await response.json();

  return {
    status: response.status,
    payload,
  };
}

async function postJson(baseUrl: string, path: string, body?: unknown) {
  const response = await originalFetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();

  return {
    status: response.status,
    payload,
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.TOMORROW_API_KEY = "test-key";
});

test("hourly route uses Tomorrow when Tomorrow returns hourly entries", async () => {
  const remainingProviderCalls = installProviderFetchMock([
    (url) => {
      assert.match(url, /tomorrow\.io/);

      return jsonResponse(
        tomorrowHourlyPayload([
          {
            startTime: "2026-07-06T20:00:00Z",
            values: {
              temperature: 20,
              windSpeed: 4,
              windGust: 6,
              precipitationProbability: 0,
              weatherCode: 1000,
              precipitationType: 0,
            },
          },
        ]),
      );
    },
  ]);

  await withServer(async (baseUrl) => {
    const response = await getJson(
      baseUrl,
      "/api/weather/hourly?lat=41.14&lon=-104.82&debug=true",
    );

    assert.equal(response.status, 200);
    assert.equal(response.payload.debug.provider, "tomorrow");
    assert.equal(response.payload.hourlyForecast[0].temp, 68);
    assert.equal(response.payload.hourlyForecast[0].condition, null);
  });

  assert.equal(remainingProviderCalls(), 0);
});

test("hourly route falls back to NWS when Tomorrow returns no hourly entries", async () => {
  const remainingProviderCalls = installProviderFetchMock([
    (url) => {
      assert.match(url, /tomorrow\.io/);
      return jsonResponse(tomorrowHourlyPayload([]));
    },
    (url) => {
      assert.match(url, /api\.weather\.gov\/points/);
      return jsonResponse(nwsPointsPayload());
    },
    (url) => {
      assert.match(url, /api\.weather\.gov\/gridpoints/);
      return jsonResponse(nwsHourlyPayload());
    },
  ]);

  await withServer(async (baseUrl) => {
    const response = await getJson(
      baseUrl,
      "/api/weather/hourly?lat=41.14&lon=-104.82&debug=true",
    );

    assert.equal(response.status, 200);
    assert.equal(response.payload.debug.provider, "nws");
    assert.equal(response.payload.hourlyForecast[0].condition, "Slight Chance T-storms");
    assert.equal(response.payload.hourlyForecast[0].weatherCode, null);
    assert.equal(response.payload.hourlyForecast[0].temp, 91);
  });

  assert.equal(remainingProviderCalls(), 0);
});

test("hourly route falls back to NWS when Tomorrow is not configured", async () => {
  process.env.TOMORROW_API_KEY = "";
  const remainingProviderCalls = installProviderFetchMock([
    (url) => {
      assert.match(url, /api\.weather\.gov\/points/);
      return jsonResponse(nwsPointsPayload());
    },
    (url) => {
      assert.match(url, /api\.weather\.gov\/gridpoints/);
      return jsonResponse(nwsHourlyPayload());
    },
  ]);

  await withServer(async (baseUrl) => {
    const response = await getJson(
      baseUrl,
      "/api/weather/hourly?lat=41.14&lon=-104.82&debug=true",
    );

    assert.equal(response.status, 200);
    assert.equal(response.payload.debug.provider, "nws");
    assert.equal(response.payload.hourlyForecast[0].condition, "Slight Chance T-storms");
  });

  assert.equal(remainingProviderCalls(), 0);
});

test("hourly route returns an honest error when both providers fail", async () => {
  process.env.TOMORROW_API_KEY = "";
  const remainingProviderCalls = installProviderFetchMock([
    (url) => {
      assert.match(url, /api\.weather\.gov\/points/);
      return jsonResponse({ error: "nope" }, { status: 503 });
    },
  ]);

  await withServer(async (baseUrl) => {
    const response = await getJson(
      baseUrl,
      "/api/weather/hourly?lat=41.14&lon=-104.82&debug=true",
    );

    assert.equal(response.status, 502);
    assert.deepEqual(response.payload, {
      error: "Failed to fetch hourly forecast data",
    });
  });

  assert.equal(remainingProviderCalls(), 0);
});

test("combined current-hourly route derives current weather from NWS fallback without Tomorrow", async () => {
  process.env.TOMORROW_API_KEY = "";
  const remainingProviderCalls = installProviderFetchMock([
    (url) => {
      assert.match(url, /api\.weather\.gov\/points/);
      return jsonResponse(nwsPointsPayload());
    },
    (url) => {
      assert.match(url, /api\.weather\.gov\/gridpoints/);
      return jsonResponse(nwsHourlyPayload());
    },
  ]);

  await withServer(async (baseUrl) => {
    const response = await getJson(
      baseUrl,
      "/api/weather/current-hourly?lat=41.14&lon=-104.82&debug=true",
    );

    assert.equal(response.status, 200);
    assert.equal(response.payload.debug.provider, "nws");
    assert.equal(response.payload.currentWeather.currentTemp, 91);
    assert.equal(response.payload.currentWeather.condition, "Slight Chance T-storms");
    assert.equal(response.payload.hourlyForecast.hourlyForecast[0].weatherCode, null);
  });

  assert.equal(remainingProviderCalls(), 0);
});

test("notification registration is persisted and listed without exposing tokens", async () => {
  await withServer(async (baseUrl) => {
    const registration = await postJson(baseUrl, "/api/notifications/register", {
      expoPushToken: "ExponentPushToken[route-test-register]",
      platform: "ios",
      notificationTypes: ["official-alerts"],
      alertLocation: {
        name: "Cheyenne",
        latitude: 41.14,
        longitude: -104.82,
      },
    });
    const registrations = await getJson(
      baseUrl,
      "/api/notifications/registrations",
    );

    assert.equal(registration.status, 200);
    assert.deepEqual(registration.payload, { ok: true });
    assert.equal(registrations.status, 200);
    assert.equal(registrations.payload.count >= 1, true);
    assert.equal(
      registrations.payload.registrations.some(
        (item: {
          platform: string | null;
          notificationTypes: string[];
          alertLocation: { name: string | null } | null;
        }) =>
          item.platform === "ios" &&
          item.notificationTypes.includes("official-alerts") &&
          item.alertLocation?.name === "Cheyenne",
      ),
      true,
    );
    assert.equal(
      "expoPushToken" in registrations.payload.registrations[0],
      false,
    );
  });
});

test("test notification route sends to persisted push tokens", async () => {
  const remainingProviderCalls = installProviderFetchMock([
    async (url, init) => {
      assert.match(url, /exp\.host\/--\/api\/v2\/push\/send/);
      const messages = JSON.parse(String(init?.body)) as { to: string }[];

      assert.equal(
        messages.some(
          (message) =>
            message.to === "ExponentPushToken[route-test-persisted]",
        ),
        true,
      );

      return jsonResponse({ data: [{ status: "ok" }] });
    },
  ]);

  await withServer(async (baseUrl) => {
    await postJson(baseUrl, "/api/notifications/register", {
      expoPushToken: "ExponentPushToken[route-test-persisted]",
      platform: "ios",
      notificationTypes: ["official-alerts"],
    });
    const response = await postJson(baseUrl, "/api/notifications/test");

    assert.equal(response.status, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(response.payload.tokenCount >= 1, true);
  });

  assert.equal(remainingProviderCalls(), 0);
});

test("official alert check sends each new alert once per token", async () => {
  const remainingProviderCalls = installProviderFetchMock([
    (url) => {
      assert.match(url, /api\.weather\.gov\/alerts\/active/);
      return jsonResponse(nwsAlertsPayload());
    },
    async (url, init) => {
      assert.match(url, /exp\.host\/--\/api\/v2\/push\/send/);
      const messages = JSON.parse(String(init?.body)) as {
        title: string;
        data: { alertId: string };
      }[];

      assert.equal(
        messages.some(
          (message) =>
            message.title === "Severe Thunderstorm Warning" &&
            message.data.alertId === "urn:oid:alert-1",
        ),
        true,
      );

      return jsonResponse({ data: [{ status: "ok" }] });
    },
    (url) => {
      assert.match(url, /api\.weather\.gov\/alerts\/active/);
      return jsonResponse(nwsAlertsPayload());
    },
  ]);

  await withServer(async (baseUrl) => {
    await postJson(baseUrl, "/api/notifications/register", {
      expoPushToken: "ExponentPushToken[route-test-alert]",
      platform: "ios",
      notificationTypes: ["official-alerts"],
      alertLocation: {
        name: "Cheyenne",
        latitude: 41.14,
        longitude: -104.82,
      },
    });

    const firstCheck = await postJson(
      baseUrl,
      "/api/notifications/official-alerts/check",
    );
    const secondCheck = await postJson(
      baseUrl,
      "/api/notifications/official-alerts/check",
    );

    assert.equal(firstCheck.status, 200);
    assert.equal(firstCheck.payload.ok, true);
    assert.equal(firstCheck.payload.notificationCount >= 1, true);
    assert.equal(secondCheck.status, 200);
    assert.equal(secondCheck.payload.ok, true);
    assert.equal(secondCheck.payload.notificationCount, 0);
  });

  assert.equal(remainingProviderCalls(), 0);
});
