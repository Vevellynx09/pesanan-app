"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Anchor, LogIn } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    router.replace("/");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setError("Email atau password salah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">
            <Anchor size={18} />
          </div>
          <div>
            <div className="display" style={{ fontSize: 16 }}>
              Sales Logistics
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Login Admin Pesanan Customer
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field-label">Email Admin</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@perusahaan.com"
            />
          </div>
          <div className="field" style={{ marginBottom: 6 }}>
            <label className="field-label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
            disabled={busy}
          >
            <LogIn size={15} />
            {busy ? "Memproses..." : "Masuk"}
          </button>
        </form>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 16 }}>
          Akun admin dibuat lewat Firebase Console &gt; Authentication.
          Hanya ada satu peran di sistem ini: admin.
        </p>
      </div>
    </div>
  );
}
