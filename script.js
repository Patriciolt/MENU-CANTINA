/* ------------------------------------------------------------------
   CONFIGURACIÓN – URL de Google Sheets
-------------------------------------------------------------------*/
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQVLJlmIuXeGi6GMKw63DzQL97qzgtQoD-agtpEc-H_IoTPsxuEFLpjPVA-XoRbpx-G8_vKtXdy1dcl/pub?gid=0&single=true&output=csv";

/* ------------------------------------------------------------------
   MAPA DE IMÁGENES PARA PROMOS (fallback opcional)
-------------------------------------------------------------------*/
const IMAGENES_PROMO = {
  "2 quilmes 1lt": "img/QUILMES 1LTPNG.png",
};


/* ------------------------------------------------------------------
   INICIO
-------------------------------------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
  const contenedorPromosPagina = document.getElementById("lista-promos");
  const categoriasCont = document.getElementById("menu-categorias");
  const btnPromos = document.getElementById("btn-promos");
  const popup = document.getElementById("popup-promos");
  const popupCerrar = document.getElementById("popup-cerrar");
  const popupDetalle = document.getElementById("popup-detalle");
  const bloquePromosResumen = document.querySelector(".bloque-promos-resumen");

  // Si estamos en la página de PROMOS (promos.html)
  if (contenedorPromosPagina) {
    fetch(CSV_URL)
      .then((res) => res.text())
      .then((texto) => {
        const { promos } = procesarCSV(texto);
        renderPromosPagina(promos, contenedorPromosPagina);
      })
      .catch((err) => {
        console.error("Error cargando promociones:", err);
        contenedorPromosPagina.innerHTML =
          "<p>No se pudieron cargar las promociones.</p>";
      });
    return;
  }

  // Si estamos en index → no carga menú
  if (!categoriasCont) return;

  // Si estamos en menú.html → cargar categorías y promos
  fetch(CSV_URL)
    .then((res) => res.text())
    .then((texto) => {
      const { categorias, promos } = procesarCSV(texto);
      renderCategorias(categorias, categoriasCont);
      manejarPromos(promos, btnPromos, popup, popupDetalle, bloquePromosResumen);
    })
    .catch((err) => {
      console.error("Error cargando menú:", err);
      categoriasCont.innerHTML =
        "<p>No se pudo cargar el menú. Intente más tarde.</p>";
    });

  // Cerrar popup
  if (popupCerrar && popup) {
    popupCerrar.addEventListener("click", () => cerrarPopup(popup));
    popup.addEventListener("click", (e) => {
      if (e.target === popup) cerrarPopup(popup);
    });
  }
});

function cerrarPopup(popup) {
  popup.style.opacity = 0;
  setTimeout(() => (popup.style.display = "none"), 250);
}


/* ------------------------------------------------------------------
   CSV → MATRIZ
-------------------------------------------------------------------*/
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentField += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (currentField !== "" || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      }
    } else {
      currentField += char;
    }
  }

  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}


/* ------------------------------------------------------------------
   PROCESAR CSV → categorías + promos
-------------------------------------------------------------------*/
function procesarCSV(csvText) {
  const lineas = parseCSV(csvText);
  if (!lineas.length) return { categorias: {}, promos: [] };

  const encabezados = lineas[0].map((h) => h.trim());

  const idxCat = encabezados.indexOf("Categoría");
  const idxSub = encabezados.indexOf("Subcategoría");
  const idxProd = encabezados.indexOf("Producto");
  const idxDesc = encabezados.indexOf("Descripción");
  const idxPrecio = encabezados.indexOf("Precio");
  const idxActivo = encabezados.indexOf("Activo");
  const idxOrden = encabezados.indexOf("Orden");
  const idxPromo = encabezados.indexOf("Promo");
  const idxPrecioPromo = encabezados.indexOf("Precio Promo");
  const idxImagen = encabezados.indexOf("Imagen");
  const idxColorFondo = encabezados.indexOf("ColorFondo");

  const categorias = {};
  const promos = [];

  for (let i = 1; i < lineas.length; i++) {
    const cols = lineas[i];
    if (!cols || cols.length === 0) continue;

    const activo = (cols[idxActivo] || "").trim().toLowerCase();
    if (activo !== "sí" && activo !== "si") continue;

    const promoValor = (cols[idxPromo] || "").trim();

    const item = {
      categoria: (cols[idxCat] || "").trim(),
      subcategoria: (cols[idxSub] || "").trim(),
      producto: (cols[idxProd] || "").trim(),
      descripcion: (cols[idxDesc] || "").trim(),
      precio: (cols[idxPrecio] || "").trim(),
      orden: parseInt((cols[idxOrden] || "0").trim(), 10) || 0,

      // 🔥🔥🔥 Aquí está la corrección pedida
      promo: promoValor !== "",

      precioPromo: (cols[idxPrecioPromo] || "").trim(),
      imagen: idxImagen >= 0 ? (cols[idxImagen] || "").trim() : "",
      colorFondo: idxColorFondo >= 0 ? (cols[idxColorFondo] || "").trim().toLowerCase() : "",
    };

    if (!categorias[item.categoria]) categorias[item.categoria] = [];
    categorias[item.categoria].push(item);

    if (item.promo) promos.push(item);
  }

  Object.keys(categorias).forEach((c) =>
    categorias[c].sort((a, b) => a.orden - b.orden)
  );

  return { categorias, promos };
}


/* ------------------------------------------------------------------
   RENDER CATEGORÍAS
-------------------------------------------------------------------*/
function renderCategorias(categorias, contenedor) {
  const iconos = {
    "Entradas / Picadas": "🥟",
    "Sandwiches / Calientes": "🥪",
    Pizzas: "🍕",
    Ensaladas: "🥗",
    Postres: "🍰",
    Acompañamientos: "🍟",
    Carnes: "🍖",
    "Sin Alcohol": "🥤",
    Vinos: "🍷",
    Cervezas: "🍺",
    Aperitivos: "🍸",
    Varios: "⭐",
  };

  contenedor.innerHTML = "";

  Object.keys(categorias).forEach((catNombre) => {
    const items = categorias[catNombre];

    const catDiv = document.createElement("article");
    catDiv.className = "categoria";

    const header = document.createElement("div");
    header.className = "categoria-header";

    const titulo = document.createElement("strong");
    titulo.textContent = catNombre;

    const toggle = document.createElement("span");
    toggle.className = "categoria-toggle";
    toggle.textContent = "▾";

    const iconoSpan = document.createElement("span");
    iconoSpan.textContent = iconos[catNombre] || "•";
    iconoSpan.style.marginRight = "0.5rem";

    header.appendChild(iconoSpan);
    header.appendChild(titulo);
    header.appendChild(toggle);

    const contenido = document.createElement("div");
    contenido.className = "categoria-contenido";

    items.forEach((item) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "item-producto";

      const linea = document.createElement("div");
      linea.className = "item-linea";

      const nombreSpan = document.createElement("span");
      nombreSpan.className = "item-nombre";
      nombreSpan.textContent = item.producto;

      const precioSpan = document.createElement("span");
      precioSpan.className = "item-precios";

      if (item.promo && item.precioPromo) {
        precioSpan.innerHTML = `
          <span style="text-decoration:line-through;margin-right:0.3rem;">$${item.precio}</span>
          <span style="color:#c00000;font-weight:bold;">$${item.precioPromo}</span>
        `;
      } else {
        precioSpan.textContent = item.precio ? `$${item.precio}` : "";
      }

      linea.appendChild(nombreSpan);
      linea.appendChild(precioSpan);
      itemDiv.appendChild(linea);

      if (item.descripcion) {
        const descP = document.createElement("p");
        descP.className = "item-descripcion";
        descP.textContent = item.descripcion;
        itemDiv.appendChild(descP);
      }

      contenido.appendChild(itemDiv);
    });

    header.addEventListener("click", () => {
      const abierto = contenido.classList.contains("activa");

      document.querySelectorAll(".categoria-contenido").forEach((c) => {
        c.classList.remove("activa");
        c.style.maxHeight = null;
      });

      if (!abierto) {
        contenido.classList.add("activa");
        contenido.style.maxHeight = contenido.scrollHeight + "px";
      }
    });

    catDiv.appendChild(header);
    catDiv.appendChild(contenido);
    contenedor.appendChild(catDiv);
  });
}


/* ------------------------------------------------------------------
   PROMOS – Página completa
-------------------------------------------------------------------*/
function renderPromosPagina(promos, contenedor) {
  contenedor.innerHTML = "";

  if (!promos || promos.length === 0) {
    contenedor.innerHTML = "<p>En este momento no hay promociones activas.</p>";
    return;
  }

  promos.forEach((p) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "promo-tarjeta";

    const imgURL = p.imagen ? `img/${p.imagen}` : IMAGENES_PROMO[p.producto.trim().toLowerCase()];

    tarjeta.innerHTML = `
      ${imgURL ? `<img src="${imgURL}" alt="Promo">` : ""}
      <h3>${p.producto}</h3>
      ${p.descripcion ? `<p>${p.descripcion}</p>` : ""}
      <p>
        ${p.precio ? `<span class="precio-tachado">$${p.precio}</span>` : ""}
        ${p.precioPromo ? `<span class="promo-precio">$${p.precioPromo}</span>` : ""}
      </p>
    `;

    contenedor.appendChild(tarjeta);
  });
}


/* ------------------------------------------------------------------
   MANEJO GENERAL DE PROMOS
-------------------------------------------------------------------*/
function manejarPromos(
  promos,
  btnPromos,
  popup,
  popupDetalle,
  bloquePromosResumen
) {
  if (!promos || promos.length === 0) {
    if (btnPromos) btnPromos.style.display = "none";
    if (bloquePromosResumen) bloquePromosResumen.innerHTML = "";
    return;
  }

  const primera = promos[0];
  const imgPromo = primera.imagen ? `img/${primera.imagen}` : "";

  if (bloquePromosResumen) {
    bloquePromosResumen.innerHTML = `
      <div class="tarjeta-promo-mini">
        <strong>Promo activa:</strong> ${primera.producto}
        ${primera.precioPromo ? " - $" + primera.precioPromo : ""}
      </div>
    `;
  }

  if (btnPromos) {
    btnPromos.style.display = "block";
    btnPromos.addEventListener("click", () =>
      mostrarPopupPromo(primera, imgPromo, popup, popupDetalle)
    );
  }

  setTimeout(() => {
    mostrarPopupPromo(primera, imgPromo, popup, popupDetalle);
  }, 700);
}


/* ------------------------------------------------------------------
   POPUP DE PROMOS – CON FONDO MORADO
-------------------------------------------------------------------*/
function mostrarPopupPromo(item, imgPromo, popup, popupDetalle) {
  if (!popup || !popupDetalle) return;

  let claseFondo = "";

  if (item.colorFondo === "morado") {
    claseFondo = "promo-fondo-morado";
  }

  popupDetalle.innerHTML = `
    <div class="promo-popup-contenedor ${claseFondo}">
      ${imgPromo ? `<img src="${imgPromo}" class="promo-popup-img" alt="Promo">` : ""}
      <h3>${item.producto}</h3>
      ${item.descripcion ? `<p>${item.descripcion}</p>` : ""}
      ${
        item.precioPromo
          ? `<p>
               <span style="text-decoration:line-through;margin-right:0.3rem;">$${item.precio}</span>
               <span style="color:#c00000;font-weight:bold;">$${item.precioPromo}</span>
             </p>`
          : ""
      }
    </div>
  `;

  popup.style.display = "flex";
  popup.style.opacity = 1;
}
