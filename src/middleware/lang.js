const fs = require('fs');
const path = require('path');

let enDict = {};
let swDict = {};

try {
  enDict = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../locales/en.json'), 'utf8'));
  swDict = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../locales/sw.json'), 'utf8'));
} catch (err) {
  console.error('Error reading translation dictionaries, setting empty fallbacks.', err.message);
}

module.exports = function(req, res, next) {
  // 1. Check query parameter e.g., ?lang=sw
  if (req.query.lang) {
    req.session.lang = req.query.lang.toLowerCase() === 'sw' ? 'sw' : 'en';
  }
  
  // 2. Determine current language (session or default to 'en')
  const lang = req.session.lang || 'en';
  req.lang = lang;
  res.locals.currentLang = lang;

  // 3. Expose translation helper
  res.locals.__ = (key) => {
    const dictionary = lang === 'sw' ? swDict : enDict;
    return dictionary[key] || enDict[key] || key;
  };

  next();
};
