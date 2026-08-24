# ALKABEER VIP WEB

Enterprise Telecom Management, Multi-Line Distribution, and Financial Operations Platform.

---

## Tech Stack

- **Backend**: Node.js, NestJS, TypeScript, Prisma ORM, PostgreSQL, Argon2id, Swagger/OpenAPI.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui primitives, TanStack Query, React Router.
- **Shared Package**: `@alkabeer/shared` (DTOs, Enums, Strict Integer Money utilities, Permission constants).
- **Architecture**: Modular Monolith inside npm Workspaces.

---

## Getting Started

### 1. Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- PostgreSQL >= 15.x (or Docker)

### 2. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env
```

Review the database credentials and secrets in `.env`:
```ini
DATABASE_URL="postgresql://alkabeer_user:alkabeer_secure_pass@localhost:5432/alkabeer_db?schema=public"
SESSION_SECRET="your_long_random_session_secret_32_chars_min"

# Optional: Initial Super Admin user creation credentials
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_EMAIL=admin@alkabeer.local
SEED_ADMIN_PASSWORD=AdminSecurePass!2026
```

### 3. Start Database via Docker (Optional)
```bash
docker-compose up -d
```

### 4. Database Setup & Seeding
```bash
# Generate Prisma Client
npm run prisma:generate

# Apply Migrations
npm run prisma:migrate

# Seed Deterministic Base Data (Permissions, Roles, Companies, Treasury Accounts)
npm run prisma:seed
```

### 5. Run Automated Tests
```bash
npm run test:api
```

### 6. Start Development Servers
```bash
# Start Backend API (runs on port 4000)
npm run start:api

# Start Web UI (runs on port 5173)
npm run start:web
```

- **Backend API**: `http://localhost:4000/api`
- **Swagger Documentation**: `http://localhost:4000/api/docs`
- **Frontend Web UI**: `http://localhost:5173`

---

## Core Rules & Guarantees

1. **Egyptian Pound (EGP) Integer Rule**: All monetary values are pure whole integers. No piastres, no cents, no factor multiplication. `100 EGP = 100`.
2. **Backend Authoritative**: All validations, inventory checks, RBAC permissions, and transactions are strictly verified server-side.
3. **Atomic Sales**: Line locking, sale items, inventory movements, payment, and treasury movements execute in a single ACID transaction with complete rollback on failure.
4. **Append-Only Ledger**: No destructive deletes on financial records. Adjustments use explicit compensating reversal transactions (`REVERSAL`).
5. **FIFO Payment Allocation**: Customer payments are automatically distributed across oldest due monthly charges.
