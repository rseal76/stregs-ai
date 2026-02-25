#!/usr/bin/env node
/**
 * scrape-ordinance.js
 *
 * Fetches a municipal code page, extracts STR regulation text,
 * sends to Claude for structured extraction, saves result as JSON.
 *
 * Usage: node scripts/scrape-ordinance.js <URL> [output-name]
 * Example: node scripts/scrape-ordinance.js "https://www.denvergov.org/..." denver
 *
 * Requires: ANTHROPIC_API_KEY in environment (.env.local or shell)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const [, , targetUrl, outputName] = process.argv;

if (!targetUrl) {
  console.error('Usage: node scripts/scrape-ordinance.js <URL> [output-name]');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY not set. Copy .env.local.example to .env.local and add your key.');
  process.exit(1);
}

// ── Fetch page text ──────────────────────────────────────────────────────
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'STRegs.ai/1.0 regulatory-research-bot (contact: admin@stregs.ai)',
        'Accept': 'text/html',
      },
    };

    client.get(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchPage(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ── Strip HTML tags ──────────────────────────────────────────────────────
function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Call Anthropic API ───────────────────────────────────────────────────
function callAnthropic(rawText) {
  return new Promise((resolve, reject) => {
    const prompt = `You are extracting short-term rental (STR) regulations from municipal code text.

Extract all STR-related regulations and return a JSON object with this exact schema:
{
  "allowed": "yes" | "no" | "conditional" | null,
  "permit_required": boolean | null,
  "permit_fee_annual": number | null,
  "permit_fee_one_time": number | null,
  "primary_residence_required": boolean | null,
  "owner_occupied_required": boolean | null,
  "max_days_per_year": number | null,
  "permit_cap_citywide": number | null,
  "permit_cap_per_block": number | null,
  "prohibited_zone_types": string[] | null,
  "license_required": boolean | null,
  "inspection_required": boolean | null,
  "insurance_required": boolean | null,
  "noise_ordinance_applicable": boolean | null,
  "parking_requirements": string | null,
  "occupancy_limits": string | null,
  "enforcement_body": string | null,
  "enforcement_contact": string | null,
  "enforcement_url": string | null,
  "notes": string,
  "status": "active" | "pending_change" | "moratorium" | "banned",
  "effective_date": "YYYY-MM-DD" | null,
  "pending_legislation": string | null,
  "confidence": "high" | "medium" | "low",
  "extraction_notes": string
}

Rules:
- "notes" should be a 2-4 sentence plain English summary a property owner would find useful
- "confidence" reflects how clearly the regulations are stated in the source text
- "extraction_notes" should flag anything ambiguous or requiring human review
- If STR regulations are not mentioned at all, set allowed: null and confidence: "low"
- Return ONLY the JSON object, no other text

Municipal code text (truncated to 8000 chars):
${rawText.slice(0, 8000)}`;

    const body = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          const json = JSON.parse(data);
          const content = json.content?.[0]?.text;
          if (!content) reject(new Error('No content in response: ' + data));
          try {
            resolve(JSON.parse(content));
          } catch {
            reject(new Error('Failed to parse Claude response as JSON: ' + content));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Fetching: ${targetUrl}`);
  const html = await fetchPage(targetUrl);
  const text = stripHtml(html);
  console.log(`Extracted ${text.length} chars of text`);

  console.log('Sending to Claude for extraction...');
  const result = await callAnthropic(text);

  const name = outputName || new URL(targetUrl).hostname.replace(/\./g, '-');
  const outDir = path.join(__dirname, '..', 'data', 'scraped');
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, `${name}.json`);
  const output = {
    source_url: targetUrl,
    scraped_at: new Date().toISOString(),
    ...result,
  };
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log(`✅ Saved to ${outFile}`);
  console.log(`Confidence: ${result.confidence}`);
  if (result.extraction_notes) console.log(`Notes: ${result.extraction_notes}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
