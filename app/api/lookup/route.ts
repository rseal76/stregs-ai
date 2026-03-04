import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

// ── Google Maps Geocoding → city + state ──────────────────────────────────
async function geocodeAddress(address: string): Promise<{
  city: string | null;
  county: string | null;
  state: string | null;
  stateCode: string | null;
  lat: number | null;
  lng: number | null;
} | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.length) return null;

    const result = data.results[0];
    const components = result.address_components as Array<{ long_name: string; short_name: string; types: string[] }>;

    const get = (type: string) => components.find(c => c.types.includes(type));

    const city =
      get('locality')?.long_name ||
      get('sublocality_level_1')?.long_name ||
      get('neighborhood')?.long_name ||
      null;

    const county = get('administrative_area_level_2')?.long_name?.replace(/ County$/i, '') || null;
    const state = get('administrative_area_level_1')?.long_name || null;
    const stateCode = get('administrative_area_level_1')?.short_name || null;
    const lat = result.geometry?.location?.lat ?? null;
    const lng = result.geometry?.location?.lng ?? null;

    return { city, county, state, stateCode, lat, lng };
  } catch {
    return null;
  }
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

  // Step 1: Geocode the address
  const geo = await geocodeAddress(address);
  if (!geo || !geo.stateCode) {
    return NextResponse.json({
      address,
      found: false,
      message: "We couldn't geocode that address. Try including the city and state.",
    }, { status: 404 });
  }

  console.log(`[lookup] Geocoded: city="${geo.city}" county="${geo.county}" state="${geo.stateCode}"`);

  // Step 2: Try to match city first, then county fallback
  let jurisdiction = null;
  let matchedBy = '';

  if (geo.city) {
    jurisdiction = await lookupJurisdiction(geo.city, geo.stateCode);
    if (jurisdiction) matchedBy = 'city';
  }

  if (!jurisdiction && geo.county) {
    // Try "X County" style name
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

  console.log(`[lookup] ${address} → ${jurisdiction.name}, ${jurisdiction.state} (matched by ${matchedBy})`);

  return NextResponse.json({
    address,
    found: true,
    jurisdiction: jurisdiction.name,
    jurisdictionType: jurisdiction.type,
    state: jurisdiction.state,
    geocoded: { lat: geo.lat, lng: geo.lng },

    // Status
    status: regs.allowed ?? 'unknown',
    regulationStatus: regs.status,
    pendingLegislation: regs.pending_legislation,
    effectiveDate: regs.effective_date,

    // Summary
    summary: regs.notes,

    // Details
    details: {
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
    },
  });
}
