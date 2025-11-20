import React from "react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 pt-10 flex flex-col items-center">
      
      {/* Title */}
      <h1 className="text-4xl font-extrabold tracking-wide mb-2 text-red-500">
        ArmPal
      </h1>

      {/* Subtitle */}
      <p className="text-neutral-400 text-center mb-8 max-w-md">
        Track your strength, master your technique, and grow freaky strong.
      </p>

      {/* Motivation Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold mb-3 tracking-wide text-red-400">
          Today’s Motivation 💪
        </h2>

        <p className="text-neutral-300 italic text-sm leading-relaxed">
          “Progress is built rep by rep. Stay disciplined. Stay dangerous.”
        </p>
      </div>

      {/* Extra spacing for navbar */}
      <div className="h-24"></div>
    </div>
  );
}
