import { NextResponse } from 'next/server';

// Phase 1: 10 Denver metro jurisdictions
// Status reflects current STR regulatory posture as of Feb 2026
// TODO: replace with live Supabase query when data pipeline is built

const JURISDICTIONS = [
  {
    name: 'Denver',
    type: 'city',
    county: 'Denver County',
    status: 'conditional',
    summary: 'License required. Primary residence only.',
    complexity: 'medium',
  },
  {
    name: 'Arvada',
    type: 'city',
    county: 'Jefferson County',
    status: 'conditional',
    summary: 'License required. Jefferson County overlap adds complexity.',
    complexity: 'high',
  },
  {
    name: 'Lakewood',
    type: 'city',
    county: 'Jefferson County',
    status: 'conditional',
    summary: 'Owner-occupant license required.',
    complexity: 'medium',
  },
  {
    name: 'Westminster',
    type: 'city',
    county: 'Adams/Jefferson County split',
    status: 'conditional',
    summary: 'Split county jurisdiction — regulations vary by parcel.',
    complexity: 'high',
  },
  {
    name: 'Littleton',
    type: 'city',
    county: 'Arapahoe/Jefferson/Douglas County split',
    status: 'conditional',
    summary: 'Three-county overlap — most complex in metro.',
    complexity: 'high',
  },
  {
    name: 'Brighton',
    type: 'city',
    county: 'Adams County',
    status: 'allowed',
    summary: 'Generally permitted. Verify current requirements.',
    complexity: 'low',
  },
  {
    name: 'Thornton',
    type: 'city',
    county: 'Adams County',
    status: 'conditional',
    summary: 'License required. Adams County regulations apply.',
    complexity: 'medium',
  },
  {
    name: 'Aurora',
    type: 'city',
    county: 'Arapahoe/Adams/Douglas County split',
    status: 'conditional',
    summary: 'Three-county split. License required in most zones.',
    complexity: 'high',
  },
  {
    name: 'Englewood',
    type: 'city',
    county: 'Arapahoe County',
    status: 'conditional',
    summary: 'License and primary residence requirement.',
    complexity: 'medium',
  },
  {
    name: 'Commerce City',
    type: 'city',
    county: 'Adams County',
    status: 'allowed',
    summary: 'Permitted with standard business license.',
    complexity: 'low',
  },
];

export async function GET() {
  return NextResponse.json({
    jurisdictions: JURISDICTIONS,
    count: JURISDICTIONS.length,
    lastUpdated: '2026-02-24',
    phase: 'Denver Metro Phase 1',
  });
}
