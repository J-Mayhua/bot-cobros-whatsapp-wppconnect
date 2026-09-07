// src/config/blacklist.js
const CLIENTES_BLOQUEADOS = [
  'CHACA CRUZ, MANUEL', 'HILARIO POMA, FREDDY', 'CRISTOBAL, RAUL',
  'CASTAÑEDA, MIRIAM', 'ORIHUELA CAMARENA, MERCEDES ALICIA',
  'YUCRA CONTRERAS, JUAN ANGEL', 'LIZARRAGA MARAVI, WILFREDO',
  'LUCEN MIRANDA, NICOLAS', 'ESPLANA VARONA, LUIS',
  'SOLANO MIGUEL, MARIBEL', 'PINTO, JHONATAN', 'ESPINOZA, JORGE'
];

function clienteEstaBloqueado(cliente) {
  if (!cliente) return false;
  const nombreCompleto = `${cliente.lastName}, ${cliente.firstName}`.toUpperCase().trim();
  if (CLIENTES_BLOQUEADOS.includes(nombreCompleto)) {
    console.log(`   🚫 Cliente BLOQUEADO: ${nombreCompleto}`);
    return true;
  }
  const nombreLimpio = nombreCompleto.replace(/,/g, '').replace(/\s+/g, ' ');
  return CLIENTES_BLOQUEADOS.some(nombre => {
    const bloqueadoLimpio = nombre.replace(/,/g, '').replace(/\s+/g, ' ');
    if (nombreLimpio === bloqueadoLimpio) {
      console.log(`   🚫 Cliente BLOQUEADO (flexible): ${nombreCompleto}`);
      return true;
    }
    return false;
  });
}

module.exports = { CLIENTES_BLOQUEADOS, clienteEstaBloqueado };
