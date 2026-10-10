
import {
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

import { solanaConnection } from "./solanaconfig";

// Detect Phantom Solana provider
export function getPhantomSolanaProvider() {
  const provider = window.phantom?.solana;

  if (!provider?.isPhantom) {
    throw new Error(
      "Phantom's Solana provider is not available. Unlock Phantom and enable Solana."
    );
  }

  return provider;
}

// Fetch live SOL balance
export async function getSolBalance(address) {
  if (!address) {
    throw new Error("Solana address is missing.");
  }

  const publicKey = new PublicKey(address);

  const lamports = await solanaConnection.getBalance(
    publicKey,
    "confirmed"
  );

  return lamports / LAMPORTS_PER_SOL;
}

// Connect Phantom to Solana
export async function connectPhantomSolana() {
  const provider = getPhantomSolanaProvider();

  const response = await provider.connect();

  const address = (
    response.publicKey || provider.publicKey
  )?.toBase58();

  if (!address) {
    throw new Error(
      "Phantom did not return a Solana address."
    );
  }

  const balance = await getSolBalance(address);

  return {
    provider,
    address,
    balance,
  };
}
