/* ============================
   CONFIGURACIÓN
============================ */
const SHEET_ID = "1c4WYczs2NjwPz0f9aaSZShC-FaU3H9wnUm7FuYd9c6o";
const SHEET_NAME = "Sheet1";

/* 🔒 HTTPS FORZADO (clave para GitHub Pages) */
const SHEET_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${SHEET_NAME}`;

/* Intervalos */
const SLIDE_TIME = 12000;
const PROGRESS_INTERVAL = 60;

/* ============================
   DOM
============================ */
const titleEl = document.getElementById("promoTitle");
const descEl = document.getElementById("promoDesc");
const priceEl = document.getElementById("promoPrice");
const oldPriceEl = document.getElementById("oldPrice");

const imgA = document.getElementById("promoImgA");
const imgB = document.getElementById("promoImgB");

const progressBar = document.getElementById("progressBar");

const qrMenu = document.getElementById("qrMenu");
const qrWapp = document.getElementById("qrWapp");
const qrIg = document.getElementById("qrIg");

/* ============================
   QRs (ESTABLES)
============================ */
qrMenu.src =
  "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://adputcantina.com.ar/menu.html";

qrWapp.src =
  "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://wa.me/5493816836838";

qrIg.src =
  "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://instagram.com/adputcantina";

/* ============================
   ESTADO
============================ */
let promos = [];
let index = 0;
let activeImg = imgA;
let inactiveImg = imgB;

/* ============================
   FETCH SEGURO
============================ */
async function loadPromos() {
  try {
    const res = await fetch(SHEET_URL, {
      cache: "no-store",
      mode: "cors"
    });

    const text = await res.text();

    if (!text.includes("google.visualization.Query.setResponse")) {
      throw new Error("Respuesta inválida");
    }

    const json = JSON.parse(
      text
        .substring(text.indexOf("{"))
        .slice(0, -2)
    );

    const rows = json.table.rows;

    promos = rows
      .map(r => ({
        categoria: r.c[0]?.v,
        producto: r.c[2]?.v,
        precio: r.c[4]?.v,
        promo: r.c[7]?.v === "sí",
        precioPromo: r.c[8]?.v,
        imagen: r.c[9]?.v,
        tvActivo: r.c[11]?.v === "sí"
      }))
      .filter(p => p.promo && p.tvActivo && p.imagen);

    if (!promos.length) throw new Error("Sin promos activas");

    showPromo(0);
    setInterval(nextPromo, SLIDE_TIME);
    startProgress();

  } catch (err) {
    console.error("TV ERROR:", err);
    titleEl.textContent = "SIN PROMOS ACTIVAS";
    descEl.textContent = "";
    priceEl.textContent = "";
    oldPriceEl.textContent = "";
  }
}

/* ============================
   RENDER
============================ */
function showPromo(i) {
  const p = promos[i];

  titleEl.textContent = p.producto.toUpperCase();
  descEl.textContent = p.categoria || "";

  if (p.precioPromo) {
    priceEl.textContent = `$ ${p.precioPromo}`;
    oldPriceEl.textContent = `$ ${p.precio}`;
  } else {
    priceEl.textContent = `$ ${p.precio}`;
    oldPriceEl.textContent = "";
  }

  inactiveImg.src = `img/${p.imagen}`;
  inactiveImg.onload = () => {
    inactiveImg.classList.add("is-active");
    activeImg.classList.remove("is-active");
    [activeImg, inactiveImg] = [inactiveImg, activeImg];
  };
}

/* ============================
   ROTACIÓN
============================ */
function nextPromo() {
  index = (index + 1) % promos.length;
  showPromo(index);
}

/* ============================
   PROGRESS BAR
============================ */
function startProgress() {
  let w = 0;
  setInterval(() => {
    w += 100 / (SLIDE_TIME / PROGRESS_INTERVAL);
    progressBar.style.width = `${w}%`;
    if (w >= 100) w = 0;
  }, PROGRESS_INTERVAL);
}

/* ============================
   INIT
============================ */
loadPromos();
