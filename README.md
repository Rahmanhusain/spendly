This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# 🧾 Spendly - AI-Powered Expense Manager SaaS

**India-first**, mobile-first receipts & expenses platform. Instant AI parsing, real-time policy checks, team approvals, and GST compliance—all without e-invoice APIs.
**Subscription**: 15-day free trial with full feature access  
**Tech**: Next.js 16 + PostgreSQL + Redis + Groq LLM  
**MVP Timeline**: 6 weeks | **Status**: In Development (Week 1)
**Status**: In Development — Core report collaboration implemented

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env.local
# Edit .env.local and fill:
#   DATABASE_URL=postgresql://user:pass@localhost:5432/spendly
#   REDIS_URL=redis://localhost:6379
#   JWT_SECRET=<32-char secret>
#   GROQ_API_KEY=<from console.groq.com>

# 3. Setup database
npm run db:setup && npm run db:seed

# 4. Start development
npm run dev
# → Open http://localhost:3000
```

---

## ✨ Key Features (MVP - 6 Weeks)

### Weeks 1: Foundation

- **Team & Org Setup** - Multi-tenant, roles (Employee/Manager/Admin), invite via magic links
- **Receipt Uploads** - Mobile-first (drag-drop + choose file), instant AI parsing with required contextual notes

### Weeks 2-3: Business Logic

- **Reports & Approvals** - Group receipts, submit for approval, live threaded comments
- **Real-time Policy Checks** - "⚠️ Exceeds meal limit by ₹50" (instant feedback)
- **Duplicate Detection** - Flags same vendor + amount + date within 7 days

### Week 3: Regulatory

- **GST Compliance** - Auto-capture CGST/SGST/IGST, custom PDF export (no e-invoice API)
- **Policy Rules** - Set: "Meals ≤ ₹800/day", "Travel ≤ ₹15,000/month"

### Week 4: UX

- **Dashboards** - Total spent, budget %, category breakdown, trends, team insights
- **Exports** - CSV + beautiful PDF reports

### Weeks 4-6: Polish

- **PWA** - Install on mobile, works offline
- **Weekly Email Summary** - "Team spent ₹48,200. 3 violations. Top: Travel."
- **Dark Mode** + responsive mobile UI

---

## 📚 Documentation

**→ Start here: [IMPLEMENTATION.md](./IMPLEMENTATION.md)** - Full architecture, database schema, API reference

| Document                                 | Purpose                                           |
| ---------------------------------------- | ------------------------------------------------- |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Architecture, tech stack, API design, deployment  |
| [STORIES.md](./STORIES.md)               | Story index, 6-week roadmap, trial model          |
| `docs/stories/`                          | Individual story chapters with real-life examples |
| [docs/DATABASE.md](./docs/DATABASE.md)   | Database schema, migrations, RLS policies         |
| [docs/API.md](./docs/API.md)             | Complete API endpoint reference                   |

---

## 📋 NPM Scripts

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Production build
npm start                # Run production build
npm run lint             # Run linter
npm run lint:fix         # Fix lint errors

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:api         # API tests only
npm run test:coverage    # Coverage report

# Database
npm run db:setup         # Create schema + RLS policies
npm run db:seed          # Load sample data
npm run db:validate      # Validate database state

# Progress Tracking
npm run log:feature "Feature Name" "COMPLETED" "2h"  # Log feature
npm run story:status     # View all story statuses
npm run log:daily        # Show today's progress
```

---

## 🏗️ Project Structure

```
app/                 # Next.js app directory (frontend + API routes)
├── api/            # Backend API endpoints
├── (auth)/         # Login/register pages
└── (dashboard)/    # Protected pages

services/           # Companion services, including the NestJS realtime app

lib/                 # Shared utilities
├── auth/           # JWT, authentication, middleware
├── db/             # PostgreSQL client, migrations
├── ai/             # OCR, categorization, fraud detection
├── agents/         # Multi-agent orchestration, job queue
├── validators/     # Input validation schemas
└── utils/          # Helpers, logger

components/         # React UI components
tests/              # Jest tests
docs/               # Detailed documentation
scripts/            # Setup & logging scripts
logs/               # Progress tracking (git-ignored)

IMPLEMENTATION.md   # Full technical specification
STORIES.md          # Story breakdown & development plan
```

---

## 🎯 Development Workflow

### 1. Pick a Story

Open [STORIES.md](./STORIES.md) and choose a story from the current sprint.

### 2. Create Feature Branch

```bash
git checkout -b feature/story-name
npm run log:feature "Story Name" "STARTED"
```

### 3. Develop & Test

```bash
npm run dev          # Start dev server
npm test             # Run tests
npm run db:validate  # Check database
```

### 4. Log Progress

```bash
npm run log:feature "Story Name" "IN_PROGRESS"
# ... develop ...
npm run log:feature "Story Name" "COMPLETED" "2h 30m"
```

### 5. Commit & Push

```bash
git add . && git commit -m "Story: Feature Name - COMPLETED [2h 30m]"
git push origin feature/story-name
```

---

## ✨ Core Features

### MVP (Week 8)

- ✅ User authentication (JWT-based)
- ✅ Multi-tenant isolation (PostgreSQL RLS)
- ✅ Receipt upload & OCR processing
- ✅ Expense report management
- ✅ Multi-level approval workflows
- ✅ Expense categorization agent

### Phase 1-2 (Week 12)

- 🔄 Policy validation agent
- 🔄 Real-time team collaboration through a separate NestJS service
- 🔄 Analytics & dashboards
- 🔄 Fraud detection agent

### Phase 3 (Week 20)

- 🔄 Predictive forecasting
- 🔄 Cost optimization agent
- 🔄 GST e-invoicing (India)
- 🔄 Comprehensive audit logs
- 🔄 Security hardening & scaling

---

## 🔐 Key Architecture

### Multi-Tenancy

**PostgreSQL RLS** with `tenant_id` on all tables for data isolation.

```sql
-- Every query automatically scoped: WHERE tenant_id = current_tenant()
```

### Authentication

**JWT-based** (no OAuth). Stateless, scalable, secure.

- Access token: 7 days expiry
- Refresh token: 30 days expiry, stored in Redis

### AI Services

**Groq LLM** for fast, cost-effective inference:

- Receipt OCR + field extraction
- Expense categorization
- Policy validation
- Forecasting

### Job Queue

**Bull** (Redis-backed) for async processing:

- Receipt OCR jobs
- Policy validation
- Report generation

---

## 📊 Progress Tracking

View project progress:

```bash
npm run story:status    # All stories with status
npm run log:daily       # Today's completed work
cat logs/progress.log   # Raw daily log
```

Files:

- `logs/progress.log` - Daily development log
- `logs/feature-completion.json` - Story status (JSON)
- `logs/errors.log` - Error tracking

---

## 🧪 Testing

```bash
# Unit tests
npm test -- tests/lib/auth/jwt.test.ts

# API tests
npm run test:api

# Integration tests
npm test -- tests/integration/

# Coverage report
npm run test:coverage
open coverage/index.html
```

---

## 🚢 Deployment

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t spendly .
docker run -p 3000:3000 \
	-e DATABASE_URL="..." \
	-e REDIS_URL="..." \
	spendly:latest
```

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for cloud deployment (AWS/GCP/Azure).

---

## 🤝 Contributing

1. Follow the **Development Workflow** above
2. Write tests for all new features
3. Include JSDoc comments for complex functions
4. Log feature completion: `npm run log:feature`
5. Follow TypeScript strict mode

---

## 📝 Code Standards

### Comments

Every complex function needs JSDoc:

```typescript
/**
 * Process receipt image through OCR + LLM pipeline
 * @param file - Receipt image buffer
 * @param tenantId - Tenant context
 * @returns Structured receipt data with confidence score
 */
```

### Error Handling

Use centralized error handler:

```typescript
try { ... } catch (error) {
	return handleError(error, res, context);
}
```

### Types

Always define TypeScript interfaces:

```typescript
interface Receipt {
  id: string;
  tenant_id: string;
  amount: number;
}
```

---

## ❓ FAQ

**Q: Where do I start?**  
A: Read [IMPLEMENTATION.md](./IMPLEMENTATION.md) for architecture, then [STORIES.md](./STORIES.md) for next sprint.

**Q: How do I log progress?**  
A: Use `npm run log:feature "Name" "STATUS" "time"`. Check `logs/progress.log`.

**Q: What if I get stuck?**  
A: Check `logs/errors.log` for recent errors. Read relevant section in IMPLEMENTATION.md.

**Q: How do I commit?**  
A: `git commit -m "Story: Name - STATUS [time]"` (e.g., "Story: User Auth - COMPLETED [2h 45m]")

---

## 📞 Support

- **Issues**: Open GitHub issues
- **Documentation**: Check IMPLEMENTATION.md first
- **Discussions**: Use GitHub Discussions for design decisions

---

**Version**: 0.1.0 (In Development)  
**Last Updated**: April 14, 2026  
**Target MVP Release**: Week 8

→ **Next step**: Read [IMPLEMENTATION.md](./IMPLEMENTATION.md)
