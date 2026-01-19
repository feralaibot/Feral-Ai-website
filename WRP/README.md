# Wallet Recognition Protocol — Layer 1

A self-contained Python 3.10+ app that scores wallets using Layer 1 metrics and exposes:

- HTTP API (`POST /score`, `GET /health`)
- In-browser UI at `/` for pasting Solana-first wallet data
- Console demo for sample wallets

## Requirements
- Python 3.10+
- No external dependencies

## Quick start
```bash
python3 wallet_rating_api.py serve --host 0.0.0.0 --port 8000
# open http://localhost:8000/ in a browser to use the form
```

## API example
```bash
curl -X POST http://localhost:8000/score \
  -H 'Content-Type: application/json' \
  -d '{
    "address": "So1anaDemo1111111111111111111111111111111",
    "chain": "Solana",
    "tokens": [
      {"symbol": "SOL", "amount": 12.5, "usd_value": 2600},
      {"symbol": "USDC", "amount": 500, "usd_value": 500}
    ],
    "nfts": [
      {"collection": "Degods", "token_id": "5", "estimated_value_usd": 2500}
    ],
    "last_active_days_ago": 3,
    "total_tx_count": 120
  }'
```

## Demo mode
```bash
python3 wallet_rating_api.py demo
```

## Notes
- The UI defaults to Solana with sample SOL/BONK/USDC data. Paste an address and tweak balances/NFTs to test.
- On-chain fetching is not included; you need to supply token/NFT balances in the form or POST body.
