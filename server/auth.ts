import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

type NonceRecord = {
  publicKey: string;
  expiresAt: number;
  used: boolean;
};

type SessionRecord = {
  publicKey: string;
  userAgentHash: string;
  expiresAt: number;
};

const NONCE_TTL_MS = Number.parseInt(process.env.WALLET_NONCE_TTL_MS || "300000", 10);
const SESSION_TTL_MS = Number.parseInt(process.env.WALLET_SESSION_TTL_MS || "900000", 10);

const nonces = new Map<string, NonceRecord>();
const sessions = new Map<string, SessionRecord>();

function hashUserAgent(userAgent: string | undefined) {
  return crypto.createHash("sha256").update(userAgent || "unknown").digest("hex");
}

function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function issueNonce(publicKey: string) {
  const nonce = crypto.randomUUID ? crypto.randomUUID() : generateToken(16);
  const expiresAt = Date.now() + NONCE_TTL_MS;
  nonces.set(nonce, { publicKey, expiresAt, used: false });
  return { nonce, expiresAt };
}

export function consumeNonce(publicKey: string, nonce: string): boolean {
  const record = nonces.get(nonce);
  if (!record) return false;
  if (record.used) return false;
  if (record.publicKey !== publicKey) return false;
  if (record.expiresAt < Date.now()) return false;
  record.used = true;
  nonces.set(nonce, record);
  return true;
}

export function extractNonceFromMessage(message: string): string | null {
  const match = message.match(/Nonce:\s*([A-Za-z0-9-]+)/);
  return match?.[1] || null;
}

export function messageMatchesPublicKey(message: string, publicKey: string): boolean {
  return message.includes(`Address: ${publicKey}`);
}

export function createSession(publicKey: string, req: Request) {
  const token = generateToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const userAgentHash = hashUserAgent(req.headers["user-agent"] as string | undefined);
  sessions.set(token, { publicKey, userAgentHash, expiresAt });
  return { token, expiresAt };
}

export function getSession(token: string | null | undefined, req: Request) {
  if (!token) return null;
  const record = sessions.get(token);
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  const userAgentHash = hashUserAgent(req.headers["user-agent"] as string | undefined);
  if (record.userAgentHash !== userAgentHash) return null;
  return record;
}

export function requireVerifiedWallet(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const session = getSession(token, req);
  if (!session) {
    res.status(401).json({ message: "Wallet session required." });
    return;
  }
  req.verifiedWallet = { publicKey: session.publicKey, token };
  next();
}

declare module "express-serve-static-core" {
  interface Request {
    verifiedWallet?: {
      publicKey: string;
      token: string | null;
    };
  }
}
