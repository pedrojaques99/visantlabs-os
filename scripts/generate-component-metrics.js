#!/usr/bin/env node

/**
 * Generate Component Metrics
 * Runs during build to create component usage metrics for the design system
 *
 * Usage: node scripts/generate-component-metrics.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const REPORT_DIR = 'scripts/reports';

console.log('📊 Generating component metrics...\n');

try {
  // Run the analyzer
  execSync('node scripts/analyze-components.js --json', {
    stdio: 'inherit',
    timeout: 60000,
  });

  // Verify file was created
  const metricsPath = path.join(REPORT_DIR, 'component-usage.json');
  if (fs.existsSync(metricsPath)) {
    const stats = fs.statSync(metricsPath);
    console.log(`\n✅ Component metrics generated successfully`);
    console.log(`   File: ${metricsPath}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)}KB`);
    console.log(`   Ready for API serving\n`);
    process.exit(0);
  } else {
    console.error('\n❌ Metrics file not created');
    process.exit(1);
  }
} catch (error) {
  console.error('\n❌ Failed to generate metrics:', error.message);
  process.exit(1);
}
