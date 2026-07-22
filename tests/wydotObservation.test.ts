import assert from "node:assert/strict";
import test from "node:test";

import {
  parseWydotRouteSegments,
  parseWydotStationObservation,
} from "../services/wydot";
import {
  formatTemperatureValue,
} from "../utils/homeWeatherFormatting";

test("WYDOT station parsing drops implausible temperature readings", () => {
  const observation = parseWydotStationObservation(
    `
      <table>
        <tr><td>Air temperature</td><td>176&#176;F</td></tr>
        <tr><td>Surface temperature</td><td>64&#176;F</td></tr>
        <tr><td>Wind average</td><td>2 mph</td></tr>
      </table>
    `,
    "Wheatland",
  );

  assert.equal(observation.airTempF, null);
  assert.equal(observation.surfaceTempF, 64);
  assert.equal(observation.windAvgMph, 2);
});

test("WYDOT route parsing accepts attributes added to the conditions header", () => {
  const segments = parseWydotRouteSegments(`
    <h1>Travel information for <u>Interstate 25</u> is as follows:</h1>
    <table class="grid">
      <thead>
        <tr>
          <th class="title" colspan="8" scope="colgroup">Conditions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="town" rowspan="1">Wheatland<br>NWS Forecast</td>
          <td class="closurelocation">Between Exit 73, WY 34 and Wheatland</td>
          <td class="lowimpactcond">Dry</td>
          <td class="noimpact">None</td>
          <td class="noimpactrestrict">None</td>
          <td class="rpttime">Jul 22, 2026, 03:01 PM</td>
          <td class="cameras">
            <a href="/highway/webcameras/view?site=I25Bordeaux&amp;popUp=true">Camera</a>
          </td>
          <td class="sensors">
            <a href="Sensors.StationResults?SelectedStation=Bordeaux">Sensor</a>
          </td>
        </tr>
      </tbody>
    </table>
  `);

  assert.equal(segments.length, 1);
  assert.equal(segments[0].routeCode, "I25");
  assert.equal(segments[0].townGroup, "Wheatland");
  assert.equal(segments[0].officialCondition, "Dry");
  assert.deepEqual(segments[0].sensorStationNames, ["Bordeaux"]);
});

test("home temperature formatting hides implausible Fahrenheit values", () => {
  assert.equal(formatTemperatureValue(176), "--");
  assert.equal(formatTemperatureValue(64), "64°F");
});
