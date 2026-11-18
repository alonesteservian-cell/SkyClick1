// ============================================================
//  SEED: crea usuarios y carga los datos del diseño en Firestore
//  Se ejecuta desde seed.html (sin servidor ni Admin SDK)
// ============================================================

import { initializeApp } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut
} from 'firebase/auth';
import {
  getFirestore, doc, setDoc, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { firebaseConfig } from './config.js';

const logEl = document.getElementById('log');
const log = (msg) => { logEl.textContent += '\n' + msg; logEl.scrollTop = logEl.scrollHeight; };

// Productos con los datos del diseño Figma
const PRODUCTOS = [
  { id:'AR2451', codigo:'AR2451', tipo:'Vuelo', nombre:'Buenos Aires - Bariloche (Ida y Vuelta)',
    destino:'Bariloche, Río Negro', duracion:'2h 15min por trayecto',
    incluye:'Equipaje de mano 10kg, Equipaje bodega 23kg', precio:185000, activo:true },
  { id:'AR7823', codigo:'AR7823', tipo:'Vuelo', nombre:'Buenos Aires - Mendoza (Solo Ida)',
    destino:'Mendoza, Mendoza', duracion:'1h 50min',
    incluye:'Equipaje de mano 10kg', precio:395000, activo:true },
  { id:'HTL001', codigo:'HTL001', tipo:'Hotel', nombre:'Hotel Llao Llao - Suite Premium',
    destino:'Bariloche, Río Negro', duracion:'3 noches - 4 días',
    incluye:'Desayuno buffet, Wi-Fi, vista al lago', precio:420000, activo:true },
  { id:'HTL002', codigo:'HTL002', tipo:'Hotel', nombre:'Hotel Intercontinental - Mendoza',
    destino:'Mendoza, Mendoza', duracion:'2 noches',
    incluye:'Desayuno, pileta, gimnasio', precio:198000, activo:true },
  { id:'PKG001', codigo:'PKG001', tipo:'Paquete', nombre:'Patagonia Completa',
    destino:'Bariloche + Ushuaia', duracion:'7 días',
    incluye:'Vuelo + Hotel + Traslados', precio:890000, activo:true }
];

const item = (p, cantidad) => ({
  servicioId: p.id, codigo: p.codigo, nombre: p.nombre, destino: p.destino,
  precio: p.precio, tipo: p.tipo, cantidad
});

let auth, db;

const sinConfigurar = !firebaseConfig.apiKey || String(firebaseConfig.apiKey).includes('TU_');
if (sinConfigurar) {
  logEl.textContent = '❌ Primero completá Firebase/js/config.js con las claves de tu proyecto.';
  document.getElementById('btn-seed').disabled = true;
} else {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  document.getElementById('btn-seed').addEventListener('click', ejecutar);
}

async function crearOSincronizar(email, password, nombre, rol) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      nombre, email, rol, creadoEn: serverTimestamp()
    });
    log(`  ✓ Usuario creado: ${email} (${rol})`);
    return cred.user.uid;
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        nombre, email, rol, creadoEn: serverTimestamp()
      }, { merge: true });
      log(`  ↻ Usuario actualizado: ${email}`);
      return cred.user.uid;
    }
    throw err;
  }
}

async function ejecutar() {
  const btn = document.getElementById('btn-seed');
  btn.disabled = true;
  logEl.textContent = 'Iniciando carga…';
  try {
    log('1) Usuarios…');
    const clienteUid = await crearOSincronizar('pasajero@viajes.com', 'pass123', 'Maria González', 'Cliente');
    await crearOSincronizar('admin@viajes.com', 'admin123', 'Administrador', 'Admin');

    // Quedamos logueados como admin para escribir productos y pedidos.
    await signInWithEmailAndPassword(auth, 'admin@viajes.com', 'admin123');

    log('2) Servicios (vuelos, hoteles y paquetes)…');
    const batch = writeBatch(db);
    PRODUCTOS.forEach(p => {
      const { id, ...data } = p;
      batch.set(doc(db, 'productos', id), data);
    });
    await batch.commit();
    log(`  ✓ ${PRODUCTOS.length} servicios guardados`);

    log('3) Pedidos de ejemplo…');
    await setDoc(doc(db, 'pedidos', 'PED-DEMO-1'), {
      codigo: '1794955251554',
      usuarioId: clienteUid,
      usuarioNombre: 'Maria González',
      items: [item(PRODUCTOS[2], 1), item(PRODUCTOS[0], 2)],
      total: 420000 + (2 * 185000),
      fecha: serverTimestamp(),
      status: 'pendiente'
    });
    await setDoc(doc(db, 'pedidos', 'PED-DEMO-2'), {
      codigo: '1794955300000',
      usuarioId: clienteUid,
      usuarioNombre: 'Maria González',
      items: [item(PRODUCTOS[1], 1), item(PRODUCTOS[3], 1)],
      total: 395000 + 198000,
      fecha: serverTimestamp(),
      status: 'confirmado'
    });
    log('  ✓ 2 pedidos guardados (uno pendiente de $790.000)');

    await signOut(auth);
    log('\n✅ ¡Listo! Ya podés entrar a index.html.');
    log('   Cliente: pasajero@viajes.com / pass123');
    log('   Admin:   admin@viajes.com / admin123');
  } catch (err) {
    log('\n❌ Error: ' + err.message);
    log('   Revisá que Auth esté activado y que las reglas estén publicadas.');
  } finally {
    btn.disabled = false;
  }
}
