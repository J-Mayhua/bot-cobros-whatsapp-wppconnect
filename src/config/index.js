// src/config/index.js
const path = require('path');
require('dotenv').config();

const CONFIG = {
  UCRM_URL: process.env.UCRM_URL || 'https://92.118.58.202:8443',
  UCRM_API_KEY: process.env.UCRM_API_KEY,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  PHONE_RECORDATORIOS: process.env.PHONE_RECORDATORIOS || '51920779122',
  PHONE_NOTIFICACIONES: process.env.PHONE_NOTIFICACIONES || '51999001245',
  CUENTAS_PAGO: {
    scotiabank: process.env.SCOTIA_CUENTA || '770-8074385',
    scotiabank_cci: process.env.SCOTIA_CCI || '00942320770807438555',
    bcp: process.env.BCP_CUENTA || '35591107096005',
    yape: process.env.YAPE_NUMERO || '920779122',
    nombre_titular: process.env.NOMBRE_TITULAR_SCOTIA || 'Elizabeth Tacay Canturin'
  },
  DELAY_RECORDATORIOS_DEUDA: 10 * 60 * 1000,
  HORA_INICIO_DEUDA: 8,
  HORA_FIN_DEUDA: 18,
  HORA_INICIO_PREVIOS: 18,
  HORA_FIN_PREVIOS: 20,
  DIAS_RECORDATORIOS: [1],
  DIAS_ENTRE_RECORDATORIOS: 5,
  DIAS_RECORDATORIOS_DEUDA: [0, 2, 5, 9, 16, 23, 30],
  MAX_DIAS_DEUDA_RECORDATORIOS: 99999,
  MENSAJES_ENVIADOS_FILE: './mensajes_enviados.json',
  PAGOS_PROCESADOS_FILE: './pagos_procesados.json',
  VOUCHERS_DIR: './vouchers',
  VALIDAR_CLIENTE_ACTIVO: true,
  API_LIMIT: 10000,
  INTERVALO_MONITOR_PAGOS: 5 * 60 * 1000,
  CICLO_FILE: './ciclo_actual.json',
  COLA_RECORDATORIOS_FILE: './cola_recordatorios.json',
  PORT: 3000,
  SESSION_PATH: path.join(process.cwd(), '.wwebjs_auth')
};

if (!CONFIG.UCRM_API_KEY) {
  throw new Error('Falta la variable de entorno crítica UCRM_API_KEY');
}

module.exports = { CONFIG };
