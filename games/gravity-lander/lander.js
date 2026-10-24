// Landing helpers shared by landing practice and the orbit mission.
//
//   Lander.contact(s, pts, m, ground, mem)
//     Rigid-body ground contact. Each landing leg is a spring with a damper (a shock
//     absorber), the body is much stiffer, and friction grips the ground until it is
//     overcome. Forces act at the contact points, so a craft that lands tilted or
//     moving sideways can bounce, slide, or tip over and tumble like a real lander.
//       s        { x, y, vx, vy, om }: centre of mass, its velocity, spin (rad/s, CCW)
//       pts      [{ x, y, foot }]: contact points as world-axis offsets in metres from
//                the centre of mass (already rotated with the craft)
//       m        mass in kg (spring strengths scale with it)
//       ground(wx, wy) -> null if clear, else { pen, nx, ny, gvx, gvy }: depth below
//                the surface, the surface normal and the ground's own velocity
//       mem      array the caller keeps between steps (which points were touching)
//     Returns { fx, fy, tq, feet, body, impacts: [{ foot, speed }] }; an impact is a
//     point that just touched, with how fast it was moving into the ground.
//
//   Lander.autoLand({ alt, vUp, vSide, g, amax, wantSide })
//     Descent autopilot in the local frame (up = away from the ground). Plans a
//     braking profile, kills sideways speed and touches down at about 0.8 m/s.
//     Returns the thrust acceleration it wants, { aUp, aSide }, the descent speed it
//     is aiming for (vTarget) and the lean to hold from upright (tilt, toward +side).
//
//   Lander.drawRadar(ctx, x, y, { alt, vUp, g, amax, title })
//     Radar altimeter panel: height of the legs above the ground below, time to
//     impact and when to start braking.
//
//   Lander.radarFrom(g): altitude below which the radar is shown and auto-land works.
//
//   Lander.voice: spoken altitude callouts and warning tones (browser speech + Web Audio,
//   no sound files). Muted or not is remembered ("gravity-lander-sound").
//     voice.reset(alt)     new flight or checkpoint: only marks below alt get called
//     voice.update({ alt, vUp, g, amax, contact, from })   once per frame while flying;
//                          from = highest mark to call (the radar range)
//     voice.event(name)    "contact", "landed", "crash", "tipped", "ready", "autoOn", "autoOff"
//     voice.toggle(), voice.on, voice.blocked(): true while the browser still holds sound
//     back (it needs one click or key press on the page first)
//     voice.drawHint(ctx, x, y): says so on screen when blocked
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const LEG_K = 300, LEG_C = 10, BODY_K = 2000, BODY_C = 45;   // per unit of mass
  const GRIP = 60;                                              // friction stiffness, per unit of mass
  const MU_FOOT = 0.7, MU_BODY = 0.5;
  const LEG_BREAK = 4;                                          // m/s a leg can take

  function contact(s, pts, m, ground, mem) {
    const out = { fx: 0, fy: 0, tq: 0, feet: 0, body: 0, impacts: [] };
    pts.forEach((p, i) => {
      const g = ground(s.x + p.x, s.y + p.y);
      if (!g || g.pen <= 0) { mem[i] = false; return; }
      // Velocity of this point relative to the ground (v + omega x r)
      const vx = s.vx - s.om * p.y - g.gvx, vy = s.vy + s.om * p.x - g.gvy;
      const vin = -(vx * g.nx + vy * g.ny);                     // speed into the ground
      if (!mem[i] && vin > 0) out.impacts.push({ foot: p.foot, speed: vin });
      mem[i] = true;
      const k = p.foot ? LEG_K : BODY_K, c = p.foot ? LEG_C : BODY_C;
      const fn = Math.max(0, m * (k * g.pen + c * vin));       // pushes only, never pulls
      const tx = -g.ny, ty = g.nx, vt = vx * tx + vy * ty;
      const mu = p.foot ? MU_FOOT : MU_BODY;
      const ft = -clamp(m * GRIP * vt, -mu * fn, mu * fn);
      const fx = g.nx * fn + tx * ft, fy = g.ny * fn + ty * ft;
      out.fx += fx; out.fy += fy; out.tq += p.x * fy - p.y * fx;
      if (p.foot) out.feet++; else out.body++;
    });
    return out;
  }

  function autoLand({ alt, vUp, vSide, g, amax, wantSide = 0 }) {
    const touch = 0.8;
    // Drift speed the pilot asked for, fading out near the ground
    wantSide = clamp(wantSide, -(0.4 + alt * 0.25), 0.4 + alt * 0.25);
    const brake = Math.max(0.2, 0.45 * (amax - g));              // braking we plan with, with margin
    const tSide = Math.abs(vSide - wantSide) / Math.max(0.2, 0.6 * amax);
    // Fall no faster than we can stop, and slowly enough to lose the sideways speed first
    const vStop = Math.sqrt(2 * brake * Math.max(0, alt - 2)), vDown = Math.max(touch, Math.min(vStop, alt / Math.max(tSide, 1)));
    const vTarget = -vDown;
    // On the braking curve the target speed itself shrinks at `brake` m/s², so ask for that too
    const ff = vDown === vStop && vUp < 0 ? brake : 0;
    let aUp = g + ff + 2 * (vTarget - vUp);
    aUp = clamp(aUp, alt > 500 ? -0.5 * amax : 0, amax);
    let aSide = 0.6 * (wantSide - vSide);
    const room = Math.sqrt(Math.max(0, amax * amax - aUp * aUp));
    // Stay nearly upright close to the ground (turning back upright takes time):
    // 4° at touchdown, 18° at 30 m, up to 80° high up
    const maxTilt = clamp(alt * 0.6, 4, 80) * Math.PI / 180;
    aSide = clamp(aSide, -room, room);
    const high = maxTilt >= 80 * Math.PI / 180;
    if (!high) {
      const tiltCap = Math.tan(maxTilt) * Math.max(aUp, g * 0.5, 0.1);
      aSide = clamp(aSide, -tiltCap, tiltCap);
    }
    // Attitude to hold: high up, along the thrust wanted (even sideways or down, to
    // shed orbital speed); low down, lean as if hovering so coasting doesn't swing it over
    const tilt = high && Math.hypot(aUp, aSide) > 0.05 * amax
      ? Math.atan2(aSide, aUp) : Math.atan2(aSide, Math.max(aUp, 0.7 * g, 0.1));
    return { aUp, aSide, vTarget, tilt };
  }

  function radarFrom(g) {
    // Stronger gravity means braking has to start higher up
    return clamp(Math.round(8 * Math.sqrt(g)), 5, 30) * 1000;
  }

  function fmtAlt(a) {
    if (a >= 10000) return (a / 1000).toFixed(1) + " km";
    if (a >= 100) return Math.round(a) + " m";
    return a.toFixed(1) + " m";
  }

  function drawRadar(ctx, x, y, { alt, vUp, g, amax, title = "RADAR ALTITUDE", from }) {
    const w = 250, h = 104;
    ctx.save();
    ctx.fillStyle = "rgba(10,12,18,0.78)"; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = "#8a92a3"; ctx.font = "700 11px system-ui, sans-serif"; ctx.fillText(title, x + 14, y + 20);
    ctx.fillStyle = "#e6e8ee"; ctx.font = "800 26px ui-monospace, Consolas, monospace";
    ctx.fillText(fmtAlt(Math.max(0, alt)), x + 14, y + 50);
    // Altitude bar on a log scale, so the last metres get room
    const top = from || 10000, frac = clamp(Math.log(1 + Math.max(0, alt)) / Math.log(1 + top), 0, 1);
    ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(x + w - 22, y + 12, 8, h - 24);
    ctx.fillStyle = alt < 10 ? "#ffb547" : "#4cc2ff"; ctx.fillRect(x + w - 22, y + 12 + (h - 24) * (1 - frac), 8, (h - 24) * frac);

    // Free-fall time to impact, and the distance needed to stop at full throttle
    let cue = "Climbing", color = "#8a92a3", line2 = `${vUp >= 0 ? "↑" : "↓"} ${Math.abs(vUp).toFixed(1)} m/s`;
    if (vUp < -0.05) {
      const tImpact = (vUp + Math.sqrt(vUp * vUp + 2 * g * Math.max(0, alt))) / g;
      line2 += `  ·  impact in ${tImpact < 100 ? tImpact.toFixed(1) : Math.round(tImpact)} s`;
      if (amax <= g * 1.01) { cue = "Thrust can't beat gravity"; color = "#ff6b5c"; }
      else {
        const stop = vUp * vUp / (2 * (amax - g));
        if (stop > alt * 0.9) { cue = "BRAKE NOW: full throttle"; color = "#ff6b5c"; }
        else if (stop > alt * 0.5) { cue = "Start braking"; color = "#ffb547"; }
        else { cue = `Stopping takes ${fmtAlt(stop)}`; color = "#3ddc84"; }
      }
    } else if (vUp > -0.05 && vUp < 0.05) cue = "Hovering";
    ctx.fillStyle = "#c9d1e0"; ctx.font = "600 12px system-ui, sans-serif"; ctx.fillText(line2, x + 14, y + 72);
    ctx.fillStyle = color; ctx.font = "700 13px system-ui, sans-serif"; ctx.fillText(cue, x + 14, y + 92);
    ctx.restore();
  }

  // ---------- sound ----------
  const SOUND_KEY = "gravity-lander-sound";
  const MARKS = [10000, 5000, 2000, 1000, 500, 300, 200, 100, 50, 40, 30, 20, 10, 5];
  const voice = {
    on: true, marks: [], lastBrake: -Infinity, lastSink: -Infinity, ac: null,
    blocked() {
      if (!this.on) return false;
      const act = navigator.userActivation;
      return act ? !act.hasBeenActive : !!(this.ac && this.ac.state !== "running");
    },
    ctx() {
      if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
      if (this.ac.state === "suspended") this.ac.resume().catch(() => {});
      return this.ac;
    },
    // A short beep; several in a row with gap seconds between them
    tone(freq, dur = 0.12, type = "sine", vol = 0.18, count = 1, gap = 0.08) {
      if (!this.on) return;
      const ac = this.ctx(); if (!ac || ac.state !== "running") return;
      for (let i = 0; i < count; i++) {
        const t0 = ac.currentTime + i * (dur + gap), o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
        g.gain.setValueAtTime(vol, t0 + dur - 0.03); g.gain.linearRampToValueAtTime(0, t0 + dur);
        o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.02);
      }
    },
    // Speak now; an older callout still waiting is dropped so the newest is always current
    say(text, urgent = false) {
      if (!this.on || !window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = urgent ? 1.25 : 1.1; u.pitch = urgent ? 1.15 : 1; u.lang = "en-US";
      if (urgent || speechSynthesis.pending) speechSynthesis.cancel();
      speechSynthesis.speak(u);
    },
    reset(alt) { this.marks = MARKS.filter(m => m < alt); this.lastBrake = this.lastSink = -Infinity; },
    update({ alt, vUp, g, amax, contact = false, from = Infinity }) {
      if (!this.on || contact) return;
      // Re-arm marks after climbing well back above them
      for (const m of MARKS) if (m < from && alt > m * 1.3 + 3 && !this.marks.includes(m)) this.marks.push(m);
      const due = this.marks.filter(m => alt <= m && m < from);
      if (due.length) {
        const m = Math.min(...due);
        this.marks = this.marks.filter(x => !due.includes(x));
        this.say(m >= 1000 ? `${m / 1000} kilo${m === 1000 ? "metre" : "metres"}` : String(m));
      }
      // Warnings, each at most every 3 s. "Brake now": a full-throttle stop only just
      // fits. "Sink rate": falling faster than the legs take near the ground, and the
      // stop needs a fair share of the height left (a normal braked descent stays quiet).
      const now = performance.now();
      if (vUp < -1.5 && alt > 1) {
        const stop = amax > g ? vUp * vUp / (2 * (amax - g)) : Infinity;
        if (stop > alt * 0.9) {
          if (now - this.lastBrake > 3000) { this.lastBrake = this.lastSink = now; this.tone(880, 0.09, "square", 0.12, 3); this.say("Brake now!", true); }
        } else if (alt < 30 && -vUp > LEG_BREAK * 0.9 && stop > alt * 0.6 && now - this.lastSink > 3000) {
          this.lastSink = now; this.tone(660, 0.12, "square", 0.12, 2); this.say("Sink rate!", true);
        }
      }
    },
    event(name) {
      if (!this.on) return;
      if (name === "contact") { this.tone(1200, 0.06, "sine", 0.15); this.say("Contact"); }
      else if (name === "landed") { this.tone(660, 0.12); setTimeout(() => this.tone(990, 0.2), 140); this.say("Touchdown. Engine stop."); }
      else if (name === "crash") { if (window.speechSynthesis) speechSynthesis.cancel(); this.tone(110, 0.6, "sawtooth", 0.2); }
      else if (name === "tipped") { this.tone(220, 0.35, "triangle", 0.18); this.say("Tipped over"); }
      else if (name === "ready") { this.tone(784, 0.12); setTimeout(() => this.tone(1046, 0.18), 140); this.say("Ready to land. Checkpoint saved."); }
      else if (name === "autoOn") { this.tone(600, 0.08); setTimeout(() => this.tone(900, 0.1), 100); this.say("Auto-land on"); }
      else if (name === "autoOff") { this.tone(900, 0.08); setTimeout(() => this.tone(600, 0.1), 100); this.say("Auto-land off"); }
    },
    toggle() {
      this.on = !this.on;
      try { localStorage.setItem(SOUND_KEY, this.on ? "1" : "0"); } catch (e) {}
      if (!this.on && window.speechSynthesis) speechSynthesis.cancel();
      if (this.on) { this.tone(880, 0.1); this.say("Sound on"); }
    },
    drawHint(ctx, x, y) {
      if (!this.blocked()) return;
      ctx.save(); ctx.textAlign = "center"; ctx.font = "700 13px system-ui, sans-serif";
      ctx.fillStyle = "rgba(10,12,18,0.8)"; ctx.beginPath(); ctx.roundRect(x - 190, y - 17, 380, 26, 8); ctx.fill();
      ctx.fillStyle = "#ffb547"; ctx.fillText("🔇 Click or press a key once to allow voice callouts", x, y);
      ctx.restore();
    },
  };
  try { voice.on = localStorage.getItem(SOUND_KEY) !== "0"; } catch (e) {}
  // Browsers only allow sound after a click or key press (controller buttons don't count)
  for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, () => voice.ctx(), { capture: true });

  window.Lander = { contact, autoLand, radarFrom, drawRadar, fmtAlt, voice, LEG_BREAK };
})();
