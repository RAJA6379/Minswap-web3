
import {
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";

// Solana Devnet configuration
export const SOLANA_CLUSTER = "devnet";

export const SOLANA_RPC_URL = clusterApiUrl(
  SOLANA_CLUSTER
);

export const solanaConnection = new Connection(
  SOLANA_RPC_URL,
  "confirmed"
);
