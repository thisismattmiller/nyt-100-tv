"""Reconcile the show list against Wikidata and write shows.js with QIDs and
English Wikipedia URLs. Run: uv run scripts/reconcile.py"""
import json, re, time, urllib.parse, urllib.request

UA = "nyt-100-tv/0.1 (thisismattmiller@gmail.com)"
API = "https://www.wikidata.org/w/api.php"
TV_TYPES = {  # P31 values we accept
    "Q5398426": "television series", "Q1259759": "miniseries",
    "Q15416": "television program", "Q63952888": "drama TV series",
    "Q581714": "animated series", "Q21191270": "television series episode",
    "Q7725310": "series of creative works", "Q1366112": "television special",
    "Q4988564": "documentary TV series", "Q10683899": "reality TV series",
    "Q3464665": "TV season", "Q1261214": "TV season",
    "Q61220733": "anthology series", "Q117467246": "animated television series",
    "Q100269354": "British TV series", "Q2001305": "television channel",
    "Q24704200": "sketch comedy series", "Q1421256": "TV programme",
}

def get(params):
    params.update(format="json")
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params),
                                 headers={"User-Agent": UA})
    time.sleep(0.35)
    return json.load(urllib.request.urlopen(req, timeout=30))

def search(q):
    return get(dict(action="wbsearchentities", search=q, language="en",
                    uselang="en", type="item", limit=8))["search"]

def entities(ids):
    out = {}
    for i in range(0, len(ids), 50):
        r = get(dict(action="wbgetentities", ids="|".join(ids[i:i+50]),
                     props="claims|sitelinks|descriptions|labels", languages="en",
                     sitefilter="enwiki"))
        out.update(r["entities"])
    return out

def p31(ent):
    return [c["mainsnak"].get("datavalue", {}).get("value", {}).get("id")
            for c in ent.get("claims", {}).get("P31", [])]

def start_year(ent):
    for c in ent.get("claims", {}).get("P580", []) + ent.get("claims", {}).get("P577", []):
        v = c["mainsnak"].get("datavalue", {}).get("value", {})
        if "time" in v:
            return int(v["time"][1:5])
    return None

src = open("shows.js").read()
shows = json.loads(re.sub(r",\s*\]", "]", re.search(r"= (\[.*?\]);", src, re.S).group(1)))

# Search: try title, then title + " TV series"; collect candidates
cands = {}
for title, years in shows:
    base = re.sub(r"\s*\((Season 1|U\.S\.|U\.K\.)\)$", "", title)
    q1 = search(base)
    q2 = search(base + " television series")
    seen, merged = set(), []
    for r in q1 + q2:
        if r["id"] not in seen:
            seen.add(r["id"]); merged.append(r)
    cands[title] = merged
    print(title, "->", len(merged), "candidates")

all_ids = sorted({r["id"] for v in cands.values() for r in v})
ents = entities(all_ids)

results = []
for title, years in shows:
    want_year = int(years[:4])
    hint = "U.K." in title and "British" or ("U.S." in title and "American" or "")
    picked, why = None, ""
    for r in cands[title]:
        e = ents[r["id"]]
        types = p31(e)
        desc = e.get("descriptions", {}).get("en", {}).get("value", "").lower()
        is_tv = any(t in TV_TYPES for t in types) or "television" in desc or "tv series" in desc or "miniseries" in desc
        if not is_tv:
            continue
        if "enwiki" not in e.get("sitelinks", {}):
            continue
        if hint and hint.lower() not in desc:
            continue
        sy = start_year(e)
        if sy and abs(sy - want_year) > 1:
            continue
        picked, why = e, f"P31={types} desc={desc!r} start={sy}"
        break
    row = {"title": title, "years": years}
    if picked:
        row["qid"] = picked["id"]
        row["wiki"] = picked["sitelinks"]["enwiki"]["title"]
        print(f"OK   {title:40s} {picked['id']:12s} {row['wiki']!r}  {why}")
    else:
        print(f"MISS {title:40s} candidates: {[(r['id'], r['label'], r.get('description')) for r in cands[title][:5]]}")
    results.append(row)

json.dump(results, open("scripts/reconciled.json", "w"), indent=1, ensure_ascii=False)
print("matched", sum("qid" in r for r in results), "of", len(results))
