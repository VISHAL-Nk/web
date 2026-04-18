# EchoSight Web

EchoSight Web is the role-based Next.js application for customer reviews, seller analytics, and admin moderation.  
It also acts as the API gateway that connects product review workflows to the AI engine.

## What This Module Does

- Customer portal for product browsing, review submission, and product Q&A
- Seller dashboard for product performance, alerts, and analytics
- Admin moderation queue with single and bulk moderation actions
- Authentication and role-based route protection
- AI orchestration for fake detection, tag generation, auto-response, and customer Q&A
- Scheduled maintenance for auto-approval and delayed auto-response publishing

## Tech Stack

- Next.js 15 (App Router)
- React 19 + TypeScript
- MongoDB + Mongoose
- Tailwind CSS 4
- JWT auth (cookie-based)
- Recharts for dashboard visualizations

## Environment Variables

Create a .env.local file in the web module with:

| Variable | Required | Description | Example |
|---|---|---|---|
| MONGODB_URI | Yes | MongoDB connection string | mongodb+srv://... |
| JWT_SECRET | Yes | JWT signing secret | change-this-in-production |
| AI_ENGINE_URL | Yes | URL of the AI service | http://localhost:8000 |
| NEXT_PUBLIC_APP_NAME | No | Display name in UI | EchoSight |
| AUTO_RESPONSE_DELAY_MINUTES | No | Delay before auto-response appears | 30 |
| CRON_SECRET | No | Secret for maintenance endpoint | strong-secret |

## Local Development

1. Enter the web module directory.
2. Install dependencies.
3. Configure .env.local.
4. Start development server.

Commands:

npm install  
npm run dev

Default URL: http://localhost:3000

## Available Scripts

| Script | Purpose |
|---|---|
| npm run dev | Start local development server |
| npm run build | Build for production |
| npm run start | Start production server |
| npm run lint | Run lint checks |
| npm run seed:spam | Seed spam and duplicate detection scenario |
| npm run seed:sentiment | Seed sentiment-mix scenario |
| npm run seed:trend | Seed trend-analysis scenario |
| npm run seed:extra | Seed additional reviews |
| npm run seed:botspam | Seed bot and promotional spam demo |
| npm run cron:reviews | Start maintenance worker (every 5 minutes) |

## Demo Accounts Used by Seed Scripts

- admin@echosight.com / admin123
- seller@echosight.com / seller123
- Customer accounts vary by seed scenario and use customer123

## API Surface (High Level)

| Area | Endpoints |
|---|---|
| Health | GET /api/health |
| Auth | POST /api/auth/register, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me |
| Customer | GET /api/customer/products, GET /api/customer/products/:id, POST /api/customer/reviews, GET /api/customer/reviews, POST /api/customer/questions/ask |
| Seller | GET/POST /api/seller/products, PUT/DELETE /api/seller/products/:id, GET /api/seller/stats, GET /api/seller/trends, GET /api/seller/products/:id/analytics, GET /api/seller/reviews, PATCH /api/seller/reviews/:id/reply |
| Admin | GET /api/admin/stats, GET /api/admin/reviews, GET/PATCH/DELETE /api/admin/reviews/:id, POST /api/admin/moderation/bulk-action |
| Alerts | GET /api/alerts, PATCH /api/alerts/:id/read, GET /api/seller/alerts, PATCH /api/seller/alerts/:id/read |
| Internal | POST /api/internal/review-maintenance |

## Review Processing Lifecycle

1. Customer submits review.
2. Review is created in pending state.
3. Web service calls AI fake-detection endpoint.
4. Review is either:
   - approved immediately, or
   - flagged for moderation queue.
5. For approved reviews:
   - tags are generated,
   - feature sentiments are stored,
   - low-rating trusted reviews can receive delayed auto-response.
6. Scheduled maintenance handles:
   - pending timeout auto-approvals,
   - publishing due auto-responses,
   - cancelling invalid scheduled responses.

## Operational Notes

- If AI service is unavailable, reviews are still accepted and routed to pending moderation.
- Trend analytics pages expect trend snapshots in the trends collection.
- Maintenance endpoint can be protected by CRON_SECRET header x-cron-secret.
- For production, use secure cookie settings and strong JWT secret.

## Quick Start Order

1. Start AI engine first.
2. Start web module.
3. Run one seed script.
4. Log in with seeded admin or seller credentials.