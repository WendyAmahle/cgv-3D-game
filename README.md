# Bistro Rush: Culinary Mayhem

A 3D cooking game for the browser (COMS3006A / COMS3025A CGV project), built with three.js and Vite.
Grab ingredients, cook them before they burn, assemble dishes on the board, and serve customers before they walk out, across three levels.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/ (upload to the LAMP server)
```

In dev builds the game object is available in the browser console as `window.game`.

## Controls

| Input | Action |
| --- | --- |
| Mouse drag | Drag and drop items: crate → grill → board → customer, drinks → board, anything → bin |
| Mouse click | Start pouring a drink, pour a Mixology Bar shot or flip a steak on the Laser Searer; click a customer to hear their order |
| A/D · W/S (or arrows) | Move the selection · switch between the back counter, front counter and customers |
| Space / Enter | Use the selected station / serve the selected customer |
| X | Throw away the held item |
| 1–4 / C | Camera: overview, third person (follows the chef), station focus, top-down |
| N | Show / hide the minimap |
| Q / E · mouse wheel | Orbit · zoom the overview camera |
| Esc / P · M | Pause · mute |

## Story

MegaMunch Corp has pushed the little kitchens of Port Saffron out of business, including The Golden Ladle, your Gran Nandi's restaurant.
With her recipe book and apron, you save three failing kitchens one shift at a time to earn enough to buy The Golden Ladle back.

A skippable prologue is the first screen after loading, before the main menu (rewatch it with **Story** on the menu).
Each level opens with its chapter on the intro card and closes with an outro on the level-complete screen, and the epilogue follows the last level.
The prologue and epilogue are in `src/levels/Story.js`, and each chapter is the `story` field in its level file.

## Stars, trophies and rewards

Inspired by Cooking Fever, all in `src/ui/` and driven by the event bus, so no gameplay code changes:

- **Stars** (`Stars.js`): a cleared shift earns ★ for hitting the target, ★★ for beating it by 25% and ★★★ for beating it by 50% with at most one walkout (tune `STAR_RULES`). Best ratings show on the level cards and intro card.
- **Trophies** (`Achievements.js`): 14 trophies (combos, fast service, clean shifts, one per chapter…) with a pop-up when earned, plus lifetime career stats, on the **Trophies** screen in the main menu.
- **Serve rewards** (`HUD.js`): "+$12" floats up from the customer and a coin flies into the earnings panel with a cash-register sound.

Stars and trophies are saved in the browser's localStorage.

## Serving

Like Cooking Fever, an order is served in parts: each **drink** on its own, and all the **food** (fries included) together as one plate built on the board, in any order. Serving everything on one plate still works. Delivered items are ticked off the order card, and the customer pays (price + speed tip) once everything has arrived. A customer who walks out pays their share of the price for what they already got, without a tip. The serve ring only turns green when the customer will take what you're holding.

The rules are `orderParts()` / `matchParts()` in `src/gameplay/Recipes.js`. Set `SERVE_DRINKS_SEPARATELY = false` in `src/utils/Constants.js` to go back to serving whole orders at once.

A dish the customer won't take is refused when you drag it to them. Serving one with the keyboard (Space on the customer) still hands it over, and a wrong dish costs patience: 4 s by default, or the level's `wrongOrderPenalty`. A level can also set `patienceGrace`, the seconds a new customer's bar stays full after they reach the counter (`src/gameplay/Customers.js`). As patience runs low, the ticket shakes below 30%, two soft ticks play at 30% and again at 15% (the `order:urgent` event), and the last 10 seconds count down in red on the ticket.

## Levels

| Level | Theme | What it adds |
| --- | --- | --- |
| 1 Burger Truck | Daylight park | Core loop: grill → assemble → serve, plus drinks |
| 2 Lantern Noodle Bar | Night on a Tokyo side street: neon signs, paper lanterns, vending machines, wet asphalt | **Multitasking ramen**: noodles boil in the pot while chashu sears on the Chashu Searing Grill, and the board is **bowl first** (`bowlFirst`: food is refused until a bowl of broth from the urn is on it, by mouse or keyboard). The pot shows its state through the **boil** and **plume** shaders: the water churns, clouds with starch and froths when the noodles overcook, and the steam builds from a simmer to billowing. 3 customers at once and rush hour halfway through, with patience tuned for one shared pot and grill (78–96 s, a 4 s grace period, a 2 s wrong-dish penalty) |
| 3 Neon Diner | Cyberpunk city street at night, rain, bloom | **Molecular mixology**: a Mixology Bar with cyan, magenta and yellow syrup taps. Click taps to pour 4 shots (clicks queue up, the glass slides to each tap), then the magnetic stirrer blends them; the shot ratio decides the cocktail (Deep Space = 2 cyan + 2 magenta, Solar Flare = 1 magenta + 3 yellow, Toxic Lime = 2 cyan + 2 yellow, Ultraviolet = 1 cyan + 3 magenta), and the Neon Combo needs one too. **Laser-seared plasma steaks**: the Laser Searer (replacing the boiling pot) sears one side by itself, you click to flip the steak and it sears the other; leave a side on too long and it chars (Plasma Steak, and the Plasma Platter with fries and an Ultraviolet). Orders float over customers as **holograms** that turn red and glitch as patience runs out. Plus fast, impatient customers, random "power surge" overclock events. The diner faces a road with live traffic (cars keep left), people walk past the shops across the road, and lit towers make up the skyline (`src/world/City.js`, `src/world/Traffic.js`) |

Each level is a plain config file in `src/levels/`: stations, recipes, timings, theme, lighting, post-processing and music.

## Code map and who owns what

Everything talks through the event bus in `src/core/Events.js` (see the list of events at the top of that file), so, for example, audio and effects react to gameplay without editing gameplay code.

| Area | Files | Owner |
| --- | --- | --- |
| Game loop, state machine, level flow | `src/core/Game.js`, `GameState.js`, `LevelManager.js`, `Events.js` | Shared (coordinate changes) |
| Gameplay: items, recipes, stations, customers, scoring | `src/gameplay/*`, `src/player/Player.js`, `src/player/PlayerController.js` | Member 1 |
| World, models, lighting, cameras | `src/world/*` (Environment, Stations, Food, Characters, Lighting), `src/player/CameraController.js`, `src/graphics/Materials.js`, `src/utils/AssetLoader.js` | Member 2 |
| Shaders and effects | `src/graphics/shaders/*.glsl`, `src/graphics/Shaders.js`, `Effects.js`, `PostProcessing.js` | Member 3 |
| UI, levels, audio, credits | `src/ui/*`, `src/levels/*`, `src/audio/AudioManager.js`, `index.html`, `src/style.css` | Member 4 |

### Custom shaders (`src/graphics/shaders/`)

- **cooking**: injected into three.js's physically based material (`cooking_pars`, `cooking.vert`, `cooking.frag`), so food keeps real lighting, shadows and reflections. `uCook` (0 raw → 1 cooked → 2 burnt) drives uneven browning, grill marks, roughness (wet raw meat, dry burnt meat) and embers. The vertex stage shrinks/puffs the food and sizzles it while `uHeat` is on.
- **liquid**: `uFill` sets a sloshing liquid level inside cups and bowls, with foam and bubbles.
- **mix** (`mix.frag.glsl`, reusing the liquid vertex stage): Level 3's molecular cocktails. Each poured shot is a layer of its syrup colour with rippling interfaces; as `uMix` goes 0 → 1 spiral streaks swirl the layers into one colour, blended subtractively (geometric mean, so cyan + magenta makes blue, not grey). `uSpin` makes the liquid climb the glass and fizz while the stirrer runs.
- **hologram** (Level 3 order displays): a panel billboarded in the vertex stage (built in view space, so it always faces the camera) over each customer. The fragment stage adds scanlines, a rolling light band and a glowing frame, and `uUrgency` (the customer's impatience) turns it teal → amber → red with band glitches, a red/blue channel split and dropouts; `uFade` dissolves it in blocks when the order is served.
- **steam**: a noise-driven column above active cookers.
- **beam**: volumetric headlight cones on Level 3's cars (additive, fading with distance and at the edges, with rain streaking through the light).
- **boil** (`boil.vert`, `boil.frag`): the water in Level 2's noodle pot. The vertex stage displaces a 40×40 grid with moving noise and an outward ripple (`uBoil`, how hard it boils) and rebuilds the normal from neighbouring heights so highlights move with the waves. The fragment stage clips the grid to a circle, clouds the water with swirling starch (`uStarch`: 0 clear → 1 cooked → 2 froth when the noodles overcook) and pops bubbles cell by cell. Leftover starch stays cloudy but never frothy once the noodles are taken out.
- **plume** (`plume.vert`, `plume.frag`): steam above Level 2's pot. A tall plane turns to face the camera around the vertical axis (a cylindrical billboard, so it reads as a column from every side and disappears edge-on from the top-down camera), widening and swaying as it rises. The fragment stage domain-warps fractal noise (the lookup position is itself pushed by noise) so wisps curl and tear apart instead of scrolling; `uIntensity` sets density and rise speed.
- Both read the pot's real cooking state each frame: `Effects.update()` calls the pot view's `update(dt, station)`, which eases the uniforms towards targets computed from the noodles' cook amount. The shared noise functions are in `noise.glsl`, prepended to both. The plume takes the place of the generic **steam** column on that pot, casts no shadow and can't be clicked.
- **particle**: soft point sprites for steam, smoke, sparks, rain, fireflies and the serve burst.
- **sky**: gradient dome with twinkling stars.
- **grade** (post-processing): screen-space heat haze above cookers, colour grade, vignette and a red flash on mistakes.

## External assets

Realistic props, textures, HDRI skies and characters live in `public/assets/` and are loaded by `src/utils/AssetLoader.js`. Each level only downloads its own group, behind a loading screen.

- **Poly Haven** (CC0): scanned burger buns, crates, cutting board, cash register, bins, picnic tables, street lamps, plants, lanterns, stools, barrels, barriers, a modular apartment facade kit (assembled into the Level 3 street in `src/world/City.js`) and aircon units; PBR textures (grass, paving, tiles, wood, cobblestone, asphalt, corrugated iron); HDRI skies for each level.
- **Characters**: Mixamo's Michelle and X Bot, and a Ready Player Me avatar (from the three.js examples). X Bot's animations are retargeted onto the other skeletons in `src/world/Characters.js`, and avatar outfits are recoloured per customer.
- **Sound** (CC0, `public/assets/audio/`): recordings from BigSoundBank, OpenGameArt (rain) and Kenney, played by `src/audio/AudioManager.js`:
  - Cooking loops follow what is busy (grill sizzle, fryer oil, boiling pot, pouring).
  - Game events play one-shots: plates, bin, kitchen timer, buzzer, counter bell, register and coins on a serve, alarm, applause.
  - The chef's footsteps change with the floor (concrete or wood).
  - Each level has its own ambience (`ambience` in its level file): park birds, night insects over the city, rain.
  - In Level 3, lightning flashes are followed by thunder, and passing cars and horns are positioned in 3D around the camera.

`node scripts/fetch-assets.mjs` re-downloads everything. If an asset fails to load, the game falls back to procedural models. Every asset is listed in the in-game credits (`src/ui/Credits.js`).

## Common changes

- **New recipe**: add it to `RECIPES` in `src/gameplay/Recipes.js` (new ingredients go in `ITEMS`), then list its id in a level's `recipes`.
- **New ingredient model**: add a builder in `BUILDERS` in `src/world/Food.js`.
- **New asset**: add it to `scripts/fetch-assets.mjs` and a group in `src/utils/AssetLoader.js`, then use `assets.model(key)` or `pbr(textureId, repeat)`.
- **New station type**: add the logic class in `src/gameplay/Stations.js` and the mesh in `src/world/Stations.js`.
- **New sound**: put the `.ogg` in `public/assets/audio/`, add it to `SAMPLES` (one-shot) or `LOOPS` (looping bed) in `src/audio/AudioManager.js`, and map a game event to it in `EVENT_SOUNDS`.
- **Any external asset, library or code sample**: add it to `CREDITS` in `src/ui/Credits.js`. The brief requires every one to be credited in-game.

## Performance

Pause → **Graphics: Low** turns off post-processing and shadows and renders at 1× pixel ratio, for weaker lab machines. Levels dispose their GPU resources when unloaded, so restarting repeatedly doesn't leak memory.
