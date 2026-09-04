const express = require('express');
const router = express.Router();
const store = require('../db/store');

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

router.get('/', asyncHandler(async (req, res) => {
  const featured = await store.perfumes.getFeatured(6);
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const latest = (await store.perfumes.getAll())
    .filter((perfume) => Date.parse(perfume.createdAt) >= recentCutoff)
    .slice(0, 8);
  res.render('index', { featured, latest });
}));

router.get('/shop', asyncHandler(async (req, res) => {
  const { gender, brand, search, sort } = req.query;
  const perfumes = await store.perfumes.getAll({ gender, brand, search, sort });
  const brands = await store.perfumes.getBrands();

  res.render('shop', {
    perfumes,
    brands,
    filters: { gender: gender || '', brand: brand || '', search: search || '', sort: sort || '' }
  });
}));

router.get('/perfume/:id', asyncHandler(async (req, res) => {
  const perfume = await store.perfumes.getById(req.params.id);
  if (!perfume) return res.status(404).render('404');
  res.render('product', { perfume });
}));

router.get('/about', (req, res) => {
  res.render('about');
});

router.get('/contact', (req, res) => {
  res.render('contact');
});

module.exports = router;
