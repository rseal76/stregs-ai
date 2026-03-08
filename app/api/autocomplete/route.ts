import { NextRequest, NextResponse } from 'next/server';

/**
 * Address autocomplete — fast, national, no API key required.
 *
 * Strategy:
 *  1. Nominatim with no state bias, US-only, 5-result limit
 *  2. 300s cache on server (Nominatim results are stable enough)
 *  3. Parallel requests not needed — single clean request
 *
 * Format returned: "123 Main St, Denver, CO 80203"
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 3) return NextResponse.json([]);

  try {
    const url = `https://nominatim.openstreetmap.org/search?` +
      new URLSearchParams({
        q: `${q}, USA`,
        format: 'json',
        limit: '6',
        countrycodes: 'us',
        addressdetails: '1',
        featuretype: 'house',
      });

    const res = await fetch(url, {
      headers: { 'User-Agent': 'STRegs.ai/1.0 (contact: operations@chromahomedesigns.com)' },
      next: { revalidate: 300 }, // 5-min cache — stable results, reduces Nominatim load
    });

    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();

    // Extract house number typed by user — fallback for Nominatim gaps
    const houseMatch = q.match(/^(\d+)\s+/);
    const inputHouseNum = houseMatch?.[1] ?? null;

    const STATE_ABBR: Record<string, string> = {
      Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',
      Connecticut:'CT',Delaware:'DE','District of Columbia':'DC',Florida:'FL',Georgia:'GA',
      Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',
      Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',
      Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH',
      'New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',
      Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC',
      'South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',
      Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY',
      'Puerto Rico':'PR',
    };

    interface NominatimResult {
      address?: {
        house_number?: string;
        road?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        postcode?: string;
        state?: string;
      };
    }

    const suggestions = (data as NominatimResult[])
      .map((r) => {
        const a = r.address ?? {};
        const houseNum = a.house_number ?? inputHouseNum ?? '';
        const street = a.road ?? '';
        const city = a.city ?? a.town ?? a.village ?? '';
        const stateAbbr = a.state ? (STATE_ABBR[a.state] ?? a.state) : '';
        const zip = a.postcode ?? '';

        if (!street || !city || !stateAbbr) return null;

        const streetLine = houseNum ? `${houseNum} ${street}` : street;
        const parts = [streetLine, city, zip ? `${stateAbbr} ${zip}` : stateAbbr];
        return parts.filter(Boolean).join(', ');
      })
      .filter((s): s is string => !!s && s.length > 0)
      .filter((s, i, arr) => arr.indexOf(s) === i); // dedupe

    return NextResponse.json(suggestions);
  } catch {
    return NextResponse.json([]);
  }
}
