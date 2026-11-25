// filters, page browser, document list, register search — no dependencies
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const slug = s => String(s).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "x";
// volume id → SSRQ citation form (AG_I_1 → AG I/1, ZH_NF_I_2_1 → ZH NF I/2/1); same rules as ssrq_print/names.py
const VOL_SPECIAL = {AR_AI_1: "AR/AI 1", BE_I_1_und_2: "BE I/1–2", GR_B_III_1_12: "GR B III/1.1–2",
  GR_B_III_1_34: "GR B III/1.3–4", Bischofszell_Teil_1: "TG II/2.1", Bischofszell_Teil_2: "TG II/2.2",
  Bischofszell_Teil_3: "TG II/2.3", Entlebuch_mit_Links: "LU II/3", Hinterrhein_mit_Links: "GR B III/2",
  Rheintal_mit_Links: "SG III/3", Sargans_mit_Links: "SG III/2", Registrum_Lombardorum: "FR I/3/7"};
const volLabel = v => {
  if (!v) return "";
  if (VOL_SPECIAL[v]) return VOL_SPECIAL[v];
  const k = /^thurgau_k(\d+)_low$/.exec(v); if (k) return `TG I/1.1, Karte ${k[1]}`;
  if (!/^[A-Z]{2}_/.test(v)) return v.replace(/_/g, " ");
  const t = v.split("_"), head = [t[0]], rest = t.slice(1), roman = x => /^[IVX]+$/.test(x);
  while (rest.length && !roman(rest[0]) && !/^\d/.test(rest[0])) head.push(rest.shift());
  let s;
  if (rest.length && roman(rest[0])) { head.push(rest.shift()); s = head.join(" ") + (rest.length ? "/" + rest.join("/") : ""); }
  else s = head.join(" ") + (rest.length ? " " + rest.join("/") : "");
  return s.replace(/-/g, "–");
};
const REL = {same: "zusammengeführt", sub: "Untereintrag", related: "verwandt"};
const fold = s => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ſ/g, "s").toLowerCase();

// date slider (two thumbs; markup and CSS from Vernetzte Schweiz: .ctl.wide > .yr-label + .rs + .yr-label)
function dateSlider(host, min, max, onChange, label = "Zeitraum") {
  if (!host || !(max > min)) return null;
  host.innerHTML = `<span>${label}</span><b class="yr-label">${min}</b><div class="rs"><div class="rs-track"></div><div class="rs-fill"></div>
    <input type="range" min="${min}" max="${max}" value="${min}" aria-label="von"><input type="range" min="${min}" max="${max}" value="${max}" aria-label="bis"></div>
    <b class="yr-label">${max}</b><button type="button" class="rs-reset" hidden>alle Jahre</button>`;
  const [a, b] = host.querySelectorAll("input"), [l1, l2] = host.querySelectorAll(".yr-label"), fill = host.querySelector(".rs-fill"),
        reset = host.querySelector(".rs-reset");
  const state = {lo: min, hi: max, active: false};
  const draw = () => {
    let lo = +a.value, hi = +b.value; if (lo > hi) [lo, hi] = [hi, lo];
    Object.assign(state, {lo, hi, active: lo > min || hi < max});
    l1.textContent = lo; l2.textContent = hi; reset.hidden = !state.active;
    fill.style.left = `${(lo - min) / (max - min) * 100}%`; fill.style.width = `${(hi - lo) / (max - min) * 100}%`;
  };
  a.addEventListener("input", () => { draw(); onChange(state); }); b.addEventListener("input", () => { draw(); onChange(state); });
  reset.addEventListener("click", () => { a.value = min; b.value = max; draw(); onChange(state); });
  draw();
  return state;
}
// a year (or [from, to]) passes the slider if the ranges overlap; undated items pass only without a filter
const inRange = (st, y0, y1 = y0) => !st || !st.active || (y0 != null && y1 >= st.lo && y0 <= st.hi);

// per-volume Stückverzeichnis: rows carry data-year
document.querySelectorAll("[data-yslider]").forEach(host => {
  const tab = document.getElementById(host.dataset.yslider), rows = [...tab.tBodies[0].rows];
  const ys = rows.map(r => parseInt(r.dataset.year)).filter(Boolean);
  if (ys.length < 2) return;
  dateSlider(host, Math.min(...ys), Math.max(...ys), st => rows.forEach(r => {
    const y = parseInt(r.dataset.year);
    r.style.display = r.classList.contains("grp") || inRange(st, isNaN(y) ? null : y) ? "" : "none";
  }));
});

document.querySelectorAll("input.filter[data-target]").forEach(inp => {
  const tgt = document.getElementById(inp.dataset.target);
  inp.addEventListener("input", () => {
    const q = fold(inp.value);
    tgt.querySelectorAll("li, tbody tr").forEach(el => { el.style.display = !q || fold(el.textContent).includes(q) ? "" : "none"; });
  });
});

// page browser: v/<VOL>/p.html#<pdf index>
const pager = $("#pager");
if (pager) fetch("pages.json").then(r => r.json()).then(data => {
  const P = data.pages, byIdx = new Map(P.map((p, k) => [p.i, k]));
  const show = () => {
    let k = byIdx.get(parseInt(location.hash.slice(1) || "0", 10)); if (k === undefined) k = 0;
    const p = P[k], prev = P[k - 1], next = P[k + 1];
    const starts = p.d.map(([id, no, t]) => `<li><a href="d/${slug(id.split("-").slice(1).join("-"))}.html">Nr. ${esc(no)}</a> ${esc(t)}</li>`).join("");
    pager.innerHTML = `<div class="bar">${prev ? `<a href="#${prev.i}">← vorige</a>` : ""}
      <b>S. ${esc(p.n ?? "–")}</b> <span class="meta">(PDF-Seite ${p.i + 1} von ${P.length})</span>
      ${next ? `<a href="#${next.i}">nächste →</a>` : ""}
      <a href="${esc(p.v)}" target="_blank">SSRQ Online ↗</a> <a href="${esc(data.pdf)}#page=${p.i + 1}" target="_blank">PDF ↗</a>
      <input size="5" placeholder="Seite" id="goto"></div>
      ${p.s ? `<p class="todo">OCR-Status: ${esc(p.s)}</p>` : ""}
      ${starts ? `<ul class="starts">Auf dieser Seite beginnt: ${starts}</ul>` : ""}
      ${p.h ? `<p class="hdr">${esc(p.h)}</p>` : ""}${p.b.map(b => b[1]).join("")}`;
    $("#goto").addEventListener("change", ev => {
      const want = ev.target.value.trim(), hit = P.find(x => String(x.n) === want);
      if (hit) location.hash = hit.i;
    });
    window.scrollTo(0, 0);
  };
  window.addEventListener("hashchange", show); show();
});

// super-Stückverzeichnis: filters (title, canton, group of the similarity map, years) and «ähnliche»: the related
// pieces of one piece in place of the list (#40, #50)
const dtab = $("#dtab");
if (dtab) Promise.all([fetch("documents.json").then(r => r.json()), fetch("groups.json").then(r => r.ok ? r.json() : {}).catch(() => ({}))]).then(([rows, groups]) => {
  const ys = rows.map(r => r[4]).filter(Boolean);
  const byId = {}; rows.forEach(r => { byId[r[0]] = r; });
  let yst = null, sim = null;  // sim: [piece row, [[row, score], …]]
  const gc = {}; rows.forEach(r => { if (r[8] >= 0) gc[r[8]] = (gc[r[8]] || 0) + 1; });
  $("#dg").insertAdjacentHTML("beforeend", Object.keys(gc).sort((a, b) => (groups[a] || "").localeCompare(groups[b] || ""))
    .map(g => `<option value="${g}">${esc(groups[g] || g)} (${gc[g]})</option>`).join(""));
  const href = r => r[7] === "e" ? `../e/${esc(r[1])}/d/${slug(r[0])}.html` : `../v/${esc(r[1])}/d/${slug(r[0].split("-").slice(1).join("-"))}.html`;
  const tr = (r, score) => `<tr><td><a href="../${r[7] === "e" ? "e" : "v"}/${esc(r[1])}/index.html">${esc(volLabel(r[1]))}</a></td><td class="no">${esc(r[3])}</td><td>${esc(r[5])}</td>
       <td><a href="${href(r)}">${esc(r[6])}</a>${r[7] === "e" ? ' <span class="pill tei">TEI</span>' : ""}${score != null ? ` <span class="meta">${score.toFixed(2)}</span>` : ""}</td>
       <td><button type="button" class="linkish" data-sim="${esc(r[0])}" title="die verwandten Stücke dieses Stücks">ähnliche</button></td></tr>`;
  const draw = () => {
    const g = $("#dg").value;
    if (sim) {
      const [p, hit] = sim;
      $("#dsim").innerHTML = `Ähnlich wie <b>${esc(volLabel(p[1]))} Nr. ${esc(p[3])}</b> ${esc(p[6])} · <a href="#" id="dsimx">zurück zur Liste</a>`;
      $("#dsimx").onclick = ev => { ev.preventDefault(); sim = null; draw(); };
      $("#dn").textContent = `${hit.length} verwandte Stücke`;
      dtab.tBodies[0].innerHTML = tr(p) + (hit.map(([r, s]) => tr(r, s)).join("") || '<tr><td colspan="5" class="todo">Keine verwandten Stücke.</td></tr>');
      return;
    }
    $("#dsim").innerHTML = g ? `Themengruppe <b>${esc(groups[g] || g)}</b> · <a href="aehnlichkeit.html#g=${g}">auf der Karte zeigen</a>` : "";
    const q = fold($("#dq").value), c = $("#dc").value;
    const hit = rows.filter(r => (!c || r[2] === c) && (!g || String(r[8]) === g) && (!q || fold(r[6]).includes(q)) && inRange(yst, r[4]));
    $("#dn").textContent = `${hit.length} Stücke${hit.length > 1000 ? " (erste 1000 angezeigt)" : ""}`;
    dtab.tBodies[0].innerHTML = hit.slice(0, 1000).map(r => tr(r)).join("");
  };
  dtab.addEventListener("click", async ev => {
    const b = ev.target.closest("[data-sim]");
    if (!b) return;
    const p = byId[b.dataset.sim];
    const rel = (await relOf(p[1], await relWeights()))[p[0]] || [];
    sim = [p, rel.filter(x => byId[x[1]] && x[2] > 0.05).sort((a, b) => b[2] - a[2]).slice(0, 15).map(x => [byId[x[1]], x[2]])];
    draw(); $("#dsim").scrollIntoView({block: "nearest"});
  });
  yst = dateSlider($("#dyears"), Math.min(...ys), Math.max(...ys), () => { sim = null; draw(); });
  ["#dq", "#dc", "#dg"].forEach(s => $(s).addEventListener("input", () => { sim = null; draw(); }));
  const hg = location.hash.match(/^#g=(\d+)$/); if (hg) $("#dg").value = hg[1];
  draw();
});


// ---------------------------------------------------------------- shared
const UP = document.body.dataset.up || "";
// same normalisation as ssrq_print.superindex.norm
const norm = s => String(s || "").replace(/ſ/g, "s").replace(/ß/g, "ss").normalize("NFKD").toLowerCase()
  .replace(/[̀-ͯ]/g, "").replace(/v/g, "u").replace(/j/g, "i").replace(/y/g, "i").replace(/w/g, "u")
  .replace(/(ae|oe|ue)/g, m => m[0]).replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const TYPE = {persons: "Personen", families: "Familien", places: "Orte", orgs: "Organisationen", subjects: "Sachen", glossary: "Glossar"};
const getJSON = (() => { const c = {}; return u => c[u] || (c[u] = fetch(u).then(r => r.ok ? r.json() : null)); })();
// related pieces, compact (s/rel/k/<vol>.json, #40): the weights of the piece pages (stored by the reader, else the
// defaults), and per piece its related pieces with one weighted score each
const REL_M = ["regest", "text", "terms", "titles"];
async function relWeights() {
  let w = await getJSON(`${UP}s/rel/w.json`) || {regest: 1, text: 1, terms: 1, titles: 1};
  try { const s = JSON.parse(localStorage.getItem("relw") || "null"); if (s) w = Object.assign({}, w, s); } catch (e) { /* defaults */ }
  return w;
}
async function relOf(vol, w) {
  const d = await getJSON(`${UP}s/rel/k/${vol}.json`);
  if (!d || !d.l) return {};
  const tot = REL_M.reduce((a, k) => a + (+w[k] || 0), 0) || 1;
  const out = {};
  for (const [p, ls] of Object.entries(d.l))
    out[p] = ls.map(([vi, q, ...v]) => [d.v[vi], q, REL_M.reduce((a, k, i) => a + (+w[k] || 0) * v[i], 0) / 100 / tot]);
  return out;
}

// ---------------------------------------------------------------- faceted search (s/suche.html, #16)
// facets with counts and several values each (s/search/f/<facet>.json: value -> record numbers), time per citation
// (f/dec.json: decade -> records and their citing pieces), sorting (f/n.json, f/y.json), pages of 50; the records
// themselves are loaded only for the page shown. The whole state is in the URL; old links (typ, kanton, band,
// normdaten, karte, jh) keep working.
const sform = $("#sform");
if (sform) (async () => {
  const base = "search/", meta = await getJSON(base + "meta.json"), N = meta.n;
  const params = new URLSearchParams(location.search + "&" + location.hash.slice(1));
  const list = k => (params.get(k) || "").split(",").filter(Boolean);
  const FAC = [["t", "Typ", "typ"], ["k", "Kanton", "kanton"], ["b", "Band", "band"], ["a", "Normdaten", "normdaten"],
               ["p", "Ortsart", "ort"], ["o", "Amt, Beruf", "amt"]];
  const SRC = {hls: "HLS", ssrq: "SSRQ-Personen", kf: "Königsfelden", idiotikon: "Idiotikon", lexer: "Lexer", dwb: "Grimm (DWB)",
    dwb2: "Grimm (DWB2)", drw: "Rechtswörterbuch (DRW)", fwb: "Frühnhd. Wörterbuch (FWB)", findeb: "Findebuch", bmz: "BMZ",
    loci: "SSRQ-Orte", wikidata: "Wikidata", amb: "mehrdeutig", none: "ohne Normdaten"};
  const label = (f, v) => f === "t" ? (TYPE[v] || v) : f === "k" ? (meta.cantons[v] || v) : f === "b" ? volLabel(v)
    : f === "a" ? (SRC[v] || v.toUpperCase()) : f === "o" ? v.replace(/^./, c => c.toUpperCase()) : v;
  const S = {q: params.get("q") || "", sel: {}, y0: null, y1: null, undated: params.get("ohne") !== "0",
             sort: params.get("sort") || "rel", page: +(params.get("seite") || 1), karte: params.get("karte") === "1",
             neu: params.get("neu") === "1"};
  FAC.forEach(([f, , p]) => { S.sel[f] = new Set(list(p)); });
  if (params.get("von")) { S.y0 = +params.get("von"); S.y1 = +(params.get("bis") || 1909); }
  else if (params.get("jh")) { S.y0 = (+params.get("jh") - 1) * 100; S.y1 = S.y0 + 99; }  // old links: century
  $("#sq").value = S.q;
  $("#facets").innerHTML = '<p class="meta">Facetten werden geladen …</p>';

  // ---- data: facet lists as Uint32Arrays, decade lists, sort arrays
  const decode = d => { const a = new Uint32Array(d.length); let x = 0; d.forEach((v, k) => { x += v; a[k] = x; }); return a; };
  const F = {};
  const [facs, decRaw, nArr, yArr] = await Promise.all([
    Promise.all([...FAC.map(([f]) => f), "m", "e"].map(f => getJSON(`${base}f/${f}.json`).then(o => [f, o || {}]))),
    getJSON(base + "f/dec.json"), getJSON(base + "f/n.json"), getJSON(base + "f/y.json")]);
  facs.forEach(([f, o]) => { F[f] = {}; Object.entries(o).forEach(([v, d]) => { F[f][v] = decode(d); }); });
  const DEC = Object.entries(decRaw || {}).map(([d, [ids, cnt]]) => [+d, decode(ids), cnt]);
  const dated = new Uint8Array(N); DEC.forEach(([, ids]) => ids.forEach(i => { dated[i] = 1; }));
  const nOf = nArr || [], yOf = yArr || [];

  // ---- masks
  const maskOf = (f) => {           // records passing facet f (null: no selection)
    const vs = [...S.sel[f]];
    if (!vs.length) return null;
    const m = new Uint8Array(N);
    vs.forEach(v => (F[f][v] || []).forEach(i => { m[i] = 1; }));
    return m;
  };
  let inRangeCnt = null;            // citations in the chosen decades
  const timeMask = () => {
    if (S.y0 == null) { inRangeCnt = null; return null; }
    inRangeCnt = new Uint16Array(N);
    const d0 = Math.floor((S.y0 - 1000) / 10), d1 = Math.floor((S.y1 - 1000) / 10);
    DEC.forEach(([d, ids, cnt]) => { if (d >= d0 && d <= d1) ids.forEach((i, k) => { inRangeCnt[i] += cnt[k]; }); });
    const m = new Uint8Array(N);
    for (let i = 0; i < N; i++) m[i] = inRangeCnt[i] > 0 || (S.undated && !dated[i]) ? 1 : 0;
    return m;
  };
  const ids = async w => {
    const ix = await getJSON(`${base}ix-${w.slice(0, 2).replace(/[^A-Za-z0-9._-]+/g, "_")}.json`) || {}, out = new Set();
    for (const [word, l] of Object.entries(ix)) if (word.startsWith(w)) l.forEach(i => out.add(i));
    return out;
  };
  const wordMask = async () => {
    const words = norm(S.q).split(" ").filter(w => w.length >= 2);
    if (!words.length) return [null, words];
    let cand = null;
    for (const w of words) { const s = await ids(w); cand = cand ? new Set([...cand].filter(i => s.has(i))) : s; }
    const m = new Uint8Array(N); cand.forEach(i => { m[i] = 1; });
    return [m, words];
  };
  const extra = () => {             // map / new volumes
    const ms = [];
    if (S.karte) { const m = new Uint8Array(N); (F.m["1"] || []).forEach(i => { m[i] = 1; }); ms.push(m); }
    if (S.neu) { const m = new Uint8Array(N); (F.e["1"] || []).forEach(i => { m[i] = 1; }); ms.push(m); }
    return ms;
  };
  const AND = (masks) => {
    const out = new Uint8Array(N).fill(1);
    masks.forEach(m => { if (m) for (let i = 0; i < N; i++) out[i] &= m[i]; });
    return out;
  };

  // ---- facet panel
  const drawFacets = (facetMasks, others) => {
    const box = $("#facets");
    const counts = f => {          // count each value against all other filters
      const b = AND([...others, ...FAC.filter(([g]) => g !== f).map(([g]) => facetMasks[g])]);
      return Object.entries(F[f]).map(([v, l]) => { let c = 0; l.forEach(i => { c += b[i]; }); return [v, c]; })
        .filter(([v, c]) => c > 0 || S.sel[f].has(v)).sort((a, b2) => f === "b" ? a[0].localeCompare(b2[0]) : b2[1] - a[1]);
    };
    box.innerHTML = FAC.map(([f, title]) => {
      const vals = counts(f);
      if (!vals.length) return "";
      const many = vals.length > 12;
      return `<fieldset class="ff ${many ? "many" : ""}" data-f="${f}"><legend>${title}${S.sel[f].size ? ` <a href="#" class="clr" data-f="${f}">alle</a>` : ""}</legend>
        ${many ? `<input class="ffq" placeholder="${title} filtern …">` : ""}<div class="ffl">${vals.map(([v, c]) =>
          `<label><input type="checkbox" value="${esc(v)}"${S.sel[f].has(v) ? " checked" : ""}> ${esc(label(f, v))} <span class="meta">${c.toLocaleString("de-CH")}</span></label>`).join("")}</div></fieldset>`;
    }).join("") + `<fieldset class="ff wide"><legend>Zeitraum der Belege</legend><svg id="sh-hist" viewBox="0 0 300 44" preserveAspectRatio="none"></svg>
        <div class="ctl wide" id="f-years"></div><label><input type="checkbox" id="f-undated"${S.undated ? " checked" : ""}> auch Einträge ohne datierte Belege</label></fieldset>
      <fieldset class="ff"><legend>Weitere</legend><label><input type="checkbox" id="f-karte"${S.karte ? " checked" : ""}> auf der Karte</label>
        <label><input type="checkbox" id="f-neu"${S.neu ? " checked" : ""}> in den TEI-Bänden</label></fieldset>
      <fieldset class="ff"><legend>Sortierung</legend><select id="f-sort">${[["rel", "meiste Belege"], ["range", "Belege im Zeitraum"],
        ["alpha", "alphabetisch"], ["chrono", "chronologisch"]].map(([k, t]) => `<option value="${k}"${S.sort === k ? " selected" : ""}>${t}</option>`).join("")}</select></fieldset>`;
    const st = dateSlider($("#f-years"), 1000, 1909, s2 => { S.y0 = s2.active ? s2.lo : null; S.y1 = s2.active ? s2.hi : null; S.page = 1; schedule(); }, "");
    if (st && S.y0 != null) { const [a, b] = $("#f-years").querySelectorAll("input"); a.value = S.y0; b.value = S.y1; a.dispatchEvent(new Event("input")); }
    box.querySelectorAll(".ffq").forEach(q => q.addEventListener("input", () => {
      const t = fold(q.value); q.nextElementSibling.querySelectorAll("label").forEach(l => { l.hidden = t && !fold(l.textContent).includes(t); });
    }));
  };
  $("#facets").addEventListener("change", ev => {
    const t = ev.target, fs = t.closest("[data-f]");
    if (fs && t.type === "checkbox") { const set = S.sel[fs.dataset.f]; t.checked ? set.add(t.value) : set.delete(t.value); }
    else if (t.id === "f-undated") S.undated = t.checked;
    else if (t.id === "f-karte") S.karte = t.checked;
    else if (t.id === "f-neu") S.neu = t.checked;
    else if (t.id === "f-sort") S.sort = t.value;
    S.page = 1; run();
  });
  $("#facets").addEventListener("click", ev => {
    const c = ev.target.closest(".clr"); if (!c) return;
    ev.preventDefault(); S.sel[c.dataset.f].clear(); S.page = 1; run();
  });

  // ---- results
  const chunks = {};
  const rec = async i => { const k = Math.floor(i / meta.chunk); chunks[k] = chunks[k] || await getJSON(`${base}rec-${k}.json`); return chunks[k][i % meta.chunk]; };
  const writeURL = () => {
    const h = new URLSearchParams();
    if (S.q) h.set("q", S.q);
    FAC.forEach(([f, , p]) => { if (S.sel[f].size) h.set(p, [...S.sel[f]].join(",")); });
    if (S.y0 != null) { h.set("von", S.y0); h.set("bis", S.y1); }
    if (!S.undated) h.set("ohne", "0");
    if (S.karte) h.set("karte", "1");
    if (S.neu) h.set("neu", "1");
    if (S.sort !== "rel") h.set("sort", S.sort);
    if (S.page > 1) h.set("seite", S.page);
    history.replaceState(null, "", "?" + h.toString());
  };
  let tmo = null;
  const schedule = () => { clearTimeout(tmo); tmo = setTimeout(run, 200); };
  async function run() {
    writeURL();
    const [wm, words] = await wordMask(), tm = timeMask(), others = [wm, tm, ...extra()];
    const facetMasks = {}; FAC.forEach(([f]) => { facetMasks[f] = maskOf(f); });
    const all = AND([...others, ...FAC.map(([f]) => facetMasks[f])]);
    const hits = []; for (let i = 0; i < N; i++) if (all[i]) hits.push(i);
    const alpha = S.sort === "alpha" ? await getJSON(base + "f/alpha.json") || [] : null;
    const key = {rel: i => -(nOf[i] || 0), range: i => -(inRangeCnt ? inRangeCnt[i] : nOf[i] || 0),
                 alpha: i => alpha[i] ?? i, chrono: i => yOf[i] || 99999}[S.sort] || (i => -(nOf[i] || 0));
    hits.sort((a, b) => key(a) - key(b) || a - b);
    drawFacets(facetMasks, others);
    // histogram of the hits' citations per decade
    const hist = new Array(91).fill(0), hm = all;
    DEC.forEach(([d, l, cnt]) => { if (d < 91) l.forEach((i, k) => { if (hm[i]) hist[d] += cnt[k]; }); });
    const mx = Math.max(1, ...hist), w = 300 / 91;
    $("#sh-hist").innerHTML = hist.map((c, d) => `<rect x="${d * w}" y="${44 - 42 * c / mx}" width="${w * .85}" height="${42 * c / mx}"
      class="${S.y0 == null || (1000 + 10 * d + 9 >= S.y0 && 1000 + 10 * d <= S.y1) ? "on" : ""}"><title>${1000 + 10 * d}er: ${c} Belege</title></rect>`).join("");
    // counts by type, clickable
    const byType = {};
    Object.entries(F.t).forEach(([t, l]) => { let c = 0; l.forEach(i => { c += all[i]; }); if (c) byType[t] = c; });
    const PER = 50, pages = Math.max(1, Math.ceil(hits.length / PER));
    S.page = Math.min(S.page, pages);
    $("#scount").innerHTML = `${hits.length.toLocaleString("de-CH")} Einträge` + (hits.length ? " — " + Object.entries(byType)
      .map(([t, n]) => `<a href="#" data-typ="${t}">${TYPE[t]} ${n.toLocaleString("de-CH")}</a>`).join(", ") : "");
    const shown = await Promise.all(hits.slice((S.page - 1) * PER, S.page * PER).map(rec));
    const hl = s => { let h = esc(s); words.forEach(w => { h = h.replace(new RegExp(`(^|[^\\p{L}])(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "giu"), "$1<mark>$2</mark>"); }); return h; };
    $("#shits").innerHTML = shown.filter(Boolean).map(r => `<li class="${r.t}"><a href="../r/eintrag.html#${r.i}"><b>${hl(r.l)}</b></a>
      ${r.v.length ? `<span class="var">(${hl(r.v.join(", "))})</span>` : ""} ${r.d ? "— " + hl(r.d) : ""}
      ${r.g ? `<span class="partof">→ <a href="../r/eintrag.html#${esc(r.g[0])}">${esc(r.g[1])}</a> (${esc(REL[r.g[2]] || r.g[2])})</span>` : ""}${r.s ? ` <span class="ty">${r.s} zugeordnete Einträge</span>` : ""}
      <div class="refs">${TYPE[r.t]} · ${r.n} Stücke${r.y && r.y.length ? ` · ${r.y[0]}–${r.y[1]}` : ""} · ${esc(r.b.map(volLabel).join(", "))}${r.m ? ` · <span class="pin" title="mit Koordinaten">⌖</span>` : ""}${r.e ? ` · ${r.e} in neuen Bänden` : ""}
      ${Object.entries(r.a || {}).filter(([, v]) => v === "match").map(([k]) => `<span class="ty">${k.toUpperCase()} ✓</span>`).join(" ")}</div></li>`).join("");
    $("#spages").innerHTML = pages > 1 ? `${S.page > 1 ? `<a href="#" data-p="${S.page - 1}">‹ zurück</a>` : ""} Seite ${S.page} von ${pages}
      ${S.page < pages ? `<a href="#" data-p="${S.page + 1}">weiter ›</a>` : ""}` : "";
  }
  $("#scount").addEventListener("click", ev => {
    const a = ev.target.closest("[data-typ]"); if (!a) return;
    ev.preventDefault(); S.sel.t = new Set([a.dataset.typ]); S.page = 1; run();
  });
  $("#spages").addEventListener("click", ev => {
    const a = ev.target.closest("[data-p]"); if (!a) return;
    ev.preventDefault(); S.page = +a.dataset.p; run(); sform.scrollIntoView({behavior: "smooth"});
  });
  sform.addEventListener("submit", ev => { ev.preventDefault(); S.q = $("#sq").value; S.page = 1; run(); });
  run();
})();

// ---------------------------------------------------------------- map (k/karte.html) and place cards
const bigmap = $("#bigmap");
if (bigmap && window.L) getJSON("places.json").then(pts => {
  const map = L.map(bigmap).setView([46.8, 8.2], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 17, attribution: "© OpenStreetMap"}).addTo(map);
  const layer = L.featureGroup().addTo(map);
  const marks = pts.map(([id, lab, lat, lon, n, vols, conf, span]) => [span, L.circleMarker([lat, lon], {
      radius: 4 + Math.sqrt(n) * 1.6, color: "#175b5b", weight: 1, fillColor: "#64c8c8", fillOpacity: conf === "möglich" ? .35 : .75})
    .bindPopup(`<b><a href="../r/eintrag.html#${id}">${esc(lab)}</a></b><br>${n} Stücke${span && span.length ? ` (${span[0]}–${span[1]})` : ""}<br>${esc(vols.map(volLabel).join(", "))}`)]);
  marks.forEach(([, m]) => m.addTo(layer));
  // focus on the core: the middle 90 % of the points (a few register places lie far away, e.g. Ungarn)
  if (pts.length) {
    const q = (arr, f) => arr.slice().sort((x, y) => x - y)[Math.floor((arr.length - 1) * f)];
    const la = pts.map(p => p[2]), lo = pts.map(p => p[3]);
    map.fitBounds([[q(la, .05), q(lo, .05)], [q(la, .95), q(lo, .95)]], {padding: [20, 20]});
  }
  const spans = pts.map(p => p[7]).filter(s => s && s.length);
  if (spans.length) dateSlider($("#myears"), Math.min(...spans.map(s => s[0])), Math.max(...spans.map(s => s[1])), st =>
    marks.forEach(([span, m]) => (inRange(st, span && span[0], span && span[1]) ? m.addTo(layer) : layer.removeLayer(m))));
});
const minimap = $("#minimap");
if (minimap && window.L) {
  const ll = [+minimap.dataset.lat, +minimap.dataset.lon], m = L.map(minimap, {scrollWheelZoom: false}).setView(ll, 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 17, attribution: "© OpenStreetMap"}).addTo(m);
  L.circleMarker(ll, {radius: 8, color: "#175b5b", fillColor: "#64c8c8", fillOpacity: .8}).addTo(m);
}

// ---------------------------------------------------------------- sankey (r/sankey.html)
const sk = $("#sankey");
if (sk && window.d3 && d3.sankey) getJSON("sankey.json").then(flows => {
  const names = [...new Set(flows.flatMap(f => [f[0], f[1]]))];
  const W = Math.max(760, sk.clientWidth), H = Math.max(420, names.length * 22);
  const graph = d3.sankey().nodeId(d => d.name).nodeWidth(14).nodePadding(10).extent([[1, 26], [W - 230, H - 6]])({
    nodes: names.map(name => ({name})), links: flows.map(([s, t, v]) => ({source: s, target: t, value: v}))});
  const svg = d3.select(sk).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const col = n => ({Personen: "#dc878c", Orte: "#64c8c8", Familien: "#d7b95a", Organisationen: "#a58fd0", Sachen: "#8fb3d9", Glossar: "#b8b8b8",
    "HLS verknüpft": "#d21938", "SSRQ/Königsfelden verknüpft": "#a81429", "mehrdeutig": "#d7b95a", "ohne Normdaten": "#c7c7c3"}[n] || "#7a4e14");
  const canton = Object.fromEntries(Object.entries({AG: "Aargau", AR: "Appenzell", BE: "Bern", FR: "Freiburg / Fribourg", GE: "Genève", GL: "Glarus",
    GR: "Graubünden", LU: "Luzern", NE: "Neuchâtel", SG: "St. Gallen", SH: "Schaffhausen", SO: "Solothurn", TG: "Thurgau", TI: "Ticino",
    VD: "Vaud", VS: "Wallis / Valais", ZG: "Zug", ZH: "Zürich"}).map(([k, v]) => [v, k]));
  const typ = Object.fromEntries(Object.entries(TYPE).map(([k, v]) => [v, k]));
  const nrm = {"HLS verknüpft": "hls", "SSRQ/Königsfelden verknüpft": "ssrq", "mehrdeutig": "amb", "ohne Normdaten": "none"};
  svg.append("g").selectAll("path").data(graph.links).join("path").attr("class", "link").attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", d => col(d.target.name)).attr("stroke-width", d => Math.max(1, d.width))
    .on("click", (ev, d) => {
      const p = new URLSearchParams();
      if (canton[d.source.name]) p.set("kanton", canton[d.source.name]);
      if (typ[d.source.name]) p.set("typ", typ[d.source.name]);
      if (typ[d.target.name]) p.set("typ", typ[d.target.name]);
      if (nrm[d.target.name]) p.set("normdaten", nrm[d.target.name]);
      location.href = `../s/suche.html#${p}`;
    }).append("title").text(d => `${d.source.name} → ${d.target.name}: ${d.value}`);
  [["Kanton des Bandes", 1], ["Typ des Registereintrags", (W - 230) / 2], ["Normdaten", W - 244]].forEach(([t, x]) =>
    svg.append("text").attr("x", x).attr("y", 14).attr("class", "colhead").text(t).style("font", "600 13px var(--font-nav)"));
  const node = svg.append("g").selectAll("g").data(graph.nodes).join("g").attr("class", "node");
  node.append("rect").attr("x", d => d.x0).attr("y", d => d.y0).attr("height", d => Math.max(1, d.y1 - d.y0))
    .attr("width", d => d.x1 - d.x0).attr("fill", d => col(d.name)).append("title").text(d => `${d.name}: ${d.value}`);
  node.append("text").attr("x", d => d.x1 + 6).attr("y", d => (d.y0 + d.y1) / 2).attr("dy", "0.35em").text(d => `${d.name} (${d.value})`);
});

// glossary: the definition gpt-oss wrote from the volumes' glossaries and the linked dictionaries (#5); the source tags
// [BAND] [DRW] … become labels linking the dictionary article
const DEFTAG = {idiotikon: "ID", drw: "DRW", fwb: "FWB", lexer: "LEXER", dwb: "DWB", dwb2: "DWB2"};
const definitionPanel = F => {
  const url = {}; F.s.forEach(([src, , u]) => { url[DEFTAG[src]] = u; });
  const tags = t => esc(t).replace(/\[([A-Z0-9]+)\]/g, (m, k) => k === "BAND" ? `<span class="dtag">Band</span>`
    : url[k] ? `<a class="dtag" href="${esc(url[k])}" target="_blank">${k}</a>` : `<span class="dtag">${k}</span>`);
  return `<div class="panel definition"><h2>Bedeutung</h2><p>${tags(F.t)}</p>
    ${F.x.length ? `<p class="meta">Abweichend:</p><ul>${F.x.map(x => `<li>${tags(x)}</li>`).join("")}</ul>` : ""}
    <p class="meta">Maschinell zusammengefasst (gpt-oss) aus den Glossaren der Bände und ${F.s.filter(s => !s[3]).map(([, c, u]) =>
      u ? `<a href="${esc(u)}" target="_blank">${esc(c)}</a>` : esc(c)).join(", ") || "—"}${F.s.some(s => s[3])
      ? `; anderes Wort und nicht verwendet: ${F.s.filter(s => s[3]).map(([, c, u]) => u ? `<a href="${esc(u)}" target="_blank">${esc(c)}</a>` : esc(c)).join(", ")}` : ""}.
    Prüfen Sie die Angaben an den Wörterbuchartikeln.</p></div>`;
};

// ---------------------------------------------------------------- register entry page (r/eintrag.html#<id>)
// after the keyword pages of the St. Galler Missiven: Sankey «Begleiter über die Zeit», «Über die Zeit», «Oft zusammen mit»,
// plus a faceted search over the pieces (canton, volume, date, keyword); every view follows the filters
const entryBox = $("#entry");
// persons (#8): what the registers say, structured — office, kinship, origin, rank, years, other names
const KIND_DE = {role: "Amt, Beruf", kin: "Verwandtschaft", origin: "Herkunft, Bürgerrecht, Wohnort", rank: "Stand", attested: "Belegt", alias: "Andere Namen"};
// places (#21): what the pieces say about the place (moved out of the description), and office holders named there
const pieceHref = (vol, id) => `../v/${vol}/d/${slug(id.includes("-") ? id.slice(id.indexOf("-") + 1) : id)}.html`;
function placeTopicsPanel(T, Of) {
  return `<div class="panel topics">${T.length ? `<h2>In den Stücken</h2><ul>${T.map(([text, vol, docs]) =>
      `<li>${esc(text)} <span class="meta">${esc(volLabel(vol))}</span>${docs.map(d => ` <a href="${pieceHref(vol, d)}">Nr. ${esc(d.slice(d.indexOf("-") + 1))}</a>`).join("")}</li>`).join("")}</ul>
    <p class="meta">Aus der Beschreibung des Ortseintrags im Register; verlinkt mit dem Stück an der angegebenen Stelle.</p>` : ""}
    ${Of.length ? `<h2>Personen im Ortseintrag</h2><ul>${Of.map(([role, name, vol]) => `<li>${esc(role)}: <a href="../s/suche.html?q=${encodeURIComponent(name)}">${esc(name)}</a> <span class="meta">${esc(volLabel(vol))}</span></li>`).join("")}</ul>` : ""}</div>`;
}
const XSRC = {kf: "Königsfelden", sg: "St. Galler Missiven", bullinger: "Bullinger Digital", thun: "Thuner Missiven"};
function statementsPanel(R) {
  const by = {};
  R.forEach(r => (by[r[0]] = by[r[0]] || []).push(r));
  const row = ([kind, value, where, tid, years, vol]) => `<li>${esc(value)}${where ? (kind === "kin"
      ? ` ${tid ? `<a href="#${esc(tid)}">${esc(where)}</a>` : esc(where)}` : ` <span class="where">${esc(where)}</span>`) : ""}${years ? ` <span class="meta">${esc(years)}</span>` : ""} <span class="meta">${esc(volLabel(vol))}</span></li>`;
  return `<div class="panel statements"><h2>Angaben aus den Registern</h2><dl>${Object.keys(KIND_DE).filter(k => by[k]).map(k =>
    `<dt>${KIND_DE[k]}</dt><dd><ul>${by[k].map(row).join("")}</ul></dd>`).join("")}</dl>
    <p class="meta">Aus den Beschreibungen der Registerzeilen und den Amtslisten zerlegt (maschinell); Verwandte verlinkt, wo der Eintrag eindeutig ist.</p></div>`;
}
// the former place card (k/o/<id>.html): coordinates, identifiers and a small map on the register entry
function placeCard([lat, lon, src, conf, hls, qid, kf]) {
  const ids = [hls && `<a href="https://hls-dhs-dss.ch/de/articles/${esc(hls)}/" target="_blank">HLS ${esc(hls)} ↗</a>`,
               qid && `<a href="https://www.wikidata.org/wiki/${esc(qid)}" target="_blank">Wikidata ${esc(qid)} ↗</a>`,
               kf && `Königsfelden ${esc(kf)}`].filter(Boolean);
  return `<div class="placebox"><dl><dt>Koordinaten</dt><dd>${lat.toFixed(5)}, ${lon.toFixed(5)}
    <a href="https://www.openstreetmap.org/?mlat=${lat}&amp;mlon=${lon}#map=13/${lat}/${lon}" target="_blank">OSM ↗</a></dd>
    <dt>Quelle</dt><dd>${esc(src)}${conf ? ` (${esc(conf)})` : ""}</dd>${ids.length ? `<dt>Kennungen</dt><dd>${ids.join(" · ")}</dd>` : ""}</dl>
    <div class="minimap" data-lat="${lat}" data-lon="${lon}"></div></div>`;
}
function drawMinimaps(root) {
  if (!window.L) return;
  root.querySelectorAll(".minimap[data-lat]:not(.leaflet-container)").forEach(el => {
    const ll = [+el.dataset.lat, +el.dataset.lon], m = L.map(el, {scrollWheelZoom: false}).setView(ll, 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 17, attribution: "© OpenStreetMap"}).addTo(m);
    L.circleMarker(ll, {radius: 8, color: "#175b5b", fillColor: "#64c8c8", fillOpacity: .8}).addTo(m);
  });
}
// the register list of the places: only those with coordinates (#k, the former list k/orte.html)
const konly = $("#konly");
if (konly) {
  const ul = $("ul.reg"), letters = [...document.querySelectorAll(".letters a")];
  const set = on => {
    ul.classList.toggle("konly", on);
    letters.forEach(a => a.href = a.href.split("#")[0] + (on ? "#k" : ""));
    if (on && location.hash !== "#k") history.replaceState(null, "", "#k");
    if (!on && location.hash === "#k") history.replaceState(null, "", location.pathname);
  };
  konly.checked = location.hash === "#k";
  set(konly.checked);
  konly.addEventListener("change", () => set(konly.checked));
}
if (entryBox) {
  const FILE = {person: "persons", family: "families", place: "places", org: "orgs", subject: "subjects", glossary: "glossary"};
  const shard = cid => { const m = cid.match(/^([a-z]+?)(\d+)$/); return m ? `data/${FILE[m[1]]}-${Math.floor(+m[2] / 1000)}.json` : null; };
  const entryOf = async cid => { const f = shard(cid); const d = f && await getJSON(f); return d ? d[cid] : null; };
  const bin = y => Math.floor(y / 20) * 20;
  const render = async () => {
    const cid = decodeURIComponent(location.hash.slice(1));
    const [E, meta] = await Promise.all([entryOf(cid), getJSON("../s/search/meta.json")]);
    if (!E) {
      const moved = await getJSON("data/moved.json");  // an id merged into another one by a rebuild
      if (moved && moved[cid]) { location.replace("#" + encodeURIComponent(moved[cid])); return; }
      entryBox.innerHTML = `<p class="todo">Eintrag ${esc(cid)} nicht gefunden.</p>`; return;
    }
    const cantonOf = (meta && meta.volcanton) || {}, cantonName = (meta && meta.cantons) || {};
    document.title = `${E.l} · SSRQ Druckbände`;
    const auth = E.a.map(([src, id, name, url]) => url ? `<a href="${esc(url)}" target="_blank">${src.toUpperCase()} ${esc(id)} ${esc(name)} ↗</a>` : `${src.toUpperCase()} ${esc(id)} ${esc(name)}`);
    entryBox.innerHTML = `<div class="panel doc-head entry-head"><p class="kicker">${TYPE[E.t]}</p><h1>${esc(E.l)}</h1>
      ${E.v.length ? `<p class="meta">Schreibweisen: ${esc(E.v.join(", "))}</p>` : ""}${E.d ? `<p>${esc(E.d)}</p>` : ""}
      ${E.V ? `<p class="xref">Verweis: siehe ${E.V.map(t => `<a href="../s/suche.html?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join(", ")}</p>` : ""}
      ${E.Pt ? `<p class="meta">Im Register auch unter: ${E.Pt.map(esc).join(", ")}</p>` : ""}
      ${E.S ? `<p class="xref">Siehe auch: ${E.S.map(([i, l]) => `<a href="#${esc(i)}">${esc(l)}</a>`).join(", ")}</p>` : ""}
      ${E.Fn ? `<p class="meta">Flurname${E.Fn[0].length ? " · Gde " + esc(E.Fn[0].join(", ")) : ""}${E.Fn[1] ? " · " + esc(E.Fn[1]) : ""}</p>` : ""}
      ${E.X ? `<p class="flags">${E.X.map(esc).join(" ")} <span class="meta">(maschinelle Prüfung)</span></p>` : ""}
      ${E.P ? `<details class="dupes"><summary>Möglicherweise dieselbe Person (${E.P.length})</summary><ul>${E.P.map(([i, l, v, why]) => `<li><a href="#${esc(i)}">${esc(l)}</a> — <i>${esc(v)}</i>: ${esc(why.join("; "))}</li>`).join("")}</ul><p class="meta">Vorschläge aus dem Vergleich von Namen, Belegjahren, Ämtern und Normdaten; nicht zusammengeführt.</p></details>` : ""}
      ${E.Ol && E.Ol.length ? `<p class="offices">Amtslisten: ${E.Ol.map(([amt, vol, n, id]) => `<a href="aemter.html#${esc(id)}">${esc(amt)}</a> <span class="meta">${esc(volLabel(vol))}, ${n} Personen</span>`).join(" · ")}</p>` : ""}
      ${E.O && E.O.length ? `<p class="offices">Ämter: ${E.O.map(([amt, ort, vol, id]) => `<a href="aemter.html#${esc(id)}">${esc(amt)}${ort ? " (" + esc(ort) + ")" : ""}</a> <span class="meta">${esc(volLabel(vol))}</span>`).join(" · ")}</p>` : ""}
      ${E.G ? `<p class="partof">${esc((REL[E.G[2]] || E.G[2]).replace(/^./, c => c.toUpperCase()))} von <a href="#${esc(E.G[0])}"><b>${esc(E.G[1])}</b></a>${E.G[3] ? " — " + esc(E.G[3]) : ""}</p>` : ""}
      ${E.S && E.S.length ? `<details class="children" open><summary>${E.S.length} zugeordnete Einträge (Stücke zusammengefasst)</summary><ul>${E.S.map(([i, l, rel, q]) => `<li><span class="rel ${rel}">${esc(REL[rel] || rel)}</span> <a href="#${esc(i)}">${esc(l)}</a>${q && rel !== "same" ? " — " + esc(q) : ""}</li>`).join("")}</ul></details>` : ""}
      ${E.K ? placeCard(E.K) : ""}
      <p class="auth">${auth.join(" ")}</p><p class="links">
      ${E.m ? `<a href="../k/karte.html">Karte der Orte</a>` : ""}${E.e ? `<a href="../e/x/${esc(cid)}.html">in den neuen Bänden (${E.e})</a>` : ""}
      ${E.t === "glossary" ? `<a href="woerterbuecher.html?d=*&q=${encodeURIComponent(E.l)}">Wörterbücher ↔ Glossar</a>` : ""}
      <a href="${E.t}/${E.L}.html#${esc(cid)}">im Register ${TYPE[E.t]}, ${E.L}</a> <a href="../s/suche.html?q=${encodeURIComponent(E.l)}">in der Suche</a></p></div>`
      + (E.Q ? `<div class="panel xlinks"><h2>In anderen Quellen</h2><ul>${E.Q.map(([src, name, url, why]) =>
          `<li><b>${esc(XSRC[src] || src)}</b>: ${url ? `<a href="${esc(url)}" target="_blank">${esc(name)} ↗</a>` : esc(name)} <span class="meta">${esc(why)}</span></li>`).join("")}</ul>
          <p class="meta">Dieselbe Person über gemeinsame Kennungen (SSRQ-Personenregister, Metagrid); nicht aus Namensähnlichkeit erschlossen.</p></div>` : "")
      + (E.R ? statementsPanel(E.R) : "")
      + (E.T || E.Of ? placeTopicsPanel(E.T || [], E.Of || []) : "")
      + (E.B ? `<div class="panel bio"><h2>Kurzbiografie</h2><p>${esc(E.B.t).replace(/\[([^\]]+)\]/g, '<span class="cite">[$1]</span>')}</p>
          ${E.B.u.length ? `<p class="meta">Unsicher: ${E.B.u.map(esc).join(" ")}</p>` : ""}
          <p class="meta">Maschinell erstellt (${esc(E.B.m)}) aus den Angaben der Register und den Stücken, in denen die Person vorkommt; jeder Satz nennt seinen Beleg.</p></div>` : "")
      + (E.F ? definitionPanel(E.F) : "");
    drawMinimaps(entryBox);
    // the pieces citing it, with the entries they cite
    const docs = [];
    for (const [vol, ids] of Object.entries(E.D)) {
      const vd = await getJSON(`../s/docs/${vol}.json`) || {};
      ids.forEach(id => vd[id] && docs.push({id, vol, k: cantonOf[vol] || vol.split("_")[0], y: vd[id][0], date: vd[id][1], no: vd[id][2],
        title: vd[id][3], reg: vd[id][4], cites: vd[id][5], slug: vd[id][6], ed: vd[id][7] === "e"}));
    }
    docs.sort((a, b) => (a.y || 9999) - (b.y || 9999));
    // labels of the co-occurring entries (for the keyword facet, the chips and the Sankey)
    const coAll = {};
    docs.forEach(d => d.cites.forEach(c => { if (c !== cid) coAll[c] = (coAll[c] || 0) + 1; }));
    const ranked = Object.entries(coAll).sort((a, b) => b[1] - a[1]).slice(0, 150);
    const lab = {};
    await Promise.all(ranked.map(async ([c]) => { lab[c] = await entryOf(c); }));
    // abbreviations the register parser kept as entries ("b.", "t.") are no companions
    const usable = c => lab[c] && norm(lab[c].l).replace(/ /g, "").length >= 3;
    docs.forEach(d => { d.text = norm([d.title, d.reg, ...d.cites.filter(c => lab[c]).map(c => lab[c].l)].join(" ")); });

    // ---- facets: canton, volume, date, keyword (free text over title, regest and co-occurring entries; or one entry)
    const opt = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
    const count = key => { const n = {}; docs.forEach(d => n[d[key]] = (n[d[key]] || 0) + 1); return n; };
    const kc = count("k"), vc = count("vol");
    $("#efacets").innerHTML = `
      <fieldset class="wide"><legend>Stichwort</legend><input class="filter" id="eq" type="search" placeholder="Wort in Titel, Regest oder Register …">
        <select id="ekw">${opt("", "— Registereintrag wählen —")}${ranked.filter(([c]) => usable(c)).map(([c, n]) => opt(c, `${lab[c].l} (${n})`)).join("")}</select></fieldset>
      <fieldset><legend>Kanton</legend><select id="ek">${opt("", `alle (${docs.length})`)}${Object.keys(kc).sort().map(k => opt(k, `${cantonName[k] || k} (${kc[k]})`)).join("")}</select></fieldset>
      <fieldset><legend>Band</legend><select id="ev">${opt("", "alle")}${Object.keys(vc).sort().map(v => opt(v, `${volLabel(v)} (${vc[v]})`)).join("")}</select></fieldset>
      <fieldset class="wide"><legend>Datum</legend><div class="ctl wide" id="ey"></div></fieldset>
      <fieldset><legend>&nbsp;</legend><button type="button" class="rs-reset" id="ereset">alle Filter löschen</button></fieldset>`;
    const dated = docs.filter(d => d.y);
    let yst = null, click = null;
    const facetOK = d => {
      const q = norm($("#eq").value).split(" ").filter(w => w.length >= 2);
      if (q.length && !q.every(w => d.text.includes(w))) return false;
      if ($("#ekw").value && !d.cites.includes($("#ekw").value)) return false;
      if ($("#ek").value && d.k !== $("#ek").value) return false;
      if ($("#ev").value && d.vol !== $("#ev").value) return false;
      return inRange(yst, d.y);
    };

    // ---- views on the filtered pieces
    const draw = () => {
      const base = docs.filter(facetOK);
      const active = base.length !== docs.length;
      $("#ecount").textContent = active ? `${base.length} von ${docs.length} Stücken entsprechen den Filtern.` : `${docs.length} Stücke.`;
      const co = {};
      base.forEach(d => d.cites.forEach(c => { if (c !== cid && usable(c)) co[c] = (co[c] || 0) + 1; }));
      const top = Object.entries(co).sort((a, b) => b[1] - a[1]);
      $("#echips").innerHTML = top.slice(0, 40).map(([c, n]) => `<a href="#${c}" title="${TYPE[lab[c].t]}">${esc(lab[c].l)}<b>${n}</b></a>`).join("") || '<span class="meta">—</span>';
      // over time
      const bd = base.filter(d => d.y);
      if (dated.length) {
        const lo = bin(Math.min(...dated.map(d => d.y))) - 20, hi = bin(Math.max(...dated.map(d => d.y))) + 20, cnt = {};
        bd.forEach(d => cnt[bin(d.y)] = (cnt[bin(d.y)] || 0) + 1);
        const mx = Math.max(1, ...Object.values(cnt));
        let h = "";
        for (let b = lo; b <= hi; b += 20) h += `<div class="tbar" data-b="${b}"><span>${b}</span><div class="track"><div class="fill" style="width:${(cnt[b] || 0) / mx * 100}%"></div></div><span>${cnt[b] || ""}</span></div>`;
        $("#etime").innerHTML = h;
        $("#etime").querySelectorAll(".tbar").forEach(el => el.onclick = () => {
          const b = +el.dataset.b; setClick({label: `${b}–${b + 19}`, test: d => d.y && bin(d.y) === b});
        });
      } else $("#etime").innerHTML = '<p class="meta">Keine datierten Stücke.</p>';
      // sankey: entry -> companions (top 10) -> twenty-year periods
      const sk = $("#esankey"); sk.innerHTML = "";
      const comps = top.slice(0, 10).map(([c]) => c);
      if (window.d3 && d3.sankey && comps.length && bd.length) {
        const nodes = [{id: cid, name: E.l, kind: "e"}], links = [], per = new Set(), cp = {};
        comps.forEach(c => { nodes.push({id: c, name: lab[c].l, kind: "c"}); links.push({source: cid, target: c, value: co[c]}); });
        bd.forEach(d => d.cites.forEach(c => { if (comps.includes(c)) { const k = c + "|" + bin(d.y); cp[k] = (cp[k] || 0) + 1; per.add(bin(d.y)); } }));
        [...per].sort((a, b) => a - b).forEach(b => nodes.push({id: "p" + b, name: `${b}–${b + 19}`, kind: "p", b}));
        Object.entries(cp).forEach(([k, v]) => { const [c, b] = k.split("|"); links.push({source: c, target: "p" + b, value: v}); });
        const W = Math.max(720, sk.clientWidth), H = Math.max(320, Math.max(comps.length, per.size) * 34);
        const g = d3.sankey().nodeId(d => d.id).nodeWidth(16).nodePadding(10).nodeSort(null).extent([[200, 6], [W - 200, H - 6]])({nodes, links});
        const svg = d3.select(sk).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
        svg.append("g").selectAll("path").data(g.links).join("path").attr("class", "lnk").attr("d", d3.sankeyLinkHorizontal())
          .attr("fill", "none").attr("stroke", "#d6d6d3").attr("stroke-opacity", .9).attr("stroke-width", d => Math.max(1, d.width))
          .on("mouseover", function () { d3.select(this).attr("stroke", "#e9a3ae"); })
          .on("mouseout", function () { d3.select(this).attr("stroke", "#d6d6d3"); })
          .on("click", (ev, d) => {
            const c = d.source.kind === "c" ? d.source : d.target;
            setClick(d.target.kind === "p"
              ? {label: `${c.name}, ${d.target.name}`, test: x => x.cites.includes(c.id) && x.y && bin(x.y) === d.target.b}
              : {label: c.name, test: x => x.cites.includes(c.id)});
          }).append("title").text(d => `${d.source.name} → ${d.target.name}: ${d.value}`);
        const nd = svg.append("g").selectAll("g").data(g.nodes).join("g");
        nd.append("rect").attr("x", d => d.x0).attr("y", d => d.y0).attr("width", d => d.x1 - d.x0).attr("height", d => Math.max(2, d.y1 - d.y0))
          .attr("fill", d => d.kind === "e" ? "#212529" : d.kind === "c" ? "#6b6b6b" : "#4a4a4a")
          .on("click", (ev, d) => d.kind === "c" ? setClick({label: d.name, test: x => x.cites.includes(d.id)})
            : d.kind === "p" ? setClick({label: d.name, test: x => x.y && bin(x.y) === d.b}) : setClick(null));
        const t = nd.append("text").attr("y", d => (d.y0 + d.y1) / 2).attr("dy", "0.35em")
          .attr("x", d => d.kind === "e" ? d.x0 - 10 : d.x1 + 8).attr("text-anchor", d => d.kind === "e" ? "end" : "start");
        t.append("tspan").text(d => d.name.length > 40 ? d.name.slice(0, 38) + "…" : d.name);
        t.append("tspan").attr("class", "n").text(d => d.kind === "e" ? "" : ` ${d.value}`);
        $("#esankey-note").textContent = `Von «${E.l}» zu den Einträgen, die am häufigsten in denselben Stücken vorkommen, und weiter zu den zwanzig Jahren dieser Stücke${active ? " (nur die gefilterten Stücke)" : ""}. Die Breite eines Bands ist die Zahl der Stücke mit beiden Einträgen; ein Stück mit mehreren dieser Begleiter zählt bei jedem. Ein Klick auf ein Band oder ein Feld filtert die Stücke unten.`;
      } else $("#esankey-note").textContent = "Zu wenig gemeinsame, datierte Stücke für eine Darstellung.";
      drawList(base);
    };
    let drawList = base => {
      const shown = base.filter(d => !click || click.test(d));
      $("#edocs-h").textContent = `Stücke (${shown.length}${shown.length !== docs.length ? ` von ${docs.length}` : ""})`;
      $("#efilter").innerHTML = click ? `Auswahl: ${esc(click.label)} <a href="#${esc(cid)}" id="eclear">aufheben</a>` : "";
      if (click) $("#eclear").onclick = ev => { ev.preventDefault(); setClick(null, false); };
      const qw = norm($("#eq").value).split(" ").filter(w => w.length >= 2);
      const hl = s => { let h = esc(s); qw.forEach(w => { h = h.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>"); }); return h; };
      $("#edocs").tBodies[0].innerHTML = shown.map(d => `<tr><td class="no">${esc(d.date || d.y || "")}</td>
        <td class="no"><a href="../${d.ed ? "e" : "v"}/${esc(d.vol)}/index.html">${esc(volLabel(d.vol))}</a> ${esc(d.no)}${d.ed ? ' <span class="pill tei">TEI</span>' : ""}</td>
        <td><a href="../${d.ed ? "e" : "v"}/${esc(d.vol)}/d/${esc(d.slug)}.html"><b>${hl(d.title)}</b></a>${d.reg ? `<br><span class="meta">${hl(d.reg)}</span>` : ""}</td></tr>`).join("");
    };
    // «Auch verwandt» (#40): pieces close to many of the pieces shown that do not cite this entry; the related
    // pieces of the volumes with most hits (at most 12 volumes)
    const W = await relWeights(), relBy = {};
    const vtop = Object.entries(E.D).sort((a, b) => b[1].length - a[1].length).slice(0, 12).map(x => x[0]);
    await Promise.all(vtop.map(async v => Object.assign(relBy, await relOf(v, W))));
    const drawRel = async shown => {
      const box = $("#erel"); if (!box) return;
      const mine = new Set(docs.map(d => d.id)), acc = {};
      shown.forEach(d => (relBy[d.id] || []).forEach(([v, q, s]) => {
        if (mine.has(q) || s < 0.2) return;
        const a = acc[q] || (acc[q] = {v, s: 0, n: 0}); a.s += s; a.n += 1;
      }));
      const top = Object.entries(acc).sort((a, b) => b[1].s - a[1].s).slice(0, 12);
      if (!top.length) { box.hidden = true; return; }
      const info = {};
      await Promise.all([...new Set(top.map(([, a]) => a.v))].map(async v => { info[v] = await getJSON(`../s/docs/${v}.json`) || {}; }));
      box.querySelector("ol").innerHTML = top.map(([q, a]) => {
        const r = info[a.v][q]; if (!r) return "";
        return `<li><a href="../${r[7] === "e" ? "e" : "v"}/${esc(a.v)}/d/${esc(r[6])}.html">${esc(volLabel(a.v))} Nr. ${esc(r[2])}</a> ${esc(r[3])}
          <span class="meta">${esc(r[1] || r[0] || "")}</span><span class="relwhy">verwandt mit ${a.n} ${a.n === 1 ? "Stück" : "Stücken"} oben · ${a.s.toFixed(2)}</span></li>`;
      }).join("");
      box.hidden = false;
    };
    const drawList0 = drawList;
    drawList = base => { drawList0(base); drawRel(base.filter(d => !click || click.test(d))); };
    const setClick = (f, scroll = true) => { click = f; drawList(docs.filter(facetOK)); if (scroll && f) $("#edocs-h").scrollIntoView({behavior: "smooth"}); };
    let tmo = null;
    const redraw = () => { clearTimeout(tmo); tmo = setTimeout(() => { click = null; draw(); }, 200); };
    if (dated.length > 1) yst = dateSlider($("#ey"), Math.min(...dated.map(d => d.y)), Math.max(...dated.map(d => d.y)), redraw, "");
    else $("#ey").innerHTML = '<span class="meta">—</span>';
    ["#eq", "#ekw", "#ek", "#ev"].forEach(sel => $(sel).addEventListener("input", redraw));
    $("#ereset").onclick = () => {
      ["#eq", "#ekw", "#ek", "#ev"].forEach(sel => { $(sel).value = ""; });
      const rs = $("#ey .rs-reset"); if (rs) rs.click(); click = null; draw();
    };
    draw();
    window.scrollTo(0, 0);
  };
  window.addEventListener("hashchange", render); render();
}

// ---------------------------------------------------------------- context of references (ssrq_print.refs)
// hover or keyboard focus on a reference shows what it cites: the target piece (number, title, date) or the
// external edition, and the cited lines (the cited one highlighted). Click follows the link as before.
(() => {
  let pop = null;
  const hide = () => { if (pop) { pop.remove(); pop = null; } };
  const show = a => {
    hide();
    let d; try { d = JSON.parse(a.dataset.ctx); } catch (e) { return; }
    const cited = (a.getAttribute("title") || "").match(/Z\. (\d+)/);
    const lines = (d.c || []).map(([n, t]) => `<div class="rl${cited && String(n) === cited[1] ? " on" : ""}">` +
      `${n != null ? `<span class="ln">${esc(n)}</span>` : ""}${esc(t)}</div>`).join("");
    pop = document.createElement("div");
    pop.className = "refpop";
    pop.innerHTML = `<div class="rh">${esc(d.l)}</div>${lines || '<div class="rl meta">— keine Zeilen verfügbar —</div>'}` +
      `<div class="rs">${d.k === "extern" ? "Text: e-periodica (OCR), kurzer Auszug" : "SSRQ, neu gelesen"} · Klick öffnet die Stelle</div>`;
    document.body.appendChild(pop);
    const r = a.getBoundingClientRect(), w = Math.min(460, window.innerWidth - 24);
    pop.style.width = w + "px";
    pop.style.left = Math.max(12, Math.min(window.scrollX + r.left, window.scrollX + window.innerWidth - w - 12)) + "px";
    pop.style.top = (window.scrollY + r.bottom + 6) + "px";
  };
  document.addEventListener("mouseover", ev => { const a = ev.target.closest("a.xref[data-ctx]"); if (a) show(a); });
  document.addEventListener("mouseout", ev => { if (ev.target.closest("a.xref[data-ctx]")) hide(); });
  document.addEventListener("focusin", ev => { const a = ev.target.closest("a.xref[data-ctx]"); if (a) show(a); });
  document.addEventListener("focusout", hide);
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") hide(); });
})();

// ---------------------------------------------------------------- reference tracking (s/verweise.html)
const lm = $("#linkmatrix");
if (lm && window.d3) getJSON("links.json").then(D => {
  if (!D) return;
  const LEV = {stueck: "Stück", seite: "Seite", band: "Band", extern: "extern"};
  const sel = () => ({k: $("#lkind").value, l: $("#llevel").value, b: $("#lbroken").checked});
  const vlab = Object.fromEntries(D.volumes.map(v => [v.id, v.label]));
  const draw = () => {
    const f = sel();
    const E = D.edges.filter(([s, t, k, lv, n, b]) => (!f.k || k === f.k) && (!f.l || lv === f.l) && (!f.b || b > 0) && t !== "?");
    const cell = new Map();
    for (const [s, t, k, lv, n, b] of E) {
      const key = s + "|" + t, c = cell.get(key) || {s, t, n: 0, b: 0};
      c.n += f.b ? b : n; c.b += b; cell.set(key, c);
    }
    const rows = [...new Set(E.map(e => e[0]))].sort((a, b) => D.volumes.findIndex(v => v.id === a) - D.volumes.findIndex(v => v.id === b));
    const cols = [...new Set(E.map(e => e[1]))].sort((a, b) => (a === "extern") - (b === "extern") ||
      D.volumes.findIndex(v => v.id === a) - D.volumes.findIndex(v => v.id === b));
    const S = 13, L = 110, T = 110;
    lm.innerHTML = "";
    const svg = d3.select(lm).append("svg").attr("width", L + cols.length * S + 10).attr("height", T + rows.length * S + 10);
    const max = d3.max([...cell.values()], c => c.n) || 1;
    const col = d3.scaleSequentialLog([1, max], d3.interpolateReds);
    svg.append("g").selectAll("text").data(rows).join("text").attr("x", L - 4).attr("y", (d, i) => T + i * S + S - 3)
      .attr("text-anchor", "end").attr("class", "mlab").text(d => vlab[d] || d);
    svg.append("g").selectAll("text").data(cols).join("text").attr("class", "mlab")
      .attr("transform", (d, i) => `translate(${L + i * S + S - 3},${T - 4}) rotate(-60)`).text(d => vlab[d] || d);
    const ri = new Map(rows.map((r, i) => [r, i])), ci = new Map(cols.map((c, i) => [c, i]));
    svg.append("g").selectAll("rect").data([...cell.values()]).join("rect")
      .attr("x", c => L + ci.get(c.t) * S).attr("y", c => T + ri.get(c.s) * S).attr("width", S - 1).attr("height", S - 1)
      .attr("fill", c => col(Math.max(1, c.n))).attr("stroke", c => c.b ? "#111" : (c.s === c.t ? "#888" : "none"))
      .attr("stroke-width", c => c.b ? 1.5 : .5).style("cursor", "pointer")
      .on("click", (ev, c) => detail(c.s, c.t))
      .append("title").text(c => `${vlab[c.s] || c.s} → ${vlab[c.t] || c.t}: ${c.n} Verweise${c.b ? `, ${c.b} gebrochen` : ""}`);
  };
  const detail = (s, t) => getJSON(`links/${s}.json`).then(R => {
    const f = sel();
    const rows = (R || []).filter(r => r[3] === t && (!f.l || r[6] === f.l) && (!f.b || !r[7]));
    $("#lsel-h").textContent = `Verweise ${vlab[s] || s} → ${vlab[t] || t}`;
    $("#lsel").textContent = `${rows.length} Verweise`;
    $("#ldetail").tBodies[0].innerHTML = rows.map(r =>
      `<tr><td><a href="../v/${s}/d/${slug(r[1])}.html">${esc(vlab[s] || s)} ${esc(r[0])}</a></td><td>${esc(r[2])}</td>` +
      `<td><a href="${esc(r[5])}">${esc(r[4] || r[5])}</a></td><td>${LEV[r[6]] || esc(r[6])}</td>` +
      `<td>${r[7] ? "ok" : "<b class=bad>gebrochen</b>"}</td></tr>`).join("");
  });
  ["lkind", "llevel", "lbroken"].forEach(id => $("#" + id).addEventListener("change", draw));
  draw();
  // per volume
  const per = {};
  for (const [s, t, k, lv, n, b] of D.edges) {
    const p = per[s] || (per[s] = {n: 0, same: 0, other: 0, ext: 0, st: 0, b: 0});
    p.n += n; p.b += b;
    if (k === "extern") p.ext += n; else if (s === t) p.same += n; else p.other += n;
    if (lv === "stueck") p.st += n;
  }
  $("#lvols").tBodies[0].innerHTML = Object.entries(per).sort((a, b) => b[1].n - a[1].n).map(([v, p]) =>
    `<tr><td><a href="../v/${v}/index.html">${esc(vlab[v] || v)}</a></td><td>${p.n}</td><td>${p.same}</td><td>${p.other}</td>` +
    `<td>${p.ext}</td><td>${Math.round(100 * p.st / Math.max(1, p.n - p.ext))} %</td><td>${p.b || ""}</td></tr>`).join("");
  getJSON("links_history.json").then(H => {
    if (!H) return;
    $("#lhist").tBodies[0].innerHTML = "<tr><th>Datum</th><th>Code</th><th>Bände</th><th>im Band</th><th>andere Bände</th><th>extern</th><th>aufs Stück</th><th>gebrochen</th></tr>" +
      H.slice().reverse().map(h => `<tr><td>${esc(h.date)}</td><td><code>${esc(h.commit)}</code></td><td>${h.volumes ?? ""}</td>` +
        `<td>${h["ssrq:im Band"] ?? 0}</td><td>${h["ssrq:anderer Band"] ?? 0}</td><td>${h["extern:extern"] ?? 0}</td>` +
        `<td>${h["Ebene stueck"] ?? 0}</td><td>${h["gebrochen"] ?? 0}</td></tr>`).join("");
  });
});

// ---------------------------------------------------------------- dictionaries <-> glossary (r/woerterbuecher.html)
const wtab = $("#wtab");
if (wtab) {
  const sel = $("#wdict"), q = $("#wq"), sure = $("#wsure");
  const prm = new URLSearchParams(location.search);
  if (prm.get("d")) sel.value = prm.get("d");
  if (prm.get("q")) q.value = prm.get("q");
  const NAME = Object.fromEntries([...sel.options].map(o => [o.value, o.textContent.replace(/ \(\d+\)$/, "")]));
  const fold = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[|*\-·.]/g, "").replace(/ſ/g, "s");
  const bare = u => String(u || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  let letter = "";
  const load = async () => {
    const srcs = sel.value === "*" ? [...sel.options].map(o => o.value).filter(v => v !== "*") : [sel.value];
    const parts = await Promise.all(srcs.map(s => getJSON(`data/dict-${s}.json`).then(d => (d || []).map(r => [s, ...r]))));
    return parts.flat();
  };
  const draw = async () => {
    const all = await load(), raw = q.value.trim(), t = fold(raw), url = /^https?:|\.(ch|de)\//.test(raw) ? bare(raw) : "";
    let hits = all.filter(([, id, lem, , u, , ents]) => {
      if (sure.checked && !ents.some(x => x[3])) return false;
      if (url) return bare(u) === url || bare(u).startsWith(url) || url.startsWith(bare(u));
      if (!t) return !letter || fold(lem).startsWith(letter);
      return fold(lem).includes(t) || String(id).toLowerCase() === raw.toLowerCase() || ents.some(x => fold(x[1]).includes(t));
    });
    if (t && !url) {  // exact matches first
      const rank = r => (fold(r[2]) === t || r[6].some(x => fold(x[1]) === t)) ? 0 : 1;
      hits = hits.map((r, i) => [rank(r), i, r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
    }
    $("#wcount").textContent = `${hits.length} Artikel` + (hits.length > 400 ? " — die ersten 400 gezeigt; Suche oder Buchstabe grenzt ein" : "");
    wtab.querySelector("tbody").innerHTML = hits.slice(0, 400).map(([s, id, lem, gram, u, cite, ents]) =>
      `<tr><td>${u ? `<a href="${esc(u)}" target="_blank"><b>${esc(lem)}</b> ↗</a>` : `<b>${esc(lem)}</b>`} ${gram ? `<i>${esc(gram)}</i>` : ""}
        <br><span class="meta">${esc(sel.value === "*" ? NAME[s] + " · " : "")}${esc(cite || id)}</span></td>
      <td>${ents.filter(x => !sure.checked || x[3]).map(([cid, lab, n, ok]) =>
        `<a href="eintrag.html#${esc(cid)}">${esc(lab)}</a>${ok ? "" : " ?"} <span class="meta">(${n} Stücke)</span>`).join("<br>")}</td></tr>`).join("");
    const ls = [...new Set(all.map(r => fold(r[2])[0]).filter(c => c && /[a-z]/.test(c)))].sort();
    $("#wletters").innerHTML = [["", "alle"], ...ls.map(c => [c, c.toUpperCase()])].map(([c, l]) =>
      `<a href="#" data-l="${c}"${c === letter && !t ? ' class="on"' : ""}>${l}</a>`).join(" ");
  };
  $("#wletters").addEventListener("click", ev => { const a = ev.target.closest("a[data-l]"); if (!a) return; ev.preventDefault(); letter = a.dataset.l; q.value = ""; draw(); });
  let tm; q.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(draw, 200); });
  sel.addEventListener("change", draw); sure.addEventListener("change", draw);
  draw();
}

// ---------------------------------------------------------------- «Bände»: all, printed or TEI volumes (#druck / #tei)
const kinds = document.getElementById("kinds");
if (kinds) {
  const show = kind => {
    document.querySelectorAll(".cantons .card").forEach(card => {
      let n = 0;
      card.querySelectorAll("li[data-kind]").forEach(li => { const on = !kind || li.dataset.kind === kind; li.hidden = !on; n += on; });
      card.hidden = !n;
    });
  };
  const fromHash = () => {
    const k = ["druck", "tei"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "";
    kinds.querySelector(`input[value="${k}"]`).checked = true;
    show(k);
  };
  kinds.addEventListener("change", ev => {
    const k = ev.target.value;
    history.replaceState(null, "", k ? "#" + k : location.pathname + location.search);
    show(k);
  });
  window.addEventListener("hashchange", fromHash);
  fromHash();
}

// related pieces (#40, epic #41): candidates with four normalised values, weighed in the browser
(function () {
  const box = document.querySelector("section.related[data-rel]");
  if (!box) return;
  const M = [["regest", "Regest"], ["text", "Quellentext"], ["terms", "Register"], ["titles", "Titel"]];
  const TYP = {persons: "Personen", places: "Orte", families: "Familien", orgs: "Organisationen", subjects: "Sachen", glossary: "Glossar"};
  const up = box.dataset.rel.replace(/s\/rel\/[^/]+$/, "");
  let W = JSON.parse(box.dataset.w);
  try { const s = JSON.parse(localStorage.getItem("relw") || "null"); if (s) W = Object.assign(W, s); } catch (e) { /* defaults */ }
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  getJSON(box.dataset.rel).then(data => {
    const rows = data && data[box.dataset.piece];
    if (!rows || !rows.length) return;
    box.hidden = false;
    const W0 = JSON.parse(box.dataset.w);
    box.innerHTML = `<h2>Verwandte Stücke</h2><details class="relw"><summary>Gewichtung <span class="meta"></span></summary>
      <div>${M.map(([k, l]) =>
      `<label>${l} <input type="range" min="0" max="1" step="0.05" value="${W[k] ?? 0}" data-k="${k}"></label>`).join("")}
      <button type="button" class="relreset">Voreinstellung</button></div></details><ol class="rel"></ol><p class="meta">Maschinell: Einbettungen von Regest bzw. Titel und Quellentext (qwen3-embedding-4b),
      gemeinsame Registereinträge, gemeinsame Wörter im Titel; je 0–1. Die Gewichte lassen sich verschieben (gilt für alle Stückseiten).
      <a href="${up}s/aehnlichkeit.html#${encodeURIComponent(box.dataset.piece)}">Auf der Karte zeigen</a></p>`;
    const ol = box.querySelector("ol.rel");
    const why = (k, w) => k === "terms" ? Object.entries(w).map(([t, n]) => `${n} ${TYP[t] || t}`).join(", ")
      : k === "titles" ? "«" + w.join(", ") + "»" : k === "text" && w ? `${w} ähnliche Abschnitte` : "";
    const sum = box.querySelector(".relw summary .meta");
    function draw() {
      sum.textContent = M.map(([k, l]) => `${l} ${(+W[k] || 0).toFixed(2)}`).join(" · ");
      const tot = M.reduce((a, [k]) => a + (+W[k] || 0), 0) || 1;
      const scored = rows.map(r => [M.reduce((a, [k], i) => a + (+W[k] || 0) * r[5][i], 0) / tot, r])
        .filter(x => x[0] > 0.05).sort((a, b) => b[0] - a[0]).slice(0, 10);
      ol.innerHTML = scored.map(([s, [href, vol, no, date, title, vals, w]]) =>
        `<li><a href="${up}${esc(href)}">${esc(vol)} Nr. ${esc(no)}</a> ${esc(title)} <span class="meta">${esc(date)}</span>
        <span class="relwhy">${M.map(([k, l], i) => vals[i] ? `${l} ${vals[i].toFixed(2)}${w[k] && why(k, w[k]) ? " (" + esc(why(k, w[k])) + ")" : ""}` : "").filter(Boolean).join(" · ")}</span></li>`).join("")
        || "<li class=todo>Keine verwandten Stücke mit diesen Gewichten.</li>";
    }
    box.querySelectorAll(".relw input").forEach(inp => inp.addEventListener("input", () => {
      W[inp.dataset.k] = +inp.value;
      try { localStorage.setItem("relw", JSON.stringify(W)); } catch (e) { /* not kept */ }
      draw();
    }));
    box.querySelector(".relreset").addEventListener("click", () => {
      W = Object.assign({}, W0);
      box.querySelectorAll(".relw input").forEach(inp => { inp.value = W[inp.dataset.k] ?? 0; });
      try { localStorage.removeItem("relw"); } catch (e) { /* not kept */ }
      draw();
    });
    draw();
  });
})();
