// src/app.js
const express = require('express');
const fs = require('fs');
const { CONFIG } = require('./config');
const health = require('./routes/health');
const ciclo = require('./routes/ciclo');
const cola = require('./routes/cola');
const store = require('./storage/jsonStore');
const { getClient } = require('./services/whatsappService');
function crearApp() {
  fs.mkdirSync(CONFIG.VOUCHERS_DIR, { recursive: true });
  const app = express();
  app.use(health()); app.use(ciclo()); app.use(cola());
  app.get('/shutdown', (req, res) => { res.json({ message: 'Apagando sistema...', status: 'OK' }); setTimeout(async () => { store.guardarMensajesEnviados(); store.guardarPagosProcesados(); store.guardarCicloActual(); if (getClient()) await getClient().close(); process.exit(0); }, 2000); });
  return app;
}
module.exports = { crearApp };
