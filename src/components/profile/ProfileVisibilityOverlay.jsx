import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { useAppTheme } from "../../context/ThemeContext";

export default function ProfileVisibilityOverlay({ userId }) {
  const { accent, mode } = useAppTheme();
  const [visibility, setVisibility] = useState("private");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!userId) return;

    supabase
      .from("profiles")
      .select("profile_visibility")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data?.profile_visibility) {
          setVisibility(data.profile_visibility);
        }
      });
  }, [userId]);

  const toggleVisibility = async () => {
    if (loading || !userId) return;

    const next = visibility === "private" ? "public" : "private";
    setVisibility(next);
    setLoading(true);

    setToast(
      next === "public"
        ? "Your profile is now public."
        : "Only friends can view your profile."
    );

    await supabase.from("profiles").update({ profile_visibility: next }).eq("id", userId);

    setTimeout(() => setToast(null), 2000);
    setLoading(false);

    if (navigator?.vibrate) navigator.vibrate(8);
  };

  const isPublic = visibility === "public";
  const bg = mode === "dark" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.9)";

  return (
    <>
      {/* TOGGLE */}
      <div
        style={{
          position: "absolute",
          top: 64,
          right: 16,
          zIndex: 30,
          pointerEvents: "auto",
        }}
      >
        <button
          onClick={toggleVisibility}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 14px",
            borderRadius: 999,
            border: `1.5px solid ${accent}`,
            background: bg,
            color: accent,
            fontWeight: 600,
            fontSize: 13,
            backdropFilter: "blur(12px)",
            cursor: "pointer",
          }}
        >
          <span>{isPublic ? "Public" : "Private"}</span>
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            style={{
              width: 36,
              height: 18,
              borderRadius: 999,
              background: isPublic ? accent : "#999",
              position: "relative",
            }}
          >
            <motion.div
              layout
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#fff",
                position: "absolute",
                top: 2,
                left: isPublic ? 20 : 2,
              }}
            />
          </motion.div>
        </button>
      </div>

      {/* TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={{
              position: "fixed",
              top: 90,
              left: "50%",
              transform: "translateX(-50%)",
              background: bg,
              color: accent,
              padding: "10px 18px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              border: `1.5px solid ${accent}`,
              zIndex: 100,
              backdropFilter: "blur(14px)",
              pointerEvents: "none",
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
