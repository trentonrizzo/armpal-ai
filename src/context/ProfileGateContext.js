import React, { createContext, useContext, useState } from "react";

const ProfileGateContext = createContext(null);

export function ProfileGateProvider({ children }) {
  const [profile, setProfile] = useState(null);
  return (
    <ProfileGateContext.Provider value={{ profile, setProfile }}>
      {children}
    </ProfileGateContext.Provider>
  );
}

export function useProfileGate() {
  return useContext(ProfileGateContext);
}

