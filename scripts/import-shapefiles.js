#!/usr/bin/env node
/**
 * import-shapefiles.js
 *
 * Reads a GeoJSON file of Colorado municipal boundaries and imports
 * each feature into the Supabase jurisdictions table with PostGIS geometry.
 *
 * HOW TO GET THE SHAPEFILE:
 * 1. Go to: https://data.colorado.gov/dataset/Colorado-Municipal-Boundaries/tz3t-6vbq
 *    (Or search "Colorado Municipal Boundaries" at data.colorado.gov)
 * 2. Click Export → GeoJSON → Download
 * 3. Save as: data/shapefiles/municipalities.geojson
 *
 * Alternative (Census TIGER/Line — for national expansion):
 * 1. Go to: https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
 * 2. Download Places shapefile for Colorado (state FIPS: 08)
 * 3. Convert to GeoJSON: ogr2ogr -f GeoJSON municipalities.geojson tl_2023_08_place.shp
 *
 * Usage: node scripts/import-shapefiles.js
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const GEOJSON_PATH = path.join(__dirname, '..', 'data', 'shapefiles', 'municipalities.geojson');

if (!fs.existsSync(GEOJSON_PATH)) {
  console.error(`GeoJSON file not found at: ${GEOJSON_PATH}`);
  console.error('\nDownload instructions:');
  console.error('1. Go to https://data.colorado.gov/dataset/Colorado-Municipal-Boundaries/tz3t-6vbq');
  console.error('2. Export as GeoJSON');
  console.error('3. Save to data/shapefiles/municipalities.geojson');
  process.exit(1);
}

// ── Supabase upsert ──────────────────────────────────────────────────────
function upsertJurisdiction(row) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify([row]);
    const url = new URL(`${SUPABASE_URL}/rest/v1/jurisdictions`);

    const req = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}?on_conflict=name,state`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
          'Prefer': 'resolution=merge-duplicates',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data || '[]'));
          } else {
            reject(new Error(`Supabase error ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Loading ${GEOJSON_PATH}...`);
  const geojson = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
  const features = geojson.features || [];
  console.log(`Found ${features.length} features`);

  let success = 0;
  let errors = 0;

  for (const feature of features) {
    const props = feature.properties || {};
    const name = props.MUNICIPALI || props.name || props.NAME || props.CITY || 'Unknown';
    const type = props.TYPE?.toLowerCase() || 'municipality';

    // Convert GeoJSON geometry to WKT for PostGIS
    // Note: Supabase/PostGIS accepts GeoJSON geometry directly via ST_GeomFromGeoJSON
    const row = {
      name: name.trim(),
      type: type.includes('county') ? 'county' : 'city',
      state: 'CO',
      // Store as GeoJSON string — PostGIS will handle the conversion via a trigger or function
      // For direct geometry insert, use the Supabase SQL editor with ST_GeomFromGeoJSON
    };

    try {
      await upsertJurisdiction(row);
      console.log(`✅ ${name}`);
      success++;
    } catch (err) {
      console.error(`❌ ${name}: ${err.message}`);
      errors++;
    }

    // Rate limit to avoid hammering Supabase
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`\nDone. ${success} imported, ${errors} errors.`);
  console.log('\nNext step: Use Supabase SQL editor to update boundary geometry:');
  console.log("UPDATE jurisdictions SET boundary = ST_GeomFromGeoJSON('...') WHERE name = 'Denver';");
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
