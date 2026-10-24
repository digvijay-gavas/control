// Start screens for Gravity Lander and the Orbit Mission: a list you drive with the
// controller (D-pad / stick ▲▼, A select, B back), the keyboard (arrows, Enter,
// Backspace) or the mouse, drawn on the game's canvas.
//
//   Launcher.draw(ctx, W, H, screen)   screen = { title, lines: [text], items, sel, hint }
//     items: [{ label, value, note, status: "done" | "open" | "locked", action }]
//     label and value may be getters (for ON/OFF switches)
//   Launcher.handle(p, screen, onBack)  call once per frame with Pad.poll()'s result
//   Launcher.attach(getScreen, onBack)  keyboard and mouse for whatever screen is showing
//
//   Launcher.settings  flight settings saved in the browser and shared by both modes:
//     { assist, autoLand, showPath }; Launcher.saveSettings(partial) stores changes
(function () {
  const KEY = "gravity-lander-settings";
  const settings = { assist: true, autoLand: false, showPath: true };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  function saveSettings(s) {
    Object.assign(settings, s);
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {}
  }

  let rects = [], navAt = 0;
  const selectable = it => it.status !== "locked" && it.status !== "info";

  function move(screen, dir) {
    const n = screen.items.length;
    for (let k = 1; k <= n; k++) {
      const i = (screen.sel + dir * k + n * k) % n;
      if (selectable(screen.items[i])) { screen.sel = i; return; }
    }
  }
  function choose(screen) {
    const it = screen.items[screen.sel];
    if (it && selectable(it) && it.action) it.action();
  }

  function handle(p, screen, onBack) {
    if (!screen || !p.connected) return;
    if (!selectable(screen.items[screen.sel] || {})) move(screen, 1);
    const B = Pad.BTN, now = performance.now();
    const dir = (p.down[B.DOWN] || p.ly > 0.6 ? 1 : 0) - (p.down[B.UP] || p.ly < -0.6 ? 1 : 0);
    const fresh = p.pressed[B.DOWN] || p.pressed[B.UP];
    if (dir && (fresh || now > navAt)) { move(screen, dir); navAt = now + (fresh ? 380 : 170); }
    if (p.pressed[B.A]) choose(screen);
    else if (p.pressed[B.B] && onBack) onBack();
  }

  function attach(getScreen, onBack) {
    window.addEventListener("keydown", e => {
      const s = getScreen();
      if (!s || Pad.menuOpen()) return;
      if (e.key === "ArrowDown") move(s, 1);
      else if (e.key === "ArrowUp") move(s, -1);
      else if (e.key === "Enter" || e.key === " ") choose(s);
      else if (e.key === "Backspace" && onBack) onBack();
      else return;
      e.preventDefault();
    });
    window.addEventListener("click", e => {
      const s = getScreen();
      if (!s || Pad.menuOpen()) return;
      const r = rects.find(r => e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h);
      if (r && selectable(s.items[r.i])) { s.sel = r.i; choose(s); }
    });
  }

  function draw(ctx, W, H, screen) {
    const lines = screen.lines || [], items = screen.items;
    const rowH = 40, bw = Math.min(600, W - 32);
    const bh = 70 + lines.length * 22 + items.length * (rowH + 6) + 44;
    const bx = (W - bw) / 2, by = Math.max(16, (H - bh) / 2);
    ctx.save();
    ctx.fillStyle = "rgba(4,6,10,0.62)"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#181b22"; ctx.strokeStyle = "#2a2f3a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 18); ctx.fill(); ctx.stroke();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#4cc2ff"; ctx.font = "900 34px system-ui, sans-serif";
    ctx.fillText(screen.title, W / 2, by + 38, bw - 40);
    let y = by + 74;
    ctx.font = "500 14px system-ui, sans-serif"; ctx.fillStyle = "#c9d1e0";
    for (const l of lines) { ctx.fillText(l, W / 2, y, bw - 40); y += 22; }
    y += 6;
    rects = [];
    items.forEach((it, i) => {
      const x = bx + 20, w = bw - 40, sel = i === screen.sel, locked = it.status === "locked", info = it.status === "info";
      rects.push({ x, y, w, h: rowH, i });
      ctx.fillStyle = sel ? "#1d3140" : info ? "rgba(61,220,132,0.08)" : "#232833";
      ctx.beginPath(); ctx.roundRect(x, y, w, rowH, 10); ctx.fill();
      if (sel) { ctx.strokeStyle = "#4cc2ff"; ctx.lineWidth = 2; ctx.stroke(); }
      const mark = it.status === "done" ? "✓ " : locked ? "🔒 " : "";
      ctx.textAlign = "left";
      ctx.fillStyle = locked ? "#5c6475" : it.status === "done" || info ? "#3ddc84" : "#e6e8ee";
      ctx.font = "700 15px system-ui, sans-serif";
      ctx.fillText(mark + it.label, x + 14, y + (it.note ? 14 : rowH / 2), w * 0.62);
      if (it.note) {
        ctx.fillStyle = locked ? "#4a5060" : "#8a92a3"; ctx.font = "500 11px system-ui, sans-serif";
        ctx.fillText(it.note, x + 14 + (mark ? 18 : 0), y + 30, w * 0.7);
      }
      if (it.value !== undefined) {
        const v = String(it.value), on = v === "ON";
        ctx.textAlign = "right"; ctx.font = "800 13px system-ui, sans-serif";
        ctx.fillStyle = on ? "#3ddc84" : v === "OFF" ? "#8a92a3" : "#ffb547";
        ctx.fillText(v, x + w - 14, y + rowH / 2);
      }
      y += rowH + 6;
    });
    ctx.textAlign = "center"; ctx.fillStyle = "#5c6475"; ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillText(screen.hint || "D-pad / stick ▲▼ choose · A select · B back · (keyboard: arrows, Enter, Backspace)", W / 2, by + bh - 20, bw - 40);
    ctx.restore();
  }

  // Settings shared by both modes; the page passes what each switch should do
  function settingsScreen({ toggleAssist, toggleAutoLand, toggleFuel, togglePath, tune, back, getFuel, getAssist, getAutoLand, getPath }) {
    return {
      title: "SETTINGS", sel: 0,
      lines: ["Saved in this browser and shared by landing practice and the orbit mission."],
      items: [
        { label: "Attitude assist (PID)", get value() { return getAssist() ? "ON" : "OFF"; }, note: "On: the stick sets the angle and the assist holds it. Off: raw rotation thrusters (X in flight)", action: toggleAssist },
        { label: "Auto-land", get value() { return getAutoLand() ? "ON" : "OFF"; }, note: "Flies the descent and touchdown for you (L3 in flight: click the left stick)", action: toggleAutoLand },
        { label: "Unlimited fuel", get value() { return getFuel() ? "ON" : "OFF"; }, note: "Practice: tanks never drain, no fuel bonus in the score (B in flight)", action: toggleFuel },
        { label: "Sound (voice callouts)", get value() { return Lander.voice.on ? "ON" : "OFF"; }, note: "Spoken altitude, Brake now / Sink rate warnings, tones", action: () => Lander.voice.toggle() },
        { label: "Flight path preview", get value() { return getPath() ? "ON" : "OFF"; }, note: "Dotted path ahead of the lander in landing practice (Y in flight)", action: togglePath },
        { label: "Tune attitude assist (PID)…", note: "Kp, Ki, Kd with a live chart", action: tune },
        { label: "← Back", action: back },
      ],
    };
  }

  window.Launcher = { draw, handle, attach, settings, saveSettings, settingsScreen };
})();
