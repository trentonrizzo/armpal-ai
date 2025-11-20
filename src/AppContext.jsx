import React, { createContext, useState, useEffect } from "react";

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : { name: "Guest", level: "beginner" };
  });

  const [measurements, setMeasurements] = useState(() => {
    const saved = localStorage.getItem("measurements");
    return saved ? JSON.parse(saved) : [];
  });

  const [prs, setPRs] = useState(() => {
    const saved = localStorage.getItem("prs");
    return saved
      ? JSON.parse(saved)
      : {
          bench: 0,
          squat: 0,
          deadlift: 0,
          grip: 0,
          wallCurl: 0,
        };
  });

  useEffect(() => {
    localStorage.setItem("user", JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem("measurements", JSON.stringify(measurements));
  }, [measurements]);

  useEffect(() => {
    localStorage.setItem("prs", JSON.stringify(prs));
  }, [prs]);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        measurements,
        setMeasurements,
        prs,
        setPRs,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
