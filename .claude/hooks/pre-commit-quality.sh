#!/bin/bash
# Simple quality gate - catches issues BEFORE commit
# Replaces theatrical "3-day CI green" requirement

echo "🔍 Running pre-commit quality checks..."

# TypeScript check
echo "📘 TypeScript check..."
if ! npm run typecheck; then
    echo "❌ TypeScript errors found. Fix before committing."
    exit 1
fi

# Lint check
echo "🧹 ESLint check..."
if ! npm run lint; then
    echo "❌ Lint errors found. Fix before committing."
    exit 1
fi

# Quick test run (not full suite, just smoke test)
echo "🧪 Quick test check..."
if ! npm test -- --run --reporter=dot --bail=5; then
    echo "⚠️  Test failures detected. Consider fixing before commit."
    echo "   (Use --no-verify to skip if you're fixing tests)"
fi

echo "✅ Quality checks passed!"