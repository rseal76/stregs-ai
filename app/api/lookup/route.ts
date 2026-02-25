import { NextRequest, NextResponse } from 'next/server';

// TODO: replace mock with real implementation:
// 1. Geocode address using Google Maps Geocoding API → { lat, lng }
// 2. Query Supabase with PostGIS: SELECT j.*, r.* FROM jurisdictions j
//    JOIN str_regulations r ON r.jurisdiction_id = j.id
//    WHERE ST_Contains(j.boundary, ST_SetSRID(ST_Point($lng, $lat), 4326))
// 3. Return structured result

const MOCK_RESULT = {
  jurisdiction: 'City of Denver',
  jurisdictionType: 'city',
  parentCounty: 'Denver County',
  status: 'conditional',
  summary:
    "In Denver, short-term rentals are permitted but require a license. Your property must be your primary residence (183+ days/year). Annual license fee: $25 for owner-occupied units. No cap on nights once licensed.",
  details: {
    allowed: 'conditional',
    permitRequired: true,
    permitFeeAnnual: 25,
    permitFeeOneTime: null,
    primaryResidenceRequired: true,
    ownerOccupiedRequired: false,
    maxDaysPerYear: null,
    permitCapCitywide: null,
    permitCapPerBlock: null,
    prohibitedZoneTypes: [],
    licenseRequired: true,
    inspectionRequired: false,
    insuranceRequired: false,
    noiseOrdinanceApplicable: true,
    parkingRequirements: 'No requirements beyond standard Denver code.',
    occupancyLimits: 'Maximum 2 guests per bedroom.',
    enforcementBody: 'Denver Department of Excise and Licenses',
    enforcementContact: null,
    enforcementUrl:
      'https://www.denvergov.org/Government/Departments/Excise-and-Licenses/Licenses-and-Permits/Short-Term-Rentals',
    notes:
      "Denver requires a Short-Term Rental license. The property must be your primary residence where you live more than 183 days per year. License fee is $25/year for owner-occupied, $100/year for hosted rentals. No limit on nights per year once licensed.",
    status: 'active',
    effectiveDate: null,
    pendingLegislation: null,
  },
  source: {
    url: 'https://www.denvergov.org/Government/Departments/Excise-and-Licenses/Licenses-and-Permits/Short-Term-Rentals',
    type: 'city_website',
    lastVerified: '2026-02-24',
    humanVerified: true,
  },
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const address = body?.address as string | undefined;

  if (!address?.trim()) {
    return NextResponse.json({ error: 'address_required' }, { status: 400 });
  }

  console.log(`[lookup] Address queried: ${address}`);

  // TODO: log to Supabase lookups table for analytics

  // Return mock Denver data for all addresses in Phase 1 scaffold
  return NextResponse.json({
    address,
    ...MOCK_RESULT,
  });
}
