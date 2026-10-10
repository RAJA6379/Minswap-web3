
import { Contract, parseUnits } from "ethers";
import { CONTRACTS, NETWORK } from "./config";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const SWAP_ABI = [
  "function swap(uint256 amountIn, bool aToB, uint256 minAmountOut) external",
  "function getAmountOut(uint256 amountIn, bool aToB) view returns (uint256)",
];

export async function executeSwap(
  account,
  amount,
  aToB = true
) {
  if (!account?.provider) {
    throw new Error("Connect your wallet first.");
  }

  const network = await account.provider.getNetwork();

  if (Number(network.chainId) !== 11155111) {
    throw new Error(
      "Please switch to Ethereum Sepolia to use this swap contract."
    );
  }

  const signer = await account.provider.getSigner();
  const owner = await signer.getAddress();

  const tokenAddress = aToB
    ? CONTRACTS.tokenA
    : CONTRACTS.tokenB;

  const token = new Contract(
    tokenAddress,
    ERC20_ABI,
    signer
  );

  const swapContract = new Contract(
    CONTRACTS.swap,
    SWAP_ABI,
    signer
  );

  const decimals = await token.decimals();

  const amountIn = parseUnits(
    String(amount),
    decimals
  );

  if (amountIn <= 0n) {
    throw new Error("Enter a valid swap amount.");
  }

  // Check existing spending permission
  const allowance = await token.allowance(
    owner,
    CONTRACTS.swap
  );

  // Request approval only when allowance is insufficient
  if (allowance < amountIn) {
    const approveTx = await token.approve(
      CONTRACTS.swap,
      amountIn
    );

    await approveTx.wait();
  }

  // Get output quote from pool
  const amountOut = await swapContract.getAmountOut(
    amountIn,
    aToB
  );

  if (amountOut <= 0n) {
    throw new Error("No swap output available.");
  }

  // 0.5% slippage tolerance
  const minAmountOut = (amountOut * 995n) / 1000n;

  // Swap still requires a signed transaction
  const tx = await swapContract.swap(
    amountIn,
    aToB,
    minAmountOut
  );

  return await tx.wait();
}
