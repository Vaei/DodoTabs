import ReactDOM from "react-dom/client";
import App from "./App";
// Bundled fonts (work offline on desktop/Android): Inter for UI, Space Grotesk for display.
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./styles.css";

// Note: StrictMode is intentionally omitted. alphaTab creates a render worker and
// audio worklet on mount; double-invoking the init effect (as StrictMode does in dev)
// churns those resources, so we mount the player once.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
