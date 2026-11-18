# Modelo de Datos — Cloud Firestore

El diseño de la UI (Figma Make) determina los campos visibles en cada pantalla **después del login**. Esta es la estructura que usan `js/app.js` y `js/seed.js`.

> El **home público** (`#/home`) es solo una vidriera de promociones: usa los datos estáticos `HOME_DESTINOS` / `HOME_ITEMS` del prototipo original y no consulta Firestore. Al querer comprar, lleva al login; recién autenticado se consultan las colecciones descriptas abajo.

## Colección `usuarios`

Documento ID = UID de Firebase Auth. Se crea al registrar un usuario o desde el seed.

```js
{
  nombre: "Maria González",
  email: "pasajero@viajes.com",
  rol: "Cliente",              // "Cliente" | "Admin"
  creadoEn: serverTimestamp()
}
```

Regla: el documento solo lo puede leer/escribir su propio UID (o un admin).

## Colección `productos`

Documento ID = `codigo` del servicio (por ejemplo `AR2451`). Son los servicios que se muestran en el catálogo y se agregan al carrito.

```js
{
  codigo: "AR2451",            // requerido: la UI ignora documentos sin este campo
  tipo: "Vuelo",               // "Vuelo" | "Hotel" | "Paquete"
  nombre: "Buenos Aires - Bariloche (Ida y Vuelta)",
  destino: "Bariloche, Río Negro",
  duracion: "2h 15min por trayecto",
  incluye: "Equipaje de mano 10kg, Equipaje bodega 23kg",
  precio: 185000,              // número, pesos argentinos
  activo: true                 // false oculta el servicio
}
```

Campos que aparecen en las tarjetas del catálogo: badge de `codigo` + badge de `tipo`, título `nombre`, etiquetas `Destino:`, `Duración:`, `Incluye:`, y `Precio` en formato `$ 185.000`.

### Datos cargados por el seed

| ID / código | tipo | nombre | destino | duración | include | precio |
|---|---|---|---|---|---|---|
| AR2451 | Vuelo | Buenos Aires - Bariloche (Ida y Vuelta) | Bariloche, Río Negro | 2h 15min por trayecto | Equipaje de mano 10kg, Equipaje bodega 23kg | 185000 |
| AR7823 | Vuelo | Buenos Aires - Mendoza (Solo Ida) | Mendoza, Mendoza | 1h 50min | Equipaje de mano 10kg | 395000 |
| HTL001 | Hotel | Hotel Llao Llao - Suite Premium | Bariloche, Río Negro | 3 noches - 4 días | Desayuno buffet, Wi-Fi, vista al lago | 420000 |
| HTL002 | Hotel | Hotel Intercontinental - Mendoza | Mendoza, Mendoza | 2 noches | Desayuno, pileta, gimnasio | 198000 |
| PKG001 | Paquete | Patagonia Completa | Bariloche + Ushuaia | 7 días | Vuelo + Hotel + Traslados | 890000 |

## Colección `carritos`

Documento ID = UID del usuario. Un solo carrito por usuario, con arreglo `items`.

```js
{
  items: [
    {
      servicioId: "HTL001",    // ID del documento en productos
      codigo: "HTL001",        // visible en el carrito y en el pedido
      nombre: "Hotel Llao Llao - Suite Premium",
      destino: "Bariloche, Río Negro",
      precio: 420000,          // precio unitario
      tipo: "Hotel",
      cantidad: 1              // editable con − / + en el carrito
    },
    {
      servicioId: "AR2451",
      codigo: "AR2451",
      nombre: "Buenos Aires - Bariloche (Ida y Vuelta)",
      destino: "Bariloche, Río Negro",
      precio: 185000,
      tipo: "Vuelo",
      cantidad: 2              // subtotal $ 370.000
    }
  ]
}
```

Montos derivados (no se guardan como campos propios):

- **Cantidad de items** = suma de `cantidad` (3 en el ejemplo).
- **Subtotal / Total** = suma de `precio × cantidad` ($ 790.000 en el ejemplo).

## Colección `pedidos`

Documentos generados al confirmar el carrito, más los pedidos de ejemplo del seed.

```js
{
  codigo: "1794955251554",    // número de pedido mostrado como "Pedido #..."
  usuarioId: "<UID>",         // dueño del pedido (query del cliente)
  usuarioNombre: "Maria González",
  items: [ /* misma estructura que carritos.items */ ],
  total: 790000,
  fecha: serverTimestamp(),   // se formatea como 17/11/2026, 07:40 p. m.
  status: "pendiente"          // requerido por firestore.rules
}
```

Estados usados en el badge de Mis Pedidos: `pendiente` (ámbar), `confirmado` / `completado` (menta) y `cancelado` (rojo). El admin puede pasar un pedido de `pendiente` a `confirmado` desde la vista de administración.

### Pedidos del seed

| Documento | código | estado | items | total |
|---|---|---|---|---|
| `PED-DEMO-1` | 1794955251554 | pendiente | HTL001 ×1 + AR2451 ×2 | $ 790.000 |
| `PED-DEMO-2` | 1794955300000 | confirmado | AR7823 ×1 + HTL002 ×1 | $ 593.000 |

## Simultaneidad y reglas

- `onSnapshot` mantiene sincronizados catálogo, carrito y pedidos sin recargar la página.
- `firestore.rules` exige `request.auth != null`, verifica `usuarioId` en carritos/pedidos y permite escribir productos y cambiar estados solo al admin (`admin@viajes.com` o `rol === 'Admin'`).
- El campo `status: 'pendiente'` es obligatorio al crear pedidos; quitarlo hace que Firestore rechace la escritura.

## Compatibilidad

La versión anterior (`index-firebase-v1.html` / `js/app-v1.js`) usaba otro esquema de productos. La nueva interfaz solo muestra documentos con `codigo`, por lo que después de ejecutar `seed.html` los servicios viejos quedan ocultos y el catálogo muestra los cinco servicios listados arriba.

## Modo demostración local

Cuando Firestore no responde (por ejemplo, si todavía no se creó la base de datos `(default)`), `js/app.js` activa un respaldo con estos mismos cinco productos y los dos pedidos de ejemplo, guardando carrito/pedidos en `localStorage`. Es solo para poder revisar la UI; la estructura de datos es idéntica a la descripta arriba y se reemplaza automáticamente por Firebase real cuando la base y las reglas están disponibles.
