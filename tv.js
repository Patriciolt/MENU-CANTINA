/* =========================
   CONFIG
========================= */

// Tu Sheet ID (lo saco de la URL que se ve en tu captura)
const SHEET_ID = "1c4WYczs2NjwPz0f9aaSZShC-FaU3H9wnUm7FuYd9c6o";
const SHEET_NAME = "Sheet1";

// Cada cuánto refrescar datos desde Sheets (ms)
const REFRESH_MS = 60_000;

// Cada cuánto cambia de bloque en la TV (ms)
const ROTATE_MS = 10_000;

// Máx items por pantalla (TV)
const MAX_ITEMS = 6;

// Si querés forzar orden de categorías (si no, usa el “Orden/TV ORDEN”)
const CATEGORY_ORDER = []; // ej: ["PROMOS","EMPANADAS","SANDWICHS","BEBIDAS"]

/* =========================
   HELPERS
========================= */

const $ = (id) => document.getElementById(id);

function normalize(v){
  return (v ?? "").toString().trim();
}
function lower(v){
  return normalize(v).toLowerCase();
}
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
  // Si ya viene tipo "2x1" o "DESDE", lo devolvemos tal cual
  if(/[a-zA-ZxX]/.test(t)) return t;
  // número -> $ con separador simple
  const n = toNumber(t, NaN);
  if(Number.isFinite(n)) return "$ " + n.toLocaleString("es-AR");
  return t;
}

function setClock(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  $("clock").textContent = `${hh}:${mm}`;
}

async function fetchSheetRows(){
  // Google Visualization API (no requiere API key si el sheet está publicado/visible)
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?` +
              `tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  // La respuesta viene con "google.visualization.Query.setResponse(...);"
  const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const data = JSON.parse(jsonText);

  const cols = data.table.cols.map(c => c.label);
  const rows = data.table.rows;

  const out = rows.map(r => {
    const obj = {};
    r.c?.forEach((cell, i) => {
      const key = cols[i] || `COL_${i}`;
      obj[key] = cell?.v ?? "";
    });
    return obj;
  });

  return out;
}

/* =========================
   BUILD BLOCKS
========================= */

function buildBlocks(rows){
  // Filtrado: Activo (col F) + TV ACTIVO (col L)
  const valid = rows.filter(r => {
    const activo = isYes(r["Activo"]);
    const tvActivoCell = normalize(r["TV ACTIVO"]);
    const tvActivo = tvActivoCell === "" ? true : isYes(tvActivoCell); // vacío => mostrar
    return activo && tvActivo && normalize(r["Producto"]);
  });

  // Detectar promos
  const promos = valid.filter(r => {
    const promoCol = normalize(r["Promo"]);
    const tvBloque = upper(normalize(r["TV BLOQUE"]));
    return promoCol !== "" || tvBloque === "PROMO";
  });

  // Agrupar por categoría para menú normal
  const byCat = new Map();
  for(const r of valid){
    const cat = normalize(r["Categoria"]) || "OTROS";
    if(!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(r);
  }

  // Orden interno items
  for(const [cat, arr] of byCat){
    arr.sort((a,b) => {
      // primero TV ORDEN si existe, sino Orden
      const oa = toNumber(a["TV ORDEN"], toNumber(a["Orden"], 999999));
      const ob = toNumber(b["TV ORDEN"], toNumber(b["Orden"], 999999));
      return oa - ob;
    });
  }

  // Crear bloques
  const blocks = [];

  if(promos.length){
    promos.sort((a,b) => toNumber(a["TV ORDEN"], toNumber(a["Orden"], 999999)) - toNumber(b["TV ORDEN"], toNumber(b["Orden"], 999999)));
    blocks.push({
      kind: "PROMO",
      badge: "PROMOS",
      title: normalize(promos[0]["TV TITULO"]) || "PROMO DEL DÍA",
      items: promos.map(r => rowToItem(r, true))
    });
  }

  // Categorías (sin duplicar PROMOS)
  let cats = Array.from(byCat.keys());

  if(CATEGORY_ORDER.length){
    const order = CATEGORY_ORDER.map(c => c.toLowerCase());
    cats.sort((a,b) => {
      const ia = order.indexOf(a.toLowerCase());
      const ib = order.indexOf(b.toLowerCase());
      return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
    });
  } else {
    cats.sort((a,b) => a.localeCompare(b, "es"));
  }

  for(const cat of cats){
    const arr = byCat.get(cat);
    // si querés, podés excluir ciertas categorías de TV con TV BLOQUE, pero por ahora mostramos todo
    blocks.push({
      kind: "MENU",
      badge: "MENÚ",
      title: cat,
      items: arr.map(r => rowToItem(r, false))
    });
  }

  // Paginar bloques con muchos items
  const paged = [];
  for(const b of blocks){
    if(b.items.length <= MAX_ITEMS){
      paged.push(b);
    } else {
      let page = 1;
      for(let i=0; i<b.items.length; i += MAX_ITEMS){
        const slice = b.items.slice(i, i + MAX_ITEMS);
        paged.push({
          ...b,
          title: b.title,
          badge: b.badge + ` ${page}`,
          items: slice
        });
        page++;
      }
    }
  }

  return paged;
}

function upper(s){ return normalize(s).toUpperCase(); }

function rowToItem(r, isPromo){
  const nombre = normalize(r["Producto"]);
  const desc = normalize(r["Descripcion"]) || normalize(r["TV DESCRIPCION"]);

  // Precio: TV PRECIO TEXTO > Precio Promo (si es promo) > Precio
  let priceText = normalize(r["TV PRECIO TEXTO"]);
  if(!priceText){
    if(isPromo){
      const pp = normalize(r["Precio Promo"]);
      priceText = pp ? money(pp) : money(r["Precio"]);
    } else {
      priceText = money(r["Precio"]);
    }
  }

  const tag = isPromo ? "PROMO" : "";
  return { nombre, desc, priceText, tag, isPromo };
}

/* =========================
   RENDER + ROTATION
========================= */

let blocks = [];
let idx = 0;
let rotateTimer = null;
let refreshTimer = null;

function renderBlock(block){
  const itemsEl = $("items");
  const badgeEl = $("blockBadge");
  const titleEl = $("blockTitle");

  // Badge estilo promo
  if(block.kind === "PROMO"){
    badgeEl.style.background = "linear-gradient(90deg, var(--rojo), rgba(195,56,47,.78))";
  } else {
    badgeEl.style.background = "linear-gradient(90deg, var(--azul), rgba(31,63,94,.78))";
  }

  badgeEl.textContent = block.badge;
  titleEl.textContent = block.title;

  // Animación suave
  itemsEl.classList.remove("fade-in");
  itemsEl.classList.add("fade-out");

  setTimeout(() => {
    itemsEl.innerHTML = "";
    for(const it of block.items){
      const row = document.createElement("div");
      row.className = "item" + (it.isPromo ? " promo" : "");

      const left = document.createElement("div");
      left.className = "item-left";

      const name = document.createElement("div");
      name.className = "item-name";
      name.textContent = it.nombre;

      const desc = document.createElement("div");
      desc.className = "item-desc";
      desc.textContent = it.desc || " ";

      left.appendChild(name);
      left.appendChild(desc);

      const right = document.createElement("div");
      if(it.tag){
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = it.tag;
        right.appendChild(tag);
      }

      const price = document.createElement("div");
      price.className = "price";
      price.textContent = it.priceText || "";
      right.appendChild(price);

      row.appendChild(left);
      row.appendChild(right);
      itemsEl.appendChild(row);
    }

    itemsEl.classList.remove("fade-out");
    itemsEl.classList.add("fade-in");
  }, 260);
}

function startRotation(){
  if(rotateTimer) clearInterval(rotateTimer);
  if(!blocks.length) return;

  renderBlock(blocks[idx]);

  rotateTimer = setInterval(() => {
    idx = (idx + 1) % blocks.length;
    renderBlock(blocks[idx]);
  }, ROTATE_MS);
}

async function loadAndBuild(){
  try{
    $("status").textContent = "Actualizando datos…";
    const rows = await fetchSheetRows();
    blocks = buildBlocks(rows);
    idx = 0;

    if(!blocks.length){
      $("blockBadge").textContent = "SIN DATOS";
      $("blockTitle").textContent = "Revisá Activo / TV ACTIVO";
      $("items").innerHTML = "<div style='padding:18px;font-size:22px;opacity:.8'>No hay productos visibles para TV.</div>";
      $("status").textContent = "Sin productos en TV";
      return;
    }

    $("status").textContent = `OK · ${blocks.length} pantallas`;
    startRotation();
  } catch(err){
    console.error(err);
    $("status").textContent = "Error leyendo Google Sheets";
    $("blockBadge").textContent = "ERROR";
    $("blockTitle").textContent = "No se pudo leer el Sheet";
    $("items").innerHTML = "<div style='padding:18px;font-size:22px;opacity:.8'>Asegurate de que el Sheet esté publicado / accesible.</div>";
  }
}

/* =========================
   INIT
========================= */
setClock();
setInterval(setClock, 10_000);

loadAndBuild();
refreshTimer = setInterval(loadAndBuild, REFRESH_MS);
