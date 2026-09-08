module.exports = function(req, res, next) {
  if (req.session && req.session.isAdmin) {
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
