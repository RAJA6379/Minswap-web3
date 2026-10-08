
import { useState } from "react";
import {
  connectWallet,
  discoverWallets,
  shortAddress,
} from "./web3/wallet";

import { executeSwap } from "./web3/swap";
import { NETWORK } from "./web3/config";

const tokens = {
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    icon: "◆",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    icon: "$",
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    icon: "₮",
  },
};

function TokenSelect({ value, onChange, exclude }) {
  return (
    <select
      className="token-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {Object.keys(tokens)
        .filter((key) => key !== exclude)
        .map((key) => (
          <option key={key} value={key}>
            {tokens[key].icon} {key}
          </option>
        ))}
    </select>
  );
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");

  const [from, setFrom] = useState("ETH");
  const [to, setTo] = useState("USDC");

  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");

  const [connecting, setConnecting] = useState(false);

  const [walletOptions, setWalletOptions] = useState([]);
  const [walletModal, setWalletModal] = useState(false);

  // STEP 1: Detect installed wallets.
  async function handleConnect() {
    setError("");
    setConnecting(true);

    try {
      const wallets = await discoverWallets();

      setWalletOptions(wallets);
      setWalletModal(true);

      if (!wallets.length) {
        setError(
          "No browser wallet found. Install or enable MetaMask or Trust Wallet."
        );
      }
    } catch (e) {
      setError(e?.message || "Could not detect wallets");
    } finally {
      setConnecting(false);
    }
  }

  // STEP 2: Connect to selected wallet.
  async function handleSelectWallet(wallet) {
    setConnecting(true);
    setError("");

    try {
      const connected = await connectWallet(wallet);

      // Check Sepolia testnet.
      if (connected.chainId !== NETWORK.chainId) {
        try {
          await wallet.provider.request({
            method: "wallet_switchEthereumChain",
            params: [
              {
                chainId: NETWORK.chainIdHex,
              },
            ],
          });

          const updated = await connectWallet(wallet);
          setAccount(updated);
        } catch (e) {
          throw new Error(
            `Please switch ${wallet.name} to Sepolia and connect again. ${
              e?.message || ""
            }`
          );
        }
      } else {
        setAccount(connected);
      }

      setWalletModal(false);
    } catch (e) {
      setError(
        e?.message || "Wallet connection failed"
      );
    } finally {
      setConnecting(false);
    }
  }

  // Disconnect wallet from app state.
  function handleDisconnect() {
    setAccount(null);
    setError("");
  }

  // Execute swap.
  async function handleSwap() {
    if (!account) {
      await handleConnect();
      return;
    }

    if (
      !amount ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      setError("Enter an amount to swap.");
      return;
    }

    try {
      setError("");
      setConnecting(true);

      // Current SwapPool is ERC-20 based.
      if (from === "ETH" || to === "ETH") {
        throw new Error(
          "ETH swaps are not yet supported by the ERC-20 SwapPool contract. Use configured ERC-20 tokens after verifying the pair."
        );
      }

      const receipt = await executeSwap(
        account,
        amount,
        true
      );

      console.log("Swap successful:", receipt);
      setAmount("");
    } catch (error) {
      console.error(error);

      setError(
        error?.shortMessage ||
        error?.message ||
        "Swap failed"
      );
    } finally {
      setConnecting(false);
    }
  }

  function swapTokens() {
    const old = from;
    setFrom(to);
    setTo(old);
  }

  return (
    <div className="app">
      {/* NAVBAR */}
      <header className="header">
        <div className="brand">
          <img
            src="/assets/minswap-logo.svg"
            alt="MinSwap"
          />
          <span>MinSwap</span>
        </div>

        <nav>
          <button>Swap</button>
          <button>Liquidity</button>
          <button>Earn</button>
        </nav>

        <button
          className="connect"
          onClick={
            account
              ? handleDisconnect
              : handleConnect
          }
          disabled={connecting}
        >
          {connecting
            ? "Connecting..."
            : account
              ? shortAddress(account.address)
              : "Connect Wallet"}
        </button>
      </header>

      {/* WALLET SELECTION MODAL */}
      {walletModal && (
        <div
          className="wallet-overlay"
          onClick={() =>
            !connecting && setWalletModal(false)
          }
        >
          <div
            className="wallet-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Choose wallet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wallet-dialog-header">
              <h2>Connect a wallet</h2>

              <button
                aria-label="Close"
                onClick={() => setWalletModal(false)}
                disabled={connecting}
              >
                ✕
              </button>
            </div>

            <p>
              Select the wallet extension you want
              to connect.
            </p>

            {walletOptions.length ? (
              walletOptions.map((wallet) => (
                <button
                  className="wallet-option"
                  key={wallet.id}
                  disabled={connecting}
                  onClick={() =>
                    handleSelectWallet(wallet)
                  }
                >
                  {wallet.icon?.startsWith(
                    "data:image/"
                  ) ? (
                    <img
                      src={wallet.icon}
                      alt=""
                    />
                  ) : (
                    <span className="wallet-symbol">
                      ◈
                    </span>
                  )}

                  <span>{wallet.name}</span>
                  <span aria-hidden="true">→</span>
                </button>
              ))
            ) : (
              <p>
                No wallets detected. Enable MetaMask
                or Trust Wallet, then refresh.
              </p>
            )}

            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN SWAP PAGE */}
      <main className="main">
        <div className="page-tabs">
          <button className="active">
            Swap
          </button>
          <button>Limit</button>
        </div>

        <section className="swap-card">
          <div className="card-top">
            <div>
              <h1>Swap</h1>
              <p>
                Trade tokens instantly with our
                decentralized exchange.
              </p>
            </div>

            <button className="gear">
              ⚙
            </button>
          </div>

          {/* YOU PAY */}
          <div className="field">
            <div className="field-label">
              <span>You pay</span>
              <span>
                Balance:{" "}
                {account
                  ? Number(
                      account.balance
                    ).toFixed(4)
                  : "—"}
              </span>
            </div>

            <div className="amount-row">
              <input
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value)
                }
                placeholder="0.0"
                inputMode="decimal"
              />

              <TokenSelect
                value={from}
                onChange={setFrom}
                exclude={to}
              />
            </div>
          </div>

          {/* SWITCH TOKEN */}
          <button
            className="switch"
            onClick={swapTokens}
          >
            ↕
          </button>

          {/* YOU RECEIVE */}
          <div className="field">
            <div className="field-label">
              <span>You receive</span>
              <span>Balance: —</span>
            </div>

            <div className="amount-row">
              <input
                readOnly
                placeholder="0.0"
                value={
                  amount
                    ? (
                        Number(amount) * 1.98
                      ).toFixed(4)
                    : ""
                }
              />

              <TokenSelect
                value={to}
                onChange={setTo}
                exclude={from}
              />
            </div>
          </div>

          {/* SWAP DETAILS */}
          <div className="details">
            <div>
              <span>Rate</span>
              <span>
                1 {from} ≈ 1.98 {to}
              </span>
            </div>

            <div>
              <span>Minimum received</span>
              <span>—</span>
            </div>

            <div>
              <span>Price impact</span>
              <span>—</span>
            </div>

            <div>
              <span>Slippage tolerance</span>

              <select
                value={slippage}
                onChange={(e) =>
                  setSlippage(e.target.value)
                }
              >
                <option>0.1</option>
                <option>0.5</option>
                <option>1.0</option>
              </select>
            </div>
          </div>

          {/* ERRORS */}
          {error && (
            <div className="error">
              {error}
            </div>
          )}

          {/* CONNECT / SWAP BUTTON */}
          <button
            className="swap-button"
            onClick={handleSwap}
            disabled={connecting}
          >
            {connecting
              ? "Processing..."
              : account
                ? "Swap"
                : "Connect Wallet"}
          </button>

          <div className="network">
            <span className="dot" />
            Testnet • Sepolia ready
          </div>
        </section>

        <p className="notice">
          Demo UI based on the supplied
          Minswap-style template. Blockchain
          execution is intentionally separated
          so the UI can be connected to your
          own Solidity contracts.
        </p>
      </main>

      {/* FOOTER */}
      <footer>
        <span>MinSwap Web3</span>
        <span>
          Wallet selection • EIP-6963 + ethers.js
        </span>
      </footer>
    </div>
  );
}
