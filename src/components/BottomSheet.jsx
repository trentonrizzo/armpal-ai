import React, { useEffect } from "react";

export default function BottomSheet({ open, onClose, children }) {
  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "auto";
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full bg-neutral-900 rounded-t-2xl p-5 border-t border-red-700 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-4"></div>

        {children}
      </div>
    </div>
  );
}
