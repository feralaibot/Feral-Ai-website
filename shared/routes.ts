import { z } from 'zod';
import { tools, lore } from './schema';

export const errorSchemas = {
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  tools: {
    list: {
      method: 'GET' as const,
      path: '/api/tools',
      responses: {
        200: z.array(z.custom<typeof tools.$inferSelect>()),
      },
    },
  },
  lore: {
    list: {
      method: 'GET' as const,
      path: '/api/lore',
      responses: {
        200: z.array(z.custom<typeof lore.$inferSelect>()),
      },
    },
  },
  wallet: {
    nonce: {
      method: 'GET' as const,
      path: '/api/wallet/nonce',
      query: z.object({
        publicKey: z.string(),
      }),
      responses: {
        200: z.object({
          nonce: z.string(),
          expiresAt: z.number(),
        }),
      },
    },
    verify: {
      method: 'POST' as const,
      path: '/api/wallet/verify',
      body: z.object({
        publicKey: z.string(),
        message: z.string(),
        signature: z.string(),
      }),
      responses: {
        200: z.object({
          holdings: z.object({
            hasNft: z.boolean(),
            hasToken: z.boolean(),
          }),
          requirements: z.object({
            requiresNft: z.boolean(),
            requiresToken: z.boolean(),
          }),
          isEligible: z.boolean(),
          accessTier: z.enum(["none", "standard", "legendary"]),
          session: z.object({
            token: z.string(),
            expiresAt: z.number(),
          }),
        }),
      },
    },
    assets: {
      method: 'GET' as const,
      path: '/api/wallet/assets',
      query: z.object({
        publicKey: z.string(),
      }),
      responses: {
        200: z.object({
          ferals: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              image: z.string().nullable(),
              collection: z.string().nullable(),
            }),
          ),
          milk: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              image: z.string().nullable(),
              collection: z.string().nullable(),
            }),
          ),
        }),
      },
    },
    scan: {
      method: 'GET' as const,
      path: '/api/wallet/scan',
      query: z.object({
        publicKey: z.string(),
      }),
      responses: {
        200: z.object({
          snapshot: z.object({
            address: z.string(),
            tokens: z.array(
              z.object({
                mint: z.string(),
                amount: z.number(),
                decimals: z.number(),
              }),
            ),
            nfts: z.array(
              z.object({
                mint: z.string(),
              }),
            ),
            solBalance: z.number().optional(),
            totalTokenAccounts: z.number(),
            distinctTokenMints: z.number(),
            nftCount: z.number(),
          }),
          reputation: z.object({
            score: z.number(),
            label: z.object({
              id: z.string(),
              label: z.string(),
              meaning: z.string(),
            }),
            metrics: z.object({
              walletAgeDays: z.number(),
              totalTxCount: z.number(),
              activeWeeks: z.number(),
              activityConsistency: z.number(),
              medianHoldDays: z.number().nullable(),
              flipRate: z.number().nullable(),
              allowlistedSourceCount: z.number(),
              uniqueAllowlistedSources: z.number(),
              mintAndDumpCount: z.number(),
              outboundRatio: z.number().nullable(),
            }),
          }),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
