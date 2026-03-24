# Honey Budget Backend

Production-shaped Node.js backend for a couples budgeting app with:

- JWT auth for two linked users
- Password reset via email link
- PostgreSQL persistence via Prisma
- Shared dashboard and expense tracking
- AI-generated savings insights from the last 30 days of spending
- Endpoint tests with `vitest` and request/response injection

## Stack

- Node.js 24
- Express
- Prisma + PostgreSQL
- OpenAI Node SDK
- JWT (`jsonwebtoken`) + `bcryptjs`

## Environment

Create `.env` from `.env.example`:

```bash
PORT=4000
HOST=127.0.0.1
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/couples_budgeting"
JWT_SECRET=change_me_in_development
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
APP_BASE_URL=http://localhost:5173
RESET_PASSWORD_URL_BASE=http://localhost:5173
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=no-reply@honeybudget.app
```

If `OPENAI_API_KEY` is not set, the AI insights route falls back to deterministic budgeting tips.

If SMTP settings are not configured, the forgot-password route still works in preview mode and returns a temporary reset link in the API response for local testing.

## Install and run

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm start
```

## API shape

Successful responses return:

```json
{
  "data": {}
}
```

Errors return:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Readable message"
  }
}
```

## Main routes

### Register

`POST /api/auth/register`

```json
{
  "name": "Alex",
  "email": "alex@example.com",
  "password": "strong-password",
  "monthlySalary": 4200,
  "salaryPaymentMethod": "card"
}
```

### Login

`POST /api/auth/login`

```json
{
  "email": "alex@example.com",
  "password": "strong-password"
}
```

### Forgot password

`POST /api/auth/forgot-password`

```json
{
  "email": "alex@example.com"
}
```

### Reset password

`POST /api/auth/reset-password`

```json
{
  "token": "token-from-email-link",
  "password": "new-strong-password"
}
```

### Authenticated user profile

`GET /api/auth/me`

Header:

```bash
Authorization: Bearer <jwt>
```

### Link the current user with a partner

`POST /api/couples`

```json
{
  "partnerUserId": 2
}
```

### Shared dashboard

`GET /api/dashboard?days=30`

### Add an expense

`POST /api/transactions`

```json
{
  "amount": 86.5,
  "category": "Date Night",
  "type": "one-time",
  "paymentMethod": "card",
  "date": "2026-03-20"
}
```

The authenticated user becomes the transaction owner automatically.

### List couple expenses

`GET /api/transactions?days=30`

### Get AI insights

`GET /api/insights?days=30`

Returns:

- Spending snapshot for the linked couple
- Cash vs card ratio
- Salary-based fair split recommendation
- Exactly 3 actionable savings tips

## Tests

```bash
npm test
```

The test suite uses an in-memory repository so the HTTP contract is validated without requiring a live PostgreSQL instance.
