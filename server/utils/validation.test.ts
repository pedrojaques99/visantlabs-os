/**
 * Tests for validation helpers (ensureString, ensureOptionalBoolean, isValidAspectRatio).
 * Run: npx tsx server/utils/validation.test.ts
 */

import {
  ensureString,
  ensureOptionalBoolean,
  isValidAspectRatio,
  VALID_ASPECT_RATIOS,
  isSafeId,
  isValidObjectId,
} from './validation.js';

let failed = 0;

function ok(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('OK:', msg);
  }
}

// ensureString
ok(ensureString('hello') === 'hello', 'ensureString accepts valid string');
ok(ensureString('') === '', 'ensureString accepts empty string');
ok(ensureString(null) === null, 'ensureString rejects null');
ok(ensureString(undefined) === null, 'ensureString rejects undefined');
ok(ensureString(123) === null, 'ensureString rejects number');
ok(ensureString({ $gt: '' }) === null, 'ensureString rejects object (prevents $set injection)');
ok(ensureString(['a']) === null, 'ensureString rejects array');
ok(ensureString('xy', 1) === null, 'ensureString rejects string over maxLen');
ok(ensureString('x', 2) === 'x', 'ensureString accepts string within maxLen');

// ensureOptionalBoolean
ok(ensureOptionalBoolean(true) === true, 'ensureOptionalBoolean accepts true');
ok(ensureOptionalBoolean(false) === false, 'ensureOptionalBoolean accepts false');
ok(ensureOptionalBoolean(undefined) === undefined, 'ensureOptionalBoolean returns undefined for undefined');
ok(ensureOptionalBoolean(null) === undefined, 'ensureOptionalBoolean returns undefined for null');
ok(ensureOptionalBoolean(1) === undefined, 'ensureOptionalBoolean rejects number');
ok(ensureOptionalBoolean('true') === undefined, 'ensureOptionalBoolean rejects string');

// isValidAspectRatio
ok(isValidAspectRatio('16:9') === true, 'isValidAspectRatio accepts 16:9');
ok(isValidAspectRatio('1:1') === true, 'isValidAspectRatio accepts 1:1');
ok(isValidAspectRatio('invalid') === false, 'isValidAspectRatio rejects invalid');
ok(isValidAspectRatio('') === false, 'isValidAspectRatio rejects empty');
ok(isValidAspectRatio({ $gt: '' } as any) === false, 'isValidAspectRatio rejects non-string');
ok(VALID_ASPECT_RATIOS.includes('16:9'), 'VALID_ASPECT_RATIOS contains 16:9');

// isSafeId (used in presets)
ok(isSafeId('abc-123_x') === true, 'isSafeId accepts alphanumeric, hyphen, underscore');
ok(isSafeId('a') === true, 'isSafeId accepts short id');
ok(isSafeId('') === false, 'isSafeId rejects empty');
ok(isSafeId('a; DROP TABLE--') === false, 'isSafeId rejects dangerous chars');
ok(isSafeId('x'.repeat(101)) === false, 'isSafeId rejects over maxLen');

// isValidObjectId
ok(isValidObjectId('507f1f77bcf86cd799439011') === true, 'isValidObjectId accepts 24-char hex');
ok(isValidObjectId('invalid') === false, 'isValidObjectId rejects non-hex');
ok(isValidObjectId('123') === false, 'isValidObjectId rejects short string');
ok(isValidObjectId('') === false, 'isValidObjectId rejects empty');

if (failed > 0) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nAll validation tests passed.');
