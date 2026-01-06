/* public/armPalSplash.js
   ArmPal Power-On Splash — POLISHED / IOS SAFE / SINGLE RUN
*/

(() => {
  if (typeof window === "undefined") return;

  // Run once per cold launch
  if (window.__AP_SPLASH_DONE__) return;
  window.__AP_SPLASH_DONE__ = true;

  const LOGO = "/pwa-512x512.png";
  const MIN_SHOW_MS = 1000;
  const MAX_SHOW_MS = 2600;

  // ==============================
  // STYLES
  // ==============================
  const style = document.createElement("style");
  style.textContent = `
    html, body {
      background: #000 !important;
    }

    #ap-splash {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: radial-gradient(circle at center, #111 0%, #000 70%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }

    #ap-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 22px;
      opacity: 0;
      transform: translateY(12px) scale(0.92);
      animation: ap-enter 700ms cubic-bezier(.2,.9,.25,1) forwards;
    }

    #ap-logo {
      width: min(78vw, 360px);
      filter:
        drop-shadow(0 0 22px rgba(255,0,0,.35))
        drop-shadow(0 0 60px rgba(255,0,0,.18));
    }

    #ap-line {
      width: 140px;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255,255,255,.7),
        transparent
      );
      opacity: 0;
      animation: ap-line-in 600ms ease forwards;
      animation-delay: 420ms;
    }

    #ap-tag {
      font-family: system-ui, -apple-system, BlinkMacSystemFont;
      font-size: 12px;
      letter-spacing: .22em;
      text-transform: uppercase;
      color: rgba(255,255,255,.55);
    }

    @keyframes ap-enter {
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes ap-line-in {
      to { opacity: 1; }
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
    <div id="ap-inner">
      <img id="ap-logo" src="${LOGO}" alt="ArmPal" />
      <div id="ap-line"></div>
      <div id="ap-tag">Strength · Precision · Progress</div>
    </div>
  `;
  document.body.appendChild(splash);

  // ==============================
  // REMOVAL LOGIC
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
      }, 300);
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
