// ============================================================
//  SkyClick / Sistema de Gestión — interfaz según diseño Figma
//  Datos: Cloud Firestore + Firebase Authentication
// ============================================================

import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from 'firebase/auth';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp
} from 'firebase/firestore';
import { firebaseConfig, ADMIN_EMAIL } from './config.js';

// ---------- utilidades ----------
const $ = (s, root = document) => root.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const money = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR');
const fmtDate = (ts) => {
  if (!ts) return '';
  const fecha = ts?.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : null);
  return fecha && !isNaN(fecha)
    ? new Intl.DateTimeFormat('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      }).format(fecha)
    : String(ts);
};

const icons = {
  plane: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9L2 14v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>`,
  hotel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
};
const iconFor = (tipo) => String(tipo).toLowerCase().includes('hotel') ? icons.hotel
  : String(tipo).toLowerCase().includes('paquete') ? icons.box : icons.plane;

// ---------- datos de respaldo (solo si Firestore no está disponible) ----------
const DEMO_PRODUCTOS = [
  { id:'AR2451', codigo:'AR2451', tipo:'Vuelo', nombre:'Buenos Aires - Bariloche (Ida y Vuelta)', destino:'Bariloche, Río Negro', duracion:'2h 15min por trayecto', incluye:'Equipaje de mano 10kg, Equipaje bodega 23kg', precio:185000, activo:true },
  { id:'AR7823', codigo:'AR7823', tipo:'Vuelo', nombre:'Buenos Aires - Mendoza (Solo Ida)', destino:'Mendoza, Mendoza', duracion:'1h 50min', incluye:'Equipaje de mano 10kg', precio:395000, activo:true },
  { id:'HTL001', codigo:'HTL001', tipo:'Hotel', nombre:'Hotel Llao Llao - Suite Premium', destino:'Bariloche, Río Negro', duracion:'3 noches - 4 días', incluye:'Desayuno buffet, Wi-Fi, vista al lago', precio:420000, activo:true },
  { id:'HTL002', codigo:'HTL002', tipo:'Hotel', nombre:'Hotel Intercontinental - Mendoza', destino:'Mendoza, Mendoza', duracion:'2 noches', incluye:'Desayuno, pileta, gimnasio', precio:198000, activo:true },
  { id:'PKG001', codigo:'PKG001', tipo:'Paquete', nombre:'Patagonia Completa', destino:'Bariloche + Ushuaia', duracion:'7 días', incluye:'Vuelo + Hotel + Traslados', precio:890000, activo:true }
];
const demoItem = (p, cantidad) => ({
  servicioId: p.id, codigo: p.codigo, nombre: p.nombre, destino: p.destino,
  precio: p.precio, tipo: p.tipo, cantidad
});
const DEMO_PEDIDOS = [
  { id:'PED-DEMO-1', codigo:'1794955251554', usuarioId:'demo',
    items:[demoItem(DEMO_PRODUCTOS[2], 1), demoItem(DEMO_PRODUCTOS[0], 2)],
    total:790000, fecha:'2026-11-17T19:40:00-03:00', status:'pendiente' },
  { id:'PED-DEMO-2', codigo:'1794955300000', usuarioId:'demo',
    items:[demoItem(DEMO_PRODUCTOS[1], 1), demoItem(DEMO_PRODUCTOS[3], 1)],
    total:593000, fecha:'2026-11-17T20:00:00-03:00', status:'confirmado' }
];

// ---------- home público (promociones del prototipo original) ----------
const HOME_IMG = 'assets/img/';
const HOME_DESTINOS = [
  { nombre:'Bariloche', tag:'Patagonia', desde:185000, clase:'home-dest-bari', codigo:'AR2451', img:'bariloche.jpg' },
  { nombre:'Mendoza', tag:'Cuyo', desde:395000, clase:'home-dest-mza', codigo:'AR7823', img:'LUGARES-PARA-VISITAR-MENDOZA.png' },
  { nombre:'Salta', tag:'Norte', desde:128000, clase:'home-dest-salta', codigo:'AR3456', img:'salta.jpg' },
  { nombre:'Ushuaia', tag:'Tierra del Fuego', desde:210000, clase:'home-dest-ush', codigo:'AR5690', img:'Ushuaia.jpg' },
  { nombre:'Córdoba', tag:'Centro', desde:95000, clase:'home-dest-cba', codigo:'FO1120', img:'cordoba.jpg' },
  { nombre:'Mar del Plata', tag:'Costa', desde:78000, clase:'home-dest-mdp', codigo:'JS2030', img:'mar_de_plata.jpg' }
];
const HOME_RUTAS = { 'AR2451':'BUE → BRC', 'AR7823':'BUE → MDZ', 'AR3456':'BUE → SLA',
  'AR5690':'BUE → USH', 'FO1120':'BUE → COR', 'JS2030':'BUE → MDP',
  'HTL001':'Bariloche', 'HTL002':'Mendoza', 'PKG001':'Bariloche + Ushuaia' };
const HOME_ITEMS = [
  ...DEMO_PRODUCTOS.slice(0, 2),
  { ...DEMO_PRODUCTOS[2], precio: 320000, duracion: '2 noches' },
  ...DEMO_PRODUCTOS.slice(3)
];
const homeChip = (tipo) => tipo === 'Vuelo' ? { txt:'Disponible', c:'g' }
  : tipo === 'Hotel' ? { txt:'2 noches mín.', c:'a' } : { txt:'Más vendido', c:'g' };

// ---------- estado ----------
let auth, db;
const state = {
  user: null, perfil: null, productos: [], cart: [], pedidos: [],
  busqueda: '', filtroTipo: '', success: '', register: false,
  demo: false, firestoreOk: false,
  homeTab: 'vuelo', homeQuery: '', homeSlide: 0
};
const demoKey = (sufijo) => `skyclick_demo_${sufijo}_${state.user?.uid || 'anon'}`;
const demoLoad = (sufijo, fallback) => {
  try { return JSON.parse(localStorage.getItem(demoKey(sufijo))) ?? fallback; }
  catch { return fallback; }
};
const demoSave = (sufijo, valor) => localStorage.setItem(demoKey(sufijo), JSON.stringify(valor));

function activarDemo() {
  if (state.demo) return;
  state.demo = true;
  state.productos = DEMO_PRODUCTOS.map(p => ({ ...p }));
  state.cart = (demoLoad('cart', []) || []).map(normalizarItem);
  state.pedidos = demoLoad('pedidos', DEMO_PEDIDOS);
  render();
}
let unsubs = [];

// ---------- arranque ----------
const sinConfig = !firebaseConfig.apiKey || String(firebaseConfig.apiKey).includes('TU_');
if (sinConfig) {
  mostrarSetup();
} else {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    instalarEventos();
    // onAuthStateChanged dispara el primer render (también cuando no hay sesión)
    onAuthStateChanged(auth, alCambiarAuth);
  } catch (err) {
    console.error(err);
    mostrarSetup('Error al iniciar Firebase: ' + err.message);
  }
}

function mostrarSetup(extra = '') {
  $('#app').innerHTML = `
    <div class="setup"><div class="setup-card">
      <h2>⚙️ Falta conectar Firebase</h2>
      <p>Completá <code>js/config.js</code> con las claves de tu proyecto y publicá las reglas de <code>firestore.rules</code>.</p>
      ${extra ? `<p class="form-error">${esc(extra)}</p>` : ''}
    </div></div>`;
}

// ---------- ruteo simple ----------
const ir = (ruta) => { location.hash = '#/' + ruta; };
window.addEventListener('hashchange', render);
const rutaActual = () => (location.hash.replace(/^#\/?/, '') || (state.user ? 'catalogo' : 'home'));

// ============================================================
//  AUTH + SUSCRIPCIONES
// ============================================================
function alCambiarAuth(user) {
  unsubs.forEach(fn => fn());
  unsubs = [];
  state.user = user;

  if (!user) {
    state.perfil = null; state.productos = []; state.cart = []; state.pedidos = [];
    state.success = ''; state.demo = false; state.firestoreOk = false;
    if (!['home', 'login'].includes(rutaActual())) ir('home'); else render();
    return;
  }

  // Perfil provisorio: la UI no debe esperar a Firestore para aparecer.
  state.perfil = {
    nombre: user.email.split('@')[0],
    email: user.email,
    rol: user.email === ADMIN_EMAIL ? 'Admin' : 'Cliente'
  };
  escucharProductos();
  escucharCarrito(user.uid);
  escucharPedidos();

  // Si Firestore no responde (base no creada, reglas sin publicar, sin red),
  // mostramos la UI con datos locales para que el diseño se pueda revisar.
  setTimeout(() => {
    if (!state.firestoreOk && !state.demo) activarDemo();
  }, 6000);

  // El perfil real se carga en segundo plano (puede fallar si Firestore está offline).
  getDoc(doc(db, 'usuarios', user.uid)).then(snap => {
    if (!snap.exists()) return;
    state.perfil = snap.data();
    render();
  }).catch(e => console.warn('Perfil no leído:', e.message));

  if (['login', 'home'].includes(rutaActual())) ir('catalogo'); else render();
}

function escucharProductos() {
  unsubs.push(onSnapshot(collection(db, 'productos'), (snap) => {
    state.firestoreOk = true;
    state.productos = snap.docs.map(d => {
      const x = d.data();
      if (!x.codigo) return null; // ignora documentos del prototipo anterior
      return {
        id: d.id, codigo: x.codigo, tipo: x.tipo || 'Vuelo',
        nombre: x.nombre || '', destino: x.destino || '',
        duracion: x.duracion || '', incluye: x.incluye || '',
        precio: Number(x.precio) || 0, activo: x.activo !== false
      };
    }).filter(Boolean);
    if (rutaActual() === 'catalogo') pintarCatalogo();
    if (rutaActual() === 'admin') pintarTablaProductos();
  }, e => { console.warn('Firestore productos:', e.message); activarDemo(); }));
}

function escucharCarrito(uid) {
  unsubs.push(onSnapshot(doc(db, 'carritos', uid), (snap) => {
    state.cart = snap.exists() ? (snap.data().items || []).map(normalizarItem) : [];
    actualizarContador();
    if (rutaActual() === 'carrito') render();
  }, e => { if (!state.demo) console.warn('Firestore carrito:', e.message); }));
}

function escucharPedidos() {
  const esAdmin = state.perfil?.rol === 'Admin' || state.user?.email === ADMIN_EMAIL;
  const ref = esAdmin
    ? collection(db, 'pedidos')
    : query(collection(db, 'pedidos'), where('usuarioId', '==', state.user.uid));
  unsubs.push(onSnapshot(ref, (snap) => {
    state.pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.pedidos.sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0));
    if (rutaActual() === 'pedidos') render();
  }, e => { if (!state.demo) console.warn('Firestore pedidos:', e.message); }));
}

function normalizarItem(i) {
  const tipo = i.tipo || 'Vuelo';
  return {
    servicioId: i.servicioId || i.id || '',
    codigo: i.codigo || i.id || '',
    nombre: i.nombre || i.name || '',
    destino: i.destino || i.dest || '',
    precio: Number(i.precio ?? i.price) || 0,
    tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase(),
    cantidad: Number(i.cantidad) || 1
  };
}

// ============================================================
//  RENDER PRINCIPAL
// ============================================================
function render() {
  const ruta = rutaActual();
  if (!state.user && !['home', 'login'].includes(ruta)) { ir('home'); return; }
  if (state.user && ['home', 'login'].includes(ruta)) { ir('catalogo'); return; }

  const app = $('#app');
  if (!app) return;

  if (ruta === 'home') { app.innerHTML = homeView(); return; }
  if (ruta === 'login') { app.innerHTML = loginView(); return; }

  app.innerHTML = `
    ${header(ruta)}
    ${ruta === 'catalogo' ? toolbar() : ''}
    <main class="page">
      ${state.demo ? `<div class="demo-banner">${icons.info}<span><strong>Modo demostración:</strong> Firestore no está disponible. Los datos se guardan solo en este navegador hasta que crees la base de datos y publiques las reglas.</span></div>` : ''}
      ${ruta === 'catalogo' ? catalogoView() : ''}
      ${ruta === 'carrito' ? carritoView() : ''}
      ${ruta === 'pedidos' ? pedidosView() : ''}
      ${ruta === 'admin' ? adminView() : ''}
    </main>
    <div class="toast" id="toast">${icons.check}<span id="toast-text"></span></div>`;
  if (ruta === 'catalogo') pintarCatalogo();
  if (ruta === 'admin') pintarTablaProductos();
  actualizarContador();
}

function header(ruta) {
  const esAdmin = state.perfil?.rol === 'Admin' || state.user?.email === ADMIN_EMAIL;
  const nombre = state.perfil?.nombre || state.user?.email || '';
  const navItem = (r, label, icon, extra = '') => `
    <a class="nav-link ${ruta === r ? 'active' : ''}" data-action="nav" data-route="${r}" href="#/${r}">
      ${icon}<span>${label}</span>${extra}
    </a>`;
  return `
    <header class="header"><div class="header-inner">
      <div class="logo">Sky<span>Click</span></div>
      <nav class="nav">
        ${navItem('catalogo', 'Catálogo', icons.list)}
        ${navItem('carrito', 'Carrito', icons.cart, `<span class="count" id="cart-count">${totalUnidades()}</span>`)}
        ${navItem('pedidos', 'Mis Pedidos', icons.box)}
        ${esAdmin ? navItem('admin', 'Administración', icons.grid) : ''}
      </nav>
      <div class="header-right">
        <div class="user-block"><strong>${esc(nombre)}</strong><small>${esc(state.perfil?.rol || 'Cliente')}</small></div>
        <button class="btn-logout" data-action="logout">Salir</button>
      </div>
    </div></header>`;
}

function toolbar() {
  return `
    <div class="toolbar"><div class="toolbar-inner">
      <div class="search-wrap">${icons.search}
        <input id="buscar" type="text" value="${esc(state.busqueda)}"
               placeholder="Buscar por código, descripción o destino...">
      </div>
      <select id="filtro-tipo">
        <option value="" ${state.filtroTipo === '' ? 'selected' : ''}>Todos los servicios</option>
        <option value="Vuelo" ${state.filtroTipo === 'Vuelo' ? 'selected' : ''}>Vuelos</option>
        <option value="Hotel" ${state.filtroTipo === 'Hotel' ? 'selected' : ''}>Hoteles</option>
        <option value="Paquete" ${state.filtroTipo === 'Paquete' ? 'selected' : ''}>Paquetes</option>
      </select>
    </div></div>`;
}

// ---------- Home público ----------
function homeView() {
  const tab = state.homeTab;
  const tabs = [
    { id:'vuelo', label:'Vuelos', icon:icons.plane },
    { id:'hotel', label:'Hoteles', icon:icons.hotel },
    { id:'paquete', label:'Paquetes', icon:icons.box }
  ];
  const esVuelo = tab === 'vuelo';
  const tipoProducto = tab === 'vuelo' ? 'Vuelo' : tab === 'hotel' ? 'Hotel' : 'Paquete';
  const productos = HOME_ITEMS.filter(p => p.tipo === tipoProducto);
  const cardProducto = (p) => {
    const chip = homeChip(p.tipo);
    return `
      <article class="home-prod-card">
        <div class="home-prod-head">
          <div class="home-prod-ic ${p.tipo === 'Vuelo' ? 'v' : p.tipo === 'Hotel' ? 'h' : 'p'}">${iconFor(p.tipo)}</div>
          <div><h3>${esc(p.codigo)}</h3><p>${esc(p.tipo)} · ${esc(p.destino)}</p></div>
        </div>
        <div class="home-prod-mid">
          <div class="home-prod-route"><strong>${esc(HOME_RUTAS[p.codigo] || p.destino)}</strong>${esc(p.nombre)}</div>
          <span class="home-chip ${chip.c}">${chip.txt}</span>
        </div>
        <div class="home-prod-bot">
          <div class="home-prod-price">${money(p.precio)}<small>por persona / noche</small></div>
          <button class="home-btn-add" data-action="home-add" data-codigo="${esc(p.codigo)}">+ Agregar</button>
        </div>
      </article>`;
  };

  return `
  <div class="home">
    <nav class="home-nav">
      <div class="home-logo">Sky<span>Click</span></div>
      <div class="home-nav-links">
        <button data-action="home-scroll" data-target="home-top">${icons.hotel}<span>Inicio</span></button>
        <button data-action="home-scroll" data-target="home-vuelos">${icons.plane}<span>Vuelos</span></button>
        <button data-action="home-scroll" data-target="home-hoteles">${icons.hotel}<span>Hoteles</span></button>
        <button data-action="home-scroll" data-target="home-paquetes">${icons.box}<span>Paquetes</span></button>
      </div>
      <div class="home-nav-actions">
        <button class="home-btn-ghost" data-action="home-login">Crear cuenta</button>
        <button class="home-btn-login" data-action="home-login">Iniciar sesión</button>
      </div>
    </nav>

    <header class="home-hero" id="home-top">
      <div class="home-hero-inner">
        <h1>¿A dónde querés viajar?</h1>
        <p>Encontrá los mejores vuelos, hoteles y paquetes para tu próxima aventura</p>
        <div class="home-tabs">
          ${tabs.map(t => `<button class="home-tab ${tab === t.id ? 'active' : ''}" data-action="home-tab" data-tab="${t.id}">${t.icon}${t.label}</button>`).join('')}
        </div>
        <div class="home-search-box">
          ${esVuelo ? `<div class="home-field"><label>Origen</label><input id="home-origen" type="text" placeholder="Buenos Aires (BUE)"></div>` : ''}
          <div class="home-field"><label>Destino</label><input id="home-destino" type="text" placeholder="¿A dónde vas?" value="${esc(state.homeQuery)}"></div>
          <div class="home-field" style="max-width:140px"><label id="home-l1">${esVuelo ? 'Fecha de ida' : 'Entrada'}</label><input id="home-f1" type="date"></div>
          <div class="home-field" style="max-width:140px"><label id="home-l2">${esVuelo ? 'Fecha de vuelta' : 'Salida'}</label><input id="home-f2" type="date"></div>
          <div class="home-field" style="max-width:120px"><label id="home-lp">${esVuelo ? 'Pasajeros' : 'Huéspedes'}</label>
            <select id="home-pax">${esVuelo
              ? '<option>1 adulto</option><option>2 adultos</option><option>3 adultos</option><option>Familia</option>'
              : '<option>1 huésped</option><option>2 huéspedes</option><option>3 huéspedes</option>'}</select>
          </div>
          <button class="home-btn-search" data-action="home-search">${icons.search} Buscar</button>
        </div>
        <div class="home-results" id="home-results">
          <div class="home-results-title" id="home-results-title"></div>
          <div id="home-results-list"></div>
        </div>
      </div>
    </header>

    <main class="home-main">
      <section class="home-section">
        <div class="home-promo">
          <div class="home-promo-left">
            <div class="home-promo-num">12</div>
            <div class="home-promo-txt"><h3>Cuotas<br>Cero Interés</h3><p>En vuelos nacionales con NX Crédito</p></div>
            <span class="home-badge-pill">NX Crédito</span>
          </div>
          <div class="home-airlines">
            <span class="home-airline">Aerolíneas Argentinas</span>
            <span class="home-airline">JetSMART</span>
            <span class="home-airline">Flybondi</span>
          </div>
        </div>
      </section>

      <section class="home-section">
        <div class="home-sec-head"><h2>Destinos populares</h2>
          <div class="home-carousel-nav">
            <button class="home-arrow" data-action="home-slide" data-dir="-1" aria-label="Anterior">‹</button>
            <button class="home-arrow" data-action="home-slide" data-dir="1" aria-label="Siguiente">›</button>
          </div></div>
        <div class="home-carousel">
          <div class="home-dest-grid" id="home-dest-track">
            ${HOME_DESTINOS.map((d, i) => `
            <article class="home-dest-card ${i === state.homeSlide ? 'is-active' : ''}">
              <div class="home-dest-img ${d.clase}" ${d.img ? `style="background-image:url('${HOME_IMG}${d.img}')"` : ''}><span class="home-dest-tag">${esc(d.tag)}</span></div>
              <div class="home-dest-info">
                <h3>${esc(d.nombre)}</h3>
                <p>Desde <strong>${money(d.desde)}</strong></p>
                <button class="home-dest-btn" data-action="home-add" data-codigo="${esc(d.codigo)}">+ Agregar vuelo</button>
              </div>
            </article>`).join('')}
          </div>
        </div>
        <div class="home-dots">
          ${HOME_DESTINOS.map((d, i) => `<button class="home-dot ${i === state.homeSlide ? 'active' : ''}" data-action="home-slide-to" data-index="${i}" aria-label="Ir a ${esc(d.nombre)}"></button>`).join('')}
        </div>
      </section>

      <section class="home-section" id="home-vuelos">
        <div class="home-sec-head"><h2>✈️ Vuelos disponibles</h2></div>
        <div class="home-prod-grid">${HOME_ITEMS.filter(p => p.tipo === 'Vuelo').map(cardProducto).join('')}</div>
      </section>

      <section class="home-section" id="home-hoteles">
        <div class="home-sec-head"><h2>🏨 Hoteles disponibles</h2></div>
        <div class="home-prod-grid">${HOME_ITEMS.filter(p => p.tipo === 'Hotel').map(cardProducto).join('')}</div>
      </section>

      <section class="home-section" id="home-paquetes">
        <div class="home-sec-head"><h2>📦 Paquetes todo incluido</h2></div>
        <div class="home-prod-grid">${HOME_ITEMS.filter(p => p.tipo === 'Paquete').map(cardProducto).join('')}</div>
      </section>

      <section class="home-section" id="home-cashback">
        <div class="home-cashback">
          <div>
            <h3>Activá tu plan y ahorrá hasta 30% OFF</h3>
            <p>Reintegros de hasta $50.000 en cada compra con Plan Turbo o Plan Épico</p>
          </div>
          <button class="home-btn-white" data-action="home-login">Ver planes disponibles</button>
        </div>
      </section>
    </main>

    <div class="home-footer"><strong>SkyClick</strong> · Tu agencia de viajes · Tus viajes empiezan acá</div>
    <button class="home-fab" data-action="home-login">${icons.cart} Iniciar sesión para comprar</button>
    <div class="toast" id="toast"><span id="toast-text"></span></div>
  </div>`;
}

function pintarCarrusel() {
  const track = document.getElementById('home-dest-track');
  if (!track) return;
  const cards = [...track.querySelectorAll('.home-dest-card')];
  cards.forEach((c, i) => c.classList.toggle('is-active', i === state.homeSlide));
  document.querySelectorAll('.home-dot').forEach((d, i) => d.classList.toggle('active', i === state.homeSlide));
  const activa = cards[state.homeSlide];
  if (activa && track) {
    const izq = activa.offsetLeft - (track.parentElement.clientWidth - activa.clientWidth) / 2;
    track.parentElement.scrollTo({ left: Math.max(0, izq), behavior: 'smooth' });
  }
}

function buscarHome() {
  const q = (state.homeQuery || '').trim().toLowerCase();
  const label = { vuelo:'Vuelos', hotel:'Hoteles', paquete:'Paquetes' }[state.homeTab];
  const tipo = { vuelo:'Vuelo', hotel:'Hotel', paquete:'Paquete' }[state.homeTab];
  const resultados = HOME_ITEMS.filter(p => p.tipo === tipo &&
    (!q || [p.codigo, p.nombre, p.destino, HOME_RUTAS[p.codigo]].join(' ').toLowerCase().includes(q)));
  const titulo = $('#home-results-title');
  const lista = $('#home-results-list');
  const box = $('#home-results');
  if (!titulo || !lista || !box) return;
  titulo.textContent = `${resultados.length} ${label} encontrado${resultados.length !== 1 ? 's' : ''}${q ? ' para "' + q + '"' : ''}`;
  lista.innerHTML = resultados.length ? resultados.map(p => `
    <div class="home-result">
      <div class="home-result-info">
        <div class="home-result-ic ${p.tipo === 'Vuelo' ? 'v' : p.tipo === 'Hotel' ? 'h' : 'p'}">${iconFor(p.tipo)}</div>
        <div><div class="home-result-name">${esc(p.codigo)} – ${esc(HOME_RUTAS[p.codigo] || p.destino)}</div>
             <div class="home-result-sub">${esc(p.destino)} · ${esc(p.tipo)}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="home-result-price">${money(p.precio)}<small>por persona</small></div>
        <button class="home-btn-add" data-action="home-add" data-codigo="${esc(p.codigo)}">+ Agregar</button>
      </div>
    </div>`).join('')
    : '<div style="padding:1rem;color:var(--h-muted);font-size:14px">No se encontraron resultados para ese destino.</div>';
  box.classList.add('show');
  box.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// ---------- Login ----------
function loginView() {
  if (state.register) {
    return `
      <div class="login-wrap"><div class="login-card">
        <div class="login-icon">${icons.plane}</div>
        <h1>Crear Cuenta Nueva</h1>
        <p class="subtitle">SkyClick – Tu agencia de viajes</p>
        <form id="register-form">
          <div class="field-group"><label>Nombre completo</label><input name="nombre" required placeholder="Tu nombre"></div>
          <div class="field-group"><label>Correo Electrónico</label><input name="email" type="email" required placeholder="usuario@ejemplo.com"></div>
          <div class="field-group"><label>Contraseña</label><input name="password" type="password" required minlength="6" placeholder="••••••••"></div>
          <div class="form-error" id="form-error"></div>
          <button type="submit" class="btn btn-primary btn-block">Crear Cuenta</button>
        </form>
        <button class="link-btn" data-action="show-login">Volver a Iniciar Sesión</button>
      </div></div>`;
  }
  return `
    <div class="login-wrap"><div class="login-card">
      <div class="login-icon">${icons.plane}</div>
      <h1>SkyClick</h1>
      <p class="subtitle">Tu agencia de viajes</p>
      <form id="login-form">
        <div class="field-group">
          <label>Correo Electrónico</label>
          <input name="email" type="email" required placeholder="usuario@ejemplo.com" value="pasajero@viajes.com">
        </div>
        <div class="field-group">
          <label>Contraseña</label>
          <input name="password" type="password" required placeholder="••••••••" value="pass123">
        </div>
        <div class="info-box">${icons.info}<div>
          <b>Usuarios de demostración:</b>
          <p><strong>Cliente:</strong> pasajero@viajes.com / pass123<br>
             <strong>Admin:</strong> admin@viajes.com / admin123</p>
        </div></div>
        <div class="form-error" id="form-error"></div>
        <button type="submit" class="btn btn-primary btn-block">Iniciar Sesión</button>
      </form>
      <button class="link-btn" data-action="show-register">Crear Cuenta Nueva</button>
      <button class="link-btn" data-action="nav" data-route="home" style="margin-top:6px">← Volver al inicio</button>
    </div></div>`;
}

// ---------- Catálogo ----------
function catalogoView() {
  return `
    <div class="page-head">
      <h1>Catálogo de Servicios</h1>
      <p>Explorá nuestros vuelos, hoteles y paquetes turísticos</p>
    </div>
    <div class="grid-2" id="servicios-grid"></div>`;
}

function pintarCatalogo() {
  const grid = $('#servicios-grid');
  if (!grid) return;
  const q = state.busqueda.trim().toLowerCase();
  const lista = state.productos.filter(p => {
    const tipoOk = !state.filtroTipo || p.tipo === state.filtroTipo;
    const texto = [p.codigo, p.nombre, p.destino, p.duracion, p.incluye].join(' ').toLowerCase();
    return tipoOk && (!q || texto.includes(q));
  });
  if (!lista.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">No se encontraron servicios con esos criterios.</div>`;
    return;
  }
  grid.innerHTML = lista.map(p => {
    const enCarrito = state.cart.some(i => i.servicioId === p.id);
    return `
      <article class="service-card">
        <div class="service-top">
          <span class="badge">${esc(p.codigo)}</span>
          <span class="badge badge-tipo">${esc(p.tipo)}</span>
        </div>
        <div class="service-title">${esc(p.nombre)}</div>
        <div class="meta-grid">
          <div><div class="meta-label">Destino:</div><div class="meta-value">${esc(p.destino)}</div></div>
          <div><div class="meta-label">Duración:</div><div class="meta-value">${esc(p.duracion)}</div></div>
          ${p.incluye ? `<div class="full"><div class="meta-label">Incluye:</div><div class="meta-value">${esc(p.incluye)}</div></div>` : ''}
        </div>
        <div class="service-bottom">
          <div><div class="price-label">Precio</div><div class="price-value">${money(p.precio)}</div></div>
          <button class="btn ${enCarrito ? 'btn-secondary' : 'btn-primary'}" data-action="add" data-id="${esc(p.codigo)}"
                  ${enCarrito ? 'disabled' : ''}>${enCarrito ? '✓ Agregado' : 'Agregar al Carrito'}</button>
        </div>
      </article>`;
  }).join('');
}

// ---------- Carrito ----------
function carritoView() {
  const items = state.cart;
  const unidades = totalUnidades();
  const subtotal = totalCarrito();
  return `
    <div class="page-head">
      <h1>Carrito de Compras</h1>
      <p>Revisá y confirmá tus servicios seleccionados</p>
    </div>
    <div class="cart-layout">
      <div class="cart-list">
        ${items.length ? items.map(i => `
          <article class="cart-item">
            <div class="icon-box ${i.tipo === 'Hotel' ? 'hotel' : ''}">${iconFor(i.tipo)}</div>
            <div class="item-body">
              <div class="item-code">${esc(i.codigo)}</div>
              <div class="item-title">${esc(i.nombre)}</div>
              <div class="item-dest">${esc(i.destino)}</div>
              <div class="qty">
                <button data-action="qty-dec" data-id="${esc(i.servicioId)}" title="Quitar uno">−</button>
                <span>${i.cantidad}</span>
                <button data-action="qty-inc" data-id="${esc(i.servicioId)}" title="Agregar uno">+</button>
              </div>
            </div>
            <div class="item-right">
              <div><div class="subtotal-label">Subtotal</div>
                   <div class="subtotal-value">${money(i.precio * i.cantidad)}</div></div>
              <button class="btn-remove" data-action="remove-item" data-id="${esc(i.servicioId)}">Eliminar</button>
            </div>
          </article>`).join('')
        : `<div class="empty">Tu carrito está vacío. Agregá servicios desde el catálogo.</div>`}
      </div>
      <aside class="summary-card">
        <h2>Resumen del Pedido</h2>
        <div class="summary-row"><span>Cantidad de items:</span><span>${unidades}</span></div>
        <div class="summary-row"><span>Subtotal:</span><span>${money(subtotal)}</span></div>
        <div class="summary-total"><span>Total:</span><span>${money(subtotal)}</span></div>
        <div class="summary-actions">
          <button class="btn btn-primary btn-block" data-action="confirm-order" ${items.length ? '' : 'disabled'}>Confirmar Pedido</button>
          <button class="btn btn-secondary btn-block" data-action="nav" data-route="catalogo">Seguir Comprando</button>
        </div>
      </aside>
    </div>`;
}

// ---------- Pedidos ----------
function pedidosView() {
  const esAdmin = state.perfil?.rol === 'Admin' || state.user?.email === ADMIN_EMAIL;
  return `
    ${state.success ? `<div class="success-banner">${icons.check}<span>${esc(state.success)}</span>
      <button class="btn-remove" data-action="clear-success" style="margin:0 0 0 auto">×</button></div>` : ''}
    <div class="page-head">
      <h1>Mis Pedidos</h1>
      <p>Gestiona tus pedidos pendientes</p>
    </div>
    ${state.pedidos.length ? state.pedidos.map(p => {
      const st = p.status || p.estado || 'pendiente';
      return `
      <article class="order-card">
        <div class="order-head">
          <span class="order-num">Pedido #${esc(p.codigo || p.id)}</span>
          <span class="status ${esc(st)}">${esc(st.charAt(0).toUpperCase() + st.slice(1))}</span>
          <span class="order-date">${esc(fmtDate(p.fecha))}</span>
        </div>
        ${(p.items || []).map(i => `
          <div class="order-item">
            <div class="icon-box ${String(i.tipo).toLowerCase().includes('hotel') ? 'hotel' : ''}">${iconFor(i.tipo)}</div>
            <div class="item-body">
              <div class="item-code">${esc(i.codigo || '')}</div>
              <div class="item-title">${esc(i.nombre || '')}</div>
              <div class="item-dest">${esc(i.destino || '')} ${i.cantidad > 1 ? '· Cantidad: ' + i.cantidad : ''}</div>
            </div>
            <div class="item-right">
              <div class="subtotal-label">Subtotal</div>
              <div class="subtotal-value">${money((Number(i.precio) || 0) * (Number(i.cantidad) || 1))}</div>
            </div>
          </div>`).join('')}
        <div class="order-total"><span>Total del Pedido:</span><span>${money(p.total)}</span></div>
        ${st === 'pendiente' ? `<div class="order-actions">
          ${esAdmin ? `<button class="btn btn-primary btn-sm" data-action="confirm-order-admin" data-id="${esc(p.id)}">Confirmar</button>` : ''}
          <button class="btn btn-danger btn-sm" data-action="cancel-order" data-id="${esc(p.id)}">Eliminar</button>
        </div>` : ''}
      </article>`;
    }).join('') : `<div class="empty">No tenés pedidos pendientes aún. ¡Empezá a armar tu viaje!</div>`}`;
}

// ---------- Admin (extra, mismo estilo) ----------
function adminView() {
  return `
    <div class="page-head"><h1>Administración</h1><p>Carga de servicios y control de pedidos</p></div>
    <div class="admin-card">
      <h2>Cargar Nuevo Producto</h2>
      <form id="product-form">
        <div class="form-grid">
          <div class="field-group"><label>Código *</label><input name="codigo" required placeholder="Ej: AR2451, HTL001"></div>
          <div class="field-group"><label>Tipo de Servicio *</label><select name="tipo" required>
            <option value="Vuelo">Vuelo</option><option value="Hotel">Hotel</option><option value="Paquete">Paquete</option>
          </select></div>
          <div class="field-group full"><label>Descripción *</label><input name="nombre" required placeholder="Ej: Buenos Aires - Bariloche (Ida y Vuelta)"></div>
          <div class="field-group"><label>Destino</label><input name="destino" placeholder="Ej: Bariloche, Río Negro"></div>
          <div class="field-group"><label>Duración</label><input name="duracion" placeholder="Ej: 2h 15min por trayecto"></div>
          <div class="field-group full"><label>Incluye</label><textarea name="incluye" placeholder="Ej: Equipaje de mano 10kg, Equipaje bodega 23kg"></textarea></div>
          <div class="field-group"><label>Precio (ARS) *</label><input name="precio" type="number" min="0" required placeholder="185000"></div>
        </div>
        <div class="form-error" id="form-error"></div>
        <div class="admin-actions"><button type="submit" class="btn btn-primary">Agregar Producto</button></div>
      </form>
    </div>
    <div class="admin-card"><h2>Servicios cargados</h2><div id="tabla-productos"></div></div>`;
}

function pintarTablaProductos() {
  const el = $('#tabla-productos');
  if (!el) return;
  el.innerHTML = state.productos.length ? `
    <table class="simple-table">
      <thead><tr><th>Código</th><th>Tipo</th><th>Descripción</th><th style="text-align:right">Precio</th><th></th></tr></thead>
      <tbody>${state.productos.map(p => `<tr>
        <td><span class="badge">${esc(p.codigo)}</span></td>
        <td>${esc(p.tipo)}</td><td>${esc(p.nombre)}</td>
        <td style="text-align:right">${money(p.precio)}</td>
        <td style="text-align:right"><button class="btn-remove" data-action="delete-product" data-id="${esc(p.id)}">Eliminar</button></td>
      </tr>`).join('')}</tbody>
    </table>` : '<div class="empty">Todavía no hay servicios cargados.</div>';
}

// ============================================================
//  ACCIONES
// ============================================================
const totalUnidades = () => state.cart.reduce((s, i) => s + (Number(i.cantidad) || 1), 0);
const totalCarrito = () => state.cart.reduce((s, i) => s + (Number(i.precio) || 0) * (Number(i.cantidad) || 1), 0);

function actualizarContador() {
  const c = $('#cart-count');
  if (c) c.textContent = totalUnidades();
}

function toast(msg) {
  const t = $('#toast');
  if (!t) { console.log('[toast]', msg); return; }
  $('#toast-text').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

async function addToCart(codigo) {
  const p = state.productos.find(x => x.codigo === codigo);
  if (!p || !state.user) return;
  if (state.cart.some(i => i.servicioId === p.id)) { toast('Ya está en el carrito'); return; }
  const item = {
    servicioId: p.id, codigo: p.codigo, nombre: p.nombre, destino: p.destino,
    precio: p.precio, tipo: p.tipo, cantidad: 1
  };
  if (state.demo) {
    state.cart = [...state.cart, item];
    demoSave('cart', state.cart);
    render();
    toast(`${p.codigo} agregado al carrito`);
    return;
  }
  try {
    await setDoc(doc(db, 'carritos', state.user.uid), { items: [...state.cart, item] });
    toast(`${p.codigo} agregado al carrito`);
  } catch (e) { toast('No se pudo agregar: ' + e.message); }
}

async function changeQty(servicioId, delta) {
  const items = state.cart.map(i => i.servicioId === servicioId
    ? { ...i, cantidad: Math.max(1, (Number(i.cantidad) || 1) + delta) } : i);
  if (state.demo) { state.cart = items; demoSave('cart', items); render(); return; }
  try { await setDoc(doc(db, 'carritos', state.user.uid), { items }); }
  catch (e) { toast('No se pudo actualizar: ' + e.message); }
}

async function removeItem(servicioId) {
  const items = state.cart.filter(i => i.servicioId !== servicioId);
  if (state.demo) { state.cart = items; demoSave('cart', items); render(); return; }
  try { await setDoc(doc(db, 'carritos', state.user.uid), { items }); }
  catch (e) { toast('No se pudo quitar: ' + e.message); }
}

async function confirmarCompra() {
  if (!state.cart.length || !state.user) return;
  const total = totalCarrito();
  const items = state.cart.map(i => ({ ...i }));
  if (state.demo) {
    const pedido = {
      id: 'DEMO-' + Date.now(), codigo: String(Date.now()),
      usuarioId: state.user.uid, usuarioNombre: state.perfil?.nombre || state.user.email,
      items, total, fecha: new Date().toISOString(), status: 'pendiente'
    };
    state.pedidos = [pedido, ...state.pedidos];
    demoSave('pedidos', state.pedidos);
    state.cart = [];
    demoSave('cart', state.cart);
    state.success = 'Pedido realizado exitosamente';
    ir('pedidos');
    render();
    return;
  }
  try {
    await addDoc(collection(db, 'pedidos'), {
      codigo: String(Date.now()),
      usuarioId: state.user.uid,
      usuarioNombre: state.perfil?.nombre || state.user.email,
      items, total,
      fecha: serverTimestamp(),
      status: 'pendiente'
    });
    await setDoc(doc(db, 'carritos', state.user.uid), { items: [] });
    state.success = 'Pedido realizado exitosamente';
    ir('pedidos');
    render();
  } catch (e) { toast('No se pudo confirmar: ' + e.message); }
}

// ---------- eventos delegados ----------
function instalarEventos() {
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'nav') { e.preventDefault(); ir(el.dataset.route); }
    else if (a === 'home-login') { ir('login'); }
    else if (a === 'home-add') { toast('Iniciá sesión para agregar al carrito'); ir('login'); }
    else if (a === 'home-tab') { state.homeTab = el.dataset.tab; render(); }
    else if (a === 'home-slide') {
      state.homeSlide = (state.homeSlide + Number(el.dataset.dir) + HOME_DESTINOS.length) % HOME_DESTINOS.length;
      pintarCarrusel();
    }
    else if (a === 'home-slide-to') { state.homeSlide = Number(el.dataset.index); pintarCarrusel(); }
    else if (a === 'home-search') {
      state.homeQuery = $('#home-destino')?.value || '';
      buscarHome();
    }
    else if (a === 'home-scroll') {
      const destino = document.getElementById(el.dataset.target);
      destino?.scrollIntoView({ behavior:'smooth', block:'start' });
    }
    else if (a === 'logout') { await signOut(auth); }
    else if (a === 'add') await addToCart(el.dataset.id);
    else if (a === 'qty-inc') await changeQty(el.dataset.id, 1);
    else if (a === 'qty-dec') await changeQty(el.dataset.id, -1);
    else if (a === 'remove-item') await removeItem(el.dataset.id);
    else if (a === 'confirm-order') await confirmarCompra();
    else if (a === 'clear-success') { state.success = ''; render(); }
    else if (a === 'confirm-order-admin') {
      if (state.demo) {
        state.pedidos = state.pedidos.map(p => p.id === el.dataset.id ? { ...p, status: 'confirmado' } : p);
        demoSave('pedidos', state.pedidos); render(); toast('Pedido confirmado'); return;
      }
      try { await updateDoc(doc(db, 'pedidos', el.dataset.id), { status: 'confirmado' }); toast('Pedido confirmado'); }
      catch (err) { toast('No se pudo confirmar: ' + err.message); }
    } else if (a === 'cancel-order') {
      if (state.demo) {
        state.pedidos = state.pedidos.filter(p => p.id !== el.dataset.id);
        demoSave('pedidos', state.pedidos); render(); toast('Pedido eliminado'); return;
      }
      try { await deleteDoc(doc(db, 'pedidos', el.dataset.id)); toast('Pedido eliminado'); }
      catch (err) { toast('No se pudo eliminar: ' + err.message); }
    } else if (a === 'delete-product') {
      if (state.demo) {
        state.productos = state.productos.filter(p => p.id !== el.dataset.id);
        render(); toast('Producto eliminado'); return;
      }
      try { await deleteDoc(doc(db, 'productos', el.dataset.id)); toast('Producto eliminado'); }
      catch (err) { toast('No se pudo eliminar: ' + err.message); }
    } else if (a === 'show-register') { state.register = true; render(); }
    else if (a === 'show-login') { state.register = false; render(); }
  });

  document.addEventListener('submit', async (e) => {
    const form = e.target;
    const errEl = () => $('#form-error');
    if (form.id === 'login-form') {
      e.preventDefault();
      try {
        await signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
      } catch (err) {
        errEl().textContent = err.code === 'auth/invalid-credential'
          ? 'Correo o contraseña incorrectos.' : err.message;
      }
    } else if (form.id === 'register-form') {
      e.preventDefault();
      const email = form.email.value.trim();
      if (email === ADMIN_EMAIL) { errEl().textContent = 'Ese correo está reservado.'; return; }
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, form.password.value);
        await setDoc(doc(db, 'usuarios', cred.user.uid), {
          nombre: form.nombre.value.trim(), email, rol: 'Cliente', creadoEn: serverTimestamp()
        });
      } catch (err) { errEl().textContent = err.message; }
    } else if (form.id === 'product-form') {
      e.preventDefault();
      const data = {
        codigo: form.codigo.value.trim(), tipo: form.tipo.value,
        nombre: form.nombre.value.trim(), destino: form.destino.value.trim(),
        duracion: form.duracion.value.trim(), incluye: form.incluye.value.trim(),
        precio: Number(form.precio.value) || 0, activo: true
      };
      if (state.demo) {
        state.productos = [...state.productos, { id: data.codigo, ...data }];
        render(); form.reset(); toast('Producto agregado'); return;
      }
      try {
        await setDoc(doc(db, 'productos', data.codigo), data);
        form.reset();
        toast('Producto agregado');
      } catch (err) { errEl().textContent = err.message; }
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'buscar') { state.busqueda = e.target.value; pintarCatalogo(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'filtro-tipo') { state.filtroTipo = e.target.value; pintarCatalogo(); }
  });
}
