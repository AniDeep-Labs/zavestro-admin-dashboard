# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zavestro is a custom tailoring marketplace frontend connecting customers, designers, and tailors. Built with React 19 + TypeScript + Vite 8. No backend — all data is mocked.

## Commands

```bash
npm run dev       # Start dev server
npm run build     # TypeScript check + Vite production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Architecture

### Stack
- **React 19** with TypeScript (strict mode, ES2023 target)
- **Vite 8** with Oxc-based React transform
- **React Router v7** — all routes in `src/App.tsx`
- **CSS Modules** + CSS custom properties (design tokens) — no CSS-in-JS, no Tailwind
- **Poppins** font via Google Fonts CDN

### Design System (`src/styles/`)
- `variables.css` — All tokens: colors, spacing, typography, shadows, radii, z-index, transitions, breakpoints
- Light/dark mode via `data-theme="dark"` on `<html>`. Theme persists in localStorage (`zavestro-theme`)
- Primary: Emerald (#1F6B4F light / #8FBCA8 dark), Secondary: Gold (#D4A574)
- `src/utils/theme.ts` — `initTheme()`, `toggleTheme()`, `setTheme()`

### Component Library (`src/components/`)
33 component directories, all barrel-exported from `src/components/index.ts`. Every component:
- Uses CSS Modules (`.module.css`)
- References design tokens via `var(--*)` — never hardcoded values
- Supports dark mode automatically through CSS variable swapping
- Key components: Button (5 variants), Card/StatCard, Input/Select/Checkbox/Radio/Toggle/Textarea, FileUpload (drag & drop), Modal/Drawer/Popover, Table (generic typed with sorting), Tabs, Toast (with createToast helper), Navbar/Sidebar, Avatar/AvatarGroup, Spinner/Skeleton, Grid/Container/Spacer

### State Management
- `src/context/OrderContext.tsx` — useReducer + Context for multi-step customer order flow
- Hook: `useOrder()` returns `{state, dispatch}`
- Actions: SET_FABRIC_SOURCE, SET_SELECTED_FABRIC, SET_OWN_FABRIC, SET_DESIGN, SET_MEASUREMENT_METHOD, SET_MEASUREMENT, SET_TAILOR, SET_FABRIC_METERS, SET_COUPON, SET_STEP, RESET

### Pages (`src/pages/`)
- `customer/` — 12 pages: CustomerLayout + 11 screens (home, fabric catalog, own fabric, designs, design detail, measurements, self-measure, tailor selection, order summary, order confirmation, order tracking)
- Each page has a `.tsx` + `.module.css` pair

### Mock Data (`src/data/mockData.ts`)
Typed interfaces: Fabric, Design, Tailor, Order, MeasurementField. All with sample data arrays.

### Routing (`src/App.tsx`)
All customer routes nested under `<CustomerLayout>` within `<OrderProvider>`. Pattern: `/path` for list pages, `/path/:id` for detail pages.

## Conventions

- **Barrel exports** — every component directory has `index.ts`; pages import from `../../components`
- **CSS Modules only** — class names via `styles.className`, compose with template literals
- **No inline styles** except dynamic values (e.g., Spacer dimensions)
- **Mock data** — typed interfaces first, then sample arrays; no API calls
- **File naming** — PascalCase for components/pages, camelCase for utilities
- **Responsive** — mobile-first; use CSS custom property breakpoints
- **Accessibility** — WCAG AAA target; semantic HTML, aria attributes, keyboard navigation
