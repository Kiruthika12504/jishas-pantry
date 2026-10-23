// Admin page: add, edit, hide and remove dishes. Only admins get past the gate, and the
// database refuses changes from anyone else even if this page were tampered with.
(function () {
  "use strict";

  const { $, $$, esc, money, toast } = window.CK;
  const backend = window.CK.backend;
  let dishes = [];
  let pendingPhoto = null;   // File chosen but not yet uploaded
  let currentImage = "";     // URL already saved for the dish being edited
  let previewUrl = "";

  function gate(title, text, linkText, href) {
    $("#loading").hidden = true;
    $("#gateTitle").textContent = title;
    $("#gateText").textContent = text;
    const link = $("#gateLink");
    link.textContent = linkText;
    link.href = href;
    $("#gate").hidden = false;
  }

  const slugify = (s) =>
    s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 50) || "dish";

  function uniqueId(name) {
    const base = slugify(name);
    let id = base, n = 2;
    while (dishes.some((d) => d.id === id)) id = `${base}-${n++}`;
    return id;
  }

  // ---------- List ----------
  function renderRows() {
    $("#dishCount").textContent = `${dishes.length} dish${dishes.length === 1 ? "" : "es"} · ${dishes.filter((d) => d.available).length} available today`;
    $("#categoryList").innerHTML = [...new Set(dishes.map((d) => d.category))].map((c) => `<option value="${esc(c)}"></option>`).join("");
    if (!dishes.length) {
      $("#dishRows").innerHTML = `<tr><td colspan="4" class="muted">No dishes yet. Add the first one with the form.</td></tr>`;
      return;
    }
    $("#dishRows").innerHTML = dishes.map((d) => `
      <tr data-id="${esc(d.id)}">
        <td><div class="dish-cell">
          <span class="thumb">${d.image ? `<img src="${esc(d.image)}" alt="" loading="lazy" />` : esc(d.emoji)}</span>
          <span><strong>${esc(d.name)}</strong><br /><span class="tiny muted">${esc(d.category)} · ${d.veg ? "Veg" : "Non-veg"}</span></span>
        </div></td>
        <td class="num">${money(d.price)}</td>
        <td><button type="button" class="pill ${d.available ? "on" : "off"}" data-act="toggle" aria-pressed="${d.available}"
              aria-label="${esc(d.name)} is ${d.available ? "on the menu" : "sold out"}. Change">${d.available ? "Available" : "Sold out"}</button></td>
        <td><div class="row-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-act="edit">Edit<span class="visually-hidden"> ${esc(d.name)}</span></button>
          <button type="button" class="btn btn-danger btn-sm" data-act="delete">Delete<span class="visually-hidden"> ${esc(d.name)}</span></button>
        </div></td>
      </tr>`).join("");
  }

  async function reload() {
    dishes = await backend.loadDishes();
    renderRows();
  }

  // ---------- Form ----------
  function setPreview() {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ""; }
    const box = $("#photoPreview");
    if (pendingPhoto) {
      previewUrl = URL.createObjectURL(pendingPhoto);
      box.innerHTML = `<img src="${previewUrl}" alt="" />`;
    } else if (currentImage) {
      box.innerHTML = `<img src="${esc(currentImage)}" alt="" />`;
    } else {
      box.textContent = $("#dEmoji").value || "🍽️";
    }
    $("#removePhoto").hidden = !(pendingPhoto || currentImage);
  }

  function fillForm(d) {
    $("#dId").value = d ? d.id : "";
    $("#dName").value = d ? d.name : "";
    $("#dDesc").value = d ? d.description : "";
    $("#dPrice").value = d ? d.price : "";
    $("#dCategory").value = d ? d.category : "";
    $$("input[name=dVeg]").forEach((r) => (r.checked = r.value === (d && !d.veg ? "nonveg" : "veg")));
    $("#dSpice").value = String(d ? d.spice : 0);
    $("#dOrder").value = d ? d.sortOrder : (dishes.reduce((m, x) => Math.max(m, x.sortOrder || 0), 0) + 10);
    $("#dTags").value = d && d.tags.length ? d.tags[0] : "";
    $("#dEmoji").value = d ? d.emoji : "🍽️";
    $("#dAvailable").checked = d ? d.available : true;
    $("#dPhoto").value = "";
    pendingPhoto = null;
    currentImage = d ? d.image : "";
    setPreview();
    $("#dishError").textContent = "";
    $$("#dishForm [aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    $("#formTitle").textContent = d ? `Edit: ${d.name}` : "Add a dish";
    $("#saveDish").textContent = d ? "Save changes" : "Add dish";
    $("#cancelEdit").hidden = !d;
  }

  function readForm() {
    const fail = (id, msg) => { const el = $(id); el.setAttribute("aria-invalid", "true"); el.focus(); throw new Error(msg); };
    const name = $("#dName").value.trim();
    const price = Number($("#dPrice").value);
    const category = $("#dCategory").value.trim();
    const order = $("#dOrder").value === "" ? 100 : Math.floor(Number($("#dOrder").value));
    if (name.length < 2) fail("#dName", "Please give the dish a name.");
    if (!Number.isInteger(price) || price < 1 || price > 100000) fail("#dPrice", "Please enter the price in whole rupees, e.g. 249.");
    if (category.length < 2) fail("#dCategory", "Please choose or type a category, e.g. Biryani.");
    const label = $("#dTags").value.trim();
    const editing = $("#dId").value;
    return {
      id: editing || uniqueId(name),
      name,
      description: $("#dDesc").value.trim().slice(0, 300),
      price,
      category,
      veg: $("input[name=dVeg]:checked").value === "veg",
      spice: Number($("#dSpice").value),
      tags: label ? [label] : [],
      available: $("#dAvailable").checked,
      emoji: $("#dEmoji").value.trim() || "🍽️",
      image: currentImage,
      sortOrder: Number.isFinite(order) ? order : 100,
    };
  }

  async function saveDish(e) {
    e.preventDefault();
    $("#dishError").textContent = "";
    $$("#dishForm [aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    const btn = $("#saveDish");
    let dish;
    try { dish = readForm(); } catch (err) { $("#dishError").textContent = err.message; return; }
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "Saving…";
    try {
      if (pendingPhoto) dish.image = await backend.uploadPhoto(pendingPhoto);
      await backend.saveDish(dish);
      await reload();
      toast(`${dish.name} saved.`);
      fillForm(null);
    } catch (err) {
      $("#dishError").textContent = err.message;
    } finally {
      btn.disabled = false;
      if (btn.textContent === "Saving…") btn.textContent = label;
    }
  }

  // ---------- Table actions ----------
  async function onRowClick(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const row = btn.closest("tr");
    const dish = dishes.find((d) => d.id === row.dataset.id);
    if (!dish) return;
    const act = btn.dataset.act;

    if (act === "edit") {
      fillForm(dish);
      $("#dishForm").scrollIntoView({ behavior: "smooth", block: "start" });
      $("#dName").focus({ preventScroll: true });
    } else if (act === "toggle") {
      btn.disabled = true;
      try {
        await backend.setAvailable(dish.id, !dish.available);
        await reload();
        toast(`${dish.name} is now ${dish.available ? "sold out" : "available"}.`);
      } catch (err) { btn.disabled = false; toast(err.message); }
    } else if (act === "delete") {
      // Deleting needs a second, deliberate click inside the page.
      const cell = btn.closest("td");
      cell.innerHTML = `<div class="confirm-bar" role="alert"><span>Delete ${esc(dish.name)}?</span>
        <button type="button" class="btn btn-danger btn-sm" data-act="confirm-delete">Delete</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="cancel-delete">Keep</button></div>`;
      cell.querySelector("[data-act=cancel-delete]").focus();
    } else if (act === "cancel-delete") {
      renderRows();
    } else if (act === "confirm-delete") {
      btn.disabled = true;
      try {
        await backend.deleteDish(dish.id);
        if ($("#dId").value === dish.id) fillForm(null);
        await reload();
        toast(`${dish.name} deleted.`);
      } catch (err) { btn.disabled = false; toast(err.message); }
    }
  }

  function bind() {
    $("#dishRows").addEventListener("click", onRowClick);
    $("#dishForm").addEventListener("submit", saveDish);
    $("#dishForm").addEventListener("input", (e) => e.target.removeAttribute("aria-invalid"));
    $("#addDish").addEventListener("click", () => { fillForm(null); $("#dName").focus(); });
    $("#cancelEdit").addEventListener("click", () => fillForm(null));
    $("#dEmoji").addEventListener("input", setPreview);
    $("#dPhoto").addEventListener("change", (e) => {
      const file = e.target.files[0];
      $("#dishError").textContent = "";
      if (!file) return;
      if (!backend.PHOTO_TYPES.includes(file.type)) { $("#dishError").textContent = "Please choose a JPG, PNG or WebP photo."; e.target.value = ""; return; }
      if (file.size > backend.PHOTO_MAX_BYTES) { $("#dishError").textContent = "That photo is over 2 MB. Please use a smaller one."; e.target.value = ""; return; }
      pendingPhoto = file;
      setPreview();
    });
    $("#removePhoto").addEventListener("click", () => {
      pendingPhoto = null;
      currentImage = "";
      $("#dPhoto").value = "";
      setPreview();
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!backend.enabled) {
      gate("Menu manager isn't switched on yet", "Connect the Supabase backend in js/config.js to manage dishes here.", "Back to the menu", "./");
      return;
    }
    const user = await backend.user();
    if (!user) { gate("Please log in", "The menu manager is for the kitchen team. Log in with your admin account.", "Log in", "account.html"); return; }
    if (!(await backend.isAdmin())) {
      gate("This page is for the kitchen team", "Your account doesn't have admin access. If you run the kitchen, ask the site owner to add you.", "Back to the menu", "./");
      return;
    }
    bind();
    try {
      await reload();
    } catch (err) {
      gate("Couldn't load the menu", err.message, "Try again", "admin.html");
      return;
    }
    fillForm(null);
    $("#loading").hidden = true;
    $("#manager").hidden = false;
  });
})();
