// src/jobs/monitorPagos.js
const { CONFIG } = require('../config');
const { formatearFecha, sleep } = require('../utils/fechas');
const { limpiarTelefono } = require('../utils/telefono');
const { enviarWhatsApp, getClient, isReady } = require('../services/whatsappService');
const ucrm = require('../services/ucrmClient');
const store = require('../storage/jsonStore');
const { yaSeProcesoPago, marcarPagoProcesado } = store;
async function monitorearPagosNuevos() {
  if (!isReady()) { console.log('⏳ WhatsApp no está listo'); return; }
  try {
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    const axios = require('axios'); const https = require('https');
    const response = await axios.get(`${CONFIG.UCRM_URL}/api/v1.0/payments`, { headers: { 'X-Auth-App-Key': CONFIG.UCRM_API_KEY }, params: { createdDateFrom: ayer.toISOString().split('T')[0], limit: 100 }, httpsAgent: new https.Agent({ rejectUnauthorized: false }) });
    if (!Array.isArray(response.data) || !response.data.length) return;
    for (const pago of response.data) {
      if (yaSeProcesoPago(pago.id)) continue;
      const cliente = await ucrm.obtenerCliente(pago.clientId);
      if (!cliente || !cliente.contacts?.[0]?.phone) { marcarPagoProcesado(pago.id); continue; }
      const facturaId = pago.paymentCovers?.[0]?.invoiceId;
      const mensaje = `✅ ¡Hola ${cliente.firstName}!\n\n🎉 Tu pago ha sido CONFIRMADO\n\n💰 Monto: S/ ${Number(pago.amount).toFixed(2)}\n📅 Fecha: ${formatearFecha(pago.createdDate)}\n${facturaId ? `🧾 Factura: #${facturaId}` : ''}\n\n📄 Te envío tu recibo en unos segundos...\n\n¡Gracias por tu pago! 😊`;
      if (await enviarWhatsApp(cliente.contacts[0].phone, mensaje)) {
        await sleep(3000);
        const pdf = await ucrm.descargarPDFPagoBuffer(pago.id);
        if (pdf) await getClient().sendFile(`${limpiarTelefono(cliente.contacts[0].phone)}@c.us`, `data:application/pdf;base64,${pdf.toString('base64')}`, `recibo${pago.id}.pdf`, 'Aquí está tu recibo de pago');
        await ucrm.agregarNotaCliente(cliente.id, `✅ PAGO CONFIRMADO AUTOMÁTICAMENTE\n💰 S/ ${pago.amount}\n📄 Recibo enviado por WhatsApp`);
        await enviarWhatsApp(CONFIG.PHONE_NOTIFICACIONES, `✅ PAGO CONFIRMADO\n\n👤 ${cliente.firstName} ${cliente.lastName}\n🆔 ID: ${cliente.id}\n💰 S/ ${Number(pago.amount).toFixed(2)}\n📅 ${formatearFecha(pago.createdDate)}\n\n✓ Cliente notificado`);
      }
      marcarPagoProcesado(pago.id); await sleep(2000);
    }
  } catch (error) { if (error.response?.status !== 400) console.error('❌ Error en monitor:', error.message); }
}
function iniciarMonitorPagos() { setTimeout(() => { monitorearPagosNuevos(); setInterval(monitorearPagosNuevos, CONFIG.INTERVALO_MONITOR_PAGOS); }, 30000); }
module.exports = { monitorearPagosNuevos, iniciarMonitorPagos };
