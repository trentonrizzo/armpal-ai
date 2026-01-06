// public/pwaSplashRuntime.js
// HARD PROOF THIS SCRIPT IS RUNNING ON iOS PWA

(function () {
  // Run every time app becomes visible (cold start + resume)
  function fire() {
    // 1) FLASH THE SCREEN RED
    const flash = document.createElement("div");
    flash.style.position = "fixed";
    flash.style.inset = "0";
    flash.style.background = "red";
    flash.style.zIndex = "9999999";
    flash.style.opacity = "0.9";
    document.body.appendChild(flash);

    setTimeout(() => {
      flash.style.transition = "opacity 300ms";
      flash.style.opacity = "0";
      setTimeout(() => flash.remove(), 350);
    }, 300);

    // 2) FORCE A SOUND (BEEP)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume().then(() => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 440;
        g.gain.value = 0.2;
        o.connect(g).connect(ctx.destination);
        o.start();
        setTimeout(() => {
          o.stop();
          ctx.close();
        }, 200);
      });
    } catch {}
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      fire();
    }
  });

  // Also fire immediately if already visible
  if (document.visibilityState === "visible") {
    fire();
  }
})();
