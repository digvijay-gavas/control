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

If the controller isn't detected, open the tester. If it shows nothing either, check that Windows sees the controller. Its USB receiver may need to go straight into a laptop port, not a hub.

## Controls everywhere

- **Hub:** D-pad / left stick chooses a card, **A** opens it.
- **In a game:** **Start** or **Back** opens the menu (Resume, Restart, Back to hub). Move through it with the D-pad or stick, **A** selects, **B** closes it.
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
| [Fruit Catch](games/fruit-catch/) | Easy and relaxed: move a basket to catch fruit, stars and hearts, and dodge bombs. Only the left stick or D-pad. |
