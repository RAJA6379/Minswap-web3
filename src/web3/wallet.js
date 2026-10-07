import { BrowserProvider, formatEther } from "ethers";

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

export function shortAddress(address) {
  return address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";
}
