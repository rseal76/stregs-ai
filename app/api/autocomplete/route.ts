import { NextRequest, NextResponse } from 'next/server';

// Free address autocomplete via Nominatim (OpenStreetMap)
// No API key required. Rate limit: 1 req/sec (handled by debounce on frontend)
// TODO: swap for Google Places Autocomplete API when key is available —
// better results, especially for partial street addresses

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  if (!q || q.length < 4) return NextResponse.json([]);

  try {
    const query = encodeURIComponent(`${q}, Colorado, USA`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5&countrycodes=us&addressdetails=1`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'STRegs.ai/1.0 (address-lookup)' },
      next: { revalidate: 60 },
    });

    const data = await res.json();

    // Extract house number from user's query (e.g. "7801" from "7801 zuni st")
    const houseNumberMatch = q.trim().match(/^(\d+)\s+/);
    const inputHouseNumber = houseNumberMatch ? houseNumberMatch[1] : null;

    const suggestions = data
      .filter((r: { address?: { state?: string } }) => r.address?.state === 'Colorado')
      .map((r: { display_name?: string; address?: { house_number?: string; road?: string; city?: string; town?: string; village?: string; county?: string; postcode?: string; state?: string } }) => {
        const a = r.address || {};
        // Use house number from Nominatim if available, otherwise use the one from user input
        const houseNum = a.house_number || inputHouseNumber || '';
        const street = a.road || '';
        const streetWithNum = houseNum && street ? `${houseNum} ${street}` : (street || '');
        const city = a.city || a.town || a.village || '';
        const parts = [streetWithNum, city, a.state, a.postcode].filter(Boolean);
        return parts.join(', ');
      })
      .filter((s: string) => s.length > 0)
      .filter((s: string, i: number, arr: string[]) => arr.indexOf(s) === i); // dedupe

    return NextResponse.json(suggestions);
  } catch {
    return NextResponse.json([]);
  }
}
