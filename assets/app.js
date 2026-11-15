// filters, page browser, document list, register search — no dependencies
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const slug = s => String(s).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "x";
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

// super-Stückverzeichnis
const dtab = $("#dtab");
if (dtab) fetch("documents.json").then(r => r.json()).then(rows => {
  const ys = rows.map(r => r[4]).filter(Boolean);
  let yst = null;
  const draw = () => {
    const q = fold($("#dq").value), c = $("#dc").value;
    const hit = rows.filter(r => (!c || r[2] === c) && (!q || fold(r[6]).includes(q)) && inRange(yst, r[4]));
    $("#dn").textContent = `${hit.length} Stücke${hit.length > 1000 ? " (erste 1000 angezeigt)" : ""}`;
    dtab.tBodies[0].innerHTML = hit.slice(0, 1000).map(r =>
      `<tr><td><a href="../${r[7] === "e" ? "e" : "v"}/${esc(r[1])}/index.html">${esc(r[1])}</a></td><td class="no">${esc(r[3])}</td><td>${esc(r[5])}</td>
       <td><a href="${r[7] === "e" ? `../e/${esc(r[1])}/d/${slug(r[0])}.html` : `../v/${esc(r[1])}/d/${slug(r[0].split("-").slice(1).join("-"))}.html`}">${esc(r[6])}</a>${r[7] === "e" ? ' <span class="pill tei">TEI</span>' : ""}</td></tr>`).join("");
  };
  yst = dateSlider($("#dyears"), Math.min(...ys), Math.max(...ys), draw);
  ["#dq", "#dc"].forEach(s => $(s).addEventListener("input", draw)); draw();
});


// ---------------------------------------------------------------- shared
const UP = document.body.dataset.up || "";
// same normalisation as ssrq_print.superindex.norm
const norm = s => String(s || "").replace(/ſ/g, "s").replace(/ß/g, "ss").normalize("NFKD").toLowerCase()
  .replace(/[̀-ͯ]/g, "").replace(/v/g, "u").replace(/j/g, "i").replace(/y/g, "i").replace(/w/g, "u")
  .replace(/(ae|oe|ue)/g, m => m[0]).replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const TYPE = {persons: "Personen", families: "Familien", places: "Orte", orgs: "Organisationen", subjects: "Sachen", glossary: "Glossar"};
const getJSON = (() => { const c = {}; return u => c[u] || (c[u] = fetch(u).then(r => r.ok ? r.json() : null)); })();

// ---------------------------------------------------------------- faceted search (s/suche.html)
const sform = $("#sform");
if (sform) (async () => {
  const base = "search/", meta = await getJSON(base + "meta.json");
  const params = new URLSearchParams(location.search + "&" + location.hash.slice(1));
  $("#sq").value = params.get("q") || "";
  const st = {typ: params.get("typ") || "", kanton: params.get("kanton") || "", band: params.get("band") || "",
              jh: params.get("jh") || "", norm: params.get("normdaten") || "", karte: params.get("karte") === "1", neu: false};
  const opt = (v, t, sel) => `<option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(t)}</option>`;
  $("#facets").innerHTML = `
    <fieldset><legend>Typ</legend><select id="f-typ">${opt("", "alle")}${Object.entries(TYPE).map(([k, v]) => opt(k, v, st.typ)).join("")}</select></fieldset>
    <fieldset><legend>Kanton</legend><select id="f-kanton">${opt("", "alle")}${Object.entries(meta.cantons).map(([k, v]) => opt(k, v, st.kanton)).join("")}</select></fieldset>
    <fieldset><legend>Band</legend><select id="f-band">${opt("", "alle")}${meta.volumes.map(v => opt(v, v, st.band)).join("")}</select></fieldset>
    <fieldset class="wide"><legend>Zeitraum der Stücke</legend><div class="ctl wide" id="f-years"></div></fieldset>
    <fieldset><legend>Normdaten</legend><select id="f-norm">${opt("", "alle")}${[["hls", "HLS verknüpft"], ["ssrq", "SSRQ verknüpft"], ["kf", "Königsfelden verknüpft"], ["amb", "mehrdeutig"], ["none", "ohne Normdaten"]].map(([k, v]) => opt(k, v, st.norm)).join("")}</select></fieldset>
    <fieldset><legend>Weitere</legend><label><input type="checkbox" id="f-karte"${st.karte ? " checked" : ""}> auf der Karte</label>
      <label><input type="checkbox" id="f-neu"> in neuen Bänden</label></fieldset>`;
  const chunks = {};
  const rec = async i => { const k = Math.floor(i / meta.chunk); chunks[k] = chunks[k] || await getJSON(`${base}rec-${k}.json`); return chunks[k][i % meta.chunk]; };
  const ids = async w => {
    const ix = await getJSON(`${base}ix-${w.slice(0, 2).replace(/[^A-Za-z0-9._-]+/g, "_")}.json`) || {}, out = new Set();
    for (const [word, list] of Object.entries(ix)) if (word.startsWith(w)) list.forEach(i => out.add(i));
    return out;
  };
  const passes = r => {
    const f = id => $(id).value;
    if (f("#f-typ") && r.t !== f("#f-typ")) return false;
    if (f("#f-kanton") && !r.k.includes(f("#f-kanton"))) return false;
    if (f("#f-band") && !r.b.includes(f("#f-band"))) return false;
    if (yst && yst.active && !(r.y && r.y.length && inRange(yst, r.y[0], r.y[1]))) return false;
    const n = f("#f-norm"), a = r.a || {};
    if (n === "amb" && !Object.values(a).includes("ambiguous")) return false;
    if (n === "none" && Object.values(a).some(x => x === "match" || x === "ambiguous")) return false;
    if (["hls", "ssrq", "kf"].includes(n) && a[n] !== "match") return false;
    if ($("#f-karte").checked && !r.m) return false;
    if ($("#f-neu").checked && !r.e) return false;
    return true;
  };
  const run = async () => {
    const words = norm($("#sq").value).split(" ").filter(w => w.length >= 2);
    let cand = null;
    for (const w of words) { const s = await ids(w); cand = cand ? new Set([...cand].filter(i => s.has(i))) : s; }
    if (!cand) cand = new Set([...Array(meta.n).keys()]);
    const all = [];
    for (const i of cand) { const r = await rec(i); if (r && passes(r)) all.push(r); }
    all.sort((a, b) => b.n - a.n || a.l.localeCompare(b.l));
    const byType = {}; all.forEach(r => byType[r.t] = (byType[r.t] || 0) + 1);
    $("#scount").textContent = `${all.length} Einträge` + (all.length ? " — " + Object.entries(byType).map(([t, n]) => `${TYPE[t]} ${n}`).join(", ") : "") + (all.length > 300 ? " (die ersten 300 angezeigt)" : "");
    const hl = s => { let h = esc(s); words.forEach(w => { h = h.replace(new RegExp(`(^|[^\\p{L}])(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "giu"), "$1<mark>$2</mark>"); }); return h; };
    $("#shits").innerHTML = all.slice(0, 300).map(r => `<li class="${r.t}"><a href="../r/eintrag.html#${r.i}"><b>${hl(r.l)}</b></a>
      ${r.v.length ? `<span class="var">(${hl(r.v.join(", "))})</span>` : ""} ${r.d ? "— " + hl(r.d) : ""}
      <div class="refs">${TYPE[r.t]} · ${r.n} Stücke · ${esc(r.b.join(", "))}${r.m ? ` · <a href="../k/o/${r.i}.html">Ortskarte</a>` : ""}${r.e ? ` · ${r.e} in neuen Bänden` : ""}
      ${Object.entries(r.a || {}).filter(([, v]) => v === "match").map(([k]) => `<span class="ty">${k.toUpperCase()} ✓</span>`).join(" ")}</div></li>`).join("");
  };
  let yst = null, tmo = null;
  yst = dateSlider($("#f-years"), meta.years[0], meta.years[1], () => { clearTimeout(tmo); tmo = setTimeout(run, 250); }, "");
  sform.addEventListener("submit", ev => { ev.preventDefault(); history.replaceState(null, "", "?q=" + encodeURIComponent($("#sq").value)); run(); });
  $("#facets").addEventListener("change", run);
  if ($("#sq").value || location.hash) run();
})();

// ---------------------------------------------------------------- map (k/karte.html) and place cards
const bigmap = $("#bigmap");
if (bigmap && window.L) getJSON("places.json").then(pts => {
  const map = L.map(bigmap).setView([46.8, 8.2], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 17, attribution: "© OpenStreetMap"}).addTo(map);
  const layer = L.featureGroup().addTo(map);
  const marks = pts.map(([id, lab, lat, lon, n, vols, conf, span]) => [span, L.circleMarker([lat, lon], {
      radius: 4 + Math.sqrt(n) * 1.6, color: "#175b5b", weight: 1, fillColor: "#64c8c8", fillOpacity: conf === "möglich" ? .35 : .75})
    .bindPopup(`<b><a href="o/${id}.html">${esc(lab)}</a></b><br>${n} Stücke${span && span.length ? ` (${span[0]}–${span[1]})` : ""}<br>${esc(vols.join(", "))}`)]);
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

// ---------------------------------------------------------------- register entry page (r/eintrag.html#<id>)
// after the keyword pages of the St. Galler Missiven: Sankey «Begleiter über die Zeit», «Über die Zeit», «Oft zusammen mit»,
// plus a faceted search over the pieces (canton, volume, date, keyword); every view follows the filters
const entryBox = $("#entry");
if (entryBox) {
  const FILE = {person: "persons", family: "families", place: "places", org: "orgs", subject: "subjects", glossary: "glossary"};
  const shard = cid => { const m = cid.match(/^([a-z]+?)(\d+)$/); return m ? `data/${FILE[m[1]]}-${Math.floor(+m[2] / 1000)}.json` : null; };
  const entryOf = async cid => { const f = shard(cid); const d = f && await getJSON(f); return d ? d[cid] : null; };
  const bin = y => Math.floor(y / 20) * 20;
  const render = async () => {
    const cid = decodeURIComponent(location.hash.slice(1));
    const [E, meta] = await Promise.all([entryOf(cid), getJSON("../s/search/meta.json")]);
    if (!E) { entryBox.innerHTML = `<p class="todo">Eintrag ${esc(cid)} nicht gefunden.</p>`; return; }
    const cantonOf = (meta && meta.volcanton) || {}, cantonName = (meta && meta.cantons) || {};
    document.title = `${E.l} · SSRQ Druckbände`;
    const auth = E.a.map(([src, id, name, url]) => url ? `<a href="${esc(url)}" target="_blank">${src.toUpperCase()} ${esc(id)} ${esc(name)} ↗</a>` : `${src.toUpperCase()} ${esc(id)} ${esc(name)}`);
    entryBox.innerHTML = `<div class="panel doc-head entry-head"><p class="kicker">${TYPE[E.t]}</p><h1>${esc(E.l)}</h1>
      ${E.v.length ? `<p class="meta">Schreibweisen: ${esc(E.v.join(", "))}</p>` : ""}${E.d ? `<p>${esc(E.d)}</p>` : ""}
      <p class="auth">${auth.join(" ")}</p><p class="links">
      ${E.m ? `<a href="../k/o/${esc(cid)}.html">Ortskarte</a>` : ""}${E.e ? `<a href="../e/x/${esc(cid)}.html">in den neuen Bänden (${E.e})</a>` : ""}
      <a href="${E.t}/${E.L}.html#${esc(cid)}">im Register ${TYPE[E.t]}, ${E.L}</a> <a href="../s/suche.html?q=${encodeURIComponent(E.l)}">in der Suche</a></p></div>`;
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
      <fieldset><legend>Band</legend><select id="ev">${opt("", "alle")}${Object.keys(vc).sort().map(v => opt(v, `${v} (${vc[v]})`)).join("")}</select></fieldset>
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
    const drawList = base => {
      const shown = base.filter(d => !click || click.test(d));
      $("#edocs-h").textContent = `Stücke (${shown.length}${shown.length !== docs.length ? ` von ${docs.length}` : ""})`;
      $("#efilter").innerHTML = click ? `Auswahl: ${esc(click.label)} <a href="#${esc(cid)}" id="eclear">aufheben</a>` : "";
      if (click) $("#eclear").onclick = ev => { ev.preventDefault(); setClick(null, false); };
      const qw = norm($("#eq").value).split(" ").filter(w => w.length >= 2);
      const hl = s => { let h = esc(s); qw.forEach(w => { h = h.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>"); }); return h; };
      $("#edocs").tBodies[0].innerHTML = shown.map(d => `<tr><td class="no">${esc(d.date || d.y || "")}</td>
        <td class="no"><a href="../${d.ed ? "e" : "v"}/${esc(d.vol)}/index.html">${esc(d.vol)}</a> ${esc(d.no)}${d.ed ? ' <span class="pill tei">TEI</span>' : ""}</td>
        <td><a href="../${d.ed ? "e" : "v"}/${esc(d.vol)}/d/${esc(d.slug)}.html"><b>${hl(d.title)}</b></a>${d.reg ? `<br><span class="meta">${hl(d.reg)}</span>` : ""}</td></tr>`).join("");
    };
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
