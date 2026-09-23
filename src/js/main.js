/* =========================================================================
   CESM Valladolid · JavaScript de la web
   Todo lo interactivo está aquí. Cada bloque comprueba primero si su parte
   existe en la página, así que el mismo archivo sirve para todas.
   ========================================================================= */
(function () {
  var body = document.body;
  var cabecera = document.getElementById('cabecera');
  var ticker = document.getElementById('ticker');

  /* ---------- Utilidad: markdown sencillo -> HTML ----------
     El panel guarda algunos textos en markdown (**negrita**, [enlace](url)…).
     Si el texto ya es HTML, se deja tal cual. */
  function enLinea(t) {
    return t
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  }
  function markdownAHtml(texto) {
    if (!texto) return '';
    if (/<[a-z][\s\S]*>/i.test(texto)) return texto;
    return texto.trim().split(/\n{2,}/).map(function (bloque) {
      var lineas = bloque.split('\n');
      if (lineas.every(function (l) { return /^\s*[-*]\s+/.test(l); })) {
        return '<ul>' + lineas.map(function (l) { return '<li>' + enLinea(l.replace(/^\s*[-*]\s+/, '')) + '</li>'; }).join('') + '</ul>';
      }
      var h = bloque.match(/^(#{1,4})\s+(.*)$/);
      if (h) { var n = Math.min(h[1].length + 1, 4); return '<h' + n + '>' + enLinea(h[2]) + '</h' + n + '>'; }
      return '<p>' + enLinea(lineas.join('<br>')) + '</p>';
    }).join('');
  }

  /* ---------- Cabecera fija: espacio para el contenido ----------
     La cabecera flota sobre la página, así que el contenido necesita un
     hueco arriba igual a su altura NORMAL (sin encoger). Se mide quitando un
     instante el encogido y las animaciones, para leer siempre la altura real. */
  function medirCabecera() {
    if (!cabecera) return;
    var estabaCompacta = body.classList.contains('compacta');
    body.classList.add('midiendo');
    body.classList.remove('compacta');
    var altura = cabecera.offsetHeight;
    body.classList.add('compacta');
    var alturaCompacta = cabecera.offsetHeight;
    if (!estabaCompacta) body.classList.remove('compacta');
    void cabecera.offsetHeight;
    body.classList.remove('midiendo');
    document.documentElement.style.setProperty('--cab-normal', altura + 'px');
    // Al saltar a una sección desde el menú, que no quede tapada por la cabecera
    document.documentElement.style.scrollPaddingTop = (alturaCompacta + 16) + 'px';
  }
  medirCabecera();
  window.addEventListener('load', medirCabecera);
  window.addEventListener('resize', medirCabecera);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(medirCabecera);

  /* ---------- Cabecera: se encoge al bajar ----------
     Dos umbrales distintos (encoger a 60px, volver a agrandar por debajo de
     10px) para que no parpadee. */
  function actualizarCompacta() {
    var y = window.scrollY;
    if (y > 60 && !body.classList.contains('compacta')) body.classList.add('compacta');
    else if (y < 10 && body.classList.contains('compacta')) body.classList.remove('compacta');
  }
  window.addEventListener('scroll', actualizarCompacta, { passive: true });
  actualizarCompacta();

  /* ---------- Menú en móvil ---------- */
  var hamburguesa = document.getElementById('hamburger');
  var menu = document.getElementById('navLinks');
  function cerrarMenu() {
    if (!menu) return;
    menu.classList.remove('open');
    hamburguesa.classList.remove('active');
    hamburguesa.setAttribute('aria-expanded', 'false');
    body.classList.remove('menu-abierto');
  }
  if (hamburguesa && menu) {
    hamburguesa.addEventListener('click', function () {
      var abierto = menu.classList.toggle('open');
      hamburguesa.classList.toggle('active', abierto);
      hamburguesa.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      body.classList.toggle('menu-abierto', abierto);
    });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', cerrarMenu); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarMenu(); });
  }

  /* ---------- Menú: resalta la sección visible (solo en la portada) ---------- */
  var secciones = document.querySelectorAll('#inicio, #noticias, #quienes, #servicios, #contacto');
  if (secciones.length && location.pathname === '/') {
    var enlacesMenu = document.querySelectorAll('.menu a[data-seccion]');
    var marcarSeccion = function () {
      var y = window.scrollY + (cabecera ? cabecera.offsetHeight : 0) + 40;
      var actual = 'inicio';
      secciones.forEach(function (s) { if (s.offsetTop <= y) actual = s.id; });
      enlacesMenu.forEach(function (a) { a.classList.toggle('activo', a.dataset.seccion === actual); });
    };
    window.addEventListener('scroll', marcarSeccion, { passive: true });
    marcarSeccion();
  }

  /* ---------- Aviso urgente (franja dorada) ----------
     Lee /aviso-urgente.json. Si está activo, muestra el mensaje; si no, la
     franja queda como una línea fina de color. */
  if (ticker) {
    fetch('/aviso-urgente.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (datos) {
        var activo = datos && datos.activo && datos.texto;
        document.getElementById('ticker-text').innerHTML = activo ? markdownAHtml(datos.texto).replace(/^<p>|<\/p>$/g, '') : '';
        document.getElementById('ticker-label').style.display = activo ? '' : 'none';
        document.getElementById('ticker-flecha').style.display = activo ? '' : 'none';
        ticker.classList.toggle('vacio', !activo);
        medirCabecera();
      })
      .catch(function () { medirCabecera(); });
  }

  /* ---------- Entrada de la portada ---------- */
  requestAnimationFrame(function () { body.classList.add('listo'); });

  /* ---------- Tablón: carrusel de últimas noticias ----------
     Pasa una noticia cada 30 segundos; las flechas la pasan a mano y
     reinician la cuenta. */
  var carrusel = document.getElementById('carrusel');
  if (carrusel) {
    var tns = carrusel.querySelectorAll('.tn');
    var barra = document.getElementById('carrusel-progreso');
    var contador = document.getElementById('carrusel-contador');
    var actual = 0, temporizador = null;
    var reiniciar = function () {
      clearTimeout(temporizador);
      if (tns.length < 2) return;
      barra.classList.remove('corriendo'); void barra.offsetWidth; barra.classList.add('corriendo');
      temporizador = setTimeout(function () { mostrar(actual + 1); }, 30000);
    };
    var mostrar = function (n) {
      if (!tns.length) return;
      var anterior = tns[actual];
      anterior.classList.remove('visible'); anterior.classList.add('saliendo');
      setTimeout(function () { anterior.classList.remove('saliendo'); }, 600);
      actual = (n + tns.length) % tns.length;
      tns[actual].classList.add('visible');
      contador.textContent = (actual + 1) + ' / ' + tns.length;
      reiniciar();
    };
    document.getElementById('carrusel-siguiente').addEventListener('click', function () { mostrar(actual + 1); });
    document.getElementById('carrusel-anterior').addEventListener('click', function () { mostrar(actual - 1); });
    reiniciar();
  }

  /* ---------- Tablón: pestañas por tema ---------- */
  var pestanas = document.querySelectorAll('.pestana');
  if (pestanas.length) {
    pestanas.forEach(function (p) {
      p.addEventListener('click', function () {
        pestanas.forEach(function (x) { x.classList.remove('activa'); x.setAttribute('aria-selected', 'false'); });
        p.classList.add('activa'); p.setAttribute('aria-selected', 'true');
        document.querySelectorAll('.grupo-fijos').forEach(function (g) {
          g.classList.toggle('visible', g.dataset.grupo === p.dataset.grupo);
        });
      });
    });
  }

  /* ---------- Tablón: desplegar el montón de documentos ---------- */
  document.querySelectorAll('.abrir-pila').forEach(function (boton) {
    boton.addEventListener('click', function () {
      var pila = boton.closest('.grupo-fijos');
      var abierto = pila.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      var total = pila.querySelectorAll('.fijo').length;
      boton.querySelector('.abrir-texto').textContent = abierto ? 'Ver menos' : 'Ver los ' + total + ' documentos';
    });
  });

  /* ---------- Sección de noticias: filtros, buscador y "ver más" ---------- */
  var notasCont = document.getElementById('notas');
  if (notasCont) {
    var POR_PAGINA = 6;
    var notas = Array.prototype.slice.call(notasCont.querySelectorAll('.nota'));
    var btnMas = document.getElementById('btn-mas');
    var buscador = document.getElementById('buscador-noticias');
    var vacio = document.getElementById('notas-vacio');
    var chips = document.querySelectorAll('.chip');
    var mostradas = POR_PAGINA, categoria = 'todas', termino = '';
    var normalizar = function (t) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
    var textos = notas.map(function (n) { return normalizar(n.textContent); });
    var pintar = function (desde) {
      var visibles = notas.filter(function (n, i) {
        return (categoria === 'todas' || n.dataset.cat === categoria || n.dataset.grupo === categoria) && (!termino || textos[i].indexOf(termino) !== -1);
      });
      notas.forEach(function (n) { n.classList.add('oculta'); n.classList.remove('aparece'); });
      visibles.slice(0, mostradas).forEach(function (n, i) {
        n.classList.remove('oculta');
        if (desde !== undefined && i >= desde) n.classList.add('aparece');
      });
      var quedan = visibles.length - mostradas;
      btnMas.hidden = quedan <= 0;
      btnMas.textContent = 'Ver más noticias (' + quedan + ')';
      vacio.hidden = visibles.length > 0;
    };
    btnMas.addEventListener('click', function () { var antes = mostradas; mostradas += POR_PAGINA; pintar(antes); });
    var todosLosBotones = document.querySelectorAll('.chip, .chip-sub');
    var cerrarMenus = function (menos) {
      document.querySelectorAll('.chip-grupo.abierto').forEach(function (g) {
        if (g !== menos) { g.classList.remove('abierto'); g.querySelector('.chip-con-menu').setAttribute('aria-expanded', 'false'); }
      });
    };
    todosLosBotones.forEach(function (c) {
      c.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var grupo = c.closest('.chip-grupo');
        if (c.classList.contains('chip-con-menu')) {
          var abierto = grupo.classList.toggle('abierto');
          c.setAttribute('aria-expanded', abierto ? 'true' : 'false');
          cerrarMenus(abierto ? grupo : null);
        } else {
          cerrarMenus(null);
        }
        todosLosBotones.forEach(function (x) { x.classList.remove('activo'); });
        c.classList.add('activo');
        if (grupo && c.classList.contains('chip-sub')) grupo.querySelector('.chip-con-menu').classList.add('activo');
        categoria = c.dataset.cat; mostradas = POR_PAGINA; pintar();
      });
    });
    document.addEventListener('click', function () { cerrarMenus(null); });
    buscador.addEventListener('input', function () { termino = normalizar(buscador.value.trim()); mostradas = POR_PAGINA; pintar(); });
    pintar();
  }

  /* ---------- Tarifas: resaltar la columna según la antigüedad ---------- */
  var segmentos = document.querySelectorAll('.segmentos button');
  if (segmentos.length) {
    var marcarColumna = function (col) {
      segmentos.forEach(function (b) { b.classList.toggle('activo', b.dataset.col === col); });
      document.querySelectorAll('#tabla-tarifas [data-col]').forEach(function (c) { c.classList.toggle('marcada', c.dataset.col === col); });
    };
    segmentos.forEach(function (b) { b.addEventListener('click', function () { marcarColumna(b.dataset.col); }); });
    marcarColumna('0');
  }

  /* ---------- Tarifas: copiar el IBAN ---------- */
  var btnIban = document.getElementById('copiar-iban');
  if (btnIban) {
    btnIban.addEventListener('click', function () {
      var texto = document.getElementById('iban').textContent.replace(/\s/g, '');
      var etiqueta = btnIban.querySelector('span');
      var ok = function () { etiqueta.textContent = 'Copiado'; setTimeout(function () { etiqueta.textContent = 'Copiar'; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(texto).then(ok, function () { etiqueta.textContent = 'Selecciona y copia'; });
      else etiqueta.textContent = 'Selecciona y copia';
    });
  }

  /* ---------- Formulario de contacto ----------
     Comprueba los campos y abre el programa de correo del visitante con el
     mensaje ya preparado para cesmvalladolid@cesmcyl.es. */
  var form = document.getElementById('formulario');
  if (form) {
    var err = document.getElementById('form-error');
    var okMsg = document.getElementById('form-ok');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fallo = null;
      form.querySelectorAll('[required]').forEach(function (c) {
        var mal = c.type === 'checkbox' ? !c.checked : !c.value.trim() || (c.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.value.trim()));
        if (c.type !== 'checkbox') c.classList.toggle('invalido', mal);
        if (mal && !fallo) fallo = c;
      });
      okMsg.textContent = '';
      if (fallo) {
        err.textContent = fallo.type === 'checkbox' ? 'Marca la casilla de aceptación para poder enviar el mensaje.'
          : (fallo.type === 'email' && fallo.value.trim()) ? 'Revisa el correo electrónico: no parece válido.'
          : 'Rellena los campos obligatorios.';
        fallo.focus();
        return;
      }
      err.textContent = '';
      var d = function (n) { return (form.elements[n].value || '').trim(); };
      var cuerpo = d('mensaje') + '\n\n——\nNombre: ' + d('nombre') + ' ' + d('apellidos') + '\nCorreo: ' + d('email') +
        (d('telefono') ? '\nTeléfono: ' + d('telefono') : '') + '\nProvincia: ' + d('provincia');
      window.location.href = 'mailto:cesmvalladolid@cesmcyl.es?subject=' + encodeURIComponent('Consulta web — ' + d('nombre') + ' ' + d('apellidos')) +
        '&body=' + encodeURIComponent(cuerpo);
      okMsg.textContent = 'Se ha abierto tu programa de correo con el mensaje preparado. Si no se ha abierto, escríbenos directamente a cesmvalladolid@cesmcyl.es.';
    });
    form.querySelectorAll('[required]').forEach(function (c) {
      c.addEventListener('input', function () { c.classList.remove('invalido'); err.textContent = ''; });
    });
  }

  /* ---------- Página de huelga: texto editable desde el panel ---------- */
  var huelgaTexto = document.getElementById('huelga-texto');
  if (huelgaTexto) {
    fetch('/huelga-info.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (datos) {
        huelgaTexto.innerHTML = (datos && datos.texto) ? markdownAHtml(datos.texto)
          : '<p>Por el momento no hay información adicional publicada. Consulta las últimas noticias sobre la huelga.</p>';
      })
      .catch(function () { huelgaTexto.innerHTML = '<p>No se ha podido cargar la información. Inténtalo de nuevo más tarde.</p>'; });
  }
})();
