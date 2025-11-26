import express from 'express';
import cors from 'cors';
import JSZip from 'jszip';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'FERAL generator API is alive. POST /generate to use it.' });
});

app.post('/generate', async (req, res) => {
  try {
    const {
      layersZipBase64,
      supply,
      width,
      height,
      namePrefix,
      symbol,
      walletAddress,
      unique,
      rules
    } = req.body || {};

    if (!layersZipBase64 || typeof layersZipBase64 !== 'string') {
      return res.status(400).json({ error: 'layersZipBase64 is required (base64-encoded zip).' });
    }

    // TODO: replace this placeholder with your real generation logic.
    // For now we validate the zip payload and return a stub archive so the front-end flow works.
    const inputBuffer = Buffer.from(layersZipBase64, 'base64');
    const zipIn = new JSZip();
    await zipIn.loadAsync(inputBuffer);

    const zipOut = new JSZip();
    zipOut.file('README.txt', 'Replace this with real generated outputs.');
    zipOut.file(
      'request.json',
      JSON.stringify({ supply, width, height, namePrefix, symbol, walletAddress, unique, rules }, null, 2)
    );
    zipOut.file('echo/original.zip', inputBuffer);

    const zipBuffer = await zipOut.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="feral-nfts.zip"');
    res.setHeader('x-minted', supply || 0);
    res.status(200).send(zipBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Generation failed.' });
  }
});

app.listen(port, () => {
  console.log(`FERAL generator API listening on port ${port}`);
});
