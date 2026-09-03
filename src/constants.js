export const PROCESSORS_URL = "https://tapeout.net/processors.json";

export const RELEASE = "2026-08-24-multiperiod-activity-r1";
// Protocol-wide metrics use TapeOut Day 1: the public launch window spanning
// the prior Saturday night / Sunday morning in Asia/Shanghai, when the
// protocol-level Registry starts from zero. D1 began collecting continuous
// monitor snapshots on 2026-08-19; that is an observation boundary only.
export const PROTOCOL_TIME_BASIS = Object.freeze({
  protocol_start: "TapeOut Day 1 public launch window (Saturday night / Sunday morning, Asia/Shanghai)",
  baseline: "Protocol-level Registry metrics are interpreted from the Day 1 zero state.",
  monitor_history_start: "2026-08-19T07:22:18Z",
  monitor_history_boundary: "D1 history begins on this timestamp and is not the protocol statistical start."
});
export const HOME_URL = "https://tapeout.net/";
// SHA-256 hashes of processor addresses to exclude from public results.
// Currently empty: every processor in the public Registry is shown as-is.
export const PROTECTED_PROCESSOR_HASHES = new Set();
export const OFFICIAL_PROCESSOR_URL = address => `https://tapeout.net/#p/${address}`;
export const OFFICIAL_SITE_URL = "https://tapeout.net/";
export const BSC_CHAIN_ID = 56;
// Production market data is opt-in: configure a dedicated provider URL as the
// Cloudflare secret BSC_LOGS_RPC_URL. Anonymous public RPCs are deliberately
// excluded because they do not provide a dependable eth_getLogs contract.
export const BSC_LOGS_RPC_SECRET = "BSC_LOGS_RPC_URL";
// The holder census replays every Transfer since token genesis, which public
// non-archive nodes refuse ("archive requests require a token"). It therefore
// takes its own, archive-capable provider and stays not_configured until one
// exists; the market scan only ever needs recent windows.
export const BSC_ARCHIVE_RPC_SECRET = "BSC_ARCHIVE_RPC_URL";
export const CIRCUIT_MARKET_ADDRESS = "0x6feebbebc07bcb90bd1ac8b0cf9baa4f0ff2b46f";
export const AIRDROP_ADDRESS = "0x7fd055496b638ad81f58b33fd04d6e90bbc2a672";
export const AIRDROP_GET_DROPS_SELECTOR = "0x9bda24a3"; // getDrops(uint256,uint256), verified against TapeOut public chain config.
export const AIRDROP_OFFICIAL_URL = "https://tapeout.net/#airdrop";

// $BEM Proof of Design: public, read-only sources. Mining, catalog and price
// are deliberately isolated from Registry, Airdrop and optional market paths.
export const BEM_POD_URL = "https://tapeout.net/pod/";
export const BEM_STATS_URL = "https://tapeout.net/pod/pod-stats.json";
export const BEM_TASKBANK_URL = "https://tapeout.net/pod/pod-taskbank.json";
export const BEM_MINERS_URL = "https://tapeout.net/pod/pod-miners.json";
export const BEM_RPC_URL = "https://tapeout.net/rpc";
export const BEM_MINING_ADDRESS = "0x7e2e0dc66a3bd9103e69b766afa62d9f7b697b46";
export const BEM_LENS_ADDRESS = "0xdd20b9537b9f5db9d2a23e6b11ad863cf81930d8";
export const BEM_TOKEN_ADDRESS = "0x5ce033b2bfca3af30b3e8c8457deaf776a8b695a";
export const BEM_PRICE_URL = "https://api.dexscreener.com/latest/dex/tokens/0x5ce033B2bFCa3Af30b3e8C8457DeaF776A8b695a";
export const BEM_PRICE_PAIR_ADDRESS = "0x2f5ec19ab0583d3fcd9bcbcD9AB416d2858EeA38";
export const BEM_PRICE_PAIR_URL = `https://api.dexscreener.com/latest/dex/pairs/bsc/${BEM_PRICE_PAIR_ADDRESS}`;
export const BEM_GECKO_POOL_URL = `https://api.geckoterminal.com/api/v2/networks/bsc/pools/${BEM_PRICE_PAIR_ADDRESS}`;
// Most-recent-300-trades feed for the same verified BEM/USDT pool. Keyless and public.
export const BEM_GECKO_TRADES_URL = `https://api.geckoterminal.com/api/v2/networks/bsc/pools/${BEM_PRICE_PAIR_ADDRESS}/trades`;
// Keyless GeckoTerminal token-pools listing: every BSC pool GeckoTerminal has indexed for
// the BEM token, with its own 24h volume/reserve. Used for periodic pool discovery so the
// tracked-pool set is computed from live data, never a hardcoded list.
export const BEM_GECKO_POOLS_URL = `https://api.geckoterminal.com/api/v2/networks/bsc/tokens/${BEM_TOKEN_ADDRESS}/pools`;
export const bemGeckoPoolTradesUrl = poolId => `https://api.geckoterminal.com/api/v2/networks/bsc/pools/${poolId}/trades`;
// The single pool this monitor originally (and exclusively) tracked before multi-pool
// coverage existed. Used only once, to label pre-existing bem_trades rows collected back
// when this was the only tracked pool; never used to seed or constrain live pool discovery.
export const BEM_LEGACY_POOL_ID = BEM_PRICE_PAIR_ADDRESS.toLowerCase();
export const BEM_LEGACY_POOL_DEX_ID = "pancakeswap-v3-bsc";
export const BEM_LEGACY_POOL_LABEL = "BEM / USDT 0.01%";
export const BEM_PRICE_PROVIDER = "third-party market aggregation";
export const BEM_CHAIN_ID = 56;
export const BEM_DECIMALS = 8n;

// Official three-project asset observation. The public CPU snapshot gives
// holder counts and cumulative mint addresses, while the public market
// snapshot gives currently open bid addresses. Neither source exposes a full
// current per-address balance list, so this domain never relabels minters or
// order participants as current holders.
export const OFFICIAL_THREE_PROJECTS = Object.freeze({
  genesis: { key: "genesis", name: "Genesis CPU", processor_address: "0x50a994e71615474b55559ff4f500928fbc339dd9", transistor_address: "0x1d23bf70ec6baad95f396ea38f8a8415119dfde6" },
  behemoth: { key: "behemoth", name: "Behemoth", processor_address: "0x1f5cb4aeae1807bf60c3b9c0d8adbcc14e91f12c", transistor_address: "0xe2dfd802081c7a05341e20b6582b04b908e8550c" },
  tapeout: { key: "tapeout", name: "TapeOut", processor_address: "0xb1024b89886b9a34aa4ff5f31c411d708b20a14c", transistor_address: "0xcc42ba5de07f01b472a5b14cf45abcca79eb8087" },
});

// NAND/LATCH price candles are derived only from verified public third-party trade records.
// They never inherit the official status of the three underlying processors.
export const OFFICIAL_TRANSISTOR_CANDLE_ASSETS = Object.freeze(Object.values(OFFICIAL_THREE_PROJECTS).flatMap(project => [
  { project_key: project.key, project_name: project.name, asset_key: "nand", symbol: "NAND", token_id: 0, transistor_address: project.transistor_address },
  { project_key: project.key, project_name: project.name, asset_key: "latch", symbol: "LATCH", token_id: 1, transistor_address: project.transistor_address },
]));
