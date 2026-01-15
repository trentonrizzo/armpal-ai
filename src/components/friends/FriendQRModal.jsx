
// src/components/friends/FriendQRModal.jsx
// ============================================================================
// ARM PAL — FRIEND QR MODAL (FULL, NO EXTERNAL DEPS)
// Uses:
// - BarcodeDetector (image-based decoding)
// - iOS PWA safe (no live camera)
// - No npm installs required
// ============================================================================

import React, { useRef, useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";

export default function FriendQRModal({ currentUserId, onClose }) {
  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [qrValue, setQrValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --------------------------------------------------------------------------
  // BUILD PERMANENT QR VALUE
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!currentUserId) return;
    setQrValue(`https://armpal.app/add-friend?uid=${currentUserId}`);
  }, [currentUserId]);

  // --------------------------------------------------------------------------
  // IMAGE → QR DECODE (BARCODE DETECTOR)
  // --------------------------------------------------------------------------
  const decodeFromImage = async (file) => {
    if (!file) return;

    setError("");
    setSuccess("");
    setLoading(true);

    if (!("BarcodeDetector" in window)) {
      setError("QR scanning not supported on this device.");
      setLoading(false);
      return;
    }

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();

      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const barcodes = await detector.detect(img);

      if (!barcodes || barcodes.length === 0) {
        throw new Error("No QR code found in image.");
      }

      await processPayload(barcodes[0].rawValue);
    } catch (err) {
      setError(err.message || "Failed to scan QR code.");
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // HANDLE QR PAYLOAD
  // --------------------------------------------------------------------------
  const processPayload = async (payload) => {
    try {
      let targetUserId = null;

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
        <button
          className="absolute top-4 right-4 text-zinc-400 hover:text-white"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold mb-4">Your QR Code</h2>

        <div className="bg-white rounded-xl p-4 flex items-center justify-center mb-4">
          {qrValue && (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
                qrValue
              )}`}
              alt="Your QR Code"
              className="rounded-lg"
            />
          )}
        </div>

        <p className="text-sm text-center text-zinc-400 mb-4">
          Scan to add you as a friend
        </p>

        <div className="space-y-3">
          <button
            onClick={() => cameraInputRef.current.click()}
            className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold"
          >
            Scan QR (Camera)
          </button>

          <button
            onClick={() => uploadInputRef.current.click()}
            className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold"
          >
            Upload QR Image
          </button>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) =>
              e.target.files && decodeFromImage(e.target.files[0])
            }
          />

          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) =>
              e.target.files && decodeFromImage(e.target.files[0])
            }
          />
        </div>

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
