// src/jobs/recordatoriosDeuda.js
const { CONFIG } = require('../config');
const { sleep, obtenerNombreMesCompleto } = require('../utils/fechas');
const { limpiarTelefono } = require('../utils/telefono');
const { enviarWhatsApp, getClient, isReady } = require('../services/whatsappService');
const { clienteEstaBloqueado } = require('../config/blacklist');
const ucrm = require('../services/ucrmClient');
const store = require('../storage/jsonStore');
let procesandoRecordatorios = false;
async function actualizarColaRecordatorios() {
  const state = store.getState(); const cola = state.colaRecordatorios; const ciclo = state.cicloActual;
  const ahora = new Date(); const ultima = ciclo.ultimaActualizacionCola ? new Date(ciclo.ultimaActualizacionCola) : null;
  if (ultima && ahora.toDateString() === ultima.toDateString() && cola.clientes.length) return;
  cola.clientes = []; ciclo.ultimaActualizacionCola = ahora.toISOString(); store.guardarCicloActual();
  const porCliente = {};
  for (const f of await ucrm.obtenerFacturasSinPagar()) (porCliente[f.clientId] ||= []).push(f);
  for (const [id, facturas] of Object.entries(porCliente)) {
    const cliente = await ucrm.obtenerCliente(id); if (!cliente || clienteEstaBloqueado(cliente) || !cliente.contacts?.[0]?.phone) continue;
    const validas = facturas.filter(f => f.status === 1 && Number(f.amountToPay || f.toPay || 0) > 0);
    if (!validas.length) continue;
    const dias = Math.max(...validas.map(f => Math.floor((new Date() - new Date(f.dueDate)) / 86400000)));
    const total = validas.reduce((sum, f) => sum + Number(f.amountToPay || f.toPay || 0), 0);
    cola.clientes.push({ clienteId: cliente.id, nombre: `${cliente.firstName} ${cliente.lastName}`.trim(), telefono: cliente.contacts[0].phone, facturas: validas.map(f => ({ id: f.id, numero: f.number, monto: Number(f.amountToPay || f.toPay || 0), vencimiento: f.dueDate, mes: obtenerNombreMesCompleto(f.dueDate) })), cantidadFacturas: validas.length, diasDeuda: dias, totalDeuda: total, monto: total, ultimoEnvio: null, intentos: 0 });
  }
  cola.clientes.sort((a, b) => b.diasDeuda - a.diasDeuda); store.guardarColaRecordatorios();
}
async function procesarRecordatoriosDeuda() {
  if (procesandoRecordatorios || !isReady()) return;
  procesandoRecordatorios = true;
  try {
    const ahora = new Date(); if (ahora.getHours() < CONFIG.HORA_INICIO_DEUDA || ahora.getHours() >= CONFIG.HORA_FIN_DEUDA) return;
    const state = store.getState(); const cola = state.colaRecordatorios; const ciclo = state.cicloActual;
    await actualizarColaRecordatorios();
    if (!ciclo.inicioCiclo) store.reiniciarCiclo();
    for (const item of cola.clientes) {
      if (ciclo.clientesEnviados.includes(item.clienteId) || store.yaSeEnvioHoy(item.clienteId)) continue;
      const cliente = await ucrm.obtenerCliente(item.clienteId); if (!cliente || clienteEstaBloqueado(cliente)) continue;
      if ((await ucrm.buscarPagosCliente(item.clienteId, 1)).length) { ciclo.clientesEnviados.push(item.clienteId); store.guardarCicloActual(); continue; }
      ciclo.clientesEnviados.push(item.clienteId); store.marcarMensajeEnviado(item.clienteId); store.guardarCicloActual();
      const nombre = item.nombre.split(' ')[0]; let mensaje = `¡Hola, ${nombre}! 😊\n\nEspero que te encuentres muy bien.\nLe escribo para recordarle que tiene ${item.cantidadFacturas} recibo(s) pendiente(s):\nDe ${item.diasDeuda} días de retraso\n\n📄 *FACTURAS PENDIENTES*:\n`;
      item.facturas.forEach((f, i) => { mensaje += `${i + 1}. Factura Recibo -${f.numero}\n📅 ${f.mes}\n💰 S/ ${f.monto.toFixed(2)}\n\n`; });
      mensaje += `💰 *TOTAL: S/ ${item.monto.toFixed(2)}*\n\nPuedes pagar en:\n📱 Yape: *${CONFIG.CUENTAS_PAGO.yape}*\n🏦 Scotiabank: *${CONFIG.CUENTAS_PAGO.scotiabank}*\n🏦 BCP: *${CONFIG.CUENTAS_PAGO.bcp}*\nA nombre de *${CONFIG.CUENTAS_PAGO.nombre_titular}*\n\nUna vez pagado, envíame \"Ya pagué\" y el comprobante 📸.`;
      if (!await enviarWhatsApp(item.telefono, mensaje)) continue;
      for (const factura of item.facturas) { await sleep(3000); const pdf = await ucrm.descargarPDFFacturaBuffer(factura.id); if (pdf) await getClient().sendFile(`${limpiarTelefono(item.telefono)}@c.us`, `data:application/pdf;base64,${pdf.toString('base64')}`, `factura_${factura.numero}.pdf`, 'Aquí está tu factura'); }
      item.ultimoEnvio = new Date().toISOString(); item.intentos++; store.guardarColaRecordatorios(); await ucrm.agregarNotaCliente(item.clienteId, `📩 Recordatorio ${item.intentos} - ${item.cantidadFacturas} factura(s) - ${item.diasDeuda} días - S/ ${item.monto.toFixed(2)}`);
    }
  } finally { procesandoRecordatorios = false; }
}
function iniciarCicloRecordatoriosDeuda() { procesarRecordatoriosDeuda(); const intervalo = setInterval(() => { if (new Date().getHours() >= CONFIG.HORA_FIN_DEUDA) clearInterval(intervalo); else procesarRecordatoriosDeuda(); }, CONFIG.DELAY_RECORDATORIOS_DEUDA); }
function programarRecordatoriosDeuda() { const ahora = new Date(), hora = ahora.getHours(); if (hora >= CONFIG.HORA_INICIO_DEUDA && hora < CONFIG.HORA_FIN_DEUDA) iniciarCicloRecordatoriosDeuda(); else { const siguiente = new Date(); if (hora >= CONFIG.HORA_FIN_DEUDA) siguiente.setDate(siguiente.getDate() + 1); siguiente.setHours(CONFIG.HORA_INICIO_DEUDA, 0, 0, 0); setTimeout(() => { iniciarCicloRecordatoriosDeuda(); setInterval(iniciarCicloRecordatoriosDeuda, 86400000); }, siguiente - ahora); } }
module.exports = { actualizarColaRecordatorios, procesarRecordatoriosDeuda, iniciarCicloRecordatoriosDeuda, programarRecordatoriosDeuda };
