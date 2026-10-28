import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const PRODUCT_DIR = new URL("../public/3d/products/", import.meta.url);
const SOURCES = [
  "Rockfoil_DARKGOLD_AR_vertical_unlit.glb",
  ...Array.from({ length: 6 }, (_, index) => `Mineral_${String(index + 1).padStart(2, "0")}_3D_vertical.glb`),
];
const HALF_SQRT = Math.SQRT1_2;

function landscapeGlb(source) {
  const jsonLength = source.readUInt32LE(12);
  const jsonType = source.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) throw new Error("The first GLB chunk is not JSON");

  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString("utf8").trimEnd());
  const scene = json.scenes[json.scene ?? 0];
  const originalRoots = [...scene.nodes];
  const landscapeRoot = json.nodes.length;
  json.nodes.push({
    name: "AR landscape orientation",
    rotation: [0, 0, HALF_SQRT, HALF_SQRT],
    children: originalRoots,
  });
  scene.nodes = [landscapeRoot];

  const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const paddedJsonLength = Math.ceil(jsonBytes.length / 4) * 4;
  const remainingChunks = source.subarray(20 + jsonLength);
  const output = Buffer.alloc(20 + paddedJsonLength + remainingChunks.length, 0x20);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(paddedJsonLength, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  jsonBytes.copy(output, 20);
  remainingChunks.copy(output, 20 + paddedJsonLength);
  return output;
}

for (const filename of SOURCES) {
  const sourceUrl = new URL(filename, PRODUCT_DIR);
  const targetUrl = new URL(filename.replace("_vertical", "_horizontal"), PRODUCT_DIR);
  const output = landscapeGlb(await readFile(sourceUrl));
  await writeFile(targetUrl, output);
  console.log(`${basename(sourceUrl.pathname)} → ${basename(targetUrl.pathname)}`);
}
