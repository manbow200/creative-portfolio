const db = require('../db/db');

// In-memory set of active session IDs or IPs to estimate active users in the last 5 minutes
const activeUsers = new Map();

// Helper to clean active users list older than 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of activeUsers.entries()) {
    if (now - timestamp > 5 * 60 * 1000) {
      activeUsers.delete(key);
    }
  }
}, 60000);

module.exports = async function(req, res, next) {
  // Ignore static assets, AJAX admin routes, or favicon
  const path = req.path;
  const isStatic = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map|json|pdf)$/i.test(path);
  const isApiOrUploads = path.startsWith('/api') || path.startsWith('/uploads');

  if (isStatic || isApiOrUploads) {
    return next();
  }

  // Update active users
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  activeUsers.set(ip, Date.now());

  // Extract metadata
  const userAgent = req.headers['user-agent'] || '';
  let device = 'Desktop';
  if (/mobi|android|iphone|ipad|ipod/i.test(userAgent)) {
    device = 'Mobile';
  } else if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
    device = 'Tablet';
  }

  let browser = 'Unknown';
  if (/chrome|crios/i.test(userAgent)) {
    browser = 'Chrome';
  } else if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) {
    browser = 'Safari';
  } else if (/firefox|fxios/i.test(userAgent)) {
    browser = 'Firefox';
  } else if (/edge|edg/i.test(userAgent)) {
    browser = 'Edge';
  } else if (/msie|trident/i.test(userAgent)) {
    browser = 'IE';
  }

  const referrer = req.headers['referer'] || req.headers['referrer'] || '';
  let source = 'Direct';
  if (referrer) {
    try {
      const url = new URL(referrer);
      const host = url.hostname.toLowerCase();
      if (host.includes('google')) source = 'Google';
      else if (host.includes('bing')) source = 'Bing';
      else if (host.includes('yahoo')) source = 'Yahoo';
      else if (host.includes('facebook') || host.includes('fb')) source = 'Facebook';
      else if (host.includes('t.co') || host.includes('twitter') || host.includes('x.com')) source = 'Twitter/X';
      else if (host.includes('instagram')) source = 'Instagram';
      else if (host.includes('linkedin')) source = 'LinkedIn';
      else if (host.includes('github')) source = 'GitHub';
      else source = url.hostname;
    } catch (e) {
      source = 'Referral';
    }
  }

  // Log to database asynchronously so it doesn't block the request
  db.run(
    'INSERT INTO analytics (page, device, browser, source) VALUES (?, ?, ?, ?)',
    [path, device, browser, source]
  ).catch(err => {
    console.error('Error logging analytics details:', err.message);
  });

  // Attach active users count helper to the request so it is accessible in views
  req.getActiveUsersCount = () => activeUsers.size;

  next();
};
