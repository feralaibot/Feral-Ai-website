import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { checkHoldings, fetchAllowedAssets, fetchWalletReputation, verifySignature } from "./solana";
import {
  createSession,
  extractNonceFromMessage,
  issueNonce,
  messageMatchesPublicKey,
  consumeNonce,
  requireVerifiedWallet,
} from "./auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Seed data on startup
  await storage.seedData();

  app.get(api.tools.list.path, async (req, res) => {
    const tools = await storage.getTools();
    res.json(tools);
  });

  app.get(api.lore.list.path, async (req, res) => {
    const lore = await storage.getLore();
    res.json(lore);
  });

  app.get(api.wallet.nonce.path, async (req, res) => {
    const publicKey = api.wallet.nonce.query.parse(req.query).publicKey;
    const payload = issueNonce(publicKey);
    res.json(payload);
  });

  app.post(api.wallet.verify.path, async (req, res) => {
    const body = api.wallet.verify.body.parse(req.body);

    if (!messageMatchesPublicKey(body.message, body.publicKey)) {
      res.status(400).json({ message: "Signature message does not match wallet." });
      return;
    }

    const nonce = extractNonceFromMessage(body.message);
    if (!nonce || !consumeNonce(body.publicKey, nonce)) {
      res.status(400).json({ message: "Nonce is invalid or expired." });
      return;
    }

    const isValid = verifySignature(body.publicKey, body.message, body.signature);
    if (!isValid) {
      res.status(401).json({ message: "Signature verification failed" });
      return;
    }

    const verification = await checkHoldings(body.publicKey);
    const session = createSession(body.publicKey, req);
    res.json({ ...verification, session });
  });

  app.get(api.wallet.assets.path, requireVerifiedWallet, async (req, res) => {
    const publicKey = api.wallet.assets.query.parse(req.query).publicKey;
    if (req.verifiedWallet?.publicKey !== publicKey) {
      res.status(403).json({ message: "Wallet mismatch." });
      return;
    }
    const assets = await fetchAllowedAssets(publicKey);
    res.json(assets);
  });

  app.get(api.wallet.scan.path, requireVerifiedWallet, async (req, res) => {
    const publicKey = api.wallet.scan.query.parse(req.query).publicKey;
    if (req.verifiedWallet?.publicKey !== publicKey) {
      res.status(403).json({ message: "Wallet mismatch." });
      return;
    }
    const payload = await fetchWalletReputation(publicKey);
    res.json(payload);
  });

  return httpServer;
}
