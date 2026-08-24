# ALKABEER VIP WEB — Architecture Specification

## 1. System Overview

**ALKABEER VIP WEB** is an enterprise-grade telecom management, line distribution, and financial operations system. It replaces legacy local SQLite applications with a modern, high-throughput, secure web architecture built as a **Modular Monolith** inside an npm Workspaces Monorepo.

```
                    ┌────────────────────────┐
                    │    React / Vite Web    │
                    │  (shadcn/ui + Tailwind) │
                    └───────────┬────────────┘
                                │ HttpOnly Secure Cookie (Session)
                                │ REST JSON (Authoritative API)
                                ▼
                    ┌────────────────────────┐
                    │  NestJS Backend API    │
                    │  (Modular Monolith)    │
                    ├────────────────────────┤
                    │ • Auth & Argon2id RBAC │
                    │ • Atomic Sales Engine  │
                    │ • FIFO Payment Alloc.  │
                    │ • Integer EGP Ledger   │
                    │ • Immutable Audit Logs │
                    └───────────┬────────────┘
                                │ Prisma ORM
                                ▼
                    ┌────────────────────────┐
                    │   PostgreSQL Engine    │
                    │ (ACID Transactions)    │
                    └────────────────────────┘
```

## 2. Monorepo Organization

```
alkabeer-vip-web/
├── apps/
│   ├── web/                     # React frontend (Vite, Tailwind, TanStack Query, React Router)
│   └── api/                     # NestJS backend API
├── packages/
│   ├── shared/                  # Shared types, enums, Money utility, permission keys, API contracts
│   └── config/                  # Shared base tsconfig and compiler settings
├── database/
│   ├── prisma/
│   │   ├── schema.prisma        # PostgreSQL Prisma schema (19 domain entities)
│   │   └── migrations/          # Managed migration SQL
│   └── seeds/                   # Deterministic safe seed scripts
├── docs/                        # Complete technical documentation suite
├── docker/                      # Dockerfiles & container configs
├── .env.example
├── docker-compose.yml
└── package.json
```

## 3. Core Architectural Principles

1. **Backend is the Single Source of Truth**: The client UI is purely a presentation layer. Permissions, financial sums, line availability, and authorization are strictly enforced server-side.
2. **Modular Monolith**: Modules are domain-bounded (`customers`, `lines`, `inventory`, `sales`, `payments`, `monthly-charges`, `treasury`, `expenses`, `daily-closing`, `audit`, `rbac`), sharing an ACID PostgreSQL database.
3. **Egyptian Pound (EGP) Integer Fidelity**: All monetary numbers are whole integers in Egyptian Pounds. No decimal numbers, no cents/piastres, no multiplication by 100.
4. **Append-Only Financial History**: No destructive `DELETE` on finalized transactions. Adjustments and cancellations use explicit compensating reversals (`REVERSAL`).
5. **Atomic Transactions**: Multi-entity operations (sales, payments, transfers, expenses) execute inside database transactions with total rollback on failure.
