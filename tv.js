// =============================
// TV Promos - Cantina ADPUT
// =============================


// ✅ Planilla principal (según tu captura)
const SPREADSHEET_ID = "1c4WYczs2NjwPz0f9aaSZShC-FaU3H9wnUm7FuYd9c6o";
const SHEET_NAME = "Sheet1";

// CSV export (estable)
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

// Google Sheet (TV)
// IMPORTANTE: mantené esta URL como en tu versión que ya venía funcionando.
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

// --- Robustez (evita pantalla en blanco) ---
const CACHE_KEY = "adput_tv_cache_v1";
const FETCH_TIMEOUT_MS = 6500;

function fetchWithTimeout(url, opts = {}, timeoutMs = FETCH_TIMEOUT_MS){
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function readCache(){
  try{
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(_){ return null; }
}

function writeCache(payload){
  try{
    const prev = readCache() || {};
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...prev, ts: Date.now(), ...payload }));
  }catch(_){ /* ignore */ }
}

function setImgWithFallback(imgEl, srcList) {
  if (!imgEl) return;
  const list = (srcList || []).filter(Boolean);
  if (list.length === 0) return;
  let idx = 0;
  const tryNext = () => {
    if (idx >= list.length) return;
    imgEl.src = list[idx++];
  };
  imgEl.addEventListener("error", tryNext);
  // primer intento
  tryNext();
}

function setupQrLeftLogos() {
  // Soportamos ambos nombres: con espacio (repo actual) y con guion bajo (versiones anteriores)
  const wapp = document.querySelector(".qr-wapp .qr-left-logo");
  const inst = document.querySelector(".qr-inst .qr-left-logo");

  setImgWithFallback(wapp, [
    "img/icono%20wapp.png",
    "img/icono_wapp.png",
    "img/icono%20wapp.PNG",
    "img/icono_wapp.PNG",
  ]);

  setImgWithFallback(inst, [
    "img/icono%20inst.png",
    "img/icono_inst.png",
    "img/icono%20inst.PNG",
    "img/icono_inst.PNG",
  ]);
}

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
  promoDesc: document.getElementById("promoDesc"),
  promoContador: document.getElementById("promoContador"),
  bar: document.getElementById("bar"),

  qrMenuBig: document.getElementById("qrMenuBig"),
  qrWappBig: document.getElementById("qrWappBig"),
  qrIgBig: document.getElementById("qrIgBig"),

  stepMenu: document.getElementById("qrStepMenu"),
  stepWapp: document.getElementById("qrStepWapp"),
  stepIg: document.getElementById("qrStepIg"),
};

// Forzar ocultar contador de promos (pedido)
try{ if(el.promoContador){ el.promoContador.style.display='none'; } }catch(e){}


let promos = [];
let promoIndex = 0;
let mode = "promo";
let timer = null;
let barTimer = null;
let currentSlideId = "";

// Frases rotativas para las pantallas QR (debajo del QR)
const QR_PHRASES = {
  menu: [
    "Abrí el menú en tu celu 📲",
    "Promos y precios actualizados ✅",
    "Escaneá y elegí al toque 🍔",
  ],
  wapp: [
    "Pedí sin esperar 💬",
    "Te respondemos rápido ⚡",
    "Enviá tu pedido por WhatsApp ✅",
  ],
  ig: [
    "Enterate de promos y sorteos 🎁",
    "Novedades de la cantina 🔥",
    "Seguinos para no perderte nada ✅",
  ],
};
const _qrPhraseState = { menu: 0, wapp: 0, ig: 0 };

function setActive(which) {
  Object.values(slides).forEach(s => s.classList.remove("active"));
  slides[which].classList.add("active");
  // Para estilos por pantalla (colores / overlays)
  document.body.dataset.slide = which;
  currentSlideId = which;
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

// ---------- QR frases rotativas ----------
function _setPhrase(kind, text) {
  const map = {
    menu: document.getElementById("qrPhraseMenu"),
    wapp: document.getElementById("qrPhraseWapp"),
    ig: document.getElementById("qrPhraseIg"),
  };
  const node = map[kind];
  if (!node) return;
  // Fade suave
  node.classList.add("is-fading");
  setTimeout(() => {
    node.textContent = text;
    node.classList.remove("is-fading");
  }, 220);
}

function setupQrPhraseRotator() {
  // Inicial
  _setPhrase("menu", QR_PHRASES.menu[0]);
  _setPhrase("wapp", QR_PHRASES.wapp[0]);
  _setPhrase("ig", QR_PHRASES.ig[0]);

  setInterval(() => {
    // Solo rota la frase de la pantalla activa (para que se note el cambio)
    const which = currentSlideId;
    const kind = which === "menu" ? "menu" : which === "wapp" ? "wapp" : which === "ig" ? "ig" : null;
    if (!kind) return;
    const list = QR_PHRASES[kind];
    _qrPhraseState[kind] = (_qrPhraseState[kind] + 1) % list.length;
    _setPhrase(kind, list[_qrPhraseState[kind]]);
  }, 4200);
}

// ---------- Resiliencia / anti burn-in ----------
function setupBurnInShift() {
  const tv = document.querySelector(".tv");
  if (!tv) return;
  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  setInterval(() => {
    // micro desplazamiento imperceptible
    tv.style.setProperty("--shift-x", rnd(-6, 6) + "px");
    tv.style.setProperty("--shift-y", rnd(-4, 4) + "px");
  }, 45000);
}

function setupAutoReload() {
  // Recarga preventiva (no suma tiempo de respuesta en cada pantalla)
  setTimeout(() => {
    try { location.reload(); } catch (_) {}
  }, 1000 * 60 * 60 * 8); // 8 horas
}

function setupCrashGuards() {
  const triggerReloadSoon = () => {
    // Si hay error JS, recargamos rápido para evitar pantalla en blanco
    setTimeout(() => {
      try { location.reload(); } catch (_) {}
    }, 2500);
  };
  window.addEventListener("error", triggerReloadSoon);
  window.addEventListener("unhandledrejection", triggerReloadSoon);
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
  try {
    const res = await fetchWithTimeout(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo leer la planilla");
    const csv = await res.text();
    const rows = parseCSV(csv);
    if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h || "").trim());

  const pickIndex = (candidates) => {
    const norm = (s) => String(s || "").trim().toLowerCase();
    const hs = headers.map(norm);

    // 1) match exact
    for (const c of candidates) {
      const target = norm(c);
      const i = hs.indexOf(target);
      if (i >= 0) return i;
    }

    // 2) match "contains" (para headers tipo "TV PRECIO TEXTO")
    for (const c of candidates) {
      const target = norm(c);
      const i = hs.findIndex(h => h.includes(target));
      if (i >= 0) return i;
    }

    return -1;
  };

  // Columnas según tu planilla:
  // TV_ACTIVO, TV_ORDEN, TV_TITULO, TV_PRECIO y "Imagen" (nombre del archivo dentro de /img)
  const iTVActivo = pickIndex(["TV ACTIVO", "TV_ACTIVO"]);
  const iTVOrden  = pickIndex(["TV ORDEN", "TV_ORDEN"]);
  const iTitulo   = pickIndex(["TV TITULO", "TV_TITULO"]);
  const iPrecio   = pickIndex(["TV PRECIO", "TV_PRECIO"]); 
  const iDesc     = pickIndex(["TV DESCRIPCION","TV DESCRIPCIÓN","TV_DESCRIPCION","TV_DESCRIPCIÓN","TV DESCRIPCION TEXTO","TV DESCRIPCIÓN TEXTO"]);

  
  const iPrecioPromo = pickIndex(["Precio Promo","PRECIO PROMO","PrecioPromo","PRECIOPROMO"]);
  const iPrecioBase  = pickIndex(["Precio","PRECIO"]);const iImagen   = pickIndex(["Imagen", "IMAGEN", "IMG", "FOTO"]);

  const normalizeBool = (val) => {
    const v = String(val ?? "").trim().toLowerCase();
    return ["si","sí","1","true","ok","x"].includes(v);
  };

  const resolveImagePath = (raw) => {
    const v = String(raw ?? "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (v.startsWith("img/")) return v;
    return "img/" + v;
  };

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    const activo = iTVActivo >= 0 ? row[iTVActivo] : "";
    if (!normalizeBool(activo)) continue; // ✅ solo los "si" en TV ACTIVO

    const ordenRaw = iTVOrden >= 0 ? String(row[iTVOrden] || "") : "";
    const orden = Number(ordenRaw.replace(/[^\d]/g, "")) || 9999;

    const titulo = iTitulo >= 0 ? String(row[iTitulo] || "").trim() : "";
    const precioTV = iPrecio >= 0 ? String(row[iPrecio] || "").trim() : "";
    const precioPromo = iPrecioPromo >= 0 ? String(row[iPrecioPromo] || "").trim() : "";
    const precioBase = iPrecioBase >= 0 ? String(row[iPrecioBase] || "").trim() : "";
    const precio = (precioTV || precioPromo || precioBase).trim();
    const imagen = iImagen >= 0 ? resolveImagePath(row[iImagen]) : "";
    const descripcion = iDesc >= 0 ? String(row[iDesc] || "").trim() : "";

    out.push({ orden, titulo, precio, imagen, descripcion });
  }

    out.sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));
    // cache: si internet o la planilla fallan, evitamos pantalla en blanco
    writeCache({ promos: out });
    return out;
  } catch (e) {
    console.error("Sheet error", e);
    const cached = readCache();
    return cached?.promos || [];
  }
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
  if (el.promoDesc) el.promoDesc.textContent = (p?.descripcion || "").trim();

  el.promoContador.textContent = "";
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
    const res = await fetchWithTimeout(url, { cache: "no-store" });
    const data = await res.json();
    const t = Math.round(data?.current?.temperature_2m ?? 0);

    const code = data?.current?.weather_code;
    let desc = "Despejado";
    if ([1,2,3].includes(code)) desc = "Nublado";
    if ([51,53,55,61,63,65,80,81,82].includes(code)) desc = "Lluvia";
    if ([71,73,75,77,85,86].includes(code)) desc = "Nieve";
    if ([95,96,99].includes(code)) desc = "Tormenta";

    document.getElementById("climaTxt").textContent = `${t}° · ${desc}`;
    const ico = document.getElementById("climaIcon");
    if(ico){
      let e="⛅";
      if(desc==="Despejado") e="☀️";
      if(desc==="Nublado") e="☁️";
      if(desc==="Lluvia") e="🌧️";
      if(desc==="Tormenta") e="⛈️";
      if(desc==="Nieve") e="❄️";
      ico.textContent = e;
    }

    writeCache({
      weather: { t, desc }
    });
  }catch(e){
    console.warn("Clima:", e);
    const cached = readCache();
    if(cached?.weather){
      const t = cached.weather.t;
      const desc = cached.weather.desc;
      document.getElementById("climaTxt").textContent = `${t}° · ${desc}`;
      const ico = document.getElementById("climaIcon");
      if(ico){
        let em="⛅";
        if(desc==="Despejado") em="☀️";
        if(desc==="Nublado") em="☁️";
        if(desc==="Lluvia") em="🌧️";
        if(desc==="Tormenta") em="⛈️";
        if(desc==="Nieve") em="❄️";
        ico.textContent = em;
      }
    }
  }
}

// ---------- Init ----------
(async function init(){
  tickClock();
  setInterval(tickClock, 1000);
  await loadWeather();
  setInterval(loadWeather, 10 * 60 * 1000);

  setQrs();
  setupQrLeftLogos();
  setupQrPhraseRotator();
  setupBurnInShift();
  setupAutoReload();
  setupCrashGuards();

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
