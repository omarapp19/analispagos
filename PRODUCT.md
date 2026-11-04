# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Dueño / administrador**: controla caja, liquidez, deudas, compras e inventario. Revisa desde PC y desde el teléfono, a menudo en ratos cortos durante el día.
- **Supervisor**: igual que el administrador, sin configuración ni ajustes de inventario.
- **Cajero**: factura en el mostrador todo el día desde una PC. Solo ve el POS, a pantalla completa, sin barra lateral.

## Product Purpose
Sistema de gestión para un comercio en Venezuela ("Galpón", nombre configurable): punto de venta, inventario y kardex, compras y proveedores, clientes, cuentas por cobrar y por pagar, calendario de pagos, estadísticas, inversiones y un asistente de IA para importar ventas desde Excel. Funciona bien cuando el dueño sabe en segundos cuánto hay en caja y qué vence, y cuando el cajero cobra rápido y sin errores.

## Operating Context
- Opera con dos monedas, bolívares (Bs) y dólares (USD / "Divisas"), y usa tasas BCV/paralelo que se sincronizan desde DolarAPI.
- El POS corre en una PC de mostrador; el dueño consulta desde el teléfono.
- Los datos viven en Supabase, con suscripciones en tiempo real; también hay restos de Firebase.

## Capabilities and Constraints
- Stack: React 19, Vite, Tailwind v4, Recharts, lucide-react, react-router 7, PWA.
- Las rutas tienen protección por rol (administrador, supervisor, cajero).
- Toda la interfaz está en español.

## Brand Commitments
- El nombre de la tienda viene de la configuración (`storeName`); no se fija en el código.

## Evidence on Hand
- No hay logo propio. Solo existen los íconos PWA en `public/`.

## Product Principles
1. La cifra correcta primero: los montos y las monedas se leen sin ambigüedad.
2. La velocidad en el mostrador manda en el POS.
3. Debe consultarse de un vistazo desde el teléfono.
4. Los datos son reales y financieros: nada decorativo debe competir con los números.
