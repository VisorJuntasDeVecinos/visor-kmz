'use strict';

const byId = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const map = L.map('map', {zoomControl: true}).setView([-37.08, -72.57], 11);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: 'Tiles &copy; Esri'
}).addTo(map);
L.control.scale({imperial: false, position: 'bottomleft'}).addTo(map);
map.createPane('unidades').style.zIndex = 350;
map.createPane('limite').style.zIndex = 410;
map.createPane('juntas').style.zIndex = 450;
map.getPane('limite').style.pointerEvents = 'none';

const layers = {limite: L.featureGroup().addTo(map), unidades: L.featureGroup().addTo(map), juntas: L.featureGroup().addTo(map)};
const ready = {limite: false, unidades: false, juntas: false};
const labels = [];
let transparency = 50;
let userNavigated = false;
let labelFrame;
map.on('dragstart zoomstart', () => {userNavigated = true;});

function setPanel(open) {
  byId('panel').classList.toggle('is-open', open);
  byId('abrir-panel').setAttribute('aria-expanded', String(open));
}
byId('abrir-panel').addEventListener('click', () => setPanel(true));
byId('cerrar-panel').addEventListener('click', () => setPanel(false));

function syncLayers() {
  for (const key of Object.keys(layers)) {
    const visible = byId(key).checked;
    if (visible && !map.hasLayer(layers[key])) layers[key].addTo(map);
    if (!visible && map.hasLayer(layers[key])) map.removeLayer(layers[key]);
  }
  byId('nombres-unidades').disabled = !ready.unidades || !byId('unidades').checked;
  byId('transparencia').disabled = !ready.unidades || !byId('unidades').checked;
  byId('nombres-juntas').disabled = !ready.juntas || !byId('juntas').checked;
  byId('leyenda').hidden = !byId('mostrar-leyenda').checked;
  byId('leyenda-limite').hidden = !ready.limite || !byId('limite').checked;
  byId('leyenda-unidades').hidden = !ready.unidades || !byId('unidades').checked;
  byId('leyenda-juntas').hidden = !ready.juntas || !byId('juntas').checked;
  scheduleLabels();
}
for (const id of ['limite', 'unidades', 'juntas', 'nombres-unidades', 'nombres-juntas', 'mostrar-leyenda']) {
  byId(id).addEventListener('change', syncLayers);
}
byId('transparencia').addEventListener('input', event => {
  transparency = Number(event.target.value);
  byId('valor-transparencia').value = `${transparency}%`;
  // Only polygon groups have setStyle; label anchors remain invisible.
  layers.unidades.eachLayer(group => {
    if (group instanceof L.GeoJSON) group.setStyle({fillOpacity: 1 - transparency / 100});
  });
  document.querySelectorAll('.unit-swatch').forEach(swatch => {swatch.style.backgroundColor = hexAlpha(swatch.dataset.color);});
});
function hexAlpha(color) {return color + Math.round((1 - transparency / 100) * 255).toString(16).padStart(2, '0');}

function fitLayer(layer) {
  const bounds = layer.getBounds();
  if (bounds.isValid()) map.fitBounds(bounds, {padding: [28, 28], maxZoom: 16});
}
byId('ver-comuna').addEventListener('click', () => {fitLayer(layers.limite); setPanel(false);});
byId('ver-juntas').addEventListener('click', () => {fitLayer(layers.juntas); setPanel(false);});

// Permanent labels share a collision pass. All symbols remain visible at every scale.
function addLabel(layer, name, kind, priority) {
  layer.bindTooltip(escapeHtml(name), {permanent: true, direction: kind === 'unidades' ? 'center' : 'right',
    className: kind === 'unidades' ? 'label-unidad' : 'label-punto', opacity: 1,
    offset: kind === 'unidades' ? [0, 0] : [9, 0], interactive: false});
  labels.push({layer, kind, priority});
}
function overlaps(a, b, pad = 4) {
  return a.left < b.right + pad && a.right + pad > b.left && a.top < b.bottom + pad && a.bottom + pad > b.top;
}
function layoutLabels() {
  const occupied = [];
  const view = map.getContainer().getBoundingClientRect();
  for (const item of [...labels].sort((a, b) => b.priority - a.priority)) {
    const element = item.layer.getTooltip()?.getElement();
    if (!element) continue;
    const enabled = byId(item.kind).checked && byId(`nombres-${item.kind}`).checked;
    element.classList.remove('label-hidden');
    const rect = element.getBoundingClientRect();
    const onScreen = rect.right > view.left && rect.left < view.right && rect.bottom > view.top && rect.top < view.bottom;
    const visible = enabled && onScreen && !occupied.some(other => overlaps(rect, other));
    element.classList.toggle('label-hidden', !visible);
    if (visible) occupied.push(rect);
  }
}
function scheduleLabels() {cancelAnimationFrame(labelFrame); labelFrame = requestAnimationFrame(layoutLabels);}
map.on('zoomend moveend resize', scheduleLabels);

async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo leer ${path} (${response.status}).`);
  const data = await response.json();
  if (data.type !== 'FeatureCollection' || !data.features?.length) throw new Error('La capa está vacía o tiene un formato incorrecto.');
  return data;
}
function finishLayer(key) {ready[key] = true; byId(key).disabled = false; syncLayers();}
function showError(label, error) {
  console.error(label, error);
  const message = document.createElement('p');
  message.className = 'error';
  message.textContent = `No se pudo cargar ${label}. Recarga la página para volver a intentarlo.`;
  byId('errores').append(message);
}

async function loadBoundary() {
  const data = await getJson('data/limite_yumbel.geojson');
  L.geoJSON(data, {pane: 'limite', interactive: false,
    style: {color: '#183f4b', weight: 2.8, opacity: 1, fill: false}}).addTo(layers.limite);
  byId('ver-comuna').disabled = false;
  finishLayer('limite');
}

async function loadUnits() {
  const data = await getJson('data/unidades_vecinales.geojson');
  const unitLayer = L.geoJSON(data, {
    pane: 'unidades',
    style: feature => ({color: feature.properties.color, weight: 1.5, opacity: 1,
      fillColor: feature.properties.color, fillOpacity: 0.5}),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`<div class="unit-popup"><span class="popup-title">${escapeHtml(p.nombre)}</span><div class="popup-meta">Unidad vecinal ${escapeHtml(p.codigo)}<br>Comuna de Yumbel</div></div>`, {maxWidth: 300});
      layer.on('mouseover', () => layer.setStyle({weight: 3}));
      layer.on('mouseout', () => layer.setStyle({weight: 1.5}));
      layer.bindTooltip(`${escapeHtml(p.nombre)} · UV ${escapeHtml(p.codigo)}`, {sticky: true, className: 'hover-label'});
      const anchor = L.circleMarker([p.etiqueta_lat, p.etiqueta_lng], {radius: 0, stroke: false, fill: false, interactive: false, pane: 'unidades'}).addTo(layers.unidades);
      addLabel(anchor, p.nombre, 'unidades', 100000 + p.area_km2);
      const row = document.createElement('button');
      row.type = 'button'; row.className = 'unit-entry';
      row.title = `Acercar a ${p.nombre} · UV ${p.codigo}`;
      row.innerHTML = `<span class="unit-swatch" aria-hidden="true"></span><span class="unit-code">${escapeHtml(p.codigo)}</span><span>${escapeHtml(p.nombre)}</span>`;
      const swatch = row.querySelector('.unit-swatch');
      swatch.style.setProperty('--unit-color', p.color); swatch.dataset.color = p.color;
      swatch.style.backgroundColor = hexAlpha(p.color);
      row.addEventListener('click', () => {
        byId('unidades').checked = true; syncLayers();
        map.fitBounds(layer.getBounds(), {padding: [35, 35], maxZoom: 16});
        layer.openPopup(); setPanel(false);
      });
      byId('lista-unidades').append(row);
    }
  });
  unitLayer.addTo(layers.unidades);
  byId('cantidad-unidades').textContent = `(${data.features.length})`;
  finishLayer('unidades');
}

// Preserve existing KMZ tables and their presentation, removing executable content.
function cleanDescription(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script,iframe,object,embed,form,input,button,link,meta,style,svg,math').forEach(el => el.remove());
  template.content.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on') || ['srcdoc', 'srcset'].includes(attr.name)) el.removeAttribute(attr.name);
      if (['href', 'src', 'action', 'xlink:href'].includes(attr.name) && !/^https?:\/\//i.test(attr.value)) el.removeAttribute(attr.name);
      if (attr.name === 'style' && /url\s*\(|expression\s*\(/i.test(attr.value)) el.removeAttribute('style');
    }
    if (el.tagName === 'A') {el.target = '_blank'; el.rel = 'noopener noreferrer';}
  });
  return template.innerHTML;
}
async function loadJuntas() {
  const response = await fetch('JuntasDeVecinos.kmz');
  if (!response.ok) throw new Error('No se pudo leer el registro de juntas.');
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const kmlName = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.kml'));
  if (!kmlName) throw new Error('El KMZ no contiene un KML.');
  const kmlText = await zip.files[kmlName].async('string');
  const parsed = omnivore.kml.parse(kmlText);
  let count = 0;
  parsed.eachLayer(source => {
    if (!source.getLatLng) return;
    const p = source.feature?.properties || {};
    const name = p.name || 'Junta sin nombre';
    const latlng = source.getLatLng();
    const marker = L.circleMarker(latlng, {pane: 'juntas', radius: 5.5, color: '#ffffff', weight: 1.7,
      fillColor: '#b83b4b', fillOpacity: 1, bubblingMouseEvents: false}).addTo(layers.juntas);
    marker.feature = source.feature;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latlng.lat},${latlng.lng}`;
    marker.bindPopup(`<span class="popup-title">${escapeHtml(name)}</span><a class="btn-maps" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a><div class="popup-description">${cleanDescription(p.description || '')}</div>`, {maxWidth: 480});
    addLabel(marker, name, 'juntas', 1000 - count);
    marker.on('mouseover', () => {
      marker.setStyle({radius: 8, weight: 2});
      // Hover identifies a point even when its permanent label was decluttered.
      const tooltip = marker.getTooltip();
      tooltip?.getElement()?.classList.remove('label-hidden');
      tooltip?.bringToFront();
    });
    marker.on('mouseout', () => {marker.setStyle({radius: 5.5, weight: 1.7}); scheduleLabels();});
    count++;
  });
  if (!count) throw new Error('El registro no contiene puntos.');
  byId('cantidad-juntas').textContent = `(${count})`;
  byId('ver-juntas').disabled = false;
  finishLayer('juntas');
}

async function init() {
  const tasks = [['el límite comunal', loadBoundary], ['las unidades vecinales', loadUnits], ['las juntas de vecinos', loadJuntas]];
  await Promise.all(tasks.map(async ([name, loader]) => {try {await loader();} catch (error) {showError(name, error);}}));
  if (!userNavigated) {
    const bounds = L.latLngBounds([]);
    for (const group of Object.values(layers)) {
      const extent = group.getBounds();
      if (extent.isValid()) bounds.extend(extent);
    }
    if (bounds.isValid()) map.fitBounds(bounds, {padding: [28, 28]});
  }
  const loaded = Object.values(ready).filter(Boolean).length;
  byId('estado').textContent = loaded === 3 ? '3 capas cargadas · Mapa listo para consultar' : `${loaded} de 3 capas cargadas. Revisa los avisos.`;
  syncLayers();
}
syncLayers();
init();
