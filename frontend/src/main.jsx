import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { WalletProvider } from "./lib/wallet.jsx";
import "./styles.css";

// Recording mode: open any page with ?record=1 to hide dev chrome and lock the layout.
if (new URLSearchParams(window.location.search).get("record") === "1") {
  document.documentElement.classList.add("record");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <App />
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);
