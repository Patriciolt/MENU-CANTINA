/* =========================
   CONFIG
========================= */
const SHEET_ID = "1c4WYczs2NjwPz0f9aaSZShC-FaU3H9wnUm7FuYd9c6o";
const SHEET_NAME = "Sheet1";

const REFRESH_MS = 60_000;
// Duración de cada pantalla (promos / pantalla de menú) en milisegundos
// Pedido: 15 segundos
const ROTATE_MS  = 15_000;
const SHUFFLE    = true;

/* Links */
const MENU_URL = "https://adputcantina.com.ar/menu.html";
const INSTAGRAM_URL = "https://www.instagram.com/adputcantina?igsh=dW5xYTZzZmxkMGg5";

/* WhatsApp (link directo) */
const WAPP_NUMBER_E164 = "5493816836838"; // +54 9 3816 83-6838
const WHATSAPP_URL = `https://wa.me/${WAPP_NUMBER_E164}`;

/* Clima: San Miguel de Tucumán */
const LAT = -26.8083;
const LON = -65.2176;
const WEATHER_REFRESH_MS = 15 * 60_000;

// ✅ Descuento desactivado (no mostrar porcentaje)
const DISCOUNT_ENABLED = false;

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
  if(/[a-zA-ZxX]/.test(t)) return t;
  const n = toNumber(t, NaN);
  if(Number.isFinite(n)) return "$ " + n.toLocaleString("es-AR");
  return t;
}
function numberFromMoneyText(txt){
  const digits = normalize(txt).replace(/[^\d]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : NaN;
}
function shuffleInPlace(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* =========================
   FECHA / HORA
========================= */
function setClock(){
  const d = new Date();
  $("clock").textContent = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function setDate(){
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("es-AR", { weekday:"short", day:"2-digit", month:"short" });
  $("dateChip").textContent = fmt.format(d).replace(".", "");
}

/* =========================
   QR (imágenes)
========================= */
function setQRs(){
  const qrMenu = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(MENU_URL);
  const qrWapp = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(WHATSAPP_URL);
  const qrIg   = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(INSTAGRAM_URL);

  $("qrMenu").src = qrMenu;
  $("qrWapp").src = qrWapp;
  $("qrIg").src   = qrIg;
}

/* =========================
   CLIMA (Open-Meteo, sin API key)
========================= */
function weatherCodeToText(code){
  const map = {
    0: "Despejado",
    1: "Mayormente despejado",
    2: "Parcial nublado",
    3: "Nublado",
    45: "Neblina",
    48: "Neblina",
    51: "Llovizna",
    53: "Llovizna",
    55: "Llovizna",
    61: "Lluvia",
    63: "Lluvia",
    65: "Lluvia fuerte",
    71: "Nieve",
    73: "Nieve",
    75: "Nieve fuerte",
    80: "Chubascos",
    81: "Chubascos",
    82: "Chubascos fuertes",
    95: "Tormentas",
    96: "Tormentas",
    99: "Tormentas fuertes"
  };
  return map[code] || "Tiempo";
}
function weatherCodeToEmoji(code){
  if(code === 0) return "☀️";
  if(code === 1) return "🌤️";
  if(code === 2) return "⛅";
  if(code === 3) return "☁️";
  if(code === 45 || code === 48) return "🌫️";
  if([51,53,55].includes(code)) return "🌦️";
  if([61,63,65,80,81,82].includes(code)) return "🌧️";
  if([95,96,99].includes(code)) return "⛈️";
  if([71,73,75].includes(code)) return "❄️";
  return "⛅";
}

async function loadWeather(){
  try{
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&current_weather=true` +
      `&hourly=precipitation_probability` +
      `&timezone=auto`;

    const res = await fetch(url, { cache:"no-store" });
    if(!res.ok) throw new Error("HTTP clima " + res.status);
    const data = await res.json();

    const temp = Math.round(data?.current_weather?.temperature ?? NaN);
    const code = data?.current_weather?.weathercode;
    const text = weatherCodeToText(code);
    const emoji = weatherCodeToEmoji(code);

    const nowIso = data?.current_weather?.time;
    const times = data?.hourly?.time || [];
    const probs = data?.hourly?.precipitation_probability || [];

    let rainProb = null;
    if(nowIso && times.length && probs.length){
      const i = times.indexOf(nowIso);
      rainProb = (i >= 0) ? probs[i] : probs[0];
    }

    const rainText = (rainProb == null) ? "--%" : `${Math.round(rainProb)}%`;

    $("wEmoji").textContent = emoji;
    $("wText").textContent = `${Number.isFinite(temp) ? temp : "--"}° · ${text} · Lluvia ${rainText}`;
  } catch(e){
    $("wEmoji").textContent = "⛅";
    $("wText").textContent = `--° · Clima no disponible · Lluvia --%`;
    console.error("Clima:", e);
  }
}

/* =========================
   PARALLAX
========================= */
function startParallax(){
  const wm = $("watermark");
  const pt = $("pattern");
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
  const res = await fetch(url, { cache:"no-store" });
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
   PROMOS ONLY + PRICE LOGIC
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
    const oa = toNumber(a["TV ORDEN"], toNumber(a["Orden"], 999999));
    const ob = toNumber(b["TV ORDEN"], toNumber(b["Orden"], 999999));
    return oa - ob;
  });

  const out = promos.map(r => {
    const nombre = normalize(r["Producto"]);
    const tvTitulo = normalize(r["TV TITULO"]);
    const categoria = normalize(r["Categoria"]);
    // Si querés una línea de texto debajo del título, usá "TV DESCRIPCION" en la planilla.
    // (No ponemos texto por defecto para evitar la leyenda "Escaneá el QR..." en cada promo.)
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

    // Nota (texto chico abajo a la derecha) desactivada por pedido.
    const note = "";

    return {
      nombre,
      tvTitulo,
      categoria,
      accent: accentFromCategory(categoria),
      desc,
      imgSrc,
      mainPrice,
      oldPrice,
      note
    };
  });

  if(SHUFFLE) shuffleInPlace(out);
  return out;
}

/* =========================
   ANIMACIONES + ROTACIÓN
========================= */
let promos = [];
let idx = 0;
let rotateTimer = null;
let activeLayer = "A";

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
    return Math.round(((oldN - newN) / oldN) * 100);
  }
  return null;
}
function swapImage(src){
  const imgA = $("promoImgA");
  const imgB = $("promoImgB");
  const next = activeLayer === "A" ? imgB : imgA;
  const current = activeLayer === "A" ? imgA : imgB;

  next.onerror = () => { next.src = "img/logo.png"; };
  next.src = src || "img/logo.png";

  next.classList.add("is-active");
  current.classList.remove("is-active");
  activeLayer = (activeLayer === "A") ? "B" : "A";
}

function renderPromo(p){
  hideMenuSlide();
  const card = $("promoCard");
  const media = $("promoMedia");
  const offEl = $("offBadge");

  card.dataset.accent = p?.accent || "default";
  runWipe();

  // Título: usar TV TITULO (sin mostrar el nombre original del producto)
  const titulo = p?.tvTitulo || p?.nombre || "PROMO";
  $("promoTitle").textContent = titulo;

  // Descripción opcional: si no hay, no mostrar nada (sin leyenda "Escaneá el QR...")
  const descEl = $("promoDesc");
  const descTxt = (p?.desc || "").trim();
  descEl.textContent = descTxt;
  descEl.style.display = descTxt ? "block" : "none";

  // No mostrar ningún "nombre" más chico abajo
  const noteEl = $("promoNote");
  noteEl.textContent = "";
  noteEl.style.display = "none";

  $("promoPrice").textContent = p?.mainPrice || "";

  const oldEl = $("oldPrice");
  oldEl.textContent = p?.oldPrice || "";
  oldEl.style.visibility = (p?.oldPrice) ? "visible" : "hidden";

  // Descuento (DESHABILITADO: no mostrar porcentaje)
  $("pillText").textContent = "PROMO";
  offEl.textContent = "";
  offEl.style.display = "none";
  offEl.classList.remove("badge-pop-soft","badge-pop-hard");

  swapImage(p?.imgSrc || "img/logo.png");

  media.classList.remove("media-enter");
  document.body.classList.remove("text-enter");
  $("promoPrice").classList.remove("price-punch");
  void card.offsetWidth;
  media.classList.add("media-enter");
  document.body.classList.add("text-enter");
  setTimeout(() => $("promoPrice").classList.add("price-punch"), 190);

  setProgress(ROTATE_MS);
}


/* -------------------------
   PANTALLA MENÚ (15s)
   ------------------------- */
function showMenuSlide(){
  const slide = $("menuSlide");
  if(!slide) return;

  // Mostrar overlay
  slide.classList.remove("hidden");
  slide.setAttribute("aria-hidden","false");

  // Dejar el fondo y el movimiento visibles
  const media = $("promoMedia");
  const info = $("promoInfo");
  if(media) media.style.opacity = "0.18";
  if(info) info.style.opacity = "0.18";

  // Completar textos
  const pill = $("menuUrlPill");
  if(pill) pill.textContent = MENU_URL.replace(/^https?:\/\//,'').replace(/\/$/,'');
  const wtxt = $("menuWappTxt");
  if(wtxt) wtxt.textContent = `Pedidos por WhatsApp: ${WAPP_NUMBER_E164.replace(/^\+/,'+')}`;

  // QR grande
  const api = "https://api.qrserver.com/v1/create-qr-code/?color=000000&bgcolor=FFFFFF&margin=8&";
  const big = $("qrMenuBig");
  if(big) big.src = api + "size=700x700&data=" + encodeURIComponent(MENU_URL);
}

function hideMenuSlide(){
  const slide = $("menuSlide");
  if(!slide) return;
  slide.classList.add("hidden");
  slide.setAttribute("aria-hidden","true");

  const media = $("promoMedia");
  const info = $("promoInfo");
  if(media) media.style.opacity = "";
  if(info) info.style.opacity = "";
}

function startRotation(){
  // Ocultar status "OK/Promos"
  const st = $("status");
  if(st) st.textContent = "";

  if(rotateTimer) clearTimeout(rotateTimer);

  if(!promos.length){
    hideMenuSlide();
    renderPromo(null);
    if(st) st.textContent = "Sin promos";
    return;
  }

  let i = 0;
  let mode = "promo"; // promo -> ... -> promo -> menu -> promo ...
  hideMenuSlide();
  renderPromo(promos[i]);

  const tick = () => {
    if(mode === "promo"){
      // Avanzar promo
      i += 1;

      if(i >= promos.length){
        // Terminar ciclo de promos -> mostrar MENÚ
        mode = "menu";
        showMenuSlide();
      }else{
        hideMenuSlide();
        renderPromo(promos[i]);
      }
    }else{
      // Volver a empezar
      mode = "promo";
      i = 0;
      hideMenuSlide();
      renderPromo(promos[i]);
    }

    rotateTimer = setTimeout(tick, ROTATE_MS);
  };

  rotateTimer = setTimeout(tick, ROTATE_MS);
}


async function loadPromos(){
  try{
    $("status").textContent = "Actualizando datos…";
    const rows = await fetchSheetRows();
    promos = buildPromos(rows);
    $("status").textContent = promos.length ? `OK · ${promos.length} promos` : "Sin promos";
    startRotation();
  } catch(err){
    console.error(err);
    promos = [];
    $("status").textContent = "Error leyendo Google Sheets";
    startRotation();
  }
}

/* INIT */
setClock();
setDate();
setInterval(setClock, 10_000);
setInterval(setDate, 60_000);

setQRs();
startParallax();

loadPromos();
setInterval(loadPromos, REFRESH_MS);

/* Clima */
loadWeather();
setInterval(loadWeather, WEATHER_REFRESH_MS);
