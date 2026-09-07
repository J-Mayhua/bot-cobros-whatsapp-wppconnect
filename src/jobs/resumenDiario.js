// src/jobs/resumenDiario.js
const axios = require('axios');
const { CONFIG } = require('../config');
const { formatearFecha, diasParaVencer } = require('../utils/fechas');
const { enviarWhatsApp } = require('../services/whatsappService');
const { enviarEmail } = require('../services/emailService');
const ucrm = require('../services/ucrmClient');
async function enviarResumenDiario() {
  try {
    const facturas = await ucrm.obtenerFacturasSinPagar(); const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const pagos = await axios.get(`${CONFIG.UCRM_URL}/api/v1.0/payments`, { headers: { 'X-Auth-App-Key': CONFIG.UCRM_API_KEY }, params: { createdDateFrom: hoy.toISOString().split('T')[0], limit: 100 } });
    const pagosHoy = Array.isArray(pagos.data) ? pagos.data : [], vencenHoy = facturas.filter(f => diasParaVencer(f.dueDate) === 0), enDeuda = facturas.filter(f => diasParaVencer(f.dueDate) < 0);
    let resumen = `📊 *RESUMEN DIARIO*\n📅 ${formatearFecha(new Date())}\n\n✅ *PAGOS RECIBIDOS HOY:* ${pagosHoy.length}\n`;
    for (const pago of pagosHoy.slice(0, 5)) { const cliente = await ucrm.obtenerCliente(pago.clientId); if (cliente) resumen += `   • ${cliente.firstName} ${cliente.lastName}: S/ ${Number(pago.amount).toFixed(2)}\n`; }
    resumen += `\n⚠️  *FACTURAS QUE VENCEN HOY:* ${vencenHoy.length}\n\n🚨 *FACTURAS EN DEUDA:* ${enDeuda.length}\n\n📈 *ESTADÍSTICAS:*\n   Total pendientes: ${facturas.length}\n   Facturas al día: ${facturas.length - enDeuda.length}\n   Facturas en deuda: ${enDeuda.length}`;
    await enviarWhatsApp(CONFIG.PHONE_NOTIFICACIONES, resumen); await enviarEmail(CONFIG.ADMIN_EMAIL, `📊 Resumen Diario - ${formatearFecha(new Date())}`, resumen.replace(/\*/g, ''));
  } catch (error) { console.error('❌ Error generando resumen:', error.message); }
}
function programarResumenDiario() { const ahora = new Date(), siguiente = new Date(); siguiente.setHours(18, 0, 0, 0); if (ahora >= siguiente) siguiente.setDate(siguiente.getDate() + 1); setTimeout(() => { enviarResumenDiario(); setInterval(enviarResumenDiario, 86400000); }, siguiente - ahora); }
module.exports = { enviarResumenDiario, programarResumenDiario };
