/* public/armPalSplash.js
   ArmPal REAL Barbell Slam Splash
   PURE CODE — iOS SAFE — SINGLE RUN
*/

(() => {
  if (typeof window === "undefined") return;
  if (window.__AP_SPLASH_DONE__) return;
  window.__AP_SPLASH_DONE__ = true;

  const LOGO = "/pwa-512x512.png";

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
    }

    /* ---------- BARBELL ---------- */
    #barbell {
      position: absolute;
      top: -40%;
      left: 50%;
      transform: translateX(-50%);
      animation: drop 520ms cubic-bezier(.15,.8,.25,1) forwards;
      animation-delay: 120ms;
    }

    .bar {
      width: 260px;
      height: 6px;
      background: #ccc;
      border-radius: 3px;
    }

    .plate {
      position: absolute;
      top: -18px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #111;
      border: 4px solid #e11d48;
      box-shadow: 0 0 18px rgba(255,0,0,.35);
    }

    .plate.left {
      left: -44px;
    }

    .plate.right {
      right: -44px;
    }

    @keyframes drop {
      0%   { transform: translate(-50%, -140%) scale(0.9); }
      70%  { transform: translate(-50%, 12%) scale(1.05); }
      100% { transform: translate(-50%, 0) scale(1); }
    }

    /* ---------- IMPACT ---------- */
    #impact {
      position: absolute;
      top: 52%;
      left: 50%;
      width: 240px;
      height: 4px;
      background: radial-gradient(circle, #fff, transparent 70%);
      transform: translateX(-50%) scaleX(.2);
      opacity: 0;
      animation: impact 240ms ease-out forwards;
      animation-delay: 620ms;
    }

    @keyframes impact {
      0% { opacity:0; transform:translateX(-50%) scaleX(.2); }
      50% { opacity:1; transform:translateX(-50%) scaleX(1.4); }
      100% { opacity:0; transform:translateX(-50%) scaleX(2); }
    }

    /* ---------- SHAKE ---------- */
    .shake {
      animation: shake 160ms ease-out;
    }

    @keyframes shake {
      0% { transform:translate(0,0); }
      25% { transform:translate(-6px,3px); }
      50% { transform:translate(6px,-3px); }
      75% { transform:translate(-3px,2px); }
      100% { transform:translate(0,0); }
    }

    /* ---------- LOGO ---------- */
    #logo {
      position: absolute;
      top: 58%;
      left: 50%;
      transform: translate(-50%, 30px) scale(.9);
      opacity: 0;
      width: min(70vw, 300px);
      animation: logoIn 360ms cubic-bezier(.2,.9,.25,1) forwards;
      animation-delay: 760ms;
      filter: drop-shadow(0 0 22px rgba(255,0,0,.35));
    }

    @keyframes logoIn {
      to {
        opacity:1;
        transform:translate(-50%,0) scale(1);
      }
    }

    /* ---------- EXIT ---------- */
    #ap-splash.exit {
      animation: exit 220ms ease-out forwards;
    }

    @keyframes exit {
      to {
        opacity:0;
        transform:scale(1.08);
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
      <div id="barbell">
        <div class="plate left"></div>
        <div class="bar"></div>
        <div class="plate right"></div>
      </div>

      <div id="impact"></div>
      <img id="logo" src="${LOGO}" alt="ArmPal" />
    </div>
  `;
  document.body.appendChild(splash);

  const stage = splash.querySelector("#ap-stage");

  /* SHAKE ON IMPACT */
  setTimeout(() => stage.classList.add("shake"), 620);

  /* REMOVE */
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
