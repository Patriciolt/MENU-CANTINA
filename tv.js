// =============================
// TV Promos - Cantina ADPUT
// =============================

// Google Sheet (TV)
// IMPORTANTE: mantené esta URL como en tu versión que ya venía funcionando.
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1VDxWq5d6A4wqGvKQ7u5wY3jI0JxE5E8qDqjJ2G9q8q4/gviz/tq?tqx=out:csv&sheet=TV";

// Duraciones
const PROMO_MS = 15000;
const QR_MS = 15000;

// Links QR
const MENU_URL = "https://adputcantina.com.ar/menu.html";
const WAPP_URL = "https://wa.me/5493816836838";
const IG_URL = "https://instagram.com/adputcantina";

// Promos de respaldo (si la planilla no carga o viene vacía)
// Usan imágenes locales existentes en /img (no cambia la estructura del repo).
const DEFAULT_PROMOS = [
  { titulo: "EMPANADAS", imagen: "img/empanadas.png", precio: "", viejo: "" },
  { titulo: "SÁNDWICH MILANESA", imagen: "img/sandmila.png", precio: "", viejo: "" },
  { titulo: "BIFE CON ENSALADA", imagen: "img/bifeconens.png", precio: "", viejo: "" },
  { titulo: "MUZZA Y COCA", imagen: "img/muzzaycoca.png", precio: "", viejo: "" },
];

// Clima (San Miguel de Tucumán)
const LAT = -26.8241;
const LON = -65.2226;

// UI refs
const slides = {
  promo: document.getElementById("slide-promo"),
  menu: document.getElementById("slide-menu"),
  wapp: document.getElementById("slide-wapp"),
  ig: document.getElementById("slide-ig"),
};

const el = {
  promoImg: document.getElementById("promoImg"),
  promoTitulo: document.getElementById("promoTitulo"),
  promoPrecio: document.getElementById("promoPrecio"),
  promoPrecioViejo: document.getElementById("promoPrecioViejo"),
  promoContador: document.getElementById("promoContador"),
  bar: document.getElementById("bar"),

  qrMenuBig: document.getElementById("qrMenuBig"),
  qrWappBig: document.getElementById("qrWappBig"),
  qrIgBig: document.getElementById("qrIgBig"),

  stepMenu: document.getElementById("qrStepMenu"),
  stepWapp: document.getElementById("qrStepWapp"),
  stepIg: document.getElementById("qrStepIg"),
};

let promos = [];
let promoIndex = 0;
let mode = "promo";
let timer = null;
let barTimer = null;

function setActive(which) {
  Object.values(slides).forEach(s => s.classList.remove("active"));
  slides[which].classList.add("active");
  // Para estilos por pantalla (colores / overlays)
  document.body.dataset.slide = which;
}

function money(val) {
  if (val == null) return "";
  const n = String(val).replace(/[^0-9]/g, "");
  if (!n) return "";
  return "$" + Number(n).toLocaleString("es-AR");
}

function makeQR(url, size = 520) {
  const s = Math.max(300, Math.min(900, size));
  const enc = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&margin=18&data=${enc}`;
}

function startProgress(ms) {
  if (!el.bar) return;
  clearInterval(barTimer);
  el.bar.style.width = "0%";
  const start = performance.now();
  barTimer = setInterval(() => {
    const t = performance.now() - start;
    const pct = Math.min(100, (t / ms) * 100);
    el.bar.style.width = pct.toFixed(1) + "%";
    if (pct >= 100) clearInterval(barTimer);
  }, 60);
}

// ---------- CSV ----------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cur);
      cur = "";
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

async function cargarPromos() {
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo leer la planilla");
  const csv = await res.text();
  const rows = parseCSV(csv);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h || "").trim());
  const norm = (s) => String(s || "").trim().toLowerCase();

  const idx = (names) => {
    const arr = Array.isArray(names) ? names : [names];
    const want = arr.map(norm);
    return headers.findIndex(h => want.includes(norm(h)));
  };

  // Soportamos varios nombres de columnas (por si cambió la planilla)
  const iActivo = idx(["TV_ACTIVO","ACTIVO","HABILITADO","TV_OK","OK"]);
  const iTitulo = idx(["TV_TITULO","TITULO","NOMBRE","PRODUCTO","ITEM"]);
  const iImagen = idx(["TV_IMAGEN","IMAGEN","IMG","FOTO","URL_IMAGEN","URL"]);
  const iPrecio = idx(["TV_PRECIO","PRECIO","VALOR","PRECIO_ACTUAL"]);
  const iViejo  = idx(["TV_PRECIO_ANT","TV_PRECIO_ANTES","PRECIO_ANT","PRECIO_ANTES","ANTES"]);

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    const activo = iActivo >= 0 ? String(row[iActivo] || "").trim().toLowerCase() : "si";
    if (activo && !["si", "sí", "1", "true", "ok"].includes(activo)) continue;

    const titulo = iTitulo >= 0 ? String(row[iTitulo] || "").trim() : "";
    const imagen = iImagen >= 0 ? String(row[iImagen] || "").trim() : "";
    const precio = iPrecio >= 0 ? String(row[iPrecio] || "").trim() : "";
    const viejo  = iViejo  >= 0 ? String(row[iViejo]  || "").trim() : "";

    if (!titulo && !imagen && !precio) continue;
    out.push({ titulo, imagen, precio, viejo });
  }
  return out;
}

// ---------- Render ----------
function renderPromo(p, total) {
  el.promoTitulo.textContent = (p?.titulo || "PROMO").toUpperCase();

  if (p?.imagen) {
    el.promoImg.src = p.imagen;
    el.promoImg.style.opacity = "1";
  } else {
    el.promoImg.removeAttribute("src");
    el.promoImg.style.opacity = "0";
  }

  const mPrecio = money(p?.precio);
  const mViejo = money(p?.viejo);

  el.promoPrecio.textContent = mPrecio || "";
  el.promoPrecioViejo.textContent = mViejo || "";

  el.promoContador.textContent = `OK · ${total} promos`;
}

function setQrs() {
  if (el.qrMenuBig) el.qrMenuBig.src = makeQR(MENU_URL, 560);
  if (el.qrWappBig) el.qrWappBig.src = makeQR(WAPP_URL, 560);
  if (el.qrIgBig) el.qrIgBig.src = makeQR(IG_URL, 560);
}

// ---------- Rotación ----------
function next() {
  clearTimeout(timer);

  if (mode === "promo") {
    if (!promos.length) {
      // si no hay promos, mostramos QR menú mientras tanto
      mode = "menu";
      setActive("menu");
      startProgress(QR_MS);
      timer = setTimeout(next, QR_MS);
      return;
    }

    // Render promo actual
    renderPromo(promos[promoIndex], promos.length);
    setActive("promo");
    startProgress(PROMO_MS);

    promoIndex++;

    // Si terminamos las promos, después va a QR MENÚ
    if (promoIndex >= promos.length) {
      promoIndex = 0;
      mode = "menu";
    }

    timer = setTimeout(next, PROMO_MS);
    return;
  }

  if (mode === "menu") {
    setActive("menu");
    startProgress(QR_MS);
    mode = "wapp";
    timer = setTimeout(next, QR_MS);
    return;
  }

  if (mode === "wapp") {
    setActive("wapp");
    startProgress(QR_MS);
    mode = "ig";
    timer = setTimeout(next, QR_MS);
    return;
  }

  if (mode === "ig") {
    setActive("ig");
    startProgress(QR_MS);
    mode = "promo";
    timer = setTimeout(next, QR_MS);
    return;
  }
}

// ---------- Fecha / Hora / Clima (simple) ----------
function pad(n){return String(n).padStart(2,"0");}

function tickClock(){
  const d = new Date();
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  document.getElementById("clock").textContent = `${hh}:${mm}`;

  const dias = ["dom","lun","mar","mié","jue","vie","sáb"];
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  document.getElementById("fechaTxt").textContent = `${dias[d.getDay()]}, ${pad(d.getDate())} ${meses[d.getMonth()]}`;
}

async function loadWeather(){
  try{
    // Open-Meteo (gratis)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&timezone=auto`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const t = Math.round(data?.current?.temperature_2m ?? 0);

    const code = data?.current?.weather_code;
    let desc = "Despejado";
    if ([1,2,3].includes(code)) desc = "Nublado";
    if ([51,53,55,61,63,65,80,81,82].includes(code)) desc = "Lluvia";
    if ([71,73,75,77,85,86].includes(code)) desc = "Nieve";
    if ([95,96,99].includes(code)) desc = "Tormenta";

    document.getElementById("climaTxt").textContent = `${t}° · ${desc}`;
  }catch(e){
    console.warn("Clima:", e);
  }
}

// ---------- Init ----------
(async function init(){
  tickClock();
  setInterval(tickClock, 1000);
  await loadWeather();
  setInterval(loadWeather, 10 * 60 * 1000);

  setQrs();

  try {
    promos = await cargarPromos();
  } catch (e) {
    console.warn(e);
    promos = DEFAULT_PROMOS.slice();
  }

  // Si la planilla cargó pero vino sin filas activas, usamos respaldo
  if (!Array.isArray(promos) || promos.length === 0) {
    promos = DEFAULT_PROMOS.slice();
  }

  // arrancamos en promos
  mode = "promo";
  promoIndex = 0;
  next();

  // recargar promos cada 5 min sin cortar la rotación
  setInterval(async () => {
    try {
      promos = await cargarPromos();
      if (!Array.isArray(promos) || promos.length === 0) promos = DEFAULT_PROMOS.slice();
    } catch (e) {
      console.warn(e);
      if (!Array.isArray(promos) || promos.length === 0) promos = DEFAULT_PROMOS.slice();
    }
  }, 5 * 60 * 1000);
})();
