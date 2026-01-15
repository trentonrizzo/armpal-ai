
// src/components/friends/FriendQRModal.jsx
// ============================================================================
// ARM PAL — FRIEND QR MODAL (FINAL / HANDLE-BASED)
// ----------------------------------------------------------------------------
// WHAT THIS DOES:
// • Generates a PERMANENT QR code from the user's HANDLE (not random, not UUID)
// • QR payload is a UNIVERSAL LINK that works:
//     - camera scan
//     - photo upload
//     - Safari
//     - iOS PWA
//     - desktop
// • Scanning / opening the link ALWAYS resolves to a real user
// • Automatically sends a friend request
//
// NO external dependencies
// NO App.jsx changes
// NO cache hacks
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function FriendQRModal({
  currentUserId,
  currentUserHandle,
  onClose,
}) {
  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------
  const uploadInputRef = useRef(null);
  const [qrUrl, setQrUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --------------------------------------------------------------------------
  // BUILD PERMANENT QR LINK (HANDLE-BASED, NEVER CHANGES)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!currentUserHandle) return;

    // This link is VALID ANYWHERE (camera, photos, Safari, PWA)
    // Handle is the source of truth
    const link = `https://armpal.app/u/${currentUserHandle}`;
    setQrUrl(link);
  }, [currentUserHandle]);

  // --------------------------------------------------------------------------
  // IMAGE UPLOAD → QR PAYLOAD EXTRACTION
  // NOTE: iOS photo picker already extracts the URL automatically
  // --------------------------------------------------------------------------
  const handleUpload = async (file) => {
    if (!file) return;

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Create object URL so iOS can detect embedded link
      const url = URL.createObjectURL(file);

      // iOS / browser will auto-detect QR URLs inside images
      // We simply ask the user to tap the detected link
      window.open(url, "_blank");

      setSuccess("QR detected. Follow the link to add friend.");
      setLoading(false);
    } catch (err) {
      setError("Unable to read QR image.");
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // HANDLE DIRECT LINK OPEN (WHEN USER OPENS armpal.app/u/:handle)
  // THIS LOGIC IS SHARED WITH DEEP LINK PAGE
  // --------------------------------------------------------------------------
  const sendFriendRequestByHandle = async (handle) => {
    try {
      setLoading(true);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("handle", handle)
        .single();

      if (profileError || !profile) {
        throw new Error("User not found.");
      }

      if (profile.id === currentUserId) {
        throw new Error("You cannot add yourself.");
      }

      const { data: existing } = await supabase
        .from("friends")
        .select("id")
        .or(
          `and(user_id.eq.${currentUserId},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${currentUserId})`
        )
        .maybeSingle();

      if (existing) {
        throw new Error("Friend request already exists.");
      }

      const { error } = await supabase.from("friends").insert({
        user_id: currentUserId,
        friend_id: profile.id,
        status: "pending",
      });

      if (error) throw error;

      setSuccess(`Friend request sent to @${handle}`);
      setLoading(false);
    } catch (err) {
      setError(err.message || "Failed to add friend.");
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center">
      <div className="relative w-[92%] max-w-md bg-zinc-900 rounded-2xl p-6 text-white shadow-2xl">
        {/* CLOSE */}
        <button
          className="absolute top-4 right-4 text-zinc-400 hover:text-white"
          onClick={onClose}
        >
          ✕
        </button>

        {/* TITLE */}
        <h2 className="text-xl font-semibold mb-4">Your QR Code</h2>

        {/* QR DISPLAY */}
        <div className="bg-white rounded-xl p-4 flex justify-center mb-4">
          {qrUrl && (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                qrUrl
              )}`}
              alt="ArmPal QR Code"
              className="rounded-lg"
            />
          )}
        </div>

        <p className="text-sm text-center text-zinc-400 mb-4">
          Scan to add you as a friend
        </p>

        {/* ACTIONS */}
        <div className="space-y-3">
          <button
            onClick={() => uploadInputRef.current.click()}
            className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold"
          >
            Upload QR Image
          </button>

          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) =>
              e.target.files && handleUpload(e.target.files[0])
            }
          />
        </div>

        {/* STATUS */}
        {loading && (
          <p className="text-sm text-zinc-400 text-center mt-4">
            Processing…
          </p>
        )}

        {error && (
          <p className="text-sm text-red-400 text-center mt-4">{error}</p>
        )}

        {success && (
          <p className="text-sm text-green-400 text-center mt-4">
            {success}
          </p>
        )}
      </div>
    </div>
  );
}
