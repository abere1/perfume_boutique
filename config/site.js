// Every value here comes from .env, with a placeholder fallback so the site
// still runs before you've configured anything. Edit .env, not this file.

module.exports = {
  name: process.env.SITE_NAME || 'Roha perfumes',
  tagline: process.env.SITE_TAGLINE || 'Authentic imported fragrances, curated for you',
  currency: process.env.CURRENCY_SYMBOL || 'Birr',
  whatsappNumber: (process.env.WHATSAPP_NUMBER || '+251 913616101').replace(/[^0-9]/g, ''),
  email: process.env.CONTACT_EMAIL || 'hello@example.com',
  phone: process.env.CONTACT_PHONE || '+251 913616101',
  address: process.env.ADDRESS || 'Addis Ababa, Ethiopia',
  social: {
    instagram: process.env.INSTAGRAM_URL || '',
    telegram: process.env.TELEGRAM_URL || 'https://t.me/roha_perfume',
    tiktok: process.env.TIKTOK_URL || 'https://vt.tiktok.com/ZSqRX8m23/',
    facebook: process.env.FACEBOOK_URL || ''
  },
  year: new Date().getFullYear()
};
