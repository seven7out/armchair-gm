#!/usr/bin/env python3
"""
Armchair GM — All-32 NFL Teams Live Data & Headshot Sync Pipeline (`scripts/sync-live-nfl-data.py`).

Fetches in parallel across all 32 NFL franchises:
1. Authoritative 2026, 2027, 2028, and 2029 team salary cap books & dead money ledgers
   directly from Over The Cap (`https://overthecap.com/salary-cap/<team-slug>`).
2. Official NFL player metadata (birth_date, position, draft_round, draft_pick, years_of_experience,
   espn_id, and official NFL.com headshot URLs) from `nflverse-data` (`players.csv.gz`).
3. Official ESPN NFL API active rosters, team logos (`https://a.espncdn.com/i/teamlogos/nfl/500/<abbr>.png`),
   and high-resolution player headshots (`https://a.espncdn.com/i/headshots/nfl/players/full/<espn_id>.png`).

Outputs `src/data/seed/teams.ts` with all 32 NFL franchises.
"""

import concurrent.futures
import csv
import gzip
import io
import json
import re
import urllib.request
from datetime import datetime, timezone

ALL_32_TEAMS = [
    # NFC NORTH
    {"id": "DET", "city": "Detroit", "name": "Lions", "otc_slug": "detroit-lions", "espn_slug": "det", "division": "NFC North", "primaryColor": "#0076B6", "secondaryColor": "#B0B7BC", "rollover": 21.8, "pick1": 28, "archetypeLabel": "Contender Window Squeeze"},
    {"id": "GB", "city": "Green Bay", "name": "Packers", "otc_slug": "green-bay-packers", "espn_slug": "gb", "division": "NFC North", "primaryColor": "#203731", "secondaryColor": "#FFB612", "rollover": 14.5, "pick1": 23, "archetypeLabel": "Young Core & Jordan Love Deal"},
    {"id": "MIN", "city": "Minnesota", "name": "Vikings", "otc_slug": "minnesota-vikings", "espn_slug": "min", "division": "NFC North", "primaryColor": "#4F2683", "secondaryColor": "#FFC62F", "rollover": 16.2, "pick1": 24, "archetypeLabel": "Rookie-Scale QB & Elite Pillars"},
    {"id": "CHI", "city": "Chicago", "name": "Bears", "otc_slug": "chicago-bears", "espn_slug": "chi", "division": "NFC North", "primaryColor": "#0B162A", "secondaryColor": "#C83803", "rollover": 18.4, "pick1": 10, "archetypeLabel": "Caleb Williams Rookie Window"},

    # NFC EAST
    {"id": "PHI", "city": "Philadelphia", "name": "Eagles", "otc_slug": "philadelphia-eagles", "espn_slug": "phi", "division": "NFC East", "primaryColor": "#004C54", "secondaryColor": "#A5ACAF", "rollover": 13.8, "pick1": 32, "archetypeLabel": "Howie Roseman Void-Year Matrix"},
    {"id": "WAS", "city": "Washington", "name": "Commanders", "otc_slug": "washington-commanders", "espn_slug": "wsh", "division": "NFC East", "primaryColor": "#5A1414", "secondaryColor": "#FFB612", "rollover": 24.5, "pick1": 29, "archetypeLabel": "Jayden Daniels Surplus Window"},
    {"id": "DAL", "city": "Dallas", "name": "Cowboys", "otc_slug": "dallas-cowboys", "espn_slug": "dal", "division": "NFC East", "primaryColor": "#003594", "secondaryColor": "#869397", "rollover": 22.1, "pick1": 12, "archetypeLabel": "Top-Heavy Superstar Ledger"},
    {"id": "NYG", "city": "New York", "name": "Giants", "otc_slug": "new-york-giants", "espn_slug": "nyg", "division": "NFC East", "primaryColor": "#0B2265", "secondaryColor": "#A71930", "rollover": 6.5, "pick1": 3, "archetypeLabel": "Clean-Slate Rebuild"},

    # NFC WEST
    {"id": "SF", "city": "San Francisco", "name": "49ers", "otc_slug": "san-francisco-49ers", "espn_slug": "sf", "division": "NFC West", "primaryColor": "#AA0000", "secondaryColor": "#B3995D", "rollover": 38.0, "pick1": 11, "archetypeLabel": "Veteran Core + Rollover Warchest"},
    {"id": "LAR", "city": "Los Angeles", "name": "Rams", "otc_slug": "los-angeles-rams", "espn_slug": "lar", "division": "NFC West", "primaryColor": "#003594", "secondaryColor": "#FFA300", "rollover": 9.4, "pick1": 26, "archetypeLabel": "Stafford Bridge & Young Front"},
    {"id": "SEA", "city": "Seattle", "name": "Seahawks", "otc_slug": "seattle-seahawks", "espn_slug": "sea", "division": "NFC West", "primaryColor": "#002244", "secondaryColor": "#69BE28", "rollover": 11.2, "pick1": 18, "archetypeLabel": "Mid-Tier Retooling Ledger"},
    {"id": "ARI", "city": "Arizona", "name": "Cardinals", "otc_slug": "arizona-cardinals", "espn_slug": "ari", "division": "NFC West", "primaryColor": "#97233F", "secondaryColor": "#000000", "rollover": 28.5, "pick1": 16, "archetypeLabel": "Cap-Rich Ascending Roster"},

    # NFC SOUTH
    {"id": "TB", "city": "Tampa Bay", "name": "Buccaneers", "otc_slug": "tampa-bay-buccaneers", "espn_slug": "tb", "division": "NFC South", "primaryColor": "#D50A0A", "secondaryColor": "#34302B", "rollover": 8.6, "pick1": 19, "archetypeLabel": "Mayfield & Wirfs Core"},
    {"id": "ATL", "city": "Atlanta", "name": "Falcons", "otc_slug": "atlanta-falcons", "espn_slug": "atl", "division": "NFC South", "primaryColor": "#A71930", "secondaryColor": "#000000", "rollover": 5.8, "pick1": 15, "archetypeLabel": "Penix Rookie Deal Transition"},
    {"id": "CAR", "city": "Carolina", "name": "Panthers", "otc_slug": "carolina-panthers", "espn_slug": "car", "division": "NFC South", "primaryColor": "#0085CA", "secondaryColor": "#101820", "rollover": 9.1, "pick1": 8, "archetypeLabel": "Trench Investment Rebuild"},
    {"id": "NO", "city": "New Orleans", "name": "Saints", "otc_slug": "new-orleans-saints", "espn_slug": "no", "division": "NFC South", "primaryColor": "#D3BC8D", "secondaryColor": "#101820", "rollover": 4.2, "pick1": 9, "archetypeLabel": "Void-Year Restructuring Spiral"},

    # AFC WEST
    {"id": "KC", "city": "Kansas City", "name": "Chiefs", "otc_slug": "kansas-city-chiefs", "espn_slug": "kc", "division": "AFC West", "primaryColor": "#E31837", "secondaryColor": "#FFB81C", "rollover": 7.5, "pick1": 31, "archetypeLabel": "Mahomes-Jones Championship Books"},
    {"id": "LAC", "city": "Los Angeles", "name": "Chargers", "otc_slug": "los-angeles-chargers", "espn_slug": "lac", "division": "AFC West", "primaryColor": "#0080C6", "secondaryColor": "#FFC20E", "rollover": 24.0, "pick1": 22, "archetypeLabel": "Harbaugh-Herbert Cap Flexibility"},
    {"id": "DEN", "city": "Denver", "name": "Broncos", "otc_slug": "denver-broncos", "espn_slug": "den", "division": "AFC West", "primaryColor": "#FB4F14", "secondaryColor": "#002244", "rollover": 10.5, "pick1": 20, "archetypeLabel": "Post-Dead-Cap Bo Nix Window"},
    {"id": "LV", "city": "Las Vegas", "name": "Raiders", "otc_slug": "las-vegas-raiders", "espn_slug": "lv", "division": "AFC West", "primaryColor": "#000000", "secondaryColor": "#A5ACAF", "rollover": 31.4, "pick1": 6, "archetypeLabel": "Open Cap Sheet & Crosby Anchor"},

    # AFC NORTH
    {"id": "BAL", "city": "Baltimore", "name": "Ravens", "otc_slug": "baltimore-ravens", "espn_slug": "bal", "division": "AFC North", "primaryColor": "#241773", "secondaryColor": "#9E7C0C", "rollover": 6.4, "pick1": 27, "archetypeLabel": "Lamar Jackson & Hamilton Window"},
    {"id": "PIT", "city": "Pittsburgh", "name": "Steelers", "otc_slug": "pittsburgh-steelers", "espn_slug": "pit", "division": "AFC North", "primaryColor": "#FFB612", "secondaryColor": "#101820", "rollover": 15.2, "pick1": 21, "archetypeLabel": "Defense-Heavy Cash-Over-Cap"},
    {"id": "CIN", "city": "Cincinnati", "name": "Bengals", "otc_slug": "cincinnati-bengals", "espn_slug": "cin", "division": "AFC North", "primaryColor": "#FB4F14", "secondaryColor": "#000000", "rollover": 14.8, "pick1": 17, "archetypeLabel": "Burrow-Chase-Higgins Payday"},
    {"id": "CLE", "city": "Cleveland", "name": "Browns", "otc_slug": "cleveland-browns", "espn_slug": "cle", "division": "AFC North", "primaryColor": "#311D00", "secondaryColor": "#FF3C00", "rollover": 28.2, "pick1": 2, "archetypeLabel": "Maximum Void-Year Leverage"},

    # AFC EAST
    {"id": "BUF", "city": "Buffalo", "name": "Bills", "otc_slug": "buffalo-bills", "espn_slug": "buf", "division": "AFC East", "primaryColor": "#00338D", "secondaryColor": "#C60C30", "rollover": 8.9, "pick1": 30, "archetypeLabel": "Josh Allen Perennial Contender"},
    {"id": "MIA", "city": "Miami", "name": "Dolphins", "otc_slug": "miami-dolphins", "espn_slug": "mia", "division": "AFC East", "primaryColor": "#008E97", "secondaryColor": "#FC4C02", "rollover": 5.1, "pick1": 13, "archetypeLabel": "High-Beta Veteran Restructures"},
    {"id": "NYJ", "city": "New York", "name": "Jets", "otc_slug": "new-york-jets", "espn_slug": "nyj", "division": "AFC East", "primaryColor": "#125740", "secondaryColor": "#000000", "rollover": 14.0, "pick1": 7, "archetypeLabel": "Sauce-Quinnen-Wilson Extensions"},
    {"id": "NE", "city": "New England", "name": "Patriots", "otc_slug": "new-england-patriots", "espn_slug": "ne", "division": "AFC East", "primaryColor": "#002244", "secondaryColor": "#C60C30", "rollover": 42.5, "pick1": 4, "archetypeLabel": "Drake Maye & League-Leading Space"},

    # AFC SOUTH
    {"id": "HOU", "city": "Houston", "name": "Texans", "otc_slug": "houston-texans", "espn_slug": "hou", "division": "AFC South", "primaryColor": "#03202F", "secondaryColor": "#A71930", "rollover": 9.8, "pick1": 25, "archetypeLabel": "Stroud & Will Anderson Horizon"},
    {"id": "IND", "city": "Indianapolis", "name": "Colts", "otc_slug": "indianapolis-colts", "espn_slug": "ind", "division": "AFC South", "primaryColor": "#002C5F", "secondaryColor": "#A2AAAD", "rollover": 12.6, "pick1": 14, "archetypeLabel": "Front-Loaded Zero-Void Philosophy"},
    {"id": "JAX", "city": "Jacksonville", "name": "Jaguars", "otc_slug": "jacksonville-jaguars", "espn_slug": "jax", "division": "AFC South", "primaryColor": "#101820", "secondaryColor": "#D7A22A", "rollover": 17.5, "pick1": 5, "archetypeLabel": "Trevor Lawrence Mega-Deal Ramp"},
    {"id": "TEN", "city": "Tennessee", "name": "Titans", "otc_slug": "tennessee-titans", "espn_slug": "ten", "division": "AFC South", "primaryColor": "#0C2340", "secondaryColor": "#4B92DB", "rollover": 26.8, "pick1": 1, "archetypeLabel": "#1 Overall Pick & Cap Reset"},
]

POS_MAP = {
    "QB": "QB",
    "RB": "RB",
    "FB": "RB",
    "WR": "WR",
    "TE": "TE",
    "OT": "OL",
    "T": "OL",
    "LT": "OL",
    "RT": "OL",
    "G": "OL",
    "LG": "OL",
    "RG": "OL",
    "C": "OL",
    "OL": "OL",
    "DE": "EDGE",
    "EDGE": "EDGE",
    "OLB": "EDGE",
    "DT": "IDL",
    "NT": "IDL",
    "DL": "IDL",
    "IDL": "IDL",
    "LB": "LB",
    "ILB": "LB",
    "MLB": "LB",
    "CB": "CB",
    "DB": "CB",
    "S": "S",
    "FS": "S",
    "SS": "S",
    "SAF": "S",
    "K": "ST",
    "P": "ST",
    "LS": "ST",
    "PK": "ST",
}

def norm_name(s: str) -> str:
    s = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", "", s.lower())
    return re.sub(r"[^a-z0-9]", "", s)

def parse_money(s: str) -> float:
    s = re.sub(r"<[^>]+>", "", s).strip()
    neg = "(" in s or "-" in s
    nums = re.sub(r"[^0-9.]", "", s)
    if not nums:
        return 0.0
    val = float(nums) / 1e6
    return -round(val, 3) if neg else round(val, 3)

print("1. Downloading nflverse players.csv.gz metadata & headshots...")
nv_req = urllib.request.urlopen(
    urllib.request.Request(
        "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv.gz",
        headers={"User-Agent": "Mozilla/5.0"},
    ),
    timeout=30,
)
by_otc = {}
by_name = {}
with gzip.GzipFile(fileobj=io.BytesIO(nv_req.read())) as f:
    reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
    for r in reader:
        if r.get("otc_id"):
            by_otc[r["otc_id"].strip()] = r
        nm = norm_name(r.get("display_name", ""))
        if nm and (nm not in by_name or (r.get("headshot") and not by_name[nm].get("headshot"))):
            by_name[nm] = r

def fetch_espn_roster(espn_slug: str):
    url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{espn_slug}/roster"
    try:
        req = urllib.request.urlopen(url, timeout=15)
        data = json.loads(req.read().decode("utf-8"))
    except Exception:
        return {}
    out = {}
    for g in data.get("athletes", []):
        for a in g.get("items", []):
            nm = norm_name(a.get("fullName", ""))
            out[nm] = {
                "id": a.get("id", ""),
                "fullName": a.get("fullName", ""),
                "headshot": a.get("headshot", {}).get("href"),
                "pos": a.get("position", {}).get("abbreviation"),
                "age": a.get("age"),
                "exp": a.get("experience", {}).get("years", 1),
            }
    return out

def generate_team_picks(team_id: str, pick1: int):
    tid = team_id.lower()
    return [
        {"id": f"{tid}-2026-1", "year": 2026, "round": 1, "overallPick": pick1, "originalTeamId": team_id, "currentTeamId": team_id},
        {"id": f"{tid}-2026-2", "year": 2026, "round": 2, "overallPick": 32 + pick1, "originalTeamId": team_id, "currentTeamId": team_id},
        {"id": f"{tid}-2026-3", "year": 2026, "round": 3, "overallPick": 64 + pick1, "originalTeamId": team_id, "currentTeamId": team_id},
        {"id": f"{tid}-2026-4", "year": 2026, "round": 4, "overallPick": 100 + pick1, "originalTeamId": team_id, "currentTeamId": team_id},
        {"id": f"{tid}-2026-5", "year": 2026, "round": 5, "overallPick": 138 + pick1, "originalTeamId": team_id, "currentTeamId": team_id},
        {"id": f"{tid}-2026-6", "year": 2026, "round": 6, "overallPick": 176 + pick1, "originalTeamId": team_id, "currentTeamId": team_id},
        {"id": f"{tid}-2026-7", "year": 2026, "round": 7, "overallPick": 218 + pick1, "originalTeamId": team_id, "currentTeamId": team_id},
    ]

import time

def parse_otc_team(team_cfg):
    slug = team_cfg["otc_slug"]
    html = ""
    for attempt in range(4):
        try:
            time.sleep(0.2 * attempt)
            req = urllib.request.Request(
                f"https://overthecap.com/salary-cap/{slug}",
                headers={"User-Agent": f"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.{attempt}.0"},
            )
            html = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", errors="ignore")
            if html:
                break
        except Exception as e:
            if attempt == 3:
                raise e
    espn_map = fetch_espn_roster(team_cfg["espn_slug"])

    players_by_otc = {}
    dead_money_entries = []

    for yr in [2026, 2027, 2028, 2029]:
        idx = html.find(f'id="y{yr}"')
        if idx == -1:
            continue
        next_idx = html.find(f'id="y{yr+1}"')
        block = html[idx:next_idx] if next_idx != -1 else html[idx : idx + 220000]

        # Parse Active Roster table
        ar_start = block.find('table class="salary-cap-table contracted-players"')
        if ar_start != -1:
            ar_end = block.find("</table>", ar_start)
            ar_html = block[ar_start:ar_end]
            rows = re.findall(r'<tr><td class="player-information">.*?</tr>', ar_html, re.S)

            for r in rows:
                m = re.search(r'href="/player/[^/]+/(\d+)/">([^<]+)</a>', r)
                if not m:
                    continue
                otc_id, raw_name = m.group(1), m.group(2).strip()
                main_part = r.split('<td class="player-transactions')[0]
                tds = re.findall(r"<td[^>]*>(.*?)</td>", main_part, re.S)
                vals = [parse_money(t) for t in tds[1:]]
                if len(vals) < 11:
                    continue

                base_sal = vals[0]
                prorated_signing = vals[1]
                prorated_option = vals[2]
                roster_reg = vals[3]
                roster_pg = vals[4]
                workout = vals[5]
                other_b = vals[6]
                guar_sal = vals[8]
                cap_num = vals[10]

                prorated_total = round(prorated_signing + prorated_option + other_b, 3)
                roster_total = round(roster_reg + roster_pg, 3)
                diff = round(cap_num - (base_sal + prorated_total + roster_total + workout), 3)
                if abs(diff) >= 0.005 and cap_num > 0:
                    prorated_total = round(max(0.0, prorated_total + diff), 3)

                if yr == 2026 and otc_id not in players_by_otc:
                    players_by_otc[otc_id] = {
                        "otc_id": otc_id,
                        "name": raw_name,
                        "years": {2026: None, 2027: None, 2028: None, 2029: None},
                        "cap_2026": cap_num,
                    }

                if otc_id in players_by_otc:
                    is_void = base_sal == 0.0 and prorated_total > 0.0
                    players_by_otc[otc_id]["years"][yr] = {
                        "year": yr,
                        "baseSalary": base_sal,
                        "guaranteedSalary": min(base_sal, max(0.0, guar_sal)),
                        "proratedBonus": prorated_total,
                        "rosterBonus": roster_total,
                        "workoutBonus": workout,
                        "isVoidYear": is_void,
                    }

        # Parse Non-Active Dead Money in 2026
        if yr == 2026:
            dm_start = block.find("<h5>Dead Money</h5>")
            if dm_start != -1:
                dm_end = block.find("</table>", dm_start)
                dm_html = block[dm_start:dm_end]
                dm_rows = re.findall(r'<tr><td class="player-information">.*?</tr>', dm_html, re.S)
                for dr in dm_rows[:8]:
                    m_dm = re.search(r'href="/player/[^/]+/(\d+)/">([^<]+)</a>.*?<td>([^<]+)</td>', dr, re.S)
                    if m_dm:
                        dm_otc_id, dm_name, dm_amt_str = m_dm.group(1), m_dm.group(2).strip(), m_dm.group(3)
                        dm_val = parse_money(dm_amt_str)
                        if dm_val >= 0.5:
                            dead_money_entries.append({
                                "id": f"{team_cfg['id'].lower()}-dead-{dm_otc_id}",
                                "playerId": f"dead-{dm_otc_id}",
                                "playerName": f"{dm_name} (Dead Cap)",
                                "position": "OL",
                                "reason": "Prior Release / Trade Proration (Over The Cap)",
                                "amountsByYear": {2026: dm_val, 2027: 0, 2028: 0, 2029: 0},
                            })

    # Keep all active OTC contracts (up to 65) + top up with ESPN active roster players so every team has 53+ players
    all_p = sorted(players_by_otc.values(), key=lambda x: x["cap_2026"], reverse=True)[:65]
    roster_out = []

    for p in all_p:
        otc_id = p["otc_id"]
        name = p["name"]
        nm = norm_name(name)
        nv = by_otc.get(otc_id) or by_name.get(nm) or {}
        espn = espn_map.get(nm) or {}

        raw_pos = espn.get("pos") or nv.get("position") or "LB"
        pos = POS_MAP.get(raw_pos, "LB")

        age_2026 = espn.get("age")
        if not age_2026 and nv.get("birth_date") and len(nv["birth_date"]) >= 4:
            try:
                birth_yr = int(nv["birth_date"][:4])
                age_2026 = 2026 - birth_yr
            except Exception:
                age_2026 = 26
        if not age_2026:
            age_2026 = 25

        accrued = espn.get("exp")
        if accrued is None:
            try:
                accrued = int(nv.get("years_of_experience") or 3)
            except Exception:
                accrued = 3

        # Headshot: ESPN live roster -> ESPN ID from nflverse -> NFL.com static image
        espn_id_from_nv = (nv.get("espn_id") or "").strip().split(".")[0]
        headshot = (
            espn.get("headshot")
            or (f"https://a.espncdn.com/i/headshots/nfl/players/full/{espn_id_from_nv}.png" if espn_id_from_nv else None)
            or nv.get("headshot")
            or None
        )

        draft_round = None
        draft_pick = None
        try:
            if nv.get("draft_round") and nv["draft_round"] != "NA":
                draft_round = int(float(nv["draft_round"]))
            if nv.get("draft_pick") and nv["draft_pick"] != "NA":
                draft_pick = int(float(nv["draft_pick"]))
        except Exception:
            pass

        max_cap = max((c["baseSalary"] + c["proratedBonus"] + c["rosterBonus"] + c["workoutBonus"]) for c in p["years"].values() if c)
        is_rookie = accrued <= 4 and max_cap < 13.0 and draft_round is not None

        if max_cap >= 22.0 or (is_rookie and draft_round == 1 and draft_pick and draft_pick <= 15) or name in ("Jahmyr Gibbs", "Sam LaPorta", "Brian Branch", "Jayden Daniels", "Aidan Hutchinson", "Amon-Ra St. Brown", "Penei Sewell", "Bijan Robinson", "Puka Nacua", "C.J. Stroud", "Will Anderson Jr.", "Brock Bowers", "Malik Nabers", "Drake Maye", "Caleb Williams", "Kyle Hamilton", "Sauce Gardner", "Garrett Wilson", "Jalen Carter", "Devon Witherspoon", "Jaxon Smith-Njigba"):
            tier = "Elite"
            ovr = 93 if max_cap >= 28 else 90
        elif max_cap >= 8.0 or (is_rookie and draft_round in (1, 2)):
            tier = "Starter"
            ovr = 85
        elif is_rookie:
            tier = "Rookie"
            ovr = 79
        elif max_cap >= 2.5:
            tier = "Rotation"
            ovr = 77
        else:
            tier = "Depth"
            ovr = 73

        roster_out.append({
            "id": f"{team_cfg['id'].lower()}-{otc_id}",
            "name": name,
            "position": pos,
            "ageIn2026": int(age_2026),
            "tier": tier,
            "overallRating": ovr,
            "accruedSeasons": max(1, int(accrued)),
            "headshotUrl": headshot,
            "draftRound": draft_round,
            "draftPick": draft_pick,
            "isRookieContract": bool(is_rookie),
            "contractYears": p["years"],
        })

    # If OTC had fewer than 53 players under 2026 contract, top up to 55 from ESPN active roster
    existing_norm_names = {norm_name(p["name"]) for p in roster_out}
    for nm, espn_p in espn_map.items():
        if len(roster_out) >= 55:
            break
        if nm in existing_norm_names or not espn_p.get("fullName"):
            continue
        pos = POS_MAP.get(espn_p.get("pos") or "LB", "LB")
        age_26 = int(espn_p.get("age") or 24)
        exp_yrs = max(1, int(espn_p.get("exp") or 1))
        vet_min = 0.985 if exp_yrs <= 1 else (1.10 if exp_yrs <= 3 else 1.255)
        roster_out.append({
            "id": f"{team_cfg['id'].lower()}-espn-{espn_p.get('id') or nm}",
            "name": espn_p["fullName"],
            "position": pos,
            "ageIn2026": age_26,
            "tier": "Depth",
            "overallRating": 74,
            "accruedSeasons": exp_yrs,
            "headshotUrl": espn_p.get("headshot"),
            "draftRound": None,
            "draftPick": None,
            "isRookieContract": exp_yrs <= 3,
            "contractYears": {
                2026: {
                    "year": 2026,
                    "baseSalary": vet_min,
                    "guaranteedSalary": 0.0,
                    "proratedBonus": 0.0,
                    "rosterBonus": 0.0,
                    "workoutBonus": 0.0,
                    "isVoidYear": False,
                },
                2027: None,
                2028: None,
                2029: None,
            },
        })
        existing_norm_names.add(nm)

    top_stars = ", ".join(p["name"] for p in roster_out[:4])
    print(f"   ✓ Synced {team_cfg['id']} ({team_cfg['city']} {team_cfg['name']}): {len(roster_out)} active contracts, {len(dead_money_entries)} dead-cap items")

    return {
        "id": team_cfg["id"],
        "city": team_cfg["city"],
        "name": team_cfg["name"],
        "abbreviation": team_cfg["id"],
        "division": team_cfg["division"],
        "logoUrl": f"https://a.espncdn.com/i/teamlogos/nfl/500/{team_cfg['espn_slug']}.png",
        "archetypeLabel": f"{team_cfg['division']} · {team_cfg['archetypeLabel']}",
        "archetypeDescription": f"Live Over The Cap 2026–2029 ledger anchored by {top_stars}.",
        "primaryColor": team_cfg["primaryColor"],
        "secondaryColor": team_cfg["secondaryColor"],
        "initialRollover2026": team_cfg["rollover"],
        "priorDeadMoney": dead_money_entries,
        "roster": roster_out,
        "draftPicks": generate_team_picks(team_cfg["id"], team_cfg["pick1"]),
    }

print("2. Fetching Over The Cap 2026-2029 ledgers & ESPN rosters for all 32 NFL teams...")
teams_dict = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    future_to_id = {executor.submit(parse_otc_team, cfg): cfg["id"] for cfg in ALL_32_TEAMS}
    results_map = {}
    for future in concurrent.futures.as_completed(future_to_id):
        tid = future_to_id[future]
        results_map[tid] = future.result()

# Preserve division-ordered sequence from ALL_32_TEAMS
for cfg in ALL_32_TEAMS:
    teams_dict[cfg["id"]] = results_map[cfg["id"]]

ts_code = """/**
 * AUTO-GENERATED BY `scripts/sync-live-nfl-data.py`
 * Source: Over The Cap (All 32 NFL Teams 2026–2029 Multi-Year Cap Ledgers) + nflverse + ESPN NFL API.
 * Last Synced: """ + datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC") + """
 */

import { TeamSeedData } from '@/engine/types';

export const SEED_TEAMS: Record<string, TeamSeedData> = """ + json.dumps(teams_dict, indent=2) + """;
"""

with open("src/data/seed/teams.ts", "w", encoding="utf-8") as out_f:
    out_f.write(ts_code)

print(f"3. Successfully generated src/data/seed/teams.ts with {len(teams_dict)} NFL franchises!")
