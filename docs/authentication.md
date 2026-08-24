# Authentication & Security Architecture

## 1. Authentication Strategy

- **HttpOnly Secure Session Cookies**: Web browser clients receive an `alkabeer_session` cookie flagged with `HttpOnly`, `SameSite=Lax/Strict`, and `Secure` in production.
- **No Client-side Token Storage**: Tokens are never stored in `localStorage` or `sessionStorage` to mitigate Cross-Site Scripting (XSS) token theft.
- **Bearer Token Fallback**: API clients and automated tests can authenticate via `Authorization: Bearer <token>` header.
- **Password Hashing**: Passwords are encrypted with **Argon2id** (memory-hard, resistant to GPU/ASIC cracking).

## 2. Session Lifecycle

1. **Login (`POST /api/auth/login`)**:
   - Validates user credentials.
   - Generates signed JWT payload (`sub`, `username`, `roles`).
   - Sets secure cookie with TTL (default 24 hours).
   - Writes `AuditAction.LOGIN` with IP address and User Agent.
2. **Current User Context (`GET /api/auth/me`)**:
   - `AuthGuard` validates the session, retrieves the active user from the database, builds active role and permission lists, and attaches `req.user`.
3. **Logout (`POST /api/auth/logout`)**:
   - Clears cookie on client.
   - Writes `AuditAction.LOGOUT` to audit log.
