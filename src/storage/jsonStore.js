// src/storage/jsonStore.js
const fs = require('fs');
const { CONFIG } = require('../config');

let mensajesEnviados = {};
let pagosProcesados = {};
let cicloActual = { inicioCiclo: null, clientesEnviados: [], cicloCompletado: false, ultimaActualizacionCola: null };
let colaRecordatorios = { clientes: [], ultimaActualizacion: null };

function leerJson(file, fallback) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
  catch (error) { console.error(`Error leyendo ${file}:`, error.message); return fallback; }
}
function escribirJson(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
  catch (error) { console.error(`Error guardando ${file}:`, error.message); }
}
function cargarMensajesEnviados() { mensajesEnviados = leerJson(CONFIG.MENSAJES_ENVIADOS_FILE, {}); console.log('✓ Historial de mensajes cargado'); }
function guardarMensajesEnviados() { escribirJson(CONFIG.MENSAJES_ENVIADOS_FILE, mensajesEnviados); }
function cargarPagosProcesados() { pagosProcesados = leerJson(CONFIG.PAGOS_PROCESADOS_FILE, {}); console.log('✓ Historial de pagos procesados cargado'); }
function guardarPagosProcesados() { escribirJson(CONFIG.PAGOS_PROCESADOS_FILE, pagosProcesados); }
function cargarCicloActual() { cicloActual = leerJson(CONFIG.CICLO_FILE, cicloActual); console.log('✓ Estado de ciclo cargado'); }
function guardarCicloActual() { escribirJson(CONFIG.CICLO_FILE, cicloActual); }
function reiniciarCiclo() {
  cicloActual = { inicioCiclo: new Date().toISOString(), clientesEnviados: [], cicloCompletado: false };
  guardarCicloActual(); console.log('♻️  Ciclo reiniciado');
}
function cargarColaRecordatorios() { colaRecordatorios = leerJson(CONFIG.COLA_RECORDATORIOS_FILE, colaRecordatorios); console.log('✓ Cola de recordatorios cargada'); }
function guardarColaRecordatorios() { escribirJson(CONFIG.COLA_RECORDATORIOS_FILE, colaRecordatorios); }
function yaSeEnvioHoy(clienteId) { return mensajesEnviados[`${clienteId}_notificado_${new Date().toISOString().split('T')[0]}`] === true; }
function marcarMensajeEnviado(clienteId) {
  mensajesEnviados[`${clienteId}_notificado_${new Date().toISOString().split('T')[0]}`] = true;
  guardarMensajesEnviados(); console.log(`   🔖 Cliente ${clienteId} marcado como notificado`);
}
function yaSeProcesoPago(id) { return pagosProcesados[id] === true; }
function marcarPagoProcesado(id) { pagosProcesados[id] = true; guardarPagosProcesados(); }
function limpiarMensajesAntiguos() {
  const limite = new Date(); limite.setDate(limite.getDate() - 7);
  Object.keys(mensajesEnviados).forEach(key => { const fecha = key.split('_')[2]; if (fecha && new Date(fecha) < limite) delete mensajesEnviados[key]; });
  guardarMensajesEnviados();
}
function limpiarPagosAntiguos() { console.log(`ℹ️  Pagos procesados en memoria: ${Object.keys(pagosProcesados).length}`); }
module.exports = {
  cargarMensajesEnviados, guardarMensajesEnviados, cargarPagosProcesados, guardarPagosProcesados,
  cargarCicloActual, guardarCicloActual, reiniciarCiclo, cargarColaRecordatorios, guardarColaRecordatorios,
  yaSeEnvioHoy, marcarMensajeEnviado, yaSeProcesoPago, marcarPagoProcesado, limpiarMensajesAntiguos,
  limpiarPagosAntiguos, getState: () => ({ get mensajesEnviados() { return mensajesEnviados; }, get pagosProcesados() { return pagosProcesados; }, get cicloActual() { return cicloActual; }, get colaRecordatorios() { return colaRecordatorios; } })
};
