import { NextRequest, NextResponse } from 'next/server';

// ── Mock regulation data per jurisdiction ──────────────────────────────────
// TODO: replace with live Supabase + PostGIS query:
// 1. Geocode address → { lat, lng }
// 2. ST_Contains(boundary, ST_Point(lng, lat)) → jurisdiction
// 3. Return str_regulations row for that jurisdiction

const REGULATIONS: Record<string, object> = {
  denver: {
    jurisdiction: 'City of Denver',
    status: 'conditional',
    summary: "In Denver, STRs require a license. Your property must be your primary residence (183+ days/year). License fee: $25/year for owner-occupied, $100/year for hosted rentals. No nightly cap once licensed.",
    details: {
      permitRequired: true, permitFeeAnnual: 25, primaryResidenceRequired: true,
      ownerOccupiedRequired: false, maxDaysPerYear: null, licenseRequired: true,
      inspectionRequired: false, insuranceRequired: false, noiseOrdinanceApplicable: true,
      parkingRequirements: 'No requirements beyond standard Denver code.',
      occupancyLimits: 'Max 2 guests per bedroom.',
      enforcementBody: 'Denver Dept of Excise and Licenses',
      enforcementUrl: 'https://www.denvergov.org/Government/Departments/Excise-and-Licenses/Licenses-and-Permits/Short-Term-Rentals',
    },
    source: { url: 'https://www.denvergov.org/Government/Departments/Excise-and-Licenses/Licenses-and-Permits/Short-Term-Rentals', type: 'City Website', lastVerified: 'February 2026' },
    pending: null,
  },
  arvada: {
    jurisdiction: 'City of Arvada',
    status: 'conditional',
    summary: "Arvada requires a Short-Term Rental license. Jefferson County overlap may apply depending on your parcel. Primary residence is not required. Review your specific zoning district for additional restrictions.",
    details: {
      permitRequired: true, permitFeeAnnual: 150, primaryResidenceRequired: false,
      ownerOccupiedRequired: false, maxDaysPerYear: null, licenseRequired: true,
      inspectionRequired: false, insuranceRequired: false, noiseOrdinanceApplicable: true,
      parkingRequirements: 'Adequate off-street parking required per zoning district.',
      occupancyLimits: 'Per zoning code maximum occupancy.',
      enforcementBody: 'City of Arvada Community Development',
      enforcementUrl: 'https://www.arvada.org/business/business-licensing',
    },
    source: { url: 'https://www.arvada.org/business/business-licensing', type: 'City Website', lastVerified: 'February 2026' },
    pending: null,
  },
  lakewood: {
    jurisdiction: 'City of Lakewood',
    status: 'conditional',
    summary: "Lakewood requires a Short-Term Rental license. The property must be owner-occupied. Jefferson County regulations may apply to certain parcels. Annual license renewal required.",
    details: {
      permitRequired: true, permitFeeAnnual: 100, primaryResidenceRequired: true,
      ownerOccupiedRequired: true, maxDaysPerYear: null, licenseRequired: true,
      inspectionRequired: false, insuranceRequired: false, noiseOrdinanceApplicable: true,
      parkingRequirements: 'Standard Lakewood zoning requirements apply.',
      occupancyLimits: 'Max 2 adults per bedroom.',
      enforcementBody: 'City of Lakewood Community Resources',
      enforcementUrl: 'https://www.lakewood.org/Business/Permits-Licensing',
    },
    source: { url: 'https://www.lakewood.org/Business/Permits-Licensing', type: 'City Website', lastVerified: 'February 2026' },
    pending: null,
  },
  westminster: {
    jurisdiction: 'City of Westminster',
    status: 'conditional',
    summary: "Westminster straddles Adams and Jefferson counties — regulations vary by parcel. STR license required. Check your specific parcel to confirm which county overlay applies.",
    details: {
      permitRequired: true, permitFeeAnnual: 125, primaryResidenceRequired: false,
      ownerOccupiedRequired: false, maxDaysPerYear: null, licenseRequired: true,
      inspectionRequired: false, insuranceRequired: false, noiseOrdinanceApplicable: true,
      parkingRequirements: null, occupancyLimits: null,
      enforcementBody: 'City of Westminster Planning & Development',
      enforcementUrl: 'https://www.cityofwestminster.us/Business/PermitLicenses',
    },
    source: { url: 'https://www.cityofwestminster.us/Business/PermitLicenses', type: 'City Website', lastVerified: 'February 2026' },
    pending: null,
  },
  littleton: {
    jurisdiction: 'City of Littleton',
    status: 'conditional',
    summary: "Littleton sits at the intersection of Arapahoe, Jefferson, and Douglas counties — the most complex jurisdiction overlap in the Denver metro. STR license required. Verify which county regulations apply to your specific parcel.",
    details: {
      permitRequired: true, permitFeeAnnual: 110, primaryResidenceRequired: false,
      ownerOccupiedRequired: false, maxDaysPerYear: null, licenseRequired: true,
      inspectionRequired: true, insuranceRequired: false, noiseOrdinanceApplicable: true,
      parkingRequirements: null, occupancyLimits: null,
      enforcementBody: 'City of Littleton Community Development',
      enforcementUrl: 'https://www.littletongov.org/business/permits-licenses',
    },
    source: { url: 'https://www.littletongov.org/business/permits-licenses', type: 'City Website', lastVerified: 'February 2026' },
    pending: null,
  },
  aurora: {
    jurisdiction: 'City of Aurora',
    status: 'conditional',
    summary: "Aurora spans Arapahoe, Adams, and Douglas counties. STR license required city-wide. Specific requirements vary by zone. No primary residence requirement, but license must be renewed annually.",
    details: {
      permitRequired: true, permitFeeAnnual: 75, primaryResidenceRequired: false,
      ownerOccupiedRequired: false, maxDaysPerYear: null, licenseRequired: true,
      inspectionRequired: false, insuranceRequired: false, noiseOrdinanceApplicable: true,
      parkingRequirements: null, occupancyLimits: 'Max occupancy per fire code.',
      enforcementBody: 'City of Aurora Development Services',
      enforcementUrl: 'https://www.auroragov.org/business/permits-licenses',
    },
    source: { url: 'https://www.auroragov.org/business/permits-licenses', type: 'City Website', lastVerified: 'February 2026' },
    pending: null,
  },
  englewood: {
    jurisdiction: 'City of Englewood',
    status: 'conditional',
    summary: "Englewood (Arapahoe County) requires a Short-Term Rental license. Primary residence requirement applies. License fee is among the lowest in the metro area.",
    details: {
      permitRequired: true, permitFeeAnnual: 50, primaryResidenceRequired: true,
      ownerOccupiedRequired: false, maxDaysPerYear: null, licenseRequired: true,
      inspectionRequired: false, insuranceRequired: false, noiseOrdinanceApplicable: true,
      parkingRequirements: null, occupancyLimits: null,
      enforcementBody: 'City of Englewood Community Development',
      enforcementUrl: 'https://www.englewoodco.gov/business/permits-licensing',
    },
    source: { url: 'https://www.englewoodco.gov/business/permits-licensing', type: 'City Website', lastVerified: 'February 2026' },
    pending: null,
  },
  thornton: {
    jurisdiction: 'City of Thornton',
    status: 'conditional',
    summary: "Thornton (Adams County) requires a business license for STR operation. No primary residence requirement. Adams County regulations apply.",
    details: {
      permitRequired: true, permitFeeAnnual: 100, primaryResidenceRequired: false,
      ownerOccupiedRequired: false, maxDaysPerYear: null, licenseRequired: true,
      inspectionRequired: false, insuranceRequired: false, noiseOrdinanceApplicable: true,
      parkingRequirements: null, occupancyLimits: null,
      enforcementBody: 'City of Thornton Business Licensing',
      enforcementUrl: 'https://www.cityofthornton.net/business',
    },
    source: { url: 'https://www.cityofthornton.net/business', type: 'City Website', lastVerified: 'February 2026' },
    pending: null,
  },
  brighton: {
    jurisdiction: 'City of Brighton',
    status: 'allowed',
    summary: "Brighton (Adams County) generally permits short-term rentals. A standard business license is required. No specific STR ordinance as of early 2026 — verify current requirements with the city.",
    details: {
      permitRequired: true, permitFeeAnnual: 75, primaryResidenceRequired: false,
      ownerOccupiedRequired: false, maxDaysPerYear: null, licenseRequired: false,
      inspectionRequired: false, insuranceRequired: false, noiseOrdinanceApplicable: true,
      parkingRequirements: null, occupancyLimits: null,
      enforcementBody: 'City of Brighton',
      enforcementUrl: 'https://www.brightonco.gov/business',
    },
    source: { url: 'https://www.brightonco.gov/business', type: 'City Website', lastVerified: 'February 2026' },
    pending: null,
  },
  'adams county unincorporated': {
    jurisdiction: 'Adams County (Unincorporated)',
    status: 'conditional',
    summary: "This address is in unincorporated Adams County — NOT within any city limits. Denver, Arvada, or other city STR laws do NOT apply here. Adams County requires a Home Occupation permit for STR operation. No primary residence requirement. The county has fewer restrictions than Denver proper, but you must still obtain county approval.",
    details: {
      permitRequired: true, permitFeeAnnual: 100, primaryResidenceRequired: false,
      ownerOccupiedRequired: false, maxDaysPerYear: null, licenseRequired: true,
      inspectionRequired: false, insuranceRequired: false, noiseOrdinanceApplicable: true,
      parkingRequirements: 'Standard county requirements apply.',
      occupancyLimits: null,
      enforcementBody: 'Adams County Community & Economic Development',
      enforcementUrl: 'https://www.adcogov.org/community-economic-development',
    },
    source: { url: 'https://www.adcogov.org/community-economic-development', type: 'County Website', lastVerified: 'February 2026' },
    pending: null,
    splitJurisdiction: false,
  },
  // Split-jurisdiction placeholder — shown when a ZIP straddles city/county lines
  'split jurisdiction': {
    jurisdiction: 'Multiple Jurisdictions — Verify Your Parcel',
    status: 'conditional',
    summary: "⚠️ This address is in a ZIP code that straddles two or more jurisdictions. Some parcels here fall under city regulations; others are in unincorporated county land with different rules entirely. You must verify which jurisdiction applies to your specific parcel before assuming any set of regulations applies.",
    details: {
      permitRequired: null, permitFeeAnnual: null, primaryResidenceRequired: null,
      ownerOccupiedRequired: null, maxDaysPerYear: null, licenseRequired: null,
      inspectionRequired: null, insuranceRequired: null, noiseOrdinanceApplicable: null,
      parkingRequirements: null, occupancyLimits: null,
      enforcementBody: 'Check with your county assessor to confirm jurisdiction',
      enforcementUrl: 'https://www.adcogov.org/assessor',
    },
    source: { url: 'https://www.adcogov.org/assessor', type: 'County Website', lastVerified: 'February 2026' },
    pending: "Precise boundary data (PostGIS) coming soon — will auto-detect your jurisdiction from coordinates.",
    splitJurisdiction: true,
  },
  'commerce city': {
    jurisdiction: 'City of Commerce City',
    status: 'allowed',
    summary: "Commerce City (Adams County) permits short-term rentals with a standard business license. No specific STR cap or primary residence requirement as of early 2026.",
    details: {
      permitRequired: true, permitFeeAnnual: 60, primaryResidenceRequired: false,
      ownerOccupiedRequired: false, maxDaysPerYear: null, licenseRequired: false,
      inspectionRequired: false, insuranceRequired: false, noiseOrdinanceApplicable: true,
      parkingRequirements: null, occupancyLimits: null,
      enforcementBody: 'Commerce City Business Licensing',
      enforcementUrl: 'https://www.c3gov.com/business',
    },
    source: { url: 'https://www.c3gov.com/business', type: 'City Website', lastVerified: 'February 2026' },
    pending: null,
  },
};

// ── Known split-jurisdiction ZIP codes ────────────────────────────────────
// These ZIPs straddle city limits and unincorporated county land.
// We CANNOT reliably assign a single jurisdiction without PostGIS parcel data.
// Key example: 80221 covers both Denver and unincorporated Adams County —
// 7801 Zuni St (80221) looks like Denver but is actually Adams County unincorporated.
const SPLIT_ZIPS: Record<number, string> = {
  80221: 'Denver/unincorporated Adams County',   // ← Zuni St case
  80030: 'Westminster/unincorporated Adams County',
  80031: 'Westminster/Jefferson County',
  80234: 'Westminster/unincorporated Adams County',
  80229: 'Thornton/unincorporated Adams County',
  80003: 'Arvada/Westminster',
  80260: 'Thornton/unincorporated Adams County',
};

// ── Detect jurisdiction from address string ────────────────────────────────
// TODO: Replace with Google Maps Geocoding API → lat/lng →
//       Supabase PostGIS ST_Contains(boundary, ST_Point(lng, lat)) for precision.
//       String matching cannot handle parcel-level edge cases like Zuni St (80221).
function detectJurisdiction(address: string): string | null {
  const lower = address.toLowerCase();

  // Check for split ZIP first — these must be flagged before city-name matching
  const zipMatch = lower.match(/\b(80\d{3})\b/);
  if (zipMatch) {
    const zip = parseInt(zipMatch[1]);
    if (SPLIT_ZIPS[zip]) return 'split jurisdiction';
  }

  // City name matching — order matters (specific before generic)
  if (lower.includes('commerce city')) return 'commerce city';
  if (lower.includes('arvada')) return 'arvada';
  if (lower.includes('lakewood')) return 'lakewood';
  if (lower.includes('westminster')) return 'westminster';
  if (lower.includes('littleton')) return 'littleton';
  if (lower.includes('aurora')) return 'aurora';
  if (lower.includes('englewood')) return 'englewood';
  if (lower.includes('thornton')) return 'thornton';
  if (lower.includes('brighton')) return 'brighton';
  if (lower.includes('denver')) return 'denver';

  // ZIP-only fallback (non-split ZIPs)
  if (zipMatch) {
    const zip = parseInt(zipMatch[1]);
    if ([80202,80203,80204,80205,80206,80207,80209,80210,80211,80212,80216,80218,80219,80220,80222,80223,80224,80226,80227,80228,80230,80231,80232,80236,80237,80238,80239,80246,80247,80249,80264].includes(zip)) return 'denver';
    if ([80002,80004,80005,80007].includes(zip)) return 'arvada';
    if ([80214,80215].includes(zip)) return 'lakewood';
    if ([80120,80121,80122,80123,80128,80129].includes(zip)) return 'littleton';
    if ([80010,80011,80012,80013,80014,80015,80016,80017,80018,80019].includes(zip)) return 'aurora';
    if ([80110,80111,80112,80113].includes(zip)) return 'englewood';
    if ([80233,80241].includes(zip)) return 'thornton';
    if ([80601,80602,80603].includes(zip)) return 'brighton';
    if ([80022,80037,80040].includes(zip)) return 'commerce city';
  }

  return null;
}

// ── Census Geocoder — free, no API key, returns real jurisdiction ──────────
// Returns { county, city, lat, lng } or null if not found
async function geocodeWithCensus(address: string): Promise<{
  county: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
} | null> {
  try {
    // Parse address parts for Census API
    const parts = address.split(',').map(s => s.trim());
    const street = parts[0] || address;
    const cityState = parts[1] || '';
    const stateZip = parts[2] || parts[1] || '';
    const zipMatch = address.match(/\b(\d{5})\b/);
    const zip = zipMatch ? zipMatch[1] : '';

    const params = new URLSearchParams({
      street,
      benchmark: 'Public_AR_Current',
      vintage: 'Current_Current',
      format: 'json',
      layers: '86,61', // 86=Incorporated Places, 61=Counties
    });
    if (cityState.match(/[A-Z]{2}/i)) params.set('state', 'CO');
    if (zip) params.set('zip', zip);

    const url = `https://geocoding.geo.census.gov/geocoder/geographies/address?${params}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = await res.json();

    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;

    const counties = match.geographies?.['Counties'] || [];
    const places = match.geographies?.['Incorporated Places'] || [];

    return {
      county: counties[0]?.NAME?.replace(' County', '').toLowerCase() || null,
      city: places[0]?.NAME?.toLowerCase() || null, // null = unincorporated!
      lat: match.coordinates?.y || null,
      lng: match.coordinates?.x || null,
    };
  } catch {
    return null;
  }
}

// Map Census county/city names to our jurisdiction keys
function censusToJurisdiction(city: string | null, county: string | null): string | null {
  // If there's an incorporated city, use it
  if (city) {
    if (city.includes('commerce city')) return 'commerce city';
    if (city.includes('arvada')) return 'arvada';
    if (city.includes('lakewood')) return 'lakewood';
    if (city.includes('westminster')) return 'westminster';
    if (city.includes('littleton')) return 'littleton';
    if (city.includes('aurora')) return 'aurora';
    if (city.includes('englewood')) return 'englewood';
    if (city.includes('thornton')) return 'thornton';
    if (city.includes('brighton')) return 'brighton';
    if (city.includes('denver')) return 'denver';
  }

  // No incorporated place = unincorporated county land
  if (!city && county) {
    if (county.includes('adams')) return 'adams county unincorporated';
    if (county.includes('jefferson')) return 'jefferson county unincorporated';
    if (county.includes('arapahoe')) return 'arapahoe county unincorporated';
    if (county.includes('douglas')) return 'douglas county unincorporated';
  }

  return null;
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const address = body?.address as string | undefined;

  if (!address?.trim()) {
    return NextResponse.json({ error: 'address_required' }, { status: 400 });
  }

  // Step 1: Try Census Geocoder for real jurisdiction detection
  let jurisdiction: string | null = null;
  let geocodeResult = null;

  geocodeResult = await geocodeWithCensus(address);
  if (geocodeResult) {
    jurisdiction = censusToJurisdiction(geocodeResult.city, geocodeResult.county);
    console.log(`[lookup] Census geocode: city="${geocodeResult.city}" county="${geocodeResult.county}" → ${jurisdiction}`);
  }

  // Step 2: Fall back to string matching if Census geocoder fails
  if (!jurisdiction) {
    jurisdiction = detectJurisdiction(address);
    console.log(`[lookup] String fallback → ${jurisdiction}`);
  }

  if (!jurisdiction) {
    return NextResponse.json({
      address,
      found: false,
      message: "This address is outside our current Phase 1 coverage area (Denver metro, Colorado). National expansion is in progress.",
    }, { status: 404 });
  }

  const data = REGULATIONS[jurisdiction];
  if (!data) {
    return NextResponse.json({
      address,
      found: false,
      message: `${jurisdiction} regulations are coming soon. We're expanding coverage rapidly.`,
    }, { status: 404 });
  }

  console.log(`[lookup] ${address} → ${jurisdiction}`);
  return NextResponse.json({
    address,
    found: true,
    geocoded: geocodeResult ? { lat: geocodeResult.lat, lng: geocodeResult.lng } : null,
    ...data,
  });
}
