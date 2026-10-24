# Controller Game Hub

Browser games played with a game controller (built and tested with an Xbox 360–style controller), plus a tester page that shows every input live.

```
index.html               hub: controller status + game list
games.js                 game registry shown on the hub
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

## Hub controls

- **D-pad / left stick:** choose a card
- **A:** open it
- In a game, **B** on the title, pause or game-over screen returns to the hub

## Adding a game

1. Create `games/<id>/index.html`. Each game is a self-contained page that reads the controller with the Gamepad API (`navigator.getGamepads()`).
2. Add an entry to `games.js`:
   ```js
   { id: "my-game", title: "My Game", path: "games/my-game/", color: "#ff5c8a",
     description: "One line about it.", tags: ["Analog triggers"] }
   ```
3. Follow the hub conventions:
   - Start the game with **A**.
   - Pause with **Start**.
   - Return to the hub (`../../`) with **B** when not in active play.
   - Add a small `← Hub` link for mouse users.
   - Ignore buttons that are already held when the page loads, so the A press that opened the game doesn't also start it.
   - Vibration: don't call `playEffect` every frame. Send an explicit `vibrationActuator.reset()` when each effect ends, and also on pause and `pagehide`. Xbox 360-style wireless receivers can miss the end of an effect and keep vibrating. See `rumble()` in Trigger Storm.

## Games

| Game | Highlights |
|---|---|
| [Trigger Storm](games/trigger-storm/) | Twin-stick shooter: RT pressure sets fire rate, LT pressure sets shield size, every button has a job. |
