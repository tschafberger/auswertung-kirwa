// Tab-Umschaltung und initiales Rendering.

function activateTab(name) {
  document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  location.hash = name;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("nav.tabs button").forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });

  renderHistorie();
  renderNullrechnung();

  const initial = location.hash.replace("#", "") || "historie";
  activateTab(["historie", "nullrechnung"].includes(initial) ? initial : "historie");

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderHistorie();
      recalc();
    }, 150);
  });
});
