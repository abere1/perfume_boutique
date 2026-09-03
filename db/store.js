// Lightweight SQLite-backed data store.
//
// The application stores product catalog data, contact inquiries, and the admin
// credentials in a local SQLite database instead of raw JSON files. The historic
// JSON files are still read once on first launch for a safe migration, then the
// app uses SQLite as the source of truth.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'perfume-boutique.db');
const PERFUMES_FILE = path.join(DATA_DIR, 'perfumes.json');
const INQUIRIES_FILE = path.join(DATA_DIR, 'inquiries.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file, fallback) {
  ensureDataDir();
  if (!fs.existsSync(file)) return fallback;
  try {
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Could not read ${file}, using fallback data. Error:`, err.message);
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function newId() {
  return crypto.randomUUID();
}

function normalizePerfumeRow(row) {
  if (!row) return null;
  return {
    ...row,
    featured: !!row.featured,
    sizeMl: Number(row.sizeMl || 0),
    price: Number(row.price || 0),
    createdAt: row.createdAt || new Date().toISOString()
  };
}

function normalizeInquiryRow(row) {
  if (!row) return null;
  return {
    ...row,
    read: !!row.read,
    createdAt: row.createdAt || new Date().toISOString()
  };
}

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

function migrateLegacyDataIfNeeded() {
  const perfumeCount = db.prepare('SELECT COUNT(*) AS count FROM perfumes').get().count;
  if (!perfumeCount) {
    const legacyPerfumes = readJSON(PERFUMES_FILE, []);
    if (Array.isArray(legacyPerfumes) && legacyPerfumes.length) {
      const insertPerfume = db.prepare(`
        INSERT INTO perfumes (
          id, name, brand, gender, category, sizeMl, price, stock, featured,
          topNotes, heartNotes, baseNotes, description, image, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const tx = db.transaction((items) => {
        for (const perfume of items) {
          insertPerfume.run(
            perfume.id,
            perfume.name || '',
            perfume.brand || '',
            perfume.gender || 'unisex',
            perfume.category || 'Eau de Parfum',
            Number(perfume.sizeMl || 0),
            Number(perfume.price || 0),
            perfume.stock || 'in_stock',
            perfume.featured ? 1 : 0,
            perfume.topNotes || '',
            perfume.heartNotes || '',
            perfume.baseNotes || '',
            perfume.description || '',
            perfume.image || '',
            perfume.createdAt || new Date().toISOString()
          );
        }
      });
      tx(legacyPerfumes);
    }
  }

  const inquiryCount = db.prepare('SELECT COUNT(*) AS count FROM inquiries').get().count;
  if (!inquiryCount) {
    const legacyInquiries = readJSON(INQUIRIES_FILE, []);
    if (Array.isArray(legacyInquiries) && legacyInquiries.length) {
      const insertInquiry = db.prepare(`
        INSERT INTO inquiries (id, name, contact, message, perfumeId, perfumeName, read, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const tx = db.transaction((items) => {
        for (const inquiry of items) {
          insertInquiry.run(
            inquiry.id,
            inquiry.name || '',
            inquiry.contact || '',
            inquiry.message || '',
            inquiry.perfumeId || null,
            inquiry.perfumeName || null,
            inquiry.read ? 1 : 0,
            inquiry.createdAt || new Date().toISOString()
          );
        }
      });
      tx(legacyInquiries);
    }
  }

  const adminCount = db.prepare('SELECT COUNT(*) AS count FROM admin').get().count;
  if (!adminCount) {
    const legacyAdmin = readJSON(ADMIN_FILE, null);
    if (legacyAdmin && legacyAdmin.username && legacyAdmin.passwordHash) {
      db.prepare('INSERT INTO admin (username, passwordHash) VALUES (?, ?)').run(
        legacyAdmin.username,
        legacyAdmin.passwordHash
      );
    }
  }
}

const SAMPLE_PERFUMES = [
  {
    id: newId(),
    name: 'Velvet Oud',
    brand: 'Maison Noir',
    gender: 'unisex',
    category: 'Eau de Parfum',
    sizeMl: 100,
    price: 89,
    stock: 'in_stock',
    featured: true,
    topNotes: 'Saffron, Bergamot, Pink Pepper',
    heartNotes: 'Rose, Oud, Cedarwood',
    baseNotes: 'Amber, Musk, Sandalwood',
    description: 'A deep, smoky oud softened with rose and a bright citrus opening. Long-lasting and rich, built for cold evenings.',
    image: '',
    createdAt: new Date().toISOString()
  },
  {
    id: newId(),
    name: 'Citrine Bloom',
    brand: 'Aeloria',
    gender: 'women',
    category: 'Eau de Toilette',
    sizeMl: 50,
    price: 54,
    stock: 'in_stock',
    featured: true,
    topNotes: 'Mandarin, Neroli, Green Leaves',
    heartNotes: 'Jasmine, Orange Blossom, Peony',
    baseNotes: 'White Musk, Soft Woods',
    description: 'A bright, sunlit floral that opens sparkling and settles into a soft, clean skin scent.',
    image: '',
    createdAt: new Date().toISOString()
  },
  {
    id: newId(),
    name: 'Slate & Vetiver',
    brand: 'Nordhaus',
    gender: 'men',
    category: 'Eau de Parfum',
    sizeMl: 100,
    price: 76,
    stock: 'low_stock',
    featured: false,
    topNotes: 'Grapefruit, Cardamom',
    heartNotes: 'Vetiver, Violet Leaf',
    baseNotes: 'Vetiver, Ambroxan, Cedar',
    description: 'Cool, earthy vetiver with a sharp citrus top and a dry, smoky finish. Understated and sharp.',
    image: '',
    createdAt: new Date().toISOString()
  }
];

function initializeDatabase() {
  ensureDataDir();
  db.exec(`
    CREATE TABLE IF NOT EXISTS perfumes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'unisex',
      category TEXT NOT NULL DEFAULT 'Eau de Parfum',
      sizeMl INTEGER NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      stock TEXT NOT NULL DEFAULT 'in_stock',
      featured INTEGER NOT NULL DEFAULT 0,
      topNotes TEXT DEFAULT '',
      heartNotes TEXT DEFAULT '',
      baseNotes TEXT DEFAULT '',
      description TEXT DEFAULT '',
      image TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      message TEXT DEFAULT '',
      perfumeId TEXT,
      perfumeName TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin (
      username TEXT PRIMARY KEY,
      passwordHash TEXT NOT NULL
    );
  `);

  migrateLegacyDataIfNeeded();
  seedPerfumesIfEmpty();
}

initializeDatabase();

function seedPerfumesIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM perfumes').get().count;
  if (count > 0) return;

  const insertPerfume = db.prepare(`
    INSERT INTO perfumes (
      id, name, brand, gender, category, sizeMl, price, stock, featured,
      topNotes, heartNotes, baseNotes, description, image, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((items) => {
    for (const perfume of items) {
      insertPerfume.run(
        perfume.id,
        perfume.name,
        perfume.brand,
        perfume.gender,
        perfume.category,
        perfume.sizeMl,
        perfume.price,
        perfume.stock,
        perfume.featured ? 1 : 0,
        perfume.topNotes,
        perfume.heartNotes,
        perfume.baseNotes,
        perfume.description,
        perfume.image,
        perfume.createdAt
      );
    }
  });

  tx(SAMPLE_PERFUMES);
}

function getAllPerfumes({ gender, brand, search, sort } = {}) {
  let list = db.prepare('SELECT * FROM perfumes ORDER BY createdAt DESC').all().map(normalizePerfumeRow);

  if (gender) list = list.filter((p) => p.gender === gender);
  if (brand) list = list.filter((p) => p.brand.toLowerCase() === brand.toLowerCase());
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
    );
  }

  switch (sort) {
    case 'price_asc':
      list = list.slice().sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      list = list.slice().sort((a, b) => b.price - a.price);
      break;
    case 'name_asc':
      list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      list = list.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return list;
}

function getFeaturedPerfumes(limit = 6) {
  return getAllPerfumes().filter((p) => p.featured).slice(0, limit);
}

function getPerfumeById(id) {
  const row = db.prepare('SELECT * FROM perfumes WHERE id = ?').get(id);
  return normalizePerfumeRow(row);
}

function getBrands() {
  const all = getAllPerfumes();
  return [...new Set(all.map((p) => p.brand))].sort();
}

function createPerfume(data) {
  const perfume = {
    id: newId(),
    name: (data.name || '').trim(),
    brand: (data.brand || '').trim(),
    gender: data.gender || 'unisex',
    category: data.category || 'Eau de Parfum',
    sizeMl: Number(data.sizeMl) || 0,
    price: Number(data.price) || 0,
    stock: data.stock || 'in_stock',
    featured: !!data.featured,
    topNotes: data.topNotes || '',
    heartNotes: data.heartNotes || '',
    baseNotes: data.baseNotes || '',
    description: data.description || '',
    image: data.image || '',
    createdAt: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO perfumes (
      id, name, brand, gender, category, sizeMl, price, stock, featured,
      topNotes, heartNotes, baseNotes, description, image, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    perfume.id,
    perfume.name,
    perfume.brand,
    perfume.gender,
    perfume.category,
    perfume.sizeMl,
    perfume.price,
    perfume.stock,
    perfume.featured ? 1 : 0,
    perfume.topNotes,
    perfume.heartNotes,
    perfume.baseNotes,
    perfume.description,
    perfume.image,
    perfume.createdAt
  );

  return perfume;
}

function updatePerfume(id, data) {
  const existing = getPerfumeById(id);
  if (!existing) return null;

  const updated = {
    ...existing,
    name: data.name?.trim() || existing.name,
    brand: data.brand?.trim() || existing.brand,
    gender: data.gender || existing.gender,
    category: data.category || existing.category,
    sizeMl: data.sizeMl !== undefined ? Number(data.sizeMl) || 0 : existing.sizeMl,
    price: data.price !== undefined ? Number(data.price) || 0 : existing.price,
    stock: data.stock || existing.stock,
    featured: data.featured !== undefined ? !!data.featured : existing.featured,
    topNotes: data.topNotes !== undefined ? data.topNotes : existing.topNotes,
    heartNotes: data.heartNotes !== undefined ? data.heartNotes : existing.heartNotes,
    baseNotes: data.baseNotes !== undefined ? data.baseNotes : existing.baseNotes,
    description: data.description !== undefined ? data.description : existing.description,
    image: data.image ? data.image : existing.image
  };

  db.prepare(`
    UPDATE perfumes
    SET name = ?, brand = ?, gender = ?, category = ?, sizeMl = ?, price = ?, stock = ?,
        featured = ?, topNotes = ?, heartNotes = ?, baseNotes = ?, description = ?, image = ?
    WHERE id = ?
  `).run(
    updated.name,
    updated.brand,
    updated.gender,
    updated.category,
    updated.sizeMl,
    updated.price,
    updated.stock,
    updated.featured ? 1 : 0,
    updated.topNotes,
    updated.heartNotes,
    updated.baseNotes,
    updated.description,
    updated.image,
    id
  );

  return updated;
}

function removePerfume(id) {
  const existing = getPerfumeById(id);
  if (!existing) return null;
  db.prepare('DELETE FROM perfumes WHERE id = ?').run(id);
  return existing;
}

function getAllInquiries() {
  const rows = db.prepare('SELECT * FROM inquiries ORDER BY createdAt DESC').all();
  return rows.map(normalizeInquiryRow);
}

function createInquiry(data) {
  const inquiry = {
    id: newId(),
    name: (data.name || '').trim(),
    contact: (data.contact || '').trim(),
    message: (data.message || '').trim(),
    perfumeId: data.perfumeId || null,
    perfumeName: data.perfumeName || null,
    read: false,
    createdAt: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO inquiries (id, name, contact, message, perfumeId, perfumeName, read, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    inquiry.id,
    inquiry.name,
    inquiry.contact,
    inquiry.message,
    inquiry.perfumeId,
    inquiry.perfumeName,
    inquiry.read ? 1 : 0,
    inquiry.createdAt
  );

  return inquiry;
}

function markInquiryRead(id) {
  const row = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id);
  if (!row) return null;
  db.prepare('UPDATE inquiries SET read = 1 WHERE id = ?').run(id);
  return normalizeInquiryRow({ ...row, read: true });
}

function removeInquiry(id) {
  const row = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id);
  if (!row) return null;
  db.prepare('DELETE FROM inquiries WHERE id = ?').run(id);
  return normalizeInquiryRow(row);
}

function unreadInquiryCount() {
  return db.prepare('SELECT COUNT(*) AS count FROM inquiries WHERE read = 0').get().count;
}

function findAdminByUsername(username) {
  const row = db.prepare('SELECT * FROM admin WHERE username = ?').get(username);
  if (!row) return null;
  return { ...row, username: row.username, passwordHash: row.passwordHash };
}

function ensureDefaultAdmin() {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM admin').get().count;
  if (existing > 0) return;

  const username = (process.env.ADMIN_USERNAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!username || username.length < 3 || !password || password.length < 12) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env with strong values before starting the server.');
  }

  if (/change-this|replace-with|example/i.test(username) || /change-this|replace-with|example/i.test(password)) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD in .env cannot use placeholder values. Set real credentials before starting the server.');
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO admin (username, passwordHash) VALUES (?, ?)').run(username, passwordHash);
  console.log(`Admin account created for username "${username}". Log in at /admin/login.`);
}

module.exports = {
  perfumes: {
    getAll: getAllPerfumes,
    getFeatured: getFeaturedPerfumes,
    getById: getPerfumeById,
    getBrands,
    create: createPerfume,
    update: updatePerfume,
    remove: removePerfume
  },
  inquiries: {
    getAll: getAllInquiries,
    create: createInquiry,
    markRead: markInquiryRead,
    remove: removeInquiry,
    unreadCount: unreadInquiryCount
  },
  admin: {
    findByUsername: findAdminByUsername,
    ensureDefaultAdmin
  }
};
