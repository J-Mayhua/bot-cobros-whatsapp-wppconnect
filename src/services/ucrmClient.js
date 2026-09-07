// src/services/ucrmClient.js
const axios = require('axios');
const https = require('https');
const { CONFIG } = require('../config');
const { limpiarTelefono } = require('../utils/telefono');
const { diasParaVencer, sleep } = require('../utils/fechas');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const headers = { 'X-Auth-App-Key': CONFIG.UCRM_API_KEY };

async function obtenerFacturasSinPagar() {
  try {
    const response = await axios.get(`${CONFIG.UCRM_URL}/api/v1.0/invoices`, { headers, params: { status: 1, limit: CONFIG.API_LIMIT }, httpsAgent });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) { console.error('Error obteniendo facturas:', error.message); return []; }
}
async function obtenerCliente(clienteId) {
  try { return (await axios.get(`${CONFIG.UCRM_URL}/api/v1.0/clients/${clienteId}`, { headers, httpsAgent })).data; }
  catch (error) { return null; }
}
async function obtenerServiciosCliente(clienteId) {
  try {
    const response = await axios.get(`${CONFIG.UCRM_URL}/api/v1.0/clients/services`, { headers, params: { clientId: clienteId }, httpsAgent });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) { console.error(`   ⚠️  Error obteniendo servicios cliente ${clienteId}:`, error.message); return []; }
}
async function obtenerFactura(facturaId) {
  try { return (await axios.get(`${CONFIG.UCRM_URL}/api/v1.0/invoices/${facturaId}`, { headers, httpsAgent })).data; }
  catch (error) { console.error(`   ⚠️  Error obteniendo factura ${facturaId}:`, error.message); return null; }
}
async function obtenerTodosLosClientes() {
  try {
    let todos = [], offset = 0, hayMas = true;
    while (hayMas) {
      const response = await axios.get(`${CONFIG.UCRM_URL}/api/v1.0/clients`, { headers, params: { limit: 100, offset }, httpsAgent });
      if (!Array.isArray(response.data)) break;
      todos = todos.concat(response.data);
      if (response.data.length < 100) hayMas = false; else { offset += 100; await sleep(1000); }
    }
    return todos;
  } catch (error) { console.error('Error obteniendo clientes:', error.message); return []; }
}
async function buscarClientePorTelefono(telefono) {
  try {
    const numeroLimpio = limpiarTelefono(telefono); if (!numeroLimpio) return null;
    const ultimos9 = numeroLimpio.slice(-9);
    for (const cliente of await obtenerTodosLosClientes()) {
      for (const contacto of (cliente.contacts || [])) {
        const tel = limpiarTelefono(contacto.phone);
        if (tel === numeroLimpio || (tel && tel.slice(-9) === ultimos9)) return cliente;
      }
    }
    return null;
  } catch (error) { return null; }
}
async function buscarPagosCliente(clienteId, dias = 7) {
  try {
    const desde = new Date(); desde.setDate(desde.getDate() - dias);
    const response = await axios.get(`${CONFIG.UCRM_URL}/api/v1.0/payments`, { headers, params: { clientId: clienteId, createdDateFrom: desde.toISOString().split('T')[0] }, httpsAgent });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) { return []; }
}
async function obtenerDeudaCliente(clienteId) {
  try {
    const response = await axios.get(`${CONFIG.UCRM_URL}/api/v1.0/invoices`, { headers, params: { clientId: clienteId, status: 1 }, httpsAgent });
    if (!Array.isArray(response.data)) return { facturas: [], total: 0 };
    let total = 0;
    const facturas = response.data.map(f => { const monto = Number(f.amountToPay || f.toPay || f.amountDue || 0); total += monto; return { numero: f.number, monto, vence: f.dueDate, dias: diasParaVencer(f.dueDate) }; });
    return { facturas, total };
  } catch (error) { console.error('Error obteniendo deuda:', error.message); return { facturas: [], total: 0 }; }
}
async function agruparFacturasPorCliente(facturas) {
  const mapa = new Map();
  for (const factura of facturas) {
    if (!mapa.has(factura.clientId)) mapa.set(factura.clientId, { clienteId: factura.clientId, facturas: [], total: 0 });
    const grupo = mapa.get(factura.clientId); grupo.facturas.push(factura); grupo.total += Number(factura.amountToPay || factura.toPay || 0);
  }
  return Array.from(mapa.values());
}
async function agregarNotaCliente(clienteId, nota) {
  try { await axios.post(`${CONFIG.UCRM_URL}/api/v1.0/clients/${clienteId}/notes`, { subject: 'Automatización', body: nota }, { headers, httpsAgent }); }
  catch (error) { console.error('   ⚠️  Error agregando nota:', error.message); }
}
async function descargarPDFFacturaBuffer(facturaId) {
  try { const r = await axios.get(`${CONFIG.UCRM_URL}/api/v1.0/invoices/${facturaId}/pdf`, { headers, responseType: 'arraybuffer', httpsAgent }); return Buffer.from(r.data); }
  catch (error) { console.error('Error descargando PDF:', error.message); return null; }
}
async function descargarPDFPagoBuffer(pagoId) {
  try { const r = await axios.get(`${CONFIG.UCRM_URL}/api/v1.0/payments/${pagoId}/pdf`, { headers, responseType: 'arraybuffer', httpsAgent }); return Buffer.from(r.data); }
  catch (error) { console.error('Error descargando recibo:', error.message); return null; }
}
module.exports = { obtenerFacturasSinPagar, obtenerCliente, obtenerServiciosCliente, obtenerFactura, obtenerTodosLosClientes, buscarClientePorTelefono, buscarPagosCliente, obtenerDeudaCliente, agruparFacturasPorCliente, agregarNotaCliente, descargarPDFFacturaBuffer, descargarPDFPagoBuffer };
