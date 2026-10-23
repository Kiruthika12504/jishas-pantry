// Light / dark theme. Loaded in <head> so the right colours apply before the page paints.
// Follows the device setting until the visitor picks one with the toggle; that choice is remembered.
(function () {
  "use strict";
  var KEY = "ck_theme";
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function saved() {
    try { var v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : null; } catch (e) { return null; }
  }
  function system() { return media && media.matches ? "dark" : "light"; }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#121715" : "#f3f5f4");
    var buttons = document.querySelectorAll(".theme-toggle");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
      buttons[i].setAttribute("title", theme === "dark" ? "Light theme" : "Dark theme");
    }
  }

  apply(saved() || system());

  if (media && media.addEventListener) {
    media.addEventListener("change", function () { if (!saved()) apply(system()); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    apply(root.getAttribute("data-theme"));
    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest(".theme-toggle")) return;
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try { localStorage.setItem(KEY, next); } catch (err) { /* not remembered, still switches */ }
      apply(next);
    });
  });
})();
