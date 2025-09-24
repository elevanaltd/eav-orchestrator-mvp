# EAV Orchestrator Prototype

Clean-slate architecture validation for paragraph=component video production workflow.

## 🎯 Mission

This prototype validates the core architecture for EAV Orchestrator before full production implementation. Based on extensive learnings from a failed parent project, this prototype tests the **paragraph=component model** with TipTap editor integration.

## 🏗️ Architecture Being Validated

```
USER TYPES → Single TipTap Editor → Y.js Document Structure → Component Extraction
                      ↓                    ↓                         ↓
             Google Docs-like UX    Single Source of Truth    Stable Component IDs (C1, C2, C3...)
                      ↓
             Components Flow: Script → Scenes → Voice → Edit (1:1 mapping)
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run validation checks
npm run validate
```

Visit `http://localhost:3000` to see the prototype in action.

## 📋 Validation Checklist

### Phase 1: Core Architecture ✅
- [x] Basic TipTap editor with component structure
- [x] Component marker visualization (C1, C2, C3...)
- [x] SmartSuite integration framework
- [x] TypeScript and build system operational

### Phase 2: Integration Validation (Days 4-5)
- [ ] Y.js document structure integration
- [ ] Component extraction to data structures
- [ ] SmartSuite sync operational
- [ ] Component identity preservation verified

### Phase 3: User Experience Validation (Days 6-7)
- [ ] Editing experience smooth and intuitive
- [ ] Professional appearance for stakeholder demo
- [ ] Performance baseline established

### Phase 4: Graduation Decision (Day 8)
- [ ] Architecture proven sound
- [ ] Clear production implementation plan

## 🔗 Integration

- **SmartSuite Workspace:** s3qnmox1
- **Prototype Table:** 68b2437a8f1755b055e0a124
- **Sync Pattern:** Manual with visual feedback

## 📚 Documentation

- **Development Guide:** [CLAUDE.md](./CLAUDE.md)
- **Project Context:** [../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)
- **North Star:** [../coordination/000-EAV-ORCHESTRATOR-PROTOTYPE-D1-NORTH-STAR.md](../coordination/000-EAV-ORCHESTRATOR-PROTOTYPE-D1-NORTH-STAR.md)

## 🎯 Success Criteria

The prototype succeeds when:
1. Paragraph=component model works intuitively
2. Component identity is preserved throughout
3. TipTap editing feels natural
4. SmartSuite integration demonstrates feasibility
5. Clear path to production is established

## 📊 Parent Project Learnings

This prototype applies critical learnings from a failed parent project:
- ✅ Single TipTap editor (not component-by-component)
- ✅ Server-side component extraction
- ✅ Minimal database schema approach
- ❌ Avoid circuit breaker error masking
- ❌ Avoid migration accumulation chaos

---

**Status:** Prototype Phase - Architecture Validation
**Decision Point:** Day 8 - Graduate to production or iterate approach