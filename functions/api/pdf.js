/**
 * Generador de PDF para las solicitudes de afiliación.
 *
 * No usa ninguna librería: escribe el PDF a mano. Es suficiente porque el
 * documento solo necesita texto (con las fuentes estándar Helvetica, que
 * todos los lectores traen) y una imagen JPEG, que el formato PDF admite
 * tal cual sin tener que recodificarla.
 */

const ANCHO = 595.28;   // A4 en puntos
const ALTO = 841.89;
const MARGEN = 56;
const ANCHO_UTIL = ANCHO - MARGEN * 2;

const VERDE = '0.047 0.2 0.086';
const GRIS = '0.42 0.46 0.43';
const NEGRO = '0.11 0.14 0.12';

/* --- Texto --- */

// Equivalencias de los caracteres que en WinAnsi no coinciden con Unicode.
const WINANSI = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f
};

function aWinAnsi(texto) {
  let salida = '';
  for (const ch of String(texto == null ? '' : texto)) {
    const c = ch.codePointAt(0);
    let b;
    if (WINANSI[c] !== undefined) b = WINANSI[c];
    else if (c < 256) b = c;
    else b = 0x3f; // ?
    salida += String.fromCharCode(b);
  }
  return salida;
}

function escapa(texto) {
  return aWinAnsi(texto).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// Anchura aproximada de Helvetica: suficiente para decidir dónde cortar.
function ancho(texto, tam, negrita) {
  const factor = negrita ? 0.56 : 0.52;
  return String(texto).length * tam * factor;
}

function parte(texto, tam, negrita, limite) {
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  const lineas = [];
  let linea = '';
  for (const p of palabras) {
    const prueba = linea ? linea + ' ' + p : p;
    if (ancho(prueba, tam, negrita) > limite && linea) {
      lineas.push(linea);
      linea = p;
    } else {
      linea = prueba;
    }
  }
  if (linea) lineas.push(linea);
  return lineas.length ? lineas : [''];
}

/* --- JPEG --- */

// Saca el ancho y el alto de un JPEG leyendo su cabecera.
function medidasJpeg(bytes) {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marca = bytes[i + 1];
    if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {
      return { alto: (bytes[i + 5] << 8) | bytes[i + 6], ancho: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  return null;
}

function deBase64(b64) {
  const bruto = atob(b64);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

function aBase64(bytes) {
  let s = '';
  const trozo = 0x8000;
  for (let i = 0; i < bytes.length; i += trozo) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + trozo));
  }
  return btoa(s);
}

/* --- Construcción del documento --- */

class Hoja {
  constructor() {
    this.ops = [];
    this.y = ALTO - MARGEN;
  }
  color(c) { this.ops.push(c + ' rg'); }
  texto(t, x, y, tam, negrita) {
    this.ops.push('BT /' + (negrita ? 'FB' : 'FN') + ' ' + tam + ' Tf ' + x + ' ' + y + ' Td (' + escapa(t) + ') Tj ET');
  }
  linea(x1, y1, x2, y2, gris) {
    this.ops.push((gris || '0.8 0.84 0.81') + ' RG 0.7 w ' + x1 + ' ' + y1 + ' m ' + x2 + ' ' + y2 + ' l S');
  }
  contenido() { return this.ops.join('\n'); }
}

export function construyeSolicitudPdf(datos) {
  const hojas = [];
  let h = new Hoja();
  hojas.push(h);

  const nuevaHoja = () => { h = new Hoja(); hojas.push(h); return h; };
  const sitio = (alto) => { if (h.y - alto < MARGEN + 40) { nuevaHoja(); cabecera(false); } };

  function cabecera(primera) {
    h.color(VERDE);
    h.texto('SINDICATO MÉDICO CESM VALLADOLID', MARGEN, h.y - 14, 12, true);
    h.color(GRIS);
    h.texto('Solicitud de afiliación', MARGEN, h.y - 28, 9.5, false);
    h.linea(MARGEN, h.y - 36, ANCHO - MARGEN, h.y - 36, '0.047 0.2 0.086');
    h.y -= 54;
    if (primera) {
      h.color(NEGRO);
      h.texto(datos.nombreCompleto, MARGEN, h.y, 15, true);
      h.color(GRIS);
      h.texto(datos.fecha, ANCHO - MARGEN - ancho(datos.fecha, 9.5, false), h.y, 9.5, false);
      h.y -= 26;
    }
  }

  function titulo(t) {
    sitio(40);
    h.y -= 8;
    h.color(VERDE);
    h.texto(t, MARGEN, h.y, 11, true);
    h.linea(MARGEN, h.y - 6, ANCHO - MARGEN, h.y - 6);
    h.y -= 22;
  }

  function fila(etiqueta, valor) {
    if (!valor) return;
    const anchoValor = ANCHO_UTIL - 150;
    const lineas = parte(valor, 10, true, anchoValor);
    sitio(lineas.length * 14 + 6);
    h.color(GRIS);
    h.texto(etiqueta, MARGEN, h.y, 9.5, false);
    h.color(NEGRO);
    lineas.forEach((l, i) => h.texto(l, MARGEN + 150, h.y - i * 13, 10, true));
    h.y -= lineas.length * 13 + 7;
  }

  function parrafo(texto, tam) {
    const lineas = parte(texto, tam || 9.5, false, ANCHO_UTIL);
    sitio(lineas.length * 13 + 6);
    h.color(NEGRO);
    lineas.forEach((l, i) => h.texto(l, MARGEN, h.y - i * 13, tam || 9.5, false));
    h.y -= lineas.length * 13 + 8;
  }

  function punto(texto) {
    const lineas = parte(texto, 9.5, false, ANCHO_UTIL - 14);
    sitio(lineas.length * 13 + 4);
    h.color(NEGRO);
    h.texto('•', MARGEN, h.y, 9.5, false);
    lineas.forEach((l, i) => h.texto(l, MARGEN + 14, h.y - i * 13, 9.5, false));
    h.y -= lineas.length * 13 + 4;
  }

  cabecera(true);

  for (const bloque of datos.bloques) {
    const filas = bloque.filas.filter((f) => f[1]);
    if (!filas.length) continue;
    titulo(bloque.titulo);
    filas.forEach((f) => fila(f[0], f[1]));
  }

  if (datos.participa && datos.participa.length) {
    titulo('Participación');
    datos.participa.forEach(punto);
  }

  titulo('Consentimientos');
  datos.consentimientos.forEach(punto);

  titulo('Firma');
  parrafo('Firmado electrónicamente por ' + datos.nombreCompleto + '.', 10);

  // La rúbrica, si viene
  let imagen = null;
  if (datos.firmaJpeg) {
    const bytes = deBase64(datos.firmaJpeg);
    const m = medidasJpeg(bytes);
    if (m) {
      const anchoCaja = 190;
      const altoCaja = Math.round(anchoCaja * (m.alto / m.ancho));
      sitio(altoCaja + 20);
      imagen = { bytes, ancho: m.ancho, alto: m.alto, hoja: hojas.length - 1, x: MARGEN, y: h.y - altoCaja, w: anchoCaja, hh: altoCaja };
      h.ops.push('q ' + anchoCaja + ' 0 0 ' + altoCaja + ' ' + MARGEN + ' ' + (h.y - altoCaja) + ' cm /Im0 Do Q');
      h.y -= altoCaja + 10;
    }
  }

  h.color(GRIS);
  datos.sello.forEach((l) => { sitio(14); h.texto(l, MARGEN, h.y, 8.5, false); h.y -= 12; });

  /* --- Ensamblado --- */
  const objetos = [];
  const anota = (cuerpo) => { objetos.push(cuerpo); return objetos.length; };

  const idsHojas = [];
  const idsContenido = [];
  hojas.forEach(() => { idsHojas.push(0); idsContenido.push(0); });

  const idCatalogo = anota(null);
  const idPaginas = anota(null);
  const idFuenteN = anota('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const idFuenteB = anota('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  let idImagen = 0;
  if (imagen) {
    idImagen = anota({
      diccionario: '<< /Type /XObject /Subtype /Image /Width ' + imagen.ancho + ' /Height ' + imagen.alto +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + imagen.bytes.length + ' >>',
      binario: imagen.bytes
    });
  }

  hojas.forEach((hoja, i) => {
    const flujo = hoja.contenido();
    idsContenido[i] = anota({ diccionario: '<< /Length ' + aWinAnsi(flujo).length + ' >>', texto: flujo });
  });

  hojas.forEach((hoja, i) => {
    const recursos = '<< /Font << /FN ' + idFuenteN + ' 0 R /FB ' + idFuenteB + ' 0 R >>' +
      (idImagen && imagen.hoja === i ? ' /XObject << /Im0 ' + idImagen + ' 0 R >>' : '') + ' >>';
    idsHojas[i] = anota('<< /Type /Page /Parent ' + idPaginas + ' 0 R /MediaBox [0 0 ' + ANCHO + ' ' + ALTO +
      '] /Resources ' + recursos + ' /Contents ' + idsContenido[i] + ' 0 R >>');
  });

  objetos[idCatalogo - 1] = '<< /Type /Catalog /Pages ' + idPaginas + ' 0 R >>';
  objetos[idPaginas - 1] = '<< /Type /Pages /Count ' + hojas.length + ' /Kids [' +
    idsHojas.map((n) => n + ' 0 R').join(' ') + '] >>';

  const trozos = [];
  const mete = (t) => { trozos.push(typeof t === 'string' ? aBytes(t) : t); };
  let largo = 0;
  const posiciones = [0];

  mete('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  largo = tamano(trozos);

  objetos.forEach((obj, i) => {
    posiciones[i + 1] = largo;
    let cabeza = (i + 1) + ' 0 obj\n';
    if (typeof obj === 'string') {
      cabeza += obj + '\nendobj\n';
      mete(cabeza);
    } else {
      mete(cabeza + obj.diccionario + '\nstream\n');
      mete(obj.binario ? obj.binario : aBytes(aWinAnsi(obj.texto)));
      mete('\nendstream\nendobj\n');
    }
    largo = tamano(trozos);
  });

  const inicioTabla = largo;
  let tabla = 'xref\n0 ' + (objetos.length + 1) + '\n0000000000 65535 f \n';
  for (let i = 1; i <= objetos.length; i++) {
    tabla += String(posiciones[i]).padStart(10, '0') + ' 00000 n \n';
  }
  tabla += 'trailer\n<< /Size ' + (objetos.length + 1) + ' /Root ' + idCatalogo + ' 0 R >>\nstartxref\n' + inicioTabla + '\n%%EOF\n';
  mete(tabla);

  return aBase64(une(trozos));
}

function aBytes(texto) {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i) & 0xff;
  return bytes;
}

function tamano(trozos) {
  let n = 0;
  for (const t of trozos) n += t.length;
  return n;
}

function une(trozos) {
  const total = tamano(trozos);
  const salida = new Uint8Array(total);
  let i = 0;
  for (const t of trozos) { salida.set(t, i); i += t.length; }
  return salida;
}
