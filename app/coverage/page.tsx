'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

// FIPS code → state abbreviation
const FIPS: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA',
  '20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
  '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM',
  '36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
  '54':'WV','55':'WI','56':'WY',
};

interface StateData {
  code: string;
  name: string;
  total: number;
  allowed: number;
  conditional: number;
  banned: number;
  markets: string[];
}

export default function CoveragePage() {
  const [coverageData, setCoverageData] = useState<Record<string, StateData>>({});
  const [totalMarkets, setTotalMarkets] = useState(0);
  const [totalStates, setTotalStates] = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; state: StateData } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/coverage')
      .then(r => r.json())
      .then(data => {
        const map: Record<string, StateData> = {};
        for (const s of data.states) map[s.code] = s;
        setCoverageData(map);
        setTotalMarkets(data.totalMarkets);
        setTotalStates(data.states.length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getColor = useCallback((stateCode: string) => {
    const s = coverageData[stateCode];
    if (!s || s.total === 0) return '#1e293b'; // no coverage — dark slate
    return '#f97316'; // covered — orange
  }, [coverageData]);

  const handleMouseMove = useCallback((e: React.MouseEvent, stateCode: string) => {
    const s = coverageData[stateCode];
    if (!s) return;
    setTooltip({ x: e.clientX, y: e.clientY, state: s });
  }, [coverageData]);

  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      {/* Nav */}
      <nav className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">
          ST<span className="text-orange-400">Regs</span>.ai
        </Link>
        <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
          ← Search an address
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-orange-400/10 border border-orange-400/20 rounded-full px-4 py-1.5 mb-4">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-xs text-orange-400 font-medium tracking-wide uppercase">
              Live Coverage
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">STR Regulation Coverage</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Every market where we have STR rules on file. Hover a state to see what's covered.
          </p>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="flex justify-center gap-10 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400">{totalMarkets.toLocaleString()}+</div>
              <div className="text-xs text-slate-500 mt-1">Markets covered</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400">{totalStates}</div>
              <div className="text-xs text-slate-500 mt-1">States + DC</div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex justify-center gap-6 mb-6 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" /> In our database</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-700 inline-block" /> Not yet covered</span>
        </div>

        {/* Map */}
        <div className="relative bg-[#0d1829] rounded-2xl border border-white/10 overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
              Loading coverage data...
            </div>
          )}
          <ComposableMap
            projection="geoAlbersUsa"
            style={{ width: '100%', height: 'auto' }}
          >
            <ZoomableGroup>
              <Geographies geography={GEO_URL}>
                {({ geographies }: { geographies: any[] }) =>
                  geographies.map((geo: any) => {
                    const fips = geo.id as string;
                    const stateCode = FIPS[fips] || '';
                    const hasData = !!coverageData[stateCode];
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={getColor(stateCode)}
                        stroke="#0f172a"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: 'none', cursor: hasData ? 'pointer' : 'default' },
                          hover: {
                            outline: 'none',
                            fill: hasData ? '#fb923c' : '#334155',
                            cursor: hasData ? 'pointer' : 'default',
                          },
                          pressed: { outline: 'none' },
                        }}
                        onMouseMove={(e: any) => handleMouseMove(e as React.MouseEvent, stateCode)}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
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
          <p className="font-semibold text-white mb-1">{tooltip.state.name}</p>
          <p className="text-orange-400 text-xs mb-2">{tooltip.state.total} market{tooltip.state.total !== 1 ? 's' : ''} in our database</p>
          {tooltip.state.markets.length > 0 && (
            <p className="text-slate-400 text-xs">
              {tooltip.state.markets.slice(0, 6).join(', ')}
              {tooltip.state.markets.length > 6 ? ` +${tooltip.state.markets.length - 6} more` : ''}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
