import React from "react";
import { NavLink } from "react-router-dom";
import "./BottomNav.css";

import { AiFillHome, AiFillTrophy, AiFillFlag } from "react-icons/ai";
import { FaDumbbell, FaRulerVertical, FaUserAlt } from "react-icons/fa";

const BottomNav = () => {
  return (
    <nav className="bottom-nav">
      {/* Dashboard */}
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

      {/* Workouts */}
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

      {/* PRs — FIXED FOREVER */}
      <NavLink to="/prs" className="nav-item">
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

      {/* Measure */}
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

      {/* Goals */}
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

      {/* Profile */}
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
