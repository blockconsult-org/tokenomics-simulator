// Share-link codec: a model survives the round trip, and nothing a stranger can put in a URL hash
// makes decodeModel throw, hang or return something that is not a model.
import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { decodeModel, encodeModel } from "@/simulator/engine/codec";
import { defaultModel, getPreset, presetIds } from "@/simulator/engine/presets";

const deflated = (text) => `z1.${deflateRawSync(Buffer.from(text)).toString("base64url")}`;
const plain = (text) => `j1.${Buffer.from(text).toString("base64url")}`;

test("every preset survives encode → decode, in URL-safe text", async () => {
  for (const id of presetIds) {
    const encoded = await encodeModel(getPreset(id));
    assert.match(encoded, /^z1\.[A-Za-z0-9_-]+$/, id);
    assert.deepEqual(await decodeModel(encoded), getPreset(id), id);
  }
});

test("names outside ASCII survive the round trip", async () => {
  const model = defaultModel();
  model.token.name = "Züri Token 😀";
  model.allocations[0].name = "Gründer & Team";

  assert.deepEqual(await decodeModel(await encodeModel(model)), model);
});

test("without CompressionStream the link falls back to plain JSON under its own prefix", async () => {
  const { CompressionStream: original } = globalThis;
  globalThis.CompressionStream = undefined;
  let encoded;
  try {
    encoded = await encodeModel(defaultModel());
  } finally {
    globalThis.CompressionStream = original;
  }

  assert.match(encoded, /^j1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeModel(encoded), defaultModel());
});

test("text that is not a model link decodes to null", async () => {
  const encoded = await encodeModel(defaultModel());
  const notLinks = {
    "empty string": "",
    garbage: "not a link at all",
    "prefix only": "z1.",
    "unknown version prefix": `z2.${encoded.slice(3)}`,
    "no prefix": encoded.slice(3),
    "truncated payload": encoded.slice(0, Math.floor(encoded.length / 2)),
    "characters outside base64url": `z1.${encoded.slice(3, 40)}+/=${encoded.slice(40)}`,
    "base64 that is not deflate": "z1.AAAAAAAAAAAAAAAA",
    "deflate that is not JSON": deflated("not json"),
    "bytes that are not UTF-8": `j1.${Buffer.from([0x7b, 0xff, 0x7d]).toString("base64url")}`,
    "JSON that is not an object": plain("[1,2,3]"),
    "JSON null": deflated("null"),
    "longer than any link the page writes": `j1.${"A".repeat(70_000)}`,
  };

  for (const [label, text] of Object.entries(notLinks)) assert.equal(await decodeModel(text), null, label);
});

test("inflation stops at the size cap instead of expanding a deflate bomb", async () => {
  // Both payloads are valid JSON: an empty object after a run of spaces. 100 KB of padding is
  // under the cap and decodes; 20 MB is a 26 KB link that only the cap can refuse.
  const padded = (bytes) => deflated(`${" ".repeat(bytes)}{}`);

  assert.deepEqual(await decodeModel(padded(100_000)), defaultModel());
  const bomb = padded(20_000_000);
  assert.ok(bomb.length < 65_536, "the bomb fits inside the length cap");
  assert.equal(await decodeModel(bomb), null);
});

test("a decoded model is normalised, whatever the link carried", async () => {
  const model = await decodeModel(deflated('{"horizonMonths":9999,"__proto__":{"polluted":true},"monteCarlo":{"seed":-1}}'));

  assert.deepEqual(model, { ...defaultModel(), horizonMonths: 120, monteCarlo: { ...defaultModel().monteCarlo, seed: 4294967295 } });
  assert.equal({}.polluted, undefined);
});
