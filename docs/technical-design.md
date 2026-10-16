# Technical Design Document — Bistro Rush: Culinary Mayhem

## 1. Technology and delivery

Bistro Rush is a client-side browser game built with JavaScript, three.js, and Vite. It uses ES modules and is packaged as a static production build suitable for deployment to a web server.

Development commands:

    npm install
    npm run dev
    npm run build

The development build exposes the game instance as window.game for browser-console inspection. The production build is written to dist/.

## 2. System architecture

The project is organised as a small collection of focused modules:

| Area | Main files | Responsibility |
| --- | --- | --- |
| Application and flow | src/core/Game.js, GameState.js, LevelManager.js | Renderer setup, frame loop, state transitions, loading, level flow, quality settings. |
| Events | src/core/Events.js | Event bus that decouples gameplay, UI, audio, and visual reactions. |
| Gameplay | src/gameplay/ | Items, recipes, stations, customer management, scoring, cooking, and physics hand-off. |
| Input and player | src/player/ | Held-item state, drag behaviour, keyboard navigation, chef movement, and camera modes. |
| World rendering | src/world/ | Environments, cities, traffic, station meshes, food meshes, characters, lighting, and skies. |
| Graphics | src/graphics/ | Materials, custom shader setup, effects, and post-processing. |
| UI and presentation | src/ui/, index.html, src/style.css | HUD, menus, story, minimap, stars, achievements, pause menu, credits. |
| Content | src/levels/ | Declarative definitions for level mechanics, stations, recipes, timing, lighting, music, and story. |
| Assets and utilities | public/assets/, src/utils/ | Asset loading, constants, disposal, and fetched external assets. |

The event bus is the main integration boundary. Gameplay emits events such as item placement, cooking completion, bounces, orders served, urgent orders, and level completion. Audio, HUD, effects, achievements, and the camera respond without gameplay modules needing to know their implementation.

## 3. Game lifecycle and state

Game.js owns the Three.js renderer, scene, perspective camera, timer, animation loop, post-processing pipeline, physics system, and UI managers.

The high-level flow is:

    loading → start screen → prologue → main menu → level introduction
            → active shift → pause / completion / game over → menu or next level

LevelManager constructs a world from the selected level configuration. Before a shift starts, the game loads theme assets, builds the level, warms required shaders, configures effects and post-processing, resets the chef, creates Gameplay, and displays the intro card.

The frame loop updates world animation, effects, physics, chef movement, gameplay, input state, player-held-item animation, camera, audio listener, post-processing, HUD, and minimap. Time steps are capped for stability after browser stalls.

## 4. Content-driven levels

Each level is a plain configuration file in src/levels/. Its data defines:

- Name, story text, theme, lighting, weather, ambience, music, and post-processing.
- Shift duration, earnings target, maximum walkouts, customer slots, spawn interval, and patience range.
- Recipes available during the shift.
- Stations and their type, row, x position, and optional item.
- Level-specific mechanics such as rush hour, bowl-first assembly, laser searing, molecular mixing, and power surges.

This approach separates reusable systems from individual shift tuning. Adding a level generally means providing configuration, recipes, station layouts, and a theme rather than editing the central game loop.

## 5. Gameplay systems

### Items, recipes, and stations

Items are data objects with a mesh and gameplay state such as type, cooking time, stage, fill, heating state, contents, and cocktail mix state. Plates own a list of contained items. Recipes define matching rules and prices, including the split between drinks and plated food.

Station classes implement actions such as giving ingredients, receiving items, cooking, pouring, assembling, mixing, laser searing, and binning. Their 3D views live separately in src/world/Stations.js. This keeps the game logic independent of rendering details.

### Input and item movement

PlayerController raycasts against interactive targets. Mouse movement starts a drag after a small threshold, updates the held item's projected world position, computes release velocity, and either drops it on a valid target or hands it to the physics system. Keyboard interaction uses the same gameplay handlers, so mouse and keyboard rules remain consistent.

Player manages the currently held item. It attaches the mesh to the camera hand in first-person and overview views, to the chef's carry anchor in third-person view, or to a drag root during a mouse drag.

### Chef and camera

Chef moves along the kitchen aisle toward the selected station or dragged item, turns toward the target, plays idle/walk/reaction animations, and emits footstep events. CameraController provides overview, third-person, station-focus, top-down, and first-person modes. In first-person mode the camera uses the chef's position and facing at eye height, and the chef body is hidden to prevent clipping.

### Item physics

Physics.js implements lightweight rigid-body simulation for loose items. A body has a sphere-like bounding radius, linear velocity, angular velocity, age, resting state, and optional bin target. Fixed 120 Hz semi-implicit Euler integration applies gravity, spin, restitution, and friction.

Dropped items collide with the floor, kitchen counters, and back wall using axis-aligned bounding boxes. They bounce, emit bounce events when impact is strong enough, settle, fade out, and dispose their resources. Items thrown into the bin follow a calculated ballistic velocity and are removed after crossing the bin opening.

### Customers, scoring, and persistence

CustomerManager controls spawning, patience, accepted order parts, walkouts, and order displays. A completed order produces base price, speed tip, and combo rewards. Stars, trophies, and career statistics are handled in src/ui/ and persisted with browser localStorage.

## 6. Rendering and scene composition

Three.js renders all 3D content. The project uses physically based materials for props and food, HDRI environments, texture maps, shadows, tone mapping, and a post-processing pipeline. The renderer is configured with ACES filmic tone mapping and a capped device pixel ratio.

World modules build scene graphs for kitchens and outdoor environments. Procedural meshes complement externally sourced PBR assets so the game remains functional if an asset cannot be loaded. Character models use retargeted Mixamo animations, while city traffic and pedestrians animate independently of the kitchen gameplay.

Level 3 is the most complex scene: it includes the diner, rain, wet-street lighting, city facades, skyline towers, animated cars, pedestrian characters, and holographic customer displays. Street geometry is merged by material where possible; facade heights and pedestrian count were reduced to control its cost.

## 7. Shader and effects pipeline

Custom GLSL shaders are registered through src/graphics/Shaders.js and shader source files in src/graphics/shaders/.

| Shader | Purpose |
| --- | --- |
| cooking | Extends physically based food materials with cooking progression, browning, grill marks, roughness changes, embers, and heat-driven vertex motion. |
| liquid | Shows sloshing fill levels, foam, and bubbles in cups and bowls. |
| mix | Creates layered cyan, magenta, and yellow cocktail syrup, then swirls it into a mixed colour during stirring. |
| boil | Animates Level 2 pot water using moving noise, ripples, starch clouding, bubbles, and overcooking froth. |
| plume | Produces camera-facing, noise-warped steam above the Level 2 noodle pot. |
| steam | Renders generic steam over active cookers. |
| hologram | Renders Level 3 customer-order billboards with scanlines, glow, glitches, urgency colouring, and a dissolve on completion. |
| beam | Adds volumetric, rain-streaked headlights to Level 3 traffic. |
| particle | Renders soft particle sprites for steam, smoke, sparks, rain, fireflies, and serving bursts. |
| sky | Renders gradient skies and twinkling stars. |
| grade | Handles post-process heat haze, colour grading, vignette, and error flashes. |

Effects.update() receives live station state and drives visual uniforms. For example, the Level 2 pot's cooking value affects boiling, starch, and plume intensity, while cocktail shot state controls mixing uniforms.

## 8. UI, audio, and feedback

The HTML and CSS layer hosts the HUD, order tickets, menus, level selection, story screens, pause screen, controls guide, minimap, achievements, and credits. HUD displays time, target earnings, score, combo, walkout allowance, held item, camera mode, alerts, and customer rewards.

AudioManager maps game events to one-shot samples and manages looping kitchen audio. It also updates a listener from the active camera, supports level ambience and music, and varies chef footstep audio by floor type. Level 3 adds positioned traffic, horns, lightning, and thunder.

## 9. Asset loading and fallback behaviour

Assets are grouped by theme and loaded by AssetLoader behind a loading overlay. Each level downloads only the asset group it needs. Static assets include PBR props and textures, HDRI skies, character models, music, ambience, and sound effects.

The fetch script can restore external assets:

    node scripts/fetch-assets.mjs

If a model or texture is unavailable, the world uses procedural fallback models so the game remains playable. Asset sources and external code are credited in the in-game credits screen.

## 10. Performance strategy

The game includes several safeguards for browser and lab-machine performance:

- Shader warming compiles samples of food, customers, and order displays while a level's loading screen is visible, avoiding first-use stalls during gameplay.
- Adaptive anti-aliasing samples frame rate during a shift. When performance is below the configured threshold, it tests disabling MSAA and keeps that change only when the gain is sufficient.
- Graphics: Low disables post-processing and shadows and uses a 1× pixel ratio.
- The minimap renders into a smaller target at 15 frames per second rather than rendering the full scene every frame.
- Geometry is merged where appropriate, Level 3 facade heights are constrained, and its pedestrian count is reduced.
- Level transitions dispose GPU resources so repeated loading does not accumulate leaked objects.

The README reports testing on an Intel Iris Xe GPU: approximately 24→32 fps in Level 1, 31→45 fps in Level 2, and 15→23 fps in Level 3 after the listed optimisations. Level 3 remains the most demanding scene, at roughly 1.1 million triangles and 500 draw calls in the reported measurement.

## 11. Build verification

The production build should be checked with:

    npm run build

A successful build produces the deployable static site in dist/. Browser testing should then cover each level's load path, all camera modes, mouse and keyboard interactions, dropped-item physics, pause/resume, graphics settings, audio muting, progress persistence, and reset behaviour.
