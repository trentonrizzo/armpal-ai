import React, { useState } from "react";
import ProgramsPill from "./ProgramsPill";
import ProgramsOverlay from "./ProgramsOverlay";

export default function ProgramsLauncher({ pillStyle = {} }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ProgramsPill onClick={() => setOpen(true)} style={pillStyle} />
      <ProgramsOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
