// Map of the pieces by similarity (#50): 2D (canvas, d3 zoom) and 3D (three.js points), from s/map/<set>.json
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const host = document.getElementById("simmap");
const d3 = window.d3;
const UP = host.dataset.up || "../";
const PAL = ["#c8102e", "#1f77b4", "#2ca02c", "#ff7f0e", "#9467bd", "#8c564b", "#e377c2", "#17becf", "#bcbd22",
  "#7f7f7f", "#393b79", "#637939", "#8c6d31", "#843c39", "#7b4173", "#3182bd", "#e6550d", "#31a354", "#756bb1",
  "#636363", "#9c9ede", "#cedb9c", "#e7cb94", "#e7969c", "#de9ed6", "#6baed6"];
const S = { set: "regest", view: "2d", color: "canton", y0: null, y1: null, q: "", sel: null };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let D = null, colorOf = null, legend = [], visible = null, rel = new Set(), idx = {};

host.innerHTML = `
<div class="smctl">
  <label>Grundlage <select data-k="set"><option value="regest">Regest bzw. Titel</option><option value="source">Quellentext</option></select></label>
  <label>Ansicht <select data-k="view"><option value="2d">2D</option><option value="3d">3D</option><option value="time">3D mit Zeitachse</option></select></label>
  <label>Farbe <select data-k="color"><option value="canton">Kanton</option><option value="century">Jahrhundert</option><option value="group">Gruppe</option><option value="lang">Sprache</option></select></label>
  <label>Suche <input type="search" data-k="q" placeholder="Titel, Band, Nr."></label>
  <span class="smcount"></span>
</div>
<div class="ctl wide smyears"></div>
<div class="smstage"><canvas class="sm2d"></canvas><div class="sm3d" hidden></div><div class="smtip" hidden></div></div>
<div class="smlegend"></div><div class="sminfo"></div>`;
const stage = host.querySelector(".smstage"), cv = host.querySelector(".sm2d"), box3 = host.querySelector(".sm3d");
const tip = host.querySelector(".smtip"), info = host.querySelector(".sminfo");

const century = y => y ? `${Math.floor((y - 1) / 100) + 1}. Jh.` : "ohne Jahr";
const keyOf = {
  canton: i => D.rows[i][2], lang: i => D.rows[i][6], century: i => century(D.rows[i][3]),
  group: i => D.group[i] < 0 ? "ohne Gruppe" : `${D.group[i]}: ${D.groups[D.group[i]] || ""}`,
};
function recolor() {
  const counts = d3.rollup(d3.range(D.rows.length), v => v.length, keyOf[S.color]);
  let keys = [...counts.keys()];
  keys = S.color === "century" ? keys.sort((a, b) => (parseInt(a) || 99) - (parseInt(b) || 99))
    : keys.sort((a, b) => counts.get(b) - counts.get(a));
  const map = new Map(keys.map((k, n) => [k, /^ohne/.test(k) ? "#c9c9c9" : PAL[n % PAL.length]]));
  colorOf = i => map.get(keyOf[S.color](i));
  legend = keys.slice(0, 40).map(k => [k, map.get(k), counts.get(k)]);
  host.querySelector(".smlegend").innerHTML = legend.map(([k, c, n]) =>
    `<span><i style="background:${c}"></i>${esc(k)} <small>${n}</small></span>`).join("");
}
function filter() {
  const q = S.q.trim().toLowerCase();
  visible = new Uint8Array(D.rows.length);
  let n = 0;
  D.rows.forEach((r, i) => {
    const y = r[3];
    const ok = (S.y0 == null || (y && y >= S.y0 && y <= S.y1)) &&
      (!q || `${r[5]} ${r[1]} ${r[4]} ${r[0]}`.toLowerCase().includes(q));
    visible[i] = ok ? 1 : 0; n += ok;
  });
  host.querySelector(".smcount").textContent = `${n.toLocaleString("de-CH")} von ${D.rows.length.toLocaleString("de-CH")} Stücken`;
}
const slug = s => s.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "x";  // as site.slug
const href = i => { const r = D.rows[i]; return `${UP}${r[7]}/${r[1]}/d/${slug(r[7] === "e" ? r[0] : r[0].split("-").slice(1).join("-"))}.html`; };
const label = i => { const r = D.rows[i]; return `${r[1].replace(/_/g, " ")} Nr. ${r[4]}${r[3] ? " · " + r[3] : ""}`; };
async function select(i) {
  S.sel = i; rel = new Set();
  if (i == null) { info.innerHTML = ""; draw(); return; }
  const r = D.rows[i];
  info.innerHTML = `<p><b>${esc(label(i))}</b> ${esc(r[5])} <a href="${href(i)}">Stück öffnen</a></p>`;
  history.replaceState(null, "", "#" + r[0]);
  try {
    const shard = await fetch(`${UP}s/rel/${r[1]}.json`).then(x => x.ok ? x.json() : {});
    const links = (shard[r[0]] || []).slice(0, 10);
    for (const l of links) {  // [href, vol, no, date, title, vals, why, id]
      const k = idx[l[7]];
      if (k != null) rel.add(k);
    }
    if (links.length) info.innerHTML += `<p class="meta">Verwandte Stücke (Linien): ${links.map(l => `<a href="${UP}${esc(l[0])}">${esc(l[1])} Nr. ${esc(l[2])}</a>`).join(", ")}</p>`;
  } catch (e) { /* no links */ }
  draw();
}

// ---------------------------------------------------------------- 2D
let T = d3.zoomIdentity, W = 0, H = 0, qt = null;
function size() {
  W = stage.clientWidth; H = Math.max(420, Math.min(760, Math.round(W * 0.7)));
  const dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
  cv.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  stage.style.height = H + "px";
}
const px = i => [T.applyX(20 + D.xy[i][0] * (W - 40)), T.applyY(20 + (1 - D.xy[i][1]) * (H - 40))];
function draw2d() {
  const g = cv.getContext("2d");
  g.clearRect(0, 0, W, H);
  const r = Math.max(1.2, Math.min(4, 1.4 * Math.sqrt(T.k)));
  g.globalAlpha = 0.12;
  for (let i = 0; i < D.rows.length; i++) if (!visible[i]) { const [x, y] = px(i); g.fillStyle = "#bbb"; g.fillRect(x - 0.7, y - 0.7, 1.4, 1.4); }
  g.globalAlpha = 0.8;
  for (let i = 0; i < D.rows.length; i++) if (visible[i]) { const [x, y] = px(i); g.fillStyle = colorOf(i); g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); }
  if (S.sel != null) {
    const [sx, sy] = px(S.sel);
    g.globalAlpha = 0.9; g.strokeStyle = "#111"; g.lineWidth = 1;
    for (const k of rel) { const [x, y] = px(k); g.beginPath(); g.moveTo(sx, sy); g.lineTo(x, y); g.stroke(); g.beginPath(); g.arc(x, y, r + 2, 0, 6.2832); g.stroke(); }
    g.lineWidth = 2.5; g.beginPath(); g.arc(sx, sy, r + 4, 0, 6.2832); g.stroke();
  }
  g.globalAlpha = 1;
  qt = d3.quadtree().x(i => px(i)[0]).y(i => px(i)[1]).addAll(d3.range(D.rows.length).filter(i => visible[i]));
}
function fit() {  // start on the core (0.5–99.5 % of the points): a few outlying islands would squeeze it
  const q = (a, f) => a[Math.floor((a.length - 1) * f)];
  const xs = D.xy.map(p => 20 + p[0] * (W - 40)).sort((a, b) => a - b), ys = D.xy.map(p => 20 + (1 - p[1]) * (H - 40)).sort((a, b) => a - b);
  const x0 = q(xs, 0.005), x1 = q(xs, 0.995), y0 = q(ys, 0.005), y1 = q(ys, 0.995);
  const k = Math.min(8, 0.92 * Math.min(W / (x1 - x0 || 1), H / (y1 - y0 || 1)));
  T = d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2).scale(k);
  d3.select(cv).call(zoom.transform, T);
}
const zoom = d3.zoom().scaleExtent([0.5, 60]).on("zoom", ev => { T = ev.transform; draw2d(); });
d3.select(cv).call(zoom);
cv.addEventListener("mousemove", ev => {
  if (!qt) return;
  const i = qt.find(ev.offsetX, ev.offsetY, 12);
  if (i == null) { tip.hidden = true; return; }
  tip.hidden = false; tip.style.left = (ev.offsetX + 12) + "px"; tip.style.top = (ev.offsetY + 12) + "px";
  tip.innerHTML = `<b>${esc(label(i))}</b><br>${esc(D.rows[i][5])}`;
});
cv.addEventListener("mouseleave", () => { tip.hidden = true; });
cv.addEventListener("click", ev => { const i = qt && qt.find(ev.offsetX, ev.offsetY, 12); select(i ?? null); });

// ---------------------------------------------------------------- 3D
let R3 = null;
function build3d() {
  if (R3) { R3.renderer.dispose(); box3.innerHTML = ""; }
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1); renderer.setSize(W, H); renderer.setClearColor(0xffffff);
  box3.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, W / H, 0.01, 100);
  cam.position.set(1.05, 0.8, 1.05);
  const ctl = new OrbitControls(cam, renderer.domElement); ctl.target.set(0, 0, 0);
  const geo = new THREE.BufferGeometry(), n = D.rows.length;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const yrs = D.rows.map(r => r[3]).filter(Boolean), ymin = d3.min(yrs), ymax = d3.max(yrs);
  for (let i = 0; i < n; i++) {
    const p = S.view === "time" ? [D.xy[i][0], D.rows[i][3] ? (D.rows[i][3] - ymin) / (ymax - ymin) : -0.08, D.xy[i][1]] : D.xyz[i];
    pos.set([p[0] - 0.5, p[1] - 0.5, p[2] - 0.5], i * 3);
    const c = new THREE.Color(visible[i] ? colorOf(i) : "#e4e4e4");
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.011, vertexColors: true }));
  scene.add(pts);
  if (S.sel != null && rel.size) {
    const P = i => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const lines = new THREE.BufferGeometry().setFromPoints([...rel].flatMap(k => [P(S.sel), P(k)]));
    scene.add(new THREE.LineSegments(lines, new THREE.LineBasicMaterial({ color: 0x111111 })));
  }
  const ray = new THREE.Raycaster(); ray.params.Points.threshold = 0.01;
  const mouse = new THREE.Vector2();
  renderer.domElement.addEventListener("mousemove", ev => {
    mouse.set(ev.offsetX / W * 2 - 1, -ev.offsetY / H * 2 + 1); ray.setFromCamera(mouse, cam);
    const hit = ray.intersectObject(pts).find(h => visible[h.index]);
    if (!hit) { tip.hidden = true; return; }
    tip.hidden = false; tip.style.left = (ev.offsetX + 12) + "px"; tip.style.top = (ev.offsetY + 12) + "px";
    tip.innerHTML = `<b>${esc(label(hit.index))}</b><br>${esc(D.rows[hit.index][5])}`; R3.hover = hit.index;
  });
  renderer.domElement.addEventListener("dblclick", () => { if (R3.hover != null) select(R3.hover); });
  R3 = { renderer, hover: null };
  (function loop() { if (!R3 || R3.renderer !== renderer) return; ctl.update(); renderer.render(scene, cam); requestAnimationFrame(loop); })();
}

function draw() {
  const two = S.view === "2d";
  cv.hidden = !two; box3.hidden = two;
  if (two) { R3 && (R3.renderer.dispose(), R3 = null, box3.innerHTML = ""); draw2d(); } else build3d();
}
async function load() {
  info.innerHTML = "<p class=meta>Karte wird geladen …</p>";
  D = await fetch(`${UP}s/map/${S.set}.json`).then(r => r.json());
  idx = {}; D.rows.forEach((r, i) => { idx[r[0]] = i; });
  const yrs = D.rows.map(r => r[3]).filter(Boolean);
  const yh = host.querySelector(".smyears"); yh.innerHTML = "";
  if (typeof window.dateSlider === "function")
    window.dateSlider(yh, d3.min(yrs), d3.max(yrs), st => { S.y0 = st.active ? st.lo : null; S.y1 = st.active ? st.hi : null; filter(); draw(); });
  info.innerHTML = "";
  recolor(); filter(); size(); fit(); draw();
  const want = decodeURIComponent(location.hash.slice(1));
  const k = D.rows.findIndex(r => r[0] === want);
  if (k >= 0) select(k);
}
host.querySelectorAll(".smctl [data-k]").forEach(el => el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => {
  S[el.dataset.k] = el.value;
  if (el.dataset.k === "set") { S.sel = null; rel = new Set(); load(); return; }
  if (el.dataset.k === "color") recolor();
  if (el.dataset.k === "q") filter();
  draw();
}));
window.addEventListener("resize", () => { size(); draw(); });
load();
