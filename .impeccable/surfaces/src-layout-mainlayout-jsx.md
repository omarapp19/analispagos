---
version: 1
slug: "src-layout-mainlayout-jsx"
primary_target: "src/layout/MainLayout.jsx"
related_targets: ["src/pages/DashboardFlow.jsx","src/pages/Login.jsx","src/pages/Billing.jsx"]
---

## Scope

Whole authenticated app shell + Resumen (dashboard), Login, Punto de venta; all other routes inherit the system through global tokens. Mode: Operate.

Audience: dueño/administrador (PC + teléfono) and cajeros en mostrador (PC). Job: know cash and what is due in seconds; cobrar rápido.

Constraints: Spanish UI, dual currency USD/Bs with BCV rate from settings `exchange_rates`; role-gated routes; Supabase realtime.

User pins: "moderno, sofisticado, como finapartner.com"; then "en vez de violeta utiliza azul". The roll (Talonario) was overridden by the user's pinned reference.

## Direction contract

THESIS: A night-blue command shell around a calm, cool-white work surface; money is always shown as USD with its bolívar equivalent beneath. Refuses the old Horizon-UI template look (pastel icon tiles, gradient cards, everything bold).

OWN-WORLD: Shell #0A1128 with electric blue #2F64F5 for action/selection, blue→cyan (#2F64F5→#1FC0E8) only in the brand mark, blue-slate neutrals (#F4F6FA ground, #E3E7F0 lines, #0F1A33 ink, #5B6680 muted). Manrope, tabular figures. 12–16px radii, hairline borders, soft offset shadows, no glass on content.

STORY: The owner opens Resumen and reads cash, today's net, month income/expenses and the next payments; the cashier lands on a full-screen POS and cobra in a few clicks with the Bs total visible.

FIRST VIEWPORT: Dark sidebar (sections Ventas / Inventario / Compras / Finanzas), top bar with breadcrumb, BCV/€ rate chip and primary "Vender". Hero: a night-blue balance panel (USD figure 46px, Bs copy below, today chip, divisas/ingresos/gastos column, 30-day net bar chart); right card "Próximos pagos" with day-remaining bars; below, rates card with converter and day-grouped cash movements.

FORM: User-pinned reference world (Fina-inspired, recolored blue); not from the roll. seed: 35dba3f3b510221b (overridden by user pin). Signature move: USD/Bs pairing on every key figure; due-date bars whose length encodes days remaining.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
