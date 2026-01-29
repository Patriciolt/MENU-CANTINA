/* =========================
   CONFIG (cambiable)
========================= */
const SHEET_ID = "1c4WYczs2NjwPz0f9aaSZShC-FaU3H9wnUm7FuYd9c6o";
const SHEET_NAME = "Sheet1";

const REFRESH_MS = 60_000;
const DEFAULT_ROTATE_MS  = 9_000; // si no hay TV DURACION
const SHUFFLE    = true;

const MENU_URL = "https://adputcantina.com.ar/menu.html";
const IG_URL   = "https://www.instagram.com/adputcantina?igsh=dW5xYTZzZmxkMGg5";
const WAPP_URL = "https://wa.me/5493816836838?text=" + encodeURIComponent("Hola! Quiero pedir en Cantina ADPUT 😊");

/* Cada cuántas promos meter un “resumen” */
const SUMMARY_EVERY = 4;   // cada 4 promos
const SUMMARY_COUNT = 3;   // muestra 3 en resumen

/* =========================
   HELPERS
========================= */
const $ = (id) => document.getElementById(id);

function normalize(v){ return (v ?? "").toString().trim(); }
function lower(v){ return normalize(v).toLowerCase(); }
function upper(v){ return normalize(v).toUpperCase(); }

function isYes(v){
  const t = lower(v);
  return t === "si" || t === "sí" || t === "s" || t === "yes" || t === "y" || t === "1" || t === "true";
}
function isJustYesWord(v){
  const t = lower(v);
  return t === "" || t === "si" || t === "sí" || t === "s" || t === "1" || t === "true" || t === "ok";
}
function toNumber(v, fallback = 999999){
  const t = normalize(v).replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : fallback;
}
function money(v){
  const t = normalize(v);
  if(!t) return "";
  if(/[a-zA-ZxX]/.test(t)) return t; // "2x1"
  const n = toNumber(t, NaN);
  if(Number.isFinite(n)) return "$ " + n.toLocaleString("es-AR");
  return t;
}
function numberFromMoneyText(txt){
  const digits = normalize(txt).replace(/[^\d]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : NaN;
}
function setClock(){
  const d = new Date();
  $("clock").textContent = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function shuffleInPlace(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* =========================
   CTA / QR
========================= */
function setCTA(){
  $("btnMenu").href = MENU_URL;
  $("btnWapp").href = WAPP_URL;
  $("btnIg").href = IG_URL;

  // QR (servicio liviano)
  const qr = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(MENU_URL);
  $("qrMenu").src = qr;
}

/* =========================
   PARALLAX LENTO (logo + pattern)
========================= */
function startParallax(){
  const wm = $("watermark");
  const pt = $("pattern");
  if(!wm && !pt) return;

  let t0 = performance.now();
  function tick(now){
    const t = (now - t0) / 1000;

    if(wm){
      const x = 82 + Math.sin(t * 0.12) * 2.4;
      const y = 56 + Math.cos(t * 0.10) * 1.8;
      wm.style.backgroundPosition = `${x}% ${y}%`;
    }

    if(pt){
      const px = (Math.sin(t * 0.06) * 18);
      const py = (Math.cos(t * 0.05) * 14);
      pt.style.backgroundPosition = `${px}px ${py}px`;
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* =========================
   SHEETS FETCH (GVIZ)
========================= */
async function fetchSheetRows(){
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status} al leer Google Sheets`);

  const text = await res.text();
  const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const data = JSON.parse(jsonText);

  const cols = data.table.cols.map(c => c.label);
  const rows = data.table.rows;

  return rows.map(r => {
    const obj = {};
    r.c?.forEach((cell, i) => {
      const key = cols[i] || `COL_${i}`;
      obj[key] = cell?.v ?? "";
    });
    return obj;
  });
}

/* =========================
   CATEGORY -> ACCENT
========================= */
function accentFromCategory(cat){
  const c = lower(cat);
  if(c.includes("empan")) return "empanadas";
  if(c.includes("sand")) return "sandwichs";
  if(c.includes("papa")) return "papas";
  if(c.includes("vino") || c.includes("beb") || c.includes("gase") || c.includes("agua")) return "bebidas";
  return "default";
}

/* =========================
   BUILD PROMOS (only promos)
   + soporta TV DURACION, TV PRIORIDAD
========================= */
function buildPromos(rows){
  const valid = rows.filter(r => {
    const activo = isYes(r["Activo"]);
    const tvActivoCell = normalize(r["TV ACTIVO"]);
    const tvActivo = tvActivoCell === "" ? true : isYes(tvActivoCell);
    return activo && tvActivo && normalize(r["Producto"]);
  });

  const promos = valid.filter(r => {
    const promoCol = normalize(r["Promo"]);
    const tvBloque = upper(r["TV BLOQUE"]);
    return promoCol !== "" || tvBloque === "PROMO";
  });

  promos.sort((a,b) => {
    // prioridad mayor primero
    const pa = toNumber(a["TV PRIORIDAD"], 0);
    const pb = toNumber(b["TV PRIORIDAD"], 0);
    if(pb !== pa) return pb - pa;

    const oa = toNumber(a["TV ORDEN"], toNumber(a["Orden"], 999999));
    const ob = toNumber(b["TV ORDEN"], toNumber(b["Orden"], 999999));
    return oa - ob;
  });

  const out = promos.map(r => {
    const nombre = normalize(r["Producto"]);
    const categoria = normalize(r["Categoria"]);
    const desc = normalize(r["TV DESCRIPCION"]) || normalize(r["Descripcion"]) || "";

    const promoRaw = normalize(r["Promo"]);
    const promoNoteFromCol = (!isJustYesWord(promoRaw) && promoRaw.length >= 3) ? promoRaw : "";

    const imgName = normalize(r["Imagen"]);
    const imgSrc = imgName ? `img/${imgName}` : "";

    const precioBase = money(r["Precio"]);
    const precioPromo = money(r["Precio Promo"]);
    const tvPrecio = normalize(r["TV PRECIO TEXTO"]);

    let oldPrice = "";
    let mainPrice = "";

    if(tvPrecio){
      mainPrice = tvPrecio;
      if(precioBase) oldPrice = precioBase;
    } else if(precioPromo){
      mainPrice = precioPromo;
      if(precioBase && precioBase !== precioPromo) oldPrice = precioBase;
    } else {
      mainPrice = precioBase || "";
      oldPrice = "";
    }

    const note = normalize(r["TV TITULO"]) || promoNoteFromCol || "PROMO DEL DÍA";

    // duración por promo (segundos -> ms)
    const durSec = toNumber(r["TV DURACION"], NaN);
    const durationMs = Number.isFinite(durSec) && durSec > 0 ? Math.round(durSec * 1000) : DEFAULT_ROTATE_MS;

    return {
      nombre, categoria, accent: accentFromCategory(categoria),
      desc, imgSrc,
      mainPrice, oldPrice, note,
      durationMs
    };
  });

  if(SHUFFLE) shuffleInPlace(out);
  return out;
}

/* =========================
   RENDER (Crossfade + wipe + badge pop + progress)
========================= */
let promos = [];
let idx = 0;
let steps = 0;
let timer = null;

// crossfade state
let activeLayer = "A"; // A o B

function runWipe(){
  const wipe = $("wipe");
  wipe.classList.remove("wipe-run");
  void wipe.offsetWidth;
  wipe.classList.add("wipe-run");
}

function setProgress(durationMs){
  const bar = $("progressBar");
  bar.style.transition = "none";
  bar.style.width = "0%";
  void bar.offsetWidth;
  bar.style.transition = `width ${durationMs}ms linear`;
  bar.style.width = "100%";
}

function popBadge(kind){
  const b = $("offBadge");
  b.classList.remove("badge-pop-soft","badge-pop-hard");
  void b.offsetWidth;
  b.classList.add(kind);
}

function computeOff(oldPrice, mainPrice){
  const oldN = numberFromMoneyText(oldPrice);
  const newN = numberFromMoneyText(mainPrice);
  if(Number.isFinite(oldN) && Number.isFinite(newN) && oldN > 0 && newN > 0 && oldN > newN){
    const off = Math.round(((oldN - newN) / oldN) * 100);
    return off;
  }
  return null;
}

/* Slide resumen (3 promos) */
function renderSummary(direction = 1){
  const card = $("promoCard");
  card.style.setProperty("--dir", String(direction));
  runWipe();

  const list = promos.slice(idx, idx + SUMMARY_COUNT);
  const lines = list.map(p => {
    const off = (p.oldPrice && p.mainPrice) ? computeOff(p.oldPrice, p.mainPrice) : null;
    const offTxt = (off !== null) ? ` (-${off}%)` : "";
    return `• ${p.nombre} — ${p.mainPrice}${offTxt}`;
  });

  // set accent default para resumen
  card.dataset.accent = "default";

  // Texto tipo resumen
  $("pillText").textContent = "PROMOS";
  $("offBadge").style.display = "none";

  $("promoTitle").textContent = "PROMOS DE HOY";
  $("promoDesc").textContent = lines.join("\n");
  $("promoDesc").style.whiteSpace = "pre-line";

  $("oldPrice").style.visibility = "hidden";
  $("promoPrice").textContent = "";
  $("promoNote").textContent = "Escaneá el QR para ver todo el menú";

  // imagen: usa logo (queda pro)
  swapImage("img/logo.png");

  // animaciones
  const media = $("promoMedia");
  media.classList.remove("media-enter");
  document.body.classList.remove("text-enter");
  $("promoPrice").classList.remove("price-punch");
  void card.offsetWidth;
  media.classList.add("media-enter");
  document.body.classList.add("text-enter");

  // progress
  const dur = DEFAULT_ROTATE_MS;
  setProgress(dur);

  return dur;
}

function swapImage(src){
  const imgA = $("promoImgA");
  const imgB = $("promoImgB");

  const next = activeLayer === "A" ? imgB : imgA;
  const current = activeLayer === "A" ? imgA : imgB;

  next.onerror = () => {
    // si falla, ocultamos la capa next
    next.classList.remove("is-active");
  };

  next.src = src;
  next.classList.add("is-active");
  current.classList.remove("is-active");

  activeLayer = (activeLayer === "A") ? "B" : "A";
}

function renderPromo(p, direction = 1){
  const card = $("promoCard");
  const media = $("promoMedia");
  const offEl = $("offBadge");

  card.style.setProperty("--dir", String(direction));
  card.dataset.accent = p.accent || "default";
  runWipe();

  // reset whiteSpace si veníamos de resumen
  $("promoDesc").style.whiteSpace = "normal";

  $("promoTitle").textContent = p.nombre || "";
  $("promoDesc").textContent = p.desc || " ";
  $("promoPrice").textContent = p.mainPrice || "";
  $("promoNote").textContent = p.note || "";

  // precio tachado
  const oldEl = $("oldPrice");
  oldEl.textContent = p.oldPrice || "";
  oldEl.style.visibility = p.oldPrice ? "visible" : "hidden";

  // Badge
  const off = (p.oldPrice && p.mainPrice) ? computeOff(p.oldPrice, p.mainPrice) : null;

  if(off !== null){
    $("pillText").textContent = "PROMO";
    offEl.textContent = `-${off}%`;
    offEl.style.display = "inline-block";

    // pop inteligente
    if(off >= 30) popBadge("badge-pop-hard");
    else popBadge("badge-pop-soft");
  } else {
    // si no hay %, igual mostrar “PROMO” sin badge
    $("pillText").textContent = "PROMO";
    offEl.style.display = "none";
    offEl.classList.remove("badge-pop-soft","badge-pop-hard");
  }

  // Imagen crossfade
  if(p.imgSrc){
    swapImage(p.imgSrc);
  } else {
    // fallback: logo
    swapImage("img/logo.png");
  }

  // animaciones
  media.classList.remove("media-enter");
  document.body.classList.remove("text-enter");
  $("promoPrice").classList.remove("price-punch");
  void card.offsetWidth;
  media.classList.add("media-enter");
  document.body.classList.add("text-enter");
  setTimeout(() => $("promoPrice").classList.add("price-punch"), 190);

  // progress con duración real de promo
  setProgress(p.durationMs);

  return p.durationMs;
}

/* Rotación con duración variable (setTimeout) */
function scheduleNext(delayMs){
  clearTimeout(timer);
  timer = setTimeout(() => {
    showNext();
  }, delayMs);
}

function showNoPromos(){
  const card = $("promoCard");
  card.dataset.accent = "default";
  runWipe();

  $("pillText").textContent = "INFO";
  $("offBadge").style.display = "none";

  $("promoTitle").textContent = "HOY NO HAY PROMOS";
  $("promoDesc").textContent = "Escaneá el QR para ver el menú completo.\nConsultá en mostrador por disponibilidad.";
  $("promoDesc").style.whiteSpace = "pre-line";

  $("oldPrice").style.visibility = "hidden";
  $("promoPrice").textContent = "";
  $("promoNote").textContent = "Cantina ADPUT";

  swapImage("img/logo.png");

  const media = $("promoMedia");
  media.classList.remove("media-enter");
  document.body.classList.remove("text-enter");
  $("promoPrice").classList.remove("price-punch");
  void card.offsetWidth;
  media.classList.add("media-enter");
  document.body.classList.add("text-enter");

  $("status").textContent = "Sin promos";
  const dur = DEFAULT_ROTATE_MS;
  setProgress(dur);
  scheduleNext(dur);
}

function showNext(){
  if(!promos.length){
    showNoPromos();
    return;
  }

  steps++;

  // cada SUMMARY_EVERY promos -> resumen
  if(SUMMARY_EVERY > 0 && steps % (SUMMARY_EVERY + 1) === 0){
    const dir = (steps % 2 === 0) ? 1 : -1;
    const d = renderSummary(dir);
    scheduleNext(d);
    return;
  }

  const p = promos[idx];
  const dir = (idx % 2 === 0) ? 1 : -1;
  const d = renderPromo(p, dir);

  idx = (idx + 1) % promos.length;
  scheduleNext(d);
}

/* =========================
   LOAD
========================= */
async function loadPromos(){
  try{
    $("status").textContent = "Actualizando datos…";
    const rows = await fetchSheetRows();
    promos = buildPromos(rows);
    idx = 0;
    steps = 0;

    $("status").textContent = promos.length ? `OK · ${promos.length} promos` : "Sin promos";
    showNext();
  } catch(err){
    console.error(err);
    $("status").textContent = "Error leyendo Google Sheets";

    // pantalla linda igual
    promos = [];
    idx = 0;
    steps = 0;
    showNoPromos();
  }
}

/* INIT */
setClock();
setInterval(setClock, 10_000);
setCTA();
startParallax();

loadPromos();
setInterval(loadPromos, REFRESH_MS);
