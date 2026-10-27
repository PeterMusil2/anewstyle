import { readFile, writeFile } from "node:fs/promises";

const [, , sourceModelPath, texturePath, outputModelPath] = process.argv;

if (!sourceModelPath || !texturePath || !outputModelPath) {
  throw new Error("Usage: bun scripts/bake-ar-model.mjs <source.glb> <texture> <output.glb>");
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
const texture = new Uint8Array(await readFile(texturePath));
const imageViewIndexes = new Set(json.images.map((image) => image.bufferView));
const replacements = [...imageViewIndexes]
  .map((index) => ({
    index,
    view: json.bufferViews[index],
    originalOffset: json.bufferViews[index].byteOffset,
    originalLength: json.bufferViews[index].byteLength,
  }))
  .sort((a, b) => a.originalOffset - b.originalOffset);

if (!replacements.length) throw new Error("The source GLB has no embedded images.");

const chunks = [];
let sourceOffset = 0;
let outputOffset = 0;
for (const replacement of replacements) {
  const unchanged = bin.subarray(sourceOffset, replacement.originalOffset);
  chunks.push(unchanged);
  outputOffset += unchanged.byteLength;
  replacement.view.byteOffset = outputOffset;
  replacement.view.byteLength = texture.byteLength;
  chunks.push(texture);
  outputOffset += texture.byteLength;
  const padding = align4(outputOffset) - outputOffset;
  if (padding) chunks.push(new Uint8Array(padding));
  outputOffset += padding;
  sourceOffset = replacement.originalOffset + replacement.originalLength;
}
chunks.push(bin.subarray(sourceOffset));

const rebuiltBin = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.byteLength, 0));
let chunkOffset = 0;
for (const chunk of chunks) {
  rebuiltBin.set(chunk, chunkOffset);
  chunkOffset += chunk.byteLength;
}

for (const bufferView of json.bufferViews) {
  if (imageViewIndexes.has(json.bufferViews.indexOf(bufferView))) continue;
  let shift = 0;
  for (const replacement of replacements) {
    const oldEnd = replacement.originalOffset + replacement.originalLength;
    if (bufferView.byteOffset >= oldEnd) {
      shift += align4(texture.byteLength) - replacement.originalLength;
    }
  }
  bufferView.byteOffset += shift;
}
json.images.forEach((image, index) => {
  image.mimeType = "image/png";
  image.name = `mineral-ar-${index + 1}`;
});
json.buffers[0].byteLength = rebuiltBin.byteLength;

const encodedJson = new TextEncoder().encode(JSON.stringify(json));
const paddedJsonLength = align4(encodedJson.byteLength);
const totalLength = 12 + 8 + paddedJsonLength + 8 + rebuiltBin.byteLength;
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
outputView.setUint32(outputBinHeader, rebuiltBin.byteLength, true);
outputView.setUint32(outputBinHeader + 4, BIN_CHUNK, true);
output.set(rebuiltBin, outputBinHeader + 8);

await writeFile(outputModelPath, output);
console.log(`${outputModelPath}: ${output.byteLength} bytes`);
