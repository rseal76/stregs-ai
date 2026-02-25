-- STRegs.ai Initial Schema
-- Requires PostGIS extension for geographic boundary queries

-- Enable PostGIS for point-in-polygon jurisdiction lookups
CREATE EXTENSION IF NOT EXISTS postgis;

-- -------------------------------------------------------
-- JURISDICTIONS
-- Stores boundary polygons for each city/county/municipality
-- Used for: given lat/lng -> which jurisdiction applies?
-- -------------------------------------------------------
CREATE TABLE jurisdictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('city', 'county', 'municipality')),
  state           TEXT NOT NULL DEFAULT 'CO',
  parent_county   TEXT,                                      -- e.g. "Jefferson County" for Arvada
  boundary        geometry(MultiPolygon, 4326),              -- WGS84 geographic coordinates
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Spatial index — critical for fast point-in-polygon queries
CREATE INDEX jurisdictions_boundary_gist ON jurisdictions USING GIST (boundary);
CREATE INDEX jurisdictions_name_idx ON jurisdictions (name);

-- -------------------------------------------------------
-- STR REGULATIONS
-- One row per jurisdiction, all regulatory fields
-- -------------------------------------------------------
CREATE TABLE str_regulations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id             UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,

  -- Core status
  allowed                     TEXT CHECK (allowed IN ('yes', 'no', 'conditional')),
  status                      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'pending_change', 'moratorium', 'banned')),
  effective_date              DATE,
  pending_legislation         TEXT,  -- description of any known pending changes

  -- Permit & licensing
  permit_required             BOOLEAN,
  permit_fee_annual           NUMERIC,    -- in USD
  permit_fee_one_time         NUMERIC,
  license_required            BOOLEAN,
  inspection_required         BOOLEAN,
  insurance_required          BOOLEAN,

  -- Residency requirements
  primary_residence_required  BOOLEAN,
  owner_occupied_required     BOOLEAN,

  -- Caps & limits
  max_days_per_year           INTEGER,
  permit_cap_citywide         INTEGER,
  permit_cap_per_block        INTEGER,

  -- Zone restrictions
  prohibited_zone_types       TEXT[],    -- e.g. {'R1 single family', 'HOA overlay zones'}

  -- Other requirements
  noise_ordinance_applicable  BOOLEAN,
  parking_requirements        TEXT,
  occupancy_limits            TEXT,

  -- Enforcement
  enforcement_body            TEXT,
  enforcement_contact         TEXT,
  enforcement_url             TEXT,

  -- Plain English summary (the thing users actually read)
  notes                       TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (jurisdiction_id)  -- one regulation record per jurisdiction
);

-- -------------------------------------------------------
-- REGULATION SOURCES
-- Tracks where data came from and when it was last verified
-- Used for: change detection, source citations, trust signals
-- -------------------------------------------------------
CREATE TABLE regulation_sources (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id       UUID NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
  primary_source_url    TEXT NOT NULL,
  source_type           TEXT CHECK (source_type IN (
                          'municode', 'american_legal', 'general_code',
                          'qcode', 'ecode360', 'city_website', 'county_website'
                        )),
  ordinance_number      TEXT,
  last_scraped          TIMESTAMPTZ,
  last_verified         TIMESTAMPTZ,
  last_changed          TIMESTAMPTZ,
  raw_text_hash         TEXT,    -- SHA-256 of raw ordinance text; compare to detect changes
  raw_text              TEXT,    -- Full scraped ordinance text for re-parsing
  human_verified        BOOLEAN NOT NULL DEFAULT false,
  human_verified_date   DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- LOOKUPS
-- Every address query logged for analytics and product insights
-- -------------------------------------------------------
CREATE TABLE lookups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_input   TEXT NOT NULL,
  lat             NUMERIC,
  lng             NUMERIC,
  jurisdiction_id UUID REFERENCES jurisdictions(id),
  user_id         UUID,   -- null for anonymous lookups
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lookups_created_at_idx ON lookups (created_at DESC);
CREATE INDEX lookups_jurisdiction_idx ON lookups (jurisdiction_id);
