// Attitude-hold assist shared by Gravity Lander's landing and orbit modes.
//
// The pilot chooses an angle; a PID controller commands the rotation thrusters
// to get there. It only ever asks for angular acceleration the thrusters can
// really give (clamped to maxAlpha), so the physics is unchanged: this is the
// same job a real spacecraft's attitude control system does.
//
//   u = Kp * error + Ki * integral(error) - Kd * angular velocity
//
// The derivative acts on the measured spin rather than on the error, so moving
// the stick doesn't cause a sudden kick. For a pure rotation (theta'' = u) the
// response is critically damped, fastest without overshoot, when Kd = 2 * sqrt(Kp).
//
//   Assist.pid              shared controller: .update(err, omega, dt, maxAlpha), .reset()
//   Assist.gains            { kp, ki, kd }, saved in the browser
//   Assist.record(t, target, angle)   feed the tuning chart
//   Assist.open() / close() / isOpen() / handle(pad)   controller-driven tuning panel
(function () {
  const KEY = "gravity-lander-pid";
  const DEFAULTS = { kp: 6, ki: 0.5, kd: 4.5 };
  const LIMITS = { kp: [0.2, 60], ki: [0, 10], kd: [0, 30] };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function load() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(gains)); } catch (e) {} }
  const gains = load();

  const pid = {
    i: 0,
    reset() { this.i = 0; },
    update(err, omega, dt, maxAlpha) {
      const u0 = gains.kp * err + gains.ki * this.i - gains.kd * omega;
      // Anti-windup: stop integrating while the thrusters are already maxed out
      if (Math.abs(u0) < maxAlpha) this.i = clamp(this.i + err * dt, -1, 1);
      return clamp(u0, -maxAlpha, maxAlpha);
    },
  };

  // ---------- history for the chart ----------
  const hist = [];
  function record(t, target, angle) {
    hist.push([t, target, angle]);
    while (hist.length && t - hist[0][0] > 6) hist.shift();
    if (hist.length > 2000) hist.shift();
  }

  // ---------- tuning panel ----------
  const ROWS = [
    { key: "kp", name: "Kp  (proportional)", help: "How hard it pushes toward the target angle. Higher = snappier, too high = wobbles." },
    { key: "ki", name: "Ki  (integral)", help: "Removes a steady leftover error, e.g. from wind. Too high = slow swinging." },
    { key: "kd", name: "Kd  (derivative)", help: "Brakes the spin. Too low = overshoots, too high = sluggish. No overshoot near 2·√Kp." },
    { key: "reset", name: "Reset to defaults" },
    { key: "done", name: "Done" },
  ];
  let el, rows, chart, critEl, openFlag = false, sel = 0, repeatAt = 0, prev = [];

  function build() {
    const css = document.createElement("style");
    css.textContent = `
      .pidpanel { position: fixed; right: 16px; bottom: 16px; z-index: 9000; width: min(400px, calc(100vw - 32px)); display: none;
        background: rgba(18,21,28,.94); border: 1px solid #2a2f3a; border-radius: 14px; padding: 16px; color: #e6e8ee;
        font: 14px/1.4 system-ui, sans-serif; box-shadow: 0 16px 50px rgba(0,0,0,.5); }
      .pidpanel.open { display: block; }
      .pidpanel h2 { margin: 0 0 4px; font-size: 17px; }
      .pidpanel p { margin: 0 0 10px; color: #8a92a3; font-size: 12.5px; }
      .pidpanel .row { padding: 7px 10px; border-radius: 8px; border: 2px solid transparent; margin-bottom: 4px; cursor: pointer; }
      .pidpanel .row.sel { border-color: #4cc2ff; background: #1d3140; }
      .pidpanel .row .top { display: flex; justify-content: space-between; font-weight: 700; }
      .pidpanel .row .val { font-family: ui-monospace, Consolas, monospace; }
      .pidpanel .row small { display: none; color: #8a92a3; font-size: 12px; margin-top: 2px; }
      .pidpanel .row.sel small { display: block; }
      .pidpanel canvas { width: 100%; height: 110px; display: block; margin: 8px 0; background: #0d0f14; border-radius: 8px; }
      .pidpanel .crit { font-size: 12px; color: #ffb547; }
      .pidpanel .keys { font-size: 12px; color: #8a92a3; margin-top: 8px; }`;
    document.head.appendChild(css);
    el = document.createElement("div");
    el.className = "pidpanel";
    el.innerHTML = `<h2>Attitude assist (PID)</h2>
      <p>Point the stick where you want the craft to face; the controller fires the real rotation thrusters to hold that angle. Try it while flying.</p>
      <canvas width="736" height="220"></canvas>
      <div class="crit"></div>
      <div class="rows"></div>
      <div class="keys">D-pad ▲▼ choose · ◀▶ adjust (hold for faster) · A select · B close</div>`;
    document.body.appendChild(el);
    chart = el.querySelector("canvas");
    critEl = el.querySelector(".crit");
    rows = el.querySelector(".rows");
    ROWS.forEach((r, i) => {
      const d = document.createElement("div");
      d.className = "row";
      d.innerHTML = `<div class="top"><span>${r.name}</span><span class="val"></span></div>${r.help ? `<small>${r.help}</small>` : ""}`;
      d.onclick = () => { sel = i; activate(); render(); };
      rows.appendChild(d);
    });
    render();
  }

  function render() {
    [...rows.children].forEach((d, i) => {
      d.classList.toggle("sel", i === sel);
      const k = ROWS[i].key;
      if (gains[k] !== undefined) d.querySelector(".val").textContent = gains[k].toFixed(2);
    });
    critEl.textContent = `Critical damping for this Kp: Kd ≈ ${(2 * Math.sqrt(gains.kp)).toFixed(2)}`;
  }

  function drawChart() {
    const c = chart.getContext("2d"), w = chart.width, h = chart.height;
    c.clearRect(0, 0, w, h);
    c.strokeStyle = "#2a2f3a"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    c.fillStyle = "#5c6475"; c.font = "20px system-ui"; c.fillText("target", 10, 24);
    c.fillStyle = "#4cc2ff"; c.fillText("actual angle", 90, 24);
    if (hist.length < 2) return;
    const t1 = hist[hist.length - 1][0], t0 = t1 - 6, range = 0.9;  // ±0.9 rad ≈ ±52°
    const X = t => (t - t0) / 6 * w, Y = a => h / 2 - clamp(a / range, -1, 1) * (h / 2 - 8);
    const line = (idx, color, dash) => {
      c.strokeStyle = color; c.lineWidth = 3; c.setLineDash(dash);
      c.beginPath(); hist.forEach((p, i) => i ? c.lineTo(X(p[0]), Y(p[idx])) : c.moveTo(X(p[0]), Y(p[idx]))); c.stroke();
      c.setLineDash([]);
    };
    line(1, "#8a92a3", [10, 8]);
    line(2, "#4cc2ff", []);
  }

  function activate() {
    const k = ROWS[sel].key;
    if (k === "reset") { Object.assign(gains, DEFAULTS); pid.reset(); save(); }
    if (k === "done") close();
  }

  function adjust(dir) {
    const k = ROWS[sel].key;
    if (gains[k] === undefined) return;
    // Multiplicative steps feel even across small and large values
    let v = gains[k];
    if (v < 0.05 && dir > 0) v = 0.05;
    else v = dir > 0 ? v * 1.12 : v / 1.12;
    if (v < 0.05 && LIMITS[k][0] === 0) v = 0;
    gains[k] = clamp(+v.toFixed(3), LIMITS[k][0], LIMITS[k][1]);
    save(); render();
  }

  // Called each frame by the game while the panel is open; p comes from Pad.poll()
  function handle(p) {
    const edge = i => p.down[i] && !prev[i];
    const B = Pad.BTN, now = performance.now();
    if (edge(B.B)) { prev = p.down.slice(); close(); return; }
    if (edge(B.A)) activate();
    const v = (p.down[B.DOWN] ? 1 : 0) - (p.down[B.UP] ? 1 : 0);
    const hz = (p.down[B.RIGHT] ? 1 : 0) - (p.down[B.LEFT] ? 1 : 0);
    const fresh = edge(B.UP) || edge(B.DOWN) || edge(B.LEFT) || edge(B.RIGHT);
    if ((v || hz) && (fresh || now > repeatAt)) {
      if (v) sel = (sel + v + ROWS.length) % ROWS.length;
      else adjust(hz);
      repeatAt = now + (fresh ? 380 : 90);
      render();
    }
    prev = p.down.slice();
    drawChart();
  }

  function open() {
    openFlag = true; sel = 0; el.classList.add("open"); render();
    // Treat buttons already held as old, so the A that opened the panel doesn't act
    const gp = [...navigator.getGamepads()].find(g => g && g.connected);
    prev = gp ? gp.buttons.map(b => b.pressed) : [];
  }
  function close() { openFlag = false; el.classList.remove("open"); }

  // ---------- status panel drawn on the game canvas ----------
  // o: { on, mode, detail, fuelInf }. Bottom-left corner at (x, yBottom).
  function drawStatus(ctx, x, yBottom, o) {
    const w = 310, h = 112, y = yBottom - h;
    ctx.save();
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(10,12,18,0.8)";
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = o.on ? "rgba(61,220,132,0.6)" : "rgba(255,181,71,0.6)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#c9d1e0"; ctx.font = "800 13px system-ui, sans-serif";
    ctx.fillText("ATTITUDE ASSIST", x + 14, y + 24);
    // ON/OFF pill
    ctx.fillStyle = o.on ? "#3ddc84" : "#ffb547";
    ctx.beginPath(); ctx.roundRect(x + 140, y + 9, 54, 22, 11); ctx.fill();
    ctx.fillStyle = "#0d0f14"; ctx.font = "900 13px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(o.on ? "ON" : "OFF", x + 167, y + 25);
    ctx.textAlign = "left"; ctx.fillStyle = "#8a92a3"; ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillText("X: on/off", x + 204, y + 24);
    ctx.fillStyle = "#fff"; ctx.font = "700 14px system-ui, sans-serif";
    ctx.fillText(o.mode, x + 14, y + 48, w - 28);
    ctx.fillStyle = "#8a92a3"; ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillText(o.detail, x + 14, y + 68, w - 28);
    ctx.fillStyle = o.fuelInf ? "#3ddc84" : "#8a92a3"; ctx.font = "700 12px system-ui, sans-serif";
    ctx.fillText(o.fuelInf ? "FUEL: UNLIMITED   (B: turn off)" : "FUEL: normal   (B: unlimited fuel)", x + 14, y + 96);
    ctx.restore();
  }

  if (document.body) build(); else document.addEventListener("DOMContentLoaded", build);

  window.Assist = { pid, gains, record, open, close, isOpen: () => openFlag, handle, drawStatus, DEFAULTS };
})();
