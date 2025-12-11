// src/pages/ChatPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { FiArrowLeft, FiSend } from "react-icons/fi";

export default function ChatPage() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [friend, setFriend] = useState(null);
  const [conversationId, setConversationId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const bottomRef = useRef(null);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;
    setUser(data.user);

    loadFriendProfile();
    findOrCreateConversation(data.user.id, friendId);
  }

  async function loadFriendProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, handle")
      .eq("id", friendId)
      .single();

    setFriend(data || null);
  }

  async function findOrCreateConversation(myId, theirId) {
    // Step 1: find convo where BOTH users have messages or exist in metadata
    const { data: convos } = await supabase
      .rpc("find_conversation_between", {
        u1: myId,
        u2: theirId,
      });

    if (convos && convos.length > 0) {
      const convo = convos[0];
      setConversationId(convo.id);
      loadMessages(convo.id);
      subscribeToMessages(convo.id);
      return;
    }

    // Step 2: Create new conversation
    const { data: newConvo, error } = await supabase
      .from("conversations")
      .insert({})
      .select()
      .single();

    if (error) {
      console.error("Conversation creation error:", error);
      return;
    }

    setConversationId(newConvo.id);

    // Step 3: No messages yet, but subscribe anyway
    subscribeToMessages(newConvo.id);
  }

  async function loadMessages(convoId) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });

    setMessages(data || []);
    scrollToBottom();
  }

  function subscribeToMessages(convoId) {
    const channel = supabase
      .channel("realtime-messages-" + convoId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convoId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  function scrollToBottom() {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  async function sendMessage() {
    if (!text.trim() || !conversationId || !user) return;

    const msg = {
      conversation_id: conversationId,
      sender_id: user.id,
      text: text.trim(),
    };

    await supabase.from("messages").insert(msg);

    setText("");
  }

  return (
    <div
      style={{
        height: "100vh",
        paddingBottom: "70px",
        display: "flex",
        flexDirection: "column",
        background: "#0c0c0c",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          padding: "14px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#0f0f0f",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            color: "white",
            cursor: "pointer",
          }}
        >
          <FiArrowLeft size={22} />
        </button>

        {friend && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src={
                friend.avatar_url ||
                "https://via.placeholder.com/40?text=User"
              }
              alt="avatar"
              style={{
                width: 40,
                height: 40,
                borderRadius: "999px",
                objectFit: "cover",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                {friend.display_name || friend.username}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  opacity: 0.6,
                }}
              >
                @{friend.handle || friend.username}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* MESSAGES */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;

          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                justifyContent: isMe ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "75%",
                  padding: "10px 12px",
                  borderRadius: 14,
                  fontSize: 14,
                  lineHeight: 1.4,

                  background: isMe ? "#ff2f2f" : "#1a1a1a",
                  border:
                    isMe
                      ? "1px solid rgba(255,255,255,0.1)"
                      : "1px solid rgba(255,255,255,0.08)",

                  color: "white",
                }}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef}></div>
      </div>

      {/* INPUT BAR */}
      <div
        style={{
          padding: "12px",
          background: "#0f0f0f",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input
          type="text"
          value={text}
          placeholder="Message..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          style={{
            flex: 1,
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "10px 12px",
            borderRadius: 10,
            color: "white",
            fontSize: 14,
          }}
        />

        <button
          onClick={sendMessage}
          style={{
            background: "#ff2f2f",
            border: "none",
            padding: "10px 12px",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          <FiSend size={18} color="white" />
        </button>
      </div>
    </div>
  );
}
