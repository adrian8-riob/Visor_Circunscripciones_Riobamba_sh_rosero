(async()=>{
const $=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('es-EC',{maximumFractionDigits:2});
const palette=['#dc455b','#219fc5','#28a17b','#f3a431','#8f62b8','#357ac8','#d66b44','#65923d','#bf569c','#119f9d','#7b7ac5','#d09a31','#4c8799','#c66d80','#597fb8','#aa834b','#339476','#8b65a7'];
let data,geo={},map,unitsLayer,barriosLayer,parLayer,focusLayer,labelMarker,selected='all',mode='circ',selectedBarrio='all',page=0,current=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
try {const names=['resumen.json','circunscripciones.geojson','plataformas.geojson','barrios.geojson','parroquias.geojson'];
[data,geo.circ,geo.plat,geo.bar,geo.par]=await Promise.all(names.map(n=>fetch('assets/data/'+n).then(r=>{if(!r.ok)throw Error(n);return r.json()})));
}catch(e){document.querySelector('.map-card').innerHTML='<div style="padding:30px">No fue posible cargar los datos. Abre el visor mediante http://localhost:8000, no desde un archivo local. '+esc(e.message)+'</div>';return}
const nc=new Map(data.circunscripciones.map(x=>[x.id,x])), np=new Map(data.plataformas.map(x=>[x.id,x]));
const nameFor=(id,type)=>!id?'Sin asignación':(type==='circ'?nc:np).get(id)?.name||'Sin asignación';
const arrFor=()=>mode==='circ'?data.circunscripciones:data.plataformas;
const keyFor=()=>mode==='circ'?'circ':'plataforma';
const unitFor=b=>b[keyFor()];
const barrioById=new Map(data.barrios.map(b=>[b.id,b]));
const featById=new Map(geo.bar.features.map(f=>[f.properties.id,f]));
const stableColor=id=>{if(!id)return '#8b95a4';let a=arrFor(),i=a.findIndex(x=>x.id===id);return palette[(i<0?0:i)%palette.length]};
const barrioColor=b=>stableColor(unitFor(b));
const matching=b=>selected==='all'||unitFor(b)===selected;
$('statCirc').textContent=fmt(data.circunscripciones.length);$('statPlat').textContent=fmt(data.plataformas.length);$('statBar').textContent=fmt(data.barrios.length);
$('statPop').textContent=fmt(data.circunscripciones.reduce((s,x)=>s+(x.poblacion||0),0));
map=L.map('map',{zoomControl:false}).setView([-1.67,-78.65],12);
L.control.zoom({position:'bottomright'}).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
function bbox(geojson,pad=.12){let b=L.geoJSON(geojson).getBounds();if(b.isValid())map.fitBounds(b.pad(pad),{animate:true,maxZoom:17})}
function options(){const a=arrFor();$('territorio').innerHTML='<option value="all">Todas las unidades</option>'+a.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');$('territorio').value=selected;}
function barriosDisponibles(){return data.barrios.filter(matching).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'))}
function selectOptions(){const a=barriosDisponibles();$('barrioSelect').innerHTML='<option value="all">Selecciona un barrio ('+fmt(a.length)+')</option>'+a.map(b=>`<option value="${esc(b.id)}">${esc(b.nombre)}${unitFor(b)?'':' · Sin asignación'}</option>`).join('');$('barrioSelect').value=selectedBarrio;}
function remove(layer){if(layer&&map.hasLayer(layer))map.removeLayer(layer)}
function draw(){remove(unitsLayer);remove(barriosLayer);remove(parLayer);remove(focusLayer);remove(labelMarker);focusLayer=null;labelMarker=null;
unitsLayer=L.geoJSON(geo[mode],{style:f=>{let active=selected==='all'||selected===f.properties.id;return {color:'#fff',weight:2.3,fillColor:stableColor(f.properties.id),fillOpacity:active?.27:.045,opacity:active?1:.38}},onEachFeature:(f,l)=>{let p=f.properties;l.bindPopup('<strong>'+esc(p.name)+'</strong><br>'+fmt(p.barrios)+' barrios asignados<br>'+fmt(p.area_ha)+' ha');l.on('click',()=>chooseUnit(p.id))}}).addTo(map);
barriosLayer=L.geoJSON(geo.bar,{filter:f=>matching(f.properties),style:f=>({color:barrioColor(f.properties),weight:1.4,fillColor:barrioColor(f.properties),fillOpacity:.38,opacity:.95}),onEachFeature:(f,l)=>{const p=f.properties;l.bindTooltip(esc(p.nombre),{sticky:true});l.bindPopup('<strong>'+esc(p.nombre)+'</strong><br>Circunscripción: '+esc(nameFor(p.circ,'circ'))+'<br>Plataforma: '+esc(nameFor(p.plataforma,'plat'))+'<br>Área: '+fmt(p.area_ha)+' ha<br>Coincidencia con la unidad: '+fmt(p[mode==='circ'?'porcentaje_circ':'porcentaje_plataforma'])+'%');l.on('click',()=>chooseBarrio(p.id))}});if($('mostrarBarrios').checked)barriosLayer.addTo(map);
parLayer=L.geoJSON(geo.par,{style:{color:'#374961',weight:1,dashArray:'5,5',fillOpacity:0},onEachFeature:(f,l)=>l.bindTooltip(esc(f.properties.nombre))});if($('mostrarLimites').checked)parLayer.addTo(map);
$('mapSubtitle').textContent=(mode==='circ'?'Circunscripciones':'Plataformas')+' · '+(selected==='all'?'vista general':nameFor(selected,mode));
$('legendItems').innerHTML=(selected==='all'?arrFor():arrFor().filter(x=>x.id===selected)).map(x=>`<span><i style="background:${stableColor(x.id)}"></i>${esc(x.name)}</span>`).join('')+'<span><i style="background:#8b95a4"></i>Sin asignación</span>';
if(selectedBarrio!=='all')highlight();
}
function highlight(){remove(focusLayer);remove(labelMarker);let b=barrioById.get(selectedBarrio),f=featById.get(selectedBarrio);if(!b||!f)return;
focusLayer=L.geoJSON(f,{style:{color:'#093d5a',weight:4,fillColor:barrioColor(b),fillOpacity:.72}}).addTo(map).bringToFront();
const layer=focusLayer.getLayers()[0];if(layer){const c=layer.getBounds().getCenter();labelMarker=L.marker(c,{icon:L.divIcon({className:'selection-label',html:'<div>'+esc(b.nombre)+'</div>',iconSize:[0,0]})}).addTo(map);layer.bindPopup('<strong>'+esc(b.nombre)+'</strong><br>'+esc(nameFor(b.circ,'circ'))+'<br>'+esc(nameFor(b.plataforma,'plat'))+'<br>Área: '+fmt(b.area_ha)+' ha').openPopup(c)}
}
function zoomToBarrio(id){let f=featById.get(id);if(f)bbox(f,.4)}
function chooseBarrio(id){selectedBarrio=id;selectOptions();draw();renderGroups();updateTable();if(id!=='all'){zoomToBarrio(id);$('selectionHint').textContent='Barrio resaltado en el mapa. Puedes elegir otro en la lista inferior.'}else $('selectionHint').textContent='Selecciona un barrio para acercarte a su polígono.';}
function chooseUnit(id){selected=id;selectedBarrio='all';page=0;options();selectOptions();refresh();if(id!=='all'){let f=geo[mode].features.find(f=>f.properties.id===id);if(f)bbox(f,.14)}else bbox(geo[mode],.20)}
function renderGroups(){let a=selected==='all'?arrFor():arrFor().filter(x=>x.id===selected);let missing=data.barrios.filter(b=>!unitFor(b));let groups=a.map(x=>({id:x.id,name:x.name,items:data.barrios.filter(b=>unitFor(b)===x.id)}));if(selected==='all'&&missing.length)groups.push({id:'none',name:'Sin asignación',items:missing});
$('listTitle').textContent='Listado de barrios por '+(mode==='circ'?'circunscripción':'plataforma');
$('listMeta').textContent=fmt(data.barrios.filter(matching).length)+' barrios en la consulta';
$('listDescription').textContent='Cada bloque muestra los barrios de la unidad. Haz clic en el nombre de un barrio para resaltarlo y acercar el mapa. Los colores distinguen las unidades territoriales.';
$('unitGroups').innerHTML=groups.map(g=>{const col=stableColor(g.id==='none'?null:g.id);return `<article class="territory-group ${selected!=='all'?'is-active':''}" id="group-${esc(g.id)}"><button class="group-head" data-unit="${esc(g.id)}" type="button" title="Mostrar u ocultar el listado"><span class="group-marker" style="background:${col}"></span><span class="group-title"><strong>${esc(g.name)}</strong><small>${fmt(g.items.length)} barrios asignados</small></span><span class="group-number">${fmt(g.items.length)}</span></button><div class="group-content">${g.items.length?g.items.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).map(b=>`<button type="button" class="bairro-btn ${selectedBarrio===b.id?'active':''}" data-barrio="${esc(b.id)}"><span class="dot" style="background:${col}"></span><span class="bairro-name">${esc(b.nombre)}</span><span class="mini-area">${fmt(b.area_ha)} ha</span></button>`).join(''):'<div class="empty-group">No se registraron barrios asignados.</div>'}</div></article>`}).join('');
$('unitGroups').querySelectorAll('[data-barrio]').forEach(el=>el.addEventListener('click',()=>chooseBarrio(el.dataset.barrio)));
$('unitGroups').querySelectorAll('.group-head').forEach(el=>el.addEventListener('click',()=>{let id=el.dataset.unit;if(id==='none'){el.closest('.territory-group').classList.toggle('collapsed');return}if(selected!==id)chooseUnit(id);else el.closest('.territory-group').classList.toggle('collapsed')}));
}
function updatePanels(){let a=arrFor(),shown=selected==='all'?a:a.filter(x=>x.id===selected),max=Math.max(...a.map(x=>x.barrios),1);
$('chartTitle').textContent='Barrios por '+(mode==='circ'?'circunscripción':'plataforma');$('detailsTitle').textContent='Resumen de '+(mode==='circ'?'circunscripciones':'plataformas');
$('bars').innerHTML=shown.map(x=>`<div class="bar-row"><label title="${esc(x.name)}">${esc(x.name.replace('CIRCUNSCRIPCIÓN ','Circ. ').replace('PLATAFORMA ','Plat. '))}</label><div class="track"><div class="fill" style="width:${100*x.barrios/max}%;background:${stableColor(x.id)}"></div></div><strong>${fmt(x.barrios)}</strong></div>`).join('')+(selected==='all'?`<div class="bar-row"><label>Sin asignación</label><div class="track"><div class="fill" style="width:${100*data.barrios.filter(b=>!unitFor(b)).length/max}%;background:#8b95a4"></div></div><strong>${fmt(data.barrios.filter(b=>!unitFor(b)).length)}</strong></div>`:'');
let list=shown.flatMap(x=>[{label:x.name+' · barrios',value:fmt(x.barrios)},{label:x.name+' · superficie',value:fmt(x.area_ha)+' ha'},...(x.poblacion!=null?[{label:x.name+' · población 2022',value:fmt(x.poblacion)}]:[])]);if(selected==='all')list.push({label:'Barrios sin asignación',value:fmt(data.barrios.filter(b=>!unitFor(b)).length)});$('details').innerHTML=list.map(x=>`<div class="detail-row"><span>${esc(x.label)}</span><strong>${esc(x.value)}</strong></div>`).join('')}
function updateTable(){current=barriosDisponibles();let pages=Math.max(1,Math.ceil(current.length/15));page=Math.min(page,pages-1);$('counter').textContent=fmt(current.length)+' registros';$('tabla').innerHTML=current.slice(page*15,page*15+15).map(b=>`<tr class="row-clickable" data-id="${esc(b.id)}" title="Clic para localizar barrio"><td>${esc(b.nombre)}</td><td>${esc(nameFor(b.circ,'circ'))}</td><td>${esc(nameFor(b.plataforma,'plat'))}</td><td>${fmt(b.area_ha)}</td><td><span class="pill ${!unitFor(b)?'warn':''}">${unitFor(b)?'Asignado':'Sin asignar'}</span></td></tr>`).join('')||'<tr><td colspan="5">Sin barrios para esta selección.</td></tr>';
$('tabla').querySelectorAll('tr[data-id]').forEach(el=>el.onclick=()=>chooseBarrio(el.dataset.id));$('pagination').innerHTML=`<button id="prev" ${page===0?'disabled':''}>Anterior</button><span>${page+1} / ${pages}</span><button id="next" ${page>=pages-1?'disabled':''}>Siguiente</button>`;$('prev').onclick=()=>{page--;updateTable()};$('next').onclick=()=>{page++;updateTable()}}
function refresh(){draw();renderGroups();updatePanels();updateTable()}
$('modo').onchange=e=>{mode=e.target.value;selected='all';selectedBarrio='all';page=0;options();selectOptions();refresh();bbox(geo[mode],.20)};
$('territorio').onchange=e=>chooseUnit(e.target.value);
$('barrioSelect').onchange=e=>chooseBarrio(e.target.value);
$('mostrarBarrios').onchange=draw;$('mostrarLimites').onchange=draw;
$('restablecer').onclick=()=>{mode='circ';$('modo').value=mode;selected='all';selectedBarrio='all';page=0;options();selectOptions();refresh();bbox(geo.circ,.20)};
$('csv').onclick=()=>{const rows=[['Barrio','Circunscripción','Plataforma','Área ha','% área en circunscripción','% área en plataforma'],...current.map(b=>[b.nombre,nameFor(b.circ,'circ'),nameFor(b.plataforma,'plat'),b.area_ha,b.porcentaje_circ,b.porcentaje_plataforma])];const csv='﻿'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');let a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));a.href=url;a.download='barrios_riobamba.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
options();selectOptions();refresh();bbox(geo.circ,.20);
})();