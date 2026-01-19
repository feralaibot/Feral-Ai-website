// Solana web3 bindings from the UMD bundle
const { Connection, PublicKey } = solanaWeb3;

// Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

// RPC setup — Helius with provided API key
const RPC_URL =
  "https://rpc.helius.xyz/?api-key=be68f57a-8e5b-4ba0-8238-760d80330d35";
const connection = new Connection(RPC_URL, "confirmed");
console.log("Using Solana RPC:", RPC_URL);

// DOM elements
const walletInput = document.getElementById("walletInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const errorEl = document.getElementById("error");
const resultsEl = document.getElementById("results");

/** Clear displayed error */
function clearError() {
  errorEl.textContent = "";
  errorEl.classList.remove("error");
}

/** Set displayed error */
function setError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add("error");
}

/**
 * Build a snapshot of SPL token and NFT holdings.
 * @param {PublicKey} pubkey
 * @returns {Promise<{address:string,tokens:Array<{mint:string,amount:number,decimals:number}>,nfts:Array<{mint:string}>,totalTokenAccounts:number,distinctTokenMints:number,nftCount:number}>}
 */
async function buildWalletSnapshot(pubkey) {
  let resp;

  try {
    resp = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    });
  } catch (err) {
    const msg = err?.message || String(err);
    throw new Error(
      "RPC error in getParsedTokenAccountsByOwner: " + msg
    );
  }

  if (!resp || !Array.isArray(resp.value)) {
    return {
      address: pubkey.toBaseBase58(),
      tokens: [],
      nfts: [],
      totalTokenAccounts: 0,
      distinctTokenMints: 0,
      nftCount: 0,
    };
  }

  const tokens = [];
  const nfts = [];

  for (const { account } of resp.value) {
    const info = account?.data?.parsed?.info;
    const tokenAmount = info?.tokenAmount;
    if (!tokenAmount) continue;

    const decimals = Number(tokenAmount.decimals);
    const uiAmount = Number(
      tokenAmount.uiAmountString ?? tokenAmount.uiAmount ?? 0
    );
    const mint = info.mint;

    if (decimals === 0 && uiAmount === 1) {
      // NFT
      nfts.push({ mint });
    } else if (decimals > 0 && uiAmount > 0) {
      // Fungible token
      tokens.push({ mint, amount: uiAmount, decimals });
    }
  }

  const distinctTokenMints = new Set(tokens.map((t) => t.mint)).size;
  const nftCount = nfts.length;

  return {
    address: pubkey.toBase58(),
    tokens,
    nfts,
    totalTokenAccounts: resp.value.length,
    distinctTokenMints,
    nftCount,
  };
}

/**
 * Rate wallet metrics.
 * @param {ReturnType<typeof buildWalletSnapshot>} snapshot
 */
function rateWallet(snapshot) {
  const tokenDiversity = Math.min(
    snapshot.distinctTokenMints * 5,
    40
  );
  const totalFungibleAmount = snapshot.tokens.reduce(
    (sum, t) => sum + (Number(t.amount) || 0),
    0
  );
  const sizeScore = Math.min(totalFungibleAmount, 30);
  const nftScore = Math.min(snapshot.nftCount * 5, 30);

  const rawScore = Math.max(
    0,
    Math.min(tokenDiversity + nftScore + sizeScore, 100)
  );

  let grade = "D";
  if (rawScore >= 90) grade = "S";
  else if (rawScore >= 75) grade = "A";
  else if (rawScore >= 60) grade = "B";
  else if (rawScore >= 40) grade = "C";

  let holderType = "Casual Holder";
  if (rawScore >= 90) holderType = "God-Tier Whale";
  else if (rawScore >= 75) holderType = "Whale / Power User";
  else if (rawScore >= 60) holderType = "Degen Collector";
  else if (rawScore >= 40) holderType = "Active Holder";

  return {
    tokenDiversity,
    nftScore,
    sizeScore,
    rawScore,
    grade,
    holderType,
  };
}

/**
 * Render results into the DOM.
 * @param {ReturnType<typeof buildWalletSnapshot>} snapshot
 * @param {ReturnType<typeof rateWallet>} rating
 */
function renderResults(snapshot, rating) {
  if (snapshot.totalTokenAccounts === 0) {
    resultsEl.innerHTML = `<p class="empty">No SPL tokens or NFTs detected for this wallet.</p>`;
    return;
  }

  resultsEl.innerHTML = `
    <div class="grid">
      <div class="metric">
        <h3>Wallet</h3>
        <div class="value" style="font-size:15px;word-break:break-all;">${
          snapshot.address
        }</div>
      </div>
      <div class="metric">
        <h3>Total Token Accounts</h3>
        <div class="value">${snapshot.totalTokenAccounts}</div>
      </div>
      <div class="metric">
        <h3>Distinct Token Mints</h3>
        <div class="value">${snapshot.distinctTokenMints}</div>
      </div>
      <div class="metric">
        <h3>NFT Count</h3>
        <div class="value">${snapshot.nftCount}</div>
      </div>
      <div class="metric">
        <h3>Token Diversity</h3>
        <div class="value">${rating.tokenDiversity.toFixed(1)}</div>
      </div>
      <div class="metric">
        <h3>NFT Score</h3>
        <div class="value">${rating.nftScore.toFixed(1)}</div>
      </div>
      <div class="metric">
        <h3>Size Score</h3>
        <div class="value">${rating.sizeScore.toFixed(1)}</div>
      </div>
      <div class="metric">
        <h3>Overall Score</h3>
        <div class="value">${rating.rawScore.toFixed(1)}</div>
      </div>
      <div class="metric">
        <h3>Grade</h3>
        <div class="value badge">${rating.grade}</div>
      </div>
      <div class="metric">
        <h3>Holder Type</h3>
        <div class="value">${rating.holderType}</div>
      </div>
    </div>
  `;
}

async function handleAnalyze() {
  clearError();
  resultsEl.innerHTML = "";

  const address = walletInput.value.trim();
  if (!address) {
    setError("Invalid Solana address.");
    return;
  }

  let pubkey;
  try {
    pubkey = new PublicKey(address);
  } catch (err) {
    setError("Invalid Solana address.");
    return;
  }

  analyzeBtn.disabled = true;
  resultsEl.innerHTML = `<p class="empty">Analyzing wallet…</p>`;

  try {
    const snapshot = await buildWalletSnapshot(pubkey);
    const rating = rateWallet(snapshot);
    renderResults(snapshot, rating);
  } catch (err) {
    console.error(err);
    const msg = err?.message ? ` Details: ${err.message}` : "";
    setError(
      `Failed to fetch wallet data.${msg} Try a different address or check your connection.`
    );
    resultsEl.innerHTML = "";
  } finally {
    analyzeBtn.disabled = false;
  }
}

analyzeBtn.addEventListener("click", handleAnalyze);
walletInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleAnalyze();
  }
});
