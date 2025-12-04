// src/AuthPage.jsx
import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login"); // login | signup

  async function handleAuth(e) {
    e.preventDefault();
    setLoading(true);

    try {
      let result;

      if (mode === "login") {
        result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      } else {
        result = await supabase.auth.signUp({
          email,
          password,
        });
      }

      if (result.error) {
        alert(result.error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center px-6">

      {/* ====== CARD ====== */}
      <div
        className="
          w-full max-w-sm p-8 rounded-2xl relative
          bg-[#0a0a0a] border border-[#1a1a1a]
          shadow-[0_0_15px_rgba(255,0,0,0.35)]
        "
        style={{
          boxShadow: `
            0 0 18px rgba(255, 0, 0, 0.35),
            inset 0 0 12px rgba(255, 0, 0, 0.20)
          `,
        }}
      >
        {/* HEADER */}
        <h1 className="text-3xl font-extrabold text-white text-center mb-2 tracking-wide">
          Arm<span className="text-red-500">Pal</span>
        </h1>

        <p className="text-center text-sm text-neutral-400 mb-6">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </p>

        {/* FORM */}
        <form onSubmit={handleAuth} className="space-y-4">

          {/* EMAIL */}
          <input
            type="email"
            required
            placeholder="Email"
            className="w-full p-3 rounded-lg bg-black border border-neutral-700 text-white text-sm focus:border-red-500 outline-none transition"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {/* PASSWORD */}
          <input
            type="password"
            required
            placeholder="Password"
            className="w-full p-3 rounded-lg bg-black border border-neutral-700 text-white text-sm focus:border-red-500 outline-none transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* SUBMIT BUTTON */}
          <button
            disabled={loading}
            className="
              w-full py-3 rounded-lg font-bold text-white text-sm
              bg-red-600 hover:bg-red-700 transition
              shadow-[0_0_10px_rgba(255,0,0,0.4)]
            "
          >
            {loading
              ? "Please wait…"
              : mode === "login"
              ? "Log In"
              : "Sign Up"}
          </button>
        </form>

        {/* SWITCH MODE */}
        <div className="text-center mt-5 text-neutral-400 text-xs">
          {mode === "login" ? (
            <span>
              Don’t have an account?{" "}
              <button
                onClick={() => setMode("signup")}
                className="text-red-500 font-semibold hover:underline"
              >
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-red-500 font-semibold hover:underline"
              >
                Log in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
