
// src/components/friends/FriendQRModal.jsx
// ============================================================================
// ARM PAL — FRIEND QR MODAL (FULL VERSION)
// PURPOSE:
// - Display user's permanent QR code
// - Allow scanning via IMAGE UPLOAD (iOS PWA safe)
// - Decode QR payload using jsQR
// - Send friend request (pending)
// - NO camera API usage (Apple PWA limitation)
// - NO App.jsx changes required
// ============================================================================

import React, { useRef, useState, useEffect } from "react";
import jsQR from "jsqr";
import { supabase } from "../../supabaseClient";

export default function FriendQRModal({
  currentUserId,
  currentUserHandle,
  onClose,
}) {
  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [qrValue, setQrValue] = useState("");

  // --------------------------------------------------------------------------
  // BUILD QR VALUE (PERMANENT, USER-SPECIFIC)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!currentUserId) return;

    // Permanent payload — do NOT randomize
    // This ensures QR works forever
    setQrValue(`armpal://add-friend?uid=${currentUserId}`);
  }, [currentUserId]);

  // --------------------------------------------------------------------------
  // IMAGE UPLOAD → QR DECODE
  // --------------------------------------------------------------------------
  const handleImageUpload = (file) => {
    if (!file) return;

    setError("");
    setSuccess("");
    setLoading(true);

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );

          const decoded = jsQR(
            imageData.data,
            canvas.width,
            canvas.height
          );

          if (!decoded || !decoded.data) {
            throw new Error("No QR code detected in image.");
          }

          processQRPayload(decoded.data);
        } catch (err) {
          setError(err.message || "Failed to read QR code.");
          setLoading(false);
        }
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  };

  // --------------------------------------------------------------------------
  // HANDLE QR PAYLOAD
  // --------------------------------------------------------------------------
  const processQRPayload = async (payload) => {
    try {
      let targetUserId = null;

      // Accept deep link OR raw UUID
      if (payload.includes("uid=")) {
        targetUserId = payload.split("uid=")[1];
      } else {
        targetUserId = payload;
      }

      if (!targetUserId) {
        throw new Error("Invalid QR code.");
      }

      if (targetUserId === currentUserId) {
        throw new Error("You cannot add yourself.");
      }

      // Prevent duplicates
      const { data: existing } = await supabase
        .from("friends")
        .select("id")
        .or(
          `and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`
        )
        .maybeSingle();

      if (existing) {
        throw new Error("Friend request already exists.");
      }

      const { error } = await supabase.from("friends").insert({
        user_id: currentUserId,
        friend_id: targetUserId,
        status: "pending",
      });

      if (error) throw error;

      setSuccess("Friend request sent!");
      setLoading(false);
    } catch (err) {
      setError(err.message || "Failed to process QR code.");
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="relative w-[92%] max-w-md bg-zinc-900 rounded-2xl shadow-xl p-6 text-white">
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
        <div className="bg-white rounded-xl p-4 flex items-center justify-center mb-4">
          {/* QR rendered elsewhere (existing logic) */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
              qrValue
            )}`}
            alt="Your QR Code"
            className="rounded-lg"
          />
        </div>

        <p className="text-sm text-center text-zinc-400 mb-4">
          Scan to add you as a friend
        </p>

        {/* ACTIONS */}
        <div className="space-y-3">
          <button
            onClick={() => fileInputRef.current.click()}
            className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold"
          >
            Upload QR Image
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) =>
              e.target.files && handleImageUpload(e.target.files[0])
            }
          />
        </div>

        {/* STATUS */}
        {loading && (
          <p className="text-sm text-zinc-400 text-center mt-4">
            Scanning QR code…
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
