# Bot de cobros por WhatsApp para UCRM

Bot Node.js para empresas ISP que automatiza la recepción de comprobantes, el seguimiento de pagos y los recordatorios de facturación mediante WhatsApp, con UCRM como fuente de clientes, facturas y pagos.

## Tabla de contenidos

- [Características principales](#características-principales)
- [Stack tecnológico](#stack-tecnológico)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Uso](#uso)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Scripts disponibles](#scripts-disponibles)
- [Endpoints de la API](#endpoints-de-la-api)
- [Flujo del bot](#flujo-del-bot)
- [Datos sensibles y seguridad](#datos-sensibles-y-seguridad)
- [Troubleshooting](#troubleshooting)
- [Licencia](#licencia)

## Características principales

- Recibe imágenes de comprobantes de pago por WhatsApp y las guarda en `vouchers/`.
- Busca al cliente remitente por su teléfono en UCRM.
- Procesa vouchers con Tesseract.js para extraer monto, fecha, banco y número de operación.
- Registra el voucher como nota en la ficha del cliente en UCRM y notifica al administrador por WhatsApp.
- Responde a mensajes como “Ya pagué” consultando los pagos recientes del cliente.
- Monitorea pagos nuevos en UCRM cada cinco minutos, confirma el pago al cliente y envía el recibo PDF por WhatsApp cuando está disponible.
- Envía recordatorios de deuda entre las 08:00 y las 18:00, incluyendo facturas pendientes, cuentas de pago y PDFs de las facturas.
- Envía recordatorios previos entre las 18:00 y las 20:00 para facturas que vencen al día siguiente.
- Genera un resumen diario a las 18:00 y lo envía por WhatsApp y correo electrónico al administrador.
- Mantiene una cola de recordatorios, un ciclo de envíos y registros JSON para evitar duplicados.
- Expone endpoints Express para salud, vouchers, cola y ciclo de facturación.
- Omite clientes incluidos en la lista negra y, en los recordatorios previos, puede validar que tengan servicio activo.

## Stack tecnológico

| Tecnología | Uso |
| --- | --- |
| Node.js `>=18.0.0` | Runtime de la aplicación |
| Express 4 | API HTTP de monitoreo y administración |
| `@wppconnect-team/wppconnect` | Conexión con WhatsApp Web |
| Tesseract.js 5 | OCR de comprobantes |
| Nodemailer 6 | Envío del resumen diario por email |
| Axios 1 | Consumo de la API REST de UCRM |
| dotenv 16 | Carga de variables desde `.env` |
| qrcode-terminal | Mostrar el QR de vinculación en la terminal |

## Requisitos previos

- Node.js 18 o superior.
- npm.
- Una instancia de UCRM accesible y una API key válida.
- Un número de WhatsApp que pueda vincularse escaneando el QR.
- Google Chrome o Chromium disponible para WPPConnect. En Linux, Puppeteer/Chromium puede requerir librerías del sistema como `libnss3`, `libatk-bridge2.0-0`, `libgtk-3-0`, `libgbm1` y `libasound2`.
- Credenciales SMTP de Gmail si se quiere enviar el resumen diario por email. `emailService.js` configura el servicio `gmail`, por lo que normalmente se necesita una contraseña de aplicación.

## Instalación

1. Clona el repositorio y entra en su directorio:

   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd bot-cobros-whatsapp-wppconnect
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Crea el archivo local de configuración:

   ```bash
   cp .env.example .env
   ```

   En PowerShell puedes usar `Copy-Item .env.example .env`.

4. Edita `.env` con la URL y API key de UCRM, los teléfonos de notificación, las cuentas de pago y, si corresponde, las credenciales de email.

5. Revisa el punto de entrada antes de iniciar. El script `start` de `package.json` ejecuta `node index.js`, pero actualmente el archivo de arranque del código está en `src/index.js`. <!-- TODO: confirmar si debe existir un index.js en la raíz o si el script debe apuntar a src/index.js. -->

## Variables de entorno

Las variables siguientes son las definidas en `src/config/index.js` y `.env.example`. Cuando no se indica lo contrario, el código aplica un valor predeterminado.

| Variable | Descripción | Ejemplo | Obligatoria |
| --- | --- | --- | --- |
| `UCRM_URL` | URL base de la instancia UCRM. | `https://ucrm.example.com:8443` | No, tiene valor predeterminado |
| `UCRM_API_KEY` | API key enviada como `X-Auth-App-Key` a UCRM. La aplicación falla al iniciar si falta. | `api_key_de_ucrm` | Sí |
| `EMAIL_USER` | Cuenta Gmail usada como remitente del resumen diario. | `bot@example.com` | No, necesaria para email |
| `EMAIL_PASS` | Contraseña de aplicación o credencial de la cuenta Gmail. | `********` | No, necesaria para email |
| `ADMIN_EMAIL` | Destinatario del resumen diario por email. | `admin@example.com` | No, necesaria para email |
| `PHONE_RECORDATORIOS` | Teléfono configurado para recordatorios. | `51920779122` | No, tiene valor predeterminado |
| `PHONE_NOTIFICACIONES` | Teléfono que recibe alertas de vouchers, pagos y mensajes no registrados. | `51999001245` | No, tiene valor predeterminado |
| `SCOTIA_CUENTA` | Número de cuenta Scotiabank mostrado en recordatorios. | `770-8074385` | No, tiene valor predeterminado |
| `SCOTIA_CCI` | CCI de Scotiabank configurado por el sistema. | `00942320770807438555` | No, tiene valor predeterminado |
| `BCP_CUENTA` | Cuenta BCP mostrada en recordatorios. | `35591107096005` | No, tiene valor predeterminado |
| `YAPE_NUMERO` | Número de Yape mostrado en recordatorios. | `920779122` | No, tiene valor predeterminado |
| `NOMBRE_TITULAR_SCOTIA` | Nombre del titular mostrado en recordatorios. | `Nombre Apellido` | No, tiene valor predeterminado |

No guardes valores reales en el repositorio. Usa `.env.example` como plantilla.

## Uso

Los scripts previstos son:

```bash
npm start
npm run dev
```

Al iniciar correctamente, el proceso levanta Express en `http://localhost:3000`, inicializa WPPConnect y muestra un QR en la terminal. Escanea el QR desde WhatsApp para vincular la sesión. WPPConnect utiliza la sesión `ucrm-bot`; los tokens de sesión se excluyen del repositorio mediante `tokens/`. La configuración también define `.wwebjs_auth`, pero actualmente no la pasa explícitamente a WPPConnect.

Una vez conectado WhatsApp, se activan el monitor de pagos y los jobs de recordatorios y resumen diario. Los estados operativos se guardan en `mensajes_enviados.json`, `pagos_procesados.json`, `ciclo_actual.json` y `cola_recordatorios.json`.

> En el estado actual del repositorio, `npm start` y `npm run dev` apuntan a `index.js` en la raíz, archivo que no aparece junto a `package.json`. Hasta confirmar el punto de entrada correcto, se puede ejecutar directamente `node src/index.js` o ajustar el script de `package.json` a `node src/index.js`.

## Estructura del proyecto

```text
.
├── .env.example                 # Plantilla de variables de entorno
├── package.json                 # Dependencias, scripts y versión mínima de Node.js
├── REALME.md                    # Notas existentes del proyecto
├── src/
│   ├── index.js                 # Arranque del servidor, WhatsApp y jobs
│   ├── app.js                   # Creación de Express y rutas
│   ├── config/
│   │   ├── index.js             # Configuración y variables de entorno
│   │   └── blacklist.js         # Lista negra y validación de clientes
│   ├── jobs/
│   │   ├── monitorPagos.js      # Detección de pagos y envío de recibos
│   │   ├── recordatoriosDeuda.js  # Recordatorios de facturas vencidas
│   │   ├── recordatoriosPrevios.js # Avisos de vencimiento al día siguiente
│   │   └── resumenDiario.js     # Resumen diario por WhatsApp y email
│   ├── routes/
│   │   ├── health.js            # Salud del sistema y listado de vouchers
│   │   ├── cola.js              # Consulta y limpieza de la cola
│   │   └── ciclo.js             # Estado y reinicio del ciclo
│   ├── services/
│   │   ├── emailService.js      # Envío de email con Nodemailer
│   │   ├── ocrService.js        # OCR y extracción de datos del voucher
│   │   ├── ucrmClient.js        # Cliente de la API REST de UCRM
│   │   └── whatsappService.js   # Envío y estado de WhatsApp
│   ├── storage/
│   │   └── jsonStore.js         # Persistencia local en JSON
│   ├── utils/
│   │   ├── fechas.js             # Fechas, esperas y formato
│   │   └── telefono.js           # Normalización de teléfonos
│   └── wppconnect/
│       └── client.js             # Cliente WPPConnect y handler de mensajes
└── vouchers/                    # Se crea al iniciar; almacena comprobantes recibidos
```

## Scripts disponibles

| Script | Comando | Descripción |
| --- | --- | --- |
| `start` | `node index.js` | Inicia la aplicación usando el punto de entrada declarado actualmente. |
| `dev` | `nodemon index.js` | Inicia en modo desarrollo y reinicia al detectar cambios. |
| `stop` | `curl http://localhost:3000/shutdown` | Solicita un apagado ordenado por HTTP. |
| `reset-session` | `npm run clean-session && npm start` | Elimina `tokens/` y vuelve a iniciar. Usa sintaxis Unix. |
| `clean-session` | `rm -rf tokens` | Elimina la sesión persistida de WPPConnect. Usa sintaxis Unix. |
| `clean-vouchers` | `rm -rf vouchers/*.jpg` | Elimina vouchers JPG. Usa sintaxis Unix y no elimina otros formatos. |
| `test` | `node test.js` | Ejecuta `test.js`; actualmente ese archivo no aparece en la raíz del repositorio. |
| `health` | `curl http://localhost:3000/health` | Consulta el health check. |
| `vouchers` | `curl http://localhost:3000/vouchers` | Lista los vouchers JPG guardados. |

En Windows, `curl` puede sustituirse por `Invoke-RestMethod` y los comandos `rm -rf` por sus equivalentes de PowerShell.

## Endpoints de la API

La API escucha en el puerto `3000` por defecto.

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `GET` | `/health` | Devuelve el estado, disponibilidad de WhatsApp, cantidad de vouchers y timestamp. |
| `GET` | `/vouchers` | Lista los archivos `.jpg` de `vouchers/`, ordenados por fecha de modificación. |
| `GET` | `/verificar-cola?limit=10` | Muestra clientes y facturas de la cola y contrasta cada factura con UCRM. |
| `GET` | `/limpiar-cola` | Elimina de la cola facturas pagadas o no encontradas en UCRM. |
| `GET` | `/ciclo` | Devuelve inicio, progreso, clientes enviados y días restantes del ciclo actual. |
| `GET` | `/reiniciar-ciclo` | Reinicia manualmente el ciclo de recordatorios. |
| `GET` | `/shutdown` | Guarda el estado, cierra WhatsApp y termina el proceso después de dos segundos. |

## Flujo del bot

### Cliente conocido envía un voucher

1. WPPConnect recibe una imagen y el bot identifica el teléfono en UCRM.
2. Descarga la imagen y la guarda como `vouchers/voucher_<cliente>_<timestamp>.jpg`.
3. Tesseract.js intenta extraer monto, fecha, operación y banco.
4. El resultado se añade como nota en UCRM, marcado como pendiente de verificación.
5. El administrador recibe una notificación por `PHONE_NOTIFICACIONES` y el cliente recibe confirmación de recepción.

### Cliente escribe “ya pagué”

1. El bot busca al cliente por teléfono y consulta pagos de los últimos siete días.
2. Si encuentra un pago, confirma monto y fecha por WhatsApp y añade una nota en UCRM.
3. Si no lo encuentra, solicita una foto del comprobante y notifica al administrador que el pago aún no está registrado.

### Número no registrado envía un mensaje

1. Si envía una imagen, el bot la guarda como comprobante asociado al teléfono y avisa al administrador.
2. Si envía texto relacionado con pago, Yape, transferencia, depósito, factura o recibo, reenvía el contenido al administrador.
3. Para otros mensajes no se genera una respuesta automática.

## Datos sensibles y seguridad

- No subas `.env`, credenciales, API keys ni contraseñas al repositorio.
- No subas la sesión de WhatsApp (`tokens/`; `.wwebjs_auth/` también está contemplada en `.gitignore`).
- No subas los vouchers almacenados en `vouchers/`; contienen comprobantes y datos personales.
- Protege los archivos JSON de estado (`mensajes_enviados.json`, `pagos_procesados.json`, `ciclo_actual.json` y `cola_recordatorios.json`) si contienen información operativa o personal.
- Los endpoints de administración no incluyen autenticación en el código actual. Expón el puerto solo en una red confiable o protégelo mediante firewall, proxy y autenticación externa.

## Troubleshooting

### No aparece el QR

- Ejecuta el proceso desde una terminal interactiva y revisa los mensajes de WPPConnect.
- Comprueba que Chrome o Chromium esté instalado y disponible.
- Elimina la sesión existente con `npm run clean-session` y vuelve a iniciar. En Windows, elimina manualmente `tokens/`.
- Verifica que `UCRM_API_KEY` esté definida: la aplicación falla durante la carga de configuración si falta.

### La sesión se cae o WhatsApp no queda listo

- Revisa el estado impreso por WPPConnect y confirma que el teléfono siga vinculado.
- Evita ejecutar dos instancias con la misma sesión `ucrm-bot`.
- Comprueba memoria, conectividad y compatibilidad de Chrome/Chromium. Los timeouts críticos de WhatsApp fuerzan la salida del proceso para que un gestor externo pueda reiniciarlo.

### Puppeteer no encuentra Chromium

- Instala Chrome/Chromium en el servidor y las librerías requeridas por la distribución Linux, especialmente `libnss3`, `libatk-bridge2.0-0`, `libgtk-3-0`, `libgbm1` y `libasound2`.
- Revisa los logs de WPPConnect y valida que la ejecución headless pueda iniciarse con los argumentos configurados.

### El OCR no reconoce el voucher

- Usa una imagen nítida, completa y con buena iluminación.
- El extractor reconoce patrones de monto en soles, fechas numéricas o abreviadas, números de operación y bancos como BCP, Interbank, Scotiabank, BBVA, Yape y Plin.
- Revisa el JPG guardado en `vouchers/` y la nota creada en UCRM. El OCR no valida por sí mismo que el pago sea auténtico; el resultado queda pendiente de verificación.

## Licencia

Este proyecto se distribuye bajo la licencia [MIT](https://opensource.org/licenses/MIT), según `package.json`.
