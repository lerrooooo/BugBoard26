import { useState } from "react";

const API_BASE_URL = "http://localhost:5237";

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Email o password non validi.");
      }

      const data = await res.json();
      localStorage.setItem("bugboard_token", data.token);

      setStatus("idle");
      onLoginSuccess?.(data);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Errore di connessione al server.");
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.scanline} aria-hidden="true" />

      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <span style={styles.logoBracket}>{"//"}</span>
            <span style={styles.logoText}>bugboard</span>
            <span style={styles.logoVersion}>26</span>
          </div>
          <p style={styles.tagline}>accedi al tracker per continuare</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="email">
            <span style={styles.labelIndex}>01</span> email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            placeholder="tu@esempio.dev"
          />

          <label style={styles.label} htmlFor="password">
            <span style={styles.labelIndex}>02</span> password
          </label>
          <div style={styles.passwordWrap}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...styles.input, marginBottom: 0, paddingRight: 64 }}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={styles.toggleBtn}
            >
              {showPassword ? "nascondi" : "mostra"}
            </button>
          </div>

          {status === "error" && (
            <div style={styles.errorBox} role="alert">
              <span style={styles.errorTag}>errore</span> {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            style={{
              ...styles.submitBtn,
              opacity: status === "loading" ? 0.6 : 1,
              cursor: status === "loading" ? "not-allowed" : "pointer",
            }}
          >
            {status === "loading" ? "verifica in corso…" : "entra →"}
          </button>
        </form>

        <div style={styles.footer}>
          <span style={styles.footerDot} />
          connessione cifrata al backend
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#0d1117",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily:
      "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
    position: "relative",
    overflow: "hidden",
    padding: 24,
  },
  scanline: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(180deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
    backgroundSize: "100% 3px",
    pointerEvents: "none",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "#11161d",
    border: "1px solid #232b36",
    borderRadius: 6,
    padding: "32px 28px",
    boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 20px 60px rgba(0,0,0,0.5)",
    position: "relative",
    zIndex: 1,
  },
  header: {
    marginBottom: 28,
  },
  logoRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
  },
  logoBracket: {
    color: "#5fd0a8",
    fontSize: 18,
    fontWeight: 700,
  },
  logoText: {
    color: "#f0f3f7",
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  logoVersion: {
    color: "#5fd0a8",
    fontSize: 13,
    fontWeight: 700,
    background: "rgba(95,208,168,0.12)",
    borderRadius: 4,
    padding: "1px 6px",
  },
  tagline: {
    color: "#7d8b9c",
    fontSize: 13,
    marginTop: 8,
  },
  form: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    color: "#9aa7b5",
    fontSize: 12,
    marginBottom: 6,
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  labelIndex: {
    color: "#4a5568",
    fontSize: 11,
  },
  input: {
    background: "#0a0e13",
    border: "1px solid #232b36",
    borderRadius: 4,
    padding: "10px 12px",
    color: "#e6edf3",
    fontSize: 14,
    fontFamily: "inherit",
    marginBottom: 18,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  passwordWrap: {
    position: "relative",
    marginBottom: 18,
  },
  toggleBtn: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    color: "#5fd0a8",
    fontSize: 11,
    cursor: "pointer",
    padding: "4px 6px",
  },
  errorBox: {
    background: "rgba(240,113,103,0.08)",
    border: "1px solid rgba(240,113,103,0.3)",
    borderRadius: 4,
    padding: "8px 10px",
    color: "#f09b96",
    fontSize: 12.5,
    marginBottom: 16,
  },
  errorTag: {
    color: "#f07167",
    fontWeight: 700,
    marginRight: 4,
  },
  submitBtn: {
    background: "#5fd0a8",
    border: "none",
    borderRadius: 4,
    padding: "11px 16px",
    color: "#08130f",
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "inherit",
    letterSpacing: "0.01em",
  },
  footer: {
    marginTop: 22,
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#4a5568",
    fontSize: 11,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#5fd0a8",
    display: "inline-block",
  },
};
