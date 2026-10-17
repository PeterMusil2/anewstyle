/**
 * Generate tangent-space normal maps for the seven product stone textures
 * without an existing relief map, then write matte GLB variants for both
 * model orientations. Run with `bun run models:product-relief`.
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const products = [
  { slug: "PINK", model: "Rockfoil_PINK_3D" },
  { slug: "GOLDENBARK", model: "Rockfoil_GOLDENBARK_3D" },
  { slug: "DARKGOLD", model: "Rockfoil_DARKGOLD_3D" },
  { slug: "GOLDENSUN", model: "Rockfoil_GOLDENSUN_3D" },
  { slug: "BRIGHTGREY", model: "Rockfoil_BRIGHTGREY_3D" },
  { slug: "SAFARI", model: "Rockfoil_SAFARI_3D" },
  { slug: "RUSTY", model: "Rockfoil_RUSTY_3D" },
];
const normalMapWidth = 512;
const fineBlurRadius = 1.2;
const broadBlurRadius = 8;
const normalStrength = 6.5;
const materialNormalScale = 1.35;
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

function getEmbeddedImage(document, binary, imageIndex, path) {
  const image = document.images[imageIndex];
  const imageView = document.bufferViews[image?.bufferView];
  if (!imageView || imageView.buffer !== 0) {
    throw new Error(`Could not locate embedded stone texture ${image?.name ?? imageIndex} in ${path}.`);
  }

  const imageOffset = imageView.byteOffset ?? 0;
  return binary.subarray(imageOffset, imageOffset + imageView.byteLength);
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
  const blurred = await sharp(sourceImage)
    .resize(resize)
    .greyscale()
    .blur(broadBlurRadius)
    .raw()
    .toBuffer();

  if (info.channels !== 1) {
    throw new Error(`Expected a grayscale texture, received ${info.channels} channels.`);
  }

  // Remove broad color shifts so only small stone details create relief.
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

function getTexturedMaterials(document, path) {
  const materials = document.materials.filter(
    (material) => material.pbrMetallicRoughness?.baseColorTexture,
  );
  if (materials.length === 0) {
    throw new Error(`Could not find textured stone materials in ${path}.`);
  }
  return materials;
}

async function writeOutput(outputPath, document, binary) {
  const path = resolve(projectRoot, outputPath);
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, buildGlb(document, binary));
  await rename(temporaryPath, path);
  console.log(`Created ${outputPath} with matte stone relief.`);
}

for (const { slug, model } of products) {
  const sourcePath = `public/3d/products/${model}.glb`;
  const sourceInput = await readFile(resolve(projectRoot, sourcePath));
  const { document: sourceDocument, binary: sourceBinary } = readGlb(sourceInput, sourcePath);
  const texturedMaterials = getTexturedMaterials(sourceDocument, sourcePath);
  const normalMaps = new Map();

  for (const material of texturedMaterials) {
    const textureIndex = material.pbrMetallicRoughness.baseColorTexture.index;
    const imageIndex = sourceDocument.textures[textureIndex]?.source;
    const image = sourceDocument.images[imageIndex];
    if (!image) throw new Error(`Could not find the base texture for ${material.name} in ${sourcePath}.`);
    if (normalMaps.has(imageIndex)) continue;

    const imageLabel = (image.name ?? `texture_${imageIndex}`)
      .replace(/^Rockfoil_/, "")
      .replace(/_light$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_");
    const mapLabel = texturedMaterials.length === 1 ? slug : `${slug}_${imageLabel}`;
    const uri = `${mapLabel}_surface_normal_v2.png`;
    const map = await makeNormalMap(
      getEmbeddedImage(sourceDocument, sourceBinary, imageIndex, sourcePath),
    );
    const mapPath = resolve(projectRoot, "public/3d/products", uri);
    const temporaryMapPath = `${mapPath}.tmp`;
    await writeFile(temporaryMapPath, map);
    await rename(temporaryMapPath, mapPath);
    normalMaps.set(imageIndex, { uri, name: `${material.name} surface relief` });
  }

  for (const orientation of ["", "_vertical"]) {
    const source = `public/3d/products/${model}${orientation}.glb`;
    const output = `public/3d/products/${model}${orientation}_relief_matte_v2.glb`;
    const input = await readFile(resolve(projectRoot, source));
    const { document, binary } = readGlb(input, source);

    for (const material of getTexturedMaterials(document, source)) {
      if (material.normalTexture) {
        throw new Error(`The source model already has a normal map: ${source}.`);
      }
      const baseTextureIndex = material.pbrMetallicRoughness.baseColorTexture.index;
      const baseTexture = document.textures[baseTextureIndex];
      const baseImage = document.images[baseTexture?.source];
      const imageIndex = sourceDocument.images.findIndex(
        (sourceImage) => sourceImage.name === baseImage?.name,
      );
      const normalMap = normalMaps.get(imageIndex);
      if (!normalMap) {
        throw new Error(`Could not match the stone texture for ${material.name} in ${source}.`);
      }

      const reliefImageIndex = document.images.length;
      document.images.push({ uri: normalMap.uri, name: normalMap.name });
      const reliefTextureIndex = document.textures.length;
      document.textures.push({
        ...(baseTexture.sampler !== undefined ? { sampler: baseTexture.sampler } : {}),
        source: reliefImageIndex,
        name: normalMap.name,
      });
      material.normalTexture = { index: reliefTextureIndex, scale: materialNormalScale };
      material.pbrMetallicRoughness.roughnessFactor = materialRoughnessFactor;
    }

    await writeOutput(output, document, binary);
  }
}
