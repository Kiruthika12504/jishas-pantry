// Shared by every page: brand name, footer details, the account link, and small helpers.
window.CK = window.CK || {};
(function () {
  "use strict";

  const C = window.CK_CONFIG;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const money = (n) => C.currency + Math.round(n).toLocaleString("en-IN");
  const toMins = (hm) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
  function fmtTime(mins) {
    const h = Math.floor(mins / 60) % 24, m = mins % 60;
    const h12 = h % 12 || 12, ap = h < 12 ? "AM" : "PM";
    return m ? `${h12}:${String(m).padStart(2, "0")} ${ap}` : `${h12} ${ap}`;
  }
  const digits = C.whatsappNumber.replace(/\D/g, "");

  // localStorage can be blocked (private mode, strict settings) — never let that break the page.
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
  };

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  const setText = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };

  function fillShared() {
    const hours = `${fmtTime(toMins(C.hours.open))} – ${fmtTime(toMins(C.hours.close))}`;
    $$("[data-brand]").forEach((el) => (el.textContent = C.brandName));
    $$("[data-city]").forEach((el) => (el.textContent = C.city));
    setText("#year", new Date().getFullYear());
    setText("#footerAddress", C.kitchenAddress);
    setText("#footerFssai", `FSSAI Lic. No. ${C.fssaiLicense}`);
    setText("#footerHours", `Every day, ${hours}`);
    const phone = $("#footerPhone");
    if (phone) { phone.textContent = C.phoneDisplay; phone.href = `tel:+${digits}`; }
    const email = $("#footerEmail");
    if (email) { email.textContent = C.email; email.href = `mailto:${C.email}`; }
    const wa = $("#footerWhatsapp");
    if (wa) wa.href = `https://wa.me/${digits}`;
    const banner = $("#previewBanner");
    if (banner) banner.hidden = !C.previewMode;

    const forget = $("#forgetMe");
    if (forget) forget.addEventListener("click", () => {
      store.remove("ck_customer");
      store.remove("ck_cart");
      document.dispatchEvent(new CustomEvent("ck:forget"));
      toast("Done. Nothing about you is saved on this device.");
    });
  }

  // Header account link: "Log in" when signed out, "Account" when signed in. Hidden without a backend.
  async function updateAccountLink() {
    const link = $("#accountLink");
    if (!link) return;
    const backend = window.CK.backend;
    if (!backend || !backend.enabled) { link.hidden = true; return; }
    const user = await backend.user();
    link.hidden = false;
    $(".account-label", link).textContent = user ? "Account" : "Log in";
    link.setAttribute("aria-label", user ? "Your account" : "Log in or sign up");
  }

  Object.assign(window.CK, { $, $$, esc, money, toMins, fmtTime, store, toast, digits });

  document.addEventListener("DOMContentLoaded", () => {
    fillShared();
    updateAccountLink();
    if (window.CK.backend) window.CK.backend.onAuthChange(updateAccountLink);
  });
})();
