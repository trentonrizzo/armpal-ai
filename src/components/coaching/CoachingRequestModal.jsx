import React, { useEffect, useState } from "react";
import { getArmPalOfficialProfile } from "../../services/officialCoachingAccount";
import CoachingSuccessModal from "./CoachingSuccessModal";

export default function CoachingRequestModal({ open, onClose }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!open) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const loaded = await getArmPalOfficialProfile();
      if (!cancelled) setProfile(loaded);
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  return <CoachingSuccessModal open={open} profile={profile} onClose={onClose} />;
}
