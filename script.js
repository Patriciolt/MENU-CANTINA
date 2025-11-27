// 1) PEGÁ ACÁ TU URL CSV DE GOOGLE SHEETS ENTRE COMILLAS
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQVLJlmIuXeGi6GMKw63DzQL97qzgtQoD-agtpEc-H_IoTPsxuEFLpjPVA-XoRbpx-G8_vKtXdy1dcl/pub?gid=0&single=true&output=csv";

// Cuando la página termine de cargar...
document.addEventListener("DOMContentLoaded", () => {
  const categoriasCont = document.getElementById("menu-categorias");
  if (!categoriasCont) return; // si estamos en index.html, no hace nada

  const btnPromos = document.getElementById("btn-promos");
  const popup = document.getElementById("popup-promos");
  const popupCerrar = document.getElementById("popup-cerrar");
  const popupDetalle = document.getElementById("popup-detalle");
  const bloquePromosResumen = document.querySelector(".bloque-promos-resumen");

  // Pedimos el CSV al Google Sheets
  fetch(CSV_URL)
    .then(res => res.text())
    .then(text => {
      const { categorias, promos } = procesarCSV(text);
      renderCategorias(categorias, categoriasCont);
      manejarPromos(promos, btnPromos, popup, popupDetalle, bloquePromosResumen);
    })
    .catch(err => {
      console.error("Error cargando menú:", err);
      categoriasCont.innerHTML = "<p>No se pudo cargar el menú. Intente más tarde.</p>";
    });

  // Cerrar popup
  if (popupCerrar && popup) {
    popupCerrar.addEventListener("click", () => {
      popup.style.display = "none";
    });
    popup.addEventListener("click", e => {
      if (e.target === popup) popup.style.display = "none";
    });
  }
});

// 2) Función para convertir el CSV en filas/columnas
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      // Doble comilla dentro de campo
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

// 3) Procesar texto CSV y agrupar por categoría
function procesarCSV(csvText) {
  const lineas = parseCSV(csvText);
  const encabezados = lineas[0].map(h => h.trim());

  const idxCat = encabezados.indexOf("Categoría");
  const idxSub = encabezados.indexOf("Subcategoría");
  const idxProd = encabezados.indexOf("Producto");
  const idxDesc = encabezados.indexOf("Descripción");
  const idxPrecio = encabezados.indexOf("Precio");
  const idxActivo = encabezados.indexOf("Activo");
  const idxOrden = encabezados.indexOf("Orden");
  const idxPromo = encabezados.indexOf("Promo");
  const idxPrecioPromo = encabezados.indexOf("Precio Promo");

  const categorias = {};
  const promos = [];

  for (let i = 1; i < lineas.length; i++) {
    const cols = lineas[i];
    if (!cols || cols.length === 0) continue;

    const activo = (cols[idxActivo] || "").trim().toLowerCase();
    if (activo !== "sí" && activo !== "si") continue;

    const categoria = (cols[idxCat] || "").trim() || "Otros";
    const subcategoria = (cols[idxSub] || "").trim();
    const producto = (cols[idxProd] || "").trim();
    const descripcion = (cols[idxDesc] || "").trim();
    const precio = (cols[idxPrecio] || "").trim();
    const orden = parseInt((cols[idxOrden] || "0").trim(), 10) || 0;
    const promo = (cols[idxPromo] || "").trim().toLowerCase();
    const precioPromo = (cols[idxPrecioPromo] || "").trim();

    const item = {
      categoria,
      subcategoria,
      producto,
      descripcion,
      precio,
      orden,
      promo: promo === "sí" || promo === "si",
      precioPromo
    };

    if (!categorias[categoria]) categorias[categoria] = [];
    categorias[categoria].push(item);

    if (item.promo) {
      promos.push(item);
    }
  }

  // Ordenamos por orden dentro de cada categoría
  Object.keys(categorias).forEach(cat => {
    categorias[cat].sort((a, b) => a.orden - b.orden);
  });

  return { categorias, promos };
}

// 4) Pintar categorías y productos en la página
function renderCategorias(categorias, contenedor) {
  const iconos = {
    "Entradas / Picadas": "🥟",
    "Sandwiches / Calientes": "🥪",
    "Pizzas": "🍕",
    "Ensaladas": "🥗",
    "Postres": "🍰",
    "Acompañamientos": "🍟",
    "Carnes": "🍖",
    "Sin Alcohol": "🥤",
    "Vinos": "🍷",
    "Cervezas": "🍺",
    "Aperitivos": "🍸",
    "Varios": "⭐"
  };

  contenedor.innerHTML = "";

  Object.keys(categorias).forEach(catNombre => {
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

    items.forEach(item => {
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
        const normalTachado = document.createElement("span");
        normalTachado.style.textDecoration = "line-through";
        normalTachado.style.marginRight = "0.3rem";
        normalTachado.textContent = item.precio ? `$${item.precio}` : "";

        const promoSpan = document.createElement("span");
        promoSpan.style.color = "#c00000";
        promoSpan.style.fontWeight = "bold";
        promoSpan.textContent = `$${item.precioPromo}`;

        precioSpan.appendChild(normalTachado);
        precioSpan.appendChild(promoSpan);
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

    // Comportamiento de accordion (abre/cierra)
    header.addEventListener("click", () => {
      const activa = contenido.classList.contains("activa");
      document.querySelectorAll(".categoria-contenido").forEach(c => {
        c.classList.remove("activa");
        c.style.maxHeight = null;
      });
      if (!activa) {
        contenido.classList.add("activa");
        contenido.style.maxHeight = contenido.scrollHeight + "px";
      }
    });

    catDiv.appendChild(header);
    catDiv.appendChild(contenido);
    contenedor.appendChild(catDiv);
  });
}

// 5) Manejo de promos (resumen + popup)
function manejarPromos(promos, btnPromos, popup, popupDetalle, bloquePromosResumen) {
  if (!promos || promos.length === 0) {
    if (btnPromos) btnPromos.style.display = "none";
    if (bloquePromosResumen) bloquePromosResumen.innerHTML = "";
    return;
  }

  const primera = promos[0];

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
    btnPromos.addEventListener("click", () => mostrarPopupPromo(primera, popup, popupDetalle));
  }

  // mostrar automaticamente al entrar
  setTimeout(() => {
    mostrarPopupPromo(primera, popup, popupDetalle);
  }, 800);
}

function mostrarPopupPromo(item, popup, popupDetalle) {
  if (!popup || !popupDetalle) return;
  popupDetalle.innerHTML = `
    <p><strong>${item.producto}</strong></p>
    ${item.descripcion ? `<p>${item.descripcion}</p>` : ""}
    ${
      item.precioPromo
        ? `<p><span style="text-decoration:line-through;margin-right:0.3rem;">${item.precio ? "$" + item.precio : ""}</span>
           <span style="color:#c00000;font-weight:bold;">$${item.precioPromo}</span></p>`
        : ""
    }
  `;
  popup.style.display = "flex";
}
