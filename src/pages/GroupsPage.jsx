// Groups list: my chat groups + pro-gated create. Opens group chat on select.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { getIsPro } from "../utils/usageLimits";
import EmptyState from "../components/EmptyState";
import { useToast } from "../components/ToastProvider";

export default function GroupsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      if (!alive) return;
      setUser(u);
      if (!u?.id) {
        setLoading(false);
        return;
      }
      const pro = await getIsPro(u.id);
      if (!alive) return;
      setIsPro(!!pro);

      const { data: memberRows, error } = await supabase
        .from("chat_group_members")
        .select("group_id")
        .eq("user_id", u.id);
      if (error || !memberRows?.length) {
        setGroups([]);
        setLoading(false);
        return;
      }
      const ids = [...new Set(memberRows.map((r) => r.group_id))];
      const { data: groupRows } = await supabase
        .from("chat_groups")
        .select("id, name, created_at")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (!alive) return;
      setGroups(groupRows ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  async function handleCreateGroup() {
    if (!user?.id || !createName.trim() || creating) return;
    if (!isPro) {
      toast.error("Pro membership required to create groups.");
      return;
    }
    setCreating(true);
    try {
      const { data: group, error: groupErr } = await supabase
        .from("chat_groups")
        .insert({ name: createName.trim(), created_by: user.id })
        .select("id")
        .single();
      if (groupErr || !group?.id) {
        toast.error(groupErr?.message || "Failed to create group");
        setCreating(false);
        return;
      }
      const { error: memberErr } = await supabase.from("chat_group_members").insert({
        group_id: group.id,
        user_id: user.id,
        role: "admin",
        added_by: user.id,
      });
      if (memberErr) {
        toast.error(memberErr.message || "Failed to add you to group");
        setCreating(false);
        return;
      }
      setCreateOpen(false);
      setCreateName("");
      setGroups((prev) => [{ id: group.id, name: createName.trim(), created_at: new Date().toISOString() }, ...prev]);
      navigate(`/chat/group/${group.id}`);
    } catch (e) {
      toast.error(e?.message || "Failed to create group");
    }
    setCreating(false);
  }

  if (!user) {
    return (
      <div style={pageWrap}>
        <p style={hint}>Sign in to see your groups.</p>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={headerRow}>
        <button type="button" onClick={() => navigate(-1)} style={backBtn}>
          ← Back
        </button>
        <h1 style={title}>Groups</h1>
      </div>

      {isPro && (
        <button type="button" onClick={() => setCreateOpen(true)} style={createBtn}>
          Create group
        </button>
      )}

      {loading ? (
        <p style={hint}>Loading…</p>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="👥"
          message={isPro ? "No groups yet — create one or get invited." : "No groups yet — join one to see it here."}
          ctaLabel={isPro ? "Create group" : null}
          ctaOnClick={isPro ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <ul style={list}>
          {groups.map((g) => (
            <li
              key={g.id}
              style={listItem}
              onClick={() => navigate(`/chat/group/${g.id}`)}
            >
              <span style={groupName}>{g.name || "Unnamed group"}</span>
            </li>
          ))}
        </ul>
      )}

      {createOpen && (
        <div style={modalBackdrop} onClick={() => !creating && setCreateOpen(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={modalTitle}>New group</h3>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Group name"
              style={input}
              autoFocus
            />
            <div style={modalActions}>
              <button type="button" style={cancelBtn} onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </button>
              <button type="button" style={submitBtn} onClick={handleCreateGroup} disabled={creating || !createName.trim()}>
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const pageWrap = { padding: "16px 16px 90px", maxWidth: 480, margin: "0 auto" };
const headerRow = { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 };
const backBtn = { background: "none", border: "none", color: "var(--text-dim)", fontSize: 14, cursor: "pointer" };
const title = { fontSize: 22, fontWeight: 800, margin: 0, color: "var(--text)" };
const createBtn = {
  display: "block",
  width: "100%",
  padding: "12px 16px",
  marginBottom: 16,
  background: "var(--accent)",
  color: "var(--text)",
  border: "none",
  borderRadius: 12,
  fontWeight: 700,
  cursor: "pointer",
};
const hint = { color: "var(--text-dim)", fontSize: 14 };
const list = { listStyle: "none", margin: 0, padding: 0 };
const listItem = {
  padding: "14px 16px",
  background: "var(--card-2)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  marginBottom: 8,
  cursor: "pointer",
};
const groupName = { fontSize: 16, fontWeight: 700, color: "var(--text)" };
const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};
const modal = {
  background: "var(--card)",
  borderRadius: 16,
  padding: 20,
  width: "100%",
  maxWidth: 360,
};
const modalTitle = { margin: "0 0 12px", fontSize: 18, fontWeight: 800 };
const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  marginBottom: 16,
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 16,
};
const modalActions = { display: "flex", gap: 12, justifyContent: "flex-end" };
const cancelBtn = { padding: "8px 16px", background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", cursor: "pointer" };
const submitBtn = { padding: "8px 16px", background: "var(--accent)", border: "none", borderRadius: 10, color: "var(--text)", fontWeight: 700, cursor: "pointer" };
