// ============================================================
//  AGENCIA VIAJES PREMIUM — CAPA DE DATOS CON FIREBASE
//  Firestore + Authentication. Tu Index.html se mantiene igual;
//  acá solo cambian los datos hardcodeados por datos reales.
// ============================================================

import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from 'firebase/auth';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp
} from 'firebase/firestore';
import { firebaseConfig, ADMIN_EMAIL } from './config.js';

// ---------- helpers ----------
const $  = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const money = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

const IC = {
  vuelo:`<svg viewBox="0 0 24 24" fill="none" stroke="#1D9E75" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
  hotel:`<svg viewBox="0 0 24 24" fill="none" stroke="#D85A30" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
  paquete:`<svg viewBox="0 0 24 24" fill="none" stroke="#185FA5" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 0-4 0v2"/></svg>`
};
const CLS = { vuelo: 'v', hotel: 'h', paquete: 'p' };
const LISTAS = { vuelo: 'lista-vuelos', hotel: 'lista-hoteles', paquete: 'lista-paquetes' };

// ---------- estado ----------
let auth, db;
let perfil = null;
let productos = [];
let cart = [];
let pedidos = [];
let currentTab = 'vuelo';
let editId = null;
let unsubs = [];
let listo = false;

// ============================================================
//  ARRANQUE
// ============================================================
const sinConfigurar = !firebaseConfig.apiKey ||
  String(firebaseConfig.apiKey).includes('TU_') ||
  String(firebaseConfig.projectId).includes('TU_');

if (sinConfigurar) {
  mostrarSetup();
} else {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    listo = true;
    onAuthStateChanged(auth, alCambiarAuth);
    instalarEventos();
  } catch (err) {
    console.error(err);
    mostrarSetup('Error al iniciar Firebase: ' + err.message);
  }
}

// ---------- panel de configuración ----------
function mostrarSetup(extra = '') {
  const panel = document.createElement('div');
  panel.className = 'fb-setup';
  panel.innerHTML = `
    <div class="fb-setup-card">
      <h2>⚙️ Falta conectar Firebase</h2>
      <p>Para activar la fase de datos seguí estos pasos:</p>
      <ol>
        <li>Creá un proyecto en <b>console.firebase.google.com</b>.</li>
        <li>Agregá una <b>app web</b> y copiá las claves.</li>
        <li>Pegalas en <code>Firebase/js/config.js</code>.</li>
        <li>Activá <b>Authentication → Sign-in method → Correo electrónico/contraseña</b>.</li>
        <li>Creá <b>Firestore Database</b> y pegá las reglas de <code>firestore.rules</code>.</li>
        <li>Probá <code>seed.html</code> para cargar los datos de ejemplo.</li>
      </ol>
      ${extra ? `<p class="fb-error">${esc(extra)}</p>` : ''}
    </div>`;
  document.body.appendChild(panel);
}

// ============================================================
//  AUTH + SUSCRIPCIONES
// ============================================================
async function alCambiarAuth(user) {
  unsubs.forEach(fn => fn());
  unsubs = [];

  if (!user) {
    perfil = null;
    productos = [];
    cart = [];
    pedidos = [];
    ['lista-vuelos', 'lista-hoteles', 'lista-paquetes'].forEach(id => {
      if ($(id)) $(id).innerHTML = '';
    });
    renderCart();
    renderPedidos();
    mostrarLogin();
    return;
  }

  ocultarLogin();

  // El rol vive en Firestore, no en el token de Auth.
  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    perfil = snap.exists()
      ? snap.data()
      : { nombre: user.email.split('@')[0], email: user.email, rol: 'Cliente' };
  } catch (err) {
    console.warn('No se pudo leer el perfil:', err);
    perfil = { nombre: user.email.split('@')[0], email: user.email, rol: 'Cliente' };
  }

  actualizarNav();
  escucharProductos();
  escucharCarrito(user.uid);

  if (perfil.rol === 'Admin' || user.email === ADMIN_EMAIL) {
    escucharTodosLosPedidos();
  } else {
    escucharMisPedidos(user.uid);
  }
}

function escucharProductos() {
  unsubs.push(onSnapshot(
    collection(db, 'productos'),
    (snap) => {
      productos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      pintarProductos();
    },
    (err) => showToast('Error al leer productos: ' + err.message)
  ));
}

function escucharCarrito(uid) {
  unsubs.push(onSnapshot(
    doc(db, 'carritos', uid),
    (snap) => {
      cart = snap.exists() ? (snap.data().items || []) : [];
      renderCart();
    },
    (err) => showToast('Error al leer el carrito: ' + err.message)
  ));
}

function escucharMisPedidos(uid) {
  unsubs.push(onSnapshot(
    query(collection(db, 'pedidos'), where('usuarioId', '==', uid)),
    (snap) => {
      pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      ordenarPedidos();
      renderPedidos();
    },
    (err) => showToast('Error al leer pedidos: ' + err.message)
  ));
}

function escucharTodosLosPedidos() {
  unsubs.push(onSnapshot(
    collection(db, 'pedidos'),
    (snap) => {
      pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      ordenarPedidos();
      renderPedidos();
    },
    (err) => showToast('Error al leer pedidos: ' + err.message)
  ));
}

function ordenarPedidos() {
  pedidos.sort((a, b) => {
    const fa = a.fecha?.toMillis?.() || a.fecha || 0;
    const fb = b.fecha?.toMillis?.() || b.fecha || 0;
    return fb - fa;
  });
}

// ============================================================
//  LOGIN (se agrega encima del diseño existente)
// ============================================================
function mostrarLogin() {
  let ov = $('fb-login');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'fb-login';
    ov.className = 'fb-login';
    ov.innerHTML = `
      <div class="fb-login-card">
        <div class="fb-logo">✈</div>
        <h1>SkyClick</h1>
        <p>Ingresá para buscar y reservar tus viajes</p>
        <form id="fb-login-form">
          <label>Correo electrónico</label>
          <input type="email" id="fb-email" placeholder="pasajero@viajes.com" value="pasajero@viajes.com" required>
          <label>Contraseña</label>
          <input type="password" id="fb-pass" placeholder="••••••••" value="pass123" required>
          <div class="fb-error" id="fb-login-error"></div>
          <button type="submit" class="fb-btn">Iniciar sesión</button>
        </form>
        <div class="fb-demo">
          <b>Usuarios de demostración</b><br>
          Cliente: pasajero@viajes.com / pass123<br>
          Admin: admin@viajes.com / admin123
        </div>
      </div>`;
    document.body.appendChild(ov);
  }
  ov.classList.add('show');
}

function ocultarLogin() {
  $('fb-login')?.classList.remove('show');
}

function actualizarNav() {
  const nav = document.querySelector('.nav-user');
  if (!nav) return;
  const nombre = perfil?.nombre || auth.currentUser.email;
  const iniciales = nombre.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  nav.innerHTML = `
    <div class="avatar">${esc(iniciales)}</div>
    <span>${esc(nombre)}</span>
    <small class="fb-rol">${esc(perfil?.rol || 'Cliente')}</small>
    <button class="fb-logout" onclick="cerrarSesion()" title="Cerrar sesión">Salir</button>`;
}

// ============================================================
//  PRODUCTOS (antes DB.vuelos / DB.hoteles / DB.paquetes)
// ============================================================
function pintarProductos() {
  Object.entries(LISTAS).forEach(([tipo, id]) => {
    const el = $(id);
    if (!el) return;
    const lista = productos.filter(p => p.tipo === tipo);
    el.innerHTML = lista.length ? lista.map(p => `
      <div class="prod-card">
        <div class="prod-head">
          <div class="prod-ic ${CLS[p.tipo] || 'v'}">${IC[p.tipo] || IC.vuelo}</div>
          <div><h3>${esc(p.name)}</h3><p>${esc(p.sub)}</p></div>
        </div>
        <div class="prod-mid">
          <div class="prod-route"><strong>${esc(p.route)}</strong>${esc(p.dest)}</div>
          <span class="chip ${esc(p.chipC || 'g')}">${esc(p.chip || '')}</span>
        </div>
        <div class="prod-bot">
          <div class="prod-price">${money(p.price)}<small>por persona / noche</small></div>
          <button class="btn-add" id="badd-${esc(p.id)}" onclick="addToCart('${esc(p.id)}')" ${enCarrito(p.id) ? 'disabled' : ''}>
            ${enCarrito(p.id) ? '✓ Agregado' : '+ Agregar'}
          </button>
        </div>
      </div>`).join('') : '<div class="empty-msg">No hay productos cargados en Firestore.</div>';
  });
}

const enCarrito = (id) => cart.some(c => c.id === id);

// ============================================================
//  CARRITO (antes un array en memoria → ahora doc en Firestore)
// ============================================================
window.addToCart = async (id) => {
  if (!auth?.currentUser) { showToast('Iniciá sesión para agregar productos'); return; }
  if (enCarrito(id)) { showToast('Ya está en tu carrito'); return; }
  const p = productos.find(x => x.id === id);
  if (!p) return;
  const item = {
    id: p.id, name: p.name, sub: p.sub, route: p.route || '', dest: p.dest || '',
    price: Number(p.price) || 0, tipo: p.tipo, chip: p.chip || '', chipC: p.chipC || 'g'
  };
  try {
    await setDoc(doc(db, 'carritos', auth.currentUser.uid), { items: [...cart, item] });
    bumpFab();
    showToast('✓ ' + p.name + ' agregado');
  } catch (err) { showToast('No se pudo agregar: ' + err.message); }
};

window.removeFromCart = async (id) => {
  if (!auth?.currentUser) return;
  const item = cart.find(c => c.id === id);
  try {
    await setDoc(doc(db, 'carritos', auth.currentUser.uid), {
      items: cart.filter(c => c.id !== id)
    });
    if (item) showToast(item.name + ' quitado del carrito');
  } catch (err) { showToast('No se pudo quitar: ' + err.message); }
};

function renderCart() {
  const n = cart.length;
  if ($('cart-count')) $('cart-count').textContent = n;
  const total = cart.reduce((s, i) => s + (Number(i.price) || 0), 0);
  if ($('cart-total-val')) $('cart-total-val').textContent = money(total);
  if ($('btn-comprar')) $('btn-comprar').disabled = n === 0;

  const el = $('cart-items');
  if (!el) return;
  if (!n) {
    el.innerHTML = '<div class="cart-empty">Tu carrito está vacío. Agregá productos para comenzar.</div>';
    return;
  }
  el.innerHTML = cart.map(i => `
    <div class="cart-item">
      <div class="ci-ic ${CLS[i.tipo] || 'v'}">${IC[i.tipo] || IC.vuelo}</div>
      <div class="ci-info">
        <div class="ci-name">${esc(i.name)}</div>
        <div class="ci-sub">${esc(i.sub)}</div>
        <div class="ci-price">${money(i.price)}</div>
      </div>
      <button class="btn-rm" onclick="removeFromCart('${esc(i.id)}')" title="Quitar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>`).join('');
}

window.toggleCart = () => {
  $('cart-panel')?.classList.toggle('open');
  $('overlay')?.classList.toggle('show');
};

function bumpFab() {
  const f = $('cart-fab');
  if (!f) return;
  f.classList.add('bump');
  setTimeout(() => f.classList.remove('bump'), 220);
}

// ============================================================
//  PEDIDOS (antes pedidos = [] → ahora collection 'pedidos')
// ============================================================
window.confirmarCompra = async () => {
  if (!cart.length || !auth?.currentUser) return;
  const codigo = 'PED-' + Date.now().toString().slice(-6);
  const total = cart.reduce((s, i) => s + (Number(i.price) || 0), 0);
  const items = cart.map(i => ({
    id: i.id, name: i.name, sub: i.sub || '', route: i.route || '', dest: i.dest || '',
    price: Number(i.price) || 0, tipo: i.tipo || 'vuelo', chip: i.chip || '', chipC: i.chipC || 'g'
  }));
  try {
    await addDoc(collection(db, 'pedidos'), {
      codigo,
      usuarioId: auth.currentUser.uid,
      usuarioNombre: perfil?.nombre || auth.currentUser.email,
      items,
      total,
      fecha: serverTimestamp(),
      status: 'pendiente'
    });
    await setDoc(doc(db, 'carritos', auth.currentUser.uid), { items: [] });
    window.toggleCart();
    showToast('🎉 Pedido ' + codigo + ' registrado con éxito');
    setTimeout(() => window.ir('sec-pedidos'), 600);
  } catch (err) { showToast('No se pudo confirmar: ' + err.message); }
};

function renderPedidos() {
  const el = $('pedidos-list');
  if (!el) return;
  if (!pedidos.length) {
    el.innerHTML = '<div class="empty-msg">No tenés pedidos pendientes aún. ¡Empezá a armar tu viaje!</div>';
    return;
  }
  const esAdmin = perfil?.rol === 'Admin' || auth?.currentUser?.email === ADMIN_EMAIL;
  el.innerHTML = pedidos.map(p => {
    const codigo = p.codigo || p.id;
    const fecha = p.fecha?.toDate
      ? p.fecha.toDate().toLocaleDateString('es-AR')
      : (p.fechaString || '');
    const pendiente = p.status === 'pendiente';
    return `
      <div class="pedido-item">
        <div>
          <div class="pedido-num">${esc(codigo)} &nbsp;·&nbsp; ${esc(fecha)} ${esc(p.usuarioNombre || '')}</div>
          <div class="pedido-name">${esc((p.items || []).map(i => i.name).join(' + '))}</div>
          <div class="pedido-dest">${esc((p.items || []).map(i => i.route || i.sub).join(' · '))}</div>
        </div>
        <span class="status-pill ${pendiente ? 'sp' : 'sc'}">${pendiente ? 'Pendiente' : esc(p.status)}</span>
        <div class="pedido-price">${money(p.total)}</div>
        <div style="display:flex;gap:6px">
          ${pendiente ? `<button class="btn-mod" onclick="openModal('${esc(p.id)}')">Modificar</button>` : ''}
          ${esAdmin && pendiente ? `<button class="btn-mod" onclick="confirmarPedido('${esc(p.id)}')">Confirmar</button>` : ''}
          ${pendiente ? `<button class="btn-del" onclick="eliminarPedido('${esc(p.id)}')">Eliminar</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

window.confirmarPedido = async (id) => {
  try {
    await updateDoc(doc(db, 'pedidos', id), { status: 'confirmado' });
    showToast('Pedido confirmado');
  } catch (err) { showToast('No se pudo confirmar: ' + err.message); }
};

window.eliminarPedido = async (id) => {
  try {
    await deleteDoc(doc(db, 'pedidos', id));
    showToast('Pedido eliminado');
  } catch (err) { showToast('No se pudo eliminar: ' + err.message); }
};

window.openModal = (id) => {
  const p = pedidos.find(x => x.id === id);
  if (!p) return;
  editId = id;
  $('mod-name').value = (p.items || []).map(i => i.name).join(' + ');
  $('mod-price').value = p.total;
  $('modal-pedido').classList.add('show');
};

window.closeModal = () => {
  $('modal-pedido')?.classList.remove('show');
  editId = null;
};

window.saveModal = async () => {
  const p = pedidos.find(x => x.id === editId);
  if (!p) return;
  const nn = $('mod-name').value.trim();
  const np = parseInt($('mod-price').value) || p.total;
  const items = (p.items || []).map((i, idx) => idx === 0 && nn ? { ...i, name: nn } : i);
  try {
    await updateDoc(doc(db, 'pedidos', editId), { items, total: np });
    window.closeModal();
    showToast('Pedido actualizado');
  } catch (err) { showToast('No se pudo actualizar: ' + err.message); }
};

// ============================================================
//  BÚSQUEDA / TABS / UTILS (IGUAL QUE EN TU PROTOTIPO)
// ============================================================
window.setTab = (el, tab) => {
  document.querySelectorAll('.stab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  currentTab = tab;
  $('results-box')?.classList.remove('show');
  const fo = $('f-origen');
  if (tab === 'hotel') {
    fo.style.display = 'none';
    $('lbl-f1').textContent = 'Entrada';
    $('lbl-f2').textContent = 'Salida';
    $('lbl-pax').textContent = 'Huéspedes';
    $('inp-pax').innerHTML = '<option>1 huésped</option><option>2 huéspedes</option><option>3 huéspedes</option>';
  } else {
    fo.style.display = '';
    $('lbl-f1').textContent = 'Fecha de ida';
    $('lbl-f2').textContent = 'Fecha de vuelta';
    $('lbl-pax').textContent = 'Pasajeros';
    $('inp-pax').innerHTML = '<option>1 adulto</option><option>2 adultos</option><option>3 adultos</option><option>Familia</option>';
  }
};

window.buscar = () => {
  const dest = $('inp-destino').value.trim().toLowerCase();
  const base = productos.filter(p => p.tipo === currentTab);
  const res = dest
    ? base.filter(p => [p.route, p.dest, p.name, p.sub].some(s => String(s).toLowerCase().includes(dest)))
    : base;
  const label = { vuelo: 'Vuelos', hotel: 'Hoteles', paquete: 'Paquetes' };
  $('results-title').textContent =
    `${res.length} ${label[currentTab]} encontrado${res.length !== 1 ? 's' : ''}${dest ? ' para "' + dest + '"' : ''}`;
  $('results-list').innerHTML = res.length
    ? res.map(p => `
      <div class="result-item">
        <div class="ri-info">
          <div class="ri-ic ${CLS[p.tipo] || 'v'}">${IC[p.tipo] || IC.vuelo}</div>
          <div><div class="ri-name">${esc(p.name)} – ${esc(p.route)}</div><div class="ri-sub">${esc(p.dest)} · ${esc(p.sub)}</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="ri-price">${money(p.price)}<small>por persona</small></div>
          <button class="btn-add" id="rsrch-${esc(p.id)}" onclick="addToCart('${esc(p.id)}')" ${enCarrito(p.id) ? 'disabled' : ''}>
            ${enCarrito(p.id) ? '✓ Agregado' : '+ Agregar'}
          </button>
        </div>
      </div>`).join('')
    : '<div style="padding:1rem;color:var(--muted);font-size:14px">No se encontraron resultados para ese destino.</div>';
  $('results-box').classList.add('show');
  setTimeout(() => $('results-box').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
};

window.quickAdd = (id) => window.addToCart(id);

window.ir = (id) => {
  const el = $(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

window.showToast = (msg) => {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
};

window.cerrarSesion = async () => {
  await signOut(auth);
  showToast('Sesión cerrada');
};

// ---------- eventos globales (login) ----------
function instalarEventos() {
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'fb-login-form') return;
    e.preventDefault();
    const email = $('fb-email').value.trim();
    const pass = $('fb-pass').value;
    const err = $('fb-login-error');
    err.textContent = '';
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (ex) {
      err.textContent = ex.code === 'auth/invalid-credential'
        ? 'Correo o contraseña incorrectos.'
        : ex.message;
    }
  });
}
