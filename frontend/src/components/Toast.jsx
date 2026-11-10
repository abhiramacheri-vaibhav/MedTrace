// Toasts, top right under the top bar. Pip reacts; success throws a little confetti and hides after
// 5 s; errors stay until dismissed and offer Try again.
import { createContext, useCallback, useContext, useState } from "react";
import Confetti from "./Confetti.jsx";
import Pip from "./Pip.jsx";

const ToastContext = createContext({ ok: () => {}, error: () => {} });
const KIND = { success: { mood: "party", color: "#18B26B" }, error: { mood: "worried", color: "#F0483E" }, saving: { mood: "wait", color: "#FFB020" } };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const remove = useCallback((id) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((kind, title, body, action) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, kind, title, body, action }]);
    if (kind === "success") setTimeout(() => remove(id), 5000);
  }, [remove]);
  const api = {
    ok: (title, body = "Saved on the blockchain.") => push("success", title, body),
    error: (title, body, action) => push("error", title, body, action),
  };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => {
          const k = KIND[t.kind] || KIND.success;
          return (
            <div key={t.id} className={`toast ${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
              {t.kind === "success" ? <Confetti count={18} distance={130} seed={Math.round(t.id) % 97} /> : null}
              <div className="t-pip"><Pip size={64} mood={k.mood} color={k.color} /></div>
              <div className="t-body">
                <span className="t">{t.title}</span>
                {t.body ? <span className="s">{t.body}</span> : null}
                {t.action ? <button className="btn white xs act" onClick={() => { remove(t.id); t.action.onClick?.(); }}>{t.action.label}</button> : null}
              </div>
              <button className="dismiss" onClick={() => remove(t.id)}>Dismiss</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
