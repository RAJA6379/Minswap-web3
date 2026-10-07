import { useState } from 'react';
import { connectMetaMask, shortAddress } from './web3/wallet';
import { executeSwap } from "./web3/swap";

const tokens = {
  ETH: { symbol: 'ETH', name: 'Ethereum', icon: '◆' },
  USDC: { symbol: 'USDC', name: 'USD Coin', icon: '$' },
  USDT: { symbol: 'USDT', name: 'Tether USD', icon: '₮' }
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

function TokenSelect({ value, onChange, exclude }) {
  return <select className="token-select" value={value} onChange={e=>onChange(e.target.value)}>
    {Object.keys(tokens).filter(k=>k!==exclude).map(k=><option key={k} value={k}>{tokens[k].icon} {k}</option>)}
  </select>;
}

export default function App(){
  const [account,setAccount]=useState(null);
  const [error,setError]=useState('');
  const [from,setFrom]=useState('ETH');
  const [to,setTo]=useState('USDC');
  const [amount,setAmount]=useState('');
  const [slippage,setSlippage]=useState('0.5');
  const [connecting,setConnecting]=useState(false);

  // async function handleConnect(){
  //   setError(''); setConnecting(true);
  //   try { setAccount(await connectMetaMask()); }
  //   catch(e){ setError(e?.message || 'Wallet connection failed'); }
  //   finally { setConnecting(false); }
  // }
  async function handleConnect() {
  setError("");
  setConnecting(true);

  try {
    const connectedAccount = await connectMetaMask();
    setAccount(connectedAccount);
  } catch (error) {
    setError(
      error?.message || "Wallet connection failed"
    );
  } finally {
    setConnecting(false);
  }
}

  async function handleDisconnect() {
  try {
    if (window.ethereum) {
      await window.ethereum.request({
        method: "wallet_revokePermissions",
        params: [
          {
            eth_accounts: {},
          },
        ],
      });
    }
  } catch (error) {
    console.log("Permission revoke failed:", error);
  }

  setAccount(null);
  setError("");
}

async function handleSwap() {
  if (!account) {
    await handleConnect();
    return;
  }

  if (!amountIn || Number(amountIn) <= 0) {
    setError("Enter an amount to swap.");
    return;
  }

  try {
    setError("");
    setConnecting(true);

    const receipt = await executeSwap(
      account,
      amountIn,
      true
    );

    console.log(
      "Swap successful:",
      receipt
    );

    setAmountIn("");

  } catch (error) {
    console.error(error);
//testing
    setError(
      error?.shortMessage ||
      error?.message ||
      "Swap failed"
    );
  } finally {
    setConnecting(false);
  }
}
  async function handleConnect(){
    setError(''); setConnecting(true);
    try { setAccount(await connectMetaMask()); }
    catch(e){ setError(e?.message || 'Wallet connection failed'); }
    finally { setConnecting(false); }
  }

  function swapTokens(){ const old=from; setFrom(to); setTo(old); }

  return <div className="app">
    <header className="header">
      <div className="brand"><img src="/assets/minswap-logo.svg"/><span>MinSwap</span></div>
      <nav><button>Swap</button><button>Liquidity</button><button>Earn</button></nav>
      <button className="connect" onClick={account ? handleDisconnect : handleConnect} disabled={connecting}>{connecting?'Connecting...':account?shortAddress(account.address):'Connect Wallet'}</button>
      <button className="connect" onClick={handleConnect} disabled={connecting}>{connecting?'Connecting...':account?shortAddress(account.address):'Connect Wallet'}</button>
    </header>

    <main className="main">
      <div className="page-tabs"><button className="active">Swap</button><button>Limit</button></div>
      <section className="swap-card">
        <div className="card-top"><div><h1>Swap</h1><p>Trade tokens instantly with our decentralized exchange.</p></div><button className="gear">⚙</button></div>
        <div className="field">
          <div className="field-label"><span>You pay</span><span>Balance: {account ? Number(account.balance).toFixed(4) : '—'}</span></div>
          <div className="amount-row"><input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.0" inputMode="decimal"/><TokenSelect value={from} onChange={setFrom} exclude={to}/></div>
        </div>
        <button className="switch" onClick={swapTokens}>↕</button>
        <div className="field">
          <div className="field-label"><span>You receive</span><span>Balance: —</span></div>
          <div className="amount-row"><input readOnly placeholder="0.0" value={amount ? (Number(amount)*1.98).toFixed(4) : ''}/><TokenSelect value={to} onChange={setTo} exclude={from}/></div>
        </div>
        <div className="details"><div><span>Rate</span><span>1 {from} ≈ 1.98 {to}</span></div><div><span>Minimum received</span><span>—</span></div><div><span>Price impact</span><span>—</span></div><div><span>Slippage tolerance</span><select value={slippage} onChange={e=>setSlippage(e.target.value)}><option>0.1</option><option>0.5</option><option>1.0</option></select></div></div>
        {error && <div className="error">{error}</div>}
        {/* <button className="swap-button" onClick={account?()=>:handleConnect}>{account?'Swap':'Connect Wallet'}</button> */}
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
        <button className="swap-button" onClick={account?()=>setError('Swap contract is not deployed yet. Deploy the provided Solidity contracts, then add the address in src/web3/config.js.'):handleConnect}>{account?'Swap':'Connect Wallet'}</button>
        <div className="network"><span className="dot"></span> Testnet • Sepolia ready</div>
      </section>
      <p className="notice">Demo UI based on the supplied Minswap-style template. Blockchain execution is intentionally separated so the UI can be connected to your own Solidity contracts.</p>
    </main>
    <footer><span>MinSwap Web3</span><span>Swap-only milestone • MetaMask + ethers.js</span></footer>
  </div>
}
