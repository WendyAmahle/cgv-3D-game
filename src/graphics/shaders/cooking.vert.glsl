// Cooking shader — vertex stage (runs after three.js's <begin_vertex>).
// Food shrinks and puffs as it cooks, and sizzles (tiny normal jitter) on the heat.
float cookedAmount = clamp(uCook, 0.0, 1.0);
float burntAmount = clamp(uCook - 1.0, 0.0, 1.0);

vCookLocal = position;
vCookNormal = normalize(mat3(modelMatrix) * objectNormal);

transformed.xz *= 1.0 - 0.08 * cookedAmount - 0.05 * burntAmount;
transformed.y *= 1.0 + 0.15 * cookedAmount - 0.12 * burntAmount;

float cookSizzle = sin(uTime * 45.0 + position.x * 30.0 + position.z * 23.0);
transformed += objectNormal * cookSizzle * 0.003 * uHeat;
