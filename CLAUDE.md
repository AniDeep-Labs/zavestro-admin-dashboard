# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Verified-against-code: 2026-07-12. If this file is >30 days old, re-verify before trusting it.

## Project Overview

Zavestro is a made-to-order clothing brand (dark-store model: the brand designs, stocks fabric per hub, and stitches to each customer's saved measurements). This repo is the **internal admin dashboard** — a React SPA with **6 capability-gated role consoles**: `super_admin` (oversight-only), `design`, `procurement`, `catalog_manager` (per-hub), `finance`, `support`. All pages call the **real backend** (`zavestro-backend`) via `src/api/adminApi.ts` + `src/api/catalogApi.ts`. There is **no mock data** anywhere.

Authoritative docs (in `../zavestro-documentation/`): `00-MASTER-PLAN.md` (role model + gap register) · `FABLE-ADMIN-UIUX.md` (the page-by-page design spec + build order — follow it for any UI work) · `ADMIN-ROLE-AUDIT.md` (per-role audit).

## Commands

```bash
npm run dev       # Start dev server
npm run build     # TypeScript check + Vite production build  ← run before any PR
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Architecture

### Stack
- **React 19** + TypeScript (strict), **Vite 8**, **React Router v7** — all routes in `src/App.tsx` (admin routes nested under `<AdminLayout>`; lazy-loaded per page via `lazyPage`)
- **CSS Modules** + CSS custom properties (`src/styles/variables.css`) — no CSS-in-JS, no Tailwind
- **Onest** font; light/dark via `data-theme="dark"` on `<html>` (`src/utils/theme.ts`, localStorage `zavestro-theme`)
- Sentry/Datadog wired (vendor chunks)

### RBAC (read this before touching nav or pages)
- `AdminLayout.tsx` defines `SECTIONS`: capability-gated nav workspaces. A section shows if the user holds any of its `caps`; items gate on `cap`. `roleOwned` sections (Design, Catalog) are **hidden from super_admin** (oversight-only — deep-links blocked too); `superOnly` sections show only to super_admin. Legacy `admin` role = god-mode.
- Capabilities come from `adminAuthExtApi.me()` (refreshed on mount, cached in localStorage). Backend enforces independently — frontend `<Can cap="…">` is UX, not security.
- Floor actions on OrderDetail (advance/override/assign) are `system:manage` break-glass only (G-23); support is CX-only via `orders:write`.

### Pages (`src/pages/admin/` — ~77 pages, one `.tsx` + usually one `.module.css`)
Role ownership and the per-page spec live in `FABLE-ADMIN-UIUX.md` §3–§8. Notable:
- `OrderDetailPage.tsx` (~1,450 lines) — order story + CX verbs + break-glass; SSE live updates.
- `GarmentTemplateEditorPage.tsx` — the fit engine's size-chart/capture-set/pain-point authoring. Handle with care.
- `ProductsListPage/ProductEditPage` — **LEGACY** catalog editor for the live legacy customer flow. Do not delete until the P5 cutover completes; do not invest in it either.
- Deleted (do not recreate): MeasurementBooking* pages (System-2 retired), GarmentTypesPage (was unrouted), craftspeople content section + `craftspeopleApi` (artisan model retired), Luxe* (model scrapped).

### Components (`src/components/` — ~50 dirs, barrel-exported from `index.ts`)
Primitives: Button/IconButton, Card/StatCard, Input/Select/Checkbox/Radio/Toggle/Textarea, SearchInput, FileUpload, Alert, Badge, Toast (`createToast`), Tooltip, Navbar/Sidebar, Breadcrumb, Tabs, Modal/ConfirmationModal, ConfirmDialog, Drawer, Popover, Table (generic, typed, sortable), Skeleton, Spinner, Avatar, Grid/Container/Spacer, Can, ErrorBoundary, CustomerQuickLookup, StaffAssignmentDropdown.
Structural canon (FABLE-ADMIN-UIUX §2 — prefer these over one-offs): **StatusBadge** (canonical status vocabulary — don't add per-page stage maps), **EmptyState**, **PageHeader**, **FilterBar**, **DetailShell**, **PeekDrawer** (list-row quick-look), **ActivityLog**, **NotesPanel**, **DataCells** (CopyId/AgeCell/MoneyCell), **PolicyCard**, **NoHubAssigned**, **CommandPalette**.

## Conventions

- **CSS Modules only**; design-token `var(--*)` values — never hardcoded colors. Inline `style={{}}` is legacy debt being burned down (worst remaining: OrderDetail) — never add new ones.
- **Status colors/labels:** use the canonical status vocabulary (FABLE-ADMIN-UIUX §2.1). Per-page `STATUS_CSS`/`stagePill` maps are debt scheduled for replacement by `StatusBadge` — don't add new copies.
- **New pages copy a canonical page** (list → OrdersListPage pattern, worklist → RefundsPage, detail → OrderDetailPage post-repair, form → DesignEditorPage); never invent a one-off layout.
- Every list/detail ships loading (Skeleton) / empty (with next action) / error (server's message + retry) states.
- Barrel imports from `../../components`; PascalCase components, camelCase utils.
- Deep-links carry context (e.g. `?search=<phone>`); back must preserve list filters (URL-synced state).
- Run `npm run build` before declaring any change done — it's the type gate.
