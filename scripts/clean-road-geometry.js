const fs = require("fs");
const path = require("path");

const inputPath = path.join(
  __dirname,
  "..",
  "data",
  "wyoming-road-geometry.geojson",
);
const outputPath = path.join(
  __dirname,
  "..",
  "data",
  "road-geometry.cleaned.geojson",
);

const allowedRouteRefs = new Set(["I 25", "I 80", "I 90", "US 85"]);

function normalizeRouteRef(ref) {
  return ref.trim().replace(/\s+/g, " ");
}

function getRouteRefs(properties) {
  const rawRef = typeof properties.ref === "string" ? properties.ref : "";

  return rawRef
    .split(";")
    .map(normalizeRouteRef)
    .filter(Boolean)
    .filter((ref) => allowedRouteRefs.has(ref));
}

function getRouteCodes(routeRefs) {
  return routeRefs.map((ref) => ref.replace(/\s+/g, "-"));
}

function getOsmWayId(properties) {
  const rawId = typeof properties["@id"] === "string" ? properties["@id"] : "";

  return rawId.startsWith("way/") ? rawId.slice("way/".length) : rawId;
}

function cleanFeature(feature) {
  const properties = feature.properties ?? {};
  const routeRefs = getRouteRefs(properties);

  if (routeRefs.length === 0) {
    return null;
  }

  if (feature.geometry?.type !== "LineString") {
    return null;
  }

  return {
    type: "Feature",
    properties: {
      osmWayId: getOsmWayId(properties),
      routeRefs,
      routeCodes: getRouteCodes(routeRefs),
      highway: properties.highway ?? null,
      name: properties.name ?? null,
      oneway: properties.oneway === "yes",
      wydotMlNumber: properties.wydot_ml_number ?? null,
    },
    geometry: feature.geometry,
  };
}

function main() {
  const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const cleanedFeatures = source.features.map(cleanFeature).filter(Boolean);
  const output = {
    type: "FeatureCollection",
    generatedAt: new Date().toISOString(),
    source: {
      name: "OpenStreetMap via Overpass Turbo",
      timestamp: source.timestamp ?? null,
      copyright: source.generator
        ? "Data © OpenStreetMap contributors, ODbL"
        : "Data © OpenStreetMap contributors, ODbL",
      inputFile: path.basename(inputPath),
    },
    features: cleanedFeatures,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        inputFeatures: source.features.length,
        outputFeatures: cleanedFeatures.length,
        outputPath,
      },
      null,
      2,
    ),
  );
}

main();
