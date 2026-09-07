// src/wppconnect/client.js
const fs = require('fs');
const path = require('path');
const wppconnect = require('@wppconnect-team/wppconnect');
const qrcode = require('qrcode-terminal');
const { CONFIG } = require('../config');
const { limpiarTelefono } = require('../utils/telefono');
const { formatearFecha } = require('../utils/fechas');
const { buscarClientePorTelefono, buscarPagosCliente, agregarNotaCliente } = require('../services/ucrmClient');
const { enviarWhatsApp, setClient } = require('../services/whatsappService');
const { procesarImagenVoucher } = require('../services/ocrService');
const { enviarEmail } = require('../services/emailService');
const mensajesProcesados = new Set();
const ultimasRespuestas = {};
const COOLDOWN_RESPUESTAS = 5 * 60 * 1000;
function puedeResponder(telefono, tipo) {
  const clave = `${telefono}_${tipo}`, ahora = Date.now();
  if (ultimasRespuestas[clave] && ahora - ultimasRespuestas[clave] < COOLDOWN_RESPUESTAS) return false;
  ultimasRespuestas[clave] = ahora; return true;
}
async function procesarVoucher(telefono, message, client) {
  try {
    const cliente = await buscarClientePorTelefono(telefono);
    if (!cliente) { await client.sendText(message.from, 'Lo siento, no encontramos tu cuenta. Contacta a soporte.'); return; }
    const media = await client.decryptFile(message);
    if (!media) { await client.sendText(message.from, 'No pude descargar la imagen. Intenta nuevamente.'); return; }
    const filename = `voucher_${cliente.id}_${Date.now()}.jpg`; fs.writeFileSync(path.join(CONFIG.VOUCHERS_DIR, filename), media, 'base64');
    const datos = await procesarImagenVoucher(path.join(CONFIG.VOUCHERS_DIR, filename));
    let nota = `📸 CLIENTE ENVIÓ VOUCHER\nArchivo: ${filename}\nTeléfono: ${telefono}\n`;
    if (datos?.monto) nota += `Monto: S/ ${datos.monto.toFixed(2)}\n`; if (datos?.fecha) nota += `Fecha: ${datos.fecha}\n`; if (datos?.operacion) nota += `Operación: ${datos.operacion}\n`; if (datos?.banco) nota += `Banco: ${datos.banco}\n`; nota += datos ? '⏳ PENDIENTE DE VERIFICACIÓN' : 'Voucher recibido - OCR falló';
    await agregarNotaCliente(cliente.id, nota);
    await enviarWhatsApp(CONFIG.PHONE_NOTIFICACIONES, `${cliente.firstName} ${cliente.lastName} envió voucher.\n${filename}`);
    await client.sendText(message.from, datos ? `✅ ¡Gracias ${cliente.firstName}!\n\nRecibimos tu comprobante de pago.\n\n⏳ Estamos verificando tu pago.\nTe confirmaremos en unos minutos. 😊` : `Gracias ${cliente.firstName}, recibimos tu comprobante. ✅\nEstamos verificando y te confirmaremos pronto.`);
  } catch (error) { console.error('Error procesando voucher:', error.message); }
}
async function verificarPagoCliente(telefono, client) {
  try {
    const cliente = await buscarClientePorTelefono(telefono);
    if (!cliente) { await client.sendText(`${telefono}@c.us`, 'Lo siento, no encontramos tu cuenta. Contacta a soporte.'); return; }
    const pagos = await buscarPagosCliente(cliente.id, 7);
    if (pagos.length) {
      const pago = pagos[0]; await client.sendText(`${limpiarTelefono(telefono)}@c.us`, `✅ Hola ${cliente.firstName}!\n\nConfirmamos tu pago de S/ ${Number(pago.amount).toFixed(2)}\n📅 Fecha: ${formatearFecha(pago.createdDate)}\n\n¡Gracias por tu puntualidad! 😊`);
      await agregarNotaCliente(cliente.id, `Cliente escribió "Ya pagué" - Pago confirmado S/ ${pago.amount}`);
    } else {
      await client.sendText(`${limpiarTelefono(telefono)}@c.us`, `⏳ Hola ${cliente.firstName},\n\nAún no vemos tu pago registrado.\n\n📸 Por favor envíame una FOTO de tu comprobante de pago.`);
      await agregarNotaCliente(cliente.id, 'Cliente reportó pago pero no hay registro');
      await enviarWhatsApp(CONFIG.PHONE_NOTIFICACIONES, `⚠️ CLIENTE REPORTA PAGO SIN REGISTRO\n\n${cliente.firstName} ${cliente.lastName}\nID: ${cliente.id}\n📱 ${telefono}`);
    }
  } catch (error) { console.error('Error verificando pago:', error.message); }
}
function registrarHandler(client) {
  client.onMessage(async message => {
    if (message.fromMe || message.isGroupMsg || message.from.includes('status@broadcast') || message.from.includes('broadcast') || mensajesProcesados.has(message.id)) return;
    mensajesProcesados.add(message.id);
    const telefono = message.from.replace('@c.us', '');
    if (!message.body || typeof message.body !== 'string') return;
    const texto = message.body.toLowerCase().trim(), tieneImagen = message.mimetype?.includes('image');
    const cliente = await buscarClientePorTelefono(telefono);
    if (cliente) {
      if (tieneImagen) { await procesarVoucher(telefono, message, client); return; }
      if (['ya pague', 'ya pagué', 'ya pagó', 'pague', 'pagué'].some(p => texto.includes(p)) && puedeResponder(telefono, 'pago')) await verificarPagoCliente(telefono, client);
      return;
    }
    if (tieneImagen) {
      try { const media = await client.decryptFile(message); if (media) { const filename = `comprobante_${telefono}_${Date.now()}.jpg`; fs.writeFileSync(path.join(CONFIG.VOUCHERS_DIR, filename), media, 'base64'); await enviarWhatsApp(CONFIG.PHONE_NOTIFICACIONES, `🔔 COMPROBANTE - NÚMERO NO REGISTRADO\n\n👤 Número: +${telefono}\n📸 Archivo: ${filename}`); } } catch (error) { console.error('   ❌ Error procesando comprobante:', error.message); }
    } else if (['pago', 'pagué', 'pagó', 'yape', 'transferencia', 'deposito', 'depósito', 'mes', 'factura', 'recibo'].some(p => texto.includes(p))) await enviarWhatsApp(CONFIG.PHONE_NOTIFICACIONES, `💬 MENSAJE DE PAGO - NO REGISTRADO\n\n👤 Número: +${telefono}\n💬 "${message.body}"`);
  });
}
async function inicializarWPPConnect() {
  console.log('🔗 Iniciando conexión con WhatsApp...');
  const client = await wppconnect.create({
    session: 'ucrm-bot',
    catchQR: (base64Qr, asciiQR, attempts) => { console.log('🔗 ESCANEA ESTE QR CON TU TELÉFONO'); console.log(`Intento ${attempts}/5`); console.log(asciiQR); },
    statusFind: status => console.log('🔄 Estado:', status),
    headless: true, devtools: false, useChrome: true, logQR: false,
    browserArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu', '--disable-software-rasterizer'],
    puppeteerOptions: { timeout: 180000, protocolTimeout: 180000 }, autoClose: 0
  });
  setClient(client); registrarHandler(client); console.log('✅ WhatsApp conectado correctamente'); return client;
}
module.exports = { inicializarWPPConnect, inicializarWhatsApp: inicializarWPPConnect, puedeResponder, procesarVoucher, verificarPagoCliente };
