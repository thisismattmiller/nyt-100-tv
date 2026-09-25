(function () {
  "use strict";

  const SITE_URL = "https://thisismattmiller.github.io/nyt-100-tv/";
  const DEFAULT_TITLE = "The 100 Best TV Shows of the 21st Century";
  const STORAGE_KEY = "nyt100tv.v1";
  const WIKI_BASE = "https://en.wikipedia.org/wiki/";

  const $ = (sel) => document.querySelector(sel);
  const listEl = $("#list");
  const headlineEl = $("#headline");
  const sheetEl = $("#sheet");
  const dlg = $("#dlg");
  const toastEl = $("#toast");

  // ---------- state ----------

  function originalShows() {
    return window.ORIGINAL_SHOWS.map(([title, years, qid, wiki]) => ({
      title, years, qid, wiki, seen: false, want: false,
    }));
  }

  let state = load() || { title: DEFAULT_TITLE, shows: originalShows() };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.shows)) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      toast("Couldn't save to this browser's storage.");
    }
  }

  // ---------- rendering ----------

  function wikiUrl(show) {
    return show.wiki ? WIKI_BASE + encodeURIComponent(show.wiki.replace(/ /g, "_")) : null;
  }

  function renderRow(show, i) {
    const li = document.createElement("li");
    li.className = "row";
    li.dataset.index = i;

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = (i + 1) + ".";

    const showEl = document.createElement("span");
    showEl.className = "show";
    const url = wikiUrl(show);
    const titleEl = document.createElement(url ? "a" : "span");
    titleEl.className = "title";
    titleEl.textContent = show.title;
    if (url) {
      titleEl.href = url;
      titleEl.target = "_blank";
      titleEl.rel = "noopener";
      titleEl.title = "Open on Wikipedia";
    }
    showEl.appendChild(titleEl);
    if (show.years) {
      const yearsEl = document.createElement("span");
      yearsEl.className = "years";
      yearsEl.textContent = " (" + show.years + ")";
      showEl.appendChild(yearsEl);
    }

    const actions = document.createElement("span");
    actions.className = "row-actions no-drag";
    const swapBtn = document.createElement("button");
    swapBtn.type = "button";
    swapBtn.className = "swap";
    swapBtn.textContent = "Swap";
    swapBtn.title = "Replace this show with another";
    swapBtn.addEventListener("click", () => openDialog(i));
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove";
    removeBtn.textContent = "Remove";
    removeBtn.title = "Remove this show from the list";
    removeBtn.addEventListener("click", () => removeShow(i));
    actions.append(swapBtn, removeBtn);

    const boxes = document.createElement("span");
    boxes.className = "boxes";
    boxes.append(renderBox(show, "seen", "I've seen it"), renderBox(show, "want", "I want to see it"));

    li.append(num, showEl, actions, boxes);
    return li;
  }

  function renderBox(show, key, label) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "box no-drag";
    b.setAttribute("aria-pressed", show[key] ? "true" : "false");
    b.setAttribute("aria-label", label + ": " + show.title);
    b.appendChild(document.createElement("span"));
    b.addEventListener("click", () => {
      show[key] = !show[key];
      b.setAttribute("aria-pressed", show[key] ? "true" : "false");
      save();
    });
    return b;
  }

  function render() {
    listEl.innerHTML = "";
    const rows = Math.max(1, Math.ceil(state.shows.length / 2));
    listEl.style.setProperty("--rows", rows);
    state.shows.forEach((show, i) => listEl.appendChild(renderRow(show, i)));
    if (headlineEl.textContent !== state.title) headlineEl.textContent = state.title;
  }

  // ---------- title ----------

  headlineEl.addEventListener("input", () => {
    state.title = headlineEl.textContent.replace(/\s+/g, " ").trim();
    save();
  });
  headlineEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); headlineEl.blur(); }
  });
  headlineEl.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text.replace(/\s+/g, " "));
  });
  headlineEl.addEventListener("blur", () => {
    headlineEl.textContent = state.title;
  });

  function hasCustomTitle() {
    const t = (state.title || "").trim();
    return t.length > 0 && t.toLowerCase() !== DEFAULT_TITLE.toLowerCase();
  }

  function requireCustomTitle() {
    if (hasCustomTitle()) return true;
    toast("Give your list its own title first, so it isn't a copy of the original.");
    headlineEl.focus();
    const range = document.createRange();
    range.selectNodeContents(headlineEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return false;
  }

  // ---------- drag and drop ----------

  new Sortable(listEl, {
    animation: 150,
    forceFallback: true,
    fallbackTolerance: 4,
    filter: ".no-drag",
    preventOnFilter: false,
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    onEnd(evt) {
      if (evt.oldIndex === evt.newIndex) return;
      const [moved] = state.shows.splice(evt.oldIndex, 1);
      state.shows.splice(evt.newIndex, 0, moved);
      save();
      render();
    },
  });

  // ---------- add / swap / remove ----------

  function removeShow(i) {
    const show = state.shows[i];
    state.shows.splice(i, 1);
    save();
    render();
    toast("Removed " + show.title + ".");
  }

  let editingIndex = null; // null = adding

  function openDialog(index) {
    editingIndex = index;
    const show = index === null ? null : state.shows[index];
    $("#dlg-heading").textContent = show ? "Swap out “" + show.title + "”" : "Add a show";
    $("#dlg-search").value = "";
    $("#dlg-results").hidden = true;
    $("#dlg-results").innerHTML = "";
    $("#dlg-title").value = "";
    $("#dlg-years").value = "";
    $("#dlg-wiki").value = "";
    $("#dlg-qid").value = "";
    dlg.showModal();
    $("#dlg-search").focus();
  }

  $("#btn-add").addEventListener("click", () => openDialog(null));
  $("#dlg-cancel").addEventListener("click", () => dlg.close());

  $("#dlg-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const show = {
      title: $("#dlg-title").value.trim(),
      years: $("#dlg-years").value.trim(),
      wiki: $("#dlg-wiki").value.trim().replace(/^https?:\/\/en\.wikipedia\.org\/wiki\//, "").replace(/_/g, " ") || null,
      qid: $("#dlg-qid").value.trim() || null,
      seen: false,
      want: false,
    };
    if (!show.title) return;
    if (show.wiki) show.wiki = decodeURIComponent(show.wiki);
    if (editingIndex === null) {
      state.shows.push(show);
      toast("Added " + show.title + " at #" + state.shows.length + ". Drag it where it belongs.");
    } else {
      const old = state.shows[editingIndex];
      state.shows[editingIndex] = show;
      toast("Swapped " + old.title + " for " + show.title + ".");
    }
    save();
    render();
    dlg.close();
  });

  // ---------- Wikidata lookup inside the dialog ----------

  const WD_API = "https://www.wikidata.org/w/api.php";
  let searchTimer = null;
  let searchSeq = 0;

  $("#dlg-search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (q.length < 2) { $("#dlg-results").hidden = true; return; }
    searchTimer = setTimeout(() => searchWikidata(q), 300);
  });

  async function searchWikidata(q) {
    const seq = ++searchSeq;
    const params = new URLSearchParams({
      action: "wbsearchentities", search: q, language: "en", uselang: "en",
      type: "item", limit: "10", format: "json", origin: "*",
    });
    let results = [];
    try {
      const r = await fetch(WD_API + "?" + params);
      results = (await r.json()).search || [];
    } catch (err) {
      results = [];
    }
    if (seq !== searchSeq) return;
    const tvish = /television|tv series|miniseries|sitcom|web series|anime|drama series|comedy series|documentary series|reality/i;
    results = results.filter((r) => tvish.test(r.description || "")).concat(
      results.filter((r) => !tvish.test(r.description || "")));
    const ul = $("#dlg-results");
    ul.innerHTML = "";
    if (!results.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No matches. You can still fill in the fields by hand.";
      ul.appendChild(li);
    }
    for (const r of results) {
      const li = document.createElement("li");
      li.innerHTML = "<strong></strong><span class=\"desc\"></span>";
      li.querySelector("strong").textContent = r.label;
      li.querySelector(".desc").textContent = r.description || r.id;
      li.addEventListener("click", () => pickEntity(r));
      ul.appendChild(li);
    }
    ul.hidden = false;
  }

  async function pickEntity(r) {
    $("#dlg-title").value = r.label;
    $("#dlg-qid").value = r.id;
    $("#dlg-results").hidden = true;
    $("#dlg-search").value = r.label;
    const params = new URLSearchParams({
      action: "wbgetentities", ids: r.id, props: "claims|sitelinks",
      sitefilter: "enwiki", format: "json", origin: "*",
    });
    try {
      const data = await (await fetch(WD_API + "?" + params)).json();
      const ent = data.entities[r.id];
      const enwiki = ent.sitelinks && ent.sitelinks.enwiki;
      if (enwiki) $("#dlg-wiki").value = enwiki.title;
      const year = (p) => {
        const c = ent.claims && ent.claims[p];
        const v = c && c[0].mainsnak.datavalue && c[0].mainsnak.datavalue.value;
        return v && v.time ? v.time.slice(1, 5) : null;
      };
      const start = year("P580") || year("P577");
      const end = year("P582");
      if (start) $("#dlg-years").value = end && end !== start ? start + "-" + end : (end ? start : start + "-present");
    } catch (err) {
      // leave fields for manual entry
    }
    $("#dlg-title").focus();
  }

  // ---------- reset ----------

  const resetBtn = $("#btn-reset");
  let resetArmed = null;
  resetBtn.addEventListener("click", () => {
    if (!resetArmed) {
      resetBtn.textContent = "Click again to reset";
      resetBtn.classList.add("armed");
      resetArmed = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    state = { title: DEFAULT_TITLE, shows: originalShows() };
    save();
    render();
    toast("Back to the original list.");
  });
  function disarm() {
    clearTimeout(resetArmed);
    resetArmed = null;
    resetBtn.textContent = "Reset list";
    resetBtn.classList.remove("armed");
  }

  // ---------- downloads ----------

  function slug() {
    return (state.title || "my-list").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "my-list";
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  $("#btn-download-text").addEventListener("click", () => {
    if (!requireCustomTitle()) return;
    const lines = [state.title, ""];
    state.shows.forEach((s, i) => {
      let line = (i + 1) + ". " + s.title + (s.years ? " (" + s.years + ")" : "");
      const marks = [];
      if (s.seen) marks.push("seen");
      if (s.want) marks.push("want to see");
      if (marks.length) line += "  [" + marks.join(", ") + "]";
      const url = wikiUrl(s);
      if (url) line += "  " + url;
      lines.push(line);
    });
    lines.push("", "Made with " + SITE_URL,
      "Remixed from The New York Times' \"The 100 Best TV Shows of the 21st Century\" (nytimes.com/bestTV)");
    downloadBlob(new Blob([lines.join("\n") + "\n"], { type: "text/plain;charset=utf-8" }), slug() + ".txt");
  });

  $("#btn-download-image").addEventListener("click", async () => {
    if (!requireCustomTitle()) return;
    const btn = $("#btn-download-image");
    btn.disabled = true;
    btn.textContent = "Rendering…";
    headlineEl.blur();
    sheetEl.classList.add("exporting");
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(sheetEl, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      canvas.toBlob((blob) => downloadBlob(blob, slug() + ".png"), "image/png");
    } catch (err) {
      toast("Sorry, the image couldn't be rendered.");
    } finally {
      sheetEl.classList.remove("exporting");
      btn.disabled = false;
      btn.textContent = "Download image";
    }
  });

  // ---------- toast ----------

  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3500);
  }

  // ---------- go ----------

  $("#site-link").href = SITE_URL;
  render();
})();
