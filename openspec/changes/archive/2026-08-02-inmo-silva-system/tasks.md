# Implementation Tasks: InmoAdmin System (`inmo-silva-system`)

## Phase 1: Project Setup & Fluent Dark UI Theme Foundation
- [x] Initialize React + TypeScript + Vite project structure with Tailwind CSS, Lucide React, and Tauri v2 configuration (`package.json`, `tailwind.config.js`, `src-tauri/tauri.conf.json`).
- [x] Configure Fluent Dark UI theme tokens (`#09090B` canvas, `#0F172A` surface, `#1E293B` border, `#D97706` amber accent) in `tailwind.config.js` and `src/index.css`.
- [x] Build base layout and UI primitives (`src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Modal.tsx`, `src/components/ui/Table.tsx`).

## Phase 2: Database Layer & Hooks
- [x] Define TypeScript data interfaces for system entities (`Arrendadores`, `Propiedades`, `Arrendatarios`, `Transacciones`) in `src/types/index.ts`.
- [x] Implement SQLite table schema creation DDL and SQLite database connection initialization in `src/services/db.ts` / `src-tauri/src/db.rs`.
- [x] Develop custom IPC database hook (`src/hooks/useDatabase.ts`) providing unified reactive CRUD operations and financial queries for React views.

## Phase 3: Core CRUD Modules
- [x] Implement Landlord (Arrendador) management view and edit modal (`src/views/EntitiesView.tsx`, `src/components/crud/OwnerModal.tsx`) for contact and bank account records.
- [x] Implement Property (Propiedad) management view and edit modal (`src/components/crud/PropertyModal.tsx`) with owner linking, rent target, and cutoff day logic.
- [x] Implement Tenant (Arrendatario) management view and edit modal (`src/components/crud/TenantModal.tsx`) with property assignment and contract validity dates.

## Phase 4: Financial Administration & PDF Statement Engine
- [x] Build transaction logging form and tables (`src/views/AdminView.tsx`, `src/components/admin/TransactionForm.tsx`) to register income payments and itemized maintenance expenses in COP.
- [x] Implement 100% net payout calculation engine (`Net = Income - Expenses`) with COP formatting in `src/services/pdf.ts` and `src/components/admin/SettlementPdfButton.tsx`.
- [x] Develop PDF export generator (`src/services/pdf.ts`) rendering branded owner settlement statements with transaction breakdown tables and net total box.

## Phase 5: Dashboard & Alerts (KPIs, Overdue Rent & Verification)
- [x] Build main Dashboard view (`src/views/DashboardView.tsx`) with financial KPI cards (`src/components/dashboard/KpiCard.tsx`) displaying monthly income, pending balance, and active properties.
- [x] Develop dynamic alerts component (`src/components/dashboard/AlertsList.tsx`) for overdue rent payments past cutoff day and negative owner account warnings (`#EF4444`).
- [x] Implement System Settings view (`src/views/SettingsView.tsx`) for agency branding configuration and one-click SQLite database backup export.
- [x] Perform full system integration verification: test CRUD flows, 100% net calculation accuracy, PDF statement generation, database backup, and dark UI styling.
