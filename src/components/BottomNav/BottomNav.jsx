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
            {isActive && <div className="active-glow" />}
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
            {isActive && <div className="active-glow" />}
            <FaDumbbell className="nav-icon" />
            <span className={`nav-label ${isActive ? "active-label" : ""}`}>
              Workouts
            </span>
          </div>
        )}
      </NavLink>

      {/* PRs */}
      <NavLink to="/prs" className="nav-item">
        {({ isActive }) => (
          <div className="icon-container">
            {isActive && <div className="active-glow" />}
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
            {isActive && <div className="active-glow" />}
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
            {isActive && <div className="active-glow" />}
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
            {isActive && <div className="active-glow" />}
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
