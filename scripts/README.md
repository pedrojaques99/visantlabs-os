# Component Analysis Scripts

## 📊 analyze-components.js

Analyzes component usage across your entire codebase. Generates a comprehensive report showing which components are used most frequently and which are orphaned.

### Usage

```bash
# Generate markdown report
node scripts/analyze-components.js

# Generate JSON report
node scripts/analyze-components.js --json
```

### Output

The script generates:
- **Markdown report**: `scripts/reports/component-usage.md`
- **JSON export** (with `--json`): `scripts/reports/component-usage.json`

### What It Reports

- **🔥 Very Frequent (31+ imports)**: Core components used throughout the app
- **✨ Frequent (11-30 imports)**: Commonly used reusable components
- **🟡 Moderate (3-10 imports)**: Specialized components with targeted usage
- **⚠️ Rarely Used (1-2 imports)**: Components that could be consolidated
- **❌ Orphaned (0 imports)**: Dead code candidates for deletion

### Example Output

```
📊 Summary:
  🔥 Very Frequent:   7
  ✨ Frequent:       15
  🟡 Moderate:       39
  ⚠️ Rarely:        189
  ❌ Orphaned:       21
  Total:            271
```

---

## 🔄 track-components.sh (Optional Enhancement)

Track component metrics over time:

```bash
# Add to your CI/CD or run periodically
node scripts/analyze-components.js --json > scripts/reports/component-usage-$(date +%Y%m%d).json

# View trend
ls -lah scripts/reports/component-usage-*.json
```

---

## 💡 Best Practices

### 1. **Core Components** (Very Frequent)
These are your design system. Keep them:
- Clean and well-documented
- Backwards compatible
- Thoroughly tested

### 2. **Reusable Components** (Frequent)
These are workhorse components:
- Review for consolidation
- Document usage patterns
- Consider extracting variations as separate components

### 3. **Moderate Components**
These have specific use cases:
- Good candidates for internal component libraries
- Document why they exist

### 4. **Rarely Used**
Consider:
- Consolidation with similar components
- Moving to specialized libraries
- Documenting the specific use case

### 5. **Orphaned Components**
- ❌ Delete immediately (after confirming no dynamic imports)
- Don't leave dead code in the repo

---

## 🛠️ Recommendations from Latest Run

### Top 7 Core Components
These drive your design system:
1. **button** (167 uses) - Universal button component
2. **input** (79 uses) - Text input field
3. **GlitchLoader** (74 uses) - Loading state indicator
4. **Modal** (43 uses) - Dialog/modal container
5. **MicroTitle** (38 uses) - Small title variant
6. **textarea** (34 uses) - Multi-line text input
7. **GridDotsBackground** (32 uses) - Background pattern

### 21 Orphaned Components
Safe to delete:
- `club-hero3d.tsx`
- `BrandingStep.tsx`
- `PosicionamentoSection.tsx`
- `PublicoAlvoSection.tsx`
- `MobilePageFrame.tsx`
- _...and 16 more_

### 189 Rarely Used Components
Consider consolidation opportunities for better maintainability.

---

## 📈 Metrics to Track

Run the analyzer monthly and compare:
- Are orphaned components being eliminated?
- Are rarely-used components decreasing?
- Is your design system maturing (more frequent components)?

Good trend:
```
Month 1: Orphaned: 21  Rarely: 189  Frequent: 15
Month 2: Orphaned: 5   Rarely: 165  Frequent: 18
Month 3: Orphaned: 0   Rarely: 150  Frequent: 22
```
