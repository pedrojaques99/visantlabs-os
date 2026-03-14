import fs from 'fs';
import path from 'path';

const enPath = path.resolve('src/locales/en-US.json');
const ptPath = path.resolve('src/locales/pt-BR.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const pt = JSON.parse(fs.readFileSync(ptPath, 'utf8'));

function findMissing(source, target, prefix = '') {
  let missing = {};
  for (const key in source) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key] || typeof target[key] !== 'object') {
        missing[fullKey] = source[key];
      } else {
        const nestedMissing = findMissing(source[key], target[key], fullKey);
        Object.assign(missing, nestedMissing);
      }
    } else {
      if (!target[key]) {
        missing[fullKey] = source[key];
      }
    }
  }
  return missing;
}

const missing = findMissing(en, pt);
console.log(JSON.stringify(missing, null, 2));
