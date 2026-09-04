const app = require('../server');
const store = require('../db/store');

let initialization;

module.exports = async function handler(req, res) {
  if (!initialization) {
    initialization = store.initialize()
      .then(() => store.admin.ensureDefaultAdmin());
  }

  await initialization;
  return app(req, res);
};
