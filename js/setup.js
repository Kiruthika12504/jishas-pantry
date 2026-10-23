// Setup page: shows supabase/schema.sql in short parts with Copy buttons, so it can be run from a phone.
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  }

  // Sections in schema.sql start with a line like "-- ---------- Tables ----------".
  function split(sql) {
    const parts = [];
    let current = null;
    for (const line of sql.split(/\r?\n/)) {
      const m = line.match(/^-- -{5,} (.+?) -{5,}/);
      if (m) { current = { title: m[1], lines: [] }; parts.push(current); continue; }
      if (current) current.lines.push(line);
    }
    return parts.map((p) => ({ title: p.title, sql: p.lines.join("\n").trim() + "\n" })).filter((p) => p.sql.trim());
  }

  async function copy(text, pre) {
    try { await navigator.clipboard.writeText(text); toast("Copied. Paste it in the SQL Editor and tap Run."); }
    catch {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      toast("Text selected. Tap Copy in your phone's menu.");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const res = await fetch("supabase/schema.sql", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const parts = split(await res.text());
      const box = $("#parts");
      parts.forEach((p, i) => {
        const card = document.createElement("section");
        card.className = "card";
        const h = document.createElement("h2");
        h.textContent = `Part ${i + 1} of ${parts.length}: ${p.title}`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-primary btn-block";
        btn.textContent = `Copy part ${i + 1}`;
        const pre = document.createElement("pre");
        pre.className = "sql-block";
        pre.textContent = p.sql;
        btn.addEventListener("click", () => { copy(p.sql, pre); btn.textContent = `Copied part ${i + 1} ✓`; });
        card.append(h, btn, pre);
        box.append(card);
      });
      $("#status").hidden = true;
      $("#after").hidden = false;
    } catch {
      $("#status").textContent = "Couldn't load the setup script. Check your connection and refresh.";
    }
  });
})();
