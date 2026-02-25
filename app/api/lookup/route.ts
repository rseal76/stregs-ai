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

// ── Detect jurisdiction from address string ────────────────────────────────
// TODO: replace with real geocoding (Google Maps API) + PostGIS boundary lookup
function detectJurisdiction(address: string): string | null {
  const lower = address.toLowerCase();
  
  // Order matters — check more specific before generic
  if (lower.includes('commerce city')) return 'commerce city';
  if (lower.includes('arvada')) return 'arvada';
  if (lower.includes('lakewood')) return 'lakewood';
  if (lower.includes('westminster')) return 'westminster';
  if (lower.includes('littleton')) return 'littleton';
  if (lower.includes('aurora')) return 'aurora';
  if (lower.includes('englewood')) return 'englewood';
  if (lower.includes('thornton')) return 'thornton';
  if (lower.includes('brighton')) return 'brighton';
  if (lower.includes('denver') || lower.includes(', co 802') || lower.includes(', colorado')) return 'denver';
  
  // ZIP code detection for Denver metro
  const zipMatch = lower.match(/\b(802\d{2})\b/);
  if (zipMatch) {
    const zip = parseInt(zipMatch[1]);
    if ([80202, 80203, 80204, 80205, 80206, 80207, 80209, 80210, 80211, 80212, 80214, 80216, 80218, 80219, 80220, 80221, 80222, 80223, 80224, 80226, 80227, 80228, 80229, 80230, 80231, 80232, 80236, 80237, 80238, 80239, 80246, 80247, 80249, 80264].includes(zip)) return 'denver';
    if ([80002, 80003, 80004, 80005, 80007].includes(zip)) return 'arvada';
    if ([80214, 80215, 80226, 80227, 80228, 80232].includes(zip)) return 'lakewood';
    if ([80030, 80031, 80234].includes(zip)) return 'westminster';
    if ([80120, 80121, 80122, 80123, 80128, 80129].includes(zip)) return 'littleton';
    if ([80010, 80011, 80012, 80013, 80014, 80015, 80016, 80017, 80018, 80019].includes(zip)) return 'aurora';
    if ([80110, 80111, 80112, 80113].includes(zip)) return 'englewood';
    if ([80229, 80233, 80241, 80260].includes(zip)) return 'thornton';
    if ([80601, 80602, 80603].includes(zip)) return 'brighton';
    if ([80022, 80037, 80040].includes(zip)) return 'commerce city';
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

  const jurisdiction = detectJurisdiction(address);

  if (!jurisdiction) {
    return NextResponse.json({
      address,
      found: false,
      message: "This address is outside our current Phase 1 coverage area (Denver metro, Colorado). National expansion is in progress.",
    }, { status: 404 });
  }

  const data = REGULATIONS[jurisdiction];
  console.log(`[lookup] ${address} → ${jurisdiction}`);

  return NextResponse.json({ address, found: true, ...data });
}
