# Comment Position Debug Guide

## 🔍 Debug Logging Added

The following debug logs have been added to track comment position flow:

### 1. Comment Creation (TipTapEditor.tsx - Line 1334)
When user clicks "Add comment" button:
```
🔍 CREATE COMMENT DATA: {
  from: <number>,
  to: <number>,
  text: <string>,
  editorSelection: <object>
}
```

### 2. Database Insert (comments.ts - Line 63)
Before inserting to database:
```
🔍 INSERTING TO DB: {
  start_position: <number>,
  end_position: <number>,
  highlighted_text: <string>
}
```

### 3. Fresh Comment Detection (comments-position-recovery.ts - Line 246)
When position recovery preserves PM positions:
```
🔍 FRESH COMMENT - PRESERVING PM POSITIONS: {
  commentId: <string>,
  storedPositions: { from: <number>, to: <number> },
  ageInSeconds: <number>,
  highlightedText: <string>
}
```

### 4. Database Verification (CommentSidebar.tsx - Line 426)
After successful creation:
```
🔍 JUST CREATED IN DB: {
  id: <string>,
  start_position: <number>,
  end_position: <number>,
  highlighted_text: <string>,
  created_at: <timestamp>
}
```

## 🧪 Testing Protocol

### Step 1: Clear Old Data
```sql
-- All old comments have incorrect position systems
DELETE FROM comments WHERE script_id = '<your_script_id>';
```

### Step 2: Create Fresh Comment
1. Open script in editor
2. Select the word "component"
3. Click "Add comment"
4. Add comment text
5. Submit

### Step 3: Check Console Logs
You should see this sequence:
```
🔍 CREATE COMMENT DATA: { from: X, to: Y, text: "component" }
🔍 INSERTING TO DB: { start_position: X, end_position: Y, highlighted_text: "component" }
🔍 JUST CREATED IN DB: { id: "...", start_position: X, end_position: Y, ... }
```

### Step 4: Refresh and Verify
1. Refresh the page
2. Check for fresh comment detection:
```
🔍 FRESH COMMENT - PRESERVING PM POSITIONS: {
  commentId: "...",
  storedPositions: { from: X, to: Y },
  ageInSeconds: <should be < 10>
}
```

## 🐛 Known Issues Fixed

### ✅ SQL Syntax Error (FIXED)
**File**: `src/lib/comment-reconciliation.ts` (Line 59)

**Was**: `.is('deleted_at', null)` - Generated invalid SQL `deleted_at=not.is.null`

**Now**: `.filter('deleted_at', 'is', null)` - Correct syntax

### ✅ Fresh Comment Position Preservation (IMPLEMENTED)
Comments < 10 seconds old now bypass text-based position recovery and use stored ProseMirror positions directly.

## 🔬 Diagnostic Questions

If fresh comment STILL shows incorrect position (" componen" instead of "component"):

### Question 1: Are PM positions being stored?
Check console log sequence - positions should be identical from creation through database insert.

### Question 2: Is position recovery running?
If you see the "FRESH COMMENT - PRESERVING PM POSITIONS" log, recovery is correctly bypassed.

### Question 3: Are old comments interfering?
Old comments have string indices, not PM positions. Delete all old comments before testing.

### Question 4: Is the highlight rendering correct?
If positions are stored correctly but highlight is wrong, the issue is in the comment plugin rendering, not storage.

## 🚨 Current Status

**Dev Server**: Running at http://localhost:3002/

**Next Step**: Test comment creation and report console log findings.

**Expected Outcome**: Fresh comment should highlight exactly the selected text with no off-by-one errors.

## 📊 Success Criteria

- [ ] Console shows identical positions from selection → insert → storage
- [ ] Fresh comment bypass triggers (< 10 seconds)
- [ ] Highlight shows correct text without off-by-one errors
- [ ] SQL error for `deleted_at` is resolved
- [ ] Edit operations maintain correct positions
