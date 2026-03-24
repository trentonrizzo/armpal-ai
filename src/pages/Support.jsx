import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import { useToast } from "../components/ToastProvider";

export default function Support() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const backToSettingsLegal = () => {
    navigate("/profile", {
      replace: true,
      state: { openSettings: true, openLegal: true },
    });
  };
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      setUserId(u?.id || null);
      if (u?.email) setEmail(u.email);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedEmail = (email || "").trim();
    const trimmedSubject = (subject || "").trim();
    const trimmedMessage = (message || "").trim();
    if (!trimmedEmail || !trimmedSubject || !trimmedMessage) return;

    setLoading(true);
    try {
      const { error: insertError } = await supabase.from("support_requests").insert([
        {
          user_id: userId,
          email: trimmedEmail,
          subject: trimmedSubject,
          message: trimmedMessage,
          created_at: new Date().toISOString(),
        },
      ]);

      if (insertError) throw insertError;
      toast.success("Message sent");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      toast.error(err?.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: "16px 16px calc(110px + var(--safe-area-bottom))",
        paddingTop: "calc(16px + var(--safe-area-top))",
        maxWidth: 560,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
        color: "var(--text)",
      }}
    >
      <div
        style={{
          position: "relative",
          padding: "4px 52px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={() =>
            location.state?.fromSettingsLegal
              ? backToSettingsLegal()
              : navigate("/", { replace: true })
          }
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            width: 36,
            height: 36,
            borderRadius: 18,
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <FaArrowLeft size={18} />
        </button>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            margin: 0,
            textAlign: "center",
          }}
        >
          Contact Support
        </h1>
      </div>
      <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 20 }}>
        Send us a message and we&apos;ll get back to you as soon as we can.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          background: "var(--card)",
          borderRadius: 14,
          padding: 18,
          border: "1px solid var(--border)",
        }}
      >
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text)",
            fontSize: 14,
            marginBottom: 14,
            boxSizing: "border-box",
          }}
        />

        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief subject"
          required
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text)",
            fontSize: 14,
            marginBottom: 14,
            boxSizing: "border-box",
          }}
        />

        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Your message..."
          required
          rows={5}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text)",
            fontSize: 14,
            marginBottom: 18,
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 14,
            background: "var(--accent)",
            border: "none",
            color: "#fff",
            fontWeight: 800,
            fontSize: 15,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending..." : "Submit"}
        </button>
      </form>

      <div
        style={{
          marginTop: 16,
          background: "var(--card)",
          borderRadius: 14,
          padding: 16,
          border: "1px solid var(--border)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Or contact us directly</h2>
        <p style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
          If you prefer, you can email us at:
        </p>
        <a
          href="mailto:armpalofficial@gmail.com"
          style={{
            display: "inline-block",
            marginTop: 8,
            color: "var(--accent)",
            textDecoration: "underline",
            fontWeight: 700,
            wordBreak: "break-word",
          }}
        >
          armpalofficial@gmail.com
        </a>
      </div>

      <p style={{ marginTop: 20, fontSize: 13, opacity: 0.8 }}>
        <a
          href="/privacy.html"
          style={{ color: "var(--accent)", textDecoration: "underline", marginRight: 12 }}
        >
          Privacy Policy
        </a>
        <Link
          to="/terms"
          style={{ color: "var(--accent)", textDecoration: "underline" }}
        >
          Terms of Service
        </Link>
      </p>
    </div>
  );
}
