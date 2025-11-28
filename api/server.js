import express from 'express';
import cors from 'cors';
import JSZip from 'jszip';
import sharp from 'sharp';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// Raise body limit to handle larger base64 zips from the generator UI.
app.use(express.json({ limit: '200mb' }));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'FERAL generator API is alive. POST /generate to use it.' });
});

function layerSortKey(name) {
  const match = /^\s*(\d+)/.exec(name);
  if (match) return [parseInt(match[1], 10), name];
  return [Number.MAX_SAFE_INTEGER, name];
}

function pickWeighted(items) {
  const total = items.reduce((sum, item) => sum + (item.weight || 0), 0);
  if (total <= 0) return items[0];
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight || 0;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

async function parseLayersFromZip(base64Zip, weights = {}) {
  const zip = new JSZip();
  const buf = Buffer.from(base64Zip, 'base64');
  const loaded = await zip.loadAsync(buf);
  const entries = Object.values(loaded.files).filter(
    (e) => !e.dir && /\.(png|jpg|jpeg|webp)$/i.test(e.name)
  );
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const layersMap = new Map();
  for (const entry of entries) {
    const clean = entry.name.replace(/^\/?/, '');
    const parts = clean.split('/');
    if (parts.length < 2) continue; // need layer/asset
    const layerName = parts[0];
    const assetName = parts.slice(1).join('/');
    const weightMap = weights[layerName] || {};
    const assetWeight = typeof weightMap[assetName] === 'number' ? weightMap[assetName] : 1;
    const buffer = await entry.async('nodebuffer');
    if (!layersMap.has(layerName)) layersMap.set(layerName, []);
    layersMap.get(layerName).push({ name: assetName, buffer, weight: assetWeight });
  }

  // Sort layers by numeric prefix, then name; sort assets by path
  const sortedLayers = Array.from(layersMap.entries()).sort((a, b) => {
    const ka = layerSortKey(a[0]);
    const kb = layerSortKey(b[0]);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    return ka[1].localeCompare(kb[1]);
  });

  return sortedLayers.map(([layerName, assets]) => ({
    layerName,
    assets: assets.sort((a, b) => a.name.localeCompare(b.name))
  }));
}

async function generateImages({ layers, supply, width, height, unique }) {
  const outputs = [];
  const seen = new Set();

  const maxAttempts = supply * 10; // to avoid infinite loops when uniqueness is tight
  let attempts = 0;
  while (outputs.length < supply && attempts < maxAttempts) {
    attempts++;
    const picked = [];
    for (const layer of layers) {
      const choice = pickWeighted(layer.assets);
      picked.push({ layer: layer.layerName, asset: choice });
    }
    const signature = picked.map((p) => `${p.layer}:${p.asset.name}`).join('|');
    if (unique && seen.has(signature)) {
      continue;
    }
    if (unique) seen.add(signature);

    // Build composite
    const base = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    const overlays = [];
    for (const p of picked) {
      const buf = await sharp(p.asset.buffer).resize(width, height).png().toBuffer();
      overlays.push({ input: buf });
    }

    const imageBuffer = await base.composite(overlays).png().toBuffer();
    outputs.push({
      buffer: imageBuffer,
      attributes: picked.map((p) => ({ trait_type: p.layer, value: p.asset.name }))
    });
  }

  if (outputs.length < supply) {
    throw new Error(`Could not generate requested supply with uniqueness=${unique}. Generated ${outputs.length}.`);
  }

  return outputs;
}

app.post('/generate', async (req, res) => {
  try {
    const {
      layersZipBase64,
      supply = 1,
      width = 1024,
      height = 1024,
      namePrefix = 'FERAL',
      symbol = 'FERAL',
      walletAddress = 'WALLET',
      unique = true,
      rules = {},
      weights = {}
    } = req.body || {};

    if (!layersZipBase64 || typeof layersZipBase64 !== 'string') {
      return res.status(400).json({ error: 'layersZipBase64 is required (base64-encoded zip).' });
    }

    if (width <= 0 || height <= 0) {
      return res.status(400).json({ error: 'width and height must be positive numbers.' });
    }

    const layers = await parseLayersFromZip(layersZipBase64, weights || {});
    if (!layers.length) {
      return res.status(400).json({ error: 'No valid layers found in zip. Ensure files are under layer folders.' });
    }

    const images = await generateImages({ layers, supply: Number(supply), width: Number(width), height: Number(height), unique });

    const zipOut = new JSZip();
    images.forEach((img, idx) => {
      const id = idx + 1;
      zipOut.file(`images/${id}.png`, img.buffer);
      const metadata = {
        name: `${namePrefix} #${id}`,
        symbol,
        description: `${namePrefix} generated asset`,
        image: `images/${id}.png`,
        attributes: img.attributes,
        wallet: walletAddress,
        rules
      };
      zipOut.file(`metadata/${id}.json`, JSON.stringify(metadata, null, 2));
    });

    const zipBuffer = await zipOut.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="feral-nfts.zip"');
    res.setHeader('x-minted', images.length);
    res.status(200).send(zipBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Generation failed.' });
  }
});

app.listen(port, () => {
  console.log(`FERAL generator API listening on port ${port}`);
});
