/**
 * Turns a chart's SVG into a PNG.
 *
 * The charts take their colours and type from the page's stylesheet through
 * CSS variables. An SVG drawn as an image is a separate document and sees
 * none of that, so every element of the copy first gets the values the
 * browser computed for the original written onto it.
 */

/** The properties the charts set from a stylesheet or a CSS variable. */
const INLINED = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "visibility",
  "paint-order",
  "shape-rendering",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant-numeric",
  "letter-spacing",
  "text-anchor",
  "text-transform",
] as const;

const DEFAULT_SCALE = 2;

/**
 * Resolves a colour the way the page would, so the caller can pass a token
 * such as var(--color-bg). A canvas does not understand variables.
 */
function resolveColor(color: string, near: Element): string {
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = color;
  (near.parentElement ?? document.body).appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || color;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The chart could not be drawn as an image."));
    image.src = source;
  });
}

/**
 * Renders `svg` as it looks on the page onto `background` and returns the
 * PNG. `scale` multiplies the pixel size, and defaults to 2 so the image
 * stays sharp on a dense screen and in a slide.
 *
 * Elements marked data-export="skip", which the charts put on the crosshair,
 * are left out. Web fonts do not load inside an SVG image, so the text falls
 * back to the next installed face in its font stack.
 */
export async function svgToPng(
  svg: SVGSVGElement,
  options: { scale?: number; background: string },
): Promise<Blob> {
  const box = svg.getBoundingClientRect();
  const view = svg.viewBox.baseVal;
  const width = Math.max(1, Math.round(box.width || view.width));
  const height = Math.max(1, Math.round(box.height || view.height));
  const scale =
    typeof options.scale === "number" && options.scale > 0
      ? options.scale
      : DEFAULT_SCALE;

  const copy = svg.cloneNode(true) as SVGSVGElement;
  // The original and the copy list their elements in the same order, so
  // the styles are carried across by position before anything is removed.
  const originals = [svg, ...svg.querySelectorAll<SVGElement>("*")];
  const copies = [copy, ...copy.querySelectorAll<SVGElement>("*")];
  originals.forEach((original, i) => {
    const target = copies[i];
    if (!target) return;
    const computed = getComputedStyle(original);
    for (const property of INLINED) {
      const value = computed.getPropertyValue(property);
      if (value !== "") target.style.setProperty(property, value);
    }
  });
  copy.querySelectorAll('[data-export="skip"]').forEach((node) => node.remove());

  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  if (!copy.hasAttribute("viewBox")) {
    copy.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  // Classes mean nothing without the stylesheet.
  copy.removeAttribute("class");

  const markup = new XMLSerializer().serializeToString(copy);
  const image = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`,
  );

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser has no 2D canvas to draw on.");
  context.fillStyle = resolveColor(options.background, svg);
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The chart could not be encoded as a PNG."));
    }, "image/png");
  });
}
