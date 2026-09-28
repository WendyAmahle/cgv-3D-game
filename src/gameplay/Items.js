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
  const liquid = ITEMS[item.type].liquid;
  item.mesh.rotation.set(0, 0, 0);

  if (liquid?.vessel === 'cup') {
    // Drinks sit beside the food rather than on top of it.
    const cups = plate.contents.filter((other) => ITEMS[other.type].liquid?.vessel === 'cup').length;
    item.mesh.position.set(0.36, 0.03, -0.12 + cups * 0.26);
  } else {
    const stacked = plate.contents.filter((other) => ITEMS[other.type].liquid?.vessel !== 'cup');
    const height = stacked.reduce((sum, other) => sum + (other.mesh.userData.height ?? 0.1), 0);
    item.mesh.position.set(0, plate.mesh.userData.baseHeight + height, 0);
  }

  plate.contents.push(item);
  plate.mesh.add(item.mesh);
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
