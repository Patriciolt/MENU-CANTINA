/* =========================
   CONFIG
========================= */
const SHEET_ID = "1c4WYczs2NjwPz0f9aaSZShC-FaU3H9wnUm7FuYd9c6o";
const SHEET_NAME = "Sheet1";

const REFRESH_MS = 60_000;   // refresca datos
const ROTATE_MS  = 9_000;    // cambia promo
const SHUFFLE    = true;     // mezclar promos para que no sea siempre igual

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
function toNumber(v, fallback = 999999){
  const t = normalize(v).replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : fallback;
}
function money(v){
  const t = normalize(v);
  if(!t) return "";
  if(/[a-zA-ZxX]/.test(t)) return t; // "2x1", "DESDE", etc
  const n = toNumber(t, NaN);
  if(Number.isFinite(n)) return "$ " + n.toLocaleString("es-AR");
  return t;
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
   PROMOS ONLY
========================= */
function buildPromos(rows){
  // Filtrado base: Activo = si, TV ACTIVO = si (o vacío)
  const valid = rows.filter(r => {
    const activo = isYes(r["Activo"]);
    const tvActivoCell = normalize(r["TV ACTIVO"]);
    const tvActivo = tvActivoCell === "" ? true : isYes(tvActivoCell);
    return activo && tvActivo && normalize(r["Producto"]);
  });

  // Solo promos: columna "Promo" con algo O TV BLOQUE = PROMO
  const promos = valid.filter(r => {
    const promoCol = normalize(r["Promo"]);
    const tvBloque = upper(r["TV BLOQUE"]);
    return promoCol !== "" || tvBloque === "PROMO";
  });

  // Orden: TV ORDEN -> Orden
  promos.sort((a,b) => {
    const oa = toNumber(a["TV ORDEN"], toNumber(a["Orden"], 999999));
    const ob = toNumber(b["TV ORDEN"], toNumber(b["Orden"], 999999));
    return oa - ob;
  });

  const out = promos.map(r => {
    const nombre = normalize(r["Producto"]);
    const desc = normalize(r["TV DESCRIPCION"]) || normalize(r["Descripcion"]) || normalize(r["Promo"]);
    const imgName = normalize(r["Imagen"]);
    const imgSrc = imgName ? `img/${imgName}` : "";

    // Precio promo si existe; si no, Precio; si no, TV PRECIO TEXTO
    const tvPrecio = normalize(r["TV PRECIO TEXTO"]);
    const precioPromo = normalize(r["Precio Promo"]);
    const precio = normalize(r["Precio"]);

    let priceText = "";
    if(tvPrecio) priceText = tvPrecio;
    else if(precioPromo) priceText = money(precioPromo);
    else priceText = money(precio);

    // Nota: sirve para “hasta 22hs”, “3x2”, etc.
    const note = normalize(r["TV TITULO"]) || "PROMO DEL DÍA";

    return { nombre, desc, imgSrc, priceText, note };
  });

  if(SHUFFLE) shuffleInPlace(out);
  return out;
}

/* =========================
   RENDER
========================= */
let promos = [];
let idx = 0;
let rotateTimer = null;

function renderPromo(p){
  const card = $("promoCard");
  const img = $("promoImg");

  // animación salida
  card.classList.remove("fade-in");
  card.classList.add("fade-out");

  setTimeout(() => {
    $("promoTitle").textContent = p?.nombre || "SIN PROMOS";
    $("promoDesc").textContent = p?.desc || "Hoy no hay promos cargadas.";
    $("promoPrice").textContent = p?.priceText || "";
    $("promoNote").textContent = p?.note || "";

    if(p?.imgSrc){
      img.src = p.imgSrc;
      img.style.display = "block";
      img.onerror = () => {
        // si falta la imagen, no rompe el diseño
        img.removeAttribute("src");
        img.style.display = "none";
      };
    } else {
      img.removeAttribute("src");
      img.style.display = "none";
    }

    card.classList.remove("fade-out");
    card.classList.add("fade-in");
  }, 280);
}

function startRotation(){
  if(rotateTimer) clearInterval(rotateTimer);
  if(!promos.length){
    renderPromo(null);
    return;
  }

  renderPromo(promos[idx]);

  rotateTimer = setInterval(() => {
    idx = (idx + 1) % promos.length;
    renderPromo(promos[idx]);
  }, ROTATE_MS);
}

async function loadPromos(){
  try{
    $("status").textContent = "Actualizando datos…";
    const rows = await fetchSheetRows();
    promos = buildPromos(rows);
    idx = 0;

    $("status").textContent = promos.length ? `OK · ${promos.length} promos` : "Sin promos";
    startRotation();
  } catch(err){
    console.error(err);
    $("status").textContent = "Error leyendo Google Sheets";
    renderPromo({
      nombre: "NO SE PUDO LEER EL SHEET",
      desc: "Asegurate de que el Sheet esté publicado o accesible (Compartir: Cualquiera con enlace / Lector).",
      imgSrc: "",
      priceText: "",
      note: err?.message || ""
    });
  }
}

/* INIT */
setClock();
setInterval(setClock, 10_000);

loadPromos();
setInterval(loadPromos, REFRESH_MS);
