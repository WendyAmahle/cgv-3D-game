# Game Design Document — Bistro Rush: Culinary Mayhem

## 1. Game overview

Bistro Rush: Culinary Mayhem is a browser-based 3D cooking and time-management game made for the COMS3006A / COMS3025A Computer Graphics and Visualisation project. The player operates a sequence of small restaurants, turning raw ingredients into customer orders before patience runs out.

The game combines the clear, short feedback loop of a cooking game with a fully rendered three-dimensional restaurant space. Players collect ingredients, cook them to the correct state, assemble complete dishes, serve customers, and manage several orders simultaneously. The intended experience is accessible at first, then increasingly demanding as new equipment and recipes are introduced.

## 2. Design goals

- Make the main loop immediately understandable: collect, cook, assemble, and serve.
- Reward quick and accurate work without making a single mistake instantly fatal.
- Add one meaningful mechanic per level so the difficulty grows through learning rather than repetition.
- Use the 3D presentation to make food, cooking state, atmosphere, and customer urgency readable.
- Provide both mouse-driven and keyboard-driven play, with several camera views and a minimap for accessibility.

## 3. Narrative and setting

MegaMunch Corp has forced the independent kitchens of Port Saffron out of business, including the player character's family restaurant, The Golden Ladle. The player inherits Gran Nandi's recipe book and apron and works through three struggling venues to earn enough money to buy the restaurant back.

A skippable prologue establishes the story before the main menu. Each level has a chapter card before the shift and an outro after completion. Finishing the final level leads to the epilogue.

## 4. Core gameplay loop

Each shift follows the same core cycle:

1. Read a customer's order and monitor its patience.
2. Take ingredients from crates or dispensers.
3. Cook or prepare ingredients at the appropriate station.
4. Assemble the food on the serving board.
5. Deliver food and drinks to the customer before they leave.
6. Earn money, tips, combos, stars, and trophies; use the next shift to improve performance.

The player wins by reaching the level's earnings target before the shift ends while staying below the maximum number of walkouts. Customers who wait too long leave, reducing the player's margin for error.

## 5. Player interaction and controls

The primary interaction is mouse drag-and-drop. Ingredients can be moved from crates to cooking stations, from cooking stations to the assembly board, and finally to a customer or the bin. A selection ring gives immediate feedback: it becomes green when the current item can be placed and red when it cannot.

The game can also be played with a keyboard. A/D or the arrow keys move the selection; W/S changes rows; Space or Enter uses the selected station or serves a customer. X throws the currently held item into the bin. Items released over empty space are wasted: they fall, spin, and bounce off the counters or floor.

Five cameras help the player inspect the kitchen:

- Overview: the default orbiting kitchen view.
- Third person: follows the chef from behind.
- Station focus: frames the selected station or customer.
- Top-down: a planning view of the kitchen.
- First person: places the camera at the chef's eye height.

The player can select camera modes with keys 1–5, cycle them with C, orbit the overview with Q/E and the mouse wheel, and toggle the minimap with N. Escape or P pauses the game, while M toggles sound.

## 6. Orders, serving, scoring, and risk

Customers can receive drinks and food separately. Drinks may be delivered individually, while food—including fries—is assembled together on one plate. When all required parts have been delivered, the customer pays the recipe price plus a speed-based tip.

Serving quickly builds a combo and increases earnings. If a customer walks out after receiving some parts of an order, they pay only for those parts and give no tip. Invalid mouse deliveries are rejected; keyboard-serving an incorrect item is allowed but deducts patience.

Urgency is communicated directly through the order display. Tickets shake below 30% patience, give audio warnings at 30% and 15%, and show a red final-ten-seconds countdown. In Level 3, holographic order displays shift from teal through amber to red and glitch as the customer becomes impatient.

Clearing a level awards one star for reaching the earnings target, two for exceeding it by 25%, and three for exceeding it by 50% with no more than one walkout. Trophies record achievements such as high combos, fast service, clean shifts, and chapter completion. Progress is saved in browser local storage.

## 7. Levels and progression

| Level | Location and mood | New gameplay focus |
| --- | --- | --- |
| 1: Burger Truck | A daylight park food truck | Introduces the essential loop: grilling, assembling burgers, serving customers, and preparing drinks. |
| 2: Lantern Noodle Bar | A neon Tokyo side street at night | Introduces ramen multitasking. Noodles boil while chashu sears, and a bowl of broth must be placed on the board before other food can be added. Rush hour increases pressure. |
| 3: Neon Diner | A rain-soaked cyberpunk street with bloom, traffic, and pedestrians | Introduces molecular mixology, two-sided laser-seared steaks, impatient customers, holographic order displays, and random power-surge overclock events. |

Level 1 establishes the grammar of the game. Level 2 asks the player to coordinate two timed cooking tasks and respect the bowl-first assembly rule. Level 3 combines faster service demands with recipe-specific equipment and the most visually dense environment.

## 8. Key mechanics

### Cooking

Cooking stations change ingredients over time. The player must collect food at the correct point between raw and burnt. Different stations create distinct tasks: grilling, frying, boiling, chashu searing, laser searing, drink pouring, and cocktail mixing.

### Assembly

The board is where food becomes a serveable plate. Ingredient placement is visually stacked in a sensible order. Level 2 changes this rule by requiring a bowl of broth first; ingredients are refused until the bowl is present.

### Molecular mixology

The Level 3 Mixology Bar has cyan, magenta, and yellow syrup taps. The player queues four shots, then a magnetic stirrer blends the glass. The ratio determines the cocktail:

- Deep Space: 2 cyan, 2 magenta
- Solar Flare: 1 magenta, 3 yellow
- Toxic Lime: 2 cyan, 2 yellow
- Ultraviolet: 1 cyan, 3 magenta

### Plasma steaks

The Level 3 Laser Searer cooks one side of a steak at a time. The player must click to flip it and sear the other side, while avoiding charring either side.

### Visible item physics

Discarding an item sends it into the bin on a ballistic arc. Dropping an item over empty space makes it fall under gravity, spin, bounce against the kitchen, and then be cleared away. This makes mistakes legible in the 3D space rather than silently deleting items.

## 9. Visual and audio direction

The visual progression moves from a warm park to a lantern-lit noodle street and then a wet, high-contrast cyberpunk diner. Each space has a distinct environment, lighting, soundtrack, ambience, and materials.

Food and equipment provide clear state feedback. Cookable food browns, develops grill marks, changes roughness, and can burn. Drinks and bowls show fill levels, Level 2 noodles create active boiling water and steam, and Level 3 cocktails display coloured layers before swirling together. Level 3 additionally uses rain, traffic headlights, neon glow, and holograms to create a busy night-time atmosphere.

Audio reinforces state and action: cookware, pouring, footsteps, kitchen timers, bins, customer service, coins, traffic, rain, thunder, and level-specific ambience provide feedback without requiring the player to look at every station.

## 10. Accessibility and usability

The game provides mouse and keyboard controls, an orbiting overview, alternate camera modes, a minimap, pause and mute controls, and a Graphics: Low option for weaker machines. The minimap and selection ring reduce the cost of navigating a busy 3D scene, while visual and audio urgency cues help players prioritise orders.

## 11. Success criteria

The design is successful when a new player can complete the first level after learning the basic drag-and-drop loop, while experienced players can optimise routes, cooking timing, combos, and parallel tasks to earn three stars in all three levels.
