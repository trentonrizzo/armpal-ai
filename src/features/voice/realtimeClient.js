import { dispatchArmpalDataChanged } from "../../lib/armpalDataChanged";
import { supabase } from "../../supabaseClient";
import { extractFunctionCalls, voiceErrorMessage } from "./voiceErrors";

export { extractFunctionCalls, voiceErrorMessage };

const IDLE_MS = 55_000;
const MAX_MS = 8 * 60_000;
const REALTIME_CALLS = "https://api.openai.com/v1/realtime/calls";
const FETCH_OPTS = { credentials: "include" };

function logStage(stage) {
  try {
    console.info(`voice stage: ${stage}`);
  } catch {
    /* ignore */
  }
}

export function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) {
    throw new Error("session-expired");
  }
  return data.session.access_token;
}

async function readJsonSafe(res) {
  const contentType = res.headers?.get?.("content-type") || "";
  if (contentType.includes("text/html")) return { html: true };
  return res.json().catch(() => ({}));
}

function throwFromSessionResponse(sessRes, sess) {
  if (sessRes.status === 401 || sess?.code === "expired") {
    throw new Error("session-expired");
  }
  if (sess?.code === "session" || sessRes.status === 502 || sessRes.status === 500) {
    throw new Error("session");
  }
  if (!sessRes.ok || sess?.html || !sess?.value) {
    throw new Error("session");
  }
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
  let pendingText = "";
  let connected = false;

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
    connected = false;
  }

  function stop(reason = "stop") {
    if (closed && reason !== "force") return;
    closed = true;
    starting = false;
    pendingText = "";
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
          credentials: "include",
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

  function flushPendingText() {
    const trimmed = pendingText;
    pendingText = "";
    if (trimmed) sendText(trimmed);
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
      const msg = event.message || "";
      if (!/cancel/i.test(msg)) emit(handlers.onError, "Couldn't connect to Realtime.");
    }
  }

  async function start() {
    if (starting || (pc && !closed)) return;
    starting = true;
    closed = false;
    connected = false;
    emit(handlers.onState, "connecting");
    try {
      logStage("requesting-session");
      const token = await getAccessToken();
      const sessRes = await fetch("/api/realtime/session", {
        method: "POST",
        ...FETCH_OPTS,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timeZone }),
      });
      const sess = await readJsonSafe(sessRes);
      throwFromSessionResponse(sessRes, sess);

      logStage("microphone");
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

      logStage("peer-connection");
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
      const dcOpen = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("connect")), 12_000);
        dc.addEventListener("open", () => {
          clearTimeout(timer);
          resolve();
        });
        dc.addEventListener("error", () => {
          clearTimeout(timer);
          reject(new Error("connect"));
        });
      });
      dc.addEventListener("message", (ev) => {
        try {
          handleServerEvent(JSON.parse(ev.data));
        } catch {
          /* ignore malformed */
        }
      });
      dc.addEventListener("open", () => {
        connected = true;
        logStage("connected");
        emit(handlers.onState, "listening");
        bumpIdle();
        flushPendingText();
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise((resolve) => {
        if (!pc || pc.iceGatheringState === "complete") return resolve();
        const t = setTimeout(resolve, 3000);
        const onIce = () => {
          if (pc?.iceGatheringState === "complete") {
            clearTimeout(t);
            pc.removeEventListener("icegatheringstatechange", onIce);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", onIce);
      });

      logStage("sending-sdp");
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
      if (!answer || !String(answer).startsWith("v=")) throw new Error("connect");
      logStage("setting-remote-description");
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
      await dcOpen;

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
    if (!trimmed) return false;
    if (!dc || dc.readyState !== "open") {
      pendingText = trimmed;
      if (!starting && !pc) void start();
      return true;
    }
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
      return !closed && (!!pc || starting || connected);
    },
    get starting() {
      return starting;
    },
    get connected() {
      return connected && dc?.readyState === "open";
    },
  };
}
