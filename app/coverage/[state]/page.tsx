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

// State code → [longitude, latitude, scale]
// Scale is for geoMercator — higher = more zoomed in
const STATE_PROJECTION: Record<string, [number, number, number]> = {
  AL: [-86.8,  32.8,  4500],
  AK: [-153.0, 64.0,  1200],
  AZ: [-111.7, 34.3,  3800],
  AR: [-92.4,  34.9,  4500],
  CA: [-119.5, 37.3,  2800],
  CO: [-105.5, 39.0,  4200],
  CT: [-72.7,  41.6, 13000],
  DE: [-75.5,  39.0, 14000],
  DC: [-77.0,  38.9, 60000],
  FL: [-81.7,  27.8,  3000],
  GA: [-83.4,  32.7,  4000],
  HI: [-156.3, 20.3,  4000],
  ID: [-114.5, 44.4,  3200],
  IL: [-89.2,  40.0,  3500],
  IN: [-86.3,  40.3,  5000],
  IA: [-93.1,  42.0,  4500],
  KS: [-98.4,  38.5,  4000],
  KY: [-84.9,  37.7,  4000],
  LA: [-91.8,  31.0,  4500],
  ME: [-69.3,  45.4,  4000],
  MD: [-76.8,  39.0,  6500],
  MA: [-71.8,  42.2,  8500],
  MI: [-85.5,  44.3,  3500],
  MN: [-94.6,  46.4,  3200],
  MS: [-89.7,  32.8,  4500],
  MO: [-92.5,  38.4,  4000],
  MT: [-109.6, 47.0,  2800],
  NE: [-99.9,  41.5,  3800],
  NV: [-116.7, 38.8,  3000],
  NH: [-71.6,  44.0,  7000],
  NJ: [-74.5,  40.1,  8500],
  NM: [-106.2, 34.5,  3300],
  NY: [-76.0,  43.0,  3800],
  NC: [-79.4,  35.5,  4000],
  ND: [-100.3, 47.5,  3800],
  OH: [-82.8,  40.4,  4500],
  OK: [-97.1,  35.5,  4000],
  OR: [-120.5, 44.0,  3200],
  PA: [-77.2,  40.9,  4500],
  RI: [-71.5,  41.7, 20000],
  SC: [-80.9,  33.8,  5200],
  SD: [-100.2, 44.5,  3800],
  TN: [-86.3,  35.8,  4000],
  TX: [-99.3,  31.5,  2000],
  UT: [-111.1, 39.3,  3500],
  VT: [-72.7,  44.0,  8000],
  VA: [-78.6,  37.5,  4200],
  WA: [-120.5, 47.5,  3500],
  WV: [-80.6,  38.9,  5500],
  WI: [-89.8,  44.8,  3800],
  WY: [-107.6, 43.0,  3800],
};

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California',
  CO:'Colorado', CT:'Connecticut', DE:'Delaware', DC:'Washington D.C.',
  FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois',
  IN:'Indiana', IA:'Iowa', KS:'Kansas', KY:'Kentucky', LA:'Louisiana',
  ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan', MN:'Minnesota',
  MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada',
  NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NY:'New York',
  NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma', OR:'Oregon',
  PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota',
  TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia',
  WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming',
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

function normalizeCounty(name: string): string {
  return name.toLowerCase().replace(/\s*county$/i, '').trim();
}

export default function StateCoveragePage() {
  const params = useParams();
  const stateCode = (params?.state as string)?.toUpperCase() || '';

  const [data, setData] = useState<StateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [countyMap, setCountyMap] = useState<Map<string, string[]>>(new Map());

  useEffect(() => {
    if (!stateCode) return;
    fetch(`/api/coverage/${stateCode}`)
      .then(r => r.json())
      .then((d: StateData) => {
        setData(d);
        const map = new Map<string, string[]>();
        for (const m of d.markets) {
          if (!m.county) continue;
          const key = normalizeCounty(m.county);
          if (!map.has(key)) map.set(key, []);
          if (m.type === 'city') map.get(key)!.push(m.name);
        }
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
  const proj = STATE_PROJECTION[stateCode];
  const stateName = STATE_NAMES[stateCode] || stateCode;

  const isCountyCovered = useCallback((countyName: string) => {
    return countyMap.has(normalizeCounty(countyName));
  }, [countyMap]);

  const handleMouseMove = useCallback((e: any, countyName: string) => {
    const key = normalizeCounty(countyName);
    const cities = countyMap.get(key) || [];
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      countyName,
      cities: cities.slice(0, 6),
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
            {stateName} Coverage
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
        <div className="relative bg-[#0d1829] rounded-2xl border border-white/10 overflow-hidden" style={{ minHeight: 420 }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm z-10">
              Loading coverage data...
            </div>
          )}
          {stateFips && proj && (
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                center: [proj[0], proj[1]],
                scale: proj[2],
              }}
              style={{ width: '100%', height: 'auto' }}
              height={500}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }: { geographies: any[] }) => {
                  const stateGeos = geographies.filter((geo: any) => {
                    const fips = String(geo.id).padStart(5, '0');
                    return fips.startsWith(stateFips);
                  });

                  return stateGeos.map((geo: any) => {
                    const countyName = geo.properties?.name || '';
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
                        onMouseMove={(e: any) => handleMouseMove(e, countyName)}
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
              <p className="text-orange-400 text-xs mb-1">{tooltip.totalCities} city{tooltip.totalCities !== 1 ? ' coverages' : ' coverage'}</p>
              <p className="text-slate-400 text-xs">
                {tooltip.cities.join(', ')}
                {tooltip.totalCities > 6 ? ` +${tooltip.totalCities - 6} more` : ''}
              </p>
            </>
          ) : (
            <p className="text-slate-500 text-xs">County-level data available</p>
          )}
        </div>
      )}
    </main>
  );
}
