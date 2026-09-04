// Supabase-backed data store.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.');
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

class SupabaseSessionStore extends session.Store {
  get(sid, callback) {
    db.from('sessions')
      .select('data, expires_at')
      .eq('sid', sid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return callback(error);
        if (!data || new Date(data.expires_at).getTime() <= Date.now()) {
          return callback(null, null);
        }
        return callback(null, typeof data.data === 'string' ? JSON.parse(data.data) : data.data);
      })
      .catch(callback);
  }

  set(sid, sessionData, callback) {
    const expiresAt = sessionData.cookie && sessionData.cookie.expires
      ? new Date(sessionData.cookie.expires).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.from('sessions')
      .upsert({ sid, data: sessionData, expires_at: expiresAt })
      .then(({ error }) => callback(error || null))
      .catch(callback);
  }

  destroy(sid, callback) {
    db.from('sessions')
      .delete()
      .eq('sid', sid)
      .then(({ error }) => callback(error || null))
      .catch(callback);
  }

  touch(sid, sessionData, callback) {
    const expiresAt = sessionData.cookie && sessionData.cookie.expires
      ? new Date(sessionData.cookie.expires).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.from('sessions')
      .update({ expires_at: expiresAt })
      .eq('sid', sid)
      .then(({ error }) => callback(error || null))
      .catch(callback);
  }
}

const BUCKET_NAME = 'product-images';

async function uploadPerfumeImage(file) {
  if (!file) return null;

  const path = require('path');
  const ext = path.extname(file.originalname).toLowerCase();
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  const { error } = await db.storage
    .from(BUCKET_NAME)
    .upload(filename, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) throw new Error('Image upload failed. Please try again.');

  const { data } = db.storage.from(BUCKET_NAME).getPublicUrl(filename);
  return data.publicUrl;
}

async function removePerfumeImage(imageUrl) {
  if (!imageUrl || !imageUrl.includes(BUCKET_NAME)) return;
  const filename = imageUrl.split('/').pop();
  await db.storage.from(BUCKET_NAME).remove([filename]);
}

function newId() {
  return crypto.randomUUID();
}

function normalizePerfume(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    gender: row.gender,
    category: row.category,
    sizeMl: Number(row.size_ml || 0),
    price: Number(row.price || 0),
    stock: row.stock,
    featured: !!row.featured,
    topNotes: row.top_notes || '',
    heartNotes: row.heart_notes || '',
    baseNotes: row.base_notes || '',
    description: row.description || '',
    image: row.image || '',
    createdAt: row.created_at
  };
}

function normalizeInquiry(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    message: row.message || '',
    perfumeId: row.perfume_id || null,
    perfumeName: row.perfume_name || null,
    read: !!row.read,
    createdAt: row.created_at
  };
}

function throwIfError(result) {
  if (result.error) throw result.error;
  return result.data;
}

const SAMPLE_PERFUMES = [
  {
    id: newId(), name: 'Velvet Oud', brand: 'Maison Noir', gender: 'unisex',
    category: 'Eau de Parfum', size_ml: 100, price: 89, stock: 'in_stock',
    featured: true, top_notes: 'Saffron, Bergamot, Pink Pepper',
    heart_notes: 'Rose, Oud, Cedarwood', base_notes: 'Amber, Musk, Sandalwood',
    description: 'A deep, smoky oud softened with rose and a bright citrus opening. Long-lasting and rich, built for cold evenings.',
    image: ''
  },
  {
    id: newId(), name: 'Citrine Bloom', brand: 'Aeloria', gender: 'women',
    category: 'Eau de Toilette', size_ml: 50, price: 54, stock: 'in_stock',
    featured: true, top_notes: 'Mandarin, Neroli, Green Leaves',
    heart_notes: 'Jasmine, Orange Blossom, Peony', base_notes: 'White Musk, Soft Woods',
    description: 'A bright, sunlit floral that opens sparkling and settles into a soft, clean skin scent.',
    image: ''
  },
  {
    id: newId(), name: 'Slate & Vetiver', brand: 'Nordhaus', gender: 'men',
    category: 'Eau de Parfum', size_ml: 100, price: 76, stock: 'low_stock',
    featured: false, top_notes: 'Grapefruit, Cardamom',
    heart_notes: 'Vetiver, Violet Leaf', base_notes: 'Vetiver, Ambroxan, Cedar',
    description: 'Cool, earthy vetiver with a sharp citrus top and a dry, smoky finish. Understated and sharp.',
    image: ''
  }
];

async function initialize() {
  const perfumes = throwIfError(await db.from('perfumes').select('id').limit(1));
  if (!perfumes.length) {
    throwIfError(await db.from('perfumes').insert(SAMPLE_PERFUMES));
  }
}

async function getAllPerfumes({ gender, brand, search, sort } = {}) {
  let query = db.from('perfumes').select('*');
  if (gender) query = query.eq('gender', gender);
  if (brand) query = query.ilike('brand', brand);
  if (search) query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%`);

  const data = throwIfError(await query);
  let list = data.map(normalizePerfume);
  if (sort === 'price_asc') list.sort((a, b) => a.price - b.price);
  else if (sort === 'price_desc') list.sort((a, b) => b.price - a.price);
  else if (sort === 'name_asc') list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return list;
}

async function getFeaturedPerfumes(limit = 6) {
  return (await getAllPerfumes()).filter((perfume) => perfume.featured).slice(0, limit);
}

async function getPerfumeById(id) {
  const data = throwIfError(await db.from('perfumes').select('*').eq('id', id).maybeSingle());
  return normalizePerfume(data);
}

async function getBrands() {
  const all = await getAllPerfumes();
  return [...new Set(all.map((perfume) => perfume.brand))].sort();
}

async function createPerfume(data) {
  const perfume = {
    id: newId(),
    name: (data.name || '').trim(),
    brand: (data.brand || '').trim(),
    gender: data.gender || 'unisex',
    category: data.category || 'Eau de Parfum',
    size_ml: Number(data.sizeMl) || 0,
    price: Number(data.price) || 0,
    stock: data.stock || 'in_stock',
    featured: !!data.featured,
    top_notes: data.topNotes || '',
    heart_notes: data.heartNotes || '',
    base_notes: data.baseNotes || '',
    description: data.description || '',
    image: data.image || ''
  };
  return normalizePerfume(throwIfError(await db.from('perfumes').insert(perfume).select().single()));
}

async function updatePerfume(id, data) {
  const existing = await getPerfumeById(id);
  if (!existing) return null;
  const updated = {
    name: data.name?.trim() || existing.name,
    brand: data.brand?.trim() || existing.brand,
    gender: data.gender || existing.gender,
    category: data.category || existing.category,
    size_ml: data.sizeMl !== undefined ? Number(data.sizeMl) || 0 : existing.sizeMl,
    price: data.price !== undefined ? Number(data.price) || 0 : existing.price,
    stock: data.stock || existing.stock,
    featured: data.featured !== undefined ? !!data.featured : existing.featured,
    top_notes: data.topNotes !== undefined ? data.topNotes : existing.topNotes,
    heart_notes: data.heartNotes !== undefined ? data.heartNotes : existing.heartNotes,
    base_notes: data.baseNotes !== undefined ? data.baseNotes : existing.baseNotes,
    description: data.description !== undefined ? data.description : existing.description,
    image: data.image ? data.image : existing.image
  };
  return normalizePerfume(throwIfError(await db.from('perfumes').update(updated).eq('id', id).select().single()));
}

async function removePerfume(id) {
  const existing = await getPerfumeById(id);
  if (!existing) return null;
  throwIfError(await db.from('perfumes').delete().eq('id', id));
  return existing;
}

async function getAllInquiries() {
  return throwIfError(await db.from('inquiries').select('*').order('created_at', { ascending: false }))
    .map(normalizeInquiry);
}

async function createInquiry(data) {
  const inquiry = {
    id: newId(),
    name: (data.name || '').trim(),
    contact: (data.contact || '').trim(),
    message: (data.message || '').trim(),
    perfume_id: data.perfumeId || null,
    perfume_name: data.perfumeName || null,
    read: false
  };
  return normalizeInquiry(throwIfError(await db.from('inquiries').insert(inquiry).select().single()));
}

async function markInquiryRead(id) {
  const row = throwIfError(await db.from('inquiries').update({ read: true }).eq('id', id).select().maybeSingle());
  return normalizeInquiry(row);
}

async function removeInquiry(id) {
  const existing = normalizeInquiry(throwIfError(await db.from('inquiries').select('*').eq('id', id).maybeSingle()));
  if (!existing) return null;
  throwIfError(await db.from('inquiries').delete().eq('id', id));
  return existing;
}

async function unreadInquiryCount() {
  const result = await db.from('inquiries').select('id', { count: 'exact', head: true }).eq('read', false);
  if (result.error) throw result.error;
  return result.count || 0;
}

async function findAdminByUsername(username) {
  const row = throwIfError(await db.from('admin').select('*').eq('username', username).maybeSingle());
  return row ? { username: row.username, passwordHash: row.password_hash } : null;
}

async function ensureDefaultAdmin() {
  const existing = throwIfError(await db.from('admin').select('username').limit(1));
  if (existing.length) return;
  const username = (process.env.ADMIN_USERNAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!username || username.length < 3 || !password || password.length < 12) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env with strong values before starting the app.');
  }
  if (/change-this|replace-with|example/i.test(username) || /change-this|replace-with|example/i.test(password)) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD in .env cannot use placeholder values.');
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  throwIfError(await db.from('admin').insert({ username, password_hash: passwordHash }));
  console.log(`Admin account created for username "${username}".`);

  module.exports = {
  initialize,
  createSessionStore: () => new SupabaseSessionStore(),
  perfumes: {
    getAll: getAllPerfumes, getFeatured: getFeaturedPerfumes, getById: getPerfumeById,
    getBrands, create: createPerfume, update: updatePerfume, remove: removePerfume
  },
  inquiries: {
    getAll: getAllInquiries, create: createInquiry, markRead: markInquiryRead,
    remove: removeInquiry, unreadCount: unreadInquiryCount
  },
  admin: { findByUsername: findAdminByUsername, ensureDefaultAdmin },
  images: { upload: uploadPerfumeImage, remove: removePerfumeImage }   // ← new
};