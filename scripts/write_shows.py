"""Apply manual fixes to reconciled.json, verify every QID has an English
Wikipedia sitelink, and write shows.js."""
import json, time, urllib.parse, urllib.request
UA = "nyt-100-tv/0.1 (thisismattmiller@gmail.com)"
FIX = {
  "Battlestar Galactica": "Q237072",
  "Barry": "Q26812664",
  "Shogun": "Q56276181",
  "Station Eleven": "Q85803299",
  "The Diplomat": "Q117425241",
}
rows = json.load(open("scripts/reconciled.json"))
for r in rows:
    if r["title"] in FIX:
        r["qid"] = FIX[r["title"]]; r.pop("wiki", None)
ids = [r["qid"] for r in rows]
assert len(ids) == 100 and len(set(ids)) == 100, "duplicate or missing QIDs"
sitelinks = {}
for i in range(0, 100, 50):
    p = dict(action="wbgetentities", ids="|".join(ids[i:i+50]), props="sitelinks", sitefilter="enwiki", format="json")
    req = urllib.request.Request("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(p), headers={"User-Agent": UA})
    time.sleep(0.35)
    for qid, e in json.load(urllib.request.urlopen(req, timeout=30))["entities"].items():
        sitelinks[qid] = e.get("sitelinks", {}).get("enwiki", {}).get("title")
missing = [r["title"] for r in rows if not sitelinks.get(r["qid"])]
assert not missing, f"no enwiki: {missing}"
for r in rows:
    r["wiki"] = sitelinks[r["qid"]]
json.dump(rows, open("scripts/reconciled.json", "w"), indent=1, ensure_ascii=False)

lines = ["// The original list, transcribed from The New York Times'",
         "// \"The 100 Best TV Shows of the 21st Century\" (nytimes.com/bestTV).",
         "// Each entry: [title, years, Wikidata QID, English Wikipedia article title].",
         "// Reconciled against Wikidata with scripts/reconcile.py + scripts/write_shows.py.",
         "window.ORIGINAL_SHOWS = ["]
for r in rows:
    lines.append("  " + json.dumps([r["title"], r["years"], r["qid"], r["wiki"]], ensure_ascii=False) + ",")
lines.append("];")
open("shows.js", "w").write("\n".join(lines) + "\n")
print("wrote shows.js;", len(rows), "shows, all with enwiki sitelinks")
for r in rows: print(f"{r['title']:40s} {r['qid']:12s} {r['wiki']}")
