// Home page: menu, cart and WhatsApp checkout.
(function () {
  "use strict";

  const C = window.CK_CONFIG;
  const { $, $$, esc, money, toMins, fmtTime, store, toast, digits } = window.CK;
  const backend = window.CK.backend;
  const MAX_QTY = 20;
  const SPICE = ["", "Mild", "Medium", "Spicy"];
  const KEYS = { cart: "ck_cart", customer: "ck_customer" };
  const clean = (s, max) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

  let MENU = [];
  let byId = {};
  let cart = {};
  let signedIn = false;

  // ---------- Time ----------
  const OPEN = toMins(C.hours.open);
  const CLOSE = toMins(C.hours.close);
  const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const isOpen = () => { const m = nowMins(); return m >= OPEN && m < CLOSE; };
  const roundUp30 = (m) => Math.ceil(m / 30) * 30;

  function buildSlots() {
    const m = nowMins();
    const slots = [];
    if (isOpen() && m + C.prepMinutes <= CLOSE) {
      slots.push(`As soon as possible (about ${C.prepMinutes}–${C.prepMinutes + 15} min)`);
    }
    const firstOfDay = roundUp30(OPEN + C.prepMinutes);
    for (let t = Math.max(firstOfDay, roundUp30(m + C.prepMinutes + 15)); t <= CLOSE; t += 30) {
      slots.push(`Today, ${fmtTime(t)}`);
    }
    for (let t = firstOfDay; t <= CLOSE; t += 30) slots.push(`Tomorrow, ${fmtTime(t)}`);
    return slots;
  }

  // ---------- Cart ----------
  function sanitizeCart(raw) {
    const out = {};
    for (const [id, q] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
      const n = Math.floor(Number(q));
      if (byId[id] && byId[id].available && n > 0) out[id] = Math.min(n, MAX_QTY);
    }
    return out;
  }

  function setQty(id, qty) {
    const item = byId[id];
    if (!item || !item.available) return;
    qty = Math.max(0, Math.min(MAX_QTY, qty));
    if (qty === 0) delete cart[id]; else cart[id] = qty;
    store.set(KEYS.cart, cart);
    renderCartState();
  }

  function bill() {
    let subtotal = 0, count = 0;
    for (const [id, q] of Object.entries(cart)) { subtotal += byId[id].price * q; count += q; }
    const packaging = subtotal ? C.packagingFee : 0;
    const freeDelivery = C.freeDeliveryAbove > 0 && subtotal >= C.freeDeliveryAbove;
    const delivery = subtotal && !freeDelivery ? C.deliveryFee : 0;
    const gst = Math.round((subtotal + packaging) * C.gstRate);
    return { subtotal, count, packaging, delivery, freeDelivery, gst, total: subtotal + packaging + delivery + gst };
  }

  // ---------- Menu ----------
  const filters = { category: "All", search: "", vegOnly: false };

  function setMenu(items) {
    MENU = items;
    byId = Object.fromEntries(MENU.map((item) => [item.id, item]));
    cart = sanitizeCart(store.get(KEYS.cart, {}));
    renderChips();
    renderMenu();
    renderCartState();
  }

  function renderChips() {
    const cats = ["All", ...new Set(MENU.map((i) => i.category))];
    if (!cats.includes(filters.category)) filters.category = "All";
    $("#categoryChips").innerHTML = cats
      .map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === filters.category}">${esc(c)}</button>`)
      .join("");
  }

  function actionHtml(item) {
    if (!item.available) return `<span class="sold-label">Sold out today</span>`;
    const q = cart[item.id] || 0;
    if (!q) return `<button type="button" class="add-btn" data-act="inc" data-id="${esc(item.id)}" aria-label="Add ${esc(item.name)} to cart">ADD</button>`;
    return `<div class="qty" role="group" aria-label="${esc(item.name)} quantity">
      <button type="button" data-act="dec" data-id="${esc(item.id)}" aria-label="Remove one ${esc(item.name)}">−</button>
      <span aria-live="polite">${q}</span>
      <button type="button" data-act="inc" data-id="${esc(item.id)}" aria-label="Add one more ${esc(item.name)}">+</button>
    </div>`;
  }

  function dishHtml(item) {
    const media = item.image
      ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" decoding="async" width="400" height="250" />`
      : `<span class="dish-emoji" aria-hidden="true">${esc(item.emoji || "🍽️")}</span>`;
    const tag = item.tags && item.tags.length ? `<span class="dish-tag">${esc(item.tags[0])}</span>` : "";
    const spice = item.spice ? `<span class="spice-label">${SPICE[item.spice] || ""}</span>` : "";
    return `<article class="dish${item.available ? "" : " sold-out"}">
      <div class="dish-media">${media}${tag}</div>
      <div class="dish-body">
        <div class="dish-title">
          <span class="diet ${item.veg ? "veg" : "nonveg"}" role="img" aria-label="${item.veg ? "Vegetarian" : "Non-vegetarian"}"></span>
          <h3>${esc(item.name)}</h3>
        </div>
        <p class="dish-desc">${esc(item.description)}</p>
        <div class="dish-meta">
          <span><span class="price">${money(item.price)}</span>${spice}</span>
          <span class="dish-action" data-id="${esc(item.id)}">${actionHtml(item)}</span>
        </div>
      </div>
    </article>`;
  }

  function renderMenu() {
    const q = filters.search.toLowerCase();
    const items = MENU.filter((i) =>
      (filters.category === "All" || i.category === filters.category) &&
      (!filters.vegOnly || i.veg) &&
      (!q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    );
    $("#menuGrid").innerHTML = items.map(dishHtml).join("");
    $("#menuEmpty").hidden = items.length > 0 || MENU.length === 0;
  }

  async function loadMenu() {
    if (!backend.enabled) { setMenu(window.CK_MENU); return; }
    const status = $("#menuStatus");
    status.hidden = false;
    status.innerHTML = "Loading today's menu…";
    try {
      setMenu(await backend.loadDishes());
      status.hidden = true;
    } catch (err) {
      status.innerHTML = `${esc(err.message)} <button type="button" class="btn btn-ghost btn-sm" id="retryMenu">Try again</button>`;
    }
  }

  // ---------- Cart UI ----------
  function renderCartState() {
    for (const el of $$(".dish-action")) el.innerHTML = actionHtml(byId[el.dataset.id]);
    const b = bill();
    $("#cartCount").textContent = b.count;
    $("#openCart").setAttribute("aria-label", `Open cart, ${b.count} item${b.count === 1 ? "" : "s"}`);
    const bar = $("#cartBar");
    bar.hidden = b.count === 0;
    $("#cartBarCount").textContent = `${b.count} item${b.count === 1 ? "" : "s"}`;
    $("#cartBarTotal").textContent = money(b.subtotal);
    if ($("#cartDrawer").open) renderCartDrawer();
  }

  function billHtml(b) {
    return `<div class="bill">
      <div class="bill-line"><span>Item total</span><span>${money(b.subtotal)}</span></div>
      <div class="bill-line"><span>Packaging</span><span>${money(b.packaging)}</span></div>
      <div class="bill-line"><span>Delivery</span><span>${b.freeDelivery ? '<span class="free">FREE</span>' : money(b.delivery)}</span></div>
      <div class="bill-line"><span>GST (${Math.round(C.gstRate * 100)}%)</span><span>${money(b.gst)}</span></div>
      <div class="bill-line total"><span>To pay</span><span>${money(b.total)}</span></div>
    </div>`;
  }

  function renderCartDrawer() {
    const b = bill();
    const body = $("#cartBody"), foot = $("#cartFoot");
    if (!b.count) {
      body.innerHTML = `<div class="cart-empty"><p><strong>Nothing here yet.</strong></p><p class="muted">Pick something from the menu and it'll show up here.</p><button type="button" class="btn btn-ghost" data-browse>Back to the menu</button></div>`;
      foot.innerHTML = "";
      return;
    }
    body.innerHTML = Object.entries(cart).map(([id, q]) => {
      const item = byId[id];
      return `<div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name"><span class="diet ${item.veg ? "veg" : "nonveg"}" aria-hidden="true"></span>${esc(item.name)}</div>
          <div class="cart-item-price">${money(item.price)} each</div>
        </div>
        <div class="qty sm" role="group" aria-label="${esc(item.name)} quantity">
          <button type="button" data-act="dec" data-id="${esc(id)}" aria-label="Remove one ${esc(item.name)}">−</button>
          <span>${q}</span>
          <button type="button" data-act="inc" data-id="${esc(id)}" aria-label="Add one more ${esc(item.name)}">+</button>
        </div>
        <div class="cart-item-total">${money(item.price * q)}</div>
      </div>`;
    }).join("");

    let notice = "";
    if (b.subtotal < C.minOrder) {
      notice = `<div class="notice">Our minimum order is ${money(C.minOrder)}. Add ${money(C.minOrder - b.subtotal)} more to continue.</div>`;
    } else if (C.freeDeliveryAbove > 0 && !b.freeDelivery) {
      notice = `<div class="notice">Add ${money(C.freeDeliveryAbove - b.subtotal)} more and delivery is on us.</div>`;
    } else if (b.freeDelivery) {
      notice = `<div class="notice ok">Free delivery on this order.</div>`;
    }
    foot.innerHTML = `${notice}${billHtml(b)}
      <button type="button" class="btn btn-primary btn-block" id="toCheckout" ${b.subtotal < C.minOrder ? "disabled" : ""}>Continue</button>`;
  }

  // ---------- Checkout ----------
  async function openCheckout() {
    const b = bill();
    if (!b.count || b.subtotal < C.minOrder) return;
    $("#cartDrawer").close();

    const form = $("#checkoutForm");
    const user = backend.enabled ? await backend.user() : null;
    signedIn = Boolean(user);
    $("#rememberText").textContent = signedIn
      ? "Save these details to my account"
      : "Remember my details on this device for next time";

    let saved = null;
    if (signedIn) {
      try {
        const p = await backend.getProfile();
        if (p) saved = { name: p.full_name, phone: p.phone, address: p.address, pincode: p.pincode, landmark: p.landmark };
      } catch { /* checkout still works without the saved profile */ }
      if (!saved || !saved.name) saved = { ...(saved || {}), name: (user.user_metadata && user.user_metadata.full_name) || "" };
    } else {
      saved = store.get(KEYS.customer, null);
    }
    if (saved && typeof saved === "object") {
      for (const k of ["name", "phone", "address", "pincode", "landmark"]) {
        if (typeof saved[k] === "string" && saved[k] && !form.elements[k].value) form.elements[k].value = saved[k];
      }
      $("#fRemember").checked = !signedIn && Boolean(store.get(KEYS.customer, null));
    }

    $("#fSlot").innerHTML = buildSlots().map((s) => `<option>${esc(s)}</option>`).join("");
    $("#paymentOptions").innerHTML = C.paymentOptions.map((p, i) =>
      `<label><input type="radio" name="payment" value="${esc(p)}" ${i === 0 ? "checked" : ""} /> ${esc(p)}</label>`
    ).join("");
    $("#checkoutTotal").textContent = money(b.total);
    clearErrors(form);
    $("#checkoutModal").showModal();
  }

  function clearErrors(form) {
    $("#formError").textContent = "";
    $$("[aria-invalid]", form).forEach((el) => el.removeAttribute("aria-invalid"));
  }

  function validate(form) {
    const v = {
      name: clean(form.elements.name.value, 60),
      phone: form.elements.phone.value.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""),
      address: clean(form.elements.address.value, 200),
      pincode: form.elements.pincode.value.trim(),
      landmark: clean(form.elements.landmark.value, 60),
      slot: form.elements.slot.value,
      payment: (form.querySelector("input[name=payment]:checked") || {}).value,
      notes: clean(form.elements.notes.value, 140),
    };
    const fail = (field, msg) => ({ error: msg, field });
    if (v.name.length < 2) return fail("name", "Please tell us your name.");
    if (!/^[6-9]\d{9}$/.test(v.phone)) return fail("phone", "Please enter a valid 10-digit mobile number.");
    if (v.address.length < 8) return fail("address", "Please add your full address so our rider can find you.");
    if (!/^\d{6}$/.test(v.pincode)) return fail("pincode", "Please enter a 6-digit pincode.");
    if (C.serviceablePincodes.length && !C.serviceablePincodes.includes(v.pincode)) {
      return fail("pincode", `Sorry, we don't deliver to ${v.pincode} yet. We're a small kitchen and only cover nearby areas for now.`);
    }
    if (!v.slot) return fail("slot", "Please pick a delivery time.");
    if (!C.paymentOptions.includes(v.payment)) return fail("payment", "Please choose how you'd like to pay.");
    return { value: v };
  }

  function orderId() {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const rnd = crypto.getRandomValues(new Uint8Array(4));
    const words = C.brandName.replace(/['’]s\b/gi, "").match(/[A-Za-z]+/g) || [];
    const prefix = (words.length > 1 ? words.map((w) => w[0]).join("") : words.join("")).slice(0, 3).toUpperCase() || "CK";
    return `${prefix}-${ymd}-${Array.from(rnd, (n) => chars[n % chars.length]).join("")}`;
  }

  function orderMessage(id, v, b) {
    const lines = [`Hi ${C.brandName}, I'd like to place an order.`, "", `*Order ${id}*`];
    Object.entries(cart).forEach(([itemId, q], i) => {
      const item = byId[itemId];
      lines.push(`${i + 1}. ${item.name} × ${q} = ${money(item.price * q)}`);
    });
    lines.push(
      "",
      `Item total: ${money(b.subtotal)}`,
      `Packaging: ${money(b.packaging)}`,
      `Delivery: ${b.freeDelivery ? "FREE" : money(b.delivery)}`,
      `GST: ${money(b.gst)}`,
      `*To pay: ${money(b.total)}*`,
      "",
      `Name: ${v.name}`,
      `Phone: ${v.phone}`,
      `Address: ${v.address}${v.landmark ? `, near ${v.landmark}` : ""}, ${v.pincode}`,
      `When: ${v.slot}`,
      `Payment: ${v.payment}`
    );
    if (v.notes) lines.push(`Notes: ${v.notes}`);
    return lines.join("\n");
  }

  async function submitOrder(e) {
    e.preventDefault();
    const form = e.target;
    clearErrors(form);
    const result = validate(form);
    if (result.error) {
      $("#formError").textContent = result.error;
      const el = form.elements[result.field];
      if (el && el.setAttribute) { el.setAttribute("aria-invalid", "true"); el.focus(); }
      return;
    }
    const v = result.value;
    const b = bill();
    const id = orderId();
    const message = orderMessage(id, v, b);
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    if (!C.previewMode && /^9{10,}$|^919{10}$/.test(C.whatsappNumber)) {
      $("#formError").textContent = "Ordering isn't set up yet. Please call or message us directly.";
      return;
    }

    const details = { name: v.name, phone: v.phone, address: v.address, pincode: v.pincode, landmark: v.landmark };
    if (signedIn) {
      if ($("#fRemember").checked) {
        backend.saveProfile({ full_name: v.name, phone: v.phone, address: v.address, pincode: v.pincode, landmark: v.landmark })
          .catch(() => toast("Your order is fine, but we couldn't save your details to your account."));
      }
    } else if ($("#fRemember").checked) {
      store.set(KEYS.customer, details);
    } else {
      store.remove(KEYS.customer);
    }

    if (C.previewMode) {
      // Sample details: show the order instead of sending it to a number that may not be ours.
      $("#successTitle").textContent = "Preview: this is the order the kitchen would get";
      $("#successText").textContent = "In the live site, this message opens in the customer's WhatsApp, addressed to the kitchen's number.";
      $("#successHelp").hidden = true;
      $("#orderPreview").textContent = message;
      $("#orderPreview").hidden = false;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
      $("#successId").textContent = id;
      $("#successLink").href = url;
    }

    cart = {};
    store.set(KEYS.cart, cart);
    renderCartState();
    form.elements.notes.value = "";
    $("#checkoutModal").close();
    $("#successModal").showModal();
  }

  // ---------- Page content from config ----------
  function fillContent() {
    $("#kitchenNote").textContent = C.kitchenNote;
    $("#kitchenNoteSign").textContent = C.kitchenNoteSignature;
    $("#factHours").textContent = `${fmtTime(OPEN)} – ${fmtTime(CLOSE)}`;
    $("#factFree").textContent = C.freeDeliveryAbove > 0 ? money(C.freeDeliveryAbove) : "—";

    const pill = $("#statusPill");
    if (isOpen()) {
      pill.textContent = `Open · till ${fmtTime(CLOSE)}`;
      pill.classList.remove("closed");
    } else {
      pill.textContent = `Closed · opens ${nowMins() < OPEN ? "" : "tomorrow "}${fmtTime(OPEN)}`;
      pill.classList.add("closed");
    }

    $("#faqArea").textContent = C.serviceablePincodes.length
      ? `For now, we deliver to these pincodes in ${C.city}: ${C.serviceablePincodes.join(", ")}. We're adding more areas as we grow.`
      : `We deliver across ${C.city}.`;
    $("#faqMin").textContent = `Yes, ${money(C.minOrder)}. Delivery is ${money(C.deliveryFee)}${C.freeDeliveryAbove > 0 ? `, and free on orders above ${money(C.freeDeliveryAbove)}` : ""}.`;
  }

  // ---------- Events ----------
  function onQtyClick(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.dataset.id;
    const q = cart[id] || 0;
    if (btn.dataset.act === "inc") {
      if (q >= MAX_QTY) return toast(`For more than ${MAX_QTY}, please call us — we'd love to cater.`);
      setQty(id, q + 1);
      if (q === 0) toast(`${byId[id].name} added`);
    } else {
      setQty(id, q - 1);
    }
  }

  function openCart() { renderCartDrawer(); $("#cartDrawer").showModal(); }

  function bind() {
    $("#menuGrid").addEventListener("click", onQtyClick);
    $("#menuStatus").addEventListener("click", (e) => { if (e.target.closest("#retryMenu")) loadMenu(); });
    $("#cartBody").addEventListener("click", (e) => {
      if (e.target.closest("[data-browse]")) { $("#cartDrawer").close(); location.hash = "menu"; return; }
      onQtyClick(e);
    });
    $("#cartFoot").addEventListener("click", (e) => { if (e.target.closest("#toCheckout")) openCheckout(); });
    $("#openCart").addEventListener("click", openCart);
    $("#cartBar").addEventListener("click", openCart);

    $("#categoryChips").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-cat]");
      if (!chip) return;
      filters.category = chip.dataset.cat;
      $$(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      renderMenu();
    });
    $("#searchInput").addEventListener("input", (e) => { filters.search = e.target.value.trim(); renderMenu(); });
    $("#vegOnly").addEventListener("change", (e) => { filters.vegOnly = e.target.checked; renderMenu(); });

    $("#checkoutForm").addEventListener("submit", submitOrder);
    $("#checkoutForm").addEventListener("input", (e) => e.target.removeAttribute("aria-invalid"));
    $("#fPhone").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10); });
    $("#fPincode").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });

    for (const dlg of $$("dialog")) {
      dlg.addEventListener("click", (e) => {
        if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
      });
    }

    document.addEventListener("ck:forget", () => {
      cart = {};
      renderCartState();
      $("#checkoutForm").reset();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    fillContent();
    bind();
    loadMenu();
  });
})();
