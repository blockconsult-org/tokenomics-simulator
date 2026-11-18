import type { Model } from "@/simulator/engine/types";

/** Hand a blob to the browser as a file download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking in the same task can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(
  text: string,
  filename: string,
  type: string,
): void {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);
}

/** A file name stem from the token's symbol or name: "abc-tokenomics". */
export function fileStem(model: Model): string {
  const source = model.token.symbol || model.token.name;
  const slug = source
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return slug ? `${slug}-tokenomics` : "tokenomics";
}
