#!/usr/bin/env python3
"""
Load STRegs.ai seed files into Supabase.
Uses upsert to skip already-loaded records.
"""

import json
import os
import sys
import glob
import requests
import time

SUPABASE_URL = "https://qryeddpzcldqswntjbhl.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyeWVkZHB6Y2xkcXN3bnRqYmhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU5MDk5MywiZXhwIjoyMDg4MTY2OTkzfQ._qXxS90MTOOzH5F2Qj8P0jGxOOHGProwP0Oi0InK2Mg"
SEED_DIR = "/Users/reidsealby/.openclaw/workspace/stregs-ai/data/seed"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

def upsert_jurisdiction(name, jtype, state, parent_county):
    """Upsert a jurisdiction, return its id."""
    payload = {
        "name": name,
        "type": jtype,
        "state": state,
        "parent_county": parent_county,
    }
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/jurisdictions",
        headers={**HEADERS, "Prefer": "return=representation,resolution=merge-duplicates"},
        params={"on_conflict": "name,state"},
        json=payload,
    )
    if resp.status_code in (200, 201):
        data = resp.json()
        if isinstance(data, list) and data:
            return data[0]["id"]
        elif isinstance(data, dict):
            return data.get("id")
    # If upsert failed, try to fetch existing
    if resp.status_code == 409 or resp.status_code == 400:
        fetch = requests.get(
            f"{SUPABASE_URL}/rest/v1/jurisdictions",
            headers=HEADERS,
            params={"name": f"eq.{name}", "state": f"eq.{state}", "select": "id"},
        )
        if fetch.status_code == 200:
            rows = fetch.json()
            if rows:
                return rows[0]["id"]
    print(f"  ERROR upserting jurisdiction {name}/{state}: {resp.status_code} {resp.text[:200]}")
    return None


def upsert_regulation(jurisdiction_id, reg):
    """Upsert str_regulations for a given jurisdiction_id."""
    payload = {
        "jurisdiction_id": jurisdiction_id,
        "allowed": reg.get("allowed"),
        "status": reg.get("status"),
        "permit_required": reg.get("permit_required"),
        "permit_fee_annual": reg.get("permit_fee_annual"),
        "license_required": reg.get("license_required"),
        "inspection_required": reg.get("inspection_required"),
        "insurance_required": reg.get("insurance_required"),
        "primary_residence_required": reg.get("primary_residence_required"),
        "owner_occupied_required": reg.get("owner_occupied_required"),
        "max_days_per_year": reg.get("max_days_per_year"),
        "noise_ordinance_applicable": reg.get("noise_ordinance_applicable"),
        "parking_requirements": reg.get("parking_requirements"),
        "occupancy_limits": reg.get("occupancy_limits"),
        "enforcement_body": reg.get("enforcement_body"),
        "enforcement_url": reg.get("enforcement_url"),
        "notes": reg.get("notes"),
        "pending_legislation": reg.get("pending_legislation"),
    }
    # Remove None-valued keys that might cause issues (keep explicit nulls for known fields)
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/str_regulations",
        headers={**HEADERS, "Prefer": "return=representation,resolution=merge-duplicates"},
        params={"on_conflict": "jurisdiction_id"},
        json=payload,
    )
    if resp.status_code in (200, 201):
        return True
    print(f"  ERROR upserting regulation for {jurisdiction_id}: {resp.status_code} {resp.text[:200]}")
    return False


def load_seed_file(filepath):
    """Load a single seed file and return parsed data."""
    with open(filepath, "r") as f:
        data = json.load(f)
    
    # Extract jurisdiction info
    name = data.get("jurisdiction") or data.get("name")
    jtype = data.get("type")
    state = data.get("state")
    parent_county = data.get("parent_county")
    
    # Extract regulations (may be nested under "regulations")
    reg = data.get("regulations", {})
    if not reg:
        # Some files might have flat structure
        reg = data
    
    return name, jtype, state, parent_county, reg


def main():
    seed_files = sorted(glob.glob(os.path.join(SEED_DIR, "*.json")))
    total = len(seed_files)
    print(f"Found {total} seed files to process.")
    
    processed = 0
    success_j = 0
    success_r = 0
    errors = []
    
    for i, filepath in enumerate(seed_files):
        filename = os.path.basename(filepath)
        
        try:
            name, jtype, state, parent_county, reg = load_seed_file(filepath)
        except Exception as e:
            errors.append(f"Parse error {filename}: {e}")
            continue
        
        if not name or not state:
            errors.append(f"Missing name/state in {filename}")
            continue
        
        # Upsert jurisdiction
        jid = upsert_jurisdiction(name, jtype, state, parent_county)
        if jid:
            success_j += 1
            # Upsert regulation
            ok = upsert_regulation(jid, reg)
            if ok:
                success_r += 1
        else:
            errors.append(f"Failed jurisdiction upsert for {filename}")
        
        processed += 1
        
        # Progress every 50 files
        if processed % 50 == 0:
            print(f"  [{processed}/{total}] jurisdictions: {success_j}, regulations: {success_r}, errors: {len(errors)}")
        
        # Small rate limit pause every 100 requests
        if processed % 100 == 0:
            time.sleep(0.5)
    
    print(f"\n=== DONE ===")
    print(f"Total files: {total}")
    print(f"Processed: {processed}")
    print(f"Jurisdictions upserted: {success_j}")
    print(f"Regulations upserted: {success_r}")
    print(f"Errors: {len(errors)}")
    if errors:
        print("\nFirst 20 errors:")
        for e in errors[:20]:
            print(f"  - {e}")
    
    return success_j, success_r, len(errors)

if __name__ == "__main__":
    main()
