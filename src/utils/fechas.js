// src/utils/fechas.js
function formatearFecha(fecha) {
  const d = new Date(fecha);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function obtenerNombreMes(fecha) {
  return ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][new Date(fecha).getMonth()];
}
function obtenerNombreMesCompleto(fecha) {
  return ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][new Date(fecha).getMonth()];
}
function diasParaVencer(fecha) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const vencimiento = new Date(fecha); vencimiento.setHours(0, 0, 0, 0);
  return Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
module.exports = { formatearFecha, obtenerNombreMes, obtenerNombreMesCompleto, diasParaVencer, sleep };
