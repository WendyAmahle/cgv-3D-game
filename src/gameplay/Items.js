import { ITEMS, cookAmount, cookStage, itemTag, tagLabel } from './Recipes.js';
import { createItemMesh, createPlateMesh, setCookVisual, setLiquidFill } from '../world/Models.js';
import { disposeObject } from '../utils/Dispose.js';

// An item is plain data plus the mesh that shows it:
//   { id, type, stage, cookTime, fill, heating, contents, mesh }
// A plate is an item of type 'plate' whose `contents` is a list of items.

let nextId = 1;

export function createItem(type) {
  const def = ITEMS[type];
  const item = {
    id: nextId++,
    type,
    stage: def.cook ? 'raw' : null,
    cookTime: 0,
    fill: def.liquid ? 1 : 0,
    heating: false,
    contents: null,
    mesh: createItemMesh(type),
  };
  refreshItem(item);
  return item;
}

export function createPlate() {
  return { id: nextId++, type: 'plate', contents: [], mesh: createPlateMesh() };
}

export const isPlate = (item) => item?.type === 'plate';

export function addToPlate(plate, item) {
  item.mesh.rotation.set(0, 0, 0);
  plate.contents.push(item);
  plate.mesh.add(item.mesh);
  layoutPlate(plate);
}

// Builds the dish in a sensible order whatever order things were added:
// bowl or bottom bun first, fillings in the order added, the top bun last,
// and drinks beside the food.
export function layoutPlate(plate) {
  const vessel = (item) => ITEMS[item.type].liquid?.vessel;
  const cups = plate.contents.filter((item) => vessel(item) === 'cup');
  const bowls = plate.contents.filter((item) => vessel(item) === 'bowl');
  const buns = plate.contents.filter((item) => item.mesh.userData.bun);
  const fillings = plate.contents.filter((item) => !cups.includes(item) && !bowls.includes(item) && !buns.includes(item));

  cups.forEach((cup, index) => cup.mesh.position.set(0.36, 0.02, -0.12 + index * 0.26));

  let y = plate.mesh.userData.baseHeight;
  for (const bowl of bowls) {
    bowl.mesh.position.set(0, y, 0);
    y += bowl.mesh.userData.height;
  }
  for (const bun of buns) {
    bun.mesh.position.set(0, y, 0);
    y += bun.mesh.userData.bun.bottom.userData.height;
  }
  for (const item of fillings) {
    item.mesh.position.set(0, y, 0);
    y += item.mesh.userData.height ?? 0.1;
  }
  for (const bun of buns) {
    const { top } = bun.mesh.userData.bun;
    top.position.y = y - bun.mesh.position.y + 0.005;
    y += top.userData.height;
  }
}

// Advances cooking; returns the new stage if it changed this frame.
export function advanceCooking(item, dt) {
  const previous = item.stage;
  item.cookTime += dt;
  item.stage = cookStage(item.type, item.cookTime);
  refreshItem(item);
  return item.stage !== previous ? item.stage : null;
}

export function refreshItem(item) {
  const def = ITEMS[item.type];
  if (def?.cook) setCookVisual(item.mesh, cookAmount(item.type, item.cookTime), item.heating ? 1 : 0);
  if (def?.liquid) setLiquidFill(item.mesh, item.fill);
}

export function itemTags(item) {
  return isPlate(item) ? item.contents.map(itemTag) : [itemTag(item)];
}

export function itemLabel(item) {
  if (isPlate(item)) {
    return item.contents.length ? `Plate: ${item.contents.map(itemLabel).join(' + ')}` : 'Empty Plate';
  }
  return tagLabel(itemTag(item));
}

export function disposeItem(item) {
  item.mesh.removeFromParent();
  disposeObject(item.mesh);
}
