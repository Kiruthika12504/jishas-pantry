(function () {
  "use strict";
  const C = window.CK_CONFIG;
  const $ = (sel) => document.querySelector(sel);
  const digits = C.whatsappNumber.replace(/\D/g, "");

  document.title = `Privacy policy — ${C.brandName}`;
  document.querySelectorAll("[data-brand]").forEach((el) => (el.textContent = C.brandName));
  $("#updated").textContent = C.privacyPolicyUpdated;
  $("#contactName").textContent = C.privacyContactName;
  $("#contactAddress").textContent = C.kitchenAddress;
  $("#contactEmail").textContent = C.email;
  $("#contactEmail").href = `mailto:${C.email}`;
  $("#contactPhone").textContent = C.phoneDisplay;
  $("#contactPhone").href = `tel:+${digits}`;
  $("#year").textContent = new Date().getFullYear();

  $("#forgetMe").addEventListener("click", () => {
    try {
      localStorage.removeItem("ck_customer");
      localStorage.removeItem("ck_cart");
    } catch { /* storage blocked: nothing was saved */ }
    const t = $("#toast");
    t.textContent = "Done. Nothing about you is saved on this device.";
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2400);
  });
})();
