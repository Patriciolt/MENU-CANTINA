/* =========================
   CONFIG
========================= */
const SHEET_ID = "1c4WYczs2NjwPz0f9aaSZShC-FaU3H9wnUm7FuYd9c6o";
const SHEET_NAME = "Sheet1";

const REFRESH_MS = 60_000;
const ROTATE_MS  = 9_000;
const SHUFFLE    = true;

/* Links */
const MENU_URL = "https://adputcantina.com.ar/menu.html";
const INSTAGRAM_URL = "https://www.instagram.com/adputcantina?igsh=dW5xYTZzZmxkMGg5";

/* WhatsApp */
const WAPP_NUMBER = "+5493816836838"; // formato sin espacios
const WAPP_TEXT   = "Hola! Quiero hacer un pedido 😊";

const $ = (id) => document.getElementById(id);

/* =========================
   HELPERS
========================= */
function normalize(v){
  if(v === null || v === undefined) return "";
  return String(v).trim();
}
function upper(v){ return normalize(v).toUpperCase(); }
function isYes(v){
  const s = upper(v);
  return s === "SI" || s === "SÍ" || s === "YES" || s === "TRUE" || s === "1";
}
function toNumber(v, fallback=0){
  const s = normalize(v).replace(/\./g,"").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}
function money(v){
  const n = toNumber(v, NaN);
  if(!Number.isFinite(n)) return "";
  return "$ " + n.toLocaleString("es-AR");
}
function shuffleInPlace(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}

/* =========================
   CLOCK + DATE
========================= */
function tickClock(){
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,"0");
  const mm = String(now.getMinutes()).padStart(2,"0");
  const clock = $("clock");
  if(clock) clock.textContent = `${hh}:${mm}`;

  const dateChip = $("dateChip");
  if(dateChip){
    const dias = ["dom","lun","mar","mié","jue","vie","sáb"];
    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const d = dias[now.getDay()];
    const n = now.getDate();
    const m = meses[now.getMonth()];
    dateChip.textContent = `${d}, ${n} ${m}`;
  }
}
setInterval(tickClock, 1000);
tickClock();

/* =========================
   WEATHER (simple)
   (si tu versión anterior ya lo tenía con API, lo dejamos "best-effort"
========================= */
async function loadWeather(){
  // Si tu tv.js anterior tenía API, acá podrías reponerla.
  // Para no romper nada si no hay key, mostramos un texto neutro.
  const wText = $("wText");
  const wEmoji = $("wEmoji");
  if(wText) wText.textContent = "—";
  if(wEmoji) wEmoji.textContent = "⛅";
}
loadWeather();

/* =========================
   QRs
========================= */
function makeQRDataUrl(text, size=220){
  const api = "https://api.qrserver.com/v1/create-qr-code/";
  return `${api}?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}
function initQrs(){
  const qrMenu = $("qrMenu");
  const qrIg = $("qrIg");
  const qrWapp = $("qrWapp");

  if(qrMenu) qrMenu.src = makeQRDataUrl(MENU_URL, 260);
  if(qrIg)   qrIg.src   = makeQRDataUrl(INSTAGRAM_URL, 260);

  const wappLink = `https://wa.me/${WAPP_NUMBER.replace(/\D/g,"")}?text=${encodeURIComponent(WAPP_TEXT)}`;
  if(qrWapp) qrWapp.src = makeQRDataUrl(wappLink, 260);
}
initQrs();

/* =========================
   SHEET FETCH (GVIZ)
========================= */
async function fetchSheetRows(){
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const txt = await res.text();
  const json = JSON.parse(txt.substring(txt.indexOf('{'), txt.lastIndexOf('}')+1));
  const cols = json.table.cols.map(c => c.label);
  return json.table.rows.map(r => {
    const o = {};
    r.c.forEach((c,i)=> o[cols[i]] = c?.v ?? "");
    return o;
  });
}

/* =========================
   BUILD PROMOS (según tu sheet)
   - Activo = sí
   - TV ACTIVO = sí (si está vacío, se toma como sí)
   - Promo: cualquier valor no vacío y distinto de 0
========================= */
function isPromoValue(v){
  const s = normalize(v);
  if(!s) return false;
  if(s === "0") return false;
  return true; // "sí" o números como 2,3, etc.
}

function buildPromos(rows){
  const valid = rows.filter(r => {
    const activo = isYes(r["Activo"]);
    const tvCell = normalize(r["TV ACTIVO"]);
    const tvActivo = tvCell === "" ? true : isYes(tvCell);
    return activo && tvActivo && normalize(r["Producto"]);
  });

  const promos = valid.filter(r => isPromoValue(r["Promo"]));

  promos.sort((a,b) => {
    const oa = toNumber(a["TV ORDEN"], toNumber(a["Orden"], 999999));
    const ob = toNumber(b["TV ORDEN"], toNumber(b["Orden"], 999999));
    return oa - ob;
  });

  const out = promos.map(r => {
    const title = normalize(r["TV TITULO"]) || normalize(r["Producto"]);
    const desc  = normalize(r["TV DESCRIPCION"]) || normalize(r["Descripcion"]) || "";
    const img   = normalize(r["Imagen"]);
    const imgSrc = img ? `img/${img}` : "img/logo.png";

    const tvPrecio = normalize(r["TV PRECIO TEXTO"]);
    const precioBase = money(r["Precio"]);
    const precioPromo = money(r["Precio Promo"]);

    let mainPrice = "";
    let oldPrice = "";

    if(tvPrecio){
      mainPrice = tvPrecio;
      oldPrice = precioBase;
    } else if(precioPromo){
      mainPrice = precioPromo;
      if(precioBase && precioBase !== precioPromo) oldPrice = precioBase;
    } else {
      mainPrice = precioBase;
      oldPrice = "";
    }

    return { title, desc, imgSrc, mainPrice, oldPrice };
  });

  if(SHUFFLE) shuffleInPlace(out);
  return out;
}

/* =========================
   RENDER + ROTATE
   - Crossfade real con 2 capas
   - Sin porcentaje de descuento
   - Sin micro brillo del precio
========================= */
let promos = [];
let idx = 0;
let rotateTimer = null;

function swapImage(src){
  const imgA = $("promoImgA");
  const imgB = $("promoImgB");
  const next = activeLayer === "A" ? imgB : imgA;
  const current = activeLayer === "A" ? imgA : imgB;

  const target = src || "img/logo.png";

  const pre = new Image();
  pre.onload = () => {
    next.onerror = () => { next.src = "img/logo.png"; };
    next.src = target;
    next.classList.add("is-active");
    current.classList.remove("is-active");
    activeLayer = (activeLayer === "A") ? "B" : "A";
  };
  pre.onerror = () => {
    // Si falla la imagen, mantenemos la actual y evitamos pantalla gris.
  };
  pre.src = target;
}

function renderPromo(p){
  const titleEl = $("promoTitle");
  const descEl  = $("promoDesc");
  const priceEl = $("promoPrice");
  const oldEl   = $("oldPrice");
  const pillText= $("pillText");
  const offBadge= $("offBadge");

  if(offBadge) offBadge.textContent = ""; // no porcentaje

  if(!p){
    if(titleEl) titleEl.textContent = "SIN PROMOS ACTIVAS";
    if(descEl)  descEl.textContent  = "";
    if(priceEl) priceEl.textContent = "";
    if(oldEl)   oldEl.textContent   = "";
    if(pillText)pillText.textContent = "PROMO";
    swapImage("img/logo.png");
    animateInfo();
    return;
  }

  if(titleEl) titleEl.textContent = p.title;
  if(descEl)  descEl.textContent  = p.desc;
  if(priceEl) priceEl.textContent = p.mainPrice;
  if(oldEl)   oldEl.textContent   = p.oldPrice;

  if(pillText)pillText.textContent = "PROMO";
  swapImage(p.imgSrc);
  animateInfo();
}

function startRotation(){
  if(rotateTimer) clearInterval(rotateTimer);
  idx = 0;
  renderPromo(promos[0] || null);

  if(promos.length <= 1) return;

  rotateTimer = setInterval(() => {
    idx = (idx + 1) % promos.length;
    renderPromo(promos[idx]);
  }, ROTATE_MS);
}

async function refresh(){
  try{
    const rows = await fetchSheetRows();
    promos = buildPromos(rows);
    startRotation();
  } catch(err){
    console.error("Error leyendo Google Sheets", err);
    promos = [];
    startRotation(); // mostrará SIN PROMOS
  }
}

refresh();
setInterval(refresh, REFRESH_MS);
