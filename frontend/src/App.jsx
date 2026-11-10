import { Navigate, Route, Routes } from "react-router-dom";
import TopBar from "./components/TopBar.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import { useWallet } from "./lib/wallet.jsx";
import Connect from "./pages/Connect.jsx";
import Factory from "./pages/Factory.jsx";
import Distributor from "./pages/Distributor.jsx";
import Pharmacy from "./pages/Pharmacy.jsx";
import Regulator from "./pages/Regulator.jsx";
import Admin from "./pages/Admin.jsx";
import Verify from "./pages/Verify.jsx";

// Pages that need a specific role bounce back to Connect if you don't have it.
function Guard({ role, children }) {
  const w = useWallet();
  if (!w.account || w.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { config } = useWallet();
  return (
    <ToastProvider>
      <div className="shell">
        <TopBar />
        {!config ? (
          <main className="page">
            <div className="notice warn">
              <b>The app isn't connected to a contract yet.</b> Deploy MedTrace, then from the <code>frontend/</code> folder run
              <code> npm run sync-contract -- &lt;address&gt; &lt;localhost|amoy&gt;</code> and reload.
            </div>
          </main>
        ) : (
          <Routes>
            <Route path="/" element={<Connect />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/factory" element={<Guard role="manufacturer"><Factory /></Guard>} />
            <Route path="/distributor" element={<Guard role="distributor"><Distributor /></Guard>} />
            <Route path="/pharmacy" element={<Guard role="pharmacy"><Pharmacy /></Guard>} />
            <Route path="/regulator" element={<Guard role="regulator"><Regulator /></Guard>} />
            <Route path="/admin" element={<Guard role="admin"><Admin /></Guard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
    </ToastProvider>
  );
}
