// Wallet context: who is connected, what role they have, and contract handles.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";
import { CONFIG, detectRole, readContract, writeContract } from "./contract.js";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [role, setRole] = useState(null);
  const [name, setName] = useState("");
  const [signer, setSigner] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reader = useMemo(() => readContract(), []);
  const hasWallet = typeof window !== "undefined" && Boolean(window.ethereum);
  const wrongNetwork = Boolean(CONFIG && chainId && CONFIG.chainId && chainId !== CONFIG.chainId);

  const refresh = useCallback(async (addr) => {
    if (!addr || !CONFIG) return;
    const provider = new BrowserProvider(window.ethereum);
    const net = await provider.getNetwork();
    setChainId(Number(net.chainId));
    const s = await provider.getSigner();
    setSigner(s);
    const c = readContract();
    try {
      setRole(await detectRole(c, addr));
      setName((await c.participantName(addr)) || "");
    } catch {
      setRole(null);
      setName("");
    }
  }, []);

  const connect = useCallback(async () => {
    if (!hasWallet) {
      setError("No browser wallet found. Install MetaMask, then reload this page.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(addr);
      await refresh(addr);
    } catch (e) {
      setError(e?.message?.includes("rejected") ? "Connection cancelled." : "Could not connect to the wallet.");
    } finally {
      setBusy(false);
    }
  }, [hasWallet, refresh]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setRole(null);
    setName("");
    setSigner(null);
  }, []);

  // Follow account / network switches made inside the wallet.
  useEffect(() => {
    if (!hasWallet) return;
    const onAccounts = (accs) => (accs.length ? (setAccount(accs[0]), refresh(accs[0])) : disconnect());
    const onChain = () => account && refresh(account);
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [hasWallet, account, refresh, disconnect]);

  const value = {
    config: CONFIG,
    hasWallet,
    account,
    chainId,
    wrongNetwork,
    role,
    name,
    busy,
    error,
    connect,
    disconnect,
    reader,
    writer: signer ? writeContract(signer) : null,
    refreshRole: () => account && refresh(account),
  };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export const useWallet = () => useContext(WalletContext);
