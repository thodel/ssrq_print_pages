// «Auswertung» (a/index.html, #17): facets at the top left, four linked views after Voyant —
// 1 Begriffe (list, cloud, key words), 2 Zeitverlauf, 3 Kontexte (KWIC from the published piece pages), 4 Umfeld.
// Data: a/meta.json, a/docs.json, a/ix/<k>.json, a/tf/<k>.json, a/top/<vol|_canton_coll>.json (ssrq_print/analysis.py).
// Uses $, esc, getJSON, volLabel, dateSlider from app.js (loaded before this deferred script).
(() => {
const root = document.getElementById("an");
if (!root) return;
const A = "./", UPP = "../";

// ---- spelling: the same rules as ssrq_print/corpus.py (form, norm)
const form = t => t.replace(/ſ/g, "s").toLowerCase();
const NORM = [[/[àáâ]/g, "a"], [/[èéê]/g, "e"], [/[ìíî]/g, "i"], [/[òóô]/g, "o"], [/[ùúûůʋ]/g, "u"], [/^i(?=[aeouäöü])/, "j"],
  [/æ/g, "ae"], [/œ/g, "oe"], [/ÿ/g, "y"], [/(?<=[aeiouäöü])h(?=[^aeiouäöü]|$)/g, ""], [/^v(?=[^aeiouäöüy])/, "u"],
  [/(?<=[^aeiouäöü])v(?=[^aeiouäöüy]|$)/g, "u"], [/(?<=[aeiouäöü])u(?=[aeiouäöü])/g, "v"], [/y/g, "i"],
  [/^j(?=[^aeiouäöü])/, "i"], [/(?<=[^aeiouäöü])j(?=[^aeiouäöü]|$)/g, "i"], [/th/g, "t"], [/dt$/, "t"],
  [/([bdfgklmnprtsz])\1+/g, "$1"], [/ů|uo/g, "u"]];
const nrm = f => NORM.reduce((s, [a, b]) => s.replace(a, b), f);
const TOK = /[\p{L}]+(?:['’][\p{L}]+)?/gu;
const key = w => { const k = w.slice(0, 2).toLowerCase().replace(/[^a-z0-9]/g, "_"); return k.length === 2 ? k : k + "_"; };
const STOP_WORDS = ("und der die das den dem des ein eine einen einem eines einer in an uf uff auf von vom zu ze zuo zum zur mit by bi " +
  "so als also oder ald alder aber ouch och auch nit nicht nüt nut wir ir er si sie es sy wie wo was daz dz dass das hie habe haben hand " +
  "hat hatt ist sind sin sie sige sye werden wirt wurde sol sollen solle sollend mag mögen wil all alle aller allen unser unsern iren ire " +
  "sinen sin siner sinem dis disen diser dises der den dem dero deren denen da do dan dann denn wenn wan als nach vor für fur fúr umb um " +
  "durch über uber under unter gen gegen biß bis hin her ietz jetz nun noch wol vil me mer mee kein dhein ain ainen ainem ainer an " +
  "et in de ad cum est quod qui que quae sui suis nos uobis per pro a ab ex non sed uel ac atque sunt esse item eius eis ipse ipsi hoc " +
  "la le les du des en au aux que qui pour par sur ung une son ses leur il ils est sont ce cy dicte dict ledit ladite lesdits " +
  "il lo la li di da del della che per con non sia e o al ai " +
  "sich im ihr ihm ihn ihnen inen innen sein seine seiner seinem seinen uns man bei ob daß dass deß dessen welche welcher welches " +
  "solch solche sölich söllich sollich jeder jede jedes ieder iedes sölle sollend sond sönd söllend mögend wellend wöllend " +
  "nur auch alß als ouch och hinder hinter neben zwüschen zwischen inn uß uss aus usser ausser one ohne sunder sondern dar dar " +
  "darum darumb daruf darauf darvon davon dardurch darin darinn harin herin wider widerumb wan wann ward wurd wurden würde were wäre " +
  "selb selbe selben selber derselb derselbe derselben dieselb dieselben dasselb deheinen deheinem dehein kein keine keinen nicht nichts " +
  "ir iro irer irem iren unß unsre unserer unserm unsers vns vnns unns vnd vnnd unnd dz das dass dhein ainich einich etlich etliche " +
  "damit worden wird wirdt doch wegen ander andere anderen anders alles ales zü zů zue züo mehr daran davon dahin dieweil weil diewil " +
  "sölle solle soll sollte söllent sollent habent hettend hettind hätten hette hatte haben han hand hend sind seind sint gsin gewesen sein sye " +
  "auff vff uber vnder vß vss vnd vf").split(" ");
const STOP = new Set(STOP_WORDS.filter(Boolean).map(w => nrm(form(w))));

// ---- state, kept in the URL hash
const S = {coll: "", kt: [], vols: [], y0: null, y1: null, undated: true, parts: ["source"], spell: "norm", stop: true,
           terms: [], m1: "list", dec: null};
const parseHash = () => {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.has("coll")) S.coll = h.get("coll");
  ["kt", "vols", "parts", "terms"].forEach(k => { if (h.has(k)) S[k] = h.get(k).split(",").filter(Boolean); });
  if (h.has("y")) { const [a, b] = h.get("y").split("-").map(Number); S.y0 = a; S.y1 = b; }
  if (h.has("undated")) S.undated = h.get("undated") === "1";
  if (h.has("spell")) S.spell = h.get("spell");
  if (h.has("stop")) S.stop = h.get("stop") === "1";
  if (h.has("m1")) S.m1 = h.get("m1");
  if (h.has("dec")) S.dec = +h.get("dec");
};
const writeHash = () => {
  const h = new URLSearchParams();
  if (S.coll) h.set("coll", S.coll);
  ["kt", "vols", "terms"].forEach(k => S[k].length && h.set(k, S[k].join(",")));
  if (S.parts.join() !== "source") h.set("parts", S.parts.join(","));
  if (S.y0 != null) h.set("y", `${S.y0}-${S.y1}`);
  if (!S.undated) h.set("undated", "0");
  if (S.spell !== "norm") h.set("spell", S.spell);
  if (!S.stop) h.set("stop", "0");
  if (S.m1 !== "list") h.set("m1", S.m1);
  if (S.dec != null) h.set("dec", S.dec);
  history.replaceState(null, "", "#" + h.toString());
};

let M, D, CANTON = {};
const fmt = n => n.toLocaleString("de-CH");
const decYear = d => M.dec0 + 10 * d;

// ---- selection helpers
const selVols = () => M.vols.map((v, i) => i).filter(i => {
  const [vol, , kt, coll] = M.vols[i];
  return (!S.coll || coll === S.coll) && (!S.kt.length || S.kt.includes(kt)) && (!S.vols.length || S.vols.includes(vol));
});
const decOK = d => d < 0 || d >= M.ndec ? S.undated
  : (S.y0 == null || (decYear(d) + 9 >= S.y0 && decYear(d) <= S.y1));
const yearOK = y => !y ? S.undated : (S.y0 == null || (y >= S.y0 && y <= S.y1));
const partIdx = () => S.parts.map(p => M.parts.indexOf(p)).filter(i => i >= 0);
const tokensIn = (vs, ps, d = null) => {
  let n = 0;
  for (const v of vs) for (const p of ps) M.tokens[v][p].forEach((c, k) => {
    const dd = k === M.ndec ? -1 : k;
    if ((d == null && decOK(dd)) || d === dd) n += c;
  });
  return n;
};

// ---- facets
async function facets() {
  const box = $("#an-facets");
  const cantons = {};
  M.vols.forEach(([vol, lab, kt, coll, n]) => { (cantons[kt] = cantons[kt] || {n: 0, vols: []}).n += n; cantons[kt].vols.push([vol, lab, coll, n]); });
  const kts = Object.keys(cantons).sort((a, b) => (CANTON[a] || a).localeCompare(CANTON[b] || b));
  box.innerHTML = `
    <fieldset><legend>Bestand</legend>${[["", "alle"], ["druck", "Druckbände"], ["tei", "TEI-Bände"]].map(([v, t]) =>
      `<label><input type="radio" name="coll" value="${v}"${S.coll === v ? " checked" : ""}> ${t}</label>`).join(" ")}</fieldset>
    <fieldset><legend>Kanton</legend><div class="an-list" id="f-kt">${kts.map(k =>
      `<label><input type="checkbox" value="${k}"${S.kt.includes(k) ? " checked" : ""}> ${esc(CANTON[k] || k)} <span class="meta">${fmt(cantons[k].n)}</span></label>`).join("")}</div></fieldset>
    <fieldset><legend>Band</legend><input class="filter" id="f-vq" placeholder="Band filtern …"><div class="an-list tall" id="f-vol"></div></fieldset>
    <fieldset class="wide"><legend>Zeitraum</legend><svg id="f-hist" viewBox="0 0 220 40" preserveAspectRatio="none"></svg><div class="ctl wide" id="f-years"></div>
      <label><input type="checkbox" id="f-undated"${S.undated ? " checked" : ""}> auch Stücke ohne Jahr</label></fieldset>
    <fieldset><legend>Textteil</legend>${M.parts.map(p => `<label><input type="checkbox" name="part" value="${p}"${S.parts.includes(p) ? " checked" : ""}> ${esc(M.part_de[p])}</label>`).join("")}</fieldset>
    <fieldset><legend>Schreibung</legend><label><input type="radio" name="spell" value="norm"${S.spell === "norm" ? " checked" : ""}> normalisiert</label>
      <label><input type="radio" name="spell" value="print"${S.spell === "print" ? " checked" : ""}> wie gedruckt</label>
      <label><input type="checkbox" id="f-stop"${S.stop ? " checked" : ""}> Funktionswörter ausblenden</label></fieldset>
    <div class="an-summary" id="an-sum"></div>`;
  const drawVols = () => {
    const q = fold($("#f-vq").value);
    $("#f-vol").innerHTML = M.vols.filter(([vol, lab, kt, coll]) => (!S.kt.length || S.kt.includes(kt)) && (!S.coll || coll === S.coll)
        && (!q || fold(lab + " " + vol).includes(q)))
      .map(([vol, lab, , coll, n]) => `<label><input type="checkbox" value="${vol}"${S.vols.includes(vol) ? " checked" : ""}> ${esc(lab)}${coll === "tei" ? ' <span class="pill tei">TEI</span>' : ""} <span class="meta">${fmt(n)}</span></label>`).join("");
  };
  drawVols();
  $("#f-vq").addEventListener("input", drawVols);
  const yrs = dateSlider($("#f-years"), M.dec0, M.dec0 + 10 * M.ndec - 1, st => {
    S.y0 = st.active ? st.lo : null; S.y1 = st.active ? st.hi : null; changed(); }, "");
  if (S.y0 != null && yrs) {
    const [a, b] = $("#f-years").querySelectorAll("input"); a.value = S.y0; b.value = S.y1; a.dispatchEvent(new Event("input"));
  }
  box.addEventListener("change", ev => {
    const t = ev.target;
    if (t.name === "coll") S.coll = t.value;
    else if (t.closest("#f-kt")) S.kt = [...box.querySelectorAll("#f-kt input:checked")].map(x => x.value);
    else if (t.closest("#f-vol")) S.vols = [...box.querySelectorAll("#f-vol input:checked")].map(x => x.value);
    else if (t.name === "part") S.parts = [...box.querySelectorAll("input[name=part]:checked")].map(x => x.value);
    else if (t.name === "spell") S.spell = t.value;
    else if (t.id === "f-stop") S.stop = t.checked;
    else if (t.id === "f-undated") S.undated = t.checked;
    if (t.name === "coll" || t.closest("#f-kt")) drawVols();
    changed();
  });
}

function summary() {
  const vs = new Set(selVols());
  let n = 0, y0 = 9999, y1 = 0;
  const hist = new Array(M.ndec).fill(0);
  D.forEach(([v, y]) => {
    if (!vs.has(v)) return;
    if (y) { const d = Math.floor((y - M.dec0) / 10); if (d >= 0 && d < M.ndec) hist[d]++; }
    if (!yearOK(y)) return;
    n++; if (y) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  });
  const toks = tokensIn([...vs], partIdx());
  $("#an-sum").innerHTML = `<h3>Auswahl</h3><dl><dt>Stücke</dt><dd>${fmt(n)}</dd><dt>Wörter</dt><dd>${fmt(toks)}</dd>
    <dt>Bände</dt><dd>${vs.size}</dd><dt>Zeitraum</dt><dd>${y1 ? `${y0}–${y1}` : "—"}</dd></dl>`;
  const mx = Math.max(1, ...hist), w = 220 / M.ndec;
  $("#f-hist").innerHTML = hist.map((c, d) => `<rect x="${d * w}" y="${40 - 38 * c / mx}" width="${w * .9}" height="${38 * c / mx}"
    class="${decOK(d) ? "on" : ""}"><title>${decYear(d)}er: ${c} Stücke</title></rect>`).join("");
}

// ---- view 1: Begriffe
async function topCounts() {
  // the selected volumes' top lists; whole cantons through the summed files
  const vs = selVols(), sel = new Set(vs), files = [], byGroup = {};
  M.vols.forEach(([vol, , kt, coll], i) => { (byGroup[`_${kt}_${coll}`] = byGroup[`_${kt}_${coll}`] || []).push(i); });
  const done = new Set();
  for (const [g, idx] of Object.entries(byGroup)) {
    if (idx.every(i => sel.has(i))) { files.push(g); idx.forEach(i => done.add(i)); }
  }
  vs.filter(i => !done.has(i)).forEach(i => files.push(M.vols[i][0]));
  const parts = S.parts, cnt = new Map();
  const data = await Promise.all(files.map(f => getJSON(`${A}top/${f}.json`)));
  for (const obj of data) {
    if (!obj) continue;
    for (const p of parts) for (const [w, decs] of obj[p] || []) {
      let c = 0;
      for (const [d, n] of decs) if (decOK(d)) c += n;
      if (c) cnt.set(w, (cnt.get(w) || 0) + c);
    }
  }
  return cnt;
}
let ALL = null;
async function allCounts() {
  if (ALL) return ALL;
  const groups = [...new Set(M.vols.map(([, , kt, coll]) => `_${kt}_${coll}`))];
  const data = await Promise.all(groups.map(g => getJSON(`${A}top/${g}.json`)));
  ALL = new Map();
  for (const obj of data) for (const p of S.parts) for (const [w, decs] of (obj || {})[p] || [])
    ALL.set(w, (ALL.get(w) || 0) + decs.reduce((s, [, n]) => s + n, 0));
  return ALL;
}
const ll = (a, b, c, d) => { // log-likelihood: a, b observed in selection / rest; c, d corpus sizes
  const e1 = c * (a + b) / (c + d), e2 = d * (a + b) / (c + d);
  return 2 * ((a ? a * Math.log(a / e1) : 0) + (b ? b * Math.log(b / e2) : 0));
};
async function view1() {
  const body = $("#v1 .body");
  body.innerHTML = '<p class="meta">Lädt …</p>';
  const cnt = await topCounts(), total = tokensIn(selVols(), partIdx());
  let rows = [...cnt].filter(([w]) => !(S.stop && STOP.has(w)) && w.length > 1);
  if (S.m1 === "keys") {
    const all = await allCounts(), allTotal = tokensIn(M.vols.map((v, i) => i), partIdx());
    rows = rows.map(([w, c]) => [w, c, ll(c, Math.max(0, (all.get(w) || c) - c), total, Math.max(1, allTotal - total))])
      .filter(([w, c]) => c / total > ((all.get(w) || c) / allTotal)).sort((a, b) => b[2] - a[2]);
  } else rows.sort((a, b) => b[1] - a[1]);
  rows = rows.slice(0, S.m1 === "cloud" ? 120 : 200);
  if (!rows.length) { body.innerHTML = '<p class="meta">Keine Wörter in dieser Auswahl.</p>'; return; }
  const per = c => (c / total * 10000).toFixed(c / total * 10000 < 10 ? 2 : 1);
  if (S.m1 === "cloud") {
    const mx = Math.log(rows[0][1]), mn = Math.log(rows[rows.length - 1][1]);
    const shuffled = rows.slice().sort((a, b) => a[0].localeCompare(b[0]));
    body.innerHTML = `<div class="an-cloud">${shuffled.map(([w, c]) => `<a href="#" data-w="${esc(w)}" title="${fmt(c)} Belege"
      style="font-size:${(0.8 + 1.9 * (Math.log(c) - mn) / Math.max(.01, mx - mn)).toFixed(2)}em">${esc(w)}</a>`).join(" ")}</div>`;
  } else {
    body.innerHTML = `<table class="an-tab"><thead><tr><th>Wort</th><th>Belege</th><th>pro 10'000</th>${S.m1 === "keys" ? "<th>LL</th>" : ""}</tr></thead><tbody>
      ${rows.map(([w, c, g]) => `<tr><td><a href="#" data-w="${esc(w)}">${esc(w)}</a></td><td>${fmt(c)}</td><td>${per(c)}</td>${S.m1 === "keys" ? `<td>${g.toFixed(0)}</td>` : ""}</tr>`).join("")}
      </tbody></table><p class="meta">Normalisierte Formen; ${S.m1 === "keys" ? "Wörter, die in der Auswahl häufiger sind als im ganzen Korpus (Log-Likelihood)" : "die häufigsten Wörter der Auswahl"}. Ein Klick zeigt Zeitverlauf, Kontexte und Umfeld.</p>`;
  }
}

// ---- word lookups
async function ixEntry(w) { const sh = await getJSON(`${A}ix/${key(w)}.json`); return sh ? sh[w] : null; }
async function expand(t) { // «zins*» -> the indexed words starting with it (normalised), most frequent first
  const p = nrm(form(t.replace(/\*$/, "")));
  if (!t.endsWith("*")) return [nrm(form(t))];
  const sh = await getJSON(`${A}ix/${key(p)}.json`) || {};
  return Object.entries(sh).filter(([w]) => w.startsWith(p)).sort((a, b) => b[1].n - a[1].n).slice(0, 30).map(([w]) => w);
}
const decode = delta => { let x = 0; return delta.map(d => (x += d)); };

// ---- view 2: Zeitverlauf
async function view2() {
  const body = $("#v2 .body");
  if (!S.terms.length) { body.innerHTML = '<p class="meta">Wörter oben eingeben oder in «Begriffe» anklicken.</p>'; return; }
  body.innerHTML = '<p class="meta">Lädt …</p>';
  const vs = new Set(selVols()), ps = new Set(partIdx()), series = [];
  for (const t of S.terms.slice(0, 6)) {
    const ws = await expand(t), byDec = new Array(M.ndec).fill(0);
    let unit = "tokens";
    for (const w of ws) {
      const tf = (await getJSON(`${A}tf/${key(w)}.json`) || {})[w];
      if (tf) { for (const [v, p, d, c] of tf) if (vs.has(v) && ps.has(p) && d >= 0 && decOK(d)) byDec[d] += c; }
      else {
        const ix = await ixEntry(w);
        if (!ix) continue;
        unit = "pieces";
        for (const i of decode(ix.p)) { const [v, y] = D[i]; if (vs.has(v) && y && yearOK(y)) { const d = Math.floor((y - M.dec0) / 10); if (d >= 0 && d < M.ndec) byDec[d]++; } }
      }
    }
    series.push({t, unit, vals: byDec});
  }
  // relative: per 10'000 words (tokens) or per 100 pieces of the period (pieces, rarer words)
  const piecesDec = new Array(M.ndec).fill(0);
  D.forEach(([v, y]) => { if (vs.has(v) && y) { const d = Math.floor((y - M.dec0) / 10); if (d >= 0 && d < M.ndec) piecesDec[d]++; } });
  const pts = series.map(s => ({t: s.t, unit: s.unit, pts: s.vals.map((c, d) => {
    if (!decOK(d)) return null;
    const base = s.unit === "tokens" ? [...vs].reduce((n, v) => n + [...ps].reduce((m, p) => m + M.tokens[v][p][d], 0), 0) : piecesDec[d];
    // a decade with very little text gives noise (one hit in 300 words): shown from 3000 words / 20 pieces on
    return base >= (s.unit === "tokens" ? 3000 : 20) ? {d, y: decYear(d), c, r: c / base * (s.unit === "tokens" ? 10000 : 100)} : null;
  }).filter(Boolean)}));
  const W = body.clientWidth || 520, H = 240, m = {l: 40, r: 10, t: 10, b: 24};
  const xs = pts.flatMap(s => s.pts.map(p => p.y)), ys = pts.flatMap(s => s.pts.map(p => p.r));
  if (!xs.length) { body.innerHTML = '<p class="meta">Keine datierten Belege in dieser Auswahl.</p>'; return; }
  const x = d3.scaleLinear().domain(d3.extent(xs)).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0, d3.max(ys) || 1]).nice().range([H - m.b, m.t]);
  const col = d3.scaleOrdinal(["#175b5b", "#b5462f", "#3b6fb6", "#8a6d1d", "#6b4c9a", "#2f7d3a"]);
  body.innerHTML = "";
  const svg = d3.select(body).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("class", "an-chart");
  svg.append("g").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")));
  svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5));
  pts.forEach((s, k) => {
    svg.append("path").datum(s.pts).attr("fill", "none").attr("stroke", col(k)).attr("stroke-width", 2)
      .attr("d", d3.line().x(p => x(p.y)).y(p => y(p.r)));
    svg.selectAll(null).data(s.pts).join("circle").attr("cx", p => x(p.y)).attr("cy", p => y(p.r)).attr("r", 3.5).attr("fill", col(k))
      .style("cursor", "pointer").on("click", (ev, p) => { S.dec = S.dec === p.d ? null : p.d; writeHash(); view3(); view4(); })
      .append("title").text(p => `${s.t}: ${p.y}er, ${fmt(p.c)} ${s.unit === "tokens" ? "Belege" : "Stücke"} (${p.r.toFixed(2)} ${s.unit === "tokens" ? "pro 10'000 Wörter" : "pro 100 Stücke"})`);
  });
  body.insertAdjacentHTML("beforeend", `<p class="legend">${pts.map((s, k) => `<span style="color:${col(k)}">■</span> ${esc(s.t)}${s.unit === "pieces" ? " (Stücke pro 100)" : ""}`).join(" ")}
    <span class="meta">pro 10'000 Wörter je Jahrzehnt; ein Klick auf einen Punkt zeigt die Kontexte dieses Jahrzehnts${S.dec != null ? ` — gewählt: ${decYear(S.dec)}er <a href="#" id="v2-clear">aufheben</a>` : ""}</span></p>`);
  const c = $("#v2-clear"); if (c) c.addEventListener("click", ev => { ev.preventDefault(); S.dec = null; writeHash(); view2(); view3(); view4(); });
}

// ---- view 3: Kontexte (KWIC) from the published piece pages
const SECTION = {edition: "source", heading: "heading", regest: "regest", description: "description", notes: "notes",
                 commentary: "commentary", apparatus: "apparatus"};
const pageCache = new Map();
async function pageParts(path) {
  if (pageCache.has(path)) return pageCache.get(path);
  const pr = fetch(UPP + path).then(r => r.ok ? r.text() : "").then(html => {
    const doc = new DOMParser().parseFromString(html, "text/html"), out = {};
    doc.querySelectorAll("main section").forEach(sec => {
      const part = Object.entries(SECTION).find(([c]) => sec.classList.contains(c));
      if (!part) return;
      sec.querySelectorAll(".ln, sup, h2, .pb").forEach(x => x.remove());
      const lines = [...sec.querySelectorAll(".l")].map(l => l.textContent.replace(/\s+$/, ""));
      const txt = (lines.length ? lines.join("\n") : sec.textContent)
        .replace(/(\p{L})[-‑¬]\s*\n\s*(?=[a-zäöüſß])/gu, "$1").replace(/(\p{L})[‑­](?=[a-zäöüſß])/gu, "$1")
        .replace(/\s*\|\s*/g, " ").replace(/\s+/g, " ").trim();
      out[part[1]] = (out[part[1]] ? out[part[1]] + " " : "") + txt;
    });
    return out;
  }).catch(() => ({}));
  pageCache.set(path, pr);
  return pr;
}
let KW = [];  // the current contexts: {w, left, hit, right, i (piece), part}
async function view3() {
  const body = $("#v3 .body");
  KW = [];
  if (!S.terms.length) { body.innerHTML = '<p class="meta">Noch kein Wort gewählt.</p>'; $("#v3-tools").innerHTML = ""; return; }
  const vs = new Set(selVols()), want = new Set(S.parts);
  const targets = new Set(), pieces = new Set();
  let total = 0;
  for (const t of S.terms.slice(0, 6)) for (const w of await expand(t)) {
    const ix = await ixEntry(w);
    if (!ix) continue;
    targets.add(w);
    total += ix.n;
    for (const i of decode(ix.p)) {
      const [v, y] = D[i];
      if (!vs.has(v) || !yearOK(y)) continue;
      if (S.dec != null && !(y && Math.floor((y - M.dec0) / 10) === S.dec)) continue;
      pieces.add(i);
    }
  }
  const printForms = new Set(S.spell === "print" ? S.terms.filter(t => !t.endsWith("*")).map(t => form(t)) : []);
  const all = [...pieces].sort((a, b) => (D[a][1] || 9999) - (D[b][1] || 9999));
  const MAXP = 150, pick = all.length <= MAXP ? all : Array.from({length: MAXP}, (_, k) => all[Math.round(k * (all.length - 1) / (MAXP - 1))]);
  body.innerHTML = `<p class="meta">Lädt ${pick.length} von ${fmt(all.length)} Stücken …</p>`;
  const queue = pick.slice(), workers = Array.from({length: 6}, async () => {
    while (queue.length) {
      const i = queue.shift(), parts = await pageParts(D[i][2]);
      for (const [part, txt] of Object.entries(parts)) {
        if (!want.has(part)) continue;
        const toks = [...txt.matchAll(TOK)];
        toks.forEach((m, k) => {
          const f = form(m[0]);
          const hit = printForms.size ? printForms.has(f) : targets.has(nrm(f));
          if (!hit) return;
          const a = toks[Math.max(0, k - 8)].index, b = toks[Math.min(toks.length - 1, k + 8)];
          KW.push({i, part, w: nrm(f), left: txt.slice(a, m.index), hit: m[0], right: txt.slice(m.index + m[0].length, b.index + b[0].length),
                   lctx: toks.slice(Math.max(0, k - 5), k).map(x => nrm(form(x[0]))), rctx: toks.slice(k + 1, k + 6).map(x => nrm(form(x[0])))});
        });
      }
    }
  });
  await Promise.all(workers);
  drawKwic(all.length, pick.length);
  view4();
}
let kwSort = "date";
function drawKwic(nAll, nLoaded) {
  const body = $("#v3 .body");
  const sorters = {date: (a, b) => (D[a.i][1] || 9999) - (D[b.i][1] || 9999), vol: (a, b) => D[a.i][2].localeCompare(D[b.i][2]),
    left: (a, b) => a.left.split(" ").reverse().join(" ").toLowerCase().localeCompare(b.left.split(" ").reverse().join(" ").toLowerCase()),
    right: (a, b) => a.right.toLowerCase().localeCompare(b.right.toLowerCase())};
  const rows = KW.slice().sort(sorters[kwSort]);
  $("#v3-tools").innerHTML = `Sortieren: ${[["date", "Datum"], ["vol", "Band"], ["left", "links"], ["right", "rechts"]].map(([k, t]) =>
    `<a href="#" data-sort="${k}" class="${kwSort === k ? "on" : ""}">${t}</a>`).join(" ")} · <a href="#" id="v3-csv">CSV</a>`;
  if (!rows.length) { body.innerHTML = `<p class="meta">Keine Fundstellen in den geladenen Stücken (${nLoaded} von ${fmt(nAll)}) und Textteilen.</p>`; return; }
  body.innerHTML = `<p class="meta">${fmt(rows.length)} Fundstellen in ${nLoaded} von ${fmt(nAll)} Stücken${nLoaded < nAll ? " (gleichmässig über die Zeit ausgewählt)" : ""}${S.dec != null ? `, nur ${decYear(S.dec)}er` : ""}.</p>
    <div class="an-kwic"><table><tbody>${rows.slice(0, 600).map(r => {
      const [v, y, path] = D[r.i];
      return `<tr><td class="l">${esc(r.left)}</td><td class="k">${esc(r.hit)}</td><td class="r">${esc(r.right)}</td>
        <td class="src"><a href="${UPP}${esc(path)}" target="_blank">${esc(volLabel(M.vols[v][0]))} ${esc(path.split("/").pop().replace(/\.html$/, "").replace(/^(?:SSRQ|SDS|FDS)-[A-Z]+-[^-]+-/, ""))}</a> ${y || ""}${r.part !== "source" ? ` <span class="meta">${esc(M.part_de[r.part])}</span>` : ""}</td></tr>`;
    }).join("")}</tbody></table></div>`;
}
$("#v3-tools") && document.addEventListener("click", ev => {
  const s = ev.target.closest("[data-sort]");
  if (s) { ev.preventDefault(); kwSort = s.dataset.sort; drawKwic(KW.length, KW.length); }
  if (ev.target.id === "v3-csv") {
    ev.preventDefault();
    const q = x => `"${String(x).replace(/"/g, '""')}"`;
    const csv = ["Band;Stück;Jahr;Textteil;links;Wort;rechts"].concat(KW.map(r => {
      const [v, y, path] = D[r.i];
      return [M.vols[v][0], path, y || "", M.part_de[r.part], r.left, r.hit, r.right].map(q).join(";");
    })).join("\n");
    const a = Object.assign(document.createElement("a"), {href: URL.createObjectURL(new Blob(["﻿" + csv], {type: "text/csv"})),
      download: `kontexte_${S.terms.join("_").replace(/[^\w]+/g, "_")}.csv`});
    a.click();
  }
});

// ---- view 4: Umfeld — collocates (± 5 words) and register entries of the pieces with hits
const FILE = {person: "persons", family: "families", place: "places", org: "orgs", subject: "subjects", glossary: "glossary"};
async function entryLabel(cid) {
  const m = cid.match(/^([a-z]+?)(\d+)$/); if (!m) return null;
  const d = await getJSON(`${UPP}r/data/${FILE[m[1]]}-${Math.floor(+m[2] / 1000)}.json`);
  return d && d[cid] ? d[cid].l : null;
}
async function view4() {
  const body = $("#v4 .body");
  if (!KW.length) { body.innerHTML = '<p class="meta">Erscheint, sobald Kontexte geladen sind.</p>'; return; }
  const all = await allCounts(), N = [...all.values()].reduce((a, b) => a + b, 0) || 1;
  const col = new Map(), targets = new Set(KW.map(r => r.w));
  let win = 0;
  KW.forEach(r => [...r.lctx, ...r.rctx].forEach(w => {
    win++;
    if (targets.has(w) || w.length < 2 || (S.stop && STOP.has(w))) return;
    col.set(w, (col.get(w) || 0) + 1);
  }));
  const scored = [...col].filter(([, c]) => c >= 2).map(([w, c]) => {
    const p = (all.get(w) || 1) / N, e = win * p;
    return [w, c, ll(c, Math.max(0, (all.get(w) || 1) - c), win, N), c / e];
  }).filter(r => r[3] > 1).sort((a, b) => b[2] - a[2]).slice(0, 25);
  // register entries cited by the pieces with hits (s/docs/<vol>.json: per piece [..., cites, slug])
  const ent = new Map(), byVol = {};
  [...new Set(KW.map(r => r.i))].forEach(i => { const [v, , path] = D[i]; (byVol[M.vols[v][0]] = byVol[M.vols[v][0]] || []).push(path); });
  for (const [vol, paths] of Object.entries(byVol)) {
    const sd = await getJSON(`${UPP}s/docs/${vol}.json`) || {};
    const bySlug = {};
    Object.values(sd).forEach(r => { if (r[6]) bySlug[r[6]] = r[5] || []; });
    paths.forEach(p => (bySlug[p.split("/").pop().replace(/\.html$/, "")] || []).forEach(c => ent.set(c, (ent.get(c) || 0) + 1)));
  }
  const topEnt = [...ent].sort((a, b) => b[1] - a[1]).slice(0, 18);
  const labels = await Promise.all(topEnt.map(([c]) => entryLabel(c)));
  body.innerHTML = `<div class="an-cols"><div><h3>Wörter in der Nähe <span class="meta">(± 5 Wörter)</span></h3>
      ${scored.length ? `<table class="an-tab"><thead><tr><th>Wort</th><th>gemeinsam</th><th>LL</th></tr></thead><tbody>${scored.map(([w, c, g]) =>
        `<tr><td><a href="#" data-w="${esc(w)}">${esc(w)}</a></td><td>${c}</td><td>${g.toFixed(0)}</td></tr>`).join("")}</tbody></table>` : '<p class="meta">Zu wenige Fundstellen.</p>'}</div>
    <div><h3>Registereinträge in denselben Stücken</h3>${topEnt.length ? `<ul class="an-ent">${topEnt.map(([c, n], k) => labels[k] ?
      `<li class="${(c.match(/^[a-z]+/) || [""])[0]}"><a href="${UPP}r/eintrag.html#${esc(c)}">${esc(labels[k])}</a> <span class="meta">${n} Stücke</span></li>` : "").join("")}</ul>` : '<p class="meta">Keine Registereinträge.</p>'}</div>
    <div><h3>Netz</h3><div id="v4-net"></div></div></div>`;
  network(scored.slice(0, 12), topEnt.slice(0, 8).map(([c, n], k) => [c, labels[k], n]).filter(x => x[1]));
}
function network(words, ents) {
  const host = $("#v4-net"); if (!host || !window.d3) return;
  const W = host.clientWidth || 320, H = 260;
  const center = {id: "_", label: S.terms.join(", "), kind: "term"};
  const nodes = [center, ...words.map(([w, c]) => ({id: "w:" + w, label: w, kind: "word", n: c})),
                 ...ents.map(([c, l, n]) => ({id: c, label: l, kind: "entry", n}))];
  const links = nodes.slice(1).map(n => ({source: "_", target: n.id, v: n.n}));
  const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("class", "an-net");
  const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(70))
    .force("charge", d3.forceManyBody().strength(-120)).force("center", d3.forceCenter(W / 2, H / 2)).force("collide", d3.forceCollide(18));
  const l = svg.append("g").selectAll("line").data(links).join("line").attr("class", "lk");
  const g = svg.append("g").selectAll("g").data(nodes).join("g").attr("class", d => "nd " + d.kind);
  g.append("circle").attr("r", d => d.kind === "term" ? 9 : 4 + Math.sqrt(d.n || 1));
  g.append("text").attr("dx", 8).attr("dy", 4).text(d => d.label.length > 24 ? d.label.slice(0, 23) + "…" : d.label);
  g.style("cursor", "pointer").on("click", (ev, d) => {
    if (d.kind === "word") setTerms([d.label]);
    else if (d.kind === "entry") window.open(`${UPP}r/eintrag.html#${d.id}`, "_blank");
  });
  sim.on("tick", () => {
    l.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
    g.attr("transform", d => `translate(${Math.max(10, Math.min(W - 10, d.x))},${Math.max(10, Math.min(H - 10, d.y))})`);
  });
}

// ---- wiring
function setTerms(ts) { S.terms = ts; S.dec = null; $("#an-term").value = ts.join(", "); writeHash(); view2(); view3(); }
let busy = null;
function changed() {
  writeHash(); ALL = null; summary();
  clearTimeout(busy); busy = setTimeout(() => { view1(); view2(); view3(); }, 250);
}
document.addEventListener("click", ev => {
  const a = ev.target.closest("[data-w]");
  if (a && root.contains(a)) { ev.preventDefault(); setTerms([a.dataset.w]); }
});
$("#an-q").addEventListener("submit", ev => {
  ev.preventDefault();
  setTerms($("#an-term").value.split(/[,;]+/).map(s => s.trim()).filter(Boolean));
});

(async () => {
  parseHash();
  [M, D] = await Promise.all([getJSON(A + "meta.json"), getJSON(A + "docs.json")]);
  if (!M || !D) { root.innerHTML = '<p class="todo">Die Daten der Auswertung sind noch nicht erzeugt.</p>'; return; }
  CANTON = (await getJSON(`${UPP}s/search/meta.json`) || {}).cantons || {};
  $("#v1-modes").innerHTML = [["list", "Liste"], ["cloud", "Wolke"], ["keys", "Kennwörter"]].map(([k, t]) =>
    `<a href="#" data-m1="${k}" class="${S.m1 === k ? "on" : ""}">${t}</a>`).join(" ");
  $("#v1-modes").addEventListener("click", ev => {
    const m = ev.target.closest("[data-m1]"); if (!m) return;
    ev.preventDefault(); S.m1 = m.dataset.m1;
    $("#v1-modes").querySelectorAll("a").forEach(x => x.classList.toggle("on", x === m)); writeHash(); view1();
  });
  $("#an-term").value = S.terms.join(", ");
  await facets();
  summary(); view1(); view2(); view3();
})();
})();
