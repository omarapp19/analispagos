# Fase 4: gestión de la tienda en el ERP

Rama: `tienda/fase-4-gestion-erp` (sale de `tienda/fase-3-precios-pedidos`).

## Qué incluye

**Base de datos** (`supabase/migrations/0009_staff_rpc.sql`)
| RPC / vista | Quién | Qué hace |
|---|---|---|
| `staff_web_orders` (vista) | personal | Pedidos con nombre del cliente, comprobantes por revisar y número de factura. |
| `staff_order_detail(order_id)` | personal | Pedido completo + datos del cliente (correo, documento, nombre en el ERP) + `facturaFiscal`. |
| `staff_review_payment(report_id, approve, note)` | personal | Aprueba o rechaza (con motivo). Si lo aprobado cubre el total, confirma y factura. Si es parcial, vuelve a "Esperando pago" diciendo cuánto falta en USD y Bs. |
| `staff_confirm_order(order_id)` | personal | En una transacción: libera la reserva, factura con `erp_create_invoice` (stock, kardex `Venta web WEB-…`, `client_invoices`, caja si es de contado), agrega líneas de delivery e IGTF al comprobante y pasa a CONFIRMADO. A crédito revisa que siga aprobado y dentro del límite. |
| `staff_set_order_status(order_id, status, note, tracking, carrier)` | personal | Transiciones de la spec 4.6; ENVIADO exige transportista y guía; CANCELADO solo antes de confirmar y libera la reserva. |
| `staff_set_order_notes(order_id, notes)` | personal | Notas internas. |
| `staff_review_wholesale(user_id, approve, credit_limit, max_credit_days, special_discount_pct, note)` | administrador o supervisor | Aprueba (o edita condiciones) o rechaza con motivo. |
| `staff_wholesale_customers()` | personal | Mayoristas y solicitudes con crédito usado. |
| `staff_price_quote(customer_user_id, items, …)` | personal | Simulador: la misma `store_quote_for` que usa la tienda. |

**ERP** (menú **Tienda web**, administrador y supervisor)
- **Pedidos web**: pestañas por estado con contador, lista en tiempo real, panel de detalle con productos y desglose de
  reglas, totales en USD y Bs a la tasa congelada, comprobantes (enlace firmado de 10 min al bucket privado) con
  Aprobar / Rechazar con motivo, acciones según el estado, botón de WhatsApp con mensaje por estado, aviso de
  factura fiscal, notas internas e historial. "Factura FAC-…" abre el comprobante del POS (`/pos?factura=…`).
- **Mayoristas**: solicitudes, activos y rechazados; límite, plazo máximo y descuento especial; aviso si el documento ya
  existía en el ERP con otro nombre (para verificar identidad antes de aprobar).
- **Reglas de precio**: CRUD agrupado por tipo, alcance (todo, categoría, producto), para quién, vigencia y
  activar/desactivar; **simulador** por cliente, productos, pago, plazo y entrega.
- Contador de pendientes en el menú (pagos por verificar + pedidos por confirmar; mayoristas por revisar).

## Decisiones
- Método en la factura igual que el POS: Pago Móvil, Transferencia, Zelle, Binance; efectivo web → "Divisas";
  crédito → "-". Zelle y Binance aparecen como métodos nuevos en Finanzas.
- Confirmar sin comprobante aprobado es posible (pago verificado por otra vía) pero queda como acción secundaria.
- Tolerancia de 0,05 USD al comparar lo pagado con el total (redondeo de Bs a USD).
- Ajuste menor de Fase 1 incluido aquí: alineación del botón "Agregar zona" en Configuración > Tienda web.

## Prueba a mano (staging)
1. Desde la tienda: pedido con Pago Móvil → reportar pago con comprobante.
2. ERP > Pedidos web: aparece en "Por verificar pago" y el contador del menú sube. Ver comprobante → Aprobar.
3. Queda CONFIRMADO con factura; en Inventario bajó el stock, en Kardex "Venta web WEB-…", en caja el ingreso.
4. Preparando → Listo para retiro → Entregado. En la cuenta del cliente cada cambio aparece sin recargar.
5. Rechazar un comprobante con motivo: el cliente lo ve y puede reportar otro.
6. Mayorista: aprobar con crédito 30 días; en el simulador, comparar con lo que ve el cliente en el carrito.
7. Pedido a crédito: al confirmar, la factura queda pendiente en Cuentas por cobrar y no entra a caja.

## Pruebas automáticas
`npm run test:sql`: 38 casos de esta fase (ciclo completo, parcial, rechazo, efectivo con delivery, envío con guía,
crédito, permisos de cliente y cajero, simulador = cotización del cliente), con id uuid, bigint y text.
