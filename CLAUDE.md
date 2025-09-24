# EAV Orchestrator MVP - Development Instructions

<!-- MVP_WORKSPACE_DECLARATION: Clean-slate architecture validation project -->
<!-- PARENT_PROJECT_LEARNINGS: Applied from /Volumes/HestAI-Projects/eav-orchestrator/coordination/240-DOC-BUILD-LEARNINGS-AND-RESTART-BLUEPRINT.md -->

**Project:** EAV Orchestrator MVP - Paragraph=Component Architecture Validation
**Repository:** `/Volumes/HestAI-Projects/eav-orchestrator-prototype/build/` (🟢 **ACTIVE MVP REPOSITORY**)
**Purpose:** Clean-slate validation of core architecture before production implementation
**Last Updated:** 2025-09-24 (Workspace Creation Complete)
**Status:** MVP PHASE - Architecture validation with simplified methodology

## Project Context & Mission

### 🎯 MVP MISSION
This MVP exists to **validate the fundamental architecture** for EAV Orchestrator before investing in full production implementation. Based on extensive learnings from a failed parent project, this MVP tests the **paragraph=component model** with minimal complexity.

### 📚 PARENT PROJECT RELATIONSHIP
- **Failed Build Location:** `/Volumes/HestAI-Projects/eav-orchestrator/dev-failed-reference/`
- **Key Learnings Applied:** Single TipTap editor, server-side component extraction, minimal database schema
- **Anti-Patterns Avoided:** Component-by-component editing, circuit breaker masking, migration chaos
- **Requirements Preserved:** Component flow (Script → Scenes → Voice → Edit), 1:1 mapping, Google Docs-like UX

## Architecture Validation Requirements

### ✅ CORE ARCHITECTURE (Must Prove)
```
USER TYPES → Single TipTap Editor → Y.js Document Structure → Component Extraction
                      ↓                    ↓                         ↓
             Google Docs-like UX    Single Source of Truth    Stable Component IDs (C1, C2, C3...)
                      ↓
             Components Flow: Script → Scenes → Voice → Edit (1:1 mapping)
```

### 🧪 VALIDATION CRITERIA
1. **Paragraph=Component Model Works Intuitively**
2. **Component Identity Preserved Through Extraction**
3. **TipTap Editing Feels Natural with Component Markers**
4. **Component Data Flows to SmartSuite Successfully**
5. **Architecture Scales to Production Requirements**

## Technology Stack (MVP-Specific)

### Frontend Stack
```yaml
Core:
  - React 18+ with TypeScript (strict mode)
  - Vite for fast development cycles
  - TipTap rich text editor with component extensions
  - Y.js for document structure (single-user initially)

Styling:
  - CSS3 with responsive design
  - Professional appearance for stakeholder demos
  - Component boundary visualization

Testing:
  - Vitest for fast feedback loops
  - Testing Library for component validation
  - Focus on architectural soundness
```

### Integration & Persistence
```yaml
SmartSuite:
  - Workspace: s3qnmox1
  - MVP Table: 68b2437a8f1755b055e0a124
  - Manual sync with visual feedback
  - Component extraction demonstration

Supabase_Later:
  - PostgreSQL for component storage
  - Y.js document persistence
  - Server-side component extraction functions
  - (Added in later MVP phases)
```

## MVP-Adapted Development Methodology

### Simplified TRACED Protocol
- **T**est: Core architectural validation tests (not comprehensive coverage)
- **R**eview: Self-review with critical engineering analysis
- **A**nalyze: Reference parent project learnings before decisions
- **C**onsult: Use parent project anti-patterns as guidance
- **E**xecute: Simplified quality gates focused on architecture
- **D**ocument: MVP-specific decisions and learnings

### Quality Gates (Streamlined)
```yaml
MUST_PASS:
  - TypeScript compilation with zero errors
  - Core architectural tests passing
  - TipTap editor functional and intuitive
  - Component extraction working
  - SmartSuite sync demonstrating data flow

MVP_FOCUS:
  - Architecture validation over feature completeness
  - User experience validation over comprehensive testing
  - Clear graduation path over production hardening
```

## Development Phases

### Phase 1: Core Architecture (Days 1-3) ✅
- [x] Basic TipTap editor with component structure
- [x] Component marker visualization (C1, C2, C3...)
- [x] SmartSuite integration framework
- [x] TypeScript and build system operational
- [ ] Component extraction from editor content
- [ ] Visual feedback for component boundaries

### Phase 2: Integration Validation (Days 4-5)
- [ ] Y.js document structure integration
- [ ] Component extraction to data structures
- [ ] SmartSuite sync operational with real data
- [ ] Component identity preservation verified
- [ ] Error handling clear and immediate

### Phase 3: User Experience Validation (Days 6-7)
- [ ] Editing experience smooth and intuitive
- [ ] Component boundaries clear but unobtrusive
- [ ] Professional appearance for stakeholder demo
- [ ] Performance baseline established
- [ ] Workflow demonstration ready

### Phase 4: Graduation Decision (Day 8)
- [ ] Architecture proven sound
- [ ] User experience validates approach
- [ ] Technical foundation stable
- [ ] Clear production implementation plan
- [ ] Learnings documented for full build

## Current File Structure

```
build/                              # Active MVP repository
├── src/
│   ├── components/
│   │   ├── TipTapEditor.tsx        # ✅ Core editor component
│   │   └── SmartSuiteSync.tsx      # ✅ Integration demo component
│   ├── lib/
│   │   └── smartsuite.ts           # ✅ SmartSuite integration logic
│   ├── test/
│   │   ├── setup.ts                # ✅ Test configuration
│   │   └── App.test.tsx            # ✅ Basic component tests
│   ├── App.tsx                     # ✅ Main application
│   ├── App.css                     # ✅ Application styles
│   ├── main.tsx                    # ✅ React entry point
│   └── index.css                   # ✅ Base styles
├── package.json                    # ✅ Dependencies and scripts
├── vite.config.ts                  # ✅ Build configuration
├── tsconfig.json                   # ✅ TypeScript configuration
├── .eslintrc.cjs                   # ✅ Linting rules
├── index.html                      # ✅ HTML template
├── .env.example                    # ✅ Environment variables template
└── CLAUDE.md                       # ✅ This file
```

## SmartSuite Integration Configuration

### Workspace Details
```yaml
Workspace_ID: s3qnmox1
Prototype_Table: 68b2437a8f1755b055e0a124
Sync_Pattern: Manual with visual feedback
Data_Flow: TipTap Components → Extracted Data → SmartSuite Records
Status_Tracking: Visual sync indicators and component count
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Add your SmartSuite API key
VITE_SMARTSUITE_API_KEY=your_api_key_here
```

## Development Commands

### Setup & Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev          # Starts at http://localhost:3000

# Run tests
npm run test         # Single run for validation
npm run test:watch   # Watch mode for development

# Code quality
npm run lint         # ESLint checking
npm run lint:fix     # Auto-fix linting issues
npm run typecheck    # TypeScript validation
npm run validate     # Run all quality checks
```

### MVP Validation Workflow
```bash
# 1. Validate core architecture
npm run validate     # Must pass all quality gates

# 2. Start development server
npm run dev

# 3. Test component extraction
# - Edit content in TipTap editor
# - Observe component extraction in SmartSuite sync panel
# - Verify component numbering (C1, C2, C3...)

# 4. Test SmartSuite integration
# - Click "Test Connection"
# - Verify workspace and table connection
# - Click "Sync Components"
# - Observe sync status and feedback
```

## Success Criteria Validation

### Architecture Validation Checklist
- [ ] **Single TipTap Editor:** One unified editing interface (not component-by-component)
- [ ] **Component Boundaries:** Clear visual separation without editing complexity
- [ ] **Component Identity:** Stable C1, C2, C3... numbering throughout
- [ ] **Content Extraction:** Paragraphs reliably convert to component data
- [ ] **SmartSuite Flow:** Components sync to correct table with proper structure

### User Experience Validation
- [ ] **Google Docs-like:** Smooth typing, familiar formatting, intuitive interface
- [ ] **Professional Appearance:** Suitable for client/stakeholder demonstrations
- [ ] **Component Clarity:** Component boundaries obvious but unobtrusive
- [ ] **Feedback Systems:** Clear visual indicators for sync status and operations
- [ ] **Performance Baseline:** Responsive editing with <50ms perceived latency

### Technical Foundation
- [ ] **Clean Architecture:** Single source of truth with clear data flow
- [ ] **TypeScript Safety:** Full type coverage with zero compilation errors
- [ ] **Test Coverage:** Core architectural patterns validated
- [ ] **Error Handling:** Development-friendly immediate error visibility
- [ ] **Graduation Path:** Clear steps to production-ready implementation

## Parent Project Anti-Patterns (AVOID)

### ❌ NEVER IMPLEMENT
1. **Component-by-Component Editing UI** (creates complex state management)
2. **Multiple Sources of Truth** (Y.js document is THE source)
3. **Circuit Breaker Error Masking** (development needs immediate errors)
4. **Migration File Accumulation** (clean schema approach)
5. **Silent Failure Logging** (validate operations, don't assume success)
6. **Client-Side Component Extraction** (server-side processing)

### ✅ VALIDATED PATTERNS
1. **Single TipTap Editor with Y.js Structure**
2. **Server-Side Component Intelligence**
3. **Direct Persistence (development) → Circuit Breakers (production)**
4. **Component Identity Preservation Throughout Workflow**
5. **Manual Integration → Automatic (production)**

## Graduation to Production

### Success Triggers
If MVP validates:
- Architecture is sound and intuitive
- User experience meets Google Docs standard
- Component flow works reliably
- SmartSuite integration demonstrates feasibility
- Performance baseline acceptable

### Production Implementation Plan
1. **Real-Time Collaboration:** Full Y.js implementation with presence indicators
2. **Supabase Integration:** Complete database schema with component extraction
3. **Circuit Breaker Resilience:** Production-grade error handling
4. **Role-Based Access Control:** 5-role system (Admin, Internal, Freelancer, Client, Viewer)
5. **Full TRACED Methodology:** Comprehensive testing and quality gates
6. **Tab Navigation:** Complete workflow (Script, Review, Scenes, Voice, Direction)

### Learning Documentation
All MVP learnings will be captured in:
- `/Volumes/HestAI-Projects/eav-orchestrator-prototype/coordination/docs/`
- Cross-referenced with parent project failures
- Architecture decision records for production guidance

---

## Development Team Notes

**Current Status:** Workspace created, basic architecture operational
**Next Milestone:** Component extraction and SmartSuite sync validation
**Decision Point:** Day 8 - Graduate to production vs iterate architecture
**Quality Focus:** Architecture validation over feature completeness

**Key Principle:** This MVP exists to prove the architecture works before investing in production features. Every decision should validate the core paragraph=component model.

---

**Repository Status:** ✅ Initialized and operational
**Development Environment:** Ready for `npm install && npm run dev`
**Validation Framework:** Core tests operational with `npm run validate`