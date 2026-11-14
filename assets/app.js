// filters, page browser, document list, register search — no dependencies
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const slug = s => String(s).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "x";
const fold = s => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ſ/g, "s").toLowerCase();

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
  const draw = () => {
    const q = fold($("#dq").value), c = $("#dc").value, y1 = parseInt($("#dy1").value) || 0, y2 = parseInt($("#dy2").value) || 9999;
    const hit = rows.filter(r => (!c || r[2] === c) && (!q || fold(r[6]).includes(q)) && (!(y1 || y2 < 9999) || (r[4] && r[4] >= y1 && r[4] <= y2)));
    $("#dn").textContent = `${hit.length} Stücke${hit.length > 1000 ? " (erste 1000 angezeigt)" : ""}`;
    dtab.tBodies[0].innerHTML = hit.slice(0, 1000).map(r =>
      `<tr><td><a href="../v/${esc(r[1])}/index.html">${esc(r[1])}</a></td><td class="no">${esc(r[3])}</td><td>${esc(r[5])}</td>
       <td><a href="../v/${esc(r[1])}/d/${slug(r[0].split("-").slice(1).join("-"))}.html">${esc(r[6])}</a></td></tr>`).join("");
  };
  ["#dq", "#dc", "#dy1", "#dy2"].forEach(s => $(s).addEventListener("input", draw)); draw();
});

// super-register search
const rs = $("#rsearch");
if (rs) { let idx = null; const names = {persons: "Personen", families: "Familien", places: "Orte", orgs: "Organisationen", subjects: "Sachen", glossary: "Glossar"};
  rs.addEventListener("input", async () => {
    idx = idx || await fetch("index.json").then(r => r.json());
    const q = fold(rs.value); if (q.length < 2) { $("#rhits").innerHTML = ""; return; }
    const hit = idx.filter(x => fold(x[0]).includes(q)).slice(0, 200);
    $("#rhits").innerHTML = hit.map(x => `<li><a href="${x[1]}/${x[2]}.html#${x[3]}">${esc(x[0])}</a> <span class="ty">${names[x[1]]}, ${x[4]} Bd.</span></li>`).join("");
  });
}
