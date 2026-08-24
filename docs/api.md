# REST API Specification & Contracts

## 1. Response Envelopes

### Standard Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-08-22T12:00:00.000Z",
    "path": "/api/customers"
  }
}
```

### Standard Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "timestamp": "2026-08-22T12:00:00.000Z",
    "path": "/api/customers",
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 150,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "MONEY_RULE_VIOLATION",
    "message": "[MoneyRuleViolation] Amount must be a whole integer in Egyptian Pounds (EGP). Received: 100.5",
    "details": null
  },
  "meta": {
    "timestamp": "2026-08-22T12:00:00.000Z",
    "path": "/api/payments"
  }
}
```

## 2. Interactive Swagger / OpenAPI Documentation

Swagger documentation is available at:
`http://localhost:4000/api/docs`
