/* ======================
   CONFIG
====================== */
const SHEET_ID = "1c4WYczs2NjwPz0f9aaSZShC-FaU3H9wnUm7FuYd9c6o";
const SHEET_NAME = "Sheet1";

const REFRESH_MS = 60_000;
const ROTATE_MS  = 9_000;
const SHUFFLE    = true;

/* Links */
const MENU_URL      = "https://adputcantina.com.ar/menu.html";
const INSTAGRAM_URL = "https://www.instagram.com/adputcantina?igsh=dW5xYTZzZmxkMGg5";

/* WhatsApp (link directo) */
const WAPP_NUMBER_E164 = "5493816836838"; // +54 9 3816 83-6838
const WHATSAPP_URL = `https://wa.me/${WAPP_NUMBER_E164}`;

/* Clima: San Miguel de Tucumán */
const LAT = -26.8083;
const LON = -65.2176;
const WEATHER_REFRESH_MS = 15 * 60_000;

/* ======================
   HELPERS
====================== */
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
  if(/[a-zA-Z]/.test(t)) return t;
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
  return arr;
}

/* ✅ No mostrar porcentaje de descuento */
function calcOffPct(){ return null; }

/* ======================
   QR
====================== */
function setQR(el, url){
  // Google chart QR, simple y robusto
  const src = "https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=" + encodeURIComponent(url);
  el.src = src;
}

/* ======================
   SHEET FETCH
====================== */
async function fetchSheet(){
  // gviz JSONP
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&tq=${encodeURIComponent("select *")}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  // extraer JSON
  const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const data = JSON.parse(jsonText);

  const cols = data.table.cols.map(c => normalize(c.label));
  const rows = data.table.rows.map(r => r.c.map(c => (c ? c.v : "")));

  return { cols, rows };
}

function mapRows({cols, rows}){
  const idx = {};
  cols.forEach((c,i)=> idx[lower(c)] = i);

  const get = (row, name) => {
    const i = idx[lower(name)];
    return i === undefined ? "" : row[i];
  };

  const items = rows.map(row => ({
    categoria: normalize(get(row,"Categoria")),
    subcategoria: normalize(get(row,"Subcategoria")),
    producto: normalize(get(row,"Producto")),
    descripcion: normalize(get(row,"Descripcion")),
    precio: toNumber(get(row,"Precio"), NaN),
    activo: isYes(get(row,"Activo")),
    orden: toNumber(get(row,"Orden"), 999999),
    promo: normalize(get(row,"Promo")),
    precioPromo: toNumber(get(row,"Precio Promo"), NaN),
    imagen: normalize(get(row,"Imagen")),
    colorFondo: normalize(get(row,"ColorFondo")),
    tvActivo: isYes(get(row,"TV ACTIVO")),
    tvBloque: normalize(get(row,"TV BLOQUE")),
    tvOrden: toNumber(get(row,"TV ORDEN"), 999999),
    tvTitulo: normalize(get(row,"TV TITULO")),
    tvDescripcion: normalize(get(row,"TV DESCRIPCION")),
    tvPrecioTexto: normalize(get(row,"TV PRECIO TEXTO")),
  }));

  return items;
}

function filterPromos(items){
  // Regla promo: si Promo tiene texto o número => promo
  const promos = items.filter(it => it.activo && it.tvActivo && normalize(it.promo) !== "" );

  // ordenar
  promos.sort((a,b)=>{
    const ao = Number.isFinite(a.tvOrden) ? a.tvOrden : a.orden;
    const bo = Number.isFinite(b.tvOrden) ? b.tvOrden : b.orden;
    return ao - bo;
  });

  return promos;
}

/* ======================
   UI STATE
====================== */
const ui = {
  pillText: $("promoPillText"),
  offEl: $("offBadge"),

  imgA: $("promoImgA"),
  imgB: $("promoImgB"),
  activeA: true,

  title: $("promoTitle"),
  desc: $("promoDesc"),
  oldPrice: $("oldPrice"),
  newPrice: $("newPrice"),
  status: $("statusLine"),
  progress: $("progressBar"),
};

function setProgress(p){
  ui.progress.style.width = `${Math.max(0, Math.min(100, p))}%`;
}

/* Crossfade */
function swapImage(url){
  const next = ui.activeA ? ui.imgB : ui.imgA;
  const cur  = ui.activeA ? ui.imgA : ui.imgB;

  next.src = url;
  next.onload = () => {
    next.classList.add("is-active");
    cur.classList.remove("is-active");
    ui.activeA = !ui.activeA;
  };
  next.onerror = () => {
    // si falla, mantenemos la actual
  };
}

/* Render promo */
function renderPromo(p, total, index){
  ui.title.textContent = upper(p.tvTitulo || p.categoria || p.producto || "PROMO");
  ui.desc.textContent  = normalize(p.tvDescripcion || p.descripcion || "");

  // ✅ siempre PROMO, sin porcentaje
  ui.pillText.textContent = "PROMO";
  ui.offEl.textContent = "";
  ui.offEl.style.display = "none";

  // Imagen
  const img = p.imagen ? `/img/${p.imagen}` : "";
  if(img){
    swapImage(img);
  }

  // Precios
  const hasPromoPrice = Number.isFinite(p.precioPromo) && p.precioPromo > 0;
  const hasBasePrice  = Number.isFinite(p.precio) && p.precio > 0;

  if(hasBasePrice && hasPromoPrice){
    ui.oldPrice.style.display = "block";
    ui.oldPrice.textContent = money(p.precio);

    ui.newPrice.style.display = "inline-flex";
    ui.newPrice.textContent = money(p.precioPromo);
  } else if(hasPromoPrice && !hasBasePrice){
    ui.oldPrice.style.display = "none";
    ui.oldPrice.textContent = "";

    ui.newPrice.style.display = "inline-flex";
    ui.newPrice.textContent = money(p.precioPromo);
  } else if(hasBasePrice){
    ui.oldPrice.style.display = "none";
    ui.oldPrice.textContent = "";

    ui.newPrice.style.display = "inline-flex";
    ui.newPrice.textContent = money(p.precio);
  } else if(p.tvPrecioTexto){
    ui.oldPrice.style.display = "none";
    ui.oldPrice.textContent = "";

    ui.newPrice.style.display = "inline-flex";
    ui.newPrice.textContent = normalize(p.tvPrecioTexto);
  } else {
    ui.oldPrice.style.display = "none";
    ui.oldPrice.textContent = "";

    ui.newPrice.style.display = "none";
    ui.newPrice.textContent = "";
  }

  ui.status.textContent = `OK · ${total} promos`;
}

/* ======================
   WEATHER + CLOCK
====================== */
function setClock(){
  const now = new Date();
  const hh = now.getHours().toString().padStart(2,"0");
  const mm = now.getMinutes().toString().padStart(2,"0");
  $("timePill").textContent = `${hh}:${mm}`;

  const dias = ["dom","lun","mar","mié","jue","vie","sáb"];
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  $("datePill").textContent = `${dias[now.getDay()]}, ${now.getDate().toString().padStart(2,"0")} ${meses[now.getMonth()]}`;
}

async function fetchWeather(){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,precipitation_probability,weather_code&timezone=auto`;
    const res = await fetch(url, { cache: "no-store" });
    const j = await res.json();

    const t = Math.round(j.current.temperature_2m);
    const p = j.current.precipitation_probability;
    const code = j.current.weather_code;

    const emoji = (code >= 0 && code <= 3) ? "🌤️" :
                  (code >= 45 && code <= 48) ? "🌫️" :
                  (code >= 51 && code <= 67) ? "🌧️" :
                  (code >= 71 && code <= 77) ? "❄️" :
                  (code >= 80 && code <= 82) ? "🌦️" :
                  (code >= 95) ? "⛈️" : "☁️";

    $("weatherPill").textContent = `${emoji} ${t}° · Parcial nublado · Lluvia ${p}%`;
  }catch(e){
    // si falla, no rompemos
  }
}

/* ======================
   MAIN LOOP
====================== */
let promos = [];
let idx = 0;
let rotateTimer = null;
let progressTimer = null;

function startRotation(){
  clearInterval(rotateTimer);
  clearInterval(progressTimer);

  if(!promos.length){
    ui.title.textContent = "SIN PROMOS ACTIVAS";
    ui.desc.textContent  = "";
    ui.oldPrice.style.display = "none";
    ui.newPrice.style.display = "none";
    ui.status.textContent = "";
    return;
  }

  const total = promos.length;
  idx = 0;

  const tick = () => {
    const p = promos[idx % total];
    renderPromo(p, total, idx);
    idx++;
  };

  tick();

  // progreso
  let t0 = performance.now();
  progressTimer = setInterval(()=>{
    const elapsed = performance.now() - t0;
    const pct = (elapsed / ROTATE_MS) * 100;
    setProgress(pct);
    if(pct >= 100){
      t0 = performance.now();
      setProgress(0);
    }
  }, 90);

  rotateTimer = setInterval(()=>{
    setProgress(0);
    tick();
  }, ROTATE_MS);
}

async function refreshData(){
  try{
    ui.title.textContent = "CARGANDO PROMOS…";
    const raw = await fetchSheet();
    const items = mapRows(raw);
    promos = filterPromos(items);
    if(SHUFFLE) shuffleInPlace(promos);
    startRotation();
  }catch(e){
    ui.title.textContent = "ERROR CARGANDO PROMOS";
    ui.desc.textContent = "Revisá el Sheet o conexión.";
  }
}

function init(){
  // QRs
  setQR($("qrMenu"), MENU_URL);
  setQR($("qrWapp"), WHATSAPP_URL);
  setQR($("qrInst"), INSTAGRAM_URL);

  // Clock + weather
  setClock();
  setInterval(setClock, 10_000);

  fetchWeather();
  setInterval(fetchWeather, WEATHER_REFRESH_MS);

  // Data
  refreshData();
  setInterval(refreshData, REFRESH_MS);
}

window.addEventListener("load", init);
