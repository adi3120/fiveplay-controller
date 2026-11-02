# FivePlay Controller

Play [fiveplay.lol](https://fiveplay.lol/), the browser port of GTA V, with a game controller, using GTA V's original controller layout.

The game page only understands a keyboard and mouse. This script reads your controller through Chrome and, for every button, sends the key or mouse input that GTA V's PC version binds to the same action, so each button does what it does on a console.

**[Open the installer page](https://adi3120.github.io/fiveplay-controller/)**

- Nothing to install: it runs from a bookmark, or as a Tampermonkey / Violentmonkey userscript
- GTA V's original layout, with on-foot, driving and flying layouts that switch when you get in or out of a vehicle
- Smooth partial steering, the weapon, character and radio wheels, phone and pause-menu controls, cutscene skipping
- Tested with a Logitech F310; controllers that Chrome recognises (Xbox, PlayStation, Switch Pro and most others) should work too

## Install

**Bookmark (no extension needed):** open the [installer page](https://adi3120.github.io/fiveplay-controller/), show the bookmarks bar (Cmd + Shift + B on a Mac, Ctrl + Shift + B on Windows and Linux) and drag the green **FivePlay Controller** button onto it.

**Userscript (starts by itself):** with [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) installed, open [fiveplay-controller.user.js](https://raw.githubusercontent.com/adi3120/fiveplay-controller/main/fiveplay-controller.user.js) and confirm the install. It runs on fiveplay.lol automatically and updates itself from this repository.

## Play

1. Connect the controller over Bluetooth or USB.
2. Open fiveplay.lol in Google Chrome and click the bookmark (not needed with the userscript).
3. Press any button on the controller. Chrome only shows a controller to a page after a button press.
4. Click inside the game once. Chrome needs one real click before the controller can look around, aim and shoot; a yellow message reminds you.

The label in the top-right corner shows the active layout, and **Back + A** shows every button in game. Reloading the page turns the bookmark off, so click it again after each reload.

On the loading screen, **A** starts Story Mode and **X** starts Sandbox Mode (then D-pad left picks the City map, right the Coast map).

## Controls

Button names are the Xbox-style ones printed on Xbox and Logitech pads. On PlayStation: A = Cross, B = Circle, X = Square, Y = Triangle, Back = Create / Share, Start = Options.

| Button | On foot | Driving | Flying |
|---|---|---|---|
| Left stick | Move | Steer; forward / back leans a bike | Pitch and roll |
| Right stick | Camera | Camera | Camera |
| RT | Shoot | Accelerate | Throttle up |
| LT | Aim | Brake / reverse | Throttle down |
| A | Sprint | Duck | Fire (submarine: dive) |
| X | Jump / climb | Next vehicle weapon | Submarine: rise |
| B | Reload / melee | Cinematic camera | Cinematic camera |
| Y | Get in a vehicle | Get out | Get out |
| LB | Weapon wheel (hold) | Aim out of the window | Turn left, switch target |
| RB | Take cover | Handbrake; shoots while LB aims | Turn right, switch target |
| L3 | Stealth | Horn | Landing gear |
| R3 | Look behind | Look behind | Look behind / attack camera |
| L3 + R3 | Special ability | Special ability | Special ability |
| D-pad up | Phone | Phone | Phone |
| D-pad down | Expand radar; hold: switch character | Expand radar; hold: switch character | Expand radar; hold: switch character |
| D-pad left | Detonate / throw | Radio | Next weapon / radio |
| D-pad right | Interact | Headlights | Vertical flight mode |
| Back | Camera view | Camera view | Camera view |
| Start | Pause menu | Pause menu | Pause menu |

- **Weapon wheel:** hold LB, point the right stick at a slot, and press D-pad left / right to pick a weapon inside the slot.
- **Phone and menus:** the D-pad moves, A selects, B goes back. In the pause menu LB / RB switch tabs and LT / RT zoom the map. A also skips cutscenes.

### Extra combos

| Combo | What it does |
|---|---|
| Back + Y | Switch the layout by hand: on foot, driving, flying. Use it for helicopters and planes, or when a cutscene or crash leaves the layout wrong |
| Back + D-pad up / down | Faster / slower camera (remembered) |
| Back + X | FPS counter |
| Back + A | Show the button list |

## Troubleshooting

- **The right stick, triggers or LB don't work:** click inside the game once. A yellow message appears when this is needed.
- **Buttons do the wrong thing for where you are** (for example, LB opens the weapon wheel inside a car): the layout is out of step. The script switches when you press Y, so cutscenes, crashes and failed entries can confuse it. Press Back + Y until the top-right label is right.
- **You can't shoot from a car:** a driver can only use one-handed guns. Press X to switch to a pistol or SMG, then hold LB to aim and press RB to shoot.
- **Logitech F310 / F510 / F710:** set the switch on the back to D and keep the Mode light off (with it on, the D-pad and left stick swap). On a Mac, X mode is usually not recognised.
- **"Unusual layout" warning or swapped buttons:** Chrome doesn't recognise the controller's button layout. Xbox, PlayStation and Switch Pro controllers work best.
- **Nothing happens at all:** press a button on the controller while the game tab is in front; Chrome only exposes a controller after that.

## Tips for smooth play

The game page reads options from its address. On high-resolution screens, [fiveplay.lol/?scale=0.5](https://fiveplay.lol/?scale=0.5) renders at half resolution, which is much faster. Add `&fps=30` for a steady 30 fps on slower machines.

## Settings

The `CFG` block at the top of [fiveplay-controller.user.js](fiveplay-controller.user.js) sets the camera speed, invert look, dead zones, pulse timing and more. After editing it, run `python3 build.py` to rebuild the bookmark in `index.html`.

## How it works

- Every animation frame, the script reads the controller with the Gamepad API.
- It sends the same events the page's own input code reads: `keydown` / `keyup` with a `code`, `mousedown` / `mouseup` on the game canvas, `mousemove` with `movementX` / `movementY` while the pointer is captured, and `wheel`.
- Each controller button maps to the PC key that GTA V binds to the same action by default. The [FiveM controls list](https://docs.fivem.net/docs/game-references/controls/) documents the keyboard and controller binding of every game control.
- Partial stick tilts for steering, pitch and roll are sent as short key pulses, so they behave like analog input.

### Limitations

- The game believes you are on a keyboard, so on-screen prompts name keys (for example "Press E") instead of controller buttons.
- No analog throttle and no vibration.
- The script can't see inside the game. It switches layouts when you press Y and guesses when the phone or pause menu is open. A and B always send select and back as well, so menus keep working either way.

## Development

| Path | What it is |
|---|---|
| `fiveplay-controller.user.js` | The script |
| `build.py` | Builds `index.html`, the installer page with the bookmark |
| `test/harness.html` | Stand-in for the game page with simulated controllers, and the checks |
| `test/run_tests.py` | Runs the checks in headless Chrome, for both the script file and the bookmark code |

```sh
python3 build.py
python3 test/run_tests.py   # set CHROME=/path/to/chrome if Chrome isn't found
```

You can also open `test/harness.html` in Chrome to see the results on the page.

## Disclaimer

An unofficial fan project, not affiliated with or endorsed by Rockstar Games, Take-Two Interactive or fiveplay.lol. This repository contains no game code or assets. Grand Theft Auto and GTA are trademarks of Take-Two Interactive.

## License

[MIT](LICENSE)
