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
  {
    id: "gravity-lander",
    title: "Antariksh",
    path: "games/gravity-lander/",
    icon: "🚀",
    color: "#ffb547",
    description: "Real rocket physics. Land on the Moon, Mars, Titan and Earth, or fly a full orbit mission from Terra to Luna with time warp and checkpoints. Tunable PID attitude assist.",
    tags: ["Real physics", "Orbit mission", "PID assist"],
  },
  {
    id: "turbo-laps",
    title: "Turbo Laps",
    path: "games/turbo-laps/",
    icon: "🏎️",
    color: "#ff4d4d",
    description: "Top-down racing against three AI cars. Analog gas and brake, drift with A, nitro with X.",
    tags: ["Racing", "Analog triggers", "3 laps"],
  },
];
