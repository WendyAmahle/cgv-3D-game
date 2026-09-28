// Frees GPU memory for everything under `root`. Materials/textures flagged with
// userData.shared (see graphics/Materials.js) are cached and left alone.
export function disposeObject(root) {
  root.traverse((object) => {
    if (object.isLight) object.dispose(); // frees shadow maps

    if (object.geometry && !object.isSprite) {
      object.geometry.dispose();
    }

    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];

    for (const material of materials) {
      if (material.userData?.shared) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture && !value.userData?.shared) value.dispose();
      }
      material.dispose();
    }
  });
}
