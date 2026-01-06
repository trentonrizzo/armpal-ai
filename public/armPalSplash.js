/* public/armPalSplash.js
   HARD PROOF SPLASH — THIS MUST BE VISIBLE
*/

(() => {
  if (typeof window === "undefined") return;

  // MAKE IT IMPOSSIBLE TO MISS
  const splash = document.createElement("div");
  splash.style.position = "fixed";
  splash.style.inset = "0";
  splash.style.zIndex = "99999999";
  splash.style.background = "#00ff00"; // NEON GREEN
  splash.style.display = "flex";
  splash.style.alignItems = "center";
  splash.style.justifyContent = "center";
  splash.style.fontSize = "32px";
  splash.style.fontWeight = "900";
  splash.style.color = "#000";
  splash.innerText = "ARMPAL SPLASH FILE IS RUNNING";

  document.body.appendChild(splash);

  // REMOVE AFTER 2 SECONDS
  setTimeout(() => {
    splash.remove();
  }, 2000);
})();
