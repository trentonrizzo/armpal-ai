/* public/armPalSplash.js
   ArmPal Cinematic Barbell Slam Splash
   iOS / PWA SAFE — SINGLE RUN
*/

(() => {
  if (typeof window === "undefined") return;
  if (window.__AP_SPLASH_DONE__) return;
  window.__AP_SPLASH_DONE__ = true;

  const BARBELL_IMG = "/pwa-512x512.png"; // barbell graphic
  const LOGO_TEXT = "ARMPAL";

  /* =========================
     STYLES
  ========================= */
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
      overflow: hidden;
    }

    #ap-stage {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* BARBELL DROP */
    #ap-barbell {
      position: absolute;
      top: -60%;
      left: 50%;
      transform: translateX(-50%);
      width: min(82vw, 380px);
      filter:
        drop-shadow(0 0 20px rgba(255,0,0,.35))
        drop-shadow(0 0 70px rgba(255,0,0,.25));
      animation: barbell-drop 520ms cubic-bezier(.15,.8,.25,1) forwards;
      animation-delay: 120ms;
    }

    @keyframes barbell-drop {
      0% {
        transform: translate(-50%, -140%) scale(0.9);
      }
      70% {
        transform: translate(-50%, 10%) scale(1.05);
      }
      100% {
        transform: translate(-50%, 0) scale(1);
      }
    }

    /* IMPACT FLASH / CRACK */
    #ap-impact {
      position: absolute;
      top: 52%;
      left: 50%;
      width: 220px;
      height: 4px;
      background: radial-gradient(circle, rgba(255,255,255,.95), transparent 70%);
      transform: translateX(-50%) scaleX(.2);
      opacity: 0;
      animation: impact-flash 260ms ease-out forwards;
      animation-delay: 620ms;
    }

    @keyframes impact-flash {
      0% { opacity: 0; transform: translateX(-50%) scaleX(.2); }
      50% { opacity: 1; transform: translateX(-50%) scaleX(1.4); }
      100% { opacity: 0; transform: translateX(-50%) scaleX(2); }
    }

    /* SCREEN SHAKE */
    #ap-stage.shake {
      animation: shake 180ms ease-out;
    }

    @keyframes shake {
      0% { transform: translate(0,0); }
      25% { transform: translate(-4px,2px); }
      50% { transform: translate(4px,-2px); }
      75% { transform: translate(-2px,1px); }
      100% { transform: translate(0,0); }
    }

    /* LOGO FOLLOW */
    #ap-logo {
      position: absolute;
      top: 58%;
      left: 50%;
      transform: translate(-50%, 30px) scale(0.9);
      opacity: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont;
      font-size: 44px;
      font-weight: 900;
      letter-spacing: .04em;
      color: #fff;
      animation: logo-in 360ms cubic-bezier(.2,.9,.25,1) forwards;
      animation-delay: 720ms;
    }

    #ap-logo span {
      color: #e11d48;
    }

    @keyframes logo-in {
      to {
        opacity: 1;
        transform: translate(-50%, 0) scale(1);
      }
    }

    /* EXIT */
    #ap-splash.exit {
      animation: splash-out 220ms ease-out forwards;
    }

    @keyframes splash-out {
      to {
        opacity: 0;
        transform: scale(1.08);
      }
    }
  `;
  document.head.appendChild(style);

  /* =========================
     DOM
  ========================= */
  const splash = document.createElement("div");
  splash.id = "ap-splash";
  splash.innerHTML = `
    <div id="ap-stage">
      <img id="ap-barbell" src="${BARBELL_IMG}" alt="Barbell" />
      <div id="ap-impact"></div>
      <div id="ap-logo"><span>ARM</span>PAL</div>
    </div>
  `;
  document.body.appendChild(splash);

  const stage = splash.querySelector("#ap-stage");

  /* =========================
     IMPACT SOUND (FAST)
  ========================= */
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "running") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 120;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.45, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.24);
    }
  } catch {}

  /* =========================
     SHAKE ON IMPACT
  ========================= */
  setTimeout(() => {
    stage.classList.add("shake");
  }, 620);

  /* =========================
     REMOVAL
  ========================= */
  const remove = () => {
    splash.classList.add("exit");
    setTimeout(() => {
      splash.remove();
      style.remove();
    }, 240);
  };

  const root = document.getElementById("root");
  if (root) {
    const obs = new MutationObserver(() => {
      obs.disconnect();
      remove();
    });
    obs.observe(root, { childList: true });
  }

  setTimeout(remove, 2600);
})();
