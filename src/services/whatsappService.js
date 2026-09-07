// src/services/whatsappService.js
const { limpiarTelefono } = require('../utils/telefono');
const { sleep } = require('../utils/fechas');
const { CONFIG } = require('../config');
let whatsappClient = null;
let whatsappReady = false;
function setClient(client) { whatsappClient = client; whatsappReady = Boolean(client); }
function getClient() { return whatsappClient; }
function isReady() { return whatsappReady && Boolean(whatsappClient); }
async function enviarWhatsApp(telefono, mensaje) {
  if (!isReady()) { console.log('⚠️ WhatsApp no está listo'); return false; }
  try {
    const numeroLimpio = limpiarTelefono(telefono); if (!numeroLimpio) { console.log('❌ Teléfono inválido', telefono); return false; }
    await Promise.race([whatsappClient.sendText(`${numeroLimpio}@c.us`, mensaje), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 60s')), 60000))]);
    console.log('✅ Mensaje enviado a', numeroLimpio); return true;
  } catch (error) {
    if (/protocolTimeout|Runtime.callFunctionOn|Timeout 60s/.test(error.message)) {
      console.error('🚨 TIMEOUT CRÍTICO - Forzando reinicio'); process.exit(1);
    }
    console.error('❌ Error enviando a', telefono, ':', error.message); return false;
  }
}
async function enviarPDFDesdeMemoria(telefono, mensaje, pdfBuffer, nombreArchivo) {
  if (!isReady()) { console.log('⚠️  WhatsApp no está listo'); return false; }
  try {
    const numeroLimpio = limpiarTelefono(telefono); if (!numeroLimpio) return false;
    const chatId = `${numeroLimpio}@c.us`; await whatsappClient.sendText(chatId, mensaje);
    if (pdfBuffer) { await sleep(3000); await whatsappClient.sendFile(chatId, `data:application/pdf;base64,${pdfBuffer.toString('base64')}`, nombreArchivo, 'Aquí está tu recibo'); }
    return true;
  } catch (error) { console.error('❌ Error enviando mensaje/PDF:', error.message); return false; }
}
module.exports = { setClient, getClient, isReady, enviarWhatsApp, enviarPDFDesdeMemoria };
