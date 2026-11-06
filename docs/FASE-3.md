# Fase 3: precios, carrito y pedidos

Rama: `tienda/fase-3-precios-pedidos` (sale de `tienda/fase-1-catalogo`). Solo base de datos: la tienda vive en el
repo `valkarweb` y su `web/src/services/api.js` es lo único que hay que cambiar para conectarla.

## Qué incluye (`supabase/migrations/0008_store_rpc.sql`)

| RPC | Quién | Notas |
|---|---|---|
| `price_quote(items, payment_method, credit_days, delivery_method, delivery_zone)` | anon y clientes | Algoritmo de la spec 4.4. No escribe nada. |
| `register_customer(full_name, document_id, phone, wants_wholesale, business_name, rif)` | cliente | Normaliza el documento (`V12345678`, `J294267319`) y enlaza o crea `clients`. Idempotente. |
| `my_customer()` | cliente | Forma del contrato (punto 6), con `addresses`. |
| `update_my_profile(full_name, phone)` · `request_wholesale(business_name, rif)` | cliente | |
| `place_order(items, payment_method, delivery_method, credit_days, delivery_zone, address, address_id, carrier, notes)` | cliente | Devuelve `{ number, status, totalUsd, totalBs, reservedUntil }`. |
| `report_payment(order_number, method, amount, currency, reference, paid_at, bank_from, proof_path)` | cliente | `proof_path` debe empezar con `{auth.uid()}/` (bucket `payment-proofs`). |
| `cancel_my_order(order_number)` · `my_order(order_number)` · `my_orders()` · `my_credit()` | cliente | Pedido con la forma del contrato (punto 5). |
| `expire_reservations()` | pg_cron | Cada 15 min si pg_cron está activo. |

`items` = `[{ "productId": <id>, "quantity": <entero> }]`. El `productId` es el `id` que devuelve `catalog_products`.

Salida de `price_quote`: `lines[]` (`productId, productName, code, quantity, unitBaseUsd, discountPct, unitPriceUsd,
lineTotalUsd, appliedRules[{id,name,kind,discountPct}], capped, floored, available, stock, minWholesaleQty,
belowWholesaleMin`), `subtotalBaseUsd, subtotalUsd, discountUsd, deliveryFeeUsd, taxUsd, igtfUsd, totalUsd, bcvRate,
totalBs, customerType, wholesaleStatus, errors[{code, productId?, message}]`.
Códigos de error: `cantidad_invalida`, `no_disponible`, `sin_stock`, `zona_invalida`, `metodo_no_disponible`,
`credito_no_permitido`, `credito_plazo`, `credito_limite`.

## Reglas que implementa
- Una regla por tipo, la más específica (producto > categoría > global); en cantidad, la de mayor `minQty` alcanzada;
  en empate, la de mayor descuento. Se suman, se aplica el tope (`maxDiscountPct` del producto o el global privado)
  y luego el piso de margen (`costo × (1 + minMarginPct)`).
- El descuento especial del mayorista reemplaza la regla de cliente si es mayor.
- Las reglas mayoristas aplican solo si: cliente mayorista **aprobado**, producto con "venta al mayor" y la línea
  alcanza el mínimo de mayor. Si no, la línea va a precio de detal (`belowWholesaleMin` avisa).
- IVA: si en Configuración "el precio de venta ya incluye IVA" está apagado, suma el `taxPercentage` de cada producto.
- IGTF: `igtfPct` sobre subtotal + delivery + IVA, solo en los métodos de `igtfMethods`.
- Delivery: tarifa de la zona; gratis si `freeOverUsd > 0` y el subtotal lo alcanza.
- Crédito: mayorista aprobado con `maxCreditDays > 0`, plazo dentro de su máximo y de `creditDaysOptions`, y
  deuda (facturas a crédito `PENDING` + pedidos a crédito por confirmar) + total ≤ límite.
- Reservas: 24 h (o `reservationHours`), efectivo 48 h, crédito sin vencimiento hasta que el personal decida.
  Al reportar un pago la reserva deja de vencer mientras se revisa.
- `place_order` bloquea las filas de inventario en orden fijo antes de recalcular: dos pedidos por la última unidad
  se serializan y el segundo falla. Máximo 5 pedidos abiertos por cliente.
- **El POS respeta las reservas**: `erp_create_invoice` ahora descuenta lo apartado en pedidos web y lo dice en el
  mensaje ("disponible 0 (1 apartados en pedidos web)").

## Desviaciones de la spec
- `place_order` y `report_payment` usan el **número** del pedido (`order_number`), como la tienda, no el id.
- `web_orders.igtfUsd` aparte de `taxUsd` (IVA). `subtotalUsd` del pedido guarda el subtotal a precio base.
- Reglas `customer` con un `clientId` específico solo aplican a mayoristas aprobados: cualquiera puede registrarse con
  una cédula ajena, y el personal verifica la identidad al aprobar.
- `my_customer` devuelve el nombre y teléfono que el cliente escribió al registrarse (`web_customers.fullName/phone`),
  no los del cliente del ERP, para no exponer datos de un cliente existente a quien use su cédula.
- `price_quote` no da error por "mínimo de mayor": vende a detal y lo marca en la línea.

## Para conectar la tienda (`valkarweb/web/src/services/api.js`)
- `getSettings` → `settings` ids `tienda_publica` y `exchange_rates`.
- `getCategories` → vista `catalog_categories`; catálogo → `catalog_products`; vehículo → `products_for_vehicle`.
- `signUp` → `supabase.auth.signUp` y luego `register_customer`; sesión → `my_customer`.
- `priceQuote`, `placeOrder`, `getOrder` (`my_order`), `listMyOrders` (`my_orders`), `reportPayment` (sube primero
  el archivo a `payment-proofs/{uid}/{numero}/…`), `cancelMyOrder`.
- Direcciones: tabla `web_addresses` directa (RLS por dueño).
- Eliminar `devApproveWholesale`, `devAdvanceOrder` y `MODO_PRUEBA`.

## Pruebas
- `npm run test:sql`: 49 casos de esta fase con id uuid, bigint y text (reglas combinadas, tope, piso, especial,
  IVA, IGTF, delivery, crédito, reservas, POS, pagos, cancelación, expiración, aislamiento entre clientes, permisos).
- Concurrencia real (no se puede en PGlite): `node scripts/test-place-order-concurrency.mjs` contra staging.

## Pendiente de tu lado
- Activar `pg_cron` en Supabase (Database > Extensions) antes de aplicar 0008, o programarlo a mano después.
- Correr la prueba de concurrencia en staging.
