module.exports = function (eleventyConfig) {
  // Filtro "limit": recorta un array a los primeros N elementos (no viene
  // incluido de fábrica en Nunjucks/Eleventy 3).
  eleventyConfig.addFilter("limit", function (array, n) {
    if (!Array.isArray(array)) return array;
    return array.slice(0, n);
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
