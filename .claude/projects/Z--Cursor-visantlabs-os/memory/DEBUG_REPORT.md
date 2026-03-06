# Plugin Code.ts Debug & Fix Report

## Critical Issues Found

### 1. **Variable Collections Async API Issue (Line 871)**
**Severity**: HIGH
**Location**: `CREATE_VARIABLE` operation, line 871

```typescript
// WRONG - getLocalVariableCollections is sync, not async
let collection = figma.variables.getLocalVariableCollections?.().find(...)

// CORRECT - No await needed, it's a sync function
let collection = figma.variables.getLocalVariableCollections?.().find(...)
```
**Issue**: The code treats `getLocalVariableCollections` as if it might be async, but it's actually a synchronous function.

---

### 2. **Redundant loadAllPagesAsync Calls**
**Severity**: MEDIUM
**Location**: Lines 174-181, 365, 996

The code has multiple calls to `loadAllPagesAsync()`:
- Line 996: In `getComponentsInCurrentFile()`
- Line 365: In `CREATE_COMPONENT_INSTANCE` (via `ensurePagesLoaded()`)

**Fix**: Use the session-level cache consistently instead of calling twice.

---

### 3. **insertChild() Method Issue (Line 833)**
**Severity**: HIGH
**Location**: `REORDER_CHILD` operation, line 833

```typescript
// Problematic
parentFrame.insertChild(op.index, node);
```

**Issue**: According to Figma API, `insertChild()` requires the node to already be a child. For reordering existing nodes, the proper approach is to remove and re-add.

**Fix**:
```typescript
// First remove from current parent
node.parent?.children.includes(node) && node.remove();
// Then insert at new position
parentFrame.insertChild(op.index, node);
```

---

### 4. **Clone Operation Error Handling (Line 813)**
**Severity**: MEDIUM
**Location**: `CLONE_NODE` operation

```typescript
const cloned = sourceNode.clone();
```

**Issue**: Clone can fail for certain node types (widgets, etc). No error handling.

**Fix**: Add try-catch with fallback.

---

### 5. **Font Loading Validation Missing (Line 315)**
**Severity**: MEDIUM
**Location**: `CREATE_TEXT` operation

```typescript
const fontFamily = op.props.fontFamily ?? 'Inter';
const fontStyle = op.props.fontStyle ?? 'Regular';
try {
  await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
```

**Issue**: Font availability not validated before use. Should check against available fonts first.

---

### 6. **Boolean Operation Index Validation (Line 926)**
**Severity**: MEDIUM
**Location**: `BOOLEAN_OPERATION` operation

```typescript
const result = figma.booleanOperation(nodes, op.operation as BooleanOperationOp, 0);
```

**Issue**: Third parameter (group index) should be validated. Index 0 may not be valid for all scenarios.

---

### 7. **Async Function Type Check Redundancy (Line 1046)**
**Severity**: LOW
**Location**: `getColorVariablesFromFile()`, line 1046

```typescript
if (figma.variables && typeof figma.variables.getLocalVariablesAsync === 'function') {
```

**Issue**: Unnecessary type check - if it exists, call it and handle errors. This pattern is repeated.

---

### 8. **Session Cache Not Per-Session (Line 174-181)**
**Severity**: MEDIUM
**Location**: `pagesLoaded` global variable

```typescript
let pagesLoaded = false;

async function ensurePagesLoaded() {
  if (!pagesLoaded) {
    await figma.loadAllPagesAsync();
    pagesLoaded = true;
  }
}
```

**Issue**: If plugin is run multiple times with different files, cache persists. Should be reset per operation batch.

---

### 9. **Missing Error Boundary in applyOperations (Line 940)**
**Severity**: MEDIUM
**Location**: Main operation loop

```typescript
} catch (err) {
  postToUI({ type: 'ERROR', message: `Op ${op.type}: ${String(err)}` });
}
```

**Issue**: Errors are caught but don't stop the batch. Later operations might fail silently if earlier ones fail.

---

### 10. **Variable Import Without Type Safety (Line 1089)**
**Severity**: MEDIUM
**Location**: `getColorVariablesFromFile()`, line 1089

```typescript
const imported = await figma.variables.importVariableByKeyAsync(libVar.key);
```

**Issue**: No validation that imported variable has the expected structure. Could crash if API changes.

---

## Summary of Fixes

| Issue | Type | Priority | Line | Fix |
|-------|------|----------|------|-----|
| Variable collection API | API Misuse | HIGH | 871 | Remove async treatment |
| Duplicate loadAllPages | Perf | MEDIUM | 996 | Use cache only |
| insertChild reordering | API Misuse | HIGH | 833 | Add remove first |
| Clone no error handle | Error Handling | MEDIUM | 813 | Add try-catch |
| Font validation | Validation | MEDIUM | 315 | Check availability |
| Boolean op index | Validation | MEDIUM | 926 | Validate index |
| Type check redundancy | Code Quality | LOW | 1046 | Remove redundant check |
| Session cache | Logic | MEDIUM | 174 | Reset per batch |
| Error handling | Control Flow | MEDIUM | 940 | Consider stopping batch |
| Variable type safety | Type Safety | MEDIUM | 1089 | Add validation |

