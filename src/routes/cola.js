// src/routes/cola.js
const express = require('express');
const store = require('../storage/jsonStore');
const ucrm = require('../services/ucrmClient');
const { obtenerNombreMesCompleto } = require('../utils/fechas');
function crearRouter() {
  const router = express.Router();
  router.get('/verificar-cola', async (req, res) => {
    try { const { colaRecordatorios } = store.getState(); const limite = req.query.limit ? parseInt(req.query.limit, 10) : 10; const muestra = [];
      for (const item of colaRecordatorios.clientes.slice(0, limite)) { const facturas = []; for (const f of item.facturas) { const actual = await ucrm.obtenerFactura(f.id); facturas.push({ facturaId: f.id, numero: f.numero, montoEnCola: f.monto, estadoReal: actual ? { status: actual.status, montoPendiente: Number(actual.amountToPay || actual.toPay || 0), fechaVencimiento: actual.dueDate, numero: actual.number } : { error: 'Factura no encontrada en UCRM' } }); } muestra.push({ cliente: item.nombre, clienteId: item.clienteId, cantidadFacturas: item.cantidadFacturas, diasDeuda: item.diasDeuda, totalEnCola: item.monto, ultimoEnvio: item.ultimoEnvio, intentos: item.intentos, facturas }); }
      res.json({ timestamp: new Date().toISOString(), totalEnCola: colaRecordatorios.clientes.length, clientesVerificados: muestra.length, muestra });
    } catch (error) { res.status(500).json({ error: 'Error verificando cola', mensaje: error.message }); }
  });
  router.get('/limpiar-cola', async (req, res) => {
    try { const { colaRecordatorios } = store.getState(); const original = colaRecordatorios.clientes.length, conservados = [], eliminados = [];
      for (const item of colaRecordatorios.clientes) { const facturas = []; for (const f of item.facturas) { const actual = await ucrm.obtenerFactura(f.id); if (actual?.status === 1 && Number(actual.amountToPay || actual.toPay || 0) > 0) facturas.push({ id: actual.id, numero: actual.number, monto: Number(actual.amountToPay || actual.toPay || 0), vencimiento: actual.dueDate, mes: obtenerNombreMesCompleto(actual.dueDate) }); else eliminados.push({ cliente: item.nombre, facturaId: f.id, razon: actual ? 'Factura no pendiente' : 'Factura no encontrada' }); } if (facturas.length) conservados.push({ ...item, facturas, cantidadFacturas: facturas.length, monto: facturas.reduce((s, f) => s + f.monto, 0) }); }
      colaRecordatorios.clientes = conservados; store.guardarColaRecordatorios(); res.json({ mensaje: '🧹 Limpieza completada', estadisticas: { totalOriginal: original, clientesConservados: conservados.length, facturasEliminadas: eliminados.length }, detalleEliminados: eliminados, timestamp: new Date().toISOString() });
    } catch (error) { res.status(500).json({ error: 'Error limpiando cola', mensaje: error.message }); }
  });
  return router;
}
module.exports = crearRouter;
