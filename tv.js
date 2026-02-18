const sheetURL = "https://opensheet.elk.sh/1c4WVc2s2NjwPr0f9aaSZShC-FaU3H9wnUm7FuYd9c6o/Sheet1";

let productos = [];
let index = 0;

async function cargarDatos() {
  try {
    const res = await fetch(sheetURL);
    const data = await res.json();

    productos = data.filter(p => 
      p.tv_activo?.toLowerCase() === "sí"
    );

    mostrarProducto();
    setInterval(siguienteProducto, 10000);

  } catch (error) {
    console.error("Error cargando datos:", error);
  }
}

function mostrarProducto() {
  if (!productos.length) return;

  const p = productos[index];

  document.getElementById("tituloProducto").innerText = p.tv_titulo || "";
  document.getElementById("precioProducto").innerText = "$" + (p.tv_precio || "");
  document.getElementById("descripcionProducto").innerText = p.tv_descripcion || "";
  document.getElementById("imagenProducto").src = "img/" + p.imagen;
}

function siguienteProducto() {
  index = (index + 1) % productos.length;
  mostrarProducto();
}

/* HORA */
function actualizarHora() {
  const ahora = new Date();
  document.getElementById("hora").innerText =
    ahora.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' });
}
setInterval(actualizarHora, 1000);
actualizarHora();

/* FECHA */
function actualizarFecha() {
  const ahora = new Date();
  document.getElementById("fecha").innerText =
    ahora.toLocaleDateString("es-AR", { weekday: 'short', day: 'numeric', month: 'short' });
}
actualizarFecha();

/* CLIMA */
async function obtenerClima() {
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=-26.82&longitude=-65.22&current_weather=true"
    );
    const data = await res.json();

    const temp = data.current_weather.temperature;
    document.getElementById("clima").innerText = `${temp}°`;

  } catch {
    document.getElementById("clima").innerText = "--";
  }
}
obtenerClima();

cargarDatos();
