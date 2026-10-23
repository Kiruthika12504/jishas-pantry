// Terms and privacy pages: fill business details from config.js into [data-fill="key"] spots.
(function () {
  "use strict";
  const C = window.CK_CONFIG;
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), C);

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-fill]").forEach((el) => {
      const v = get(el.dataset.fill);
      if (v != null) el.textContent = v;
    });
    document.title = document.title.replace("Jisha's Pantry", C.brandName);
  });
})();
