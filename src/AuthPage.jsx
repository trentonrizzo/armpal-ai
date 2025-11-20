import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [session, setSession] = useState(null)

  // ✅ Check if a user is already logged in when the app loads
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // ✅ Sign up with email & password
  async function handleSignUp() {
    const { error } = await supabase.auth.signUp({ email, password })
    setMessage(error ? error.message : '✅ Check your email for the confirmation link!')
  }

  // ✅ Sign in with email & password
  async function handleSignIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMessage(error ? error.message : '✅ Signed in successfully!')
  }

  // ✅ Sign out
  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    setMessage(error ? error.message : '✅ Signed out successfully!')
  }

  // ✅ If the user is logged in, show a welcome screen
  if (session) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        textAlign: 'center'
      }}>
        <h1>Welcome back to ArmPal 💪</h1>
        <p style={{ marginBottom: 20 }}>You're signed in as <b>{session.user.email}</b></p>
        <button onClick={handleSignOut} style={{
          padding: '10px 20px',
          background: '#ff5555',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer'
        }}>Sign Out</button>
        {message && <p style={{ marginTop: 15 }}>{message}</p>}
      </div>
    )
  }

  // ✅ If no user is logged in, show the login form
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      textAlign: 'center'
    }}>
      <h1>ArmPal Login</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ margin: 10, padding: 8, width: 250 }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ margin: 10, padding: 8, width: 250 }}
      />
      <div>
        <button
          onClick={handleSignIn}
          style={{
            margin: 5,
            padding: '8px 16px',
            background: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Sign In
        </button>
        <button
          onClick={handleSignUp}
          style={{
            margin: 5,
            padding: '8px 16px',
            background: '#00b37e',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Sign Up
        </button>
      </div>
      {message && <p style={{ marginTop: 15 }}>{message}</p>}
    </div>
  )
}
