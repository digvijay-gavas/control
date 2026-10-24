// Shared controller helpers for hub pages: input polling, a controller-driven
// menu (Start or Back opens it), and safe vibration.
//
//   Pad.setup({ hubUrl, title, items, holdToOpen, onMenu })
//     items:      [{ label, action, keepOpen }] shown above "Back to hub" (label may be a getter)
//     holdToOpen: open the menu only after holding Start/Back (for pages that test those buttons)
//     onMenu(open): called when the menu opens or closes
//     canOpen():  optional; return false to stop Start/Back opening the menu
//   Pad.poll() once per frame -> { connected, gp, id, down[], pressed[], lx, ly, rx, ry, lt, rt }
//     While the menu is open, pressed[] is all false so the page ignores input.
//   Pad.submenu(title, items): swap the open menu's items for a list with "← Back" (B goes back too)
//   Pad.rumble(strong, weak, ms), Pad.stopRumble(), Pad.menuOpen()
(function () {
  const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  const DEADZONE = 0.18, HOLD_MS = 800;

  let cfg = { hubUrl: "../../", title: "Menu", items: [], holdToOpen: false, onMenu: null };
  let main = null;   // the main menu while a submenu is showing
  let prev = null, open = false, sel = 0, holdStart = 0, navRepeatAt = 0, lastFrame = -1, last = null;
  let overlay, list, holdBar, holdBox;

  function radial(x, y) {
    const m = Math.hypot(x, y);
    if (m < DEADZONE) return [0, 0];
    const s = Math.min(1, (m - DEADZONE) / (1 - DEADZONE)) / m;
    return [x * s, y * s];
  }

  // ---------- vibration ----------
  // Restarting effects every frame can leave the motors stuck on with some
  // Xbox 360 receivers (a lost "stop"). So: don't interrupt a running effect
  // with a weaker one, and always send an explicit stop when an effect ends.
  let rumbleUntil = 0, rumbleLevel = 0, rumbleTimer = 0;
  function rumble(strong, weak, ms) {
    const gp = last && last.gp, act = gp && gp.vibrationActuator;
    if (!act || !act.playEffect) return;
    const now = performance.now(), level = Math.max(strong, weak);
    if (now < rumbleUntil && level < rumbleLevel + 0.2) return;
    rumbleUntil = now + ms; rumbleLevel = level;
    act.playEffect("dual-rumble", { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
    clearTimeout(rumbleTimer);
    rumbleTimer = setTimeout(stopRumble, ms + 40);
  }
  function stopRumble() {
    clearTimeout(rumbleTimer);
    rumbleUntil = 0; rumbleLevel = 0;
    for (const g of navigator.getGamepads()) {
      if (g && g.vibrationActuator && g.vibrationActuator.reset) g.vibrationActuator.reset().catch(() => {});
    }
  }
  window.addEventListener("pagehide", stopRumble);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopRumble(); });

  // ---------- menu UI ----------
  function buildUI() {
    const css = document.createElement("style");
    css.textContent = `
      .padmenu { position: fixed; inset: 0; z-index: 9999; display: none; align-items: center; justify-content: center;
        background: rgba(5,7,10,.72); backdrop-filter: blur(3px); font: 16px/1.4 system-ui, sans-serif; color: #e6e8ee; }
      .padmenu.open { display: flex; }
      .padmenu .box { background: #181b22; border: 1px solid #2a2f3a; border-radius: 16px; padding: 22px; width: min(360px, calc(100vw - 32px)); box-shadow: 0 20px 60px rgba(0,0,0,.5); }
      .padmenu h2 { margin: 0 0 14px; font-size: 20px; }
      .padmenu button { display: block; width: 100%; text-align: left; margin: 0 0 8px; padding: 12px 14px; border-radius: 10px;
        border: 2px solid transparent; background: #232833; color: inherit; font: 600 16px system-ui, sans-serif; cursor: pointer; }
      .padmenu button.sel { border-color: #4cc2ff; background: #1d3140; }
      .padmenu .hint { color: #8a92a3; font-size: 13px; margin-top: 10px; }
      .padhold { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 9998; display: none;
        background: #181b22; border: 1px solid #2a2f3a; border-radius: 10px; padding: 8px 14px; font: 600 13px system-ui, sans-serif; color: #e6e8ee; }
      .padhold i { display: block; height: 4px; margin-top: 6px; background: #4cc2ff; border-radius: 2px; width: 0; }`;
    document.head.appendChild(css);

    overlay = document.createElement("div");
    overlay.className = "padmenu";
    overlay.innerHTML = `<div class="box"><h2></h2><div class="list"></div>
      <div class="hint">D-pad / stick / arrow keys to choose · A or Enter select · B or Esc close</div></div>`;
    overlay.addEventListener("click", e => { if (e.target === overlay) setOpen(false); });
    document.body.appendChild(overlay);
    list = overlay.querySelector(".list");

    holdBox = document.createElement("div");
    holdBox.className = "padhold";
    holdBox.innerHTML = `Keep holding for menu<i></i>`;
    document.body.appendChild(holdBox);
    holdBar = holdBox.querySelector("i");
  }

  function allItems() {
    if (main) return [...cfg.items, { label: "← Back", keepOpen: true, action: back }];
    return [...cfg.items, { label: "Back to hub", action: () => { stopRumble(); location.href = cfg.hubUrl; } }];
  }

  function submenu(title, items) {
    if (!main) main = { title: cfg.title, items: cfg.items };
    cfg.title = title; cfg.items = items; sel = 0;
    if (open) render(); else setOpen(true);
  }
  function back() {
    if (!main) return;
    cfg.title = main.title; cfg.items = main.items; main = null; sel = 0;
    if (open) render();
  }

  function render() {
    overlay.querySelector("h2").textContent = cfg.title;
    list.innerHTML = "";
    allItems().forEach((it, i) => {
      const b = document.createElement("button");
      b.textContent = it.label;
      b.className = i === sel ? "sel" : "";
      b.onmouseenter = () => { sel = i; highlight(); };
      b.onclick = () => choose(i);
      list.appendChild(b);
    });
  }
  function highlight() { [...list.children].forEach((b, i) => b.classList.toggle("sel", i === sel)); }

  function setOpen(v) {
    if (v === open) return;
    open = v;
    if (!open) back();
    if (open) { sel = 0; render(); stopRumble(); }
    overlay.classList.toggle("open", open);
    if (cfg.onMenu) cfg.onMenu(open);
  }

  function choose(i) {
    const it = allItems()[i];
    if (!it) return;
    if (!it.keepOpen) setOpen(false);
    it.action();
  }

  // ---------- polling ----------
  function poll() {
    // Safe to call more than once per frame; only the first call reads the pad.
    const frame = Math.floor(performance.now() / 4);
    if (frame === lastFrame && last) return last;
    lastFrame = frame;

    const gp = [...navigator.getGamepads()].find(g => g && g.connected) || null;
    const res = { connected: !!gp, gp, id: gp ? gp.id : "", down: [], pressed: [], lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 };
    if (!gp) { last = res; holdBox.style.display = "none"; return res; }

    res.down = gp.buttons.map(b => b.pressed);
    // Some drivers report the D-pad as a hat axis instead of buttons 12-15
    if (gp.mapping !== "standard" && gp.axes.length > 9 && !res.down[BTN.UP] && !res.down[BTN.DOWN]) {
      const h = gp.axes[9];
      if (h >= -1.05 && h <= 1.05) {
        const near = v => Math.abs(h - v) < 0.1;
        res.down[BTN.UP] = near(-1) || near(-0.71) || near(1);
        res.down[BTN.RIGHT] = near(-0.71) || near(-0.43) || near(-0.14);
        res.down[BTN.DOWN] = near(-0.14) || near(0.14) || near(0.43);
        res.down[BTN.LEFT] = near(0.43) || near(0.71) || near(1);
      }
    }
    // Ignore buttons already held when the page loaded (e.g. the A that opened it).
    if (!prev) prev = res.down.slice();
    const edge = res.down.map((d, i) => d && !prev[i]);
    prev = res.down;
    [res.lx, res.ly] = radial(gp.axes[0] || 0, gp.axes[1] || 0);
    [res.rx, res.ry] = radial(gp.axes[2] || 0, gp.axes[3] || 0);
    res.lt = gp.buttons[BTN.LT] ? gp.buttons[BTN.LT].value : 0;
    res.rt = gp.buttons[BTN.RT] ? gp.buttons[BTN.RT].value : 0;
    last = res;

    const menuBtn = res.down[BTN.START] || res.down[BTN.BACK];
    const allowed = !cfg.canOpen || cfg.canOpen();
    if (!open) {
      if (!allowed) {
        holdStart = 0; holdBox.style.display = "none";
      } else if (cfg.holdToOpen) {
        if (menuBtn) {
          if (!holdStart) holdStart = performance.now();
          const t = (performance.now() - holdStart) / HOLD_MS;
          holdBox.style.display = t > 0.15 ? "block" : "none";
          holdBar.style.width = Math.min(100, t * 100) + "%";
          if (t >= 1) { holdStart = 0; holdBox.style.display = "none"; setOpen(true); }
        } else { holdStart = 0; holdBox.style.display = "none"; }
      } else if (edge[BTN.START] || edge[BTN.BACK]) {
        setOpen(true);
      }
      res.pressed = open ? res.down.map(() => false) : edge;
      return res;
    }

    // Menu is open: it owns the input.
    res.pressed = res.down.map(() => false);
    if (edge[BTN.B] && main) { back(); return res; }
    if (edge[BTN.B] || (!cfg.holdToOpen && (edge[BTN.START] || edge[BTN.BACK]))) { setOpen(false); return res; }
    if (edge[BTN.A]) { choose(sel); return res; }
    const n = allItems().length, now = performance.now();
    const dir = (res.down[BTN.DOWN] || res.ly > 0.6 ? 1 : 0) - (res.down[BTN.UP] || res.ly < -0.6 ? 1 : 0);
    const fresh = edge[BTN.DOWN] || edge[BTN.UP];
    if (dir && (fresh || now > navRepeatAt)) {
      sel = (sel + dir + n) % n; highlight();
      navRepeatAt = now + (fresh ? 380 : 170);
    }
    return res;
  }

  // Keyboard works in the menu too: arrows choose, Enter selects, Esc opens/closes
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (open && main) { back(); e.preventDefault(); return; }
      if (open || !cfg.canOpen || cfg.canOpen()) setOpen(!open);
      e.preventDefault(); return;
    }
    if (!open) return;
    const n = allItems().length;
    if (e.key === "ArrowDown") { sel = (sel + 1) % n; highlight(); }
    else if (e.key === "ArrowUp") { sel = (sel - 1 + n) % n; highlight(); }
    else if (e.key === "Enter" || e.key === " ") choose(sel);
    else return;
    e.preventDefault();
  });

  function setup(options) {
    cfg = Object.assign(cfg, options);
    if (open) render();
  }

  if (document.body) buildUI(); else document.addEventListener("DOMContentLoaded", buildUI);

  window.Pad = { BTN, setup, submenu, poll, rumble, stopRumble, menuOpen: () => open, openMenu: () => setOpen(true), closeMenu: () => setOpen(false) };
})();
