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
| Mouse click | Start pouring a drink; click a customer to hear their order |
| A/D · W/S (or arrows) | Move the selection · switch between the back counter, front counter and customers |
| Space / Enter | Use the selected station / serve the selected customer |
| X | Throw away the held item |
| 1–4 / C | Camera: overview, chef view, station focus, top-down |
| Q / E · mouse wheel | Orbit · zoom the overview camera |
| Esc / P · M | Pause · mute |

## Levels

| Level | Theme | What it adds |
| --- | --- | --- |
| 1 Burger Truck | Daylight park | Core loop: grill → assemble → serve, plus drinks |
| 2 Lantern Noodle Bar | Night, lanterns, fireflies | Boiling pot and broth, 3 customers at once, rush hour halfway through |
| 3 Neon Diner | Cyberpunk, rain, bloom | Every station, fast android customers, random "power surge" overclock events |

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
- **steam**: a noise-driven column above active cookers.
- **particle**: soft point sprites for steam, smoke, sparks, rain, fireflies and the serve burst.
- **sky**: gradient dome with twinkling stars.
- **grade** (post-processing): screen-space heat haze above cookers, colour grade, vignette and a red flash on mistakes.

## External assets

Realistic props, textures, HDRI skies and characters live in `public/assets/` and are loaded by `src/utils/AssetLoader.js`. Each level only downloads its own group, behind a loading screen.

- **Poly Haven** (CC0): scanned burger buns, crates, cutting board, cash register, bins, picnic tables, street lamps, plants, lanterns, stools, barrels, barriers, a modular apartment facade kit (assembled into the Level 3 street in `src/world/City.js`) and aircon units; PBR textures (grass, paving, tiles, wood, cobblestone, asphalt, corrugated iron); HDRI skies for each level.
- **Characters**: Mixamo's Michelle and X Bot, and a Ready Player Me avatar (from the three.js examples). X Bot's animations are retargeted onto the other skeletons in `src/world/Characters.js`, and avatar outfits are recoloured per customer.

`node scripts/fetch-assets.mjs` re-downloads everything. If an asset fails to load, the game falls back to procedural models. Every asset is listed in the in-game credits (`src/ui/Credits.js`).

## Common changes

- **New recipe**: add it to `RECIPES` in `src/gameplay/Recipes.js` (new ingredients go in `ITEMS`), then list its id in a level's `recipes`.
- **New ingredient model**: add a builder in `BUILDERS` in `src/world/Food.js`.
- **New asset**: add it to `scripts/fetch-assets.mjs` and a group in `src/utils/AssetLoader.js`, then use `assets.model(key)` or `pbr(textureId, repeat)`.
- **New station type**: add the logic class in `src/gameplay/Stations.js` and the mesh in `src/world/Stations.js`.
- **Real audio file**: see the comment at the top of `src/audio/AudioManager.js`.
- **Any external asset, library or code sample**: add it to `CREDITS` in `src/ui/Credits.js`. The brief requires every one to be credited in-game.

## Performance

Pause → **Graphics: Low** turns off post-processing and shadows and renders at 1× pixel ratio, for weaker lab machines. Levels dispose their GPU resources when unloaded, so restarting repeatedly doesn't leak memory.
