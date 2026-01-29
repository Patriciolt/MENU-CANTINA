/* =========================
   CONFIG
========================= */
const SHEET_ID = "1c4WYczs2NjwPz0f9aaSZShC-FaU3H9wnUm7FuYd9c6o";
const SHEET_NAME = "Sheet1";

const REFRESH_MS = 60_000;
const ROTATE_MS = 10_000;
const MAX_ITEMS = 6;

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
  if(/[a-zA-ZxX]/.test(t)) return t;
  const n = toNumber(t, NaN);
  if(Number.isFinite(n)) return "$ " + n.toLocaleString("es-AR");
  return t;
}
function setClock(){
  const d = new Date();
  $("clock").textContent = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

/* =========================
   SHEETS FETCH (GVIZ JSON)
========================= */
async function fetchSheetRows(){
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url, { cache: "no-store" });

  if(!res.ok){
    throw new Error(`HTTP ${res.status} al leer Google Sheets`);
  }

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
   BUILD BLOCKS
========================= */
function buildBlocks(rows){
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

  const byCat = new Map();
  for(const r of valid){
    const cat = normalize(r["Categoria"]) || "OTROS";
    if(!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(r);
  }

  for(const [cat, arr] of byCat){
    arr.sort((a,b) => {
      const oa = toNumber(a["TV ORDEN"], toNumber(a["Orden"], 999999));
      const ob = toNumber(b["TV ORDEN"], toNumber(b["Orden"], 999999));
      return oa - ob;
    });
  }

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

  const cats = Array.from(byCat.keys()).sort((a,b) => a.localeCompare(b, "es"));
  for(const cat of cats){
    blocks.push({
      kind: "MENU",
      badge: "MENÚ",
      title: cat,
      items: byCat.get(cat).map(r => rowToItem(r, false))
    });
  }

  // Paginar si una categoría tiene muchos items
  const paged = [];
  for(const b of blocks){
    if(b.items.length <= MAX_ITEMS){
      paged.push(b);
    } else {
      let page = 1;
      for(let i=0; i<b.items.length; i += MAX_ITEMS){
        paged.push({
          ...b,
          badge: b.kind === "PROMO" ? "PROMOS" : `MENÚ ${page}`,
          items: b.items.slice(i, i + MAX_ITEMS)
        });
        page++;
      }
    }
  }

  return paged;
}

function rowToItem(r, isPromo){
  const nombre = normalize(r["Producto"]);
  const desc = normalize(r["Descripcion"]) || normalize(r["TV DESCRIPCION"]);

  // Imagen: tu columna Imagen (ej: "empanada.jpg") => img/empanada.jpg
  const imgName = normalize(r["Imagen"]);
  const imgSrc = imgName ? `img/${imgName}` : "";

  // Precio: TV PRECIO TEXTO > Precio Promo (si promo) > Precio
  let priceText = normalize(r["TV PRECIO TEXTO"]);
  if(!priceText){
    if(isPromo){
      const pp = normalize(r["Precio Promo"]);
      priceText = pp ? money(pp) : money(r["Precio"]);
    } else {
      priceText = money(r["Precio"]);
    }
  }

  return { nombre, desc, priceText, isPromo, imgSrc };
}

/* =========================
   RENDER + ROTATION
========================= */
let blocks = [];
let idx = 0;
let rotateTimer = null;

function renderBlock(block){
  const itemsEl = $("items");
  const badgeEl = $("blockBadge");
  const titleEl = $("blockTitle");

  badgeEl.style.background = block.kind === "PROMO"
    ? "linear-gradient(90deg, var(--rojo), rgba(195,56,47,.78))"
    : "linear-gradient(90deg, var(--azul), rgba(31,63,94,.78))";

  badgeEl.textContent = block.badge;
  titleEl.textContent = block.title;

  itemsEl.classList.remove("fade-in");
  itemsEl.classList.add("fade-out");

  setTimeout(() => {
    itemsEl.innerHTML = "";

    for(const it of block.items){
      const row = document.createElement("div");
      row.className = "item" + (it.isPromo ? " promo" : "");

      const imgBox = document.createElement("div");
      imgBox.className = "item-img";
      if(it.imgSrc){
        const img = document.createElement("img");
        img.src = it.imgSrc;
        img.alt = it.nombre;
        img.loading = "eager";
        img.onerror = () => { imgBox.innerHTML = " "; }; // si falta el archivo, no rompe
        imgBox.appendChild(img);
      } else {
        imgBox.innerHTML = " ";
      }

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
      right.className = "right";

      if(it.isPromo){
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = "PROMO";
        right.appendChild(tag);
      }

      const price = document.createElement("div");
      price.className = "price";
      price.textContent = it.priceText || "";
      right.appendChild(price);

      row.appendChild(imgBox);
      row.appendChild(left);
      row.appendChild(right);

      itemsEl.appendChild(row);
    }

    itemsEl.classList.remove("fade-out");
    itemsEl.classList.add("fade-in");
  }, 240);
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
    $("blockTitle").textContent = "NO SE PUDO LEER EL SHEET";
    $("items").innerHTML =
      "<div style='padding:18px;font-size:22px;opacity:.85;line-height:1.4'>" +
      "1) Abrí el Google Sheet<br/>" +
      "2) Compartir → <b>Cualquier persona con el enlace</b> → <b>Lector</b><br/>" +
      "o Archivo → <b>Publicar en la web</b><br/><br/>" +
      "<span style='opacity:.75'>Detalle:</span> " + (err?.message || "sin detalle") +
      "</div>";
  }
}

/* INIT */
setClock();
setInterval(setClock, 10_000);

loadAndBuild();
setInterval(loadAndBuild, 60_000);
