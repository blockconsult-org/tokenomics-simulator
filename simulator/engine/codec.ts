import { normaliseModel } from "./normalise";
import type { Model } from "./types";

/**
 * Share-link codec: a model as text short enough for a URL hash.
 *
 * The text is a prefix naming the format and its version, then base64url.
 * "z1." carries deflated JSON; "j1." carries the JSON as it is, for browsers
 * without CompressionStream. Only standard web APIs are used, so the same
 * code runs in the browser and under Node.
 */
const DEFLATED_PREFIX = "z1.";
const PLAIN_PREFIX = "j1.";
const COMPRESSION_FORMAT = "deflate-raw";

/**
 * Upper bounds for decoding. The largest valid model is about 15 KB of JSON,
 * so both leave ample room. The second one matters most: a few kilobytes of
 * deflate can expand to hundreds of megabytes, so inflation is stopped as
 * soon as the output passes the cap instead of being measured afterwards.
 */
const MAX_ENCODED_LENGTH = 65_536;
const MAX_DECODED_BYTES = 200_000;

/** String.fromCharCode takes its input as arguments, and engines limit how
 *  many a call may have. */
const BASE64_CHUNK = 0x8000;

type Bytes = Uint8Array<ArrayBuffer>;

function toBase64Url(bytes: Bytes): string {
  let binary = "";
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK));
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(text: string): Bytes | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
  // atob throws on a length that no amount of padding can make valid; the
  // caller catches it.
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Run bytes through a compression or decompression stream and collect the
 * output, giving up with null once it grows past `maxBytes`. Rejects when the
 * stream rejects the data.
 */
async function transform(
  bytes: Bytes,
  stream: CompressionStream | DecompressionStream,
  maxBytes: number,
): Promise<Bytes | null> {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function deflate(bytes: Bytes): Promise<Bytes | null> {
  if (typeof CompressionStream !== "function") return null;
  try {
    return await transform(
      bytes,
      new CompressionStream(COMPRESSION_FORMAT),
      Number.POSITIVE_INFINITY,
    );
  } catch {
    // Some browsers have CompressionStream without the raw deflate format
    // and throw from the constructor.
    return null;
  }
}

/** Encode a model for the URL hash. */
export async function encodeModel(model: Model): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(model));
  const deflated = await deflate(json);
  return deflated
    ? DEFLATED_PREFIX + toBase64Url(deflated)
    : PLAIN_PREFIX + toBase64Url(json);
}

/**
 * Decode text from a URL hash. Returns null for anything that is not a model
 * link: wrong prefix, bad base64, corrupt or oversized data, JSON that is not
 * an object. The text is attacker-controlled, so whatever does parse still
 * goes through normaliseModel before it is returned.
 */
export async function decodeModel(text: string): Promise<Model | null> {
  try {
    if (text.length > MAX_ENCODED_LENGTH) return null;

    let json: Bytes | null;
    if (text.startsWith(DEFLATED_PREFIX)) {
      if (typeof DecompressionStream !== "function") return null;
      const deflated = fromBase64Url(text.slice(DEFLATED_PREFIX.length));
      if (!deflated) return null;
      json = await transform(
        deflated,
        new DecompressionStream(COMPRESSION_FORMAT),
        MAX_DECODED_BYTES,
      );
    } else if (text.startsWith(PLAIN_PREFIX)) {
      json = fromBase64Url(text.slice(PLAIN_PREFIX.length));
    } else {
      return null;
    }
    if (!json) return null;

    const parsed: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(json),
    );
    // normaliseModel would turn a number or an array into the default model,
    // which would pass a broken link off as a working one.
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return normaliseModel(parsed);
  } catch {
    return null;
  }
}
