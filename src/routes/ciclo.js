// src/routes/ciclo.js
const express = require('express');
const { CONFIG } = require('../config');
const store = require('../storage/jsonStore');
function crearRouter() {
  const router = express.Router();
  router.get('/ciclo', (req, res) => {
    const { cicloActual, colaRecordatorios } = store.getState();
    const dias = cicloActual.inicioCiclo ? (new Date() - new Date(cicloActual.inicioCiclo)) / 86400000 : 0;
    res.json({ cicloActual: { inicioCiclo: cicloActual.inicioCiclo, diasTranscurridos: dias.toFixed(2), diasRestantes: Math.max(0, CONFIG.DIAS_ENTRE_RECORDATORIOS - dias).toFixed(2), clientesEnviados: cicloActual.clientesEnviados.length, totalClientes: colaRecordatorios.clientes.length, porcentajeCompletado: colaRecordatorios.clientes.length ? ((cicloActual.clientesEnviados.length / colaRecordatorios.clientes.length) * 100).toFixed(1) : 0, cicloCompletado: cicloActual.cicloCompletado } });
  });
  router.get('/reiniciar-ciclo', (req, res) => { store.reiniciarCiclo(); res.json({ message: 'Ciclo reiniciado manualmente', nuevoCiclo: store.getState().cicloActual }); });
  return router;
}
module.exports = crearRouter;
