// Toasts: top right under the top bar. Success hides after 5 s; errors stay until dismissed.
import { createContext, useCallback, useContext, useState } from "react";
import Icon from "./Icon.jsx";

const ToastContext = createContext({ ok: () => {}, error: () => {} });

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
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
            <div className="ico">{t.kind === "saving" ? <span className="spin dark lg" /> : <Icon name={t.kind === "error" ? "error" : "check_circle"} fill />}</div>
            <div className="body">
              <div className="t">{t.title}</div>
              {t.body ? <div className="s">{t.body}</div> : null}
              {t.action ? <button className="linkbtn act" style={{ color: "var(--accent)", fontWeight: 600 }} onClick={() => { t.action.onClick?.(); remove(t.id); }}>{t.action.label}</button> : null}
            </div>
            <button className="dismiss" onClick={() => remove(t.id)}>Dismiss</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
