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

  // Filtro "categorias": lista de categorías distintas que tienen las
  // noticias, en el orden en que aparecen (se usa para los filtros por tema).
  eleventyConfig.addFilter("categorias", function (array) {
    const vistas = [];
    (array || []).forEach((n) => {
      const c = n.data && n.data.category;
      if (c && vistas.indexOf(c) === -1) vistas.push(c);
    });
    return vistas;
  });

  // Dirección pública de la web (para los enlaces de "compartir").
  // Cuando tengáis dominio propio, cambiadla aquí.
  eleventyConfig.addGlobalData("urlSitio", "https://cesmcyl.laracesmcyl.workers.dev");

  // Filtro "sobreHuelga": noticias relacionadas con la huelga (las que
  // mencionan "huelga" en el título o son de la categoría Estatuto Marco).
  eleventyConfig.addFilter("sobreHuelga", function (array) {
    if (!Array.isArray(array)) return array;
    return array.filter((n) => /huelga/i.test(n.data.title || "") || n.data.category === "Estatuto Marco");
  });

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
