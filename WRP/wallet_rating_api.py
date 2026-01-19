"""Wallet Recognition Protocol - Layer 1 API and CLI.

This module defines wallet data models, metrics, a rating engine, and exposes a
minimal HTTP API (stdlib-only) to score wallets. Run `python wallet_rating_api.py
serve` to start the API with an in-browser form at `/`, or `python wallet_rating_api.py
demo` to view sample ratings in the console.
"""

from __future__ import annotations

import argparse
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, HTTPServer
from math import log10
from typing import Dict, Iterable, List, Tuple


# Minimal HTML UI served at GET / for quick manual testing (Solana defaults).
HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wallet Recognition Protocol - Layer 1</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0b1224; color: #e9eef7; margin: 0; padding: 0; }
    header { padding: 20px; background: linear-gradient(135deg, #12284a, #0b1224); }
    h1 { margin: 0; font-size: 22px; letter-spacing: 0.5px; }
    main { padding: 20px; max-width: 960px; margin: 0 auto; }
    label { display: block; margin: 12px 0 6px; font-weight: bold; }
    input, textarea, select { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #1f2d52; background: #0e1830; color: #e9eef7; font-family: monospace; }
    textarea { min-height: 120px; }
    button { margin-top: 16px; padding: 12px 16px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
    button:hover { background: #2563eb; }
    .card { background: #0f1a33; border: 1px solid #1f2d52; border-radius: 10px; padding: 16px 18px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
    pre { background: #0b1224; border: 1px solid #1f2d52; border-radius: 8px; padding: 12px; overflow-x: auto; }
    .error { color: #fca5a5; font-weight: bold; }
  </style>
</head>
<body>
  <header>
    <h1>Wallet Recognition Protocol — Layer 1 (Solana-first)</h1>
    <p>Paste wallet data, score locally via this server (POST /score).</p>
  </header>
  <main>
    <div class="card">
      <form id="score-form">
        <div class="row">
          <div>
            <label for="address">Wallet Address</label>
            <input id="address" name="address" value="4Nd1mY7R5..." required />
          </div>
          <div>
            <label for="chain">Chain</label>
            <select id="chain" name="chain">
              <option value="Solana" selected>Solana</option>
              <option value="Ethereum">Ethereum</option>
              <option value="Polygon">Polygon</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div class="row">
          <div>
            <label for="last_active">Last Active (days ago)</label>
            <input id="last_active" name="last_active" type="number" value="3" min="0" />
          </div>
          <div>
            <label for="tx_count">Total Tx Count</label>
            <input id="tx_count" name="tx_count" type="number" value="120" min="0" />
          </div>
        </div>
        <label for="tokens">Tokens (JSON array)</label>
        <textarea id="tokens">[
  { "symbol": "SOL", "amount": 12.5, "usd_value": 2600 },
  { "symbol": "USDC", "amount": 500, "usd_value": 500 },
  { "symbol": "BONK", "amount": 1500000, "usd_value": 800 }
]</textarea>
        <label for="nfts">NFTs (JSON array)</label>
        <textarea id="nfts">[
  { "collection": "Degods", "token_id": "5", "estimated_value_usd": 2500 },
  { "collection": "OkayBears", "token_id": "42", "estimated_value_usd": 320 }
]</textarea>
        <button type="submit">Score Wallet</button>
      </form>
      <div id="status" class="error" style="margin-top:10px;"></div>
      <h3>Response</h3>
      <pre id="response">Submit the form to see results.</pre>
    </div>
  </main>
  <script>
    const form = document.getElementById('score-form');
    const statusEl = document.getElementById('status');
    const responseEl = document.getElementById('response');

    function parseJsonField(id) {
      const raw = document.getElementById(id).value.trim();
      if (!raw) { return []; }
      try { return JSON.parse(raw); }
      catch (err) { throw new Error(`Invalid JSON in ${id}: ${err.message}`); }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.textContent = '';
      responseEl.textContent = 'Loading...';
      try {
        const payload = {
          address: document.getElementById('address').value.trim(),
          chain: document.getElementById('chain').value,
          last_active_days_ago: Number(document.getElementById('last_active').value) || 0,
          total_tx_count: Number(document.getElementById('tx_count').value) || 0,
          tokens: parseJsonField('tokens'),
          nfts: parseJsonField('nfts'),
        };
        const res = await fetch('/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) {
          statusEl.textContent = body.error || 'Request failed';
          responseEl.textContent = JSON.stringify(body, null, 2);
          return;
        }
        responseEl.textContent = JSON.stringify(body, null, 2);
      } catch (err) {
        statusEl.textContent = err.message;
        responseEl.textContent = 'Error';
      }
    });
  </script>
</body>
</html>
"""
# -------------------------------
# Data Models
# -------------------------------

@dataclass(slots=True)
class TokenHolding:
    symbol: str
    amount: float
    usd_value: float


@dataclass(slots=True)
class NftHolding:
    collection: str
    token_id: str
    estimated_value_usd: float


@dataclass(slots=True)
class WalletSnapshot:
    address: str
    chain: str
    tokens: List[TokenHolding] = field(default_factory=list)
    nfts: List[NftHolding] = field(default_factory=list)
    last_active_days_ago: int = 0
    total_tx_count: int = 0

    @property
    def total_token_value(self) -> float:
        return sum(t.usd_value for t in self.tokens)

    @property
    def total_nft_value(self) -> float:
        return sum(n.estimated_value_usd for n in self.nfts)

    @property
    def total_portfolio_value(self) -> float:
        return self.total_token_value + self.total_nft_value

    @property
    def distinct_token_symbols(self) -> int:
        return len({t.symbol.upper() for t in self.tokens})

    @property
    def distinct_nft_collections(self) -> int:
        return len({n.collection.lower() for n in self.nfts})


# -------------------------------
# Metric System
# -------------------------------

class Metric(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @abstractmethod
    def evaluate(self, wallet: WalletSnapshot) -> float:
        ...


class TotalUsdValueMetric(Metric):
    """Scores by log-scaled total USD value to avoid runaway dominance."""

    def __init__(self, multiplier: float = 10.0) -> None:
        self.multiplier = multiplier

    @property
    def name(self) -> str:
        return "total_usd_value"

    def evaluate(self, wallet: WalletSnapshot) -> float:
        return log10(1 + max(wallet.total_portfolio_value, 0)) * self.multiplier


class TokenDiversityMetric(Metric):
    def __init__(self, per_token_score: float = 5.0, cap: float = 50.0) -> None:
        self.per_token_score = per_token_score
        self.cap = cap

    @property
    def name(self) -> str:
        return "token_diversity"

    def evaluate(self, wallet: WalletSnapshot) -> float:
        score = wallet.distinct_token_symbols * self.per_token_score
        return min(score, self.cap)


class NftDiversityMetric(Metric):
    def __init__(self, per_collection_score: float = 8.0, cap: float = 60.0) -> None:
        self.per_collection_score = per_collection_score
        self.cap = cap

    @property
    def name(self) -> str:
        return "nft_diversity"

    def evaluate(self, wallet: WalletSnapshot) -> float:
        score = wallet.distinct_nft_collections * self.per_collection_score
        return min(score, self.cap)


class ActivityRecencyMetric(Metric):
    """Higher score for recent activity; falls off with days inactive."""

    def __init__(self, max_score: float = 50.0, half_life_days: float = 14.0) -> None:
        self.max_score = max_score
        self.half_life_days = half_life_days

    @property
    def name(self) -> str:
        return "activity_recency"

    def evaluate(self, wallet: WalletSnapshot) -> float:
        days = max(wallet.last_active_days_ago, 0)
        decay_factor = 0.5 ** (days / self.half_life_days)
        return self.max_score * decay_factor


# -------------------------------
# Rating Engine
# -------------------------------

class WalletRatingEngine:
    def __init__(self, metrics: Iterable[Metric], weights: Dict[str, float] | None = None) -> None:
        self.metrics: List[Metric] = list(metrics)
        self.weights: Dict[str, float] = weights or {
            "total_usd_value": 1.0,
            "token_diversity": 0.8,
            "nft_diversity": 0.8,
            "activity_recency": 1.0,
        }

    def compute_metric_scores(self, wallet: WalletSnapshot) -> Dict[str, float]:
        return {metric.name: metric.evaluate(wallet) for metric in self.metrics}

    def compute_raw_score(self, metric_scores: Dict[str, float]) -> float:
        weighted_sum = 0.0
        weight_total = 0.0
        for name, score in metric_scores.items():
            weight = self.weights.get(name, 1.0)
            weighted_sum += score * weight
            weight_total += weight
        return weighted_sum / weight_total if weight_total else 0.0

    def grade(self, raw_score: float) -> str:
        if raw_score >= 75:
            return "S"
        if raw_score >= 55:
            return "A"
        if raw_score >= 35:
            return "B"
        if raw_score >= 20:
            return "C"
        return "D"

    def score_wallet(self, wallet: WalletSnapshot) -> Dict[str, float]:
        metric_scores = self.compute_metric_scores(wallet)
        raw = self.compute_raw_score(metric_scores)
        metric_scores["__raw__"] = raw
        metric_scores["__grade__"] = self.grade(raw)
        return metric_scores


# -------------------------------
# Helpers: parsing & samples
# -------------------------------

def wallet_from_dict(payload: Dict) -> WalletSnapshot:
    try:
        tokens = [
            TokenHolding(
                symbol=str(t["symbol"]),
                amount=float(t.get("amount", 0)),
                usd_value=float(t.get("usd_value", 0)),
            )
            for t in payload.get("tokens", [])
        ]
        nfts = [
            NftHolding(
                collection=str(n["collection"]),
                token_id=str(n["token_id"]),
                estimated_value_usd=float(n.get("estimated_value_usd", 0)),
            )
            for n in payload.get("nfts", [])
        ]
        return WalletSnapshot(
            address=str(payload["address"]),
            chain=str(payload.get("chain", "Solana")),
            tokens=tokens,
            nfts=nfts,
            last_active_days_ago=int(payload.get("last_active_days_ago", 0)),
            total_tx_count=int(payload.get("total_tx_count", 0)),
        )
    except (KeyError, TypeError, ValueError) as exc:  # narrow errors to signal bad payloads
        raise ValueError(f"Invalid wallet payload: {exc}") from exc


def build_sample_wallets() -> List[WalletSnapshot]:
    return [
        WalletSnapshot(
            address="So1anaDemo1111111111111111111111111111111",
            chain="Solana",
            tokens=[
                TokenHolding("SOL", 10, 2200.0),
                TokenHolding("USDT", 1000, 1000.0),
                TokenHolding("BONK", 1_000_000, 500.0),
                TokenHolding("JTO", 700, 900.0),
            ],
            nfts=[
                NftHolding("Degods", "5", 2500.0),
                NftHolding("TaiyoRobots", "42", 600.0),
                NftHolding("OkayBears", "300", 300.0),
                NftHolding("Tensorian", "1", 1500.0),
            ],
            last_active_days_ago=7,
            total_tx_count=520,
        ),
        WalletSnapshot(
            address="0xAAA111",
            chain="Ethereum",
            tokens=[
                TokenHolding("ETH", 2.5, 4500.0),
                TokenHolding("USDC", 3000, 3000.0),
                TokenHolding("OP", 1500, 2500.0),
            ],
            nfts=[
                NftHolding("CoolCats", "1234", 1200.0),
                NftHolding("CoolCats", "5678", 800.0),
                NftHolding("Nouns", "77", 9000.0),
            ],
            last_active_days_ago=2,
            total_tx_count=420,
        ),
        WalletSnapshot(
            address="0xBBB222",
            chain="Polygon",
            tokens=[
                TokenHolding("MATIC", 5000, 3500.0),
                TokenHolding("USDC", 2000, 2000.0),
            ],
            nfts=[
                NftHolding("PolygonPunks", "88", 150.0),
            ],
            last_active_days_ago=30,
            total_tx_count=180,
        ),
        WalletSnapshot(
            address="0xDDD444",
            chain="Ethereum",
            tokens=[
                TokenHolding("ETH", 0.4, 720.0),
            ],
            nfts=[],
            last_active_days_ago=90,
            total_tx_count=12,
        ),
    ]


def build_engine() -> WalletRatingEngine:
    metrics: List[Metric] = [
        TotalUsdValueMetric(),
        TokenDiversityMetric(),
        NftDiversityMetric(),
        ActivityRecencyMetric(),
    ]
    return WalletRatingEngine(metrics=metrics)


# -------------------------------
# HTTP API (stdlib-only)
# -------------------------------

class WalletRequestHandler(BaseHTTPRequestHandler):
    engine: WalletRatingEngine  # injected on creation

    def _json_response(self, status_code: int, payload: Dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html_response(self, status_code: int, body: str) -> None:
        encoded = body.encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _parse_json(self) -> Dict:
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b""
        if not raw:
            raise ValueError("Empty body")
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON: {exc}") from exc

    def do_GET(self) -> None:  # noqa: N802 (stdlib handler signature)
        if self.path == "/":
            self._html_response(200, HTML_PAGE)
            return
        if self.path == "/health":
            self._json_response(200, {"status": "ok"})
            return
        self._json_response(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/score":
            self._json_response(404, {"error": "not found"})
            return
        try:
            payload = self._parse_json()
            wallet = wallet_from_dict(payload)
            scores = self.engine.score_wallet(wallet)
            self._json_response(200, {"address": wallet.address, "scores": scores})
        except ValueError as exc:
            self._json_response(400, {"error": str(exc)})
        except Exception as exc:  # pragma: no cover - unexpected errors
            self._json_response(500, {"error": f"internal error: {exc}"})


# -------------------------------
# CLI Entrypoints
# -------------------------------

def run_demo(engine: WalletRatingEngine) -> None:
    wallets = build_sample_wallets()
    print("Wallet Recognition Protocol — Layer 1 Ratings (demo)")
    print("=" * 60)
    for wallet in wallets:
        scores = engine.score_wallet(wallet)
        print(render_scores(wallet, scores))
        print("-" * 60)


def render_scores(wallet: WalletSnapshot, scores: Dict[str, float]) -> str:
    lines = [
        f"Wallet {wallet.address} ({wallet.chain})",
        "  Metrics:",
    ]
    for name, value in scores.items():
        if name.startswith("__"):
            continue
        lines.append(f"    - {name}: {value:.2f}")
    lines.append(f"  Raw Score: {scores['__raw__']:.2f}")
    lines.append(f"  Grade: {scores['__grade__']}")
    return "\n".join(lines)


def serve(engine: WalletRatingEngine, host: str = "127.0.0.1", port: int = 8000) -> None:
    handler_cls = type(
        "InjectedWalletHandler",
        (WalletRequestHandler,),
        {"engine": engine},
    )
    server = HTTPServer((host, port), handler_cls)
    print(f"Serving Wallet Recognition API on http://{host}:{port} (POST /score, GET /health)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()


def parse_args(argv: List[str] | None = None) -> Tuple[str, argparse.Namespace]:
    parser = argparse.ArgumentParser(description="Wallet Recognition Protocol Layer 1")
    sub = parser.add_subparsers(dest="cmd", required=False)

    demo_p = sub.add_parser("demo", help="Run demo scoring for sample wallets (default)")
    demo_p.set_defaults(cmd="demo")

    serve_p = sub.add_parser("serve", help="Start HTTP API server")
    serve_p.add_argument("--host", default="127.0.0.1", help="Host to bind (default: 127.0.0.1)")
    serve_p.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")

    args = parser.parse_args(argv)
    cmd = args.cmd or "demo"
    return cmd, args


def main(argv: List[str] | None = None) -> None:
    cmd, args = parse_args(argv)
    engine = build_engine()

    if cmd == "serve":
        serve(engine, host=args.host, port=args.port)
    else:
        run_demo(engine)


if __name__ == "__main__":
    main()
