# Cloud kitchen website

A simple ordering website for a small cloud kitchen. Customers browse the menu, fill a cart, and send the order to the kitchen's WhatsApp, already written out. There's no server, database, login or app to install.

## Files

| File | What it is |
|---|---|
| `js/config.js` | **Your business details**: name, WhatsApp number, hours, fees, delivery pincodes, FSSAI number, today's note |
| `js/menu.js` | **Your menu**: the 10 dishes, prices, veg / non-veg, sold out |
| `index.html` | The home page. Write your story in the "Why we started" section |
| `privacy.html` | Privacy policy, in plain language |
| `images/` | Put your food and team photos here |
| `_headers` | Security settings for hosting (Netlify / Cloudflare Pages) |

## Day-to-day edits

- **Sold out?** In `js/menu.js`, set `available: false` on that dish.
- **Change a price:** edit `price` in `js/menu.js`.
- **New note on the home page:** edit `kitchenNote` in `js/config.js`.
- **Add a photo:** save it as e.g. `images/chicken-biryani.jpg` (landscape, about 800×500, under 200 KB) and set `image: "images/chicken-biryani.jpg"` on that dish.

## Run it on your computer

```bash
python -m http.server 5500
```

Then open http://localhost:5500

## Before you launch: make it genuine

People can tell a template from a real kitchen. These are what make the difference:

- [ ] **Real photos** of your own food, in your own containers, on a plain background in daylight. Never use stock photos. This matters more than anything else on this list.
- [ ] **A photo of you or your team** in the kitchen, in place of the dashed box in "Why we started".
- [ ] **Your story in your own words** in `index.html` (the `[ ... ]` lines). Short and honest beats polished.
- [ ] **Real details** in `js/config.js`: brand name, WhatsApp number, address, FSSAI licence number, delivery pincodes.
- [ ] **Only promises you keep.** Check the "Cooked to order / Clean kitchen / Honest pricing" boxes in `index.html` and the descriptions in `menu.js`. Delete anything that isn't true every day.
- [ ] **No fake reviews or numbers.** Add reviews only once real customers give them, with permission, using first name and area only.
- [ ] Fill `privacyContactName` in `js/config.js`, and have someone qualified check `privacy.html` against your actual practice.
- [ ] **Last step:** set `previewMode: false` in `js/config.js`. Until then the site shows a "preview" banner, and orders are shown on screen instead of sent, so no order can reach a wrong number. The "Why we started" text is also sample writing until it's replaced.

## Legal basics (India)

- An **FSSAI licence or registration** is required to sell food, and the number must be shown on the site. It's in the footer.
- **GST**: check with your CA whether you must register. The 5% rate in `config.js` assumes standard restaurant-service GST. If you're not registered, set `gstRate: 0`.
- The **Digital Personal Data Protection Act, 2023** applies to the customer details you receive. `privacy.html` covers the basics: collect little, explain why, let people ask for deletion.

## Privacy and security, built in

- **No tracking:** no cookies, analytics, ad pixels, Google Fonts or other third-party scripts. Fonts are the device's own.
- **No customer data on any server.** Orders go from the customer's phone straight to your WhatsApp.
- **Opt-in memory:** details are saved on the customer's device only if they tick "Remember my details", and "Forget my saved details" wipes them.
- **Content Security Policy** in every page, plus `_headers` (HSTS, no framing, no-referrer, permissions locked down) when hosted on Netlify or Cloudflare Pages.
- All menu and config text is escaped before it's shown, and form input is validated and length-limited.
- The site never asks for card details, OTPs or passwords, and says so on the page, so customers can spot scammers who pretend to be you.

**Protect the WhatsApp number orders go to:** use WhatsApp Business, turn on two-step verification (Settings → Account → Two-step verification), and don't share the PIN.

## Putting it online (free)

1. Create a free account on [Netlify](https://www.netlify.com/) or [Cloudflare Pages](https://pages.cloudflare.com/).
2. Drag this whole folder onto the "deploy" area (Netlify Drop works without setup).
3. Connect your own domain (about ₹800–1,000 a year), e.g. `yourkitchen.in`. HTTPS is set up automatically.

## Next steps (when you're ready)

1. **Online payment:** Razorpay or Cashfree payment links / UPI QR in the WhatsApp confirmation, then a checkout on the site.
2. **Order dashboard:** a simple backend so orders land in a list you can mark *accepted → cooking → out for delivery*, with SMS/WhatsApp updates to customers.
3. **Swiggy / Zomato listing** alongside direct orders. Keep direct orders cheaper; they don't pay 20–30% commission.
4. **Google Business Profile** with the same photos, hours and link to this site, so you show up for "biryani near me".
