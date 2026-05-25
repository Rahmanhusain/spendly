# 🚀 Getting Started with Spendly Development

Welcome to Spendly! This guide gets you up and running in 10 minutes.

---

## ✅ Prerequisites

Make sure you have these installed:

- **Node.js 18+**: [Download](https://nodejs.org/)

  ```bash
  node --version  # Should be v18+
  ```

- **PostgreSQL 14+**: [Download](https://www.postgresql.org/download/)

  ```bash
  psql --version  # Should be 14+
  ```

- **Redis 6+**: [Download](https://redis.io/) or use Docker

  ```bash
  # With Docker (recommended)
  docker run -d -p 6379:6379 redis:latest

  # Or install locally
  redis-server  # In separate terminal

  # Test connection
  redis-cli ping  # Should return PONG
  ```

---

## 📋 Initial Setup (10 min)

### 1. Clone Repository (1 min)

```bash
git clone <https://github.com/your-org/spendly.git>
cd spendly
```

### 2. Install Dependencies (2 min)

```bash
npm install
# or: yarn install
```

### 3. Environment Setup (2 min)

Copy example env file:

```bash
cp .env.example .env.local
```

Open `.env.local` in your editor and fill in:

```env
# PostgreSQL (create database first)
DATABASE_URL=postgresql://spendly_user:password@localhost:5432/spendly

# Redis (from step above)
REDIS_URL=redis://localhost:6379

# JWT Secret (generate: openssl rand -hex 32)
JWT_SECRET=<copy-output-from-openssl>

# AI Services
GROQ_API_KEY=sk-...  # Get from https://console.groq.com/

# Dev Environment
NODE_ENV=development
```

### 4. Create PostgreSQL Database

```bash
# Create user (one-time)
createuser spendly_user -P
# Enter password when prompted

# Create database
createdb -O spendly_user spendly

# Verify
psql spendly -U spendly_user -c "SELECT 1"
# Should return: 1
```

### 5. Initialize Database (2 min)

```bash
npm run db:setup        # Create tables + RLS policies
npm run db:seed         # Load sample data

# Verify
npm run db:validate     # Should show ✅ All systems green
```

### 6. Start Development Server (2 min)

```bash
npm run dev
# Output: ▲ Next.js 16.2.3
#         - Local: http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎯 Your First Task

### 1. Verify Setup

```bash
npm run db:validate      # Check database
npm run story:status     # View sprint tasks
npm run log:daily        # See today's log
```

### 2. Read Documentation

1. [IMPLEMENTATION.md](../IMPLEMENTATION.md) - Architecture overview (15 min read)
2. [STORIES.md](../STORIES.md) - Current sprint stories (pick one)

### 3. Pick a Story

Open [STORIES.md](../STORIES.md), find the current sprint, choose a story.

Example: `S-1.1: Project Setup & Environment Configuration`

### 4. Create Feature Branch

```bash
git checkout -b feature/project-setup
npm run log:feature "Project Setup" "STARTED"
```

### 5. Make Your Changes

```bash
# Edit files in app/, lib/, components/, etc.

# Test your changes
npm test                 # Run all tests
npm run lint             # Check code style
npm run dev              # See changes live
```

### 6. Log & Commit

```bash
npm run log:feature "Project Setup" "COMPLETED" "2h"
git add .
git commit -m "Story: Project Setup - COMPLETED [2h]"
git push origin feature/project-setup
```

---

## 📚 Key Files to Know

| File                                      | Purpose                               |
| ----------------------------------------- | ------------------------------------- |
| [README.md](../README.md)                 | Project overview & quick reference    |
| [IMPLEMENTATION.md](../IMPLEMENTATION.md) | Full architecture & technical details |
| [STORIES.md](../STORIES.md)               | All 20 development stories            |
| [.env.example](../.env.example)           | Environment variables template        |
| [package.json](../package.json)           | Dependencies & npm scripts            |
| [logs/progress.log](../logs/progress.log) | Development log                       |

---

## 🛠️ Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Run production build

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode (auto re-test)
npm run test:coverage    # Coverage report

# Database
npm run db:setup         # Create schema
npm run db:seed          # Load sample data
npm run db:validate      # Check health

# Code Quality
npm run lint             # Check code (ESLint)
npm run lint:fix         # Auto-fix issues

# Progress Tracking
npm run log:feature "Name" "STARTED"
npm run log:feature "Name" "COMPLETED" "2h"
npm run story:status     # View story statuses
npm run log:daily        # Today's progress
```

---

## 🐛 Troubleshooting

### PostgreSQL Connection Error

```bash
# Error: could not connect to server
# Solution: Check PostgreSQL is running

# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Verify
psql --version
```

### Redis Connection Error

```bash
# Error: connection refused
# Solution: Start Redis

# Docker (recommended)
docker run -d -p 6379:6379 redis:latest

# Or local installation
redis-server

# Verify
redis-cli ping  # Should return PONG
```

### Database Already Exists

```bash
# Error: database "spendly" already exists
# Solution: Drop and recreate

dropdb spendly
createdb -O spendly_user spendly
npm run db:setup
```

### Port Already in Use

```bash
# Error: Port 3000 already in use
# Solution: Use different port

npm run dev -- -p 3001
# http://localhost:3001
```

---

## 🚀 Next Steps

1. ✅ Setup complete!
2. 📖 Read [IMPLEMENTATION.md](../IMPLEMENTATION.md) - understand architecture
3. 📋 Check [STORIES.md](../STORIES.md) - pick your first story
4. 💻 Create feature branch and start coding
5. 📝 Log progress: `npm run log:feature`
6. 🔄 Commit & push when done

---

## ❓ Questions?

- **Setup issues**: Check [IMPLEMENTATION.md](../IMPLEMENTATION.md) "Development Setup" section
- **How to log progress**: `npm run log:feature "Name" "STATUS" "time"`
- **What to build next**: Open [STORIES.md](../STORIES.md)
- **Code questions**: Check relevant .ts file comments (every function has JSDoc)

---

## 📊 Verify You're Ready

Run this to confirm setup:

```bash
npm run dev              # Should start without errors
npm run story:status     # Should show sprint stories
npm run db:validate      # Should show ✅ All systems green
npm test                 # Should run tests
```

All green? 🎉 You're ready to start developing!

---

**Quick tip**: Keep this guide + [README.md](../README.md) bookmarked. They have all the commands you'll need.

---

_Last Updated: May 25, 2026_  
_Getting Help: See README.md or IMPLEMENTATION.md_
