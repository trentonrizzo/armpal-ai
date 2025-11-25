// src/components/NavBar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const location = useLocation();
  const path = location.pathname;

  const linkClasses = (target) =>
    `flex flex-col items-center justify-center px-4 py-2 rounded-xl transition-all duration-200 ${
      path === target
        ? "text-red-500 scale-110"
        : "text-gray-400 hover:text-white hover:scale-105"
    }`;

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 
        bg-black/80 backdrop-blur-md 
        border-t border-red-800/40 
        flex justify-around items-center 
        py-3 z-50
      "
    >
      {/* DASHBOARD */}
      <Link className={linkClasses("/")} to="/">
        <i className="fa-solid fa-gauge-high text-xl"></i>
        <span className="text-[10px] mt-1">Dashboard</span>
      </Link>

      {/* WORKOUTS */}
      <Link className={linkClasses("/workouts")} to="/workouts">
        <i className="fa-solid fa-dumbbell text-xl"></i>
        <span className="text-[10px] mt-1">Workouts</span>
      </Link>

      {/* PRs */}
      <Link className={linkClasses("/prs")} to="/prs">
        <i className="fa-solid fa-chart-line text-xl"></i>
        <span className="text-[10px] mt-1">PRs</span>
      </Link>

      {/* MEASUREMENTS */}
      <Link className={linkClasses("/measurements")} to="/measurements">
        <i className="fa-solid fa-ruler text-xl"></i>
        <span className="text-[10px] mt-1">Measure</span>
      </Link>

      {/* GOALS (NEW) */}
      <Link className={linkClasses("/goals")} to="/goals">
        <i className="fa-solid fa-chart-simple text-xl"></i>
        <span className="text-[10px] mt-1">Goals</span>
      </Link>

      {/* PROFILE */}
      <Link className={linkClasses("/profile")} to="/profile">
        <i className="fa-solid fa-user text-xl"></i>
        <span className="text-[10px] mt-1">Profile</span>
      </Link>
    </nav>
  );
}
