// Game registry for the hub. To add a game:
//   1. Put it in games/<id>/index.html
//   2. Add an entry below. Order here is the order on the hub.
window.GAMES = [
  {
    id: "trigger-storm",
    title: "Trigger Storm",
    path: "games/trigger-storm/",
    icon: "⚡",
    color: "#4cc2ff",
    description: "Twin-stick arena shooter. Squeeze RT harder to fire faster, LT harder for a bigger shield.",
    tags: ["Both sticks", "Analog triggers", "Vibration"],
  },
  {
    id: "fruit-catch",
    title: "Fruit Catch",
    path: "games/fruit-catch/",
    icon: "🧺",
    color: "#ff7eb6",
    description: "Relaxed and easy: move the basket to catch falling fruit, grab stars and hearts, dodge the bombs.",
    tags: ["Easy", "Left stick or D-pad", "Relaxed"],
  },
];
