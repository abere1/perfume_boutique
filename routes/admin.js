const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const store = require('../db/store');
const { requireAdmin, requireCsrfToken } = require('../middleware/auth');

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// ---------------------------------------------------------------------------
// Image upload setup
// ---------------------------------------------------------------------------

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (allowedMimeTypes.has(file.mimetype) && allowedExtensions.has(extension)) {
      return cb(null, true);
    }
    cb(new Error('Only JPG, PNG, WEBP, or GIF images smaller than 5MB are allowed.'));
  }
}).single('image');

// Wraps multer so upload errors surface as req.uploadError instead of
// crashing the request, keeping error handling next to the rest of the form.
function handleUpload(req, res, next) {
  uploadImage(req, res, (err) => {
    if (err) {
      req.uploadError =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'That image is too large. Please use a file under 5MB.'
          : err.message;
    }
    next();
  });
}

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res
      .status(429)
      .render('admin/login', { error: 'Too many login attempts. Please wait a few minutes and try again.' });
  }
});

function validatePrice(value) {
  const price = Number(value);
  return !isNaN(price) && price > 0;
}

function validateSizeMl(value) {
  const size = Number(value);
  return !isNaN(size) && size > 0;
}

function isValidImagePath(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return false;
  if (!imagePath.startsWith('/uploads/')) return false;
  if (imagePath.includes('..') || imagePath.includes('~')) return false;
  return true;
}

router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/login', loginLimiter, requireCsrfToken, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const admin = await store.admin.findByUsername(username || '');

  if (admin && bcrypt.compareSync(password || '', admin.passwordHash)) {
    req.session.isAdmin = true;
    req.session.username = admin.username;
    return res.redirect('/admin');
  }

  res.status(401).render('admin/login', { error: 'Incorrect username or password.', csrfToken: req.session.csrfToken });
}));

router.post('/logout', requireCsrfToken, (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// Everything below this line requires an active admin session.
router.use(requireAdmin);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

router.get('/', asyncHandler(async (req, res) => {
  res.render('admin/dashboard', {
    perfumes: await store.perfumes.getAll(),
    unreadCount: await store.inquiries.unreadCount(),
    added: req.query.added === '1',
    updated: req.query.updated === '1',
    deleted: req.query.deleted === '1'
  });
}));

// ---------------------------------------------------------------------------
// Perfume CRUD
// ---------------------------------------------------------------------------

router.get('/perfumes/new', (req, res) => {
  res.render('admin/perfume-form', {
    perfume: {},
    error: null,
    formAction: '/admin/perfumes',
    heading: 'Add a fragrance'
  });
});

router.post('/perfumes', handleUpload, requireCsrfToken, asyncHandler(async (req, res) => {
  const { name, brand, price, sizeMl } = req.body;

  if (req.uploadError || !name || !brand || !price || !validatePrice(price)) {
    return res.status(400).render('admin/perfume-form', {
      perfume: req.body,
      error: req.uploadError || (!validatePrice(price) ? 'Price must be greater than 0.' : 'Name, brand, and price are required.'),
      formAction: '/admin/perfumes',
      heading: 'Add a fragrance',
      csrfToken: req.session.csrfToken
    });
  }

  if (sizeMl && !validateSizeMl(sizeMl)) {
    return res.status(400).render('admin/perfume-form', {
      perfume: req.body,
      error: 'Size must be greater than 0.',
      formAction: '/admin/perfumes',
      heading: 'Add a fragrance',
      csrfToken: req.session.csrfToken
    });
  }

  const image = req.file ? `/uploads/${req.file.filename}` : '';
  await store.perfumes.create({ ...req.body, image, featured: req.body.featured === 'on' });
  res.redirect('/admin?added=1');
}));

router.get('/perfumes/:id/edit', asyncHandler(async (req, res) => {
  const perfume = await store.perfumes.getById(req.params.id);
  if (!perfume) return res.status(404).render('404');

  res.render('admin/perfume-form', {
    perfume,
    error: null,
    formAction: `/admin/perfumes/${perfume.id}`,
    heading: 'Edit fragrance'
  });
}));

router.post('/perfumes/:id', handleUpload, requireCsrfToken, asyncHandler(async (req, res) => {
  const existing = await store.perfumes.getById(req.params.id);
  if (!existing) return res.status(404).render('404');

  const { name, brand, price, sizeMl } = req.body;
  if (req.uploadError || !name || !brand || !price || !validatePrice(price)) {
    return res.status(400).render('admin/perfume-form', {
      perfume: { ...existing, ...req.body, id: existing.id },
      error: req.uploadError || (!validatePrice(price) ? 'Price must be greater than 0.' : 'Name, brand, and price are required.'),
      formAction: `/admin/perfumes/${existing.id}`,
      heading: 'Edit fragrance',
      csrfToken: req.session.csrfToken
    });
  }

  if (sizeMl && !validateSizeMl(sizeMl)) {
    return res.status(400).render('admin/perfume-form', {
      perfume: { ...existing, ...req.body, id: existing.id },
      error: 'Size must be greater than 0.',
      formAction: `/admin/perfumes/${existing.id}`,
      heading: 'Edit fragrance',
      csrfToken: req.session.csrfToken
    });
  }

  const image = req.file ? `/uploads/${req.file.filename}` : undefined;
  await store.perfumes.update(existing.id, { ...req.body, image, featured: req.body.featured === 'on' });
  res.redirect('/admin?updated=1');
}));

router.post('/perfumes/:id/delete', requireCsrfToken, asyncHandler(async (req, res) => {
  const removed = await store.perfumes.remove(req.params.id);
  if (removed && removed.image && isValidImagePath(removed.image)) {
    fs.unlink(path.join(__dirname, '..', 'public', removed.image), () => {});
  }
  res.redirect('/admin?deleted=1');
}));

// ---------------------------------------------------------------------------
// Inquiries inbox
// ---------------------------------------------------------------------------

router.get('/inquiries', asyncHandler(async (req, res) => {
  res.render('admin/inquiries', { inquiries: await store.inquiries.getAll() });
}));

router.post('/inquiries/:id/read', requireCsrfToken, asyncHandler(async (req, res) => {
  await store.inquiries.markRead(req.params.id);
  res.redirect('/admin/inquiries');
}));

router.post('/inquiries/:id/delete', requireCsrfToken, asyncHandler(async (req, res) => {
  await store.inquiries.remove(req.params.id);
  res.redirect('/admin/inquiries');
}));

module.exports = router;
