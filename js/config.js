// ---------------------------------------------------------------
// Business settings. Edit these values — no code changes needed.
// ---------------------------------------------------------------
window.CK_CONFIG = {
  // PREVIEW MODE — keep true while the menu and details below are sample data.
  // Shows a "preview" banner, and orders are shown on screen instead of being
  // sent to WhatsApp, so no real customer order can reach a wrong number.
  // Set to false only after every detail below is real.
  previewMode: true,

  brandName: "Jisha's Pantry",
  tagline: "Home-style meals, cooked fresh and delivered hot.",
  city: "Chennai",

  // Orders are sent to this WhatsApp number.
  // Country code + number, digits only (no +, spaces or dashes).
  whatsappNumber: "919999999999",
  phoneDisplay: "+91 99999 99999",
  email: "hello@example.com",
  instagram: "", // e.g. "https://instagram.com/yourkitchen"

  kitchenAddress: "Kitchen address, Area, Chennai 600001",
  fssaiLicense: "00000000000000", // 14-digit FSSAI licence number (legally required on the site)

  currency: "₹",

  // Kitchen hours in 24h "HH:MM". Close must be later than open (same day).
  hours: { open: "11:00", close: "23:00" },
  prepMinutes: 40, // earliest delivery = now + prepMinutes

  minOrder: 149,
  deliveryFee: 30,
  freeDeliveryAbove: 399, // set to 0 to always charge delivery
  packagingFee: 10,
  gstRate: 0.05, // 5% GST for restaurant services

  // Pincodes you deliver to. Leave empty [] to accept all pincodes.
  serviceablePincodes: ["600001", "600002", "600004", "600005", "600006", "600014", "600017", "600018", "600020", "600028"],

  paymentOptions: ["UPI on delivery", "Cash on delivery"],

  // A short handwritten-style note shown on the home page. Change it often —
  // it's what makes the site feel like a real kitchen, not a template.
  kitchenNote: "Biryani goes on dum at 11 every morning. If it's sold out by evening, that's why — we don't make a second, rushed batch.",
  kitchenNoteSignature: "— from our kitchen",

  // Shown in the privacy policy. Who customers can contact about their data.
  privacyContactName: "Owner name",
  privacyPolicyUpdated: "22 October 2026",
};
