import React from "react";
import { NavLink } from "react-router-dom";
import "./BottomNav.css";

// Icons → Using SF-style filled icons via react-icons (safe & consistent)
import {
  AiFillHome,
  AiFillTrophy,
  AiFillFlag,
  AiFillDashboard
} from "react-icons/ai";
import { FaDumbbell, FaRulerVertical, FaUserAlt } from "react-icons/fa";

const BottomNav = () => {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className="nav-item">
        {({ isActive }) => (
          <div className="icon-container">
            {isActive && <div className="active-glow"></div>}
            <AiFillHome className="nav-icon" />
            <span className={`nav-label ${isActive ? "active-label" : ""}`}>
              Dashboard
            </span>
          </div>
        )}
      </NavLink>

      <NavLink to="/workouts" className="nav-item">
        {({ isActive }) => (
          <div className="icon-container">
            {isActive && <div className="active-glow"></div>}
            <FaDumbbell className="nav-icon" />
            <span className={`nav-label ${isActive ? "active-label" : ""}`}>
              Workouts
            </span>
          </div>
        )}
      </NavLink>

      {/* ⭐ FIXED ROUTE HERE */}
      <NavLink to="/prslist" className="nav-item">
        {({ isActive }) => (
          <div className="icon-container">
            {isActive && <div className="active-glow"></div>}
            <AiFillTrophy className="nav-icon" />
            <span className={`nav-label ${isActive ? "active-label" : ""}`}>
              PRs
            </span>
          </div>
        )}
      </NavLink>

      <NavLink to="/measure" className="nav-item">
        {({ isActive }) => (
          <div className="icon-container">
            {isActive && <div className="active-glow"></div>}
            <FaRulerVertical className="nav-icon" />
            <span className={`nav-label ${isActive ? "active-label" : ""}`}>
              Measure
            </span>
          </div>
        )}
      </NavLink>

      <NavLink to="/goals" className="nav-item">
        {({ isActive }) => (
          <div className="icon-container">
            {isActive && <div className="active-glow"></div>}
            <AiFillFlag className="nav-icon" />
            <span className={`nav-label ${isActive ? "active-label" : ""}`}>
              Goals
            </span>
          </div>
        )}
      </NavLink>

      <NavLink to="/profile" className="nav-item">
        {({ isActive }) => (
          <div className="icon-container">
            {isActive && <div className="active-glow"></div>}
            <FaUserAlt className="nav-icon" />
            <span className={`nav-label ${isActive ? "active-label" : ""}`}>
              Profile
            </span>
          </div>
        )}
      </NavLink>
    </nav>
  );
};

export default BottomNav;
