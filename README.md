# STRegs.ai

**Address-level short-term rental regulatory intelligence.**

Type in any address. Get the STR regulations for that exact property in plain English — permit requirements, fees, caps, primary residence rules, and enforcement contacts. Always up to date, AI-monitored.

Phase 1: 10 Denver metro markets. National expansion in progress.

**Exit target:** AirDNA, CoStar, Airbnb, Guesty, Hostfully, or PE roll-up.

---

## Tech Stack

- **Frontend:** Next.js 14+ App Router, TypeScript, Tailwind CSS
- **Database:** Supabase (PostgreSQL + PostGIS for geographic boundary queries)
- **AI Parsing:** Anthropic Claude (extracts structured regulations from raw ordinance text)
- **Address Geocoding:** Google Maps Geocoding API + Places Autocomplete
- **Payments:** Stripe
- **Deployment:** Vercel

---

## Local Setup

### 1. Prerequisites
- Node.js 18+
- A Supabase account (free at supabase.com)
- A Google Cloud account (for Maps API)
- An Anthropic API key (console.anthropic.com)

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in your values:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | console.cloud.google.com → Enable Geocoding API + Places API → Create Key |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API Keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | dashboard.stripe.com → Developers → API Keys |

### 4. Set up Supabase database

1. Create a new Supabase project
2. Go to SQL Editor
3. Run the migration: paste contents of `supabase/migrations/001_initial.sql`

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Adding a New Jurisdiction

### Step 1: Scrape the ordinance

```bash
node scripts/scrape-ordinance.js "https://municode.com/library/co/aurora/codes/code_of_ordinances?nodeId=STR" aurora
```

This fetches the page, sends it to Claude for structured extraction, and saves the result to `data/scraped/aurora.json`.

Review the output — check `confidence` and `extraction_notes` fields. Low confidence = needs manual review.

### Step 2: Verify the data

Open `data/scraped/aurora.json` and confirm the extracted fields are correct. Compare against the source ordinance. Wrong data is worse than no data.

Once verified, move to `data/seed/aurora.json` and set `"human_verified": true`.

### Step 3: Import to Supabase

```bash
node scripts/import-jurisdiction.js aurora
```

### Step 4: Import boundary shapefile

Download the municipal boundary GeoJSON (see `scripts/import-shapefiles.js` for instructions) and run:

```bash
node scripts/import-shapefiles.js
```

---

## Project Structure

```
stregs-ai/
├── app/
│   ├── page.tsx              # Homepage with address search
│   ├── results/page.tsx      # Results page
│   ├── pricing/page.tsx      # Pricing tiers
│   └── api/
│       ├── lookup/route.ts   # POST /api/lookup — main query endpoint
│       └── jurisdictions/route.ts # GET /api/jurisdictions — list all
├── supabase/
│   └── migrations/
│       └── 001_initial.sql   # Full DB schema with PostGIS
├── scripts/
│   ├── scrape-ordinance.js   # Fetch + AI-parse a municipal code URL
│   └── import-shapefiles.js  # Import CO boundary GeoJSON to Supabase
├── data/
│   ├── seed/                 # Manually verified regulation data
│   │   ├── denver.json
│   │   └── arvada.json
│   ├── scraped/              # AI-extracted data (needs human review)
│   └── shapefiles/           # GeoJSON boundary files (download separately)
└── .env.local.example        # Environment variable template
```

---

## Phase Roadmap

### Phase 1 — Denver Metro MVP (Target: 6 weeks)
- [x] Project scaffold + schema
- [ ] Colorado municipal boundary shapefiles → Supabase PostGIS
- [ ] Address geocoding + jurisdiction resolution
- [ ] Scrape + AI-parse all 10 Denver metro jurisdictions
- [ ] Front-end: search + results + pricing
- [ ] Stripe founding member flow
- [ ] Deploy to Vercel
- [ ] Kyle launches in STR Facebook groups

### Phase 2 — Full Colorado (Target: 3 months post-launch)
- [ ] Build Municode / American Legal / eCode360 scrapers
- [ ] Expand to Steamboat, Breckenridge, Vail, Telluride, Colorado Springs, Fort Collins, Boulder
- [ ] Change detection: daily scrape → hash compare → user email alerts
- [ ] "Last verified" timestamps on all records
- [ ] Human verification queue

### Phase 3 — API + National Expansion (Target: 6 months post-launch)
- [ ] Open B2B API with docs
- [ ] Outreach: AirDNA, Guesty, Hostfully, STR lenders
- [ ] Expand to FL, TN, TX, AZ, SC
- [ ] Press: "The Avalara of STR compliance"

---

## Key Design Decisions

**Why PostGIS?** The hardest technical problem is address → jurisdiction resolution. Given any lat/lng, we need to determine which city, county, or municipality's regulations apply — including complex cases where a property is in unincorporated county land or straddles jurisdiction borders. PostGIS `ST_Contains()` point-in-polygon is the right tool.

**Why human verification?** Wrong regulatory info is worse than no info. Every AI-extracted record gets flagged until a human confirms it. The `human_verified` + `human_verified_date` fields track this.

**Why source citations on every result?** Trust. Users need to be able to verify the information themselves. Every result links directly to the source ordinance.

---

*Built by Reid Sealby. Questions → reid@stregs.ai*
