import { NextRequest, NextResponse } from 'next/server';
import { getUserTierFromToken } from '@/lib/supabase-server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// US state name → abbreviation map
const STATE_ABBR: Record<string, string> = {
  'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA',
  'colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA',
  'hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS',
  'kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA',
  'michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT',
  'nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM',
  'new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK',
  'oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC',
  'south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT',
  'virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY',
  'district of columbia':'DC','puerto rico':'PR','virgin islands':'VI',
};

// ── Census Geocoder → city + state (free, no key needed) ─────────────────
async function geocodeAddress(address: string): Promise<{
  city: string | null;
  county: string | null;
  state: string | null;
  stateCode: string | null;
  lat: number | null;
  lng: number | null;
} | null> {
  try {
    const params = new URLSearchParams({
      address,
      benchmark: 'Public_AR_Current',
      vintage: 'Current_Current',
      format: 'json',
      layers: '86,61', // 86=Incorporated Places, 61=Counties
    });

    const url = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?${params}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();

    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;

    const counties = match.geographies?.['Counties'] || [];
    const places = match.geographies?.['Incorporated Places'] || [];
    const states = match.geographies?.['States'] || [];

    const city = places[0]?.NAME || null;
    const county = counties[0]?.NAME?.replace(/ County$/i, '') || null;
    const stateName = states[0]?.NAME?.toLowerCase() || null;
    const stateCode = stateName ? (STATE_ABBR[stateName] || null) : null;
    const lat = match.coordinates?.y || null;
    const lng = match.coordinates?.x || null;

    const addrStateMatch = address.match(/,\s*([A-Z]{2})\s*(\d{5})?$/);
    const fallbackState = addrStateMatch?.[1] || null;

    return {
      city,
      county,
      state: stateName,
      stateCode: stateCode || fallbackState,
      lat,
      lng,
    };
  } catch {
    return null;
  }
}

// ── String-based state extraction (fallback for Census miss) ─────────────
function extractStateFromAddress(address: string): string | null {
  const m = address.match(/,\s*([A-Z]{2})\s*(?:\d{5})?(?:\s*,.*)?$/);
  return m?.[1] || null;
}

// ── Extract city from address string ─────────────────────────────────────
function extractCityFromAddress(address: string): string | null {
  const parts = address.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    const cityPart = parts[parts.length - 2];
    return cityPart.replace(/\s*\d{5}.*$/, '').trim() || null;
  }
  return null;
}

// ── Normalize Census city names ───────────────────────────────────────────
function normalizeCityName(raw: string): string[] {
  const cleaned = raw
    .replace(/\s*\(balance\)/i, '')
    .replace(/\s*\(pt\.\)/i, '')
    .replace(/\s*metropolitan government/i, '')
    .replace(/\s*consolidated government/i, '')
    .replace(/\s*unified government/i, '')
    .replace(/\s*city and county/i, '')
    .trim();

  const candidates = [cleaned];

  if (cleaned.includes('-')) {
    candidates.push(cleaned.split('-')[0].trim());
  }

  if (cleaned.includes(' ')) {
    candidates.push(cleaned.split(' ')[0].trim());
  }

  return [...new Set(candidates)];
}

// ── Supabase jurisdiction lookup ──────────────────────────────────────────
async function lookupJurisdiction(name: string, stateCode: string) {
  const encoded = encodeURIComponent(name);
  const url = `${SUPABASE_URL}/rest/v1/jurisdictions?name=ilike.${encoded}&state=eq.${stateCode}&select=id,name,type,state,parent_county&limit=1`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    next: { revalidate: 3600 },
  });

  const rows = await res.json();
  return rows?.[0] ?? null;
}

async function lookupRegulations(jurisdictionId: string) {
  const url = `${SUPABASE_URL}/rest/v1/str_regulations?jurisdiction_id=eq.${jurisdictionId}&select=*&limit=1`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    next: { revalidate: 3600 },
  });

  const rows = await res.json();
  return rows?.[0] ?? null;
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const address = body?.address as string | undefined;

  if (!address?.trim()) {
    return NextResponse.json({ error: 'address_required' }, { status: 400 });
  }

  // ── Determine user tier (server-side) ──────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const tier = await getUserTierFromToken(token);
  const isPaid = tier === 'standard' || tier === 'pro';

  // Step 1: Geocode the address
  let geo = await geocodeAddress(address);

  if (!geo || !geo.stateCode) {
    const stateCode = extractStateFromAddress(address) || (geo?.stateCode ?? null);
    const city = geo?.city || extractCityFromAddress(address);
    if (stateCode) {
      geo = { city, county: geo?.county || null, state: null, stateCode, lat: null, lng: null };
    }
  }

  if (!geo?.stateCode) {
    return NextResponse.json({
      address,
      found: false,
      message: "We couldn't identify the city and state for that address. Try formatting it as: 123 Main St, City, ST",
    }, { status: 404 });
  }

  console.log(`[lookup] Geocoded: city="${geo.city}" county="${geo.county}" state="${geo.stateCode}" tier="${tier}"`);

  // Step 2: Try to match city first, then county fallback
  let jurisdiction = null;
  let matchedBy = '';

  if (geo.city) {
    const cityCandidates = normalizeCityName(geo.city);
    for (const candidate of cityCandidates) {
      jurisdiction = await lookupJurisdiction(candidate, geo.stateCode);
      if (jurisdiction) { matchedBy = 'city'; break; }
    }
  }

  if (!jurisdiction && geo.county) {
    jurisdiction = await lookupJurisdiction(`${geo.county} County`, geo.stateCode);
    if (!jurisdiction) jurisdiction = await lookupJurisdiction(geo.county, geo.stateCode);
    if (jurisdiction) matchedBy = 'county';
  }

  if (!jurisdiction) {
    return NextResponse.json({
      address,
      found: false,
      geocoded: { city: geo.city, county: geo.county, state: geo.state, lat: geo.lat, lng: geo.lng },
      message: `We don't have STR regulations on file for ${geo.city || geo.county || geo.state} yet. We're expanding coverage constantly — check back soon.`,
    }, { status: 404 });
  }

  // Step 3: Get regulations for this jurisdiction
  const regs = await lookupRegulations(jurisdiction.id);

  if (!regs) {
    return NextResponse.json({
      address,
      found: false,
      geocoded: { lat: geo.lat, lng: geo.lng },
      message: `We found ${jurisdiction.name}, ${jurisdiction.state} in our database but don't have regulation details yet.`,
    }, { status: 404 });
  }

  console.log(`[lookup] ${address} → ${jurisdiction.name}, ${jurisdiction.state} (by ${matchedBy}, tier=${tier})`);

  // ── Build response with tier-based gating ─────────────────────────────
  // Free tier: only verdict + permitRequired + primaryResidenceRequired
  // Standard/Pro: full details

  const baseResponse = {
    address,
    found: true,
    tier,
    jurisdiction: jurisdiction.name,
    jurisdictionType: jurisdiction.type,
    state: jurisdiction.state,
    geocoded: { lat: geo.lat, lng: geo.lng },

    // Always available
    status: regs.allowed ?? 'unknown',
    regulationStatus: regs.status,
    pendingLegislation: isPaid ? regs.pending_legislation : null,
    effectiveDate: isPaid ? regs.effective_date : null,

    // Summary — available to all
    summary: regs.notes,

    // Details — free gets only these two; paid gets everything
    details: isPaid
      ? {
          permitRequired: regs.permit_required,
          permitFeeAnnual: regs.permit_fee_annual,
          permitFeeOneTime: regs.permit_fee_one_time,
          licenseRequired: regs.license_required,
          inspectionRequired: regs.inspection_required,
          insuranceRequired: regs.insurance_required,
          primaryResidenceRequired: regs.primary_residence_required,
          ownerOccupiedRequired: regs.owner_occupied_required,
          maxDaysPerYear: regs.max_days_per_year,
          permitCapCitywide: regs.permit_cap_citywide,
          permitCapPerBlock: regs.permit_cap_per_block,
          prohibitedZoneTypes: regs.prohibited_zone_types,
          noiseOrdinanceApplicable: regs.noise_ordinance_applicable,
          parkingRequirements: regs.parking_requirements,
          occupancyLimits: regs.occupancy_limits,
          enforcementBody: regs.enforcement_body,
          enforcementUrl: regs.enforcement_url,
          permitApplicationUrl: regs.permit_application_url ?? null,
        }
      : {
          // Free tier — only the basics
          permitRequired: regs.permit_required,
          primaryResidenceRequired: regs.primary_residence_required,
          // Everything else is null/hidden
          permitFeeAnnual: null,
          permitFeeOneTime: null,
          licenseRequired: null,
          inspectionRequired: null,
          insuranceRequired: null,
          ownerOccupiedRequired: null,
          maxDaysPerYear: null,
          permitCapCitywide: null,
          permitCapPerBlock: null,
          prohibitedZoneTypes: null,
          noiseOrdinanceApplicable: null,
          parkingRequirements: null,
          occupancyLimits: null,
          enforcementBody: null,
          enforcementUrl: null,
          permitApplicationUrl: null,
        },
  };

  return NextResponse.json(baseResponse);
}
