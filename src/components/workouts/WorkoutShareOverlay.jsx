// src/components/workouts/WorkoutShareOverlay.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { FaShare, FaTimes, FaChevronRight } from "react-icons/fa";
import EmptyState from "../EmptyState";

/* =====================================================================================
   ARMPAL — WORKOUT SHARE OVERLAY (DOES NOT MODIFY WorkoutsPage.jsx)
   - Shows a share icon top-right ONLY on /workouts
   - Enables multi-select on existing workout cards via DOM hooks + CSS classes
   - Shows selected state: red left check + red glowing border
   - Opens a right-side friends drawer after workout selection
   - Sends selected workouts to selected friends as chat/text messages (Supabase)
   - Designed to be mounted globally (App shell / Layout), not inside WorkoutsPage

   PART 1/3:
   - Routing detector ("/workouts")
   - Injected CSS
   - Workout card discovery + selection highlighting
   - Share mode UI shell + selection stage UI (friends stage in Part 2)
===================================================================================== */

/* ---------------------------------------
   Small helper: safe string normalize
---------------------------------------- */
function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/* ---------------------------------------
   Detect route changes in SPAs
---------------------------------------- */
function usePathname() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);

    // Patch pushState/replaceState so we get events on client routing
    const { pushState, replaceState } = window.history;
    function wrap(fn) {
      return function () {
        const ret = fn.apply(this, arguments);
        window.dispatchEvent(new Event("armpal:navigate"));
        return ret;
      };
    }
    window.history.pushState = wrap(pushState);
    window.history.replaceState = wrap(replaceState);

    window.addEventListener("popstate", onPop);
    window.addEventListener("armpal:navigate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("armpal:navigate", onPop);
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
    };
  }, []);

  return path;
}

/* ---------------------------------------
   Inject CSS once
---------------------------------------- */
function useInjectStyles() {
  useEffect(() => {
    const id = "aw-workout-share-overlay-styles";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      /* ====== Overlay Container ====== */
      .aw-share-fab {
        position: fixed;
        top: 14px;
        right: 14px;
        z-index: 9999;
        width: 44px;
        height: 44px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--card);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
      }
      .aw-share-fab:hover {
        border-color: color-mix(in srgb, var(--accent) 35%, transparent);
      }

      /* ====== Share Mode Bar ====== */
      .aw-share-topbar {
        position: fixed;
        top: 10px;
        left: 10px;
        right: 10px;
        z-index: 9999;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: var(--card);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.45);
      }
      .aw-share-topbar .aw-title {
        font-weight: 800;
        font-size: 14px;
        letter-spacing: 0.2px;
      }
      .aw-share-topbar .aw-sub {
        font-size: 12px;
        opacity: 0.75;
      }
      .aw-share-pill {
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--border);
        color: var(--text);
        font-weight: 700;
        cursor: pointer;
      }
      .aw-share-pill.aw-primary {
        border: none;
        background: "var(--accent)";
        box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 35%, transparent);
      }
      .aw-share-pill:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      /* ====== Workout Card Selection Highlight ====== */
      .aw-share-selectable {
        position: relative;
        cursor: pointer;
      }
      .aw-share-selected {
        outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent), 0 0 18px color-mix(in srgb, var(--accent) 35%, transparent);
        border-radius: 12px;
      }
      .aw-share-selected::before {
        content: "✓";
        position: absolute;
        left: 10px;
        top: 10px;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: "var(--accent)";
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 13px;
        box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 35%, transparent);
        z-index: 3;
      }

      /* ====== Dim page slightly in share mode ====== */
      .aw-share-dim {
        position: fixed;
        inset: 0;
        z-index: 9998;
        background: rgba(0,0,0,0.25);
        backdrop-filter: blur(1px);
      }
    `;
    document.head.appendChild(style);
  }, []);
}

/* ---------------------------------------
   Find workout cards (best-effort DOM mapping)
   We do NOT modify WorkoutsPage.jsx, so we must detect cards.
---------------------------------------- */
function findWorkoutCardNodes() {
  // Heuristic for your cards: background "#0f0f0f", borderRadius 12, marginBottom 10, padding 14
  // In prod, inline style may be minified; so we also check for "Workouts" layout container by proximity.
  const allDivs = Array.from(document.querySelectorAll("div"));
  const candidates = [];

  for (const el of allDivs) {
    const st = el.style;
    if (!st) continue;

    // heuristics: we detect the workout card container from your current UI style usage
    const bg = (st.background || "").toLowerCase();
    const br = (st.borderRadius || "").toLowerCase();
    const pad = (st.padding || "").toLowerCase();

    const looksLikeWorkoutCard =
      (bg === "#0f0f0f" || bg.includes("rgb(15") || bg.includes("15, 15, 15")) &&
      (br === "12px" || br.includes("12")) &&
      (pad === "14px" || pad.includes("14"));

    if (looksLikeWorkoutCard) candidates.push(el);
  }

  // Filter out nested exercise cards (#151515) if any slipped in
  const filtered = candidates.filter((el) => {
    const bg = (el.style.background || "").toLowerCase();
    return bg !== "#151515";
  });

  return filtered;
}

/* ---------------------------------------
   Extract workout name from a card node
---------------------------------------- */
function extractWorkoutTitle(card) {
  // In your UI, workout name is a <p> with fontWeight 600 near top
  const ps = Array.from(card.querySelectorAll("p"));
  if (ps.length === 0) return "";

  // pick the first p that isn't "Not scheduled" / date-like and has some length
  for (const p of ps) {
    const t = (p.textContent || "").trim();
    if (!t) continue;
    if (t.toLowerCase().includes("scheduled")) continue;
    if (t.length >= 2 && t.length <= 60) return t;
  }
  return (ps[0].textContent || "").trim();
}

/* =====================================================================================
   COMPONENT
===================================================================================== */
export default function WorkoutShareOverlay() {
  useInjectStyles();

  const pathname = usePathname();
  const isWorkoutsRoute = useMemo(() => pathname === "/workouts", [pathname]);

  // Auth + data
  const [userId, setUserId] = useState(null);
  const [workouts, setWorkouts] = useState([]); // {id,name,position,...}
  const workoutByName = useMemo(() => {
    const m = new Map();
    for (const w of workouts) m.set(norm(w.name), w);
    return m;
  }, [workouts]);

  // Share mode
  const [shareMode, setShareMode] = useState(false);
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState(() => new Set());

  // Stage: workouts -> friends (friends stage in Part 2)
  const [stage, setStage] = useState("workouts"); // "workouts" | "friends"

  // DOM control
  const observerRef = useRef(null);
  const wiredNodesRef = useRef(new WeakSet());

  /* ---------------------------------------
     Load user + workouts when on /workouts
  ---------------------------------------- */
  useEffect(() => {
    if (!isWorkoutsRoute) return;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || null;
      setUserId(uid);

      if (!uid) return;

      const { data: ws } = await supabase
        .from("workouts")
        .select("id,name,position,scheduled_for")
        .eq("user_id", uid)
        .order("position", { ascending: true });

      setWorkouts(ws || []);
    })();
  }, [isWorkoutsRoute]);

  /* ---------------------------------------
     Exit share mode whenever route changes away
  ---------------------------------------- */
  useEffect(() => {
    if (!isWorkoutsRoute) {
      setShareMode(false);
      setStage("workouts");
      setSelectedWorkoutIds(new Set());
    }
  }, [isWorkoutsRoute]);

  /* ---------------------------------------
     Apply / remove DOM selection behavior
  ---------------------------------------- */
  useEffect(() => {
    if (!isWorkoutsRoute) return;

    // Helper to wire all current cards
    const wireCards = () => {
      const cards = findWorkoutCardNodes();

      for (const card of cards) {
        if (wiredNodesRef.current.has(card)) continue;

        // mark wired
        wiredNodesRef.current.add(card);

        // make selectable class always present (so cursor looks right only in mode)
        card.classList.add("aw-share-selectable");

        // Capture clicks so we can toggle selection without triggering expand/edit
        const onClickCapture = (e) => {
          if (!shareMode) return;

          // If user clicks edit/delete icons, ignore (we don't want to toggle selection)
          // icons are SVG paths; just let those clicks through
          const target = e.target;
          const tag = (target && target.tagName) ? target.tagName.toLowerCase() : "";
          if (tag === "svg" || tag === "path") {
            // If click is on the header icons row, do not toggle selection.
            // But SVG is used for chevrons too; safest: allow toggling only when clicking card body,
            // not icons area. We'll detect with closest button-like.
            const iconWrap = target.closest("svg");
            if (iconWrap) return;
          }

          // Prevent WorkoutsPage click handlers from firing in share mode
          e.preventDefault();
          e.stopPropagation();

          // Identify workout by title matching
          const title = extractWorkoutTitle(card);
          const w = workoutByName.get(norm(title));

          if (!w?.id) return;

          setSelectedWorkoutIds((prev) => {
            const next = new Set(prev);
            if (next.has(w.id)) next.delete(w.id);
            else next.add(w.id);
            return next;
          });
        };

        card.addEventListener("click", onClickCapture, true);

        // Store remover on element
        card.__awShareCleanup = () => {
          card.removeEventListener("click", onClickCapture, true);
          card.classList.remove("aw-share-selectable");
          card.classList.remove("aw-share-selected");
        };
      }

      // Update selected classes based on state
      for (const card of cards) {
        const title = extractWorkoutTitle(card);
        const w = workoutByName.get(norm(title));
        const selected = w?.id && selectedWorkoutIds.has(w.id);
        if (selected) card.classList.add("aw-share-selected");
        else card.classList.remove("aw-share-selected");
      }
    };

    // wire immediately
    wireCards();

    // Observe DOM changes (expand/collapse, reorder, etc.)
    if (!observerRef.current) {
      observerRef.current = new MutationObserver(() => wireCards());
      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      // Keep observer for route but stop when leaving route or unmount
      if (observerRef.current && !isWorkoutsRoute) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [isWorkoutsRoute, shareMode, workoutByName, selectedWorkoutIds]);

  /* ---------------------------------------
     Toggle share mode
  ---------------------------------------- */
  function enterShareMode() {
    setShareMode(true);
    setStage("workouts");
    setSelectedWorkoutIds(new Set());
  }

  function exitShareMode() {
    setShareMode(false);
    setStage("workouts");
    setSelectedWorkoutIds(new Set());

    // Remove selected class from any wired nodes
    const cards = findWorkoutCardNodes();
    for (const c of cards) c.classList.remove("aw-share-selected");
  }

  function goToFriendsStage() {
    if (selectedWorkoutIds.size === 0) return;
    setStage("friends");
  }

  /* =====================================================================================
     RENDER (PART 1 UI ONLY — friends drawer + sending logic in PART 2)
  ===================================================================================== */
  if (!isWorkoutsRoute) return null;

  return (
    <>
      {/* Dim overlay only in share mode */}
      {shareMode && <div className="aw-share-dim" />}

      {/* Floating Share Icon (top-right) */}
      {!shareMode && (
        <div
          className="aw-share-fab"
          onClick={enterShareMode}
          title="Share Workouts"
        >
          <FaShare color="var(--text)" />
        </div>
      )}

      {/* Top bar while in Share Mode */}
      {shareMode && (
        <div className="aw-share-topbar">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className="aw-title">Share Workouts</div>
            <div className="aw-sub">
              {stage === "workouts"
                ? `Select workouts (${selectedWorkoutIds.size} selected)`
                : "Select friends"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {stage === "workouts" ? (
              <button
                className="aw-share-pill aw-primary"
                disabled={selectedWorkoutIds.size === 0}
                onClick={goToFriendsStage}
              >
                Next <FaChevronRight style={{ marginLeft: 6 }} />
              </button>
            ) : (
              <button
                className="aw-share-pill"
                onClick={() => setStage("workouts")}
              >
                Back
              </button>
            )}

            <button className="aw-share-pill" onClick={exitShareMode}>
              <FaTimes style={{ marginRight: 6 }} />
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
/* =====================================================================================
   PART 2 — FRIENDS DRAWER (RIGHT SIDE) + FRIEND SELECTION
===================================================================================== */

/* ---------------------------------------
   Friend selection state
---------------------------------------- */
const [friends, setFriends] = useState([]);
const [selectedFriendIds, setSelectedFriendIds] = useState(() => new Set());
const [loadingFriends, setLoadingFriends] = useState(false);

/* ---------------------------------------
   Load friends (accepted only)
   Sorted by most recent chat if available
---------------------------------------- */
useEffect(() => {
  if (!shareMode || stage !== "friends" || !userId) return;

  (async () => {
    setLoadingFriends(true);

    // Load accepted friends
    const { data: fr } = await supabase
      .from("friends")
      .select(`
        friend_id,
        profiles:friend_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq("user_id", userId)
      .eq("status", "accepted");

    let list =
      fr?.map((f) => ({
        id: f.profiles.id,
        name:
          f.profiles.display_name ||
          f.profiles.username ||
          "Friend",
        avatar: f.profiles.avatar_url,
        lastMessageAt: null,
      })) || [];

    // OPTIONAL: try to sort by most recent chat activity if messages table exists
    try {
      const { data: msgs } = await supabase
        .from("messages")
        .select("receiver_id, sender_id, created_at")
        .or(
          `sender_id.eq.${userId},receiver_id.eq.${userId}`
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (msgs?.length) {
        const lastMap = new Map();

        for (const m of msgs) {
          const other =
            m.sender_id === userId
              ? m.receiver_id
              : m.sender_id;
          if (!lastMap.has(other)) {
            lastMap.set(other, m.created_at);
          }
        }

        list = list.map((f) => ({
          ...f,
          lastMessageAt: lastMap.get(f.id) || null,
        }));

        list.sort((a, b) => {
          if (!a.lastMessageAt && !b.lastMessageAt) return 0;
          if (!a.lastMessageAt) return 1;
          if (!b.lastMessageAt) return -1;
          return (
            new Date(b.lastMessageAt) -
            new Date(a.lastMessageAt)
          );
        });
      }
    } catch (e) {
      // messages table might not exist yet — safe ignore
    }

    setFriends(list);
    setLoadingFriends(false);
  })();
}, [shareMode, stage, userId]);

/* ---------------------------------------
   Toggle friend selection
---------------------------------------- */
function toggleFriend(id) {
  setSelectedFriendIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

/* =====================================================================================
   FRIENDS DRAWER UI
===================================================================================== */
{shareMode && stage === "friends" && (
  <div
    style={{
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      width: "86%",
      maxWidth: 360,
      background: "#0b0b0b",
      borderLeft: "1px solid var(--border)",
      zIndex: 10000,
      padding: "16px 12px",
      boxShadow: "-20px 0 40px rgba(0,0,0,0.6)",
      display: "flex",
      flexDirection: "column",
      animation: "aw-slide-in 0.25s ease-out",
    }}
  >
    <style>{`
      @keyframes aw-slide-in {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
    `}</style>

    <h3
      style={{
        margin: "4px 0 10px",
        fontSize: 16,
        fontWeight: 800,
      }}
    >
      Send to Friends
    </h3>

    <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
      Select one or more friends
    </p>

    <div
      style={{
        flex: 1,
        overflowY: "auto",
        paddingRight: 4,
      }}
    >
      {loadingFriends && (
        <p style={{ opacity: 0.6 }}>Loading friends…</p>
      )}

      {!loadingFriends && friends.length === 0 && (
        <EmptyState icon="👋" message="No friends yet — add friends from the Friends page." />
      )}

      {friends.map((f) => {
        const selected = selectedFriendIds.has(f.id);

        return (
          <div
            key={f.id}
            onClick={() => toggleFriend(f.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 10,
              borderRadius: 12,
              marginBottom: 8,
              cursor: "pointer",
              background: selected
                ? "color-mix(in srgb, var(--accent) 35%, transparent)"
                : "var(--border)",
              border: selected
                ? "1px solid color-mix(in srgb, var(--accent) 35%, transparent)"
                : "1px solid var(--border)",
              boxShadow: selected
                ? "0 0 18px color-mix(in srgb, var(--accent) 35%, transparent)"
                : "none",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "#000",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
              }}
            >
              {f.name.charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>
                {f.name}
              </div>
            </div>

            {selected && (
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: "var(--accent)",
                  color: "white",
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✓
              </div>
            )}
          </div>
        );
      })}
    </div>

    <button
      disabled={selectedFriendIds.size === 0}
      style={{
        marginTop: 10,
        padding: "12px",
        borderRadius: 12,
        border: "none",
        background:
          selectedFriendIds.size === 0
            ? "#444"
            : "var(--accent)",
        color: "white",
        fontWeight: 800,
        cursor:
          selectedFriendIds.size === 0
            ? "not-allowed"
            : "pointer",
      }}
    >
      Send ({selectedFriendIds.size})
    </button>
  </div>
)}
/* =====================================================================================
   PART 3 — BUILD PAYLOADS + SEND AS CHAT/TEXT + CLEANUP
===================================================================================== */

/* ---------------------------------------
   Helpers
---------------------------------------- */
async function loadExercisesForWorkout(workoutId) {
  const { data } = await supabase
    .from("exercises")
    .select("*")
    .eq("workout_id", workoutId)
    .order("position", { ascending: true });

  return data || [];
}

function buildWorkoutPayload(workout, exercises) {
  return {
    type: "workout_share",
    workout: {
      id: workout.id,
      name: workout.name,
      scheduled_for: workout.scheduled_for || null,
    },
    exercises: exercises.map((ex) => ({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      position: ex.position,
    })),
    sent_at: new Date().toISOString(),
  };
}

/* ---------------------------------------
   SEND SELECTED WORKOUTS TO SELECTED FRIENDS
---------------------------------------- */
async function sendSelectedWorkouts() {
  if (!userId) return;
  if (selectedWorkoutIds.size === 0) return;
  if (selectedFriendIds.size === 0) return;

  // Build all workout payloads first
  const selectedWorkouts = workouts.filter((w) =>
    selectedWorkoutIds.has(w.id)
  );

  const payloads = [];

  for (const w of selectedWorkouts) {
    const exercises = await loadExercisesForWorkout(w.id);
    payloads.push(buildWorkoutPayload(w, exercises));
  }

  // Send messages (one message per workout per friend)
  const inserts = [];
  const now = new Date().toISOString();

  for (const friendId of selectedFriendIds) {
    for (const payload of payloads) {
      inserts.push({
        sender_id: userId,
        receiver_id: friendId,
        message_type: "workout",
        content: payload,
        created_at: now,
      });
    }
  }

  if (inserts.length === 0) return;

  const { error } = await supabase.from("messages").insert(inserts);

  if (error) {
    console.error("Workout share failed:", error);
    alert("Failed to send workouts. Try again.");
    return;
  }

  // CLEAN EXIT
  exitShareMode();
}

/* ---------------------------------------
   Wire SEND button (friends drawer)
---------------------------------------- */
useEffect(() => {
  if (!shareMode || stage !== "friends") return;

  const btn = document.querySelector(
    ".aw-share-send-btn"
  );
  if (!btn) return;

  const onClick = () => {
    sendSelectedWorkouts();
  };

  btn.addEventListener("click", onClick);
  return () => btn.removeEventListener("click", onClick);
}, [shareMode, stage, selectedFriendIds, selectedWorkoutIds]);

/* ---------------------------------------
   Patch SEND button class on render
---------------------------------------- */
useEffect(() => {
  if (!shareMode || stage !== "friends") return;

  const btns = document.querySelectorAll("button");
  btns.forEach((b) => {
    if (b.textContent?.startsWith("Send (")) {
      b.classList.add("aw-share-send-btn");
    }
  });
}, [shareMode, stage]);

/* ---------------------------------------
   HARD SAFETY CLEANUP ON UNMOUNT
---------------------------------------- */
useEffect(() => {
  return () => {
    try {
      exitShareMode();
    } catch {}
  };
}, []);
