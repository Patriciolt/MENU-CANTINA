// TV Promos - Cantina ADPUT (estable + debug)
// Generado: 2026-02-02T13:19:34

window.__TV_JS_LOADED__ = true;

(function(){
  const $ = (id)=>document.getElementById(id);

  const statusEl = $("status");
  function setStatus(msg, isError=false){
    if(!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.opacity = "1";
    statusEl.style.color = isError ? "#b00020" : "";
  }

  window.addEventListener("error", (e)=>{
    console.error("JS ERROR:", e.error || e.message);
    setStatus("❌ Error JS: " + (e.error?.message || e.message), true);
    const t = $("promoTitle");
    if(t) t.textContent = "ERROR";
  });
  window.addEventListener("unhandledrejection", (e)=>{
    console.error("PROMISE ERROR:", e.reason);
    setStatus("❌ Error: " + (e.reason?.message || e.reason), true);
    const t = $("promoTitle");
    if(t) t.textContent = "ERROR";
  });

  // Google Sheets
  const SHEET_ID = "1c4WYczs2NjwPz0f9aaSZShC-FaU3H9wnUm7FuYd9c6o";
  const SHEET_NAME = "Sheet1";
  const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}`;

  const SLIDE_TIME = 12000;

  // DOM
  const titleEl = $("promoTitle");
  const descEl = $("promoDesc");
  const priceEl = $("promoPrice");
  const oldPriceEl = $("oldPrice");

  const imgA = $("promoImgA");
  const imgB = $("promoImgB");

  const progressBar = $("progressBar");

  const qrMenu = $("qrMenu");
  const qrWapp = $("qrWapp");
  const qrIg = $("qrIg");

  function safeSetText(el, txt){ if(el) el.textContent = txt || ""; }

  // QRs
  function setQRs(){
    if(qrMenu) qrMenu.src = "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=https://adputcantina.com.ar/menu.html";
    if(qrWapp) qrWapp.src = "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=https://wa.me/5493816836838";
    if(qrIg)   qrIg.src   = "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=https://instagram.com/adputcantina";
  }
  setQRs();

  // Helpers
  const norm = (v)=>String(v ?? "").trim().toLowerCase();
  const isYes = (v)=>["si","sí","true","1","x","ok"].includes(norm(v));
  const isPromo = (v)=>{ const s=norm(v); return s!=="" && s!=="0" && s!=="no"; };
  const money = (v)=>{
    if(v===null || v===undefined) return "";
    const n = String(v).replace(/\./g,"").replace(",",".");
    const num = Number(n);
    if(!isFinite(num)) return "";
    return num.toLocaleString("es-AR");
  };

  function parseGViz(text){
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if(start<0 || end<0) throw new Error("Respuesta GViz inválida");
    const jsonText = text.substring(start, end+1);
    return JSON.parse(jsonText);
  }

  async function fetchWithTimeout(url, ms=15000){
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), ms);
    try{
      const res = await fetch(url, { method:"GET", cache:"no-store", mode:"cors", signal: ctrl.signal });
      return await res.text();
    } finally {
      clearTimeout(t);
    }
  }

  let promos = [];
  let idx = 0;
  let activeImg = imgA;
  let inactiveImg = imgB;
  let progressTimer = null;

  function startProgress(){
    if(!progressBar) return;
    if(progressTimer) clearInterval(progressTimer);
    let w = 0;
    progressBar.style.width = "0%";
    progressTimer = setInterval(()=>{
      w += 100 / (SLIDE_TIME/100);
      if(w>=100) w=0;
      progressBar.style.width = w.toFixed(2) + "%";
    }, 100);
  }

  function crossfadeTo(src){
    if(!activeImg || !inactiveImg) return;
    inactiveImg.onload = ()=>{
      inactiveImg.classList.add("is-active");
      activeImg.classList.remove("is-active");
      const tmp = activeImg;
      activeImg = inactiveImg;
      inactiveImg = tmp;
    };
    inactiveImg.onerror = ()=>{
      console.warn("No se pudo cargar imagen:", src);
      inactiveImg.src = "img/logo.png";
    };
    inactiveImg.src = src;
  }

  function render(p){
    safeSetText(titleEl, (p.title || "PROMO").toUpperCase());
    safeSetText(descEl, p.desc || "");
    safeSetText(priceEl, p.mainPrice ? "$ " + p.mainPrice : "");
    safeSetText(oldPriceEl, p.oldPrice ? "$ " + p.oldPrice : "");
    if(oldPriceEl) oldPriceEl.style.display = p.oldPrice ? "" : "none";
    crossfadeTo(p.imgSrc);
  }

  function next(){
    if(!promos.length) return;
    idx = (idx + 1) % promos.length;
    render(promos[idx]);
    startProgress();
  }

  function buildPromos(rows){
    const out = [];
    for(const row of rows){
      const c = row.c || [];
      const categoria = c[0]?.v ?? "";
      const producto  = c[2]?.v ?? "";
      const precio    = c[4]?.v ?? "";
      const promoVal  = c[7]?.v ?? "";
      const precioPromo = c[8]?.v ?? "";
      const imagen    = c[9]?.v ?? "";
      const tvActivo  = c[11]?.v ?? "sí";
      const tvTitulo  = c[14]?.v ?? "";
      const tvDesc    = c[15]?.v ?? "";
      const tvPrecioTxt = c[16]?.v ?? "";

      if(!String(producto||"").trim()) continue;
      if(!isYes(tvActivo)) continue;
      if(!isPromo(promoVal)) continue;

      const title = String(tvTitulo||"").trim() || String(producto).trim();
      const desc  = String(tvDesc||"").trim() || String(categoria).trim();
      const imgSrc = imagen ? "img/" + imagen : "img/logo.png";

      const base = money(precio);
      const promoM = money(precioPromo);
      let mainPrice = "";
      let oldPrice = "";

      if(String(tvPrecioTxt||"").trim()){
        mainPrice = String(tvPrecioTxt).trim();
        oldPrice = base;
      } else if(promoM){
        mainPrice = promoM;
        if(base && base !== promoM) oldPrice = base;
      } else {
        mainPrice = base;
      }

      out.push({ title, desc, imgSrc, mainPrice, oldPrice });
    }
    return out;
  }

  async function load(){
    setStatus("⏳ Leyendo Google Sheets…");
    try{
      const text = await fetchWithTimeout(SHEET_URL, 15000);
      // GViz viene envuelto; parseamos el JSON del medio
      const json = parseGViz(text);
      const rows = json.table?.rows || [];
      const built = buildPromos(rows);

      if(!built.length){
        throw new Error("No hay promos activas (revisá H Promo y L TV ACTIVO)");
      }

      promos = built;
      idx = 0;
      setStatus("✅ Promos cargadas: " + promos.length);
      render(promos[0]);
      startProgress();
      setInterval(next, SLIDE_TIME);
    } catch(err){
      console.error("LOAD ERROR:", err);
      setStatus("❌ No se pudieron cargar promos: " + (err.message || err), true);
      safeSetText(titleEl, "SIN PROMOS");
      safeSetText(descEl, "");
      safeSetText(priceEl, "");
      safeSetText(oldPriceEl, "");
    }
  }

  load();
})();
