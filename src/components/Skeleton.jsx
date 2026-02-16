// Skeleton placeholders while loading. Match approximate shapes; no layout jump.
// Use when loading === true. Do not change data fetching.

import React from "react";

export function SkeletonLine({ width = "100%", height = 14, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        ...style,
      }}
    />
  );
}

export function SkeletonCard({ lines = 2, style = {} }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--card)",
        ...style,
      }}
    >
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine
          key={i}
          width={i === 0 ? "80%" : "60%"}
          height={12}
          style={{ marginBottom: i < lines - 1 ? 10 : 0 }}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 48, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        ...style,
      }}
    />
  );
}

export default function Skeleton({ variant = "line", ...props }) {
  if (variant === "card") return <SkeletonCard {...props} />;
  if (variant === "avatar") return <SkeletonAvatar {...props} />;
  return <SkeletonLine {...props} />;
}
