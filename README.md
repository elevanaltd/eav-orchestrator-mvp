# EAV Orchestrator - Production Video Workflow System

**Status:** Phase 2 Complete | Production-Ready Foundation | Phase 3 Architecture Approved  
**Live:** https://eav-orchestrator-mvp.vercel.app/

A production-grade web application for managing video production workflows from initial script creation through final editing.  Built for EAV (a video production company) to streamline their component-based workflow where each paragraph of script becomes a trackable production component (C1, C2, C3...) flowing through Script → Review → Scenes → Voice → Edit phases.

## 🎯 What is EAV Orchestrator?

EAV Orchestrator transforms video production workflow management by treating **every paragraph as a production component** with stable identity throughout the entire lifecycle. The system enables:

- **Script Creation:** Google Docs-like editor with automatic component extraction
- **Client Collaboration:** Real-time commenting system for client review and feedback
- **Data Entry Hub:** Comprehensive project specification entry (180+ fields) - Phase 3
- **Workflow Management:** Unified interface tracking components through production phases
- **Team Coordination:** Real-time collaboration with permission-based access control

### Core Innovation: Paragraph = Component Model

Every paragraph typed becomes a numbered component (C1, C2, C3...) that maintains stable identity as it flows through:

```
Script Tab → Review (Comments) → Scenes Tab → Voice Tab → Edit Tab
   C1              C1                 C1          C1         C1
   C2              C2                 C2          C2         C2
   C3              C3                 C3          C3         C3
```

This 1:1 mapping ensures perfect traceability from initial script through final edited video.

## ✅ What's Built (Production-Ready)

### Phase 1: SmartSuite Integration ✅
- Real-time webhook sync from SmartSuite → Supabase
- 24 production projects syncing automatically  
- Dynamic field mapping (no code changes for new SmartSuite fields)

### Phase 2: Collaboration System ✅
- **Google Docs-Style Commenting:** Threaded discussions with replies, resolve/unresolve
- **Position Tracking:** Comments follow text as it's edited (ProseMirror transaction mapping)
- **Real-time Sync:** Multi-user collaboration with instant comment updates
- **Connection Resilience:** Automatic reconnection with exponential backoff
- **Security:** 9/10 security score with RLS enforcement

### Phase 2.9: Database Hardening ✅
- RLS performance: 17 policies optimized (50-100ms improvement at scale)
- Policy consolidation: 20+ policies merged (50% overhead reduction)  
- Security: All SECURITY DEFINER functions protected
- Supabase linter: 0 errors, 0 warnings

### Current Quality Metrics

**Test Suite:** 346/463 passing (75%)
- 346 regression tests (behavior parity protection)
- 117 skipped tests (TDD RED phase - pending features)
- 0 failing tests

**Code Quality:**
- TypeScript: Zero errors (strict mode)
- ESLint: Zero warnings
- Bundle: 865KB optimized

**Production Status:**
- Live on Vercel with auto-deploy
- Supabase PostgreSQL with RLS
- Real-time collaboration validated
- 9/10 security score

## 🚀 What's Planned

### Phase 2.95B: Architectural Refactor 🎯 NEXT (3-4 days)
**Status:** Architecture approved by critical-engineer + test-methodology-guardian

**Objective:** Consolidate state management before Phase 3 expansion

**Technology:** TanStack Query + Zustand + Hardened Realtime Provider

**Quality:** DUAL-SUITE validation (both old and new tests must pass)

### Phase 3: Data Entry Hub (16-21 days)

#### Phase 3A: Data Entry Infrastructure (5-6 days)
- Relational schema for 180+ fields
- Section-based navigation with progressive disclosure
- Auto-save, progress tracking, completion indicators

#### Phase 3B: AI Auto-Population (3-4 days)
- PDF/Word document processing
- LLM field extraction via Supabase Edge Functions
- Client approval UI with confidence scoring

#### Phase 3C: Module System + Script Generation (4-5 days)
- Template library with variable substitution
- Script generation from data entry
- Generated scripts → TipTap editor with C1, C2, C3... components

#### Phase 3D: Workflow Tabs (4-5 days)
- Voice Tab: ElevenLabs integration
- Scenes Tab: Component breakdown  
- Edit Tab: Final review + export

### Phase 4-6: Production Enhancement (8-11 days)
- Voice generation polish
- Field operations (offline PWA)
- Production monitoring and optimization

**Total Timeline:** 30-37 days to full production

## 🏗️ Technical Stack

**Frontend:** React 18, TypeScript, Vite, TipTap, Zustand (Phase 2.95B), TanStack Query (Phase 2.95B)

**Backend:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions)

**Integration:** SmartSuite workspace s3qnmox1, ElevenLabs (Phase 3D)

**Database:** 7 tables (projects, videos, scripts, script_components, comments, user_profiles, user_clients)

**User Roles:**  
- **Admin:** Internal team - full access
- **Employee:** Internal team - assigned projects  
- **Client:** External - read-only, can comment

## 🚀 Quick Start

```bash
# Install & configure
npm install
cp .env.example .env
# Add VITE_SUPABASE_PUBLISHABLE_KEY and VITE_SMARTSUITE_API_KEY

# Start development  
npm run dev         # Visit http://localhost:5173

# Quality gates (must pass before commit)
npm run validate    # Runs lint + typecheck + tests
```

## 📚 Documentation

- **Development Guide:** [CLAUDE.md](./CLAUDE.md) - Comprehensive instructions
- **Project Context:** [../coordination/PROJECT-CONTEXT.md](../coordination/PROJECT-CONTEXT.md) - Current state
- **Roadmap:** [../coordination/PROJECT-ROADMAP.md](../coordination/PROJECT-ROADMAP.md) - Phase timeline

## 🎯 Success Metrics

### Architecture Validation ✅
- Paragraph=component model working intuitively
- Component identity stable (C1 remains C1)
- Google Docs-like editing experience
- Real-time collaboration validated in production

### User Validation ✅
- *"Working really well. Better than I could have thought."*
- *"This is fixed. Works really well."*  
- *"No console errors at all."*
- *"Everything working fine."*

## 🏛️ Key Decisions

### ✅ Validated Patterns
1. Single TipTap editor (not component-by-component)
2. Y.js document authority (single source of truth)
3. Position-based comments with recovery
4. Webhook architecture for SmartSuite sync
5. Two-role security with RLS
6. Four-layer implementation (Database → Types → UI → Tests)

### ❌ Anti-Patterns (Never Use)
1. Component-by-component editing UI
2. Circuit breaker masking
3. Service key bypasses in tests
4. Multiple sources of truth
5. Migration accumulation

## 🤝 Contributing

Development follows strict constitutional protocols:
- **TDD Mandatory** - Tests before code
- **Quality Gates** - All must pass  
- **Atomic Commits** - Conventional format
- **Constitutional Compliance** - TRACED protocol

See [CLAUDE.md](./CLAUDE.md) for detailed standards.

---

**Built with constitutional methodology | Validated in production | Ready for Phase 3**
