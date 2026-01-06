/* public/armPalSplash.js
   ArmPal Power-On Splash — iOS/PWA SAFE
*/

(() => {
  if (typeof window === "undefined") return;

  // Run once per session (but DOES run on warm resume)
  if (sessionStorage.getItem("AP_SPLASH_SHOWN")) return;
  sessionStorage.setItem("AP_SPLASH_SHOWN", "1");

  const LOGO = "/pwa-512x512.png";
  const MIN_SHOW_MS = 1200; // FORCE visibility
  const MAX_SHOW_MS = 3000;

  // ---------- Styles ----------
  const style = document.createElement("style");
  style.textContent = `
    #ap-splash {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: #000;
      display: grid;
      place-items: center;
      pointer-events: none;
    }
    #ap-splash img {
      width: min(44vw, 220px);
      opacity: 0;
      transform: scale(0.9);
      filter: blur(8px);
      animation: ap-in 900ms cubic-bezier(.2,.9,.25,1) forwards;
    }
    @keyframes ap-in {
      to { opacity: 1; transform: scale(1); filter: blur(0); }
    }
    #ap-splash.ap-out {
      animation: ap-out 250ms ease-out forwards;
    }
    @keyframes ap-out {
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // ---------- DOM ----------
  const splash = document.createElement("div");
  splash.id = "ap-splash";
  splash.innerHTML = `<img src="${LOGO}" alt="ArmPal" />`;
  document.body.appendChild(splash);

  // ---------- Sound (metal clank, lightweight) ----------
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = async () => {
      if (ctx.state === "suspended") await ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = 420;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.26);
    };
    play();
  } catch {}

  // ---------- Removal ----------
  const start = performance.now();
  const remove = () => {
    const elapsed = performance.now() - start;
    const wait = Math.max(0, MIN_SHOW_MS - elapsed);
    setTimeout(() => {
      splash.classList.add("ap-out");
      setTimeout(() => {
        splash.remove();
        style.remove();
      }, 260);
    }, wait);
  };

  // Remove after React mounts OR max timeout
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
