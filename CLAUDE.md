# EAV Orchestrator Production Foundation - Development Instructions

<!-- PRODUCTION_FOUNDATION: Building enterprise video workflow system from proven architecture -->
<!-- STATUS: Core architecture validated ✅ | Implementing production workflow phases -->

**Project:** EAV Orchestrator Production Foundation
**Repository:** `/Volumes/HestAI-Projects/eav-orchestrator-mvp/dev/` (🟢 **ACTIVE PRODUCTION BUILD**)
**Purpose:** Production-grade video workflow system with paragraph=component architecture
**Last Updated:** 2025-09-26
**Status:** PRODUCTION BUILD - Architecture proven, expanding to complete workflow

## Current State Overview

### ✅ ARCHITECTURE PROVEN & OPERATIONAL
The paragraph=component model has been **successfully validated and is now in production use**:
- **TipTap Editor:** Single editor with component extraction working perfectly
- **Component Identity:** C1, C2, C3... stable throughout entire system lifecycle
- **Supabase Backend:** Scripts and components persisting with atomic saves
- **Authentication:** User management and secure access operational
- **SmartSuite Integration:** Project/video hierarchy loading from production workspace
- **Auto-Save:** Visual status indicators and reliable persistence

### 🚀 CURRENT FOCUS
**Phase 1: SmartSuite Production Integration** - Switching from test mode to live API connection with production workspace (s3qnmox1).

## Production Requirements (From North Star)

### Core Problem Being Solved
**EAV's video production workflow requires component-based script editing where each paragraph becomes a trackable production component (C1, C2, C3...) flowing seamlessly through Script → Review → Scenes → Voice → Edit phases with collaborative commenting throughout.**

### Immutable Production Requirements
1. **Paragraph=Component Model** - Every paragraph typed becomes a numbered component
2. **Single Editor Interface** - ONE TipTap editor (not component-by-component)
3. **Component Persistence** - Stable IDs throughout system lifecycle
4. **SmartSuite Integration** - Components sync to video production tables
5. **Collaborative Review** - Google Docs-like commenting for client review and edit direction
6. **Offline Capability** - Camera operators must work without internet connection

## Technology Stack

### Frontend
- **Framework:** React 18 + TypeScript (strict mode)
- **Build:** Vite for fast HMR and optimal bundles
- **Editor:** TipTap with custom component extensions
- **State:** React hooks with context for global state
- **Styling:** CSS3 with responsive design

### Backend
- **Database:** Supabase (PostgreSQL with RLS)
- **Auth:** Supabase Auth with email/password
- **Storage:** PostgreSQL for scripts and components
- **API:** Supabase client SDK with real-time subscriptions

### Integration
- **SmartSuite:** Workspace s3qnmox1 (Projects: 68a8ff5237fde0bf797c05b3, Videos: 68b2437a8f1755b055e0a124)
- **ElevenLabs:** Voice generation API (Phase 6)

### Testing
- **Framework:** Vitest with Testing Library
- **Current Coverage:** 35 tests passing
- **Focus:** Architecture validation over coverage metrics

## File Structure

```
dev/                                 # Active production build
├── src/
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── TipTapEditor.tsx   # ✅ Core editor with component extraction
│   │   │   └── EditorToolbar.tsx  # ✅ Formatting controls
│   │   ├── Layout/
│   │   │   ├── Navigation.tsx     # ✅ Project/video selection
│   │   │   └── TabLayout.tsx      # 🚧 Script/Review/Scenes/Voice/Edit tabs
│   │   └── SmartSuite/
│   │       └── SyncPanel.tsx      # 🚧 Component sync interface
│   ├── lib/
│   │   ├── supabase.ts            # ✅ Database client and auth
│   │   ├── smartsuite.ts          # 🚧 API integration (switching to live)
│   │   └── components.ts          # ✅ Component extraction logic
│   ├── hooks/
│   │   ├── useAutoSave.ts         # ✅ Debounced save with status
│   │   └── useProjects.ts         # ✅ Project/video data fetching
│   ├── types/
│   │   └── index.ts               # ✅ TypeScript definitions
│   └── App.tsx                    # ✅ Main application shell
├── supabase/
│   └── migrations/                # ✅ Database schema (5 tables)
├── .env.example                   # ✅ Environment template
└── CLAUDE.md                      # 📍 This file
```

## Environment Configuration

```bash
# Supabase (Production)
# NOTE: Supabase has migrated from anon/service_role to publishable/secret keys
VITE_SUPABASE_URL=https://zbxvjyrbkycbfhwmmnmy.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[your_publishable_key]  # Client-side (successor to anon_key)
SUPABASE_SECRET_KEY=[your_secret_key]                  # Server-side only for webhooks (successor to service_role)

# SmartSuite (Production Workspace)
VITE_SMARTSUITE_API_KEY=[your_api_key]
VITE_SMARTSUITE_WORKSPACE_ID=s3qnmox1
VITE_SMARTSUITE_PROJECTS_TABLE=68a8ff5237fde0bf797c05b3
VITE_SMARTSUITE_VIDEOS_TABLE=68b2437a8f1755b055e0a124
SMARTSUITE_WEBHOOK_SECRET=[your_webhook_secret]        # For webhook signature verification

# ElevenLabs (Future)
VITE_ELEVENLABS_API_KEY=[future_implementation]
```

## Development Commands

```bash
# Initial Setup
npm install                    # Install dependencies
cp .env.example .env          # Configure environment
npm run supabase:types        # Generate TypeScript types

# Development
npm run dev                   # Start dev server (http://localhost:5173)
npm run test                  # Run test suite
npm run test:watch           # Watch mode for TDD

# Quality Gates
npm run typecheck            # TypeScript validation
npm run lint                 # ESLint checks
npm run lint:fix            # Auto-fix issues
npm run validate            # All checks (must pass before commit)

# Build
npm run build               # Production build
npm run preview            # Preview production build
```

## Implementation Roadmap

### ✅ Completed
- Core paragraph=component architecture
- TipTap editor with component extraction
- Supabase integration with auth
- Project/video navigation
- Auto-save functionality
- Component identity preservation

### ✅ Current Phase (1): SmartSuite Webhook Integration
- [x] Frontend reads from Supabase only (single source of truth)
- [x] Webhook endpoint receives SmartSuite changes
- [x] Real-time sync via SmartSuite automations
- [x] Manual sync button as fallback option
- [x] Configure SmartSuite webhook automations

### 📋 Upcoming Phases
2. **Workflow Implementation** (7-8 days) - All 5 workflow tabs
3. **Collaborative Comments** (5-6 days) - Google Docs-like system
4. **Offline Capability** (4-5 days) - PWA for field work
5. **Access Control** (3-4 days) - Role-based permissions
6. **Voice Generation** (2 days) - ElevenLabs integration
7. **Quality Assurance** (3 days) - Performance validation
8. **Security Hardening** (3-4 days) - Production security
9. **Deployment Prep** (3 days) - Documentation and handoff

**Total Timeline:** 35-45 days to production readiness

## Architecture Principles

### ✅ Validated Patterns (Keep Using)
1. **Single TipTap Editor** - Unified editing experience
2. **Server-Side Extraction** - Components extracted by database
3. **Atomic Saves** - All-or-nothing persistence
4. **Direct Error Reporting** - Immediate visibility during development
5. **Component ID Stability** - C1 remains C1 forever

### ❌ Anti-Patterns (Never Implement)
1. **Component-by-Component UI** - Creates state management hell
2. **Multiple Sources of Truth** - Causes synchronization issues
3. **Circuit Breaker Masking** - Hides real problems
4. **Client-Side Extraction** - Unreliable and complex
5. **Silent Failures** - Always validate and report

## Quality Standards

### Every Commit Must
- ✅ Pass TypeScript compilation (zero errors)
- ✅ Pass ESLint checks (zero warnings)
- ✅ Pass all existing tests
- ✅ Include clear commit message
- ✅ Maintain component ID stability

### Before Phase Completion
- ✅ All acceptance criteria met
- ✅ User-facing features tested manually
- ✅ Performance acceptable (<50ms typing latency)
- ✅ No console errors or warnings
- ✅ Documentation updated

## Current Development Priorities

### Immediate (Today)
1. Complete SmartSuite API connection switch
2. Test with production workspace data
3. Verify component sync to production tables

### This Week
1. Achieve Phase 1 completion (SmartSuite Integration)
2. Begin Phase 2 (Workflow Implementation)
3. Gather user feedback on current functionality

### Decision Points
- After Phase 1: Is SmartSuite integration sustainable?
- After Phase 3: Is collaboration pattern working?
- After Phase 7: Ready for production deployment?

## Known Issues & Workarounds

### Current Issues
- **Auto-refresh race condition** - Multiple project fetches on mount
- **Bundle size** - 923KB, needs code-splitting for optimization

### Resolved Issues (2025-09-27)
- ✅ **406 Error on Scripts** - Fixed by using `.maybeSingle()` instead of `.single()` for queries that might return 0 rows
- ✅ **RLS Policies** - Migration 20250927130000 properly handles admin/client access
- ✅ **NavigationSidebar warnings** - Improved error handling for missing eav_code
- ✅ Edge Functions crash (switched to client-side)
- ✅ ESLint suppressions (cleaned up with reset)
- ✅ RLS policies blocking saves (fixed permissions)

## Important Database Query Patterns

### Avoiding 406 Errors
When querying for records that might not exist:
```typescript
// ❌ WRONG - Will throw 406 if no rows found
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('id', someId)
  .single();  // Expects exactly 1 row

// ✅ CORRECT - Handles 0 or 1 rows gracefully
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('id', someId)
  .maybeSingle();  // Returns null if no rows, data if 1 row
```

### RLS Policy Structure
The current RLS policies follow this pattern:
- **Admin users**: Full access (SELECT, INSERT, UPDATE, DELETE) on all tables
- **Client users**: Read-only (SELECT) on projects/videos/scripts they're assigned to via `user_clients` table
- **Anonymous users**: No access to any data

Always test with both service key (bypasses RLS) and anon key (enforces RLS) when debugging access issues.

## Team Notes

**User Feedback:** *"Working really well. Better than I could have thought."* - After initial demo

**Architecture Status:** Core model proven successful. The paragraph=component approach works intuitively and maintains stability throughout the workflow.

**Next Milestone:** Complete SmartSuite production integration and verify component flow to production tables.

---

**Key Principle:** This is a PRODUCTION BUILD. Every line of code, every architectural decision, and every feature must meet production standards. We've proven the architecture works - now we're building the complete system with zero technical debt.

---

*For detailed requirements see: `.coord/workflow-docs/000-EAV_ORCHESTRATOR_PRODUCTION_FOUNDATION-D1-NORTH-STAR.md`*
*For project context see: `.coord/PROJECT-CONTEXT.md`*
*For roadmap see: `.coord/PROJECT-ROADMAP.md`*