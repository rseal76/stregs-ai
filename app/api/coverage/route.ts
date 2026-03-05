import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// State name → abbreviation
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

export async function GET() {
  // Fetch all jurisdictions joined with their regulation status
  const url = `${SUPABASE_URL}/rest/v1/jurisdictions?select=name,state,type,str_regulations(allowed)&limit=2000`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    next: { revalidate: 300 }, // cache 5 min
  });

  const jurisdictions = await res.json();

  // Group by state
  const byState: Record<string, {
    total: number;
    allowed: number;
    conditional: number;
    banned: number;
    markets: string[];
  }> = {};

  for (const j of jurisdictions) {
    const state = j.state;
    if (!state || state.length !== 2) continue;

    if (!byState[state]) {
      byState[state] = { total: 0, allowed: 0, conditional: 0, banned: 0, markets: [] };
    }

    const s = byState[state];
    s.total++;
    s.markets.push(j.name);

    const allowed = j.str_regulations?.[0]?.allowed;
    if (allowed === 'yes') s.allowed++;
    else if (allowed === 'no') s.banned++;
    else s.conditional++;
  }

  // Build array with state names
  const states = Object.entries(byState).map(([code, data]) => ({
    code,
    name: STATE_NAMES[code] || code,
    ...data,
    markets: data.markets.sort(),
  }));

  const totalMarkets = states.reduce((sum, s) => sum + s.total, 0);

  return NextResponse.json({ states, totalMarkets });
}
