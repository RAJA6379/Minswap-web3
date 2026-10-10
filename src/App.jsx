
import { useEffect, useRef, useState } from "react";
import {
  BrowserProvider,
  Contract,
  formatEther,
  formatUnits,
} from "ethers";

import {
  connectWallet,
  discoverWallets,
  shortAddress,
} from "./web3/wallet";

import { executeSwap } from "./web3/swap";
import { NETWORK } from "./web3/config";

import {
  EVM_NETWORKS,
  getNetworkInfo,
  switchEvmNetwork,
} from "./web3/networks";

import {
  connectPhantomSolana,
  getSolBalance,
} from "./web3/solana/SolanaWallet";

const tokens = {
  ETH: { symbol: "ETH", icon: "◆" },
  SOL: { symbol: "SOL", icon: "◎" },
  USDC: { symbol: "USDC", icon: "$" },
  USDT: { symbol: "USDT", icon: "₮" },
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
];

const STORAGE_KEY = "minswap:selected-wallet";

// TOKEN SELECTOR
function TokenSelect({
  value,
  onChange,
  exclude,
  solanaActive = false,
  receive = false,
}) {
  if (solanaActive && !receive) {
    return (
      <select
        className="token-select"
        value="SOL"
        disabled
      >
        <option value="SOL">◎ SOL</option>
      </select>
    );
  }

  if (solanaActive && receive) {
    return (
      <select
        className="token-select"
        value="none"
        disabled
      >
        <option value="none">Select token</option>
      </select>
    );
  }

  return (
    <select
      className="token-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {["ETH", "USDC", "USDT"]
        .filter((symbol) => symbol !== exclude)
        .map((symbol) => (
          <option key={symbol} value={symbol}>
            {tokens[symbol].icon} {symbol}
          </option>
        ))}
    </select>
  );
}

// WALLET LOGO
function WalletLogo({ icon, name, size = 24 }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [icon]);

  if (icon && !failed) {
    return (
      <img
        src={icon}
        alt={name || "Wallet"}
        className="connected-wallet-logo"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="wallet-logo-fallback"
      style={{ width: size, height: size }}
    >
      {(name || "W")[0]}
    </span>
  );
}

// NETWORK LOGO
function NetIcon({ net }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [net?.logo]);

  if (!net) return null;

  return (
    <span
      className={`network-icon ${
        net.logo && !failed ? "has-logo" : ""
      }`}
      style={{ background: net.color }}
    >
      {net.logo && !failed ? (
        <img
          className="net-img"
          src={net.logo}
          alt={net.name}
          onError={() => setFailed(true)}
        />
      ) : (
        net.icon
      )}
    </span>
  );
}

// DROPDOWN ARROW
function Chevron({ open }) {
  return (
    <svg
      className={`chev ${open ? "open" : ""}`}
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 7.5l5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const chainsKey = (name) =>
  `minswap-wallet-chains:${name}`;

function loadChains(name) {
  try {
    return JSON.parse(
      localStorage.getItem(chainsKey(name)) || "[]"
    );
  } catch {
    return [];
  }
}

function saveChains(name, chains) {
  try {
    localStorage.setItem(
      chainsKey(name),
      JSON.stringify(chains)
    );
  } catch {
    // Browser storage may be unavailable
  }
}

const labelKey = (address) =>
  `minswap-account-label:${address.toLowerCase()}`;

function getLabel(address, index = 0) {
  try {
    return (
      localStorage.getItem(labelKey(address)) ||
      `Account ${index + 1}`
    );
  } catch {
    return `Account ${index + 1}`;
  }
}

export default function App() {
  // WALLET STATE
  const [account, setAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [btc, setBtc] = useState(null);
  const [error, setError] = useState("");

  // SWAP STATE
  const [from, setFrom] = useState("ETH");
  const [to, setTo] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [connecting, setConnecting] = useState(false);

  // MODAL STATE
  const [walletOptions, setWalletOptions] = useState([]);
  const [walletModal, setWalletModal] = useState(false);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  // ACCOUNT UI
  const [walletIcon, setWalletIcon] = useState(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelTick, setLabelTick] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");

  // NETWORKS
  const [walletChains, setWalletChains] = useState([]);
  const [showMore, setShowMore] = useState(false);
  const [showAllNets, setShowAllNets] = useState(null);
  const [nonEvm, setNonEvm] = useState(null);
  const [otherAddrs, setOtherAddrs] = useState({});

  // SOLANA DEVNET
  const [solBalance, setSolBalance] = useState(null);

  const solanaActive = nonEvm === "solana";

  // REFERENCES
  const selectedWalletRef = useRef(null);
  const selectedWalletName = useRef("");
  const restoredRef = useRef(false);

  const network = getNetworkInfo(account?.chainId);

  const isPhantom = /phantom/i.test(
    account?.walletName || ""
  );

  const showAll =
    showAllNets ??
    /metamask/i.test(account?.walletName || "");

  const detected = EVM_NETWORKS.filter((net) =>
    net.nonEvm
      ? isPhantom && Boolean(window.phantom?.[net.chainId])
      : showAll || walletChains.includes(net.chainId)
  );

  const others = EVM_NETWORKS.filter(
    (net) => !net.nonEvm && !detected.includes(net)
  );

  const activeNet =
    (nonEvm &&
      EVM_NETWORKS.find(
        (net) => net.chainId === nonEvm
      )) ||
    network;

  // labelTick forces the renamed label to refresh
  void labelTick;

  const accountLabel = account
    ? getLabel(account.address)
    : "";

  // SAVE ACCOUNT NAME
  function saveAccountLabel() {
    if (!account) return;

    const label = draftLabel.trim() || "Account 1";

    try {
      localStorage.setItem(
        labelKey(account.address),
        label
      );
    } catch {
      setError("Could not save account name.");
    }

    setLabelTick((v) => v + 1);
    setEditingLabel(false);
  }

  // FETCH EVM WALLET INFORMATION
  async function refreshAccount(injected) {
    if (!injected?.request) return;

    const [chainHex, addresses] = await Promise.all([
      injected.request({ method: "eth_chainId" }),
      injected.request({ method: "eth_accounts" }),
    ]);

    if (selectedWalletRef.current !== injected) {
      return;
    }

    if (!addresses?.length) {
      handleDisconnect();
      return;
    }

    const bp = new BrowserProvider(injected);
    const chainId = Number(chainHex);
    const net = getNetworkInfo(chainId);

    const nextBalances = {};

    await Promise.all(
      addresses.map(async (address) => {
        try {
          nextBalances[address] = formatEther(
            await bp.getBalance(address)
          );
        } catch {
          nextBalances[address] = "0";
        }
      })
    );

    let btcBalance = null;

    if (net.btc) {
      try {
        const contract = new Contract(
          net.btc.address,
          ERC20_ABI,
          bp
        );

        const rawBalance = await contract.balanceOf(
          addresses[0]
        );

        btcBalance = formatUnits(
          rawBalance,
          net.btc.decimals
        );
      } catch {
        btcBalance = "0";
      }
    }

    if (selectedWalletRef.current !== injected) {
      return;
    }

    setWalletChains((prev) => {
      if (prev.includes(chainId)) return prev;

      const next = [...prev, chainId];

      saveChains(
        selectedWalletName.current,
        next
      );

      return next;
    });

    setAccounts(addresses);
    setBalances(nextBalances);
    setBtc(btcBalance);

    setAccount((prev) =>
      prev
        ? {
            ...prev,
            provider: bp,
            injectedProvider: injected,
            address: addresses[0],
            chainId,
            balance: nextBalances[addresses[0]],
          }
        : prev
    );
  }

  // RESTORE AN AUTHORIZED EVM WALLET
  useEffect(() => {
    if (restoredRef.current) return;

    restoredRef.current = true;
    let cancelled = false;

    async function restoreWallet() {
      try {
        const saved = JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "null"
        );

        if (!saved) return;

        const wallets = await discoverWallets();

        const wallet =
          wallets.find((w) => w.id === saved.id) ||
          wallets.find((w) => w.name === saved.name);

        if (!wallet || cancelled) return;

        const connected = await connectWallet(
          wallet,
          { silent: true }
        );

        if (cancelled) return;

        selectedWalletRef.current = wallet.provider;

        selectedWalletName.current =
          connected.walletName || wallet.name;

        setWalletIcon(wallet.icon || null);
        setWalletChains(
          loadChains(selectedWalletName.current)
        );
        setAccount(connected);

        await refreshAccount(wallet.provider);
      } catch (err) {
        console.debug(
          "Silent wallet restore skipped:",
          err
        );
      }
    }

    restoreWallet();

    return () => {
      cancelled = true;
    };
  }, []);

  // EVM ACCOUNT AND NETWORK EVENTS
  useEffect(() => {
    if (!account) return;

    const injected = selectedWalletRef.current;

    if (!injected) return;

    const refresh = () => {
      refreshAccount(injected).catch((err) => {
        setError(
          err?.message || "Wallet refresh failed."
        );
      });
    };

    const onChain = () => {
      setNetworkOpen(false);
      setNonEvm(null);
      refresh();
    };

    const onAccounts = (addresses) => {
      if (!addresses?.length) {
        handleDisconnect();
      } else {
        refresh();
      }
    };

    injected.on?.("chainChanged", onChain);
    injected.on?.("accountsChanged", onAccounts);

    const timer = setInterval(refresh, 12000);

    return () => {
      clearInterval(timer);

      injected.removeListener?.(
        "chainChanged",
        onChain
      );

      injected.removeListener?.(
        "accountsChanged",
        onAccounts
      );
    };
  }, [account?.injectedProvider, account?.walletName]);

  // RESET TOKEN SELECTION ON NETWORK CHANGE
  useEffect(() => {
    if (solanaActive) {
      setFrom("SOL");
      setTo("USDC");
    } else {
      setFrom("ETH");
      setTo("USDC");
    }

    setAmount("");
  }, [solanaActive]);

  // REFRESH SOLANA DEVNET BALANCE
  useEffect(() => {
    if (!solanaActive || !otherAddrs.solana) return;

    let alive = true;

    const phantom = window.phantom?.solana;

    async function refreshSolanaBalance() {
      try {
        const address =
          phantom?.publicKey?.toBase58?.() ||
          otherAddrs.solana;

        const balance = await getSolBalance(address);

        if (!alive) return;

        setOtherAddrs((prev) =>
          prev.solana === address
            ? prev
            : { ...prev, solana: address }
        );

        setSolBalance(balance);
      } catch (err) {
        if (alive) {
          setSolBalance(null);
          setError(
            "Solana Devnet balance: " +
              (err?.message || "RPC request failed.")
          );
        }
      }
    }

    function onAccountChanged(publicKey) {
      if (!publicKey) {
        setSolBalance(null);
        setNonEvm(null);
        setOtherAddrs((prev) => ({
          ...prev,
          solana: null,
        }));
        return;
      }

      const address = publicKey.toBase58();

      setOtherAddrs((prev) => ({
        ...prev,
        solana: address,
      }));

      setSolBalance(null);
    }

    function onDisconnect() {
      setSolBalance(null);
      setNonEvm(null);
      setOtherAddrs((prev) => ({
        ...prev,
        solana: null,
      }));
    }

    refreshSolanaBalance();

    const timer = setInterval(
      refreshSolanaBalance,
      15000
    );

    phantom?.on?.(
      "accountChanged",
      onAccountChanged
    );

    phantom?.on?.(
      "disconnect",
      onDisconnect
    );

    return () => {
      alive = false;
      clearInterval(timer);

      phantom?.off?.(
        "accountChanged",
        onAccountChanged
      );

      phantom?.off?.(
        "disconnect",
        onDisconnect
      );
    };
  }, [solanaActive, otherAddrs.solana]);

  // CLOSE MENUS
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setNetworkOpen(false);
        setWalletMenuOpen(false);
        setWalletModal(false);
      }
    };

    window.addEventListener("keydown", onKey);

    return () =>
      window.removeEventListener("keydown", onKey);
  }, []);

  // OPEN WALLET SELECTION
  async function handleConnect() {
    setError("");
    setConnecting(true);

    try {
      const wallets = await discoverWallets();

      setWalletOptions(wallets);
      setWalletModal(true);

      if (!wallets.length) {
        setError(
          "No supported wallet extension found."
        );
      }
    } catch (err) {
      setError(
        err?.message || "Wallet detection failed."
      );
    } finally {
      setConnecting(false);
    }
  }

  // CONNECT SELECTED EVM WALLET
  async function handleSelectWallet(wallet) {
    setConnecting(true);
    setError("");

    try {
      const connected = await connectWallet(wallet);

      selectedWalletRef.current = wallet.provider;

      selectedWalletName.current =
        connected.walletName || wallet.name;

      setWalletIcon(wallet.icon || null);

      setWalletChains(
        loadChains(selectedWalletName.current)
      );

      setAccount(connected);
      setNonEvm(null);
      setWalletModal(false);
      setNetworkOpen(false);
      setWalletMenuOpen(false);
      setShowMore(false);

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            id: wallet.id,
            name: wallet.name,
          })
        );
      } catch {
        // Storage optional
      }

      await refreshAccount(wallet.provider);
    } catch (err) {
      setError(
        err?.message || "Failed to connect wallet."
      );
    } finally {
      setConnecting(false);
    }
  }

  // DISCONNECT FROM MINSWAP
  function handleDisconnect() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore unavailable storage
    }

    selectedWalletRef.current = null;
    selectedWalletName.current = "";

    setAccount(null);
    setAccounts([]);
    setBalances({});
    setBtc(null);

    setNonEvm(null);
    setOtherAddrs({});
    setSolBalance(null);

    setWalletChains([]);
    setWalletIcon(null);
    setWalletMenuOpen(false);
    setNetworkOpen(false);
    setEditingLabel(false);
    setDraftLabel("");
    setCopyMessage("");
    setError("");
  }

  // CONNECT PHANTOM SOLANA OR BITCOIN
  async function connectNonEvm(item) {
    setNetworkOpen(false);
    setConnecting(true);
    setError("");

    try {
      let address;

      if (item.chainId === "bitcoin") {
        const provider = window.phantom?.bitcoin;

        if (!provider) {
          throw new Error(
            "Bitcoin requires Phantom wallet."
          );
        }

        const btcAccounts =
          await provider.requestAccounts();

        address = (
          btcAccounts.find(
            (a) => a.purpose === "payment"
          ) || btcAccounts[0]
        )?.address;
      } else if (item.chainId === "solana") {
        const connected =
          await connectPhantomSolana();

        address = connected.address;

        setSolBalance(connected.balance);

        console.log(
          "Solana Devnet address:",
          address
        );

        console.log(
          "Solana Devnet balance:",
          connected.balance
        );
      } else {
        throw new Error(
          "Unsupported non-EVM network."
        );
      }

      if (!address) {
        throw new Error(
          "Wallet did not return an address."
        );
      }

      setOtherAddrs((prev) => ({
        ...prev,
        [item.chainId]: address,
      }));

      setNonEvm(item.chainId);
    } catch (err) {
      if (err?.code !== 4001) {
        setError(
          err?.message ||
            `Could not connect ${item.name}.`
        );
      }
    } finally {
      setConnecting(false);
    }
  }

  // SELECT NETWORK
  async function chooseNetwork(selected) {
    if (!account) {
      setError("Connect your wallet first.");
      return;
    }

    if (selected.nonEvm) {
      await connectNonEvm(selected);
      return;
    }

    setNetworkOpen(false);
    setConnecting(true);
    setError("");

    try {
      const injected = selectedWalletRef.current;

      if (!injected) {
        throw new Error(
          "Wallet provider unavailable."
        );
      }

      await switchEvmNetwork(
        injected,
        selected
      );

      setNonEvm(null);

      await refreshAccount(injected);
    } catch (err) {
      setError(
        err?.message || "Could not switch network."
      );
    } finally {
      setConnecting(false);
    }
  }

  // ACCOUNT PERMISSION PICKER
  async function manageAccounts() {
    const injected = selectedWalletRef.current;

    if (!injected) return;

    try {
      await injected.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });

      await refreshAccount(injected);
    } catch (err) {
      if (err?.code !== 4001) {
        setError(
          err?.message || "Account selection failed."
        );
      }
    }
  }

  // COPY ADDRESS
  async function copyAddress(address) {
    try {
      await navigator.clipboard.writeText(address);
      setCopyMessage("Address copied!");
    } catch {
      setCopyMessage("Unable to copy address.");
    }

    setTimeout(
      () => setCopyMessage(""),
      1800
    );
  }

  // SWAP
  async function handleSwap() {
    if (!account) {
      await handleConnect();
      return;
    }

    if (nonEvm) {
      setError(
        "Solana and Bitcoin swaps are not implemented yet."
      );
      return;
    }

    if (
      !amount ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      setError("Enter a valid swap amount.");
      return;
    }

    setError("");
    setConnecting(true);

    try {
      if (account.chainId !== NETWORK.chainId) {
        throw new Error(
          "SwapPool currently supports Sepolia only."
        );
      }

      if (from === "ETH" || to === "ETH") {
        throw new Error(
          "Native ETH is not supported by this ERC-20 pool."
        );
      }

      // Direction must match deployed token addresses.
      const aToB =
        from === "USDC" && to === "USDT";

      const bToA =
        from === "USDT" && to === "USDC";

      if (!aToB && !bToA) {
        throw new Error(
          "Unsupported token pair."
        );
      }

      // Verify contract tokenA = USDC and tokenB = USDT
      // before submitting a real transaction.
      throw new Error(
        "Verify deployed tokenA/tokenB addresses and liquidity before enabling swaps."
      );

      // After verification, replace the throw above with:
      // const receipt = await executeSwap(
      //   account,
      //   amount,
      //   aToB
      // );
      // console.log(receipt);
      // setAmount("");
    } catch (err) {
      setError(
        err?.shortMessage ||
          err?.message ||
          "Swap failed."
      );
    } finally {
      setConnecting(false);
    }
  }

  function swapTokens() {
    if (solanaActive) return;

    setFrom(to);
    setTo(from);
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
          <button className="nav-active">
            Swap
          </button>
          <button>Liquidity</button>
          <button>Earn</button>
        </nav>

        <div className="header-actions">
          {/* NETWORK MENU */}
          <div className="network-menu-wrap">
            <button
              className="network-trigger"
              disabled={connecting}
              aria-expanded={networkOpen}
              onClick={() => {
                setWalletMenuOpen(false);
                setNetworkOpen((p) => !p);
              }}
            >
              <NetIcon net={activeNet} />

              <span className="network-trigger-text">
                {account
                  ? activeNet?.name || "Network"
                  : "Network"}
              </span>

              <Chevron open={networkOpen} />
            </button>

            {networkOpen && (
              <>
                <button
                  className="menu-dismiss"
                  aria-label="Close network menu"
                  onClick={() => setNetworkOpen(false)}
                />

                <div className="network-dropdown">
                  <div className="dropdown-heading">
                    Select network
                  </div>

                  <p>
                    Choose a network for your wallet.
                  </p>

                  {account && (
                    <div className="wallet-chip">
                      <WalletLogo
                        icon={walletIcon}
                        name={account.walletName}
                        size={22}
                      />

                      <span>
                        Networks in{" "}
                        <strong>
                          {account.walletName}
                        </strong>
                      </span>
                    </div>
                  )}

                  {detected.map((item) => (
                    <button
                      key={item.chainId}
                      className="network-row"
                      disabled={connecting}
                      onClick={() => chooseNetwork(item)}
                    >
                      <NetIcon net={item} />

                      <span className="network-description">
                        <strong>
                          {item.name}
                          {item.testnet && (
                            <span className="testnet-tag">
                              TESTNET
                            </span>
                          )}
                        </strong>

                        <small>
                          {item.nonEvm
                            ? otherAddrs[item.chainId]
                              ? shortAddress(
                                  otherAddrs[item.chainId]
                                )
                              : "Tap to connect"
                            : shortAddress(
                                account?.address
                              )}
                        </small>
                      </span>

                      {(item.nonEvm
                        ? nonEvm === item.chainId
                        : !nonEvm &&
                          account?.chainId ===
                            item.chainId) && (
                        <span className="active-check">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}

                  {account && (
                    <button
                      className="mini-btn more-btn"
                      onClick={() =>
                        setShowAllNets(!showAll)
                      }
                    >
                      {showAll
                        ? "Show used networks"
                        : "Show all supported networks"}
                    </button>
                  )}

                  {account && others.length > 0 && (
                    <>
                      <button
                        className="mini-btn more-btn"
                        onClick={() =>
                          setShowMore((p) => !p)
                        }
                      >
                        {showMore
                          ? "Hide other networks"
                          : "Request another network"}
                      </button>

                      {showMore &&
                        others.map((item) => (
                          <button
                            key={item.chainId}
                            className="network-row"
                            disabled={connecting}
                            onClick={() =>
                              chooseNetwork(item)
                            }
                          >
                            <NetIcon net={item} />

                            <span className="network-description">
                              <strong>
                                {item.name}
                              </strong>

                              <small>
                                Request wallet network switch
                              </small>
                            </span>
                          </button>
                        ))}
                    </>
                  )}

                  <div className="network-menu-note">
                    Network support depends on your
                    connected wallet.
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ACCOUNT BUTTON */}
          <div className="wallet-menu-wrap">
            <button
              className="connect"
              disabled={connecting}
              aria-expanded={
                account ? walletMenuOpen : undefined
              }
              onClick={
                account
                  ? () => {
                      setNetworkOpen(false);
                      setWalletMenuOpen((p) => !p);
                    }
                  : handleConnect
              }
            >
              {account && (
                <WalletLogo
                  icon={walletIcon}
                  name={account.walletName}
                />
              )}

              <span className="connect-label">
                {connecting
                  ? "Connecting..."
                  : account
                    ? accountLabel
                    : "Connect Wallet"}
              </span>

              {account && (
                <Chevron open={walletMenuOpen} />
              )}
            </button>

            {account && walletMenuOpen && (
              <>
                <button
                  className="menu-dismiss"
                  aria-label="Close account menu"
                  onClick={() =>
                    setWalletMenuOpen(false)
                  }
                />

                <div className="wallet-profile-menu">
                  <span className="dropdown-heading">
                    Connected accounts ({accounts.length})
                  </span>

                  <div className="wallet-identity-row">
                    <WalletLogo
                      icon={walletIcon}
                      name={account.walletName}
                      size={32}
                    />

                    <div>
                      <strong>
                        {account.walletName}
                      </strong>
                      <small>
                        {activeNet?.name}
                      </small>
                    </div>
                  </div>

                  <div className="acct-list">
                    {accounts.map((addr, i) => (
                      <div
                        key={addr}
                        className={`acct-row ${
                          i === 0 ? "active" : ""
                        }`}
                      >
                        <span className="identicon">
                          ◈
                        </span>

                        <div className="acct-main">
                          <strong>
                            {getLabel(addr, i)}
                            {i === 0 && (
                              <span className="acct-badge">
                                ACTIVE
                              </span>
                            )}
                          </strong>

                          <span title={addr}>
                            {addr}
                          </span>

                          <em>
                            {Number(
                              balances[addr] ?? 0
                            ).toFixed(5)}{" "}
                            {network.currency}
                          </em>
                        </div>

                        <button
                          className="mini-btn"
                          onClick={() =>
                            copyAddress(addr)
                          }
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>

                  {nonEvm && otherAddrs[nonEvm] && (
                    <div className="acct-row active">
                      <NetIcon net={activeNet} />

                      <div className="acct-main">
                        <strong>
                          {solanaActive
                            ? "Solana Devnet address"
                            : `${activeNet.name} address`}
                        </strong>

                        <span
                          title={otherAddrs[nonEvm]}
                        >
                          {otherAddrs[nonEvm]}
                        </span>

                        {solanaActive && (
                          <em>
                            {solBalance === null
                              ? "Loading SOL..."
                              : `${solBalance.toFixed(5)} SOL`}
                          </em>
                        )}
                      </div>

                      <button
                        className="mini-btn"
                        onClick={() =>
                          copyAddress(
                            otherAddrs[nonEvm]
                          )
                        }
                      >
                        Copy
                      </button>
                    </div>
                  )}

                  <button
                    className="account-action"
                    onClick={manageAccounts}
                  >
                    Add / switch EVM accounts
                  </button>

                  <div className="account-label-row">
                    {editingLabel ? (
                      <input
                        className="account-label-input"
                        value={draftLabel}
                        maxLength={26}
                        placeholder="Account name"
                        onChange={(e) =>
                          setDraftLabel(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            saveAccountLabel();
                          }
                          if (e.key === "Escape") {
                            setEditingLabel(false);
                          }
                        }}
                      />
                    ) : (
                      <strong>{accountLabel}</strong>
                    )}

                    <button
                      onClick={() => {
                        if (editingLabel) {
                          saveAccountLabel();
                        } else {
                          setDraftLabel(accountLabel);
                          setEditingLabel(true);
                        }
                      }}
                    >
                      {editingLabel
                        ? "Save"
                        : "Rename active"}
                    </button>
                  </div>

                  <div className="account-address-box">
                    <span className="address-caption">
                      Assets on{" "}
                      {solanaActive
                        ? "Solana Devnet"
                        : network.name}
                    </span>

                    <div className="asset-row">
                      <span>
                        {solanaActive
                          ? "SOL"
                          : network.currency || "Native"}
                      </span>

                      <span>
                        {solanaActive
                          ? solBalance === null
                            ? "—"
                            : solBalance.toFixed(5)
                          : Number(
                              account.balance || 0
                            ).toFixed(5)}
                      </span>
                    </div>

                    {!solanaActive &&
                      (network.btc ? (
                        <div className="asset-row">
                          <span>
                            {network.btc.symbol}
                          </span>
                          <span>
                            {Number(
                              btc || 0
                            ).toFixed(6)}
                          </span>
                        </div>
                      ) : (
                        <small>
                          No wrapped BTC is tracked
                          on this network.
                        </small>
                      ))}
                  </div>

                  {copyMessage && (
                    <small>{copyMessage}</small>
                  )}

                  <small className="account-help">
                    Balances refresh automatically.
                  </small>

                  <button
                    className="disconnect-option"
                    onClick={handleDisconnect}
                  >
                    Disconnect from MinSwap
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* WALLET MODAL */}
      {walletModal && (
        <div
          className="wallet-overlay"
          onClick={() => {
            if (!connecting) setWalletModal(false);
          }}
        >
          <div
            className="wallet-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Select wallet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wallet-dialog-header">
              <h2>Connect a wallet</h2>

              <button
                disabled={connecting}
                onClick={() =>
                  setWalletModal(false)
                }
              >
                ✕
              </button>
            </div>

            <p>
              Select a wallet extension to connect.
            </p>

            {walletOptions.map((wallet) => (
              <button
                key={wallet.id}
                className="wallet-option"
                disabled={connecting}
                onClick={() =>
                  handleSelectWallet(wallet)
                }
              >
                <WalletLogo
                  icon={wallet.icon}
                  name={wallet.name}
                  size={32}
                />

                <span>{wallet.name}</span>
                <span>→</span>
              </button>
            ))}

            {!walletOptions.length && (
              <p>No browser wallets detected.</p>
            )}

            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SWAP PAGE */}
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
                {solanaActive
                  ? solBalance === null
                    ? "Loading..."
                    : `${solBalance.toFixed(4)} SOL`
                  : account
                    ? Number(
                        account.balance || 0
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
                solanaActive={solanaActive}
              />
            </div>
          </div>

          {/* SWITCH TOKEN */}
          <button
            className="switch"
            onClick={swapTokens}
            disabled={solanaActive}
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
                  solanaActive
                    ? ""
                    : amount &&
                        Number.isFinite(
                          Number(amount)
                        )
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
                solanaActive={solanaActive}
                receive
              />
            </div>
          </div>

          {/* SWAP DETAILS */}
          <div className="details">
            <div>
              <span>
                Rate (demo only)
              </span>
              <span>
                {solanaActive
                  ? "Solana quote unavailable"
                  : `1 ${from} ≈ 1.98 ${to}`}
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
                <option value="0.1">
                  0.1%
                </option>
                <option value="0.5">
                  0.5%
                </option>
                <option value="1.0">
                  1.0%
                </option>
              </select>
            </div>
          </div>

          {solanaActive && (
            <p className="notice">
              Solana Devnet wallet connected.
              Solana swaps are not implemented yet.
            </p>
          )}

          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          {/* SWAP BUTTON */}
          <button
            className="swap-button"
            disabled={
              connecting || solanaActive
            }
            onClick={handleSwap}
          >
            {connecting
              ? "Processing..."
              : solanaActive
                ? "Solana Swap Coming Soon"
                : account
                  ? "Swap"
                  : "Connect Wallet"}
          </button>

          {/* ACTIVE NETWORK */}
          <div className="network">
            <span className="dot" />

            {account
              ? `${
                  solanaActive
                    ? "Solana Devnet"
                    : activeNet?.name || "Network"
                } • ${shortAddress(
                  nonEvm
                    ? otherAddrs[nonEvm]
                    : account.address
                )}`
              : "Connect wallet to select a network"}
          </div>
        </section>

        <p className="notice">
          Demo quote only. Real swaps require
          verified contracts, prices and liquidity.
        </p>
      </main>

      {/* FOOTER */}
      <footer>
        <span>MinSwap Web3</span>

        <span>
          Multi-wallet • Solana Devnet • ethers.js
        </span>
      </footer>
    </div>
  );
}
