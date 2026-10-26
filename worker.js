/**
 * Punto de entrada del Worker de la web de CESM Valladolid.
 *
 * La web es estática (la genera Eleventy en la carpeta _site), así que
 * casi todas las peticiones las atienden directamente los archivos.
 * Este archivo solo existe para las rutas que necesitan ejecutarse en el
 * servidor, hoy únicamente el formulario de afiliación.
 *
 *   POST /api/afiliacion  →  recibe la solicitud y manda los correos
 *
 * Cualquier otra dirección se la pasamos a los archivos estáticos.
 */

import { onRequestPost } from './functions/api/afiliacion.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/afiliacion') {
      if (request.method === 'POST') {
        return onRequestPost({ request, env, ctx });
      }
      return new Response(
        JSON.stringify({ ok: false, error: 'Método no permitido.' }),
        { status: 405, headers: { 'content-type': 'application/json; charset=utf-8', allow: 'POST' } }
      );
    }

    return env.ASSETS.fetch(request);
  }
};
