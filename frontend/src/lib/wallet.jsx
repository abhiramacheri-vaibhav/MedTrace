// Wallet context: who is connected, what role they have, contract handles, the participant roster.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BrowserProvider, JsonRpcProvider } from "ethers";
import { CONFIG, NETWORKS, detectRole, loadParticipants, readContract, writeContract } from "./contract.js";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [role, setRole] = useState(null);
  const [name, setName] = useState("");
  const [signer, setSigner] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [participants, setParticipants] = useState({});

  const reader = useMemo(() => readContract(), []);
  // Local dev / recording mode: on the Hardhat network, ?as=<address> signs with that unlocked
  // node account instead of a browser wallet. Ignored on any public network.
  const devAs = useMemo(() => {
    if (CONFIG?.chainId !== 31337) return null;
    const v = new URLSearchParams(window.location.search).get("as") || sessionStorage.getItem("medtrace.devAs");
    if (v && /^0x[0-9a-fA-F]{40}$/.test(v)) { sessionStorage.setItem("medtrace.devAs", v); return v; }
    return null;
  }, []);
  const hasWallet = typeof window !== "undefined" && (Boolean(window.ethereum) || Boolean(devAs));
  const wrongNetwork = Boolean(CONFIG && chainId && CONFIG.chainId && chainId !== CONFIG.chainId);

  const refreshParticipants = useCallback(async () => {
    if (reader) setParticipants(await loadParticipants());
  }, [reader]);
  useEffect(() => { refreshParticipants(); }, [refreshParticipants]);

  const refresh = useCallback(async (addr) => {
    if (!addr || !CONFIG) return;
    const provider = devAs ? new JsonRpcProvider(NETWORKS[31337].rpc) : new BrowserProvider(window.ethereum);
    const net = await provider.getNetwork();
    setChainId(Number(net.chainId));
    setSigner(devAs ? await provider.getSigner(devAs) : await provider.getSigner());
    const c = readContract();
    try {
      setRole(await detectRole(c, addr));
      setName((await c.participantName(addr)) || "");
    } catch {
      setRole(null); setName("");
    }
  }, []);

  const connect = useCallback(async () => {
    if (!hasWallet) { setError("No wallet app found in this browser. Install MetaMask, then reload this page."); return; }
    setBusy(true); setError("");
    try {
      const [addr] = devAs ? [devAs] : await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(addr);
      await refresh(addr);
    } catch (e) {
      setError(/rejected|denied/i.test(e?.message || "") ? "You closed the request in your wallet app. Try again when you're ready." : "Couldn't connect to the wallet app.");
    } finally { setBusy(false); }
  }, [hasWallet, devAs, refresh]);

  // Ask the wallet to switch to the configured network, adding it if the wallet doesn't know it.
  const switchNetwork = useCallback(async () => {
    const n = NETWORKS[CONFIG?.chainId];
    if (!n || !hasWallet) return;
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: n.hex }] });
    } catch (e) {
      if (e?.code === 4902) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: n.hex, chainName: n.name, rpcUrls: [n.rpc], nativeCurrency: { name: n.currency, symbol: n.currency, decimals: 18 }, blockExplorerUrls: n.explorer ? [n.explorer] : [] }] });
      }
    }
    if (account) await refresh(account);
  }, [hasWallet, account, refresh]);

  const disconnect = useCallback(() => { sessionStorage.removeItem("medtrace.devAs"); setAccount(null); setRole(null); setName(""); setSigner(null); }, []);

  // Dev mode connects on load so a page can be opened directly for recording.
  useEffect(() => { if (devAs && !account) connect(); }, [devAs, account, connect]);

  useEffect(() => {
    if (!hasWallet || devAs || !window.ethereum) return;
    const onAccounts = (accs) => (accs.length ? (setAccount(accs[0]), refresh(accs[0])) : disconnect());
    const onChain = () => account && refresh(account);
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    return () => { window.ethereum.removeListener?.("accountsChanged", onAccounts); window.ethereum.removeListener?.("chainChanged", onChain); };
  }, [hasWallet, devAs, account, refresh, disconnect]);

  const value = {
    devAs,
    config: CONFIG, network: NETWORKS[CONFIG?.chainId], hasWallet, account, chainId, wrongNetwork, role, name, busy, error,
    connect, disconnect, switchNetwork, reader, writer: signer ? writeContract(signer) : null,
    participants, refreshParticipants,
    // Name + role for any address, falling back to a short address.
    who: (addr) => participants[addr?.toLowerCase()] || null,
  };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export const useWallet = () => useContext(WalletContext);
