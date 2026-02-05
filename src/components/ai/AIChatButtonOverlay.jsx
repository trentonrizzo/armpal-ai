import React from "react";

export default function AIChatButtonOverlay({ onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="fixed bottom-24 right-4 z-40
                 bg-red-600 hover:bg-red-700
                 text-white font-semibold
                 px-4 py-3 rounded-full shadow-lg"
    >
      AI
    </button>
  );
}
