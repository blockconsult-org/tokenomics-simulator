import { svgToPng } from "../charts/chart-export";

/**
 * A chart view as a picture that stands on its own: a title, every plot of
 * the view, the legend of the series that are showing and a source line.
 *
 * The plots are the SVG on screen. The words are drawn beside them, because
 * a legend made of buttons is not part of the drawing. The legend is read
 * back from the chart kit's markup, so the picture always shows what the
 * screen shows: the pressed series buttons (.sim-chart-toggle) of a chart
 * with axes, and the rows of the list beside a ring (.sim-chart-key).
 */

/** Device pixels per CSS pixel in the file. */
const SCALE = 2;
const PADDING = 24;
const GAP = 16;
const TITLE_SIZE = 18;
const TEXT_SIZE = 12;
const LINE_HEIGHT = 20;
const SWATCH = 12;
const MIN_PLOT_WIDTH = 320;

interface LegendEntry {
  label: string;
  color: string;
  mark: "line" | "block" | "band";
  dashed: boolean;
}

type Block =
  | { kind: "plot"; image: ImageBitmap; width: number; height: number }
  | { kind: "legend"; entries: LegendEntry[] }
  /** A line above a plot in a view that holds more than one. */
  | { kind: "caption"; text: string };

export interface ChartImageText {
  title: string;
  footer: string;
}

/** A CSS colour in a form a canvas accepts, with variables and colour
 *  functions resolved. */
function resolveColor(value: string, fallback: string): string {
  const probe = document.createElement("span");
  probe.style.color = fallback;
  probe.style.color = value.trim();
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

/** The words of a legend entry: a series button's name, or the name and the
 *  value of a row in a ring's list. */
function legendLabel(node: Element): string {
  const name = node.querySelector(".sim-chart-toggle-label");
  if (name) return name.textContent ?? "";
  return Array.from(node.querySelectorAll(":scope > span"))
    .map((part) => part.textContent?.trim() ?? "")
    .filter((part) => part !== "")
    .join(" ");
}

function legendEntry(node: Element, fallback: string): LegendEntry {
  const shape = node.querySelector(".sim-chart-swatch > *");
  const style = shape ? getComputedStyle(shape) : null;
  const isLine = shape?.tagName.toLowerCase() === "line";
  const color = isLine ? style?.stroke : style?.fill;
  return {
    label: legendLabel(node),
    color: color && color !== "none" ? color : fallback,
    mark: isLine
      ? "line"
      : shape?.hasAttribute("fill-opacity")
        ? "band"
        : "block",
    dashed: shape?.hasAttribute("stroke-dasharray") ?? false,
  };
}

function drawSwatch(
  ctx: CanvasRenderingContext2D,
  entry: LegendEntry,
  x: number,
  y: number,
) {
  ctx.fillStyle = entry.color;
  ctx.strokeStyle = entry.color;
  if (entry.mark === "line") {
    if (entry.dashed) {
      ctx.fillRect(x, y + 5, 5, 2);
      ctx.fillRect(x + 7, y + 5, 5, 2);
    } else {
      ctx.fillRect(x, y + 5, SWATCH, 2);
    }
  } else if (entry.mark === "band") {
    ctx.globalAlpha = 0.3;
    ctx.fillRect(x + 1, y + 1, 10, 10);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, 9, 9);
  } else {
    ctx.fillRect(x + 1, y + 1, 10, 10);
  }
}

/** Wraps text at word boundaries and returns the y below its last line. */
function paragraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  top: number,
  maxWidth: number,
  lineHeight: number,
  draw: boolean,
): number {
  let y = top;
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      if (draw) ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = next;
    }
  }
  if (draw && line) ctx.fillText(line, x, y);
  return y + lineHeight;
}

/**
 * Renders the chart view inside `view` to a PNG. Returns null when the view
 * holds no chart or the browser cannot draw it.
 */
export async function chartImage(
  view: HTMLElement,
  text: ChartImageText,
): Promise<Blob | null> {
  const chart = view.querySelector<HTMLElement>(".sim-chart");
  if (!chart) return null;

  const root = getComputedStyle(document.documentElement);
  const fg = resolveColor(root.getPropertyValue("--color-fg"), "#000");
  const muted = resolveColor(root.getPropertyValue("--color-muted"), fg);
  const faint = resolveColor(root.getPropertyValue("--color-faint"), muted);
  const background = resolveColor(
    getComputedStyle(chart).getPropertyValue("--sim-chart-surface"),
    resolveColor(root.getPropertyValue("--color-bg"), "#fff"),
  );
  const sans = getComputedStyle(document.body).fontFamily;
  const titleFont = `600 ${TITLE_SIZE}px ${sans}`;
  const textFont = `${TEXT_SIZE}px ${sans}`;

  // Captions, plots and legend entries in the order they appear on screen,
  // so each caption and legend lands beside the plot it belongs to.
  const blocks: Block[] = [];
  const nodes = view.querySelectorAll(
    '[data-chart-caption], [data-chart-plot], .sim-chart-toggle[aria-pressed="true"], .sim-chart-key > li',
  );
  for (const node of nodes) {
    if (node.hasAttribute("data-chart-caption")) {
      blocks.push({ kind: "caption", text: node.textContent ?? "" });
    } else if (node instanceof SVGSVGElement) {
      const box = node.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const blob = await svgToPng(node, { scale: SCALE, background });
      blocks.push({
        kind: "plot",
        image: await createImageBitmap(blob),
        width: box.width,
        height: box.height,
      });
    } else {
      const entry = legendEntry(node, muted);
      const last = blocks.at(-1);
      if (last?.kind === "legend") last.entries.push(entry);
      else blocks.push({ kind: "legend", entries: [entry] });
    }
  }
  const plots = blocks.filter((block) => block.kind === "plot");
  if (plots.length === 0) return null;

  const inner = Math.max(MIN_PLOT_WIDTH, ...plots.map((plot) => plot.width));
  const width = inner + 2 * PADDING;

  // One routine lays the picture out and draws it, so the measured height
  // and the drawing cannot drift apart.
  const paint = (ctx: CanvasRenderingContext2D, draw: boolean): number => {
    ctx.textBaseline = "top";
    ctx.font = titleFont;
    ctx.fillStyle = fg;
    let y =
      paragraph(ctx, text.title, PADDING, PADDING, inner, TITLE_SIZE * 1.3, draw) +
      GAP / 2;

    for (const block of blocks) {
      if (block.kind === "plot") {
        if (draw) ctx.drawImage(block.image, PADDING, y, block.width, block.height);
        y += block.height + GAP;
        continue;
      }
      if (block.kind === "caption") {
        ctx.font = textFont;
        ctx.fillStyle = muted;
        y = paragraph(ctx, block.text, PADDING, y, inner, LINE_HEIGHT, draw);
        continue;
      }
      ctx.font = textFont;
      let x = PADDING;
      for (const entry of block.entries) {
        const entryWidth = SWATCH + 6 + ctx.measureText(entry.label).width;
        if (x > PADDING && x + entryWidth > PADDING + inner) {
          x = PADDING;
          y += LINE_HEIGHT;
        }
        if (draw) {
          drawSwatch(ctx, entry, x, y);
          ctx.fillStyle = muted;
          ctx.fillText(entry.label, x + SWATCH + 6, y);
        }
        x += entryWidth + GAP;
      }
      y += LINE_HEIGHT + GAP;
    }

    ctx.font = textFont;
    ctx.fillStyle = faint;
    return (
      paragraph(ctx, text.footer, PADDING, y, inner, LINE_HEIGHT - 2, draw) +
      PADDING - 4
    );
  };

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;
  const height = paint(measure, false);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * SCALE);
  canvas.height = Math.round(height * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  paint(ctx, true);
  for (const plot of plots) plot.image.close();

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
