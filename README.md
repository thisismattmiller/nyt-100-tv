# nyt-100-tv

A single-page site for remixing The New York Times' "The 100 Best TV Shows of
the 21st Century". Drag to reorder, swap or remove shows, tick "I've seen it"
and "I want to see it", give the list your own title, and download it as a
PNG or a text file. Everything is saved in the browser's localStorage.

Every show is reconciled to Wikidata, so titles link to English Wikipedia.

Live: https://thisismattmiller.github.io/nyt-100-tv/

## Files

- `index.html`, `style.css`, `app.js` — the site (no build step)
- `shows.js` — the original list: `[title, years, Wikidata QID, Wikipedia title]`
- `scripts/reconcile.py` — searches Wikidata for each show and writes `scripts/reconciled.json`
- `scripts/write_shows.py` — applies manual fixes, verifies Wikipedia sitelinks, writes `shows.js`

Run the scripts with `uv run scripts/reconcile.py` then `uv run scripts/write_shows.py`.

## Deploying

The site is plain static files served from the root of the `main` branch.
In the GitHub repo: Settings → Pages → Source: "Deploy from a branch",
Branch: `main`, folder `/ (root)`.
