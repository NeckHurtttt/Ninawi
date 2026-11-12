/* BRASA · calendario de quemas armonizado MODIS + VIIRS */
'use strict';

const $ = (s) => document.querySelector(s);
const LANG = new URLSearchParams(location.search).get('lang') || (navigator.language.startsWith('es') ? 'es' : 'en');
const T = (es, en) => (LANG === 'en' ? en : es);
const LOC = T('es-BO', 'en-US');
const MESES = T(['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
const fmt = (n) => Math.round(n).toLocaleString(LOC);
const dec = (n, k = 1) => n.toLocaleString(LOC, { minimumFractionDigits: k, maximumFractionDigits: k });
const TODA = 'Toda Bolivia';
const nombreZona = (n) => (n === TODA ? T(TODA, 'All Bolivia') : n);
const HOY = new Date();

let D;             // datos
let NA, NS, A0, S0; // años, semanas, primer año, índice del primer año de solape
let sel = { nombre: TODA, celdas: null }; // celdas: Set de índices o null = todas
let anioSel = 2024, modo = 'h';
let serie;         // agregados de la zona elegida
let U7 = null;      // focos de los últimos 7 días (si existen)
let mapa, capaCeldas, capaSel, capaDeps, dibujando = null, rectDibujo = null;

/* ---------- utilidades de fechas ---------- */
function fechaDeDia(d) { const f = new Date(Date.UTC(2025, 0, 1)); f.setUTCDate(f.getUTCDate() + d); return f; }
function txtFecha(f) { return LANG === 'en' ? `${MESES[f.getUTCMonth()]} ${f.getUTCDate()}` : `${f.getUTCDate()} ${MESES[f.getUTCMonth()]}`; }
function txtFechaIso(iso) { const [y, m, d] = iso.split('-').map(Number); return txtFecha(new Date(Date.UTC(y, m - 1, d))); }
function rangoSemana(w) {
  const ini = fechaDeDia(w * 7), fin = fechaDeDia(w === NS - 1 ? 364 : w * 7 + 6);
  return `${txtFecha(ini)} – ${txtFecha(fin)}`;
}
function semanaDe(fecha) {
  const ini = Date.UTC(fecha.getFullYear(), 0, 1);
  const dia = Math.floor((Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) - ini) / 864e5);
  return Math.min(Math.floor(dia / 7), NS - 1);
}

/* ---------- estadística ---------- */
function cuantil(arr, q) {
  const a = [...arr].sort((x, y) => x - y); const p = (a.length - 1) * q;
  const i = Math.floor(p), r = p - i; return a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * r;
}
const suma = (a) => a.reduce((s, x) => s + x, 0);
function regresion(xs, ys) {
  const n = xs.length, mx = suma(xs) / n, my = suma(ys) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return sxy / sxx;
}

/* ---------- color ---------- */
const RAMPA = [[20, 17, 15], [90, 20, 18], [190, 40, 30], [255, 106, 31], [255, 194, 61], [255, 246, 200]];
function color(t) {
  t = Math.max(0, Math.min(1, t)); const p = t * (RAMPA.length - 1); const i = Math.min(Math.floor(p), RAMPA.length - 2); const r = p - i;
  const c = RAMPA[i].map((v, k) => Math.round(v + (RAMPA[i + 1][k] - v) * r)); return `rgb(${c})`;
}
const escalaLog = (max) => (v) => (v <= 0 ? 0 : Math.min(1, Math.sqrt(v / max)));
const tope = (vals) => { const nz = [...vals].filter((v) => v > 0); return nz.length ? Math.max(1, cuantil(nz, 0.98)) : 1; };

/* ---------- agregación ---------- */
function agregar(celdas) {
  const M = new Float64Array(NA * NS), V = new Float64Array(NA * NS), H = new Float64Array(NA * NS);
  const lista = celdas ? [...celdas].map((i) => D.celdas[i]) : D.celdas;
  for (const c of lista) {
    for (const [j, n] of c.m) { M[j] += n; if (j < S0 * NS) H[j] += n * c.k; }
    for (const [j, n] of c.v) { V[j] += n; if (j >= S0 * NS) H[j] += n; }
  }
  return { M, V, H, n: lista.length };
}

function analizar() {
  serie = agregar(sel.celdas);
  const H = serie.H;
  const anual = [...Array(NA)].map((_, a) => suma(H.subarray(a * NS, (a + 1) * NS)));
  const p10 = [], p50 = [], p90 = [], media = [];
  for (let w = 0; w < NS; w++) {
    const col = [...Array(NA)].map((_, a) => H[a * NS + w]);
    p10.push(cuantil(col, 0.1)); p50.push(cuantil(col, 0.5)); p90.push(cuantil(col, 0.9)); media.push(suma(col) / NA);
  }
  // temporada: semanas entre el 10 % y el 90 % del acumulado medio
  const tot = suma(media); let acc = 0, ini = 0, fin = NS - 1, iniOk = false;
  for (let w = 0; w < NS; w++) { acc += media[w]; if (!iniOk && acc >= 0.1 * tot) { ini = w; iniOk = true; } if (acc >= 0.9 * tot) { fin = w; break; } }
  const suav = media.map((_, w) => (media[Math.max(0, w - 1)] + media[w] + media[Math.min(NS - 1, w + 1)]) / 3);
  const pico = suav.indexOf(Math.max(...suav));
  // semanas raras: por encima del 90 % de los años para esa semana y con actividad relevante
  const minimo = Math.max(5, 0.05 * Math.max(...media));
  const raro = new Uint8Array(NA * NS);
  for (let a = 0; a < NA; a++) for (let w = 0; w < NS; w++) { const v = H[a * NS + w]; if (v > p90[w] && v >= minimo) raro[a * NS + w] = 1; }
  // centro de la temporada por año (semana promedio ponderada) para ver si se adelanta
  const centros = anual.map((t, a) => (t > 0 ? suma([...Array(NS)].map((_, w) => w * H[a * NS + w])) / t : null));
  const xs = [], ys = []; centros.forEach((c, a) => { if (c !== null && anual[a] >= minimo * 4) { xs.push(A0 + a); ys.push(c); } });
  const pendienteDias = xs.length > 5 ? regresion(xs, ys) * 7 * 10 : 0; // días por década
  const medianaAnual = cuantil(anual, 0.5);
  const prim = suma(anual.slice(0, 10)) / 10, ult = suma(anual.slice(-10)) / 10;
  Object.assign(serie, { anual, p10, p50, p90, media, ini, fin, pico, raro, medianaAnual, pendienteDias, cambio: (ult - prim) / prim });
}

/* ---------- tooltip ---------- */
const tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip);
function mostrarTip(e, html) { tip.innerHTML = html; tip.style.display = 'block'; const x = Math.min(e.clientX + 14, innerWidth - 250); tip.style.left = x + 'px'; tip.style.top = e.clientY + 14 + 'px'; }
function ocultarTip() { tip.style.display = 'none'; }

/* ---------- mapa ---------- */
function iniciarMapa(deps) {
  mapa = L.map('mapa', { preferCanvas: true, zoomSnap: 0.25, attributionControl: true }).setView([-16.6, -64.6], 5.25);
  const oscuro = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri, HERE, Garmin, © OpenStreetMap', maxZoom: 16,
  }).addTo(mapa);
  const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri, Maxar, Earthstar Geographics', maxZoom: 17,
  });
  const extras = {};
  if (U7) {
    mapa.createPane('vivos').style.zIndex = 450; const rend = L.canvas({ pane: 'vivos' });
    const capa7 = L.layerGroup(U7.puntos.map(([la, lo]) => L.circleMarker([la, lo], { pane: 'vivos', renderer: rend, radius: 2.2, stroke: false, fillColor: '#fff36b', fillOpacity: 0.9, interactive: false })));
    capa7.addTo(mapa); extras[`${T('Focos', 'Fires')} ${txtFechaIso(U7.desde)} – ${txtFechaIso(U7.hasta)}`] = capa7;
  }
  L.control.layers({ [T('Mapa oscuro', 'Dark map')]: oscuro, [T('Satélite', 'Satellite')]: satelite }, extras, { position: 'topright' }).addTo(mapa);
  capaCeldas = L.layerGroup().addTo(mapa);
  capaDeps = L.geoJSON(deps, { style: { color: '#f3ebe4', weight: 1, opacity: 0.55, fill: false }, interactive: false }).addTo(mapa);
  capaSel = L.layerGroup().addTo(mapa);
  mapa.on('click', clicMapa);
  mapa.on('mousemove', (e) => { if (dibujando && rectDibujo) rectDibujo.setBounds([dibujando, e.latlng]); });
}

function celdaEn(latlng) {
  const x = Math.floor((latlng.lng - D.lon0) / D.celda), y = Math.floor((latlng.lat - D.lat0) / D.celda);
  return D.celdas.findIndex((c) => c.x === x && c.y === y);
}

function clicMapa(e) {
  if (dibujando === false) {
    dibujando = e.latlng;
    rectDibujo = L.rectangle([e.latlng, e.latlng], { color: '#ffc23d', weight: 1.5, dashArray: '4 4', fillOpacity: 0.08, interactive: false }).addTo(mapa);
    return;
  }
  if (dibujando) {
    const a = dibujando, b = e.latlng; dibujando = null; $('#dibujar').classList.remove('activo');
    if (rectDibujo) { mapa.removeLayer(rectDibujo); rectDibujo = null; }
    const [s, n] = [Math.min(a.lat, b.lat), Math.max(a.lat, b.lat)], [o, es] = [Math.min(a.lng, b.lng), Math.max(a.lng, b.lng)];
    const set = new Set();
    D.celdas.forEach((c, i) => { const lo = D.lon0 + (c.x + 0.5) * D.celda, la = D.lat0 + (c.y + 0.5) * D.celda; if (la >= s && la <= n && lo >= o && lo <= es) set.add(i); });
    if (!set.size) { const i = celdaEn(b); if (i >= 0) set.add(i); }
    if (set.size) elegir(T(`Zona dibujada (${set.size} cuadros)`, `Drawn area (${set.size} cells)`), set);
    return;
  }
  const i = celdaEn(e.latlng);
  if (i >= 0) { const c = D.celdas[i]; elegir(`${T('Cuadro', 'Cell')} ${(D.lat0 + (c.y + 0.5) * D.celda).toFixed(2)}, ${(D.lon0 + (c.x + 0.5) * D.celda).toFixed(2)} (${D.departamentos[c.d]})`, new Set([i])); }
}

function pintarMapa() {
  capaCeldas.clearLayers();
  const a = anioSel - A0; const vals = D.celdas.map((c) => valorCelda(c, a));
  const max = Math.max(...vals, 1); const esc = escalaLog(tope(vals));
  D.celdas.forEach((c, i) => {
    const v = vals[i]; if (v <= 0) return;
    const b = [[D.lat0 + c.y * D.celda, D.lon0 + c.x * D.celda], [D.lat0 + (c.y + 1) * D.celda, D.lon0 + (c.x + 1) * D.celda]];
    L.rectangle(b, { stroke: false, fillColor: color(0.1 + 0.9 * esc(v)), fillOpacity: 0.82, interactive: false }).addTo(capaCeldas);
  });
  $('#leyenda-mapa').innerHTML = `<span>0</span><span class="barra" style="background:linear-gradient(90deg,${[0.15, 0.4, 0.6, 0.8, 1].map(color).join(',')})"></span><span>${fmt(max)} ${T('focos/cuadro en', 'fires/cell in')} ${anioSel}</span>${U7 ? `<span style="color:#fff36b">● ${T('últimos 7 días', 'last 7 days')}</span>` : ''}`;
  pintarSeleccion();
}

function valorCelda(c, a) {
  let t = 0; const lo = a * NS, hi = lo + NS;
  if (a < S0) { for (const [j, n] of c.m) if (j >= lo && j < hi) t += n * c.k; }
  else { for (const [j, n] of c.v) if (j >= lo && j < hi) t += n; }
  return t;
}

function pintarSeleccion() {
  capaSel.clearLayers();
  if (!sel.celdas) return;
  const b = L.latLngBounds([]);
  for (const i of sel.celdas) {
    const c = D.celdas[i]; const r = [[D.lat0 + c.y * D.celda, D.lon0 + c.x * D.celda], [D.lat0 + (c.y + 1) * D.celda, D.lon0 + (c.x + 1) * D.celda]];
    L.rectangle(r, { color: '#ffc23d', weight: 1.4, fill: false, interactive: false }).addTo(capaSel); b.extend(r);
  }
  return b;
}

/* ---------- selección ---------- */
function elegir(nombre, celdas, mover = true) {
  sel = { nombre, celdas };
  const optZona = $('#zona'); if (![...optZona.options].some((o) => o.value === nombre)) optZona.value = '__propia';
  else optZona.value = nombre;
  analizar(); dibujarTodo();
  const b = pintarSeleccion();
  if (mover) { if (b && b.isValid()) mapa.fitBounds(b.pad(0.4), { maxZoom: 8 }); else mapa.setView([-16.6, -64.6], 5.25); }
  guardarEnlace();
}

function elegirDepartamento(nombre) {
  if (nombre === TODA) return elegir(nombre, null);
  const d = D.departamentos.indexOf(nombre);
  elegir(nombre, new Set(D.celdas.map((c, i) => (c.d === d ? i : -1)).filter((i) => i >= 0)));
}

/* ---------- resumen + interpretación ---------- */
function dibujarResumen() {
  const s = serie; const peor = s.anual.indexOf(Math.max(...s.anual));
  const temporada = `${txtFecha(fechaDeDia(s.ini * 7))} – ${txtFecha(fechaDeDia(Math.min(364, s.fin * 7 + 6)))}`;
  const dd = Math.abs(s.pendienteDias).toFixed(0);
  const adelanta = Math.abs(s.pendienteDias) < 2 ? T('la temporada está estable', 'season timing is stable') : s.pendienteDias < 0 ? T(`la temporada se adelanta ${dd} días/década`, `season comes ${dd} days/decade earlier`) : T(`la temporada se atrasa ${dd} días/década`, `season comes ${dd} days/decade later`);
  const datos = [
    { n: fmt(s.medianaAnual), t: T('focos en un año normal', 'fires in a typical year'), s: T('mediana 2001–2025', 'median 2001–2025') },
    { n: temporada, t: T('temporada crítica', 'critical season'), s: T('80 % de los focos del año', '80% of the year’s fires'), chico: true },
    { n: rangoSemana(s.pico), t: T('semana pico', 'peak week'), s: T('más focos en promedio', 'most fires on average'), chico: true },
    { n: String(A0 + peor), t: T('peor año', 'worst year'), s: `${dec(s.anual[peor] / Math.max(1, s.medianaAnual))} × ${T('lo normal', 'typical')}` },
    { n: (s.cambio >= 0 ? '+' : '') + Math.round(s.cambio * 100) + ' %', t: T('última década vs primera', 'last decade vs first'), s: adelanta },
  ];
  $('#resumen').innerHTML = `<div class="dato" style="grid-column:1/-1"><div class="t">${T('Zona', 'Area')}</div><div class="n" style="font-size:1.2rem">${nombreZona(sel.nombre)}</div><div class="s">${interpretar()}</div></div>` +
    datos.map((d) => `<div class="dato"><div class="n" ${d.chico ? 'style="font-size:1.05rem"' : ''}>${d.n}</div><div class="t">${d.t}</div><div class="s">${d.s}</div></div>`).join('');
}

function interpretar() {
  const s = serie; const extremos = s.anual.map((t, a) => [t / Math.max(1, s.medianaAnual), A0 + a]).filter(([r]) => r >= 1.8).sort((x, y) => y[0] - x[0]).slice(0, 3);
  const i = txtFecha(fechaDeDia(s.ini * 7)), f = txtFecha(fechaDeDia(Math.min(364, s.fin * 7 + 6))), pk = txtFecha(fechaDeDia(s.pico * 7));
  let t = T(`La quema se concentra entre ${i} y ${f}, con pico en la semana del ${pk}.`, `Burning concentrates between ${i} and ${f}, peaking in the week of ${pk}.`);
  if (extremos.length) t += ` ${T('Años extremos', 'Extreme years')}: ${extremos.map(([r, a]) => `${a} (${dec(r)}×)`).join(', ')}.`;
  return t;
}

/* ---------- alerta temprana ---------- */
function dibujarAlerta() {
  const s = serie; const w0 = semanaDe(HOY); const picoMedia = Math.max(...s.media, 1);
  const prox = [...Array(8)].map((_, i) => (w0 + i) % NS);
  const esperado = suma(prox.slice(0, 4).map((w) => s.p50[w])), alto = suma(prox.slice(0, 4).map((w) => s.p90[w]));
  const nivel = Math.max(...prox.slice(0, 4).map((w) => s.media[w])) / picoMedia;
  let grado = nivel >= 0.5 ? 2 : nivel >= 0.2 ? 1 : 0, vivo = '';
  if (U7) {
    const n = U7.puntos.filter((p) => !sel.celdas || sel.celdas.has(p[2])).length;
    const [y, m, d] = U7.hasta.split('-').map(Number); const wv = semanaDe(new Date(y, m - 1, d - 3));
    const normal = s.p50[wv], altoV = s.p90[wv]; const veces = n / Math.max(1, normal);
    const estado = n > altoV && n >= 10 ? ['var(--rojo)', T('FUERA DE LO NORMAL', 'ABNORMALLY HIGH'), 2] : veces >= 1.5 && n >= 10 ? ['var(--brasa)', T('por encima de lo normal', 'above normal'), 1] : n < s.p10[wv] * 0.8 && normal >= 10 ? ['var(--verde)', T('por debajo de lo normal', 'below normal'), 0] : ['var(--suave)', T('dentro de lo normal', 'within normal range'), 0];
    grado = Math.max(grado, estado[2]);
    vivo = `<div class="vivo"><div class="t">${T('Últimos 7 días', 'Last 7 days')} · ${txtFechaIso(U7.desde)} – ${txtFechaIso(U7.hasta)} · ${U7.fuente}</div>
      <div><b style="font-size:1.4rem">${fmt(n)}</b> ${T('focos', 'fires')} · <b style="color:${estado[0]}">${estado[1]}</b></div>
      <div class="t">${T('Normal para estas fechas', 'Normal for these dates')}: ${fmt(normal)} (${T('año malo', 'bad year')}: ${fmt(altoV)})${normal > 0 ? ` → ${dec(veces)} × ${T('lo normal', 'normal')}` : ''}</div></div>`;
  }
  const [col, txt] = grado === 2 ? ['var(--rojo)', T('ALTO', 'HIGH')] : grado === 1 ? ['var(--brasa)', T('MEDIO', 'MEDIUM')] : ['var(--verde)', T('BAJO', 'LOW')];
  let falta = (s.pico - w0 + NS) % NS; const enTemporada = (w0 >= s.ini && w0 <= s.fin);
  const hastaIni = (s.ini - w0 + NS) % NS;
  const pk = txtFecha(fechaDeDia(s.pico * 7)), fn = txtFecha(fechaDeDia(Math.min(364, s.fin * 7 + 6))), ii = txtFecha(fechaDeDia(s.ini * 7));
  const msgPico = falta === 0 ? T('Estamos en la semana pico.', 'This is the peak week.')
    : enTemporada ? (w0 > s.pico ? T(`El pico ya pasó (semana del ${pk}); la temporada termina el ${fn}.`, `The peak has passed (week of ${pk}); the season ends ${fn}.`) : T(`El pico llega en ${falta} semanas (${pk}).`, `Peak arrives in ${falta} weeks (${pk}).`))
    : T(`La temporada crítica ya terminó. La próxima empieza cerca del ${ii} (en ${hastaIni} semanas) y el pico llega en ${falta} semanas.`, `The critical season is over. The next one starts around ${ii} (in ${hastaIni} weeks) and peaks in ${falta} weeks.`);
  const max = Math.max(...prox.map((w) => s.p90[w]), 1);
  $('#alerta').innerHTML = `<h2><span class="semaforo" style="background:${col}"></span> ${T('Alerta temprana · riesgo', 'Early warning · risk')} ${txt}</h2>
    ${vivo}
    <p class="alerta-grande">${T(`Próximas 4 semanas en <b>${nombreZona(sel.nombre)}</b>: lo normal son <b>${fmt(esperado)}</b> focos; en un año malo, hasta <b>${fmt(alto)}</b>.`, `Next 4 weeks in <b>${nombreZona(sel.nombre)}</b>: typically <b>${fmt(esperado)}</b> fires; in a bad year, up to <b>${fmt(alto)}</b>.`)}</p>
    <p class="nota">${msgPico} ${T('Según el historial 2001–2025 de la semana actual', 'Based on the 2001–2025 record for the current week')} (${rangoSemana(w0)}).</p>
    <div class="mini-barras">${prox.map((w) => `<div><span style="height:${Math.max(3, (s.p50[w] / max) * 60)}px;background:${color(0.25 + 0.75 * s.media[w] / picoMedia)}"></span>${txtFecha(fechaDeDia(w * 7))}</div>`).join('')}</div>`;
}

/* ---------- calendario ---------- */
function dibujarCalendario() {
  const s = serie; const arr = modo === 'm' ? s.M : modo === 'v' ? s.V : s.H;
  const cw = 13, ch = 15, izq = 64, arriba = 22, ancho = izq + NS * cw + 10, alto = arriba + NA * ch + 6;
  const esc = escalaLog(tope(arr));
  let svg = `<svg width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${T('Calendario de focos por semana y año', 'Fire calendar by week and year')}">`;
  for (let m = 0; m < 12; m++) { const w = Math.floor((Date.UTC(2025, m, 1) - Date.UTC(2025, 0, 1)) / 864e5 / 7); svg += `<text x="${izq + w * cw}" y="14">${MESES[m]}</text>`; }
  svg += `<rect x="${izq + s.ini * cw - 1}" y="${arriba - 4}" width="${(s.fin - s.ini + 1) * cw + 2}" height="3" fill="var(--fuego)" rx="1.5"><title>${T('Temporada crítica', 'Critical season')}</title></rect>`;
  for (let a = 0; a < NA; a++) {
    const y = arriba + a * ch; const sinDato = modo === 'v' && a < S0;
    svg += `<text x="4" y="${y + 11}" ${A0 + a === anioSel ? 'style="fill:var(--brasa);font-weight:700"' : ''}>${A0 + a}${a < S0 && modo === 'h' ? ' ≈' : ''}</text>`;
    for (let w = 0; w < NS; w++) {
      const j = a * NS + w, v = arr[j];
      const raro = modo === 'h' && s.raro[j];
      svg += `<rect data-j="${j}" x="${izq + w * cw}" y="${y}" width="${cw - 1.5}" height="${ch - 2.5}" rx="2" fill="${sinDato ? '#0000' : v > 0 ? color(0.08 + 0.92 * esc(v)) : '#241e1a'}"${raro ? ' stroke="#fff" stroke-width="1.6"' : ''}/>`;
    }
  }
  svg += `<rect x="1" y="${arriba + (anioSel - A0) * ch - 1.5}" width="${ancho - 4}" height="${ch}" fill="none" stroke="var(--brasa)" stroke-opacity=".5" rx="3"/>`;
  const w0 = semanaDe(HOY); svg += `<line x1="${izq + w0 * cw + cw / 2}" x2="${izq + w0 * cw + cw / 2}" y1="${arriba - 6}" y2="${alto}" stroke="#fff" stroke-dasharray="2 3" opacity=".5"/>`;
  svg += '</svg>';
  const cal = $('#calendario'); cal.innerHTML = svg;
  cal.onmousemove = (e) => {
    const j = e.target.dataset && e.target.dataset.j; if (j === undefined) return ocultarTip();
    const a = Math.floor(j / NS), w = j % NS;
    mostrarTip(e, `<b>${A0 + a} · ${rangoSemana(w)}</b><br>${modo === 'h' ? `${T('Armonizado', 'Harmonized')}: <b>${fmt(s.H[j])}</b><br>` : ''}MODIS: ${fmt(s.M[j])}<br>VIIRS: ${a < S0 ? T('— (aún no existía)', '— (not yet launched)') : fmt(s.V[j])}<br><span style="color:var(--suave)">${T('Normal para esa semana', 'Normal for that week')}: ${fmt(s.p50[w])} (${T('alto', 'high')}: ${fmt(s.p90[w])})</span>${s.raro[j] ? `<br><b style="color:var(--rojo)">${T('Fuera de lo normal', 'Abnormal')}</b>` : ''}`);
  };
  cal.onmouseleave = ocultarTip;
  cal.onclick = (e) => { const j = e.target.dataset && e.target.dataset.j; if (j !== undefined) cambiarAnio(A0 + Math.floor(j / NS)); };
}

/* ---------- climatología ---------- */
function dibujarClima() {
  const s = serie; const W = 760, Hh = 230, iz = 58, ab = 24, ar = 10; const iw = W - iz - 10, ih = Hh - ar - ab;
  const fila = [...Array(NS)].map((_, w) => s.H[(anioSel - A0) * NS + w]);
  const max = Math.max(...s.p90, ...fila, 1);
  const X = (w) => iz + (w + 0.5) * iw / NS, Y = (v) => ar + ih - (v / max) * ih;
  const linea = (vals) => vals.map((v, w) => `${w ? 'L' : 'M'}${X(w).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  let svg = `<svg class="grafico" viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="${T('Focos por semana: rango normal y año elegido', 'Weekly fires: normal range and selected year')}">`;
  svg += `<rect x="${X(s.ini) - iw / NS / 2}" y="${ar}" width="${(s.fin - s.ini + 1) * iw / NS}" height="${ih}" fill="var(--fuego)" opacity=".08"/>`;
  for (let k = 0; k <= 4; k++) { const v = max * k / 4; svg += `<line x1="${iz}" x2="${W - 10}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--linea)"/><text x="${iz - 6}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; }
  for (let m = 0; m < 12; m++) { const w = Math.floor((Date.UTC(2025, m, 1) - Date.UTC(2025, 0, 1)) / 864e5 / 7); svg += `<text x="${X(w)}" y="${Hh - 6}">${MESES[m]}</text>`; }
  svg += `<path d="${linea(s.p90)}L${[...s.p10].reverse().map((v, i) => `${X(NS - 1 - i).toFixed(1)},${Y(v).toFixed(1)}`).join('L')}Z" fill="var(--suave)" opacity=".2"/>`;
  svg += `<path d="${linea(s.p50)}" fill="none" stroke="var(--suave)" stroke-width="1.8"/>`;
  svg += `<path d="${linea(fila)}" fill="none" stroke="var(--fuego)" stroke-width="2.4"/>`;
  const w0 = semanaDe(HOY); svg += `<line x1="${X(w0)}" x2="${X(w0)}" y1="${ar}" y2="${ar + ih}" stroke="#fff" stroke-dasharray="3 3" opacity=".6"/><text x="${X(w0) + 4}" y="${ar + 12}" style="fill:#fff">${T('hoy', 'today')}</text>`;
  svg += `<rect id="clima-hit" x="${iz}" y="${ar}" width="${iw}" height="${ih}" fill="transparent"/></svg>`;
  const el = $('#clima'); el.innerHTML = svg; $('#anio-sel-txt').textContent = `· ${anioSel}`;
  el.onmousemove = (e) => {
    const r = el.querySelector('svg').getBoundingClientRect(); const w = Math.floor(((e.clientX - r.left) * W / r.width - iz) / (iw / NS));
    if (w < 0 || w >= NS) return ocultarTip();
    mostrarTip(e, `<b>${rangoSemana(w)}</b><br>${anioSel}: <b>${fmt(fila[w])}</b><br>${T('Normal', 'Normal')}: ${fmt(s.p50[w])} (${T('de', 'from')} ${fmt(s.p10[w])} ${T('a', 'to')} ${fmt(s.p90[w])})`);
  };
  el.onmouseleave = ocultarTip;
}

/* ---------- totales anuales ---------- */
function dibujarAnual() {
  const s = serie; const W = 760, Hh = 220, iz = 58, ab = 22, ar = 18; const iw = W - iz - 10, ih = Hh - ar - ab;
  const m = [...Array(NA)].map((_, a) => suma(s.M.subarray(a * NS, (a + 1) * NS)));
  const v = [...Array(NA)].map((_, a) => suma(s.V.subarray(a * NS, (a + 1) * NS)));
  const max = Math.max(...v, ...s.anual, ...m, 1); const bw = iw / NA;
  const Y = (x) => ar + ih - (x / max) * ih;
  let svg = `<svg class="grafico" viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="${T('Focos por año: MODIS, VIIRS y armonizado', 'Fires per year: MODIS, VIIRS and harmonized')}">`;
  for (let k = 0; k <= 4; k++) { const val = max * k / 4; svg += `<line x1="${iz}" x2="${W - 10}" y1="${Y(val)}" y2="${Y(val)}" stroke="var(--linea)"/><text x="${iz - 6}" y="${Y(val) + 4}" text-anchor="end">${fmt(val)}</text>`; }
  for (let a = 0; a < NA; a++) {
    const x = iz + a * bw;
    svg += `<rect data-a="${a}" x="${x + bw * 0.12}" y="${Y(m[a])}" width="${bw * 0.36}" height="${ih - (Y(m[a]) - ar)}" fill="var(--modis)" rx="1.5"/>`;
    if (a >= S0) svg += `<rect data-a="${a}" x="${x + bw * 0.5}" y="${Y(v[a])}" width="${bw * 0.36}" height="${ih - (Y(v[a]) - ar)}" fill="var(--viirs)" rx="1.5"/>`;
    if (a % 3 === 0 || a === NA - 1) svg += `<text x="${x + bw / 2}" y="${Hh - 6}" text-anchor="middle">${A0 + a}</text>`;
  }
  svg += `<path d="${s.anual.map((t, a) => `${a ? 'L' : 'M'}${(iz + (a + 0.5) * bw).toFixed(1)},${Y(t).toFixed(1)}`).join('')}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="${''}"/>`;
  svg += `<line x1="${iz + S0 * bw}" x2="${iz + S0 * bw}" y1="${ar - 10}" y2="${ar + ih}" stroke="var(--suave)" stroke-dasharray="3 3"/><text x="${iz + S0 * bw + 4}" y="${ar - 2}">${T('llega VIIRS', 'VIIRS starts')}</text>`;
  svg += `<g transform="translate(${iz + 8},${ar})"><rect width="10" height="10" fill="var(--modis)"/><text x="14" y="9">MODIS</text><rect x="68" width="10" height="10" fill="var(--viirs)"/><text x="82" y="9">VIIRS</text><line x1="130" x2="146" y1="5" y2="5" stroke="#fff" stroke-width="2"/><text x="150" y="9">${T('Armonizado (equiv. VIIRS)', 'Harmonized (VIIRS-equivalent)')}</text></g></svg>`;
  const el = $('#anual'); el.innerHTML = svg;
  el.onmousemove = (e) => { const a = e.target.dataset && e.target.dataset.a; if (a === undefined) return ocultarTip(); mostrarTip(e, `<b>${A0 + +a}</b><br>MODIS: ${fmt(m[a])}<br>VIIRS: ${a >= S0 ? fmt(v[a]) : '—'}<br>${T('Armonizado', 'Harmonized')}: <b>${fmt(s.anual[a])}</b>`); };
  el.onmouseleave = ocultarTip;
  el.onclick = (e) => { const a = e.target.dataset && e.target.dataset.a; if (a !== undefined) cambiarAnio(A0 + +a); };
}

/* ---------- método ---------- */
function dibujarMetodo() {
  const v = D.validacion; $('#factor').textContent = dec(v.factor_nacional);
  const pasos = T([
    'Bajamos todos los focos de Bolivia de <b>NASA FIRMS</b>: MODIS (Terra y Aqua, 2001–2025, 1 km) y VIIRS S-NPP (2012–2025, 375 m). Solo fuegos de vegetación (<i>type 0</i>); se descartan los de confianza baja.',
    'Juntamos ambos en la misma cuadrícula de 0,25° y por semana.',
    'En los años en que existen los dos (2012–2025) medimos, cuadro por cuadro, cuántos focos VIIRS hay por cada foco MODIS (factor <i>k</i>, ajustado hacia el valor nacional donde hay pocos datos).',
    'Antes de 2012 estimamos VIIRS = MODIS × <i>k</i>; desde 2012 usamos VIIRS real. Así salen 25 años en la misma escala y la serie sigue sirviendo cuando MODIS se apague.',
    'La alerta compara los focos VIIRS de los últimos 7 días (archivo público de FIRMS, actualizado a diario) con lo normal para esas fechas.',
  ], [
    'We downloaded every Bolivian hotspot from <b>NASA FIRMS</b>: MODIS (Terra & Aqua, 2001–2025, 1 km) and VIIRS S-NPP (2012–2025, 375 m). Vegetation fires only (<i>type 0</i>); low-confidence detections removed.',
    'Both are binned on the same 0.25° grid, by week.',
    'Over the overlap years (2012–2025) we measure, cell by cell, how many VIIRS hotspots appear per MODIS hotspot (factor <i>k</i>, shrunk toward the national value where data is sparse).',
    'Before 2012, VIIRS = MODIS × <i>k</i>; from 2012 on, real VIIRS. The result: 25 years on one scale, and a record that keeps working after MODIS is retired.',
    'The warning compares the last 7 days of VIIRS hotspots (public FIRMS file, updated daily) with what is normal for those dates.',
  ]);
  $('#metodo').innerHTML = `
    <ol class="nota" style="color:var(--texto);padding-left:18px">${pasos.map((x) => `<li>${x}</li>`).join('')}</ol>
    <p>${T(`Prueba: para cada año 2012–2025 calculamos <i>k</i> <b>sin ese año</b> y estimamos VIIRS solo con MODIS. Correlación semanal por departamento <b class="bien">r = ${dec(v.r_semanal, 3)}</b>, R² (log) ${dec(v.r2_semanal_log, 2)}; error anual mediano <b class="bien">${dec(v.errores_abs_pct_mediana)} %</b>.`,
      `Test: for each year 2012–2025 we fit <i>k</i> <b>without that year</b> and predict VIIRS from MODIS alone. Weekly correlation by department <b class="bien">r = ${dec(v.r_semanal, 3)}</b>, R² (log) ${dec(v.r2_semanal_log, 2)}; median annual error <b class="bien">${dec(v.errores_abs_pct_mediana)}%</b>.`)}</p>
    <div class="scroll-x"><table><tr><th>${T('Año', 'Year')}</th><th>MODIS</th><th>${T('VIIRS real', 'Actual VIIRS')}</th><th>${T('Estimado con MODIS', 'Predicted from MODIS')}</th><th>${T('Error', 'Error')}</th></tr>
    ${v.por_anio.map((r) => `<tr><td>${r.anio}</td><td>${fmt(r.modis)}</td><td>${fmt(r.viirs)}</td><td>${fmt(r.estimado)}</td><td>${r.error_pct > 0 ? '+' : ''}${dec(r.error_pct)} %</td></tr>`).join('')}</table></div>
    <p class="nota">${T('Fuente', 'Source')}: ${D.fuente}. ${T('Los focos son detecciones de calor, no área quemada: un incendio grande puede dar muchos focos.', 'Hotspots are thermal detections, not burned area: one large fire can produce many hotspots.')}</p>
    <div class="controles" style="margin-top:10px"><button id="csv" type="button">⬇️ ${T('Descargar CSV de la zona', 'Download CSV for this area')}</button><button id="compartir" type="button">🔗 ${T('Copiar enlace', 'Copy link')}</button></div>`;
  $('#csv').onclick = descargarCSV;
  $('#compartir').onclick = () => { navigator.clipboard?.writeText(location.href); $('#compartir').textContent = T('✅ Enlace copiado', '✅ Link copied'); setTimeout(() => ($('#compartir').textContent = T('🔗 Copiar enlace', '🔗 Copy link')), 1800); };
}

function descargarCSV() {
  const s = serie; const filas = ['anio,semana,desde,hasta,modis,viirs,armonizado_equiv_viirs,fuera_de_lo_normal'];
  for (let a = 0; a < NA; a++) for (let w = 0; w < NS; w++) {
    const j = a * NS + w; const [d, h] = rangoSemana(w).split(' – ');
    filas.push([A0 + a, w + 1, d, h, s.M[j], a < S0 ? '' : s.V[j], s.H[j].toFixed(1), s.raro[j]].join(','));
  }
  const b = new Blob([filas.join('\n')], { type: 'text/csv' }); const u = URL.createObjectURL(b);
  const a = document.createElement('a'); a.href = u; a.download = `brasa-${sel.nombre.replace(/[^\wáéíóúñ]+/gi, '-').toLowerCase()}.csv`; a.click(); URL.revokeObjectURL(u);
}

/* ---------- enlace ---------- */
function guardarEnlace() {
  const p = new URLSearchParams({ anio: anioSel });
  if (sel.celdas) { if (D.departamentos.includes(sel.nombre)) p.set('zona', sel.nombre); else p.set('celdas', [...sel.celdas].join('.')); }
  history.replaceState(null, '', location.search + '#' + p.toString());
}
function leerEnlace() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('anio')) anioSel = Math.min(D.anios[1], Math.max(A0, +p.get('anio')));
  if (p.get('zona')) return elegirDepartamento(p.get('zona'));
  if (p.get('celdas')) { const s = new Set(p.get('celdas').split('.').map(Number).filter((i) => D.celdas[i])); if (s.size) return elegir(T(`Zona propia (${s.size} cuadros)`, `Custom area (${s.size} cells)`), s); }
  elegirDepartamento('Santa Cruz');
}

/* ---------- general ---------- */
function cambiarAnio(a) { anioSel = a; $('#anio-mapa').value = a; pintarMapa(); dibujarCalendario(); dibujarClima(); guardarEnlace(); }
function dibujarTodo() { dibujarResumen(); dibujarAlerta(); dibujarCalendario(); dibujarClima(); dibujarAnual(); }

function textosFijos() {
  document.documentElement.lang = LANG;
  if (LANG === 'en') document.querySelectorAll('[data-en]').forEach((el) => { el.innerHTML = el.dataset.en; });
  const b = $('#idioma'); b.textContent = LANG === 'en' ? 'ES' : 'EN';
  b.onclick = () => { const u = new URL(location.href); u.searchParams.set('lang', LANG === 'en' ? 'es' : 'en'); location.href = u.toString(); };
}

async function iniciar() {
  textosFijos();
  const [datos, deps] = await Promise.all([fetch('datos/focos.json').then((r) => r.json()), fetch('datos/departamentos.json').then((r) => r.json())]);
  U7 = await fetch('datos/ultimos7.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  D = datos; NA = D.anios[1] - D.anios[0] + 1; NS = D.semanas; A0 = D.anios[0]; S0 = D.solape[0] - A0;
  $('#hoy').textContent = `${T('Hoy', 'Today')}: ${HOY.toLocaleDateString(LOC, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const z = $('#zona');
  z.innerHTML = [TODA, ...[...D.departamentos].sort((a, b) => a.localeCompare(b, 'es'))].map((n) => `<option value="${n}">${nombreZona(n)}</option>`).join('') + `<option value="__propia" disabled>${T('Zona propia', 'Custom area')}</option>`;
  z.onchange = () => elegirDepartamento(z.value);
  const am = $('#anio-mapa'); am.innerHTML = [...Array(NA)].map((_, a) => `<option>${D.anios[1] - a}</option>`).join('');
  am.onchange = () => cambiarAnio(+am.value);
  $('#dibujar').onclick = () => {
    if (dibujando !== null || $('#dibujar').classList.contains('activo')) { dibujando = null; $('#dibujar').classList.remove('activo'); if (rectDibujo) { mapa.removeLayer(rectDibujo); rectDibujo = null; } return; }
    $('#dibujar').classList.add('activo'); dibujando = false;
  };
  $('#modo').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; modo = b.dataset.m; $('#modo').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); dibujarCalendario(); };
  iniciarMapa(deps);
  dibujarMetodo();
  leerEnlace();
  am.value = anioSel; pintarMapa();
}

iniciar().catch((e) => { document.body.insertAdjacentHTML('afterbegin', `<p style="padding:20px;color:#ff8a8a">${T('No se pudieron cargar los datos', 'Could not load data')} (${e.message}). ${T('Abre la app con un servidor: python3 -m http.server dentro de la carpeta web.', 'Serve the app: python3 -m http.server inside the web folder.')}</p>`); });
