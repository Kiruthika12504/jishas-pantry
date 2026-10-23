// Connection to the Supabase backend: customer accounts, the dish list and dish photos.
// Security is enforced by the database (row-level security in supabase/schema.sql),
// not by this file — hiding a button here never grants or blocks access on its own.
// Without Supabase keys in config.js, `enabled` is false and the site runs on js/menu.js.
window.CK = window.CK || {};
(function () {
  "use strict";

  const C = window.CK_CONFIG;
  const enabled = Boolean(C.supabaseUrl && C.supabaseAnonKey && window.supabase);
  const db = enabled
    ? window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

  const PHOTO_BUCKET = "dish-photos";
  const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

  // Page URL for links in emails (sign-up confirmation, password reset).
  const accountPageUrl = () => new URL("account.html", location.href).href.split("#")[0].split("?")[0];

  // Supabase error messages are written for developers; turn the common ones into plain words.
  function friendly(error) {
    const msg = (error && error.message) || String(error || "");
    if (/invalid login credentials/i.test(msg)) return "That email and password don't match. Check them and try again.";
    if (/email not confirmed/i.test(msg)) return "Please confirm your email first. Check your inbox for the link we sent.";
    if (/already registered|already been registered/i.test(msg)) return "An account with this email already exists. Try logging in instead.";
    if (/password should be at least/i.test(msg)) return "Your password needs at least 8 characters.";
    if (/rate limit|too many/i.test(msg)) return "Too many attempts. Please wait a few minutes and try again.";
    if (/failed to fetch|network/i.test(msg)) return "We couldn't reach the server. Check your internet connection and try again.";
    if (/row-level security|permission denied|not allowed/i.test(msg)) return "You don't have permission to do that.";
    return msg || "Something went wrong. Please try again.";
  }

  async function run(promise) {
    const { data, error } = await promise;
    if (error) throw new Error(friendly(error));
    return data;
  }

  const toDish = (row) => ({
    id: row.id,
    name: row.name,
    description: row.description || "",
    price: row.price,
    category: row.category,
    veg: row.veg,
    spice: row.spice || 0,
    tags: row.tags || [],
    available: row.available,
    emoji: row.emoji || "🍽️",
    image: row.image_url || "",
    sortOrder: row.sort_order,
  });

  window.CK.backend = {
    enabled,
    accountPageUrl,
    PHOTO_TYPES,
    PHOTO_MAX_BYTES,

    async user() {
      if (!enabled) return null;
      const { data } = await db.auth.getSession();
      return data.session ? data.session.user : null;
    },
    onAuthChange(fn) {
      if (enabled) db.auth.onAuthStateChange((event, session) => fn(event, session ? session.user : null));
    },
    async isAdmin() {
      if (!enabled) return false;
      try { return Boolean(await run(db.rpc("is_admin"))); } catch { return false; }
    },

    // ----- Accounts -----
    signUp: (email, password, fullName) =>
      run(db.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: accountPageUrl() } })),
    logIn: (email, password) => run(db.auth.signInWithPassword({ email, password })),
    logOut: () => run(db.auth.signOut()),
    sendPasswordReset: (email) => run(db.auth.resetPasswordForEmail(email, { redirectTo: accountPageUrl() })),
    setNewPassword: (password) => run(db.auth.updateUser({ password })),
    deleteMyAccount: () => run(db.rpc("delete_my_account")),

    async getProfile() {
      const u = await this.user();
      if (!u) return null;
      return run(db.from("profiles").select("full_name, phone, address, pincode, landmark").eq("id", u.id).maybeSingle());
    },
    async saveProfile(p) {
      const u = await this.user();
      if (!u) throw new Error("Please log in first.");
      return run(db.from("profiles").upsert({ id: u.id, ...p }));
    },

    // ----- Menu -----
    async loadDishes() {
      const rows = await run(db.from("dishes").select("*").order("sort_order").order("name"));
      return rows.map(toDish);
    },
    saveDish(d) {
      return run(
        db.from("dishes").upsert({
          id: d.id,
          name: d.name,
          description: d.description,
          price: d.price,
          category: d.category,
          veg: d.veg,
          spice: d.spice,
          tags: d.tags,
          available: d.available,
          emoji: d.emoji,
          image_url: d.image || null,
          sort_order: d.sortOrder,
        })
      );
    },
    setAvailable: (id, available) => run(db.from("dishes").update({ available }).eq("id", id)),
    deleteDish: (id) => run(db.from("dishes").delete().eq("id", id)),

    async uploadPhoto(file) {
      if (!PHOTO_TYPES.includes(file.type)) throw new Error("Please choose a JPG, PNG or WebP photo.");
      if (file.size > PHOTO_MAX_BYTES) throw new Error("That photo is over 2 MB. Please use a smaller one.");
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
      const path = `${crypto.randomUUID()}.${ext}`;
      await run(db.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" }));
      return db.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
    },
  };
})();
