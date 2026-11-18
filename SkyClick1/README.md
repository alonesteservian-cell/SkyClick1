# Sistema de Gestión de Viajes — Fase de Datos con Firebase

Aplicación web de una agencia de viajes (**SkyClick / Agencia Viajes Premium**) con interfaz basada en el diseño de Figma Make y persistencia real en **Cloud Firestore** + **Firebase Authentication**.

## Pantallas (flujo completo del cliente)

| Pantalla | Ruta | Descripción |
|---|---|---|
| **Home público** | `#/home` (ruta por defecto sin sesión) | Promociones, buscador, destinos populares, vuelos/hoteles/paquetes y CTA a login; **no requiere sesión** |
| Login | `#/login` | Acceso con correo y contraseña + credenciales de demostración y registro de cuenta nueva |
| Catálogo | `#/catalogo` | Servicios en tarjetas de 2 columnas con buscador y filtro por tipo (Vuelo / Hotel / Paquete) |
| Carrito | `#/carrito` | Ítems concantidad editable, subtotales y resumen del pedido |
| Resumen / Checkout | ídem | Cantidad de ítems, subtotal, total, *Confirmar Pedido* y *Seguir Comprando* |
| Confirmación | ídem | Banner “Pedido realizado exitosamente” al confirmar |
| Mis Pedidos | `#/pedidos` | Historial de pedidos del usuario con estado, detalle y total |
| Administración | `#/admin` | Alta y baja de productos (solo admin), misma estética del diseño |

> La vista de *Confirmación* está integrada en *Mis Pedidos*: al confirmar se guarda el pedido, se vacía el carrito y se muestra el mensaje de éxito.

### Home público

La pantalla inicial es el **home de promociones** del prototipo original: usa *Plus Jakarta Sans* y los colores verdes `#1D9E75` / `#0F6E56`, menta `#E1F5EE`, ámbar `#EF9F27`, coral `#D85A30` y azul `#185FA5`. Incluye hero con buscador por pestañas (Vuelos / Hoteles / Paquetes), promo de **12 cuotas**, destinos populares y secciones de servicios con botones *+ Agregar*.

Como es una vidriera pública, **no muestra datos de Firestore**: los botones de compra (*+ Agregar*, *Iniciar sesión para comprar*, *Ver planes disponibles*) llevan a `#/login`. Después de autenticarse, la app entra al catálogo con el diseño Figma y recién ahí se consultan productos y carrito. El enlace **← Volver al inicio** del login permite regresar al home.

## Configuración del proyecto Firebase

Proyecto: **`sistema-de-viajes-d7d06`** · App web: **SkyClick**.

1. En Firebase Console, habilitá **Authentication → Sign-in method → Correo electrónico/contraseña** (ya está habilitado: el login funciona).
2. **Creá la base de datos Firestore**: Firebase Console → *Build → Firestore Database → Create database* (modo * production*, ubicación la que prefieras). Actualmente la API responde `The database (default) does not exist`, así que todavía no se puede escribir en Firestore.
3. Publicá las reglas de `firestore.rules` (Firebase Console → Firestore Database → Rules).
4. Verificá las credenciales reales en `js/config.js`:

```js
export const firebaseConfig = {
  apiKey:            "AIzaSyDmZRbCr3bVynTARF73AQYEwty8tgEb_S4",
  authDomain:        "sistema-de-viajes-d7d06.firebaseapp.com",
  projectId:         "sistema-de-viajes-d7d06",
  storageBucket:     "sistema-de-viajes-d7d06.firebasestorage.app",
  messagingSenderId: "405591926787",
  appId:             "1:405591926787:web:706edc1c2d0771d7b60636",
  measurementId:     "G-SS0M47Q3SM"
};
export const ADMIN_EMAIL = 'admin@viajes.com';
```

## Cargar los datos de ejemplo

1. Iniciá un servidor local dentro de la carpeta `Firebase`:

```bash
python -m http.server 3000 --bind 127.0.0.1
```

2. Abrí `http://127.0.0.1:3000/seed.html` y hacé clic en **Cargar datos de ejemplo**.
3. Entrá a `http://127.0.0.1:3000/index.html`.

El seed crea los usuarios demo, cinco servicios (AR2451, AR7823, HTL001, HTL002, PKG001) y dos pedidos de ejemplo; uno de ellos reproduce el pedido pendiente del diseño:

- `HTL001` Hotel Llao Llao – Suite Premium → $ 420.000
- `AR2451` Buenos Aires – Bariloche × 2 → $ 370.000
- **Total del pedido: $ 790.000**

## Credenciales de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Cliente | `pasajero@viajes.com` | `pass123` |
| Admin | `admin@viajes.com` | `admin123` |

## Archivos principales

| Archivo | Contenido |
|---|---|
| `index.html` | Shell de la app: importmap de Firebase 10.12.2, fuentes Inter y Plus Jakarta Sans, `css/styles.css?v=10` |
| `css/styles.css` | Diseño Figma para la app logueada + estilos `.home-*` del home público con los colores del prototipo original |
| `js/app.js` | Auth, Firestore en tiempo real, router por hash y render de todas las pantallas |
| `js/config.js` | Configuración real del proyecto y correo de administrador |
| `js/seed.js` | Carga de usuarios, productos y pedidos del diseño |
| `firestore.rules` | Reglas de seguridad: dueño del carrito/pedido y admin por correo o rol |
| `seed.html` | Página para ejecutar el seed desde el navegador |
| `index-firebase-v1.html` / `js/app-v1.js` | Backup del prototipo anterior conectado a Firebase |

## Datos del catálogo

| Código | Tipo | Descripción | Destino | Precio |
|---|---|---|---|---|
| AR2451 | Vuelo | Buenos Aires – Bariloche (Ida y Vuelta) | Bariloche, Río Negro | $ 185.000 |
| AR7823 | Vuelo | Buenos Aires – Mendoza (Solo Ida) | Mendoza, Mendoza | $ 395.000 |
| HTL001 | Hotel | Hotel Llao Llao – Suite Premium | Bariloche, Río Negro | $ 420.000 |
| HTL002 | Hotel | Hotel Intercontinental – Mendoza | Mendoza, Mendoza | $ 198.000 |
| PKG001 | Paquete | Patagonia Completa | Bariloche + Ushuaia | $ 890.000 |

## Modo demostración (Firestore no disponible)

Mientras la base de datos Firestore no exista (o no haya red), la app detecta que no llega la suscripción a `productos` y activa automáticamente un **modo demostración**:

- Muestra los 5 servicios del diseño, los pedidos de ejemplo y permite agregar al carrito, cambiar cantidades, confirmar pedidos y ver *Mis Pedidos*.
- Guarda carrito y pedidos en `localStorage` del navegador (prefijo `skyclick_demo_`).
- Muestra un banner azul arriba del contenido indicando que Firestore no está disponible.
- En cuanto la base exista y las reglas estén publicadas, el siguiente render usa **Firebase real** y el banner desaparece.

Esto permite revisar la UI ya armada mientras se habilita Firestore; no reemplaza la capa de datos real.

## Notas

- Si Firebase Auth devuelve `400 CONFIGURATION_NOT_FOUND`, significa que aún no está habilitado el proveedor de **Correo electrónico/contraseña** en Authentication.
- Si la API REST responde `The database (default) does not exist for project sistema-de-viajes-d7d06`, creá la base de datos Firestore en la consola; es el paso que falta en este proyecto.
- Si Firestore devuelve `PERMISSION_DENIED`, volvé a publicar `firestore.rules`.
- La UI ignora documentos antiguos de `productos` que no tengan el campo `codigo`; luego de correr el seed el catálogo queda con la estructura nueva.
