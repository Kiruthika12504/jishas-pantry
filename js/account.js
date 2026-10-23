// Account page: log in, sign up, password reset, saved delivery details, delete account.
(function () {
  "use strict";

  const { $, $$, esc, toast } = window.CK;
  const backend = window.CK.backend;
  const VIEWS = ["#loading", "#offView", "#authView", "#checkEmailView", "#newPasswordForm", "#profileView"];
  const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

  function show(view) {
    VIEWS.forEach((v) => ($(v).hidden = v !== view));
    const first = $(view).querySelector("h1, input");
    if (first && view !== "#loading") first.focus({ preventScroll: true });
  }

  // Run an async form action with the button disabled and errors shown in plain words.
  async function busy(form, errorEl, action) {
    const btn = form.querySelector("[type=submit]");
    errorEl.textContent = "";
    btn.disabled = true;
    try { await action(); } catch (err) { errorEl.textContent = err.message; }
    finally { btn.disabled = false; }
  }

  // ---------- Tabs (log in / sign up) ----------
  function selectTab(which) {
    const login = which === "login";
    $("#tabLogin").setAttribute("aria-selected", String(login));
    $("#tabSignup").setAttribute("aria-selected", String(!login));
    $("#tabLogin").tabIndex = login ? 0 : -1;
    $("#tabSignup").tabIndex = login ? -1 : 0;
    $("#loginForm").hidden = !login;
    $("#signupForm").hidden = login;
    $("#resetForm").hidden = true;
    $(".tabs").hidden = false;
    $("#authTitle").textContent = login ? "Welcome back" : "Create your account";
  }

  function bindTabs() {
    $("#tabLogin").addEventListener("click", () => selectTab("login"));
    $("#tabSignup").addEventListener("click", () => selectTab("signup"));
    $(".tabs").addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const toSignup = $("#tabLogin").getAttribute("aria-selected") === "true";
      selectTab(toSignup ? "signup" : "login");
      (toSignup ? $("#tabSignup") : $("#tabLogin")).focus();
    });
    $("#showReset").addEventListener("click", () => {
      $("#loginForm").hidden = true;
      $(".tabs").hidden = true;
      $("#resetForm").hidden = false;
      $("#resetEmail").value = $("#loginEmail").value;
      $("#authTitle").textContent = "Forgot your password?";
      $("#resetEmail").focus();
    });
    $("#backToLogin").addEventListener("click", () => selectTab("login"));
  }

  // ---------- Forms ----------
  function bindForms() {
    $("#loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = $("#loginEmail").value.trim();
      const password = $("#loginPassword").value;
      busy(e.target, $("#loginError"), async () => {
        if (!emailOk(email)) throw new Error("Please enter a valid email address.");
        if (!password) throw new Error("Please enter your password.");
        await backend.logIn(email, password);
        $("#loginPassword").value = "";
        await showProfile();
      });
    });

    $("#signupForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#signupName").value.trim();
      const email = $("#signupEmail").value.trim();
      const password = $("#signupPassword").value;
      busy(e.target, $("#signupError"), async () => {
        if (name.length < 2) throw new Error("Please tell us your name.");
        if (!emailOk(email)) throw new Error("Please enter a valid email address.");
        if (password.length < 8) throw new Error("Your password needs at least 8 characters.");
        if (!$("#signupConsent").checked) throw new Error("Please agree to the Terms and Privacy policy to create an account.");
        const data = await backend.signUp(email, password, name);
        $("#signupPassword").value = "";
        if (data.session) { await showProfile(); return; }
        $("#checkEmailAddress").textContent = email;
        show("#checkEmailView");
      });
    });

    $("#resetForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = $("#resetEmail").value.trim();
      $("#resetOk").textContent = "";
      busy(e.target, $("#resetError"), async () => {
        if (!emailOk(email)) throw new Error("Please enter a valid email address.");
        await backend.sendPasswordReset(email);
        // Same message whether or not the email has an account, so the form can't be used to find out.
        $("#resetOk").textContent = "If that email has an account, a reset link is on its way.";
      });
    });

    $("#newPasswordForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const password = $("#newPassword").value;
      busy(e.target, $("#newPasswordError"), async () => {
        if (password.length < 8) throw new Error("Your password needs at least 8 characters.");
        await backend.setNewPassword(password);
        $("#newPassword").value = "";
        history.replaceState(null, "", location.pathname);
        toast("Password changed.");
        await showProfile();
      });
    });

    $("#profileForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const p = {
        full_name: $("#pName").value.trim().slice(0, 60) || null,
        phone: $("#pPhone").value.replace(/\D/g, "") || null,
        address: $("#pAddress").value.trim().slice(0, 200) || null,
        pincode: $("#pPincode").value.trim() || null,
        landmark: $("#pLandmark").value.trim().slice(0, 60) || null,
      };
      $("#profileOk").textContent = "";
      busy(e.target, $("#profileError"), async () => {
        if (p.phone && !/^[6-9]\d{9}$/.test(p.phone)) throw new Error("Please enter a valid 10-digit mobile number, or leave it empty.");
        if (p.pincode && !/^\d{6}$/.test(p.pincode)) throw new Error("Please enter a 6-digit pincode, or leave it empty.");
        await backend.saveProfile(p);
        $("#profileOk").textContent = "Saved.";
      });
    });
    $("#pPhone").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10); });
    $("#pPincode").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });

    $("#logOut").addEventListener("click", async () => {
      try { await backend.logOut(); } catch { /* signed out locally anyway */ }
      toast("You're logged out.");
      selectTab("login");
      show("#authView");
    });

    // Deleting needs a second, deliberate click inside the page.
    $("#deleteArea").addEventListener("click", async (e) => {
      if (e.target.closest("#deleteStart")) {
        $("#deleteArea").innerHTML = `<div class="confirm-bar" role="alert">
          <span>This can't be undone. Delete your account?</span>
          <button type="button" class="btn btn-danger btn-sm" id="deleteYes">Yes, delete it</button>
          <button type="button" class="btn btn-ghost btn-sm" id="deleteNo">Keep my account</button></div>`;
        $("#deleteNo").focus();
      } else if (e.target.closest("#deleteNo")) {
        $("#deleteArea").innerHTML = `<button type="button" class="btn btn-danger btn-sm" id="deleteStart">Delete my account</button>`;
      } else if (e.target.closest("#deleteYes")) {
        e.target.disabled = true;
        try {
          await backend.deleteMyAccount();
          try { await backend.logOut(); } catch { /* the account is already gone */ }
          window.CK.store.remove("ck_customer");
          toast("Your account has been deleted.");
          selectTab("login");
          show("#authView");
        } catch (err) {
          e.target.disabled = false;
          toast(err.message);
        }
      }
    });
  }

  // ---------- Signed-in view ----------
  async function showProfile() {
    const user = await backend.user();
    if (!user) { selectTab("login"); show("#authView"); return; }
    const meta = user.user_metadata || {};
    $("#signedInAs").textContent = `Logged in as ${user.email}`;
    let profile = null;
    try { profile = await backend.getProfile(); } catch { /* show the empty form */ }
    const name = (profile && profile.full_name) || meta.full_name || "";
    $("#helloName").textContent = name ? `, ${name.split(" ")[0]}` : "";
    $("#pName").value = name;
    $("#pPhone").value = (profile && profile.phone) || "";
    $("#pAddress").value = (profile && profile.address) || "";
    $("#pPincode").value = (profile && profile.pincode) || "";
    $("#pLandmark").value = (profile && profile.landmark) || "";
    $("#adminLink").hidden = !(await backend.isAdmin());
    show("#profileView");
  }

  // Errors Supabase puts in the link, e.g. an expired confirmation or reset link.
  function linkError() {
    const params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
    const code = params.get("error_code") || params.get("error");
    if (!code) return "";
    history.replaceState(null, "", location.pathname);
    return /expired/i.test(code + (params.get("error_description") || ""))
      ? "That link has expired. Please ask for a new one."
      : "That link didn't work. Please try again.";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!backend.enabled) { show("#offView"); return; }
    bindTabs();
    bindForms();

    const recovering = /type=recovery/.test(location.hash);
    backend.onAuthChange((event) => { if (event === "PASSWORD_RECOVERY") show("#newPasswordForm"); });
    if (recovering) { show("#newPasswordForm"); return; }

    const err = linkError();
    const user = await backend.user();
    if (user) { await showProfile(); if (/type=signup/.test(location.hash)) toast("Email confirmed. Welcome!"); return; }
    if (location.hash === "#signup") selectTab("signup"); else selectTab("login");
    show("#authView");
    if (err) $("#loginError").textContent = err;
  });
})();
