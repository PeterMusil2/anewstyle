/**
 * Add a shared tangent-space normal map and a matte finish to the Wildlife 3D models.
 *
 * Each normal map is derived from the model's own stone texture, keeping the
 * surface relief aligned with the existing Wildlife image in both orientations.
 * Run with `bun run models:wildlife-normals` to regenerate the map and update GLBs.
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const models = [
  {
    source: "public/3d/products/Rockfoil_WILDLIFE_3D.glb",
    output: "public/3d/products/Rockfoil_WILDLIFE_3D_relief_matte_v2.glb",
  },
  {
    source: "public/3d/products/Rockfoil_WILDLIFE_3D_vertical.glb",
    output: "public/3d/products/Rockfoil_WILDLIFE_3D_vertical_relief_matte_v2.glb",
  },
];
const normalMapUri = "WILDLIFE_surface_normal_v2.png";
const normalMapWidth = 512;
const fineBlurRadius = 1.2;
const broadBlurRadius = 8;
const normalStrength = 6.5;
const materialNormalScale = 0.95;
const materialRoughnessFactor = 0.82;

const alignToFourBytes = (length) => (length + 3) & ~3;

function readGlb(input, path) {
  if (input.toString("ascii", 0, 4) !== "glTF" || input.readUInt32LE(4) !== 2) {
    throw new Error(`${path} is not a glTF 2.0 binary model.`);
  }

  const chunks = [];
  let offset = 12;
  while (offset < input.length) {
    const length = input.readUInt32LE(offset);
    const type = input.readUInt32LE(offset + 4);
    chunks.push({ type, data: input.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }

  const jsonChunk = chunks.find(({ type }) => type === 0x4e4f534a);
  const binaryChunk = chunks.find(({ type }) => type === 0x004e4942);
  if (!jsonChunk || !binaryChunk || chunks.length !== 2) {
    throw new Error(`${path} must contain one JSON chunk and one binary chunk.`);
  }

  return {
    document: JSON.parse(jsonChunk.data.toString("utf8").trim()),
    binary: Buffer.from(binaryChunk.data),
  };
}

async function makeNormalMap(sourceImage) {
  const metadata = await sharp(sourceImage).metadata();
  const sourceWidth = metadata.width ?? normalMapWidth;
  const sourceHeight = metadata.height ?? normalMapWidth / 2;
  const width = Math.min(normalMapWidth, sourceWidth);
  const height = Math.max(1, Math.round((sourceHeight * width) / sourceWidth));
  const resize = { width, height, fit: "fill" };

  const { data: grayscale, info } = await sharp(sourceImage)
    .resize(resize)
    .greyscale()
    .blur(fineBlurRadius)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data: blurred } = await sharp(sourceImage)
    .resize(resize)
    .greyscale()
    .blur(broadBlurRadius)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { channels } = info;
  if (channels !== 1) {
    throw new Error(`Expected a grayscale texture, received ${channels} channels.`);
  }

  // Keep the broad colour pattern out of the bump map so it contributes only
  // small surface detail, rather than turning light and dark areas into hills.
  const relief = new Float32Array(width * height);
  for (let index = 0; index < relief.length; index += 1) {
    relief[index] = grayscale[index] - blurred[index];
  }

  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const yAbove = Math.max(0, y - 1);
    const yBelow = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x += 1) {
      const xLeft = Math.max(0, x - 1);
      const xRight = Math.min(width - 1, x + 1);
      const index = y * width + x;
      const dx =
        ((relief[y * width + xRight] - relief[y * width + xLeft]) / 255) *
        normalStrength;
      const dy =
        ((relief[yBelow * width + x] - relief[yAbove * width + x]) / 255) *
        normalStrength;

      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const length = Math.hypot(nx, ny, nz);
      nx /= length;
      ny /= length;
      nz /= length;

      const pixel = index * 4;
      pixels[pixel] = Math.round((nx * 0.5 + 0.5) * 255);
      pixels[pixel + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      pixels[pixel + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      pixels[pixel + 3] = 255;
    }
  }

  return sharp(pixels, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function getWildlifeTexture(document, binary, path) {
  const material = document.materials.find(({ name }) => name === "WILDLIFE");
  if (!material) throw new Error(`Could not find the WILDLIFE material in ${path}.`);
  const baseTextureIndex = material.pbrMetallicRoughness.baseColorTexture?.index;
  const sourceImage = document.images[document.textures[baseTextureIndex]?.source];
  const sourceView = document.bufferViews[sourceImage?.bufferView];
  if (!sourceView || sourceView.buffer !== 0) {
    throw new Error(`Could not locate the embedded Wildlife texture in ${path}.`);
  }

  const sourceOffset = sourceView.byteOffset ?? 0;
  return binary.subarray(sourceOffset, sourceOffset + sourceView.byteLength);
}

function buildGlb(document, binary) {
  const json = Buffer.from(JSON.stringify(document), "utf8");
  const jsonChunkLength = alignToFourBytes(json.length);
  const paddedJson = Buffer.alloc(jsonChunkLength, 0x20);
  json.copy(paddedJson);

  const binaryChunkLength = alignToFourBytes(binary.length);
  const paddedBinary = Buffer.alloc(binaryChunkLength);
  binary.copy(paddedBinary);

  const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBinary.length;
  const output = Buffer.alloc(totalLength);
  output.write("glTF", 0, 4, "ascii");
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(paddedJson.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  paddedJson.copy(output, 20);
  const binaryHeader = 20 + paddedJson.length;
  output.writeUInt32LE(paddedBinary.length, binaryHeader);
  output.writeUInt32LE(0x004e4942, binaryHeader + 4);
  paddedBinary.copy(output, binaryHeader + 8);
  return output;
}

async function addNormalMap(sourcePath, outputPath, normalMap) {
  const input = await readFile(resolve(projectRoot, sourcePath));
  const { document, binary } = readGlb(input, sourcePath);
  const material = document.materials.find(({ name }) => name === "WILDLIFE");
  if (!material) throw new Error(`Could not find the WILDLIFE material in ${sourcePath}.`);
  if (material.normalTexture) {
    throw new Error(`The source model already has a normal map: ${sourcePath}.`);
  }

  const baseTextureIndex = material.pbrMetallicRoughness.baseColorTexture?.index;
  const imageIndex = document.images.length;
  document.images.push({
    uri: normalMapUri,
    name: "WILDLIFE surface relief",
  });

  const textureIndex = document.textures.length;
  const baseTexture = document.textures[baseTextureIndex];
  document.textures.push({
    sampler: baseTexture.sampler,
    source: imageIndex,
    name: "WILDLIFE surface relief",
  });
  material.normalTexture = { index: textureIndex, scale: materialNormalScale };
  material.pbrMetallicRoughness.roughnessFactor = materialRoughnessFactor;

  const output = buildGlb(document, binary);
  const path = resolve(projectRoot, outputPath);
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, output);
  await rename(temporaryPath, path);
  console.log(`Created ${outputPath} with matte stone relief.`);
}

const firstPath = resolve(projectRoot, models[0].source);
const { document: firstDocument, binary: firstBinary } = readGlb(
  await readFile(firstPath),
  models[0].source,
);
const normalMap = await makeNormalMap(
  getWildlifeTexture(firstDocument, firstBinary, models[0].source),
);
const normalMapPath = resolve(projectRoot, "public/3d/products", normalMapUri);
const temporaryMapPath = `${normalMapPath}.tmp`;
await writeFile(temporaryMapPath, normalMap);
await rename(temporaryMapPath, normalMapPath);

for (const { source, output } of models) {
  await addNormalMap(source, output, normalMap);
}
