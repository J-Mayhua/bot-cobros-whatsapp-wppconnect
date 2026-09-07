// src/jobs/recordatoriosPrevios.js
const { CONFIG } = require('../config');
const { formatearFecha, obtenerNombreMes, diasParaVencer, sleep } = require('../utils/fechas');
const { limpiarTelefono } = require('../utils/telefono');
const { enviarWhatsApp, getClient, isReady } = require('../services/whatsappService');
const ucrm = require('../services/ucrmClient');
const { clienteEstaBloqueado } = require('../config/blacklist');
const store = require('../storage/jsonStore');
function clienteDebeRecibirMensajes(cliente) { return cliente && (!CONFIG.VALIDAR_CLIENTE_ACTIVO || cliente.isActive !== 0); }
async function clienteTieneServicioActivo(id) { return (await ucrm.obtenerServiciosCliente(id)).some(s => [1, 2, 3, 4].includes(s.status)); }
async function procesarRecordatoriosPrevios() {
  if (!isReady()) return;
  const facturas = await ucrm.obtenerFacturasSinPagar(); const grupos = {};
  facturas.filter(f => diasParaVencer(f.dueDate) === 1).forEach(f => { (grupos[f.clientId] ||= []).push(f); });
  for (const [clienteId, facturasCliente] of Object.entries(grupos)) {
    const cliente = await ucrm.obtenerCliente(clienteId);
    if (!cliente || clienteEstaBloqueado(cliente) || !clienteDebeRecibirMensajes(cliente) || !(await clienteTieneServicioActivo(cliente.id)) || store.yaSeEnvioHoy(cliente.id)) continue;
    const telefono = cliente.contacts?.[0]?.phone; if (!telefono) continue;
    let total = 0; let mensaje = `⏰ Hola ${cliente.firstName.split(' ')[0]},\n\n${facturasCliente.length === 1 ? 'Tu pago del mes vence *MAÑANA*.' : `Tus ${facturasCliente.length} recibos vencen *MAÑANA*.`}\n\n📋 *FACTURAS PENDIENTES:*\n`;
    facturasCliente.forEach((f, i) => { const monto = Number(f.amountToPay || f.total || 0); total += monto; mensaje += `${i + 1}. Factura ${f.number} (${obtenerNombreMes(f.dueDate)})\n   💰 S/ ${monto.toFixed(2)}\n   📅 Vence: ${formatearFecha(f.dueDate)}\n\n`; });
    mensaje += `━━━━━━━━━━━━━━━━\n💰 *TOTAL: S/ ${total.toFixed(2)}*\n\nPuedes pagar en:\n\n💳 *YAPE:* ${CONFIG.CUENTAS_PAGO.yape}\n🏦 *CTA CTE. SCOTIABANK:* ${CONFIG.CUENTAS_PAGO.scotiabank}\n🏦 *CTA AHORROS BCP:* ${CONFIG.CUENTAS_PAGO.bcp}\n👤 *${CONFIG.CUENTAS_PAGO.nombre_titular}*\n\nCuando pagues, dime *"Ya pagué"* con tu comprobante 📸\n\n¡Gracias por tu puntualidad! 😊`;
    if (!await enviarWhatsApp(telefono, mensaje)) continue;
    for (const factura of facturasCliente) { await sleep(3000); const pdf = await ucrm.descargarPDFFacturaBuffer(factura.id); if (pdf) await getClient().sendFile(`${limpiarTelefono(telefono)}@c.us`, `data:application/pdf;base64,${pdf.toString('base64')}`, `factura_${factura.number}.pdf`, 'Aquí está tu recibo'); }
    store.marcarMensajeEnviado(cliente.id); await ucrm.agregarNotaCliente(cliente.id, `⏰ Recordatorio previo - ${facturasCliente.length} factura(s) - Vence MAÑANA - S/ ${total.toFixed(2)}`);
  }
}
function programarRecordatoriosPrevios() {
  const ahora = new Date(); const hora = ahora.getHours();
  if (hora >= CONFIG.HORA_INICIO_PREVIOS && hora < CONFIG.HORA_FIN_PREVIOS) procesarRecordatoriosPrevios();
  else { const siguiente = new Date(); if (hora >= CONFIG.HORA_FIN_PREVIOS) siguiente.setDate(siguiente.getDate() + 1); siguiente.setHours(CONFIG.HORA_INICIO_PREVIOS, 0, 0, 0); setTimeout(() => { procesarRecordatoriosPrevios(); setInterval(procesarRecordatoriosPrevios, 86400000); }, siguiente - ahora); }
}
module.exports = { procesarRecordatoriosPrevios, programarRecordatoriosPrevios, clienteDebeRecibirMensajes, clienteTieneServicioActivo };
