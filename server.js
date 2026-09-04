require('dotenv').config();

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const store = require('./db/store');
const siteConfig = require('./config/site');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const { setCsrfToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const sessionSecret = process.env.SESSION_SECRET || '';

// Vercel terminates TLS before forwarding requests to the function. Trust its
// proxy so express-session can correctly set secure cookies.
if (process.env.VERCEL) app.set('trust proxy', 1);

if (!sessionSecret || sessionSecret.trim().length < 32 || /change-this|replace-with|example/i.test(sessionSecret)) {
  console.error('Security error: set a strong SESSION_SECRET in .env before starting the app. Use a random 32+ character string.');
  process.exit(1);
}

// Make sure the uploads folder exists before anything tries to write to it.
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// contentSecurityPolicy is disabled here because it would otherwise block the
// Google Fonts used by the design and any inline widget scripts. Other
// helmet protections (frame options, no-sniff, etc.) stay on.
app.use(helmet({ contentSecurityPolicy: false }));

// Add HSTS header to encourage HTTPS usage (preload not enabled by default)
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: sessionSecret,
    store: store.createSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.SESSION_SECURE !== 'false'
    }
  })
);

app.use(setCsrfToken);

// Site config and login state are available in every view automatically.
app.use((req, res, next) => {
  res.locals.site = siteConfig;
  res.locals.isAdmin = !!(req.session && req.session.isAdmin);
  res.locals.currentPath = req.path;
  next();
});

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).render('404');
});

app.use((err, req, res, next) => {
  if (err && err.statusCode === 403) {
    return res.status(403).render('403', {
      message: err.message || 'Invalid security token. Please refresh the page and try again.'
    });
  }

  console.error(err && err.stack ? err.stack : err);
  return res.status(500).render('500');
});

async function start() {
  await store.initialize();
  await store.admin.ensureDefaultAdmin();
  app.listen(PORT, () => {
    console.log(`Perfume boutique running at http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Could not start the application:', err);
    process.exit(1);
  });
}

module.exports = app;
