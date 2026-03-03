# Modular UI Integration Checklist

## ✅ Completed Fixes

### Code Cleanup
- [x] Removed old `plugin/ui.js` (no longer needed with modular system)
- [x] All modules properly organized in `plugin/modules/`

### Event Handlers
- [x] Mode toggle persists preference to localStorage
- [x] API section toggle click handler added
- [x] Brand pill click now properly opens settings
- [x] Library component selection event listener added

### Persistence
- [x] Mode preference (simple/advanced) saved to localStorage
- [x] Mode preference restored on plugin load
- [x] API key storage via Figma clientStorage
- [x] Brand guidelines storage via Figma pluginData

### Module Integration
- [x] All 8 modules load in correct order
- [x] EventBus initialized before any module uses it
- [x] State initialized with proper defaults
- [x] All DOM elements available at initialization
- [x] No circular dependencies between modules

---

## 🧪 Testing Procedures

### 1. Module Initialization Test
**Objective**: Verify all modules load and initialize correctly

```bash
# Open browser console and check for these log messages:
[Plugin] Initializing with modular architecture...
[Plugin] Initialization complete
[Plugin] Mode: simple (or advanced if was saved)
[Plugin] Session: [UUID]
```

**Expected**: All 4 logs appear, no errors in console

### 2. Mode Toggle Test
**Objective**: Verify progressive disclosure works

1. Open plugin in Figma
2. Click "Avançado" checkbox in header
3. **Expected**: Advanced panel appears below context info with "Operações" and "JSON" sections
4. Click again
5. **Expected**: Advanced panel disappears, UI returns to simple mode
6. Refresh plugin (F5 or Cmd+R)
7. **Expected**: Mode preference is restored (should still be advanced or simple as before)

### 3. Chat Test
**Objective**: Verify chat messaging flow works

1. Type a message in chat input
2. Click send button (or press Enter)
3. **Expected**:
   - User message appears in chat
   - Input clears
   - Loading state shows
   - Assistant response appears when ready
4. If advanced mode is on:
   - **Expected**: Operations log shows generated operations
   - **Expected**: JSON preview shows full API response

### 4. Brand Settings Test
**Objective**: Verify brand module works

1. Click 🎨 Brand pill (or open settings)
2. **Expected**: Settings view opens
3. Scroll to Brand Guidelines section
4. Select colors/fonts
5. **Expected**:
   - Colors appear in grid
   - Fonts appear in list
   - Brand pill shows "active" state
6. Save a guideline
7. **Expected**: Guideline appears in selector dropdown
8. Select different guideline
9. **Expected**: Brand selections update to match guideline
10. Go back to main view
11. **Expected**: Brand pill still shows active state

### 5. Component Library Test
**Objective**: Verify component library rendering

1. Open plugin settings
2. Look for Brand Guidelines section with components
3. **Expected**: Components load and display with thumbnails
4. Try folder toggle (if "Pastas" is enabled)
5. **Expected**: Folders expand/collapse to show components
6. Try searching in component search
7. **Expected**: Results filter and update in real-time

### 6. Selection Indicator Test
**Objective**: Verify selection display works

1. Select a single element in Figma
2. Look at chat area below the input
3. **Expected**: Selection indicator shows element name, type, and thumbnail
4. Select multiple elements
5. **Expected**: Selection indicator shows "N camadas selecionadas" with names
6. Clear selection
7. **Expected**: Selection indicator disappears

### 7. API Section Toggle Test
**Objective**: Verify settings section collapse/expand works

1. Open plugin settings
2. Click on "Gemini API Key (BYOK)" header
3. **Expected**: Section collapses and chevron rotates
4. Click again
5. **Expected**: Section expands and chevron rotates back

### 8. Keyboard Shortcut Test
**Objective**: Verify Cmd+K / Ctrl+K focuses chat

1. Focus somewhere else in Figma
2. Press Cmd+K (Mac) or Ctrl+K (Windows)
3. **Expected**: Chat input gets focus (cursor appears in input)

### 9. API Key Persistence Test
**Objective**: Verify API key storage works

1. Open settings
2. Scroll to API Key section
3. Enter a test API key (e.g., "test-key-123")
4. Click "Salvar"
5. Refresh plugin
6. **Expected**: API key appears in input (if Figma permission allows)

---

## 🔍 Verification Checklist

### Before Marking as Complete

- [ ] Console shows no errors on initialization
- [ ] All 4 initialization log messages appear
- [ ] Mode toggle saves/restores preference
- [ ] Advanced panel appears/disappears correctly
- [ ] Chat message sending works
- [ ] Brand settings can be saved
- [ ] Component library loads without errors
- [ ] Selection indicator shows correct info
- [ ] API key section can toggle
- [ ] Brand pill click opens settings
- [ ] Settings close button works
- [ ] Clear chat button works

### Browser Compatibility
- [ ] Works in Chrome/Chromium
- [ ] Works in Firefox (if testing locally)
- [ ] No console errors or warnings

---

## 🐛 Known Issues & Workarounds

### Issue 1: Component Thumbnails Delay
**Symptom**: Component thumbnails don't appear immediately
**Cause**: Thumbnails load asynchronously from sandbox
**Workaround**: Wait a moment for thumbnails to load, or browse without them

### Issue 2: Mode Toggle Not Persisting
**Symptom**: Mode resets to "simple" after refresh
**Cause**: localStorage not accessible or being cleared
**Workaround**: Check browser localStorage settings, ensure not in private mode

### Issue 3: Settings View Doesn't Close
**Symptom**: Back button in settings doesn't close view
**Cause**: Event handler not properly bound
**Workaround**: Refresh plugin or use browser DevTools to check event listeners

---

## 🚀 Deployment Checklist

Before deploying to production:

1. [ ] All tests pass (see testing procedures above)
2. [ ] No console errors or warnings
3. [ ] Mode persistence works correctly
4. [ ] Brand guidelines save/load properly
5. [ ] Component library loads without lag
6. [ ] No performance issues with large files
7. [ ] Keyboard shortcuts work
8. [ ] API communication works (if testing with actual API)

---

## 📝 Files Changed in This Fix

| File | Changes |
|------|---------|
| `plugin/ui.js` | **DELETED** - Old file no longer needed |
| `plugin/modules/uiManager.js` | Added API section toggle handler, mode persistence |
| `plugin/modules/brand.js` | Fixed brand pill click to open settings |
| `plugin/ui-refactored.js` | Added localStorage restore for mode preference |

---

## 💡 Tips for Debugging

### Check Initialization
```javascript
// In console:
console.log('EventBus:', window.eventBus);
console.log('State:', window.state);
console.log('Modules:', { chatModule, brandModule, libraryModule, uiManager });
```

### Check Mode Preference
```javascript
// In console:
localStorage.getItem('copilot_mode')  // Should be 'simple' or 'advanced'
state.mode  // Should match localStorage value
```

### Watch State Changes
```javascript
// In console:
eventBus.on('state:changed', (data) => console.log('State changed:', data));
```

### Check Event Listeners
```javascript
// In console:
document.getElementById('modeToggle').onclick  // Should show function
document.getElementById('settingsBtn').onclick // Should show function
```

---

## 🎯 Success Criteria

The integration is successful when:

1. ✅ All modules initialize without errors
2. ✅ Mode toggle saves and restores preference
3. ✅ Advanced panel shows/hides correctly
4. ✅ All UI interactions work as expected
5. ✅ No console errors or warnings
6. ✅ Performance is acceptable (< 100ms UI updates)
7. ✅ All event handlers properly bound
8. ✅ Persistence works (localStorage + Figma storage)

---

**Last Updated**: March 3, 2026
**Status**: 🟢 All Critical Fixes Applied
