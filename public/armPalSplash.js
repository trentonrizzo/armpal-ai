/* public/armPalSplash.js
   ArmPal Cinematic Power-On Splash
   iOS / PWA SAFE — SINGLE RUN
*/

(() => {
  if (typeof window === "undefined") return;
  if (window.__AP_SPLASH_DONE__) return;
  window.__AP_SPLASH_DONE__ = true;

  const BARBELL = "/pwa-512x512.png"; // barbell logo image
  const MIN_SHOW_MS = 900;
  const MAX_SHOW_MS = 2600;

  /* ===========================
     STYLES
  =========================== */
  const style = document.createElement("style");
  style.textContent = `
    html, body {
      background:#000 !important;
    }

    #ap-splash {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: radial-gradient(circle at center, #111 0%, #000 70%);
      display: grid;
      place-items: center;
      overflow: hidden;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }

    #ap-stage {
      position: relative;
      width: 100%;
      height: 100%;
    }

    #ap-barbell {
      position: absolute;
      top: -40%;
      left: 50%;
      transform: translateX(-50%) scale(0.9);
      width: min(80vw, 380px);
      animation: ap-drop 520ms cubic-bezier(.2,.7,.25,1) forwards;
      animation-delay: 120ms;
      filter:
        drop-shadow(0 0 18px rgba(255,0,0,.35))
        drop-shadow(0 0 60px rgba(255,0,0,.2));
    }

    @keyframes ap-drop {
      0% {
        transform: translate(-50%, -120%) scale(0.9);
      }
      70% {
        transform: translate(-50%, 8%) scale(1.02);
      }
      100% {
        transform: translate(-50%, 0) scale(1);
      }
    }

    #ap-impact {
      position: absolute;
      bottom: 50%;
      left: 50%;
      width: 220px;
      height: 4px;
      background: radial-gradient(circle, rgba(255,255,255,.9), transparent 70%);
      transform: translateX(-50%);
      opacity: 0;
      animation: ap-impact 220ms ease-out forwards;
      animation-delay: 620ms;
    }

    @keyframes ap-impact {
      0% { opacity: 0; transform: translateX(-50%) scaleX(.2); }
      60% { opacity: 1; transform: translateX(-50%) scaleX(1.4); }
      100% { opacity: 0; transform: translateX(-50%) scaleX(2); }
    }

    #ap-title {
      position: absolute;
      top: 52%;
      left: 50%;
      transform: translate(-50%, 24px) scale(0.92);
      opacity: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont;
      font-size: 44px;
      font-weight: 900;
      letter-spacing: .04em;
      color: #fff;
      animation: ap-title-in 420ms cubic-bezier(.2,.9,.25,1) forwards;
      animation-delay: 680ms;
    }

    #ap-title span {
      color: #e11d48;
    }

    @keyframes ap-title-in {
      to {
        opacity: 1;
        transform: translate(-50%, 0) scale(1);
      }
    }

    #ap-splash.ap-out {
      animation: ap-exit 220ms ease-out forwards;
    }

    @keyframes ap-exit {
      to {
        opacity: 0;
        transform: scale(1.06);
      }
    }
  `;
  document.head.appendChild(style);

  /* ===========================
     DOM
  =========================== */
  const splash = document.createElement("div");
  splash.id = "ap-splash";
  splash.innerHTML = `
    <div id="ap-stage">
      <img id="ap-barbell" src="${BARBELL}" alt="Barbell" />
      <div id="ap-impact"></div>
      <div id="ap-title"><span>ARM</span>PAL</div>
    </div>
  `;
  document.body.appendChild(splash);

  /* ===========================
     IMPACT SOUND (IOS SAFE)
  =========================== */
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "running") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = 140;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.26);
    }
  } catch {}

  /* ===========================
     REMOVAL
  =========================== */
  const start = performance.now();
  const remove = () => {
    const elapsed = performance.now() - start;
    const wait = Math.max(0, MIN_SHOW_MS - elapsed);
    setTimeout(() => {
      splash.classList.add("ap-out");
      setTimeout(() => {
        splash.remove();
        style.remove();
      }, 240);
    }, wait);
  };

  const root = document.getElementById("root");
  if (root) {
    const obs = new MutationObserver(() => {
      obs.disconnect();
      remove();
    });
    obs.observe(root, { childList: true });
  }

  setTimeout(remove, MAX_SHOW_MS);
})();
