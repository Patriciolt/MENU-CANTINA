/* =========================
   CONFIG
========================= */
const SHEET_ID = "1c4WYczs2NjwPz0f9aaSZShC-FaU3H9wnUm7FuYd9c6o";
const SHEET_NAME = "Sheet1";

const REFRESH_MS = 60_000;   // refresca datos
const ROTATE_MS  = 9_000;    // cambia promo
const SHUFFLE    = true;     // mezclar promos

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
   PROMOS ONLY + PRICE LOGIC
========================= */
function buildPromos(rows){
  // base: Activo = si, TV ACTIVO = si (o vacío)
  const valid = rows.filter(r => {
    const activo = isYes(r["Activo"]);
    const tvActivoCell = normalize(r["TV ACTIVO"]);
    const tvActivo = tvActivoCell === "" ? true : isYes(tvActivoCell);
    return activo && tvActivo && normalize(r["Producto"]);
  });

  // solo promos: Promo con algo (cualquier texto/número) O TV BLOQUE = PROMO
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

    // ✅ No usar "Promo" como descripción (así desaparece el "sí")
    const desc = normalize(r["TV DESCRIPCION"]) || normalize(r["Descripcion"]) || "";

    // Nota: si Promo tiene texto más largo (ej "3x2 hasta 22hs"), lo usamos como nota.
    const promoRaw = normalize(r["Promo"]);
    const promoNoteFromCol = (!isJustYesWord(promoRaw) && promoRaw.length >= 3) ? promoRaw : "";

    // Imagen: columna Imagen -> img/archivo
    const imgName = normalize(r["Imagen"]);
    const imgSrc = imgName ? `img/${imgName}` : "";

    // Precios:
    const precioBase = money(r["Precio"]);
    const precioPromo = money(r["Precio Promo"]);
    const tvPrecio = normalize(r["TV PRECIO TEXTO"]); // si querés texto tipo "2x1"

    let oldPrice = "";
    let mainPrice = "";

    if(tvPrecio){
      // Si usás TV PRECIO TEXTO, lo mostramos como principal.
      mainPrice = tvPrecio;
      // Si además hay precio base numérico, lo mostramos tachado (si existe)
      if(precioBase) oldPrice = precioBase;
    } else if(precioPromo){
      // Si hay precio promo, mostramos viejo tachado (si existe)
      mainPrice = precioPromo;
      if(precioBase && precioBase !== precioPromo) oldPrice = precioBase;
    } else {
      // Si no hay promo price, usamos precio base
      mainPrice = precioBase || "";
      oldPrice = "";
    }

    // Note final: TV TITULO > promo text > default
    const note = normalize(r["TV TITULO"]) || promoNoteFromCol || "PROMO DEL DÍA";

    return { nombre, desc, imgSrc, mainPrice, oldPrice, note };
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

  card.classList.remove("fade-in");
  card.classList.add("fade-out");

  setTimeout(() => {
    const hasPromo = !!p;

    $("promoTitle").textContent = hasPromo ? (p.nombre || "") : "SIN PROMOS";
    $("promoDesc").textContent = hasPromo ? (p.desc || " ") : "Hoy no hay promos cargadas.";
    $("promoPrice").textContent = hasPromo ? (p.mainPrice || "") : "";
    $("promoNote").textContent = hasPromo ? (p.note || "") : "";

    // Precio tachado
    const oldEl = $("oldPrice");
    oldEl.textContent = hasPromo ? (p.oldPrice || "") : "";
    oldEl.style.visibility = (hasPromo && p.oldPrice) ? "visible" : "hidden";

    // Imagen
    if(hasPromo && p.imgSrc){
      img.src = p.imgSrc;
      img.style.display = "block";
      img.onerror = () => {
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
      mainPrice: "",
      oldPrice: "",
      note: err?.message || ""
    });
  }
}

/* INIT */
setClock();
setInterval(setClock, 10_000);

loadPromos();
setInterval(loadPromos, REFRESH_MS);
