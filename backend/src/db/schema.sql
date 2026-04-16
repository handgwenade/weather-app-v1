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
INSERT OR REPLACE INTO route_segments (
  segment_id, route_name, direction, from_label, to_label, primary_station_id, district_id, notes
) VALUES
('i80-arlington-wagonhound-eb', 'I-80', 'EB', 'Arlington', 'Wagonhound', 'WY21', 'D1', 'High wind corridor'),
('i80-wagonhound-elk-mountain-eb', 'I-80', 'EB', 'Wagonhound', 'Elk Mountain', 'WY19', 'D1', 'High wind corridor'),
('i80-elk-mountain-foote-creek-eb', 'I-80', 'EB', 'Elk Mountain', 'Foote Creek', 'WY22', 'D1', 'High wind corridor'),
('i25-bordeaux-twenty-mile-hill-nb', 'I-25', 'NB', 'Bordeaux', 'Twenty Mile Hill', 'KTMH', 'D2', 'Wind exposure'),
('wy28-south-pass-red-canyon', 'WY-28', NULL, 'South Pass area', 'Lower Red Canyon', 'KREC', 'D5', 'Wind-prone');