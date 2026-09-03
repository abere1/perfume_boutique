// Every value here comes from .env, with a placeholder fallback so the site
// still runs before you've configured anything. Edit .env, not this file.

module.exports = {
  name: process.env.SITE_NAME || 'Lumiere Parfums',
  tagline: process.env.SITE_TAGLINE || 'Authentic imported fragrances, curated for you',
  currency: process.env.CURRENCY_SYMBOL || '$',
  whatsappNumber: (process.env.WHATSAPP_NUMBER || '').replace(/[^0-9]/g, ''),
  email: process.env.CONTACT_EMAIL || 'hello@example.com',
  phone: process.env.CONTACT_PHONE || '+1 (000) 000-0000',
  address: process.env.ADDRESS || 'Your City, Your Country',
  social: {
    instagram: process.env.INSTAGRAM_URL || '',
    telegram: process.env.TELEGRAM_URL || '',
    tiktok: process.env.TIKTOK_URL || '',
    facebook: process.env.FACEBOOK_URL || ''
  },
  year: new Date().getFullYear()
};
