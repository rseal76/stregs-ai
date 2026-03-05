'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ComposableMap,
  Geographies,
  Geography,
} from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';

// State code → FIPS prefix
const STATE_FIPS: Record<string, string> = {
  AL:'01', AK:'02', AZ:'04', AR:'05', CA:'06', CO:'08', CT:'09', DE:'10',
  DC:'11', FL:'12', GA:'13', HI:'15', ID:'16', IL:'17', IN:'18', IA:'19',
  KS:'20', KY:'21', LA:'22', ME:'23', MD:'24', MA:'25', MI:'26', MN:'27',
  MS:'28', MO:'29', MT:'30', NE:'31', NV:'32', NH:'33', NJ:'34', NM:'35',
  NY:'36', NC:'37', ND:'38', OH:'39', OK:'40', OR:'41', PA:'42', RI:'44',
  SC:'45', SD:'46', TN:'47', TX:'48', UT:'49', VT:'50', VA:'51', WA:'53',
  WV:'54', WI:'55', WY:'56',
};

interface Market {
  name: string;
  type: string;
  county: string | null;
  parentCounty: string | null;
}

interface StateData {
  state: string;
  stateName: string;
  markets: Market[];
  totalMarkets: number;
}

interface TooltipState {
  x: number;
  y: number;
  countyName: string;
  cities: string[];
  totalCities: number;
}

/** Normalize a county name for matching: lowercase, strip " county" */
function normalizeCounty(name: string): string {
  return name.toLowerCase().replace(/\s*county$/i, '').trim();
}

export default function StateCoveragePage() {
  const params = useParams();
  const stateCode = (params?.state as string)?.toUpperCase() || '';

  const [data, setData] = useState<StateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Map: normalized county name → list of city/jurisdiction names
  const [countyMap, setCountyMap] = useState<Map<string, string[]>>(new Map());

  useEffect(() => {
    if (!stateCode) return;
    fetch(`/api/coverage/${stateCode}`)
      .then(r => r.json())
      .then((d: StateData) => {
        setData(d);

        // Build county → cities map
        const map = new Map<string, string[]>();
        for (const m of d.markets) {
          if (!m.county) continue;
          const key = normalizeCounty(m.county);
          if (!map.has(key)) map.set(key, []);
          // Only add city names (not county-type entries as a "city")
          if (m.type === 'city') {
            map.get(key)!.push(m.name);
          } else if (m.type === 'county') {
            // Mark county covered but don't add as a city name
            if (!map.has(key)) map.set(key, []);
          }
        }

        // Ensure county-type jurisdictions mark the county even without cities
        for (const m of d.markets) {
          if (m.type === 'county' && m.county) {
            const key = normalizeCounty(m.county);
            if (!map.has(key)) map.set(key, []);
          }
        }

        setCountyMap(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [stateCode]);

  const stateFips = STATE_FIPS[stateCode] || '';

  const getCountyName = useCallback((geo: any): string => {
    return geo.properties?.name || '';
  }, []);

  const isCountyCovered = useCallback((countyName: string): boolean => {
    const key = normalizeCounty(countyName);
    return countyMap.has(key);
  }, [countyMap]);

  const handleMouseMove = useCallback((e: React.MouseEvent, countyName: string) => {
    const key = normalizeCounty(countyName);
    const cities = countyMap.get(key) || [];
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      countyName,
      cities: cities.slice(0, 5),
      totalCities: cities.length,
    });
  }, [countyMap]);

  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      {/* Nav */}
      <nav className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">
          ST<span className="text-orange-400">Regs</span>.ai
        </Link>
        <Link href="/coverage" className="text-sm text-slate-400 hover:text-white transition-colors">
          ← All States
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-orange-400/10 border border-orange-400/20 rounded-full px-4 py-1.5 mb-4">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-xs text-orange-400 font-medium tracking-wide uppercase">
              {stateCode} Coverage
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            {loading ? stateCode : data?.stateName} Coverage
          </h1>
          {!loading && data && (
            <p className="text-slate-400 max-w-xl mx-auto">
              {data.totalMarkets} market{data.totalMarkets !== 1 ? 's' : ''} in our database.
              Hover a county to see what&apos;s covered.
            </p>
          )}
        </div>

        {/* Stats */}
        {!loading && data && (
          <div className="flex justify-center gap-10 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400">{data.totalMarkets}</div>
              <div className="text-xs text-slate-500 mt-1">Markets covered</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400">{countyMap.size}</div>
              <div className="text-xs text-slate-500 mt-1">Counties with data</div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex justify-center gap-6 mb-6 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" /> In our database
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-slate-700 inline-block" /> Not yet covered
          </span>
        </div>

        {/* Map */}
        <div className="relative bg-[#0d1829] rounded-2xl border border-white/10 overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm z-10">
              Loading coverage data...
            </div>
          )}
          {stateFips && (
            <ComposableMap
              projection="geoAlbersUsa"
              style={{ width: '100%', height: 'auto' }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }: { geographies: any[] }) => {
                  // Filter to only counties in this state (FIPS starts with state prefix)
                  const stateGeos = geographies.filter((geo: any) => {
                    const fips = String(geo.id).padStart(5, '0');
                    return fips.startsWith(stateFips);
                  });

                  // If no counties found for this state, show a message
                  if (stateGeos.length === 0 && !loading) {
                    return null;
                  }

                  return stateGeos.map((geo: any) => {
                    const countyName = getCountyName(geo);
                    const covered = isCountyCovered(countyName);
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={covered ? '#f97316' : '#1e293b'}
                        stroke="#0f172a"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: 'none', cursor: 'default' },
                          hover: {
                            outline: 'none',
                            fill: covered ? '#fb923c' : '#334155',
                            cursor: 'default',
                          },
                          pressed: { outline: 'none' },
                        }}
                        onMouseMove={(e: any) => handleMouseMove(e as React.MouseEvent, countyName)}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  });
                }}
              </Geographies>
            </ComposableMap>
          )}
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="inline-block bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl px-8 py-3.5 transition-colors"
          >
            Search your address →
          </Link>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-[#1e293b] border border-white/15 rounded-xl px-4 py-3 shadow-2xl pointer-events-none text-sm max-w-xs"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <p className="font-semibold text-white mb-1">{tooltip.countyName}</p>
          {tooltip.cities.length > 0 ? (
            <>
              <p className="text-orange-400 text-xs mb-1">{tooltip.totalCities} city coverage{tooltip.totalCities !== 1 ? 's' : ''}</p>
              <p className="text-slate-400 text-xs">
                {tooltip.cities.join(', ')}
                {tooltip.totalCities > 5 ? ` +${tooltip.totalCities - 5} more` : ''}
              </p>
            </>
          ) : (
            <p className="text-slate-500 text-xs">No city-level data yet</p>
          )}
        </div>
      )}
    </main>
  );
}
