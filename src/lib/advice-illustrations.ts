// Use the editorial image descriptions as captions. Keep the LGP legend together.
export const illustrateAdvice = (code: string) => code.replace(
  /<p>(<img\b[^>]*\balt="([^"]+)"[^>]*>)<\/p>(?:\s*(<((?:ol|ul))\b[^>]*>[\s\S]*?<\/\4>))?/g,
  (original, image: string, caption: string, list?: string) => {
    if (image.includes('src="/images/poradna/anewstyle-montaz-slim.webp"')) {
      return `<figure class="guide-figure-full">${image}</figure>${list ?? ""}`;
    }
    const construction = image.includes("02_konstrukce_sviticiho_panelu_1280_1200.webp");
    const hasLegend = construction
      || image.includes("anewstyle-lgp-princip.webp")
      || image.includes("montazni-sada-antracit.webp")
      || image.includes("01_konstrukce_materialu_panelu_1280_1200.webp");
    const legend = hasLegend ? list : undefined;
    const markers = [[52, 21], [75, 33], [70, 49], [47, 69], [50, 95], [83, 73]];
    const illustration = construction
      ? `<div class="guide-annotated">${image}${markers.map(([x, y], i) => `<span aria-hidden="true" style="left:${x}%;top:${y}%">${i + 1}</span>`).join("")}</div>`
      : image;
    return `<figure class="guide-figure">${illustration}<figcaption>${legend ?? caption}</figcaption></figure>${legend ? "" : list ?? ""}`;
  },
);
