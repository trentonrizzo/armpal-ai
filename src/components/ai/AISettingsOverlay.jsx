import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";

export default function AISettingsOverlay({ onClose }) {

  const [personality, setPersonality] = useState("coach");

  useEffect(() => {

    async function loadSettings() {

      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id;

      if (!userId) return;

      const { data: settings } = await supabase
        .from("ai_settings")
        .select("personality")
        .eq("user_id", userId)
        .maybeSingle(); // 🔥 safer than single()

      if (settings?.personality) {
        setPersonality(settings.personality);
      }

    }

    loadSettings();

  }, []);

  async function saveSettings() {

    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;

    if (!userId) return;

    // 🔥 upsert guarantees row exists
    await supabase.from("ai_settings").upsert({
      user_id: userId,
      personality
    });

    onClose();
  }

  return (

    <div style={{
      position:"absolute",
      inset:0,
      background:"rgba(0,0,0,0.7)",
      display:"flex",
      justifyContent:"center",
      alignItems:"center",
      zIndex:10000
    }}>

      <div style={{
        background:"var(--card)",
        padding:20,
        borderRadius:12,
        display:"flex",
        flexDirection:"column",
        gap:10,
        minWidth:260
      }}>

        <h3>AI Personality</h3>

        {["coach","friend","motivation","assistant","science","vulgar"].map(p => (

          <button
            key={p}
            onClick={()=>setPersonality(p)}
            style={{
              background: personality === p ? "var(--accent)" : "var(--card-2)",
              border:"none",
              padding:10,
              borderRadius:8,
              color:"var(--text)",
              cursor:"pointer"
            }}
          >
            {p}
          </button>

        ))}

        <button
          onClick={saveSettings}
          style={{
            background:"var(--accent)",
            border:"none",
            padding:10,
            borderRadius:8,
            color:"#fff",
            cursor:"pointer"
          }}
        >
          Save
        </button>

      </div>

    </div>
  );
}
