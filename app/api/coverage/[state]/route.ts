import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STATE_NAMES: Record<string, string> = {
  'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California',
  'CO':'Colorado','CT':'Connecticut','DE':'Delaware','FL':'Florida','GA':'Georgia',
  'HI':'Hawaii','ID':'Idaho','IL':'Illinois','IN':'Indiana','IA':'Iowa','KS':'Kansas',
  'KY':'Kentucky','LA':'Louisiana','ME':'Maine','MD':'Maryland','MA':'Massachusetts',
  'MI':'Michigan','MN':'Minnesota','MS':'Mississippi','MO':'Missouri','MT':'Montana',
  'NE':'Nebraska','NV':'Nevada','NH':'New Hampshire','NJ':'New Jersey','NM':'New Mexico',
  'NY':'New York','NC':'North Carolina','ND':'North Dakota','OH':'Ohio','OK':'Oklahoma',
  'OR':'Oregon','PA':'Pennsylvania','RI':'Rhode Island','SC':'South Carolina',
  'SD':'South Dakota','TN':'Tennessee','TX':'Texas','UT':'Utah','VT':'Vermont',
  'VA':'Virginia','WA':'Washington','WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming',
  'DC':'District of Columbia',
};

/** Derive a county name from a jurisdiction. Returns null if not determinable. */
function deriveCounty(name: string, type: string, parentCounty: string | null): string | null {
  // If parent_county is set, use first county listed (handles "Adams/Jefferson County" → "Adams")
  if (parentCounty) {
    // Take only the first county if multiple are listed with "/"
    const first = parentCounty.split('/')[0].trim();
    // Strip " County" suffix
    return first.replace(/\s*County$/i, '').trim();
  }

  // For county-type jurisdictions, the name IS the county
  if (type === 'county') {
    return name.replace(/\s*County$/i, '').trim();
  }

  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ state: string }> }
) {
  const { state } = await params;
  const stateCode = state.toUpperCase();
  const stateName = STATE_NAMES[stateCode] || stateCode;

  const url = `${SUPABASE_URL}/rest/v1/jurisdictions?select=name,state,type,parent_county&state=eq.${stateCode}&limit=2000`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }

  const jurisdictions: Array<{
    name: string;
    state: string;
    type: string;
    parent_county: string | null;
  }> = await res.json();

  const markets = jurisdictions.map(j => ({
    name: j.name,
    type: j.type,
    county: deriveCounty(j.name, j.type, j.parent_county),
    parentCounty: j.parent_county,
  }));

  return NextResponse.json({
    state: stateCode,
    stateName,
    markets,
    totalMarkets: markets.length,
  });
}
