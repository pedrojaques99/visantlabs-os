import fs from 'fs';
import path from 'path';

const locales = ['en-US', 'pt-BR'];

const footerTranslations = {
  'en-US': {
    "footer": {
      "rightsReserved": "ALL THE RIGHTS RESERVED © VSN LABS®",
      "rightsReservedShort": "© VSN LABS®",
      "privacyPolicy": "Privacy Policy",
      "legal": "Legal",
      "terms": "Terms",
      "usage": "Usage",
      "refund": "Refund",
      "english": "English",
      "portuguese": "Português"
    }
  },
  'pt-BR': {
    "footer": {
      "rightsReserved": "TODOS OS DIREITOS RESERVADOS © VSN LABS®",
      "rightsReservedShort": "© VSN LABS®",
      "privacyPolicy": "Política de Privacidade",
      "legal": "Jurídico",
      "terms": "Termos",
      "usage": "Uso",
      "refund": "Reembolso",
      "english": "Inglês",
      "portuguese": "Português"
    }
  }
};

function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

function sortObject(obj) {
  return Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = (typeof obj[key] === 'object' && obj[key] !== null) ? sortObject(obj[key]) : obj[key];
    return acc;
  }, {});
}

locales.forEach(loc => {
  const filePath = path.resolve(`src/locales/${loc}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  deepMerge(data, footerTranslations[loc]);
  const sortedData = sortObject(data);
  fs.writeFileSync(filePath, JSON.stringify(sortedData, null, 2), 'utf8');
  console.log(`${loc}.json updated and sorted successfully.`);
});
