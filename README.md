# Controller Game Hub

Browser games played with a game controller (built and tested with an Xbox 360–style controller), plus a tester page that shows every input live. Everything can be driven by the controller alone. No mouse needed.

```
index.html               hub: controller status + game list
games.js                 game registry shown on the hub
shared/pad.js            shared controller input, Start/Back menu, safe vibration
tester/                  controller tester (all buttons, sticks, triggers)
games/<id>/index.html    one folder per game
```

## Run it

Browsers only expose controllers to pages served over http(s), so start a local server in this folder:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Then open http://localhost:8765 and press any button on the controller.

On Windows, just double-click **`start.bat`**. It works on a fresh machine:

1. If the hub is already running, it just opens it.
2. Otherwise it finds Python and starts its built-in web server in a minimized window. No Python packages are needed.
3. If Python is missing, it installs it once with winget.
4. If that isn't possible, it falls back to `scripts/serve.ps1`, a small server that needs only the PowerShell built into Windows.

It waits until the server answers, then opens the hub in your browser. If port 8765 is taken by another program, it says so instead of opening the wrong page.

**`stop.bat`** stops the hub server, whichever kind is running, and leaves other programs alone. To use another port, `set HUB_PORT=8766` before running either script.

If the controller isn't detected, open the tester. If it shows nothing either, check that Windows sees the controller. Its USB receiver may need to go straight into a laptop port, not a hub.

## Controls everywhere

- **Hub:** D-pad / left stick chooses a card, **A** opens it.
- **In a game:** **Start** or **Back** opens the menu (Resume, Restart, Back to hub). Move through it with the D-pad, stick or keyboard arrow keys; **A** (or Enter) selects, **B** (or Esc) closes it.
- **On a game's title or game-over screen:** **B** goes back to the hub.
- **Tester:** **hold** Start or Back for about a second to open its menu. A short press only lights up the button, so Start and Back can still be tested.

## Adding a game

1. Create `games/<id>/index.html` and include the shared helper:
   ```html
   <script src="../../shared/pad.js"></script>
   ```
2. Set up the menu and read input once per frame:
   ```js
   Pad.setup({
     title: "My Game", hubUrl: "../../",
     items: [{ label: "Resume", action: () => {} }, { label: "Restart", action: restart }],
     onMenu: open => { paused = open; },
   });
   function frame() {
     const p = Pad.poll();   // p.lx/ly/rx/ry (deadzoned), p.lt/rt, p.down[i], p.pressed[i]
     ...
   }
   ```
   `Pad.BTN` has the button numbers (A, B, X, Y, LB, RB, LT, RT, BACK, START, L3, R3, UP, DOWN, LEFT, RIGHT).
3. Add an entry to `games.js`:
   ```js
   { id: "my-game", title: "My Game", path: "games/my-game/", icon: "🎯", color: "#ff5c8a",
     description: "One line about it.", tags: ["Easy"] }
   ```
4. Follow the hub conventions:
   - **A** starts the game.
   - **B** on the title or game-over screen returns to the hub.
   - Add a small `← Hub` link for mouse users.
   - Use `Pad.rumble(strong, weak, ms)` for vibration, never `playEffect` directly. Xbox 360-style wireless receivers can miss the end of an effect and keep vibrating. `Pad.rumble` throttles effects and always sends an explicit stop.

   `shared/pad.js` already ignores buttons held when the page loads, so the A press that opened the game won't also start it. While the menu is open, `p.pressed` is all false, so the game ignores input.

## Games

| Game | Highlights |
|---|---|
| [Trigger Storm](games/trigger-storm/) | Twin-stick shooter: RT pressure sets fire rate, LT pressure sets shield size, every button has a job. |
| [Fruit Catch](games/fruit-catch/) | Easy and relaxed: move a basket to catch fruit, stars and hearts, and dodge bombs. Left stick or D-pad, RT for a speed boost. |
| [Gravity Lander](games/gravity-lander/) | Real physics: land on the Moon, Mars, Titan and Earth using each world's real gravity and air density. Thrust follows the craft's tilt, fuel mass burns off by the rocket equation, and spin has inertia. RT throttle, stick sets the tilt, X toggles the PID attitude assist. |
| [Orbit Mission](games/gravity-lander/mission.html) | Part of Gravity Lander (Y on its title screen). Six assignments from launch pad to a Luna landing: lift off, reach orbit, transfer, get captured, stable lunar orbit, land. Each one saves a checkpoint. See below. |

### Orbit Mission physics

- **Gravity:** Newton's gravity from Terra and Luna at the same time, with Luna on a fixed circular orbit. Planets are scaled down, like Kerbal Space Program: Terra is 600 km in radius with 9.81 m/s² surface gravity, Luna is 200 km with 1.63 m/s², 12,000 km away.
- **Rocket:** two stages (Y separates them). Mass falls as fuel burns, following the rocket equation. Δv left is shown live.
- **Atmosphere:** drag in Terra's air, which thins out exponentially up to 70 km.
- **Time warp:** rotation always runs in fixed 1/120 s steps, so the attitude stays stable at any warp. RB faster, LB slower, from 1× to 10,000×. It only makes game time pass faster; the integrator takes smaller steps, so orbits stay exact. Warp is limited to 4× while the engine burns or in the air and 10× near the ground (a message says why), and drops when you enter a new sphere of influence.
- **Views:** A cycles Rocket → Orbit map (around the body you're near) → Terra–Luna system. The right stick zooms, R3 resets the zoom.
- **Steering:** with the assist on, point the left stick where the nose should face on screen (stick up = nose up). Let go and the assist keeps that heading. An **Assists** panel at the bottom left lists every assist at once (attitude hold, direction lock, unlimited fuel, time warp) with its state and button, plus what the attitude assist is doing right now.
- **Velocity vector:** a green arrow from the rocket shows where it's moving (relative to the body you're near) and how fast, in m/s. The length grows with the log of the speed, so slow and fast both fit. In the Rocket view, dashed arrows split it into climb/fall and sideways. Landing practice has the same arrow; parts over the safe touchdown limit turn red.
- **Unlimited fuel:** a practice switch: **B** while flying, or the Start menu. Shared with landing mode. Tanks never drain; mass and thrust are unchanged, and there's no fuel bonus in the score.
- **Steering aids:** a predicted path (including the Luna encounter), apoapsis and periapsis markers, the Luna phase angle, and D-pad holds for prograde, retrograde and radial.

### Attitude assist (PID)

`games/gravity-lander/assist.js` holds the craft at the angle the pilot asks for, using only the real rotation thrusters' strength. Tune Kp, Ki and Kd live from the Start menu ("Tune attitude assist"). A chart shows target vs actual angle, and a hint gives the critical-damping Kd (2·√Kp). The values are saved in the browser.
| [Turbo Laps](games/turbo-laps/) | Top-down racing, 3 laps against 3 AI cars. RT gas, LT brake/reverse, stick steer, A handbrake drift, X nitro, Y camera. The default chase camera turns with the car (nose always up, with a little lag), so stick left always looks like turning left; Y switches to a fixed map. Best lap is saved. |
