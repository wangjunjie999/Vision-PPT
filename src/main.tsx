import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

function showBootstrapError(error: unknown, context: string) {
  console.error(`[Bootstrap] ${context}`, error);

  const root = document.getElementById("root");
  if (!root || root.hasChildNodes()) return;

  const container = document.createElement("div");
  Object.assign(container.style, {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    color: "#111827",
    background: "#ffffff",
  });

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    maxWidth: "560px",
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
  });

  const title = document.createElement("h1");
  title.textContent = "Application failed to start";
  Object.assign(title.style, { margin: "0 0 8px", fontSize: "20px" });

  const message = document.createElement("p");
  message.textContent = "Open the browser console for the bootstrap error details.";
  Object.assign(message.style, { margin: "0", color: "#4b5563", lineHeight: "1.5" });

  panel.append(title, message);
  container.append(panel);
  root.append(container);
}

window.addEventListener("error", (event) => {
  showBootstrapError(event.error ?? event.message, "Unhandled window error");
});

window.addEventListener("unhandledrejection", (event) => {
  showBootstrapError(event.reason, "Unhandled promise rejection");
});

try {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Missing #root element");
  }

  createRoot(root).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
} catch (error) {
  showBootstrapError(error, "React bootstrap failed");
}
