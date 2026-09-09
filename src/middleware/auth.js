const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'evance_dionis_secret_key_102938';

function generateToken(username) {
  const data = `${username}:${SECRET}`;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return `${username}.${hash}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  const username = parts[0];
  const expectedToken = generateToken(username);
  if (token === expectedToken) {
    return username;
  }
  return null;
}

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
}

const authMiddleware = function(req, res, next) {
  // 1. Check in-memory session first
  if (req.session && req.session.isAdmin) {
    return next();
  }

  // 2. Fallback for Vercel serverless environment: verify persistent signed auth cookie
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.admin_auth_token;
  const validUsername = verifyToken(token);

  if (validUsername) {
    if (req.session) {
      req.session.isAdmin = true;
      req.session.username = validUsername;
    }
    return next();
  }

  // Check if it's an API request or an AJAX call
  const isAjax = req.xhr || req.headers.accept?.includes('json');
  if (isAjax) {
    return res.status(401).json({ success: false, message: 'Unauthorized access. Session expired or login required.' });
  }

  // Redirect to login page
  res.redirect('/admin/login');
};

authMiddleware.generateToken = generateToken;
authMiddleware.verifyToken = verifyToken;
authMiddleware.parseCookies = parseCookies;

module.exports = authMiddleware;
