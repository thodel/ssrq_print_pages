/* Visual analyses of the volumes and their introductions (ssrq_print.metavis): one data file (s/vis.json), the
   charts are chosen by <div class="vis" data-vis="…">. d3 v7; the map of the generations also Leaflet. */
(() => {
  const up = document.body.dataset.up || "";
  const GEN = ["#b5452a", "#2f6f8f", "#6a8f3a"];
  const PART = ["#7a2e1d", "#c8693c", "#e3b25b", "#8aa65c", "#4f8a8b", "#3b5b92", "#8b6aa8"];
  const TYPE = {"Satzung/Mandat": "#3b5b92", "Offnung": "#6a8f3a", "Urkunde": "#c8693c", "Protokoll/Urteil": "#7a2e1d",
                "Formular": "#8b6aa8", "Urbar": "#e3b25b", "Sachtitel": "#bdb8ad"};
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const fmt = n => (n ?? 0).toLocaleString("de-CH");
  let tip;
  const showTip = (ev, html) => {
    if (!tip) { tip = document.createElement("div"); tip.className = "vistip"; document.body.appendChild(tip); }
    tip.innerHTML = html; tip.hidden = false;
    const x = Math.min(ev.pageX + 14, window.scrollX + document.documentElement.clientWidth - tip.offsetWidth - 8);
    tip.style.left = x + "px"; tip.style.top = (ev.pageY + 14) + "px";
  };
  const hideTip = () => { if (tip) tip.hidden = true; };
  const legend = (el, items, onClick) => {
    const p = document.createElement("p"); p.className = "vislegend";
    p.innerHTML = items.map(([t, c], i) => `<button type="button" data-i="${i}"><span style="background:${c}"></span>${esc(t)}</button>`).join("");
    if (onClick) p.addEventListener("click", ev => { const b = ev.target.closest("button"); if (b) { b.classList.toggle("off"); onClick(+b.dataset.i, !b.classList.contains("off")); } });
    else p.classList.add("static");
    el.appendChild(p);
    return p;
  };
  const volHref = v => `${up}v/${v}/index.html`;
  const byYear = D => Object.entries(D.vols).sort((a, b) => (a[1].tei - b[1].tei) || ((a[1].year || 3000) - (b[1].year || 3000)) || a[1].label.localeCompare(b[1].label));

  // 1 publication year against the period of the pieces
  function timeline(el, D) {
    const rows = byYear(D).filter(([, v]) => v.year && v.span);
    const W = 900, rh = 9, M = {l: 120, r: 20, t: 24, b: 10}, H = M.t + rows.length * rh + M.b;
    legend(el, D.generations.map((g, i) => [g, GEN[i]]));
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("class", "vissvg");
    const x = d3.scaleLinear().domain([700, 1900]).range([M.l, W - M.r]);
    svg.append("g").attr("transform", `translate(0,${M.t})`).call(d3.axisTop(x).tickFormat(d3.format("d")).ticks(12)).attr("class", "axis");
    const g = svg.selectAll("g.row").data(rows).join("g").attr("class", "row").attr("transform", (d, i) => `translate(0,${M.t + i * rh + rh / 2})`)
      .style("cursor", "pointer").on("click", (ev, [v]) => location.href = volHref(v))
      .on("mousemove", (ev, [v, d]) => showTip(ev, `<b>${esc(d.label)}</b> (${d.year})<br>${esc(d.editors)}<br>Stücke ${d.span[0]}–${d.span[4]}, Median ${d.span[2]}<br>${fmt(d.pieces)} Stücke`))
      .on("mouseleave", hideTip);
    g.append("rect").attr("x", 0).attr("y", -rh / 2).attr("width", W).attr("height", rh).attr("fill", "transparent");
    g.append("text").attr("x", M.l - 6).attr("dy", "0.32em").attr("text-anchor", "end").attr("class", "lab")
      .text(([, d]) => `${d.year}  ${d.label}`);
    const cx = v => x(Math.max(700, v));
    g.append("line").attr("x1", ([, d]) => cx(d.span[0])).attr("x2", ([, d]) => cx(d.span[4])).attr("stroke", ([, d]) => GEN[d.gen]).attr("stroke-width", 1);
    g.append("line").attr("x1", ([, d]) => cx(d.span[1])).attr("x2", ([, d]) => cx(d.span[3])).attr("stroke", ([, d]) => GEN[d.gen]).attr("stroke-width", 5);
    g.append("circle").attr("cx", ([, d]) => cx(d.span[2])).attr("r", 2.5).attr("fill", "#fff").attr("stroke", "#333").attr("stroke-width", .7);
  }

  // 3 length of the introduction against the size of the edition
  function introsize(el, D) {
    const pts = Object.entries(D.vols).filter(([, v]) => v.intro_words > 50 && v.words > 0 && v.year);
    const decs = [...new Set(pts.map(([, v]) => Math.floor(v.year / 10) * 10))].sort();
    const col = d3.scaleSequential(d3.interpolateViridis).domain([decs[0], decs[decs.length - 1]]);
    const W = 900, H = 420, M = {l: 60, r: 20, t: 10, b: 40};
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("class", "vissvg");
    const x = d3.scaleLog().domain(d3.extent(pts, ([, v]) => v.words)).nice().range([M.l, W - M.r]);
    const y = d3.scaleLog().domain(d3.extent(pts, ([, v]) => v.intro_words)).nice().range([H - M.b, M.t]);
    svg.append("g").attr("transform", `translate(0,${H - M.b})`).call(d3.axisBottom(x).ticks(6, "~s")).attr("class", "axis");
    svg.append("g").attr("transform", `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(6, "~s")).attr("class", "axis");
    svg.append("text").attr("x", W - M.r).attr("y", H - 6).attr("text-anchor", "end").attr("class", "lab").text("Wörter der Stücke");
    svg.append("text").attr("x", M.l + 4).attr("y", M.t + 10).attr("class", "lab").text("Wörter der Einleitung");
    svg.selectAll("circle").data(pts).join("circle").attr("cx", ([, v]) => x(v.words)).attr("cy", ([, v]) => y(v.intro_words)).attr("r", 5)
      .attr("fill", ([, v]) => col(Math.floor(v.year / 10) * 10)).attr("stroke", "#333").attr("stroke-width", .5).style("cursor", "pointer")
      .on("mousemove", (ev, [, v]) => showTip(ev, `<b>${esc(v.label)}</b> (${v.year})<br>Einleitung ${fmt(v.intro_words)} Wörter<br>Stücke ${fmt(v.words)} Wörter<br><span class="meta">${esc((v.intro_parts || []).join(" · "))}</span>`))
      .on("mouseleave", hideTip).on("click", (ev, [k]) => location.href = volHref(k));
    legend(el, decs.map(d => [`${d}er`, col(d)]));
    // share of the introduction per decade
    const agg = decs.map(d => { const vs = pts.filter(([, v]) => Math.floor(v.year / 10) * 10 === d);
      const i = d3.sum(vs, ([, v]) => v.intro_words), w = d3.sum(vs, ([, v]) => v.words); return {d, share: i / (i + w), n: vs.length}; });
    const H2 = 180, s2 = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H2}`).attr("class", "vissvg");
    const xb = d3.scaleBand().domain(decs).range([M.l, W - M.r]).padding(.2), yb = d3.scaleLinear().domain([0, d3.max(agg, a => a.share)]).nice().range([H2 - 30, 10]);
    s2.append("g").attr("transform", `translate(0,${H2 - 30})`).call(d3.axisBottom(xb).tickFormat(d => `${d}er`)).attr("class", "axis");
    s2.append("g").attr("transform", `translate(${M.l},0)`).call(d3.axisLeft(yb).ticks(4, "%")).attr("class", "axis");
    s2.selectAll("rect").data(agg).join("rect").attr("x", a => xb(a.d)).attr("width", xb.bandwidth()).attr("y", a => yb(a.share)).attr("height", a => H2 - 30 - yb(a.share))
      .attr("fill", a => col(a.d)).on("mousemove", (ev, a) => showTip(ev, `${a.d}er: Einleitung ${(a.share * 100).toFixed(1)} % des Textes (${a.n} Bände)`)).on("mouseleave", hideTip);
  }

  // 5 key terms per decade of publication
  function terms(el, D) {
    const names = D.terms.names, decs = Object.keys(D.terms.decades).map(Number).sort();
    const val = (d, t) => { const r = D.terms.decades[d]; return r.words ? (r[t] || 0) / r.words * 1e4 : 0; };
    const col = d3.scaleOrdinal(names, d3.schemeTableau10);
    const on = new Set(names);
    const W = 900, H = 380, M = {l: 50, r: 20, t: 10, b: 30};
    const lg = legend(el, names.map(n => [n, col(n)]), (i, show) => { show ? on.add(names[i]) : on.delete(names[i]); draw(); });
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("class", "vissvg");
    const x = d3.scalePoint().domain(decs).range([M.l, W - M.r]).padding(.3);
    const y = d3.scaleLinear().range([H - M.b, M.t]);
    const gx = svg.append("g").attr("transform", `translate(0,${H - M.b})`).attr("class", "axis");
    const gy = svg.append("g").attr("transform", `translate(${M.l},0)`).attr("class", "axis");
    const plot = svg.append("g");
    const volsOf = (d, t) => Object.values(D.vols).filter(v => v.year && Math.floor(v.year / 10) * 10 === d && v.terms && v.terms[t])
      .sort((a, b) => b.terms[t] - a.terms[t]).map(v => `${esc(v.label)} ${v.terms[t]}`).slice(0, 12).join(", ");
    function draw() {
      const ts = names.filter(n => on.has(n));
      y.domain([0, d3.max(ts.flatMap(t => decs.map(d => val(d, t)))) || 1]).nice();
      gx.call(d3.axisBottom(x).tickFormat(d => `${d}er`)); gy.call(d3.axisLeft(y).ticks(5));
      plot.selectAll("path").data(ts, t => t).join("path").attr("fill", "none").attr("stroke", t => col(t)).attr("stroke-width", 2)
        .attr("d", t => d3.line().x(d => x(d)).y(d => y(val(d, t)))(decs));
      plot.selectAll("circle").data(ts.flatMap(t => decs.map(d => ({t, d}))), p => p.t + p.d).join("circle")
        .attr("cx", p => x(p.d)).attr("cy", p => y(val(p.d, p.t))).attr("r", 3.5).attr("fill", p => col(p.t))
        .on("mousemove", (ev, p) => showTip(ev, `<b>${esc(p.t)}</b>, ${p.d}er: ${val(p.d, p.t).toFixed(1)} je 10 000 Wörter (${fmt(D.terms.decades[p.d][p.t] || 0)}×)<br><span class="meta">${volsOf(p.d, p.t) || "—"}</span>`))
        .on("mouseleave", hideTip);
    }
    draw();
  }

  // 4 and 8: shares per volume as stacked bars
  function shares(el, D, names, colors, get, total) {
    const rows = byYear(D).filter(([k, v]) => get(k, v) && d3.sum(get(k, v)) > 0);
    const W = 900, rh = 9, M = {l: 120, r: 20, t: 24, b: 10}, H = M.t + rows.length * rh + M.b;
    legend(el, names.map((n, i) => [n, colors[i]]));
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("class", "vissvg");
    const x = d3.scaleLinear().domain([0, 1]).range([M.l, W - M.r]);
    svg.append("g").attr("transform", `translate(0,${M.t})`).call(d3.axisTop(x).ticks(10, "%")).attr("class", "axis");
    const g = svg.selectAll("g.row").data(rows).join("g").attr("transform", (d, i) => `translate(0,${M.t + i * rh})`)
      .style("cursor", "pointer").on("click", (ev, [k]) => location.href = volHref(k)).on("mouseleave", hideTip)
      .on("mousemove", (ev, [k, v]) => { const a = get(k, v), s = d3.sum(a);
        showTip(ev, `<b>${esc(v.label)}</b>${v.year ? ` (${v.year})` : " (TEI)"} · ${fmt(s)} ${total}<br>` +
          names.map((n, i) => a[i] ? `<span class="sw" style="background:${colors[i]}"></span>${esc(n)} ${(a[i] / s * 100).toFixed(1)} %` : "").filter(Boolean).join("<br>")); });
    g.append("text").attr("x", M.l - 6).attr("y", rh / 2).attr("dy", "0.32em").attr("text-anchor", "end").attr("class", "lab")
      .text(([, v]) => `${v.year || "TEI"}  ${v.label}`);
    g.each(function ([k, v]) {
      const a = get(k, v), s = d3.sum(a); let acc = 0;
      d3.select(this).selectAll("rect").data(a).join("rect").attr("y", 1).attr("height", rh - 2)
        .attr("x", n => { const x0 = x(acc / s); acc += n; return x0; }).attr("width", n => x(n / s) - x(0)).attr("fill", (n, i) => colors[i]);
    });
  }
  const layers = (el, D) => shares(el, D, D.layers.names, PART, k => D.layers.by_vol[k], "Wörter");
  const types = (el, D) => shares(el, D, D.types, D.types.map(t => TYPE[t]), (k, v) => v.types && D.types.map(t => v.types[t] || 0), "Stücke");

  // 6 scholars and archives
  function network(el, D) {
    const ctl = document.createElement("p"); ctl.className = "links";
    ctl.innerHTML = '<label>Netz <select><option value="scholars">Rechtshistoriker</option><option value="archives">Archive</option></select></label>';
    el.appendChild(ctl);
    legend(el, D.generations.map((g, i) => [g, GEN[i]]).concat([["genannt", "#555"]]));
    const W = 900, H = 640;
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("class", "vissvg");
    let sim;
    function draw(kind) {
      svg.selectAll("*").remove(); if (sim) sim.stop();
      const src = D[kind], nodes = new Map(), links = [];
      for (const [v, c] of Object.entries(src)) for (const [t, n] of Object.entries(c)) {
        if (!nodes.has(v)) nodes.set(v, {id: v, vol: true, d: D.vols[v], deg: 0});
        if (!nodes.has("t:" + t)) nodes.set("t:" + t, {id: "t:" + t, name: t, vol: false, deg: 0});
        links.push({source: v, target: "t:" + t, n}); nodes.get(v).deg += n; nodes.get("t:" + t).deg += n;
      }
      const ns = [...nodes.values()];
      const r = n => n.vol ? 3 + Math.sqrt(n.deg) * .8 : 4 + Math.sqrt(n.deg) * 1.1;
      sim = d3.forceSimulation(ns).force("link", d3.forceLink(links).id(n => n.id).distance(60).strength(.3))
        .force("charge", d3.forceManyBody().strength(-60)).force("center", d3.forceCenter(W / 2, H / 2))
        .force("collide", d3.forceCollide(n => r(n) + 2)).force("x", d3.forceX(W / 2).strength(.04)).force("y", d3.forceY(H / 2).strength(.06));
      const L = svg.append("g").selectAll("line").data(links).join("line").attr("stroke", "#999").attr("stroke-opacity", .45).attr("stroke-width", l => Math.min(6, .6 + Math.sqrt(l.n) * .6));
      const N = svg.append("g").selectAll("g").data(ns).join("g").style("cursor", n => n.vol ? "pointer" : "default")
        .call(d3.drag().on("start", (ev, n) => { if (!ev.active) sim.alphaTarget(.2).restart(); n.fx = n.x; n.fy = n.y; })
          .on("drag", (ev, n) => { n.fx = ev.x; n.fy = ev.y; }).on("end", (ev, n) => { if (!ev.active) sim.alphaTarget(0); n.fx = n.fy = null; }));
      N.append("circle").attr("r", r).attr("fill", n => n.vol ? GEN[n.d.gen] : "#555").attr("stroke", "#fff");
      N.filter(n => !n.vol || n.deg > 25).append("text").attr("x", n => r(n) + 2).attr("dy", "0.32em").attr("class", n => n.vol ? "lab small" : "lab strong")
        .text(n => n.vol ? n.d.label : n.name);
      const near = n => new Set(links.filter(l => l.source === n || l.target === n).flatMap(l => [l.source.id, l.target.id]));
      N.on("mousemove", (ev, n) => {
        const s = near(n); N.style("opacity", m => s.has(m.id) ? 1 : .15); L.style("stroke-opacity", l => l.source === n || l.target === n ? .9 : .05);
        const ls = links.filter(l => l.source === n || l.target === n).sort((a, b) => b.n - a.n);
        showTip(ev, n.vol ? `<b>${esc(n.d.label)}</b> (${n.d.year})<br>` + ls.map(l => `${esc(l.target.name)} ${l.n}×`).join(", ")
          : `<b>${esc(n.name)}</b><br>` + ls.map(l => `${esc(l.source.d.label)} ${l.n}×`).join(", "));
      }).on("mouseleave", () => { N.style("opacity", 1); L.style("stroke-opacity", .45); hideTip(); })
        .on("click", (ev, n) => { if (n.vol) location.href = volHref(n.id); });
      sim.on("tick", () => {
        ns.forEach(n => { n.x = Math.max(8, Math.min(W - 8, n.x)); n.y = Math.max(8, Math.min(H - 8, n.y)); });
        L.attr("x1", l => l.source.x).attr("y1", l => l.source.y).attr("x2", l => l.target.x).attr("y2", l => l.target.y);
        N.attr("transform", n => `translate(${n.x},${n.y})`);
      });
    }
    ctl.querySelector("select").addEventListener("change", ev => draw(ev.target.value));
    draw("scholars");
  }

  // 7 volumes naming other volumes, and the guidelines
  function arcs(el, D) {
    const items = byYear(D).filter(([, v]) => v.year && !v.tei).map(([k, v]) => ({id: k, label: v.label, year: v.year, gen: v.gen}));
    const gy = new Set(Object.values(D.guides).flatMap(c => Object.keys(c)).map(Number));
    for (const y of gy) items.push({id: "g:" + y, label: `Richtlinien ${y}`, year: y + .5, guide: true});
    items.sort((a, b) => a.year - b.year);
    const W = 1100, H = 520, base = 330;
    legend(el, D.generations.map((g, i) => [g, GEN[i]]).concat([["Richtlinien", "#222"]]));
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("class", "vissvg");
    const x = d3.scalePoint().domain(items.map(i => i.id)).range([20, W - 20]);
    const links = [];
    for (const [v, c] of Object.entries(D.refs)) for (const [t, n] of Object.entries(c)) if (x(v) != null && x(t) != null) links.push({s: v, t, n});
    for (const [v, c] of Object.entries(D.guides)) for (const [y, n] of Object.entries(c)) if (x(v) != null) links.push({s: v, t: "g:" + y, n, guide: true});
    const maxd = W;
    const P = svg.append("g").selectAll("path").data(links).join("path").attr("fill", "none")
      .attr("stroke", l => l.guide ? "#222" : GEN[D.vols[l.s].gen]).attr("stroke-opacity", .35).attr("stroke-width", l => Math.min(4, .6 + Math.sqrt(l.n) * .5))
      .attr("d", l => { const a = x(l.s), b = x(l.t), r = Math.abs(b - a) / 2; return `M${a},${base} A${r},${Math.min(r, base - 10) * 1},0 0,${a < b ? 1 : 0} ${b},${base}`; });
    const N = svg.append("g").selectAll("g").data(items).join("g").attr("transform", i => `translate(${x(i.id)},${base})`).style("cursor", "pointer");
    N.append("path").attr("d", i => i.guide ? d3.symbol(d3.symbolDiamond, 60)() : d3.symbol(d3.symbolCircle, 22)()).attr("fill", i => i.guide ? "#222" : GEN[i.gen]);
    N.append("text").attr("transform", "rotate(65)").attr("x", 6).attr("dy", "0.32em").attr("class", i => i.guide ? "lab strong" : "lab small").text(i => i.guide ? i.label : `${i.label} (${i.year})`);
    N.on("mousemove", (ev, i) => {
      const mine = links.filter(l => l.s === i.id || l.t === i.id);
      P.attr("stroke-opacity", l => mine.includes(l) ? .9 : .04);
      const out = mine.filter(l => l.s === i.id).map(l => `${esc(l.guide ? `Richtlinien ${l.t.slice(2)}` : D.vols[l.t].label)} ${l.n}×`);
      const inn = mine.filter(l => l.t === i.id).map(l => `${esc(D.vols[l.s].label)} ${l.n}×`);
      showTip(ev, `<b>${esc(i.label)}</b>${i.guide ? "" : ` (${i.year})`}` + (out.length ? `<br>nennt: ${out.join(", ")}` : "") + (inn.length ? `<br>genannt in: ${inn.join(", ")}` : ""));
    }).on("mouseleave", () => { P.attr("stroke-opacity", .35); hideTip(); }).on("click", (ev, i) => { if (!i.guide) location.href = volHref(i.id); });
  }

  // 2 places by the generation that first edited them
  async function genmap(el, D) {
    const pts = await (await fetch(`${up}k/places.json`)).json();
    const first = vs => { const ys = vs.map(v => D.vols[v]).filter(Boolean); if (!ys.length) return null;
      return ys.reduce((a, b) => ((a.year || 3000) <= (b.year || 3000) ? a : b)); };
    const ctl = document.createElement("p"); ctl.className = "vislegend";
    el.appendChild(ctl);
    const box = document.createElement("div"); box.className = "map"; box.style.height = "620px"; el.appendChild(box);
    const map = L.map(box).setView([46.8, 8.2], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 17, attribution: "© OpenStreetMap"}).addTo(map);
    const layers = D.generations.map(() => L.layerGroup().addTo(map)), n = [0, 0, 0];
    for (const [cid, label, lat, lon, k, vs] of pts) {
      const f = first(vs); if (!f) continue;
      n[f.gen]++;
      L.circleMarker([lat, lon], {radius: 2 + Math.sqrt(k) * .7, color: GEN[f.gen], weight: 1, fillOpacity: .6})
        .bindTooltip(`<b>${esc(label)}</b><br>zuerst ${esc(f.label)} (${f.year || "TEI"}) · ${k} Stücke`)
        .on("click", () => location.href = `${up}r/eintrag.html#${cid}`).addTo(layers[f.gen]);
    }
    ctl.innerHTML = D.generations.map((g, i) => `<label><input type="checkbox" checked data-i="${i}"> <span style="background:${GEN[i]}"></span>${esc(g)} (${fmt(n[i])} Orte)</label>`).join("");
    ctl.addEventListener("change", ev => { const l = layers[+ev.target.dataset.i]; ev.target.checked ? l.addTo(map) : map.removeLayer(l); });
  }

  const VIS = {timeline, introsize, terms, layers, types, network, arcs, genmap};
  const els = [...document.querySelectorAll(".vis[data-vis]")];
  if (!els.length) return;
  fetch(`${up}s/vis.json`).then(r => r.json()).then(D => els.forEach(el => {
    try { VIS[el.dataset.vis](el, D); } catch (ex) { el.textContent = "Grafik konnte nicht gezeichnet werden."; console.error(ex); }
  }));
})();
