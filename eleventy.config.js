module.exports = function (eleventyConfig) {
  // Filtro "limit": recorta un array a los primeros N elementos (no viene
  // incluido de fábrica en Nunjucks/Eleventy 3).
  eleventyConfig.addFilter("limit", function (array, n) {
    if (!Array.isArray(array)) return array;
    return array.slice(0, n);
  });

  // Filtro "sinFijar": versión de rejectattr("data.pinned") que sí funciona
  // (rejectattr/selectattr de Nunjucks no leen bien rutas con punto como
  // "data.pinned", así que hay que filtrar a mano).
  eleventyConfig.addFilter("sinFijar", function (array) {
    if (!Array.isArray(array)) return array;
    return array.filter((item) => !item.data.pinned);
  });

  // Filtro "excerpt": quita las etiquetas HTML del cuerpo ya renderizado de
  // una noticia y lo recorta a N caracteres, cortando por palabra completa.
  // También quita la línea "Fuente: https://..." para que no salga en los
  // resúmenes.
  eleventyConfig.addFilter("excerpt", function (html, longitud) {
    if (!html) return "";
    const n = longitud || 160;
    const texto = String(html)
      .replace(/<[^>]*>/g, " ")
      .replace(/Fuente:\s*https?:\/\/\S+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (texto.length <= n) return texto;
    const cortado = texto.slice(0, n);
    const ultimoEspacio = cortado.lastIndexOf(" ");
    return (ultimoEspacio > 0 ? cortado.slice(0, ultimoEspacio) : cortado) + "…";
  });

  // Filtro "fecha": convierte "2026-07-07" en "7 jul 2026".
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  eleventyConfig.addFilter("fecha", function (valor) {
    if (!valor) return "";
    let y, m, d;
    if (valor instanceof Date) {
      y = valor.getUTCFullYear(); m = valor.getUTCMonth() + 1; d = valor.getUTCDate();
    } else {
      const partes = String(valor).slice(0, 10).split("-");
      if (partes.length < 3) return String(valor);
      y = +partes[0]; m = +partes[1]; d = +partes[2];
    }
    if (!y || !m || !d) return String(valor);
    return d + " " + MESES[m - 1] + " " + y;
  });

  // Filtro "cat": la categoría real de una noticia. En el panel se elige del
  // desplegable, pero si se rellena "Otra categoría" (category_nueva), esa
  // manda. Así se pueden crear categorías nuevas sin tocar la configuración.
  function categoriaDe(data) {
    if (!data) return "";
    const nueva = (data.category_nueva || "").trim();
    if (nueva) return nueva;
    const elegida = (data.category || "").trim();
    // La opción "Otra categoría (escribir abajo)" no es una categoría de verdad
    if (/^Otra categoría/i.test(elegida)) return "";
    return elegida;
  }
  eleventyConfig.addFilter("cat", categoriaDe);

  // Filtro "deCategoria": se queda solo con los elementos de una categoría.
  // Se usa en la página de huelga para recoger todo lo marcado como "Huelga".
  eleventyConfig.addFilter("deCategoria", function (array, nombre) {
    if (!Array.isArray(array)) return [];
    const buscada = String(nombre || "").trim().toLowerCase();
    return array.filter((n) => categoriaDe(n.data).toLowerCase() === buscada);
  });

  // Filtro "categorias": lista de categorías distintas que tienen las
  // noticias, en el orden en que aparecen (se usa para los filtros por tema).
  eleventyConfig.addFilter("categorias", function (array) {
    const vistas = [];
    (array || []).forEach((n) => {
      const c = categoriaDe(n.data);
      if (c && c !== "Noticias" && vistas.indexOf(c) === -1) vistas.push(c);
    });
    return vistas;
  });

  // Dirección pública de la web (para los enlaces de "compartir").
  // Cuando tengáis dominio propio, cambiadla aquí.
  eleventyConfig.addGlobalData("urlSitio", "https://cesmcyl.laracesmcyl.workers.dev");

  // Año actual para el pie de página.
  eleventyConfig.addGlobalData("anio", () => new Date().getFullYear());

  // Copiamos tal cual los archivos que no necesitan procesado
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy({ "src/static": "/" });

  // Colección "noticias": todas las noticias .md, ordenadas de más antigua a
  // más reciente (en las plantillas se usa "reverse" para pintar primero la
  // más reciente).
  eleventyConfig.addCollection("noticias", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/noticias/*.md").sort((a, b) => {
      return new Date(a.data.date) - new Date(b.data.date);
    });
  });

  // Colección "tablon": los destacados de la portada. Se ordenan por el
  // número de orden; a igualdad, por título.
  eleventyConfig.addCollection("tablon", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/tablon/*.md").sort((a, b) => {
      const oa = Number(a.data.orden || 0);
      const ob = Number(b.data.orden || 0);
      if (oa !== ob) return oa - ob;
      return String(a.data.title || "").localeCompare(String(b.data.title || ""));
    });
  });

  // Filtro "enRedes": destacados marcados para el bloque "Nuestras redes".
  eleventyConfig.addFilter("enRedes", function (array) {
    return (array || []).filter((d) => d.data.en_redes);
  });

  // Filtro "enHuelga": destacados marcados para la página de huelga.
  eleventyConfig.addFilter("enHuelga", function (array) {
    return (array || []).filter((d) => d.data.en_huelga);
  });

  // Filtro "md": convierte un texto con **negritas** y [enlaces](url) a HTML.
  eleventyConfig.addFilter("md", function (texto) {
    if (!texto) return "";
    return String(texto)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  });

  // Filtro "nl2br": los saltos de línea se ven como saltos en la web.
  eleventyConfig.addFilter("nl2br", function (texto) {
    return String(texto || "").replace(/\n/g, "<br>");
  });

  // Filtro "sinProtocolo": quita el https:// para mostrar la dirección.
  eleventyConfig.addFilter("sinProtocolo", function (url) {
    return String(url || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  });

  // Filtro "porCategoria": agrupa los destacados del tablón por categoría,
  // manteniendo el orden. Se usa para las pestañas del tablón de la portada.
  eleventyConfig.addFilter("porCategoria", function (array) {
    const grupos = [];
    (array || []).forEach((item) => {
      const nombre = categoriaDe(item.data) || "Destacados";
      let grupo = grupos.find((g) => g.nombre === nombre);
      if (!grupo) {
        grupo = { nombre: nombre, elementos: [] };
        grupos.push(grupo);
      }
      grupo.elementos.push(item);
    });
    return grupos;
  });

  // Colección "servicios": las páginas del menú Servicios, ordenadas por el
  // número de orden.
  eleventyConfig.addCollection("servicios", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/servicios/*.md").sort((a, b) => {
      return Number(a.data.orden || 0) - Number(b.data.orden || 0);
    });
  });

  // Filtro "principales": las páginas de servicios de primer nivel (las que
  // salen en el menú); las subpáginas llevan "padre" y se excluyen.
  eleventyConfig.addFilter("principales", function (array) {
    return (array || []).filter((s) => !s.data.padre);
  });

  // Filtro "hijasDe": las subpáginas de una página de servicios.
  eleventyConfig.addFilter("hijasDe", function (array, slug) {
    return (array || []).filter((s) => s.data.padre === slug);
  });

  // Filtro "hermanasDe": las demás subpáginas del mismo grupo, para poder
  // saltar entre ellas sin volver al menú (importante en móvil).
  eleventyConfig.addFilter("hermanasDe", function (array, padre, slugActual) {
    if (!padre) return [];
    return (array || []).filter((s) => s.data.padre === padre && s.fileSlug !== slugActual);
  });

  // Filtro "urlDe": la dirección de una página de servicios a partir de su
  // nombre de archivo.
  eleventyConfig.addFilter("urlDe", function (array, slug) {
    const encontrada = (array || []).find((s) => s.fileSlug === slug);
    return encontrada ? (encontrada.data.destino || encontrada.url) : "/#servicios";
  });

  // Filtro "tituloDe": el título de una página de servicios a partir de su
  // dirección, para la miga de pan de las subpáginas.
  eleventyConfig.addFilter("tituloDe", function (array, slug) {
    const encontrada = (array || []).find((s) => s.fileSlug === slug);
    return encontrada ? (encontrada.data.menu || encontrada.data.title) : "Servicios";
  });

  // Filtro "deCategorias": noticias de cualquiera de las categorías dadas,
  // de la más reciente a la más antigua.
  eleventyConfig.addFilter("deCategorias", function (array, lista) {
    if (!Array.isArray(array)) return [];
    const buscadas = (Array.isArray(lista) ? lista : [lista])
      .filter(Boolean)
      .map((c) => String(c).trim().toLowerCase());
    if (!buscadas.length) return [];
    return array.filter((n) => buscadas.indexOf(categoriaDe(n.data).toLowerCase()) !== -1);
  });

  // Lista de categorías del panel (la misma que usa el desplegable de las
  // noticias). Se lee aquí para poder montar los subapartados de servicios.
  eleventyConfig.addGlobalData("listaCategorias", function () {
    try {
      const datos = JSON.parse(require("fs").readFileSync("src/static/categorias.json", "utf8"));
      return (datos.categorias || []).map((c) => c.nombre).filter(Boolean);
    } catch (e) {
      return [];
    }
  });

  // Filtro "subapartadosDe": las categorías de un grupo. Un subapartado es
  // una categoría escrita como «Grupo / Nombre» (p. ej. «Novedades normativas
  // / Estatales»). Devuelve el nombre completo y el nombre corto.
  eleventyConfig.addFilter("subapartadosDe", function (lista, grupo) {
    const prefijo = String(grupo || "").trim().toLowerCase() + " /";
    if (!grupo) return [];
    return (lista || [])
      .filter((c) => String(c).toLowerCase().startsWith(prefijo))
      .map((c) => ({ completo: c, corto: String(c).slice(prefijo.length).trim() }));
  });

  // Filtro "conSubapartados": une las categorías propias de la página con
  // las de sus subapartados (para la pestaña «Todas»).
  eleventyConfig.addFilter("conSubapartados", function (propias, subaps) {
    return (propias || []).concat((subaps || []).map((s) => s.completo));
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
