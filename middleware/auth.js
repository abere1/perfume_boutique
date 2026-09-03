const crypto = require('crypto');

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect('/admin/login');
}

function ensureCsrfToken(req) {
  if (!req.session) return '';
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function setCsrfToken(req, res, next) {
  res.locals.csrfToken = ensureCsrfToken(req);
  next();
}

function requireCsrfToken(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const expected = ensureCsrfToken(req);
  const submitted =
    (req.body && req.body._csrf) ||
    (req.query && req.query._csrf) ||
    req.headers['x-csrf-token'];

  if (!expected || !submitted || typeof submitted !== 'string') {
    return res.status(403).render('403', {
      message: 'Invalid security token. Please refresh the page and try again.'
    });
  }

  const expectedBuffer = Buffer.from(expected);
  const submittedBuffer = Buffer.from(submitted);
  if (
    expectedBuffer.length !== submittedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, submittedBuffer)
  ) {
    return res.status(403).render('403', {
      message: 'Invalid security token. Please refresh the page and try again.'
    });
  }

  return next();
}

module.exports = { requireAdmin, setCsrfToken, requireCsrfToken, ensureCsrfToken };
