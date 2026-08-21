module.exports = function (eleventyConfig) {
  // Filtro "limit": recorta un array a los primeros N elementos (no viene
  // incluido de fábrica en Nunjucks/Eleventy 3).
  eleventyConfig.addFilter("limit", function (array, n) {
    if (!Array.isArray(array)) return array;
    return array.slice(0, n);
  });

  // Filtro "excerpt": quita las etiquetas HTML del cuerpo ya renderizado de
  // una noticia y lo recorta a N caracteres, cortando por palabra completa,
  // para usarlo como resumen en las tarjetas de la cuadrícula de noticias.
  eleventyConfig.addFilter("excerpt", function (html, longitud) {
    if (!html) return "";
    const n = longitud || 160;
    const texto = String(html)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (texto.length <= n) return texto;
    const cortado = texto.slice(0, n);
    const ultimoEspacio = cortado.lastIndexOf(" ");
    return (ultimoEspacio > 0 ? cortado.slice(0, ultimoEspacio) : cortado) + "…";
  });

  // Copiamos tal cual los archivos que no necesitan procesado
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy({ "src/static": "/" });

  // Colección "noticias": todas las noticias .md, ordenadas de más antigua a
  // más reciente (igual que hacía el JS antiguo, que luego invertía con
  // "reverse" al pintar la más reciente primero).
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
