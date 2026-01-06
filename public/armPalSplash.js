/* public/armPalSplash.js
   ArmPal Power-On Splash — CLEAN / IOS SAFE / SINGLE RUN
*/

(() => {
  if (typeof window === "undefined") return;

  // HARD STOP: never show twice per cold launch
  if (window.__AP_SPLASH_ACTIVE__) return;
  window.__AP_SPLASH_ACTIVE__ = true;

  const LOGO = "/pwa-512x512.png";
  const MIN_SHOW_MS = 900;
  const MAX_SHOW_MS = 2200;

  // ==============================
  // STYLES (INLINE, ZERO DEPENDENCIES)
  // ==============================
  const style = document.createElement("style");
  style.textContent = `
    #ap-splash {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: radial-gradient(circle at center, #111 0%, #000 65%);
      display: grid;
      place-items: center;
      pointer-events: none;
    }

    #ap-splash-inner {
      display: grid;
      place-items: center;
      gap: 16px;
      opacity: 0;
      transform: translateY(8px) scale(0.94);
      animation: ap-enter 720ms cubic-bezier(.2,.9,.25,1) forwards;
    }

    #ap-logo {
      width: min(72vw, 340px);
      filter:
        drop-shadow(0 0 18px rgba(255,0,0,.25))
        drop-shadow(0 0 42px rgba(255,0,0,.15));
    }

    #ap-tagline {
      font-family: system-ui, -apple-system, BlinkMacSystemFont;
      font-size: 12px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(255,255,255,.55);
    }

    @keyframes ap-enter {
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    #ap-splash.ap-out {
      animation: ap-exit 260ms ease-out forwards;
    }

    @keyframes ap-exit {
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // ==============================
  // DOM
  // ==============================
  const splash = document.createElement("div");
  splash.id = "ap-splash";
  splash.innerHTML = `
    <div id="ap-splash-inner">
      <img id="ap-logo" src="${LOGO}" alt="ArmPal" />
      <div id="ap-tagline">Strength · Precision · Progress</div>
    </div>
  `;
  document.body.appendChild(splash);

  // ==============================
  // OPTIONAL SOUND (WILL AUTO-FAIL ON IOS UNTIL TAP)
  // ==============================
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "running") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = 360;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.24);
    }
  } catch {}

  // ==============================
  // REMOVAL LOGIC (REACT OR TIMEOUT)
  // ==============================
  const start = performance.now();

  const remove = () => {
    const elapsed = performance.now() - start;
    const wait = Math.max(0, MIN_SHOW_MS - elapsed);
    setTimeout(() => {
      splash.classList.add("ap-out");
      setTimeout(() => {
        splash.remove();
        style.remove();
      }, 280);
    }, wait);
  };

  // Remove when React mounts
  const root = document.getElementById("root");
  if (root) {
    const obs = new MutationObserver(() => {
      obs.disconnect();
      remove();
    });
    obs.observe(root, { childList: true });
  }

  // Absolute fallback
  setTimeout(remove, MAX_SHOW_MS);
})();
