const express = require('express');
const router = express.Router();
const store = require('../db/store');

router.get('/', (req, res) => {
  const featured = store.perfumes.getFeatured(6);
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const latest = store.perfumes.getAll()
    .filter((perfume) => Date.parse(perfume.createdAt) >= recentCutoff)
    .slice(0, 8);
  res.render('index', { featured, latest });
});

router.get('/shop', (req, res) => {
  const { gender, brand, search, sort } = req.query;
  const perfumes = store.perfumes.getAll({ gender, brand, search, sort });
  const brands = store.perfumes.getBrands();

  res.render('shop', {
    perfumes,
    brands,
    filters: { gender: gender || '', brand: brand || '', search: search || '', sort: sort || '' }
  });
});

router.get('/perfume/:id', (req, res) => {
  const perfume = store.perfumes.getById(req.params.id);
  if (!perfume) return res.status(404).render('404');
  res.render('product', { perfume });
});

router.get('/about', (req, res) => {
  res.render('about');
});

router.get('/contact', (req, res) => {
  res.render('contact');
});

module.exports = router;
