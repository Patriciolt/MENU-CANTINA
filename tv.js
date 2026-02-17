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
};

let promos = [];
let promoIndex = 0;
let mode = "promo"; // promo | menu | wapp | ig
let timer = null;
let barTimer = null;

// ---------- Helpers ----------
function setActive(which) {
  Object.values(slides).forEach(s => s.classList.remove("active"));
  slides[which].classList.add("active");
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
  const idx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const iActivo = idx("TV_ACTIVO");
  const iTitulo = idx("TV_TITULO");
  const iImagen = idx("TV_IMAGEN");
  const iPrecio = idx("TV_PRECIO");
  const iViejo = idx("TV_PRECIO_ANT");

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const activo = iActivo >= 0 ? String(row[iActivo] || "").trim().toLowerCase() : "si";
    if (activo && !["si", "sí", "1", "true", "ok"].includes(activo)) continue;

    const titulo = iTitulo >= 0 ? String(row[iTitulo] || "").trim() : "";
    const imagen = iImagen >= 0 ? String(row[iImagen] || "").trim() : "";
    const precio = iPrecio >= 0 ? String(row[iPrecio] || "").trim() : "";
    const viejo = iViejo >= 0 ? String(row[iViejo] || "").trim() : "";

    if (!titulo && !imagen && !precio) continue;
    out.push({ titulo, imagen, precio, viejo });
  }
  return out;
}

// ---------- Render ----------
function renderPromo(p, total) {
  el.promoTitulo.textContent = (p?.titulo || "PROMO").toUpperCase();

  // imagen: si viene vacía, dejamos un color suave
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
  if (el.qrMenuBig) el.qrMenuBig.src = makeQR(MENU_URL, 640);
  if (el.qrWappBig) el.qrWappBig.src = makeQR(WAPP_URL, 640);
  if (el.qrIgBig) el.qrIgBig.src = makeQR(IG_URL, 640);
}

// ---------- Ciclo ----------
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

function weatherCodeToText(code){
  const map = {
    0: "Despejado",
    1: "Mayormente despejado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Neblina",
    48: "Neblina",
    51: "Llovizna",
    53: "Llovizna",
    55: "Llovizna",
    61: "Lluvia",
    63: "Lluvia",
    65: "Lluvia",
    71: "Nieve",
    73: "Nieve",
    75: "Nieve",
    80: "Lluvia",
    81: "Lluvia",
    82: "Lluvia",
    95: "Tormentas",
    96: "Tormentas",
    99: "Tormentas"
  };
  return map[code] || "Tiempo";
}

async function loadWeather(){
  const climaEl = document.getElementById("climaTxt");
  try{
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&current_weather=true&hourly=precipitation_probability&timezone=auto`;

    const res = await fetch(url, { cache:"no-store" });
    if(!res.ok) throw new Error("HTTP clima " + res.status);
    const data = await res.json();

    const temp = Math.round(data?.current_weather?.temperature ?? NaN);
    const code = data?.current_weather?.weathercode;
    const text = weatherCodeToText(code);

    const nowIso = data?.current_weather?.time;
    const times = data?.hourly?.time || [];
    const probs = data?.hourly?.precipitation_probability || [];
    let rainProb = null;
    if(nowIso && times.length && probs.length){
      const i = times.indexOf(nowIso);
      rainProb = (i >= 0) ? probs[i] : probs[0];
    }
    const rainText = (rainProb == null) ? "--%" : `${Math.round(rainProb)}%`;

    climaEl.textContent = `${Number.isFinite(temp) ? temp : "--"}° · ${text} · Lluvia ${rainText}`;
  } catch(e){
    climaEl.textContent = `--° · Clima no disponible · Lluvia --%`;
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
    promos = [];
  }

  // arrancamos en promos
  mode = "promo";
  promoIndex = 0;
  next();

  // recargar promos cada 5 min sin cortar la rotación
  setInterval(async () => {
    try {
      promos = await cargarPromos();
    } catch (e) {
      console.warn(e);
    }
  }, 5 * 60 * 1000);
})();
