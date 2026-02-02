# Itemize-It

Expense tracking app for solopreneurs (contractors, lawyers, consultants) focused on item-level splitting of receipts to prevent margin leakage.

## Design System: Precision Industrial

- Dark mode default
- Tabular numbers for financial data
- High-contrast Safety Orange accents

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm workspaces |
| Web | Next.js 15 (App Router) + Tailwind CSS |
| Mobile | Expo SDK 52 + NativeWind v4 |
| Backend | Supabase (Auth, DB, Storage) |

## Project Structure

```
/itemize-it
├── apps/
│   ├── web/          # Next.js - Marketing & Web Dashboard
│   └── mobile/       # Expo - iOS/Android App
├── packages/
│   ├── config/       # Shared Tailwind preset + ESLint config
│   ├── ts-types/     # Shared TS interfaces & Supabase types
│   ├── ui/           # Shared UI components (skeleton)
│   └── utils/        # Shared pure functions
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm 9.x (`npm install -g pnpm`)
- Expo CLI (`npm install -g expo-cli`) - optional, for mobile development
- Supabase CLI (`npm install -g supabase`) - for type generation

### Installation

```bash
# Install all dependencies
pnpm install
```

### Development

```bash
# Run all apps in development mode
pnpm dev

# Run only web
pnpm dev:web

# Run only mobile
pnpm dev:mobile
```

### Build

```bash
# Build all apps
pnpm build
```

## Supabase Setup

```bash
# 1. Initialize Supabase (creates supabase/ folder)
pnpm supabase:init

# 2. Link to your Supabase project
# First, update YOUR_PROJECT_REF in root package.json, then:
pnpm supabase:link

# 3. Generate TypeScript types
pnpm supabase:gen-types
```

Types are generated to `packages/ts-types/src/supabase.ts` and exported from `packages/ts-types`.

## Design System Colors

| Token | Hex | Usage |
|-------|-----|-------|
| asphalt | #1a1a1a | Primary background |
| gunmetal | #2d2d2d | Card backgrounds |
| edge-steel | #404040 | Borders, dividers |
| safety-orange | #ff6b00 | Primary accent, CTAs |
| white | #ffffff | Primary text |
| concrete | #9ca3af | Secondary text |
| safe | #22c55e | Success states |
| warn | #eab308 | Warning states |
| critical | #ef4444 | Error states |

## Mobile Assets

Before running the mobile app, add the following images to `apps/mobile/assets/`:

- `icon.png` (1024x1024) - App icon
- `splash-icon.png` (512x512) - Splash screen icon
- `adaptive-icon.png` (1024x1024) - Android adaptive icon
- `favicon.png` (48x48) - Web favicon
