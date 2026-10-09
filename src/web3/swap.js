import { Contract, parseUnits } from "ethers";
import { CONTRACTS } from "./config";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() view returns (uint8)",
];

const SWAP_ABI = [
  "function swap(uint256 amountIn, bool aToB, uint256 minAmountOut) external",
  "function getAmountOut(uint256 amountIn, bool aToB) view returns (uint256)",
];

export async function executeSwap(account, amount, aToB = true) {
  const signer = await account.provider.getSigner();

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
    amount,
    decimals
  );

  const approveTx = await token.approve(
    CONTRACTS.swap,
    amountIn
  );

  await approveTx.wait();

  const amountOut =
    await swapContract.getAmountOut(
      amountIn,
      aToB
    );

  const minAmountOut =
    (amountOut * 995n) / 1000n;

  const tx =
    await swapContract.swap(
      amountIn,
      aToB,
      minAmountOut
    );

  return await tx.wait();
}