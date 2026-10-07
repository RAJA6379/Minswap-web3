 import {
  BrowserProvider,
  Contract,
  formatEther,
  formatUnits,
} from "ethers";

import {
  SEPOLIA_USDC_ADDRESS,
  USDC_DECIMALS,
} from "./config";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
];

export async function connectMetaMask() {
  if (!window.ethereum) {
    throw new Error(
      "MetaMask is not installed. Please install the MetaMask browser extension."
    );
  }

  const provider = new BrowserProvider(window.ethereum);

  const accounts = await provider.send(
    "eth_requestAccounts",
    []
  );

  const network = await provider.getNetwork();

  const balance = await provider.getBalance(
    accounts[0]
  );

  return {
    provider,
    address: accounts[0],
    chainId: Number(network.chainId),
    balance: formatEther(balance),
  };
}

export async function getUSDCBalance(provider, address) {
  if (!provider || !address) {
    return "0";
  }

  const usdcContract = new Contract(
    SEPOLIA_USDC_ADDRESS,
    ERC20_ABI,
    provider
  );

  const balance = await usdcContract.balanceOf(address);

  return formatUnits(balance, USDC_DECIMALS);
}

export function shortAddress(address) {
  return address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";
}