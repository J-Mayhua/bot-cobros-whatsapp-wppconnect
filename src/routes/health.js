// src/routes/health.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { CONFIG } = require('../config');
const { isReady } = require('../services/whatsappService');
function crearRouter() {
  const router = express.Router();
  router.get('/health', (req, res) => res.json({ status: 'OK', whatsapp: isReady(), vouchers: fs.readdirSync(CONFIG.VOUCHERS_DIR).length, timestamp: new Date().toISOString() }));
  router.get('/vouchers', (req, res) => {
    const vouchers = fs.readdirSync(CONFIG.VOUCHERS_DIR).filter(f => f.endsWith('.jpg')).map(f => ({ nombre: f, fecha: fs.statSync(path.join(CONFIG.VOUCHERS_DIR, f)).mtime })).sort((a, b) => b.fecha - a.fecha);
    res.json({ total: vouchers.length, vouchers });
  });
  return router;
}
module.exports = crearRouter;
