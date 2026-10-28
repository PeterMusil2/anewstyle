import { readFile, writeFile } from "node:fs/promises";

const [, , sourceModelPath, outputModelPath] = process.argv;
if (!sourceModelPath || !outputModelPath) {
  throw new Error("Usage: bun scripts/make-ar-model-unlit.mjs <source.glb> <output.glb>");
}

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const align4 = (length) => (length + 3) & ~3;

const source = new Uint8Array(await readFile(sourceModelPath));
const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(4, true) !== 2) {
  throw new Error("Only GLB version 2 is supported.");
}

const jsonLength = view.getUint32(12, true);
if (view.getUint32(16, true) !== JSON_CHUNK) throw new Error("GLB JSON chunk is missing.");
const json = JSON.parse(new TextDecoder().decode(source.subarray(20, 20 + jsonLength)).trimEnd());
const binHeaderOffset = 20 + jsonLength;
const binLength = view.getUint32(binHeaderOffset, true);
if (view.getUint32(binHeaderOffset + 4, true) !== BIN_CHUNK) throw new Error("GLB BIN chunk is missing.");
const bin = source.subarray(binHeaderOffset + 8, binHeaderOffset + 8 + binLength);

json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), "KHR_materials_unlit"])];
json.materials.forEach((material) => {
  material.extensions = { ...(material.extensions ?? {}), KHR_materials_unlit: {} };
});

const encodedJson = new TextEncoder().encode(JSON.stringify(json));
const paddedJsonLength = align4(encodedJson.byteLength);
const paddedBinLength = align4(bin.byteLength);
const totalLength = 12 + 8 + paddedJsonLength + 8 + paddedBinLength;
const output = new Uint8Array(totalLength);
const outputView = new DataView(output.buffer);
outputView.setUint32(0, GLB_MAGIC, true);
outputView.setUint32(4, 2, true);
outputView.setUint32(8, totalLength, true);
outputView.setUint32(12, paddedJsonLength, true);
outputView.setUint32(16, JSON_CHUNK, true);
output.fill(0x20, 20, 20 + paddedJsonLength);
output.set(encodedJson, 20);
const outputBinHeader = 20 + paddedJsonLength;
outputView.setUint32(outputBinHeader, paddedBinLength, true);
outputView.setUint32(outputBinHeader + 4, BIN_CHUNK, true);
output.set(bin, outputBinHeader + 8);

await writeFile(outputModelPath, output);
console.log(`${outputModelPath}: ${output.byteLength} bytes`);
