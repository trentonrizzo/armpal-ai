// src/components/NavBar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const location = useLocation();
  const path = location.pathname;

  const linkClasses = (target) =>
    `px-3 py-1 rounded-full text-xs sm:text-sm transition ${
      path === target
        ? "bg-red-600 text-white shadow shadow-red-600/40"
        : "text-gray-300 hover:text-white hover:bg-red-600/20"
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black/90 border-t border-red-900/50 backdrop-blur-md flex justify-around items-center py-2 z-40">
      <Link className={linkClasses("/")} to="/">
        Home
      </Link>
      <Link className={linkClasses("/workouts")} to="/workouts">
        Workouts
      </Link>
      <Link className={linkClasses("/prs")} to="/prs">
        PRs
      </Link>
      <Link className={linkClasses("/measurements")} to="/measurements">
        Measure
      </Link>
      <Link className={linkClasses("/profile")} to="/profile">
        Profile
      </Link>
    </nav>
  );
}
