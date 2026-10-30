import { construyeSolicitudPdf } from './pdf.js';

/**
 * Recibe las solicitudes de afiliación y las envía por correo al sindicato.
 *
 * Se ejecuta en Cloudflare Pages (Functions). No guarda nada: valida los
 * datos, compone dos correos —uno para el sindicato y otro de confirmación
 * para quien se afilia— y los manda con Brevo.
 *
 * Hace falta configurar en Cloudflare → Pages → Settings → Variables:
 *   BREVO_API_KEY   la clave de la API de Brevo (como "secreto", no texto)
 *   CORREO_DESTINO  cesmvalladolid@cesmcyl.es
 *   CORREO_REMITE   una dirección verificada en Brevo, p. ej. web@cesmcyl.es
 */

/** Devuelve la clave de Brevo venga como venga: texto plano o Secrets Store. */
async function leeClave(valor) {
  if (!valor) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor.get === 'function') {
    try { return String(await valor.get() || '').trim(); } catch (e) { return ''; }
  }
  return '';
}

const CAMPOS_OBLIGATORIOS = [
  'nombre', 'apellidos', 'dni', 'nacimiento', 'domicilio',
  'cp', 'localidad', 'provincia', 'movil', 'email', 'n_colegiado', 'situacion',
  'especialidad', 'centro', 'titular', 'domicilio_titular', 'banco', 'iban', 'firma_nombre'
];

const ETIQUETAS = {
  nombre: 'Nombre', apellidos: 'Apellidos', dni: 'DNI / NIE',
  nacimiento: 'Fecha de nacimiento', lugar_nacimiento: 'Lugar de nacimiento',
  domicilio: 'Domicilio', cp: 'Código postal', localidad: 'Localidad',
  provincia: 'Provincia', telefono: 'Teléfono', movil: 'Teléfono móvil',
  email: 'Correo electrónico', facultad: 'Facultad',
  fin_carrera: 'Año de fin de carrera', colegio: 'Colegio de Médicos',
  n_colegiado: 'Nº de colegiado', especialidad: 'Especialidad',
  situacion: 'Situación profesional', anio_mir: 'Año de residencia',
  final_mir: 'Año de fin de residencia', centro: 'Centro de trabajo',
  telefono_trabajo: 'Teléfono del trabajo',
  titular: 'Titular de la cuenta', domicilio_titular: 'Domicilio del titular',
  banco: 'Banco o caja', iban: 'Número de cuenta (IBAN)',
  momento_sepa: 'Domiciliación', firma_nombre: 'Firmado por'
};

const BLOQUES = [
  ['Datos personales', ['apellidos', 'nombre', 'dni', 'nacimiento', 'lugar_nacimiento',
    'domicilio', 'cp', 'localidad', 'provincia', 'telefono', 'movil', 'email']],
  ['Datos profesionales', ['facultad', 'fin_carrera', 'colegio', 'n_colegiado',
    'especialidad', 'situacion', 'anio_mir', 'final_mir', 'centro', 'telefono_trabajo']],
  ['Domiciliación de la cuota', ['titular', 'domicilio_titular', 'banco', 'iban']]
];

function fechaEs(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : iso;
}

function nombreArchivo(t) {
  return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'solicitud';
}

function limpia(v) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300);
}
function esc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function onRequestPost({ request, env }) {
  const responde = (estado, cuerpo) =>
    new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });

  let datos;
  try {
    datos = await request.json();
  } catch (e) {
    return responde(400, { ok: false, error: 'No hemos podido leer los datos del formulario.' });
  }

  // Trampa antispam: un campo oculto que una persona nunca rellena.
  if (limpia(datos.web)) return responde(200, { ok: true });

  const d = {};
  for (const k of Object.keys(ETIQUETAS)) d[k] = limpia(datos[k]);

  const faltan = CAMPOS_OBLIGATORIOS.filter((k) => !d[k]);
  if (faltan.length) {
    return responde(400, { ok: false, error: 'Faltan datos obligatorios: ' + faltan.join(', ') });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) {
    return responde(400, { ok: false, error: 'El correo electrónico no parece correcto.' });
  }
  if (datos.consiente !== true || datos.firma_solicitud !== true) {
    return responde(400, { ok: false, error: 'Hay que aceptar los términos y condiciones y firmar la solicitud.' });
  }
  const domiciliaAhora = (d.momento_sepa || '').indexOf('Domicilia') === 0;
  if (domiciliaAhora && (datos.firma_sepa !== true || !d.iban)) {
    return responde(400, { ok: false, error: 'Para domiciliar ahora hacen falta el número de cuenta y la firma de la orden.' });
  }
  // La firma es la rúbrica dibujada en el recuadro: llega como JPEG en base64.
  const firmaImagen = typeof datos.firma_imagen === 'string' ? datos.firma_imagen : '';
  const firmaBase64 = firmaImagen.startsWith('data:image/jpeg;base64,')
    ? firmaImagen.slice('data:image/jpeg;base64,'.length) : '';
  if (!firmaBase64 || firmaBase64.length < 400) {
    return responde(400, { ok: false, error: 'Falta tu firma: dibújala dentro del recuadro antes de enviar la solicitud.' });
  }
  if (firmaBase64.length > 900000) {
    return responde(400, { ok: false, error: 'La firma ha salido demasiado grande. Bórrala y vuelve a firmar.' });
  }

  const participa = Array.isArray(datos.participa)
    ? datos.participa.map(limpia).filter(Boolean).slice(0, 10) : [];
  const comunicaciones = datos.comunicaciones === true;

  // Prueba del consentimiento: cuándo y desde dónde se dio.
  const momento = new Date();
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const nombreCompleto = d.nombre + ' ' + d.apellidos;

  let html = '<h2 style="font-family:system-ui,sans-serif;color:#0c3316">Nueva solicitud de afiliación</h2>';
  html += '<p style="font-family:system-ui,sans-serif"><b>' + esc(nombreCompleto) + '</b> — ' + esc(d.email) + '</p>';
  for (const [titulo, campos] of BLOQUES) {
    const filas = campos
      .filter((k) => d[k])
      .map((k) => '<tr><td style="padding:4px 12px 4px 0;color:#555">' + esc(ETIQUETAS[k]) +
        '</td><td style="padding:4px 0"><b>' + esc(k === 'nacimiento' ? fechaEs(d[k]) : d[k]) + '</b></td></tr>')
      .join('');
    if (!filas) continue;
    html += '<h3 style="font-family:system-ui,sans-serif;color:#0c3316;margin:18px 0 6px">' + esc(titulo) + '</h3>';
    html += '<table style="font-family:system-ui,sans-serif;font-size:14px;border-collapse:collapse">' + filas + '</table>';
  }
  if (participa.length) {
    html += '<h3 style="font-family:system-ui,sans-serif;color:#0c3316;margin:18px 0 6px">Participación</h3><ul style="font-family:system-ui,sans-serif;font-size:14px">';
    for (const p of participa) html += '<li>' + esc(p) + '</li>';
    html += '</ul>';
  }
  html += '<h3 style="font-family:system-ui,sans-serif;color:#0c3316;margin:18px 0 6px">Consentimientos</h3>';
  html += '<ul style="font-family:system-ui,sans-serif;font-size:14px">';
  html += '<li>Ha leído y acepta los términos y condiciones (incluido el tratamiento de sus datos): <b>sí</b></li>';
  html += '<li>Quiere recibir comunicaciones por los medios internos del sindicato: <b>' + (comunicaciones ? 'sí' : 'no') + '</b></li>';
  html += '</ul>';
  html += '<h3 style="font-family:system-ui,sans-serif;color:#0c3316;margin:18px 0 6px">Firma electrónica</h3>';
  html += '<ul style="font-family:system-ui,sans-serif;font-size:14px">';
  html += '<li>Firma la solicitud de afiliación: <b>sí</b></li>';
  html += '<li>Firma la orden de domiciliación: <b>' + (datos.firma_sepa === true ? 'sí' : 'no') + '</b></li>';
  html += '<li>Firmado por: <b>' + esc(d.firma_nombre || (d.nombre + ' ' + d.apellidos)) + '</b></li>';
  html += '<li>Rúbrica manuscrita: <b>adjunta en este correo</b></li>';
  html += '<li>Solicitud completa: <b>adjunta en PDF, lista para archivar</b></li>';
  html += '<li>Fecha y hora (servidor): ' + esc(momento.toISOString()) + '</li>';
  if (ip) html += '<li>Dirección IP desde la que se firmó: ' + esc(ip) + '</li>';
  html += '</ul>';
  html += '<p style="font-family:system-ui,sans-serif;font-size:13px;color:#666">Firma electrónica simple conforme al Reglamento (UE) 910/2014 (eIDAS). Guarda este correo como prueba del consentimiento y del mandato.</p>';

  const destino = env.CORREO_DESTINO || 'cesmvalladolid@cesmcyl.es';
  const remite = env.CORREO_REMITE || destino;

  // La clave puede llegar como texto (variable o secreto normal) o como
  // binding del Secrets Store de Cloudflare, que se lee con .get().
  const clave = await leeClave(env.BREVO_API_KEY);
  if (!clave) {
    return responde(500, { ok: false, error: 'El envío no está configurado todavía. Escríbenos a ' + destino + '.' });
  }

  const enviar = (payload) => fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': clave,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  // La solicitud completa en PDF, para que el sindicato la archive.
  let pdfBase64 = '';
  try {
    pdfBase64 = construyeSolicitudPdf({
      nombreCompleto,
      fecha: momento.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }),
      bloques: BLOQUES.map(([titulo, campos]) => ({
        titulo,
        filas: campos.map((k) => [ETIQUETAS[k] || k, k === 'nacimiento' ? fechaEs(d[k]) : (d[k] || '')])
      })),
      participa,
      consentimientos: [
        'Ha leído y acepta los términos y condiciones, incluida la información sobre el tratamiento de sus datos.',
        'Quiere recibir comunicaciones del sindicato: ' + (comunicaciones ? 'sí' : 'no') + '.',
        'Firma la solicitud de afiliación y la orden de domiciliación de la cuota.'
      ],
      firmaJpeg: firmaBase64,
      sello: [
        'Firma electrónica simple conforme al Reglamento (UE) 910/2014 (eIDAS).',
        'Fecha y hora del servidor: ' + momento.toISOString() + (ip ? '  ·  Dirección IP: ' + ip : ''),
        'Documento generado automáticamente por la web de CESM Sindicato Médico Valladolid.'
      ]
    });
  } catch (e) {
    console.log('No se pudo generar el PDF: ' + e);
  }

  const adjuntos = [];
  if (pdfBase64) {
    adjuntos.push({ name: 'solicitud-afiliacion-' + nombreArchivo(nombreCompleto) + '.pdf', content: pdfBase64 });
  }
  adjuntos.push({ name: 'firma.jpg', content: firmaBase64 });

  try {
    const r = await enviar({
      sender: { name: 'Web CESM Valladolid', email: remite },
      to: [{ email: destino, name: 'CESM Valladolid' }],
      replyTo: { email: d.email, name: nombreCompleto },
      subject: 'Solicitud de afiliación — ' + nombreCompleto,
      htmlContent: html,
      attachment: adjuntos
    });
    if (!r.ok) {
      const t = await r.text();
      console.log('Brevo respondió ' + r.status + ': ' + t);
      return responde(502, { ok: false, error: 'No hemos podido enviar la solicitud. Inténtalo de nuevo o escríbenos a ' + destino + '.' });
    }
  } catch (e) {
    console.log('Error al enviar: ' + e);
    return responde(502, { ok: false, error: 'No hemos podido enviar la solicitud. Inténtalo de nuevo o escríbenos a ' + destino + '.' });
  }

  // Confirmación para quien se afilia (sin datos bancarios).
  try {
    await enviar({
      sender: { name: 'CESM Valladolid', email: remite },
      to: [{ email: d.email, name: nombreCompleto }],
      replyTo: { email: destino, name: 'CESM Valladolid' },
      subject: 'Hemos recibido tu solicitud de afiliación',
      htmlContent:
        '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#16241a">' +
        '<p>Hola ' + esc(d.nombre) + ',</p>' +
        '<p>Hemos recibido tu solicitud de afiliación a CESM Sindicato Médico Valladolid. ' +
        'La revisaremos y nos pondremos en contacto contigo.</p>' +
        '<p>Si no recibes email de confirmación de la afiliación, contesta a este mensaje ' +
        'o llámanos al 983 218 524 o al 653 883 739.</p>' +
        '<p>Un saludo,<br>CESM Sindicato Médico Valladolid</p>' +
        '<p style="font-size:12px;color:#777">Puedes ejercer tus derechos de acceso, rectificación, supresión, ' +
        'portabilidad, limitación y oposición escribiendo a ' + esc(destino) + '.</p></div>'
    });
  } catch (e) {
    console.log('No se pudo enviar la confirmación: ' + e);
  }

  return responde(200, { ok: true });
}
