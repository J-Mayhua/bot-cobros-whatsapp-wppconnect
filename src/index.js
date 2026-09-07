// src/index.js
const { CONFIG } = require('./config');
const { inicializarWPPConnect } = require('./wppconnect/client');
const { crearApp } = require('./app');
const store = require('./storage/jsonStore');
const { iniciarMonitorPagos } = require('./jobs/monitorPagos');
const { programarRecordatoriosPrevios } = require('./jobs/recordatoriosPrevios');
const { programarRecordatoriosDeuda } = require('./jobs/recordatoriosDeuda');
const { programarResumenDiario } = require('./jobs/resumenDiario');

async function iniciarSistema() {
  store.cargarMensajesEnviados(); store.cargarPagosProcesados(); store.cargarColaRecordatorios(); store.cargarCicloActual(); store.limpiarMensajesAntiguos(); store.limpiarPagosAntiguos();
  const app = crearApp();
  app.listen(CONFIG.PORT, () => console.log(`\n🌐 Servidor: http://localhost:${CONFIG.PORT}`));
  await inicializarWPPConnect();
  iniciarMonitorPagos(); programarRecordatoriosPrevios(); programarRecordatoriosDeuda(); programarResumenDiario();
}
iniciarSistema().catch(error => { console.error('❌ Error iniciando sistema:', error); process.exit(1); });
module.exports = { iniciarSistema };
