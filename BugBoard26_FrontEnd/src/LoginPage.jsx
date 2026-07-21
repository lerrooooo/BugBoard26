import { useState } from "react";

const API_BASE_URL = "http://localhost:8080";

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
            <style>{`
                .bugboard-field {
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                }
                .bugboard-field:hover {
                    border-color: #b3b3b3;
                }
                .bugboard-field:focus {
                    border-color: #337ab7;
                    box-shadow: 0 0 0 3px rgba(51, 122, 183, 0.15);
                }
            `}</style>
            <div style={styles.card}>
                <div style={styles.header}>
                    <h1 style={styles.logoText}>BugBoard</h1>
                    <p style={styles.tagline}>Accedi per continuare</p>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <label style={styles.label} htmlFor="email">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        required
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={styles.input}
                        className="bugboard-field"
                        placeholder="tu@esempio.dev"
                    />

                    <label style={styles.label} htmlFor="password">
                        Password
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
                            className="bugboard-field"
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
                        {status === "loading" ? "Accesso in corso..." : "Accedi"}
                    </button>
                </form>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        width: "100%",
        background: "#f2f2f2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: 20,
    },
    card: {
        width: "100%",
        maxWidth: 360,
        background: "#ffffff",
        border: "1px solid #ccc",
        borderRadius: 6,
        padding: "30px 25px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
    },
    header: {
        marginBottom: 25,
        textAlign: "center",
    },
    logoText: {
        color: "#222",
        fontSize: 22,
        fontWeight: "bold",
        margin: 0,
    },
    tagline: {
        color: "#777",
        fontSize: 13,
        marginTop: 6,
    },
    form: {
        display: "flex",
        flexDirection: "column",
    },
    label: {
        color: "#444",
        fontSize: 13,
        marginBottom: 5,
    },
    input: {
        border: "1px solid #d9d9d9",
        borderRadius: 8,
        padding: "10px 12px",
        color: "#222",
        fontSize: 14,
        fontFamily: "inherit",
        marginBottom: 16,
        outline: "none",
        width: "100%",
        boxSizing: "border-box", 
        background: "#fafafa",
    },
    passwordWrap: {
        position: "relative",
        marginBottom: 16,
    },
    toggleBtn: {
        position: "absolute",
        right: 8,
        top: "50%",
        transform: "translateY(-50%)",
        background: "transparent",
        border: "none",
        color: "#337ab7",
        fontSize: 12,
        cursor: "pointer",
    },
    errorBox: {
        background: "#f2dede",
        border: "1px solid #ebccd1",
        borderRadius: 4,
        padding: "8px 10px",
        color: "#a94442",
        fontSize: 13,
        marginBottom: 15,
    },
    errorTag: {
        fontWeight: "bold",
        marginRight: 4,
    },
    submitBtn: {
        background: "#337ab7",
        border: "none",
        borderRadius: 4,
        padding: "10px 16px",
        color: "#fff",
        fontWeight: "bold",
        fontSize: 14,
        fontFamily: "inherit",
    },
};