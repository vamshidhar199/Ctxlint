# Project Overview

This is a TypeScript web application built with React 18, Next.js 14, Tailwind CSS, and PostgreSQL. We use Prisma as our ORM and Vitest for testing.

## Tech Stack
- Frontend: React 18 with TypeScript
- Framework: Next.js 14 (App Router)
- Styling: Tailwind CSS
- Database: PostgreSQL with Prisma ORM
- Testing: Vitest + React Testing Library
- Deployment: Vercel

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   └── users/
│   ├── dashboard/
│   └── layout.tsx
├── components/
│   ├── ui/
│   └── forms/
├── lib/
│   ├── db.ts
│   ├── auth.ts
│   └── utils.ts
├── hooks/
│   ├── useAuth.ts
│   └── useForm.ts
└── types/
    └── index.ts
```

## Code Style
- Use 2-space indentation
- Prefer const over let
- Use single quotes for strings
- Always add trailing commas
- Use camelCase for variables and functions
- Use PascalCase for components and classes
- Maximum line length: 100 characters
- Always use semicolons

## Getting Started
This project is built with React and Next.js. It uses TypeScript for type safety and Tailwind CSS for styling. The database is PostgreSQL accessed through Prisma ORM.

## Build Commands
- Install: `npm run install`
- Dev: `npm run dev`
- Test: `npm run test:integration`
- Build: `npm run build`
- Lint: `npm run format`

## API Documentation
See the `src/old-api/` directory for API route handlers. The middleware in `src/middleware/legacy-auth.ts` handles authentication.
