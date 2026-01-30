import React from "react";
import DashboardAIOverlay from "./DashboardAIOverlay";

export default function DashboardAIChat(props) {
  // Simple compatibility wrapper to satisfy existing Dashboard import.
  // Always open the overlay; close is a no-op here.
  return <DashboardAIOverlay open={true} onClose={() => {}} />;
}
