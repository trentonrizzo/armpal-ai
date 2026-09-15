import { dispatchArmpalDataChanged } from "../../lib/armpalDataChanged";
import { supabase } from "../../supabaseClient";

const IDLE_MS = 55_000;
const MAX_MS = 8 * 60_000;
const REALTIME_CALLS = "https://api.openai.com/v1/realtime/calls";

export function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function extractFunctionCalls(output = []) {
  return (Array.isArray(output) ? output : []).filter(
    (item) => item?.type === "function_call" || item?.type === "realtime.function_call"
  );
}

export function voiceErrorMessage(err) {
  const code =
    err?.name === "NotAllowedError" || err?.message === "NotAllowedError"
      ? "mic-denied"
      : err?.message === "session-expired"
        ? "session-expired"
        : err?.name === "NotFoundError"
          ? "mic-missing"
          : "connect";
  if (code === "mic-denied") return "No microphone permission.";
  if (code === "mic-missing") return "Microphone unavailable.";
  if (code === "session-expired") return "Your session expired.";
  return "Couldn't connect.";
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) {
    throw new Error("session-expired");
  }
  return data.session.access_token;
}

export function createVoiceSession(handlers = {}) {
  const timeZone = handlers.timeZone || getTimeZone();
  let pc = null;
  let dc = null;
  let localStream = null;
  let remoteAudio = null;
  let idleTimer = null;
  let maxTimer = null;
  let closed = false;
  let starting = false;
  let assistantBuf = "";
  let userBuf = "";

  const emit = (fn, payload) => {
    try {
      fn && fn(payload);
    } catch {
      /* ignore handler errors */
    }
  };

  function bumpIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => stop("idle"), IDLE_MS);
  }

  function cleanupMedia() {
    try {
      localStream?.getTracks()?.forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
    localStream = null;
    try {
      if (remoteAudio) {
        remoteAudio.srcObject = null;
        remoteAudio.remove();
      }
    } catch {
      /* ignore */
    }
    remoteAudio = null;
    try {
      dc?.close();
    } catch {
      /* ignore */
    }
    dc = null;
    try {
      pc?.close();
    } catch {
      /* ignore */
    }
    pc = null;
  }

  function stop(reason = "stop") {
    if (closed && reason !== "force") return;
    closed = true;
    starting = false;
    if (idleTimer) clearTimeout(idleTimer);
    if (maxTimer) clearTimeout(maxTimer);
    idleTimer = null;
    maxTimer = null;
    cleanupMedia();
    emit(handlers.onState, "idle");
    emit(handlers.onStopped, reason);
  }

  async function runToolCalls(calls) {
    emit(handlers.onState, "working");
    const token = await getAccessToken();
    for (const call of calls) {
      let parsed = {};
      try {
        parsed = call.arguments ? JSON.parse(call.arguments) : {};
      } catch {
        parsed = {};
      }
      let result;
      try {
        const res = await fetch("/api/realtime/tools", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: call.name,
            arguments: parsed,
            timeZone,
          }),
        });
        result = await res.json().catch(() => ({
          ok: false,
          error: "I couldn't complete that.",
        }));
        if (!res.ok && !result?.error) {
          result = { ok: false, error: "I couldn't complete that." };
        }
      } catch {
        result = { ok: false, error: "I couldn't complete that." };
      }
      if (result?.changed) {
        dispatchArmpalDataChanged(result.changed);
        emit(handlers.onDataChanged, result.changed);
      }
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        },
      });
    }
    sendEvent({ type: "response.create" });
    bumpIdle();
  }

  function sendEvent(payload) {
    if (!dc || dc.readyState !== "open") return;
    dc.send(JSON.stringify(payload));
  }

  function handleServerEvent(event) {
    bumpIdle();
    const type = event?.type;
    if (!type) return;

    if (type === "input_audio_buffer.speech_started") {
      userBuf = "";
      emit(handlers.onState, "listening");
      return;
    }
    if (type === "input_audio_buffer.speech_stopped") {
      emit(handlers.onState, "working");
      return;
    }
    if (type === "conversation.item.input_audio_transcription.delta") {
      userBuf += event.delta || "";
      if (userBuf) emit(handlers.onUserTranscript, userBuf);
      return;
    }
    if (
      type === "conversation.item.input_audio_transcription.completed" ||
      type === "conversation.item.input_audio_transcription.done"
    ) {
      const text = event.transcript || userBuf;
      userBuf = "";
      if (text) emit(handlers.onUserTranscript, text);
      return;
    }
    if (
      type === "response.output_audio_transcript.delta" ||
      type === "response.audio_transcript.delta" ||
      type === "response.output_text.delta"
    ) {
      const delta = event.delta || "";
      assistantBuf += delta;
      emit(handlers.onAssistantTranscript, assistantBuf);
      emit(handlers.onState, "speaking");
      return;
    }
    if (
      type === "response.output_audio_transcript.done" ||
      type === "response.audio_transcript.done" ||
      type === "response.output_text.done"
    ) {
      const text = event.transcript || assistantBuf;
      if (text) emit(handlers.onAssistantTranscript, text);
      return;
    }
    if (type === "response.created") {
      assistantBuf = "";
      return;
    }
    if (type === "response.done") {
      const output = event.response?.output || [];
      const calls = extractFunctionCalls(output);
      if (calls.length) {
        void runToolCalls(calls).catch(() => {
          emit(handlers.onError, "I couldn't complete that.");
        });
        return;
      }
      emit(handlers.onState, "listening");
      return;
    }
    if (type === "error" || type === "invalid_request_error") {
      const msg = event.message || "Couldn't connect.";
      if (!/cancel/i.test(msg)) emit(handlers.onError, "Couldn't connect.");
    }
  }

  async function start() {
    if (starting || (pc && !closed)) return;
    starting = true;
    closed = false;
    emit(handlers.onState, "connecting");
    try {
      const token = await getAccessToken();
      const sessRes = await fetch("/api/realtime/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timeZone }),
      });
      const sess = await sessRes.json().catch(() => ({}));
      if (sessRes.status === 401) throw new Error("session-expired");
      if (!sessRes.ok || !sess.value) throw new Error("connect");

      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (micErr) {
        if (micErr?.name === "NotAllowedError" || micErr?.name === "NotFoundError") {
          throw micErr;
        }
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      pc = new RTCPeerConnection();
      remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute("playsinline", "true");
      remoteAudio.playsInline = true;
      remoteAudio.style.display = "none";
      document.body.appendChild(remoteAudio);
      void remoteAudio.play().catch(() => {});

      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      pc.ontrack = (ev) => {
        const stream = ev.streams?.[0] || new MediaStream([ev.track]);
        if (remoteAudio) {
          remoteAudio.srcObject = stream;
          void remoteAudio.play().catch(() => {});
        }
        emit(handlers.onState, "speaking");
      };

      dc = pc.createDataChannel("oai-events");
      dc.addEventListener("message", (ev) => {
        try {
          handleServerEvent(JSON.parse(ev.data));
        } catch {
          /* ignore malformed */
        }
      });
      dc.addEventListener("open", () => {
        emit(handlers.onState, "listening");
        bumpIdle();
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise((resolve) => {
        if (!pc || pc.iceGatheringState === "complete") return resolve();
        const t = setTimeout(resolve, 1200);
        const onIce = () => {
          if (pc?.iceGatheringState === "complete") {
            clearTimeout(t);
            pc.removeEventListener("icegatheringstatechange", onIce);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", onIce);
      });
      const sdpRes = await fetch(REALTIME_CALLS, {
        method: "POST",
        body: pc.localDescription?.sdp || offer.sdp,
        headers: {
          Authorization: `Bearer ${sess.value}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!sdpRes.ok) throw new Error("connect");
      const answer = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });

      maxTimer = setTimeout(() => stop("max"), MAX_MS);
      bumpIdle();
      starting = false;
    } catch (err) {
      starting = false;
      cleanupMedia();
      closed = true;
      emit(handlers.onError, voiceErrorMessage(err));
      emit(handlers.onState, "error");
    }
  }

  function sendText(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed || !dc || dc.readyState !== "open") return false;
    emit(handlers.onUserTranscript, trimmed);
    sendEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: trimmed }],
      },
    });
    sendEvent({ type: "response.create" });
    emit(handlers.onState, "working");
    bumpIdle();
    return true;
  }

  return {
    start,
    stop,
    sendText,
    get active() {
      return !closed && (!!pc || starting);
    },
    get starting() {
      return starting;
    },
  };
}
