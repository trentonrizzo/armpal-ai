export function extractFunctionCalls(output = []) {
  return (Array.isArray(output) ? output : []).filter(
    (item) => item?.type === "function_call" || item?.type === "realtime.function_call"
  );
}

export function voiceErrorMessage(err) {
  const raw = err?.message || err?.code || "";
  const name = err?.name || "";
  if (name === "NotAllowedError" || raw === "mic-denied" || raw === "NotAllowedError") {
    return "Microphone permission denied.";
  }
  if (name === "NotFoundError" || raw === "mic-missing") {
    return "Microphone unavailable.";
  }
  if (raw === "session-expired") {
    return "Your ArmPal session expired.";
  }
  if (raw === "session") {
    return "Couldn't create AI session.";
  }
  return "Couldn't connect to Realtime.";
}
