import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { AiOutlineBell } from "react-icons/ai";

export default function NotificationsBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [readSet, setReadSet] = useState(() => new Set());

  const unreadCount = useMemo(() => {
    if (!user?.id) return 0;
    return items.reduce((acc, n) => (readSet.has(n.id) ? acc : acc + 1), 0);
  }, [items, readSet, user?.id]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!alive) return;
      setUser(u ?? null);
      if (u?.id) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", u.id)
          .maybeSingle()
          .then(({ data }) => {
            if (alive && data?.role) setRole(data.role);
          });
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: notifs, error } = await supabase
        .from("notifications")
        .select("id, user_id, title, body, link, created_at")
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const list = notifs ?? [];
      setItems(list);

      const ids = list.map((n) => n.id).filter(Boolean);
      if (ids.length === 0) {
        setReadSet(new Set());
        return;
      }
      const { data: reads } = await supabase
        .from("notification_reads")
        .select("notification_id")
        .eq("user_id", user.id)
        .in("notification_id", ids);
      const rs = new Set((reads ?? []).map((r) => r.notification_id));
      setReadSet(rs);
    } catch (e) {
      console.error("Notifications refresh failed", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    refresh();

    // Realtime: auto-refresh when a new notification is inserted for this user
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => { refresh(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refresh]);

  async function markRead(id) {
    if (!user?.id || !id) return;
    try {
      await supabase
        .from("notification_reads")
        .upsert({ notification_id: id, user_id: user.id }, { onConflict: "notification_id,user_id" });
      setReadSet((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } catch (e) {
      console.error("markRead failed", e);
    }
  }

  function openLink(link) {
    if (!link) return;
    if (/^https?:\/\//i.test(link)) {
      window.location.href = link;
      return;
    }
    navigate(link);
  }

  // Admin/official global create
  const canPostGlobal = role === "admin" || role === "official";
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newLink, setNewLink] = useState("");
  const [posting, setPosting] = useState(false);

  async function postGlobal() {
    if (!canPostGlobal) return;
    if (!newTitle.trim() || !newBody.trim()) return;
    setPosting(true);
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: null,
        title: newTitle.trim(),
        body: newBody.trim(),
        link: newLink.trim() || null,
      });
      if (error) throw error;
      setNewTitle("");
      setNewBody("");
      setNewLink("");
      await refresh();
      alert("Notification posted.");
    } catch (e) {
      console.error("postGlobal failed", e);
      alert(e?.message || "Failed to post notification.");
    } finally {
      setPosting(false);
    }
  }

  async function markAllRead() {
    if (!user?.id || items.length === 0) return;
    const unreadIds = items.filter((n) => !readSet.has(n.id)).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setReadSet((prev) => {
      const next = new Set(prev);
      unreadIds.forEach((id) => next.add(id));
      return next;
    });

    try {
      const rows = unreadIds.map((id) => ({ notification_id: id, user_id: user.id }));
      await supabase
        .from("notification_reads")
        .upsert(rows, { onConflict: "notification_id,user_id" });
    } catch (e) {
      console.error("markAllRead failed", e);
    }
  }

  function handleOpen() {
    const wasOpen = open;
    setOpen((v) => !v);
    if (!wasOpen) {
      markAllRead();
    }
  }

  if (!user?.id) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        style={styles.bellBtn}
        aria-label="Notifications"
        title="Notifications"
      >
        <AiOutlineBell style={{ fontSize: 22 }} />
        {unreadCount > 0 && (
          <span style={styles.badge}>{unreadCount > 99 ? "99+" : String(unreadCount)}</span>
        )}
      </button>

      {open && (
        <div style={styles.panelBackdrop} onClick={() => setOpen(false)}>
          <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
            <div style={styles.panelHeader}>
              <div style={styles.panelTitle}>Notifications</div>
              <button type="button" onClick={() => setOpen(false)} style={styles.closeBtn}>
                ✕
              </button>
            </div>

            <button type="button" onClick={refresh} disabled={loading} style={styles.refreshBtn}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>

            {canPostGlobal && (
              <div style={styles.adminBox}>
                <div style={styles.adminTitle}>Post global notification</div>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title"
                  style={styles.input}
                />
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Body"
                  rows={3}
                  style={styles.textarea}
                />
                <input
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="Link (optional, e.g. /programs)"
                  style={styles.input}
                />
                <button type="button" onClick={postGlobal} disabled={posting} style={styles.postBtn}>
                  {posting ? "Posting…" : "Post"}
                </button>
              </div>
            )}

            <div style={styles.list}>
              {items.length === 0 ? (
                <div style={styles.empty}>No notifications yet.</div>
              ) : (
                items.map((n) => {
                  const unread = !readSet.has(n.id);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={async () => {
                        await markRead(n.id);
                        if (n.link) {
                          setOpen(false);
                          openLink(n.link);
                        }
                      }}
                      style={{
                        ...styles.item,
                        ...(unread ? styles.itemUnread : {}),
                      }}
                    >
                      <div style={styles.itemTitle}>{n.title}</div>
                      <div style={styles.itemBody}>{n.body}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  bellBtn: {
    position: "fixed",
    top: "calc(14px + env(safe-area-inset-top, 0px))",
    right: 62,
    zIndex: 9998,
    width: 44,
    height: 44,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "var(--card)",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    padding: "0 6px",
    borderRadius: 999,
    background: "#f55",
    color: "#fff",
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid var(--bg)",
  },
  panelBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    zIndex: 9999,
    display: "flex",
    justifyContent: "flex-end",
    padding: 12,
  },
  panel: {
    width: "100%",
    maxWidth: 420,
    height: "calc(100vh - 24px)",
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 16px 50px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  panelTitle: { fontSize: 16, fontWeight: 900, color: "var(--text)" },
  closeBtn: {
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
  },
  refreshBtn: {
    alignSelf: "flex-start",
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
    marginBottom: 10,
  },
  adminBox: {
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  adminTitle: { fontSize: 12, fontWeight: 900, color: "var(--text)", marginBottom: 8 },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text)",
    fontSize: 14,
    boxSizing: "border-box",
    marginBottom: 8,
  },
  textarea: {
    width: "100%",
    padding: 10,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text)",
    fontSize: 14,
    boxSizing: "border-box",
    marginBottom: 8,
    resize: "vertical",
  },
  postBtn: {
    width: "100%",
    padding: 10,
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "var(--text)",
    fontWeight: 900,
    cursor: "pointer",
  },
  list: { overflow: "auto", paddingRight: 4 },
  empty: { color: "var(--text-dim)", fontSize: 14 },
  item: {
    width: "100%",
    textAlign: "left",
    padding: 12,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
    marginBottom: 10,
  },
  itemUnread: {
    borderColor: "var(--accent)",
    background: "color-mix(in srgb, var(--accent) 8%, transparent)",
  },
  itemTitle: { fontWeight: 900, fontSize: 14, marginBottom: 4 },
  itemBody: { fontSize: 13, color: "var(--text-dim)", lineHeight: 1.3 },
};

