// Menú móvil
var hamburger = document.getElementById('hamburger');
var navLinks = document.getElementById('navLinks');
if (hamburger) {
  hamburger.addEventListener('click', function () {
    navLinks.classList.toggle('open');
    hamburger.classList.toggle('active');
    document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
  });
  document.querySelectorAll('#navLinks a').forEach(function (a) {
    a.addEventListener('click', function () {
      navLinks.classList.remove('open');
      hamburger.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

// Animaciones al hacer scroll
var obs = new IntersectionObserver(function (entries) {
  entries.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.08 });
document.querySelectorAll('.reveal').forEach(function (el) { obs.observe(el); });

// Resalta en el menú la sección visible
var navSections = document.querySelectorAll('section[id], div.hero[id]');
var navItems = document.querySelectorAll('.nav-links > li > a[href^="/#"]');
window.addEventListener('scroll', function () {
  var scrollY = window.scrollY + 100;
  navSections.forEach(function (section) {
    var top = section.offsetTop;
    var height = section.offsetHeight;
    var id = section.getAttribute('id');
    if (scrollY >= top && scrollY < top + height) {
      navItems.forEach(function (a) { a.classList.remove('active'); });
      var active = document.querySelector('.nav-links > li > a[href="/#' + id + '"]');
      if (active) active.classList.add('active');
    }
  });
});

// Aviso urgente (franja dorada). Si está activo, muestra el mensaje; si no,
// la franja se queda visible pero vacía, solo como línea de color.
async function cargarAvisoUrgente() {
  var ticker = document.getElementById('ticker');
  var label = document.getElementById('ticker-label');
  var flecha = document.getElementById('ticker-flecha');
  if (!ticker) return;
  try {
    var res = await fetch('/aviso-urgente.json');
    if (res.ok) {
      var datos = await res.json();
      if (datos.activo && datos.texto) {
        document.getElementById('ticker-text').innerHTML = datos.texto;
        label.style.display = '';
        flecha.style.display = 'flex';
        ticker.classList.remove('vacio');
        ticker.style.transition = 'none';
        ticker.classList.remove('desplegado');
        void ticker.offsetHeight;
        setTimeout(function () {
          ticker.style.transition = '';
          ticker.classList.add('desplegado');
        }, 100);
      } else {
        document.getElementById('ticker-text').textContent = '';
        label.style.display = 'none';
        flecha.style.display = 'none';
        ticker.classList.add('vacio');
        ticker.classList.add('desplegado');
      }
    }
  } catch (e) {
    console.log('No se pudo cargar el aviso urgente', e);
  }
}
cargarAvisoUrgente();

// Buscador de noticias: filtra las burbujas ya generadas en el HTML por
// Eleventy (no hace falta volver a pedir datos a ningún sitio).
var inputBuscador = document.getElementById('buscador-noticias-input');
if (inputBuscador) {
  var todasLasBurbujas = Array.from(document.querySelectorAll('#todas-noticias-grid .noticia-burbuja'));
  var resultadoTexto = document.getElementById('buscador-resultado');

  inputBuscador.addEventListener('input', function (e) {
    var termino = e.target.value.trim().toLowerCase();
    var visibles = 0;
    todasLasBurbujas.forEach(function (burbuja) {
      var texto = burbuja.textContent.toLowerCase();
      var coincide = !termino || texto.includes(termino);
      burbuja.style.display = coincide ? '' : 'none';
      if (coincide) visibles++;
    });
    if (!termino) {
      resultadoTexto.textContent = '';
    } else if (visibles === 0) {
      resultadoTexto.textContent = 'Sin resultados para "' + e.target.value.trim() + '"';
    } else {
      resultadoTexto.textContent = visibles + (visibles === 1 ? ' noticia encontrada' : ' noticias encontradas');
    }
  });
}
