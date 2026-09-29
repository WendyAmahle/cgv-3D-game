// Cooking shader — fragment stage (runs after three.js's <color_fragment>).
// Blends raw → cooked → burnt with noisy, uneven browning, darkens grill marks
// on top faces, and outputs cookRoughness / cookEmissive for later chunks:
// raw food is wet and glossy, burnt food is dry and matte, and burnt food
// glows with embers while still on the heat.
float cookedAmount = clamp(uCook, 0.0, 1.0);
float burntAmount = clamp(uCook - 1.0, 0.0, 1.0);
vec2 cookQ = vCookLocal.xz * 1.3 + vCookLocal.y * 0.9;
float cookN = cookNoise(cookQ * 14.0) * 0.6 + cookNoise(cookQ * 43.0) * 0.4;

// Browning starts at the edges/bottom and spreads unevenly.
float cookEdge = smoothstep(0.1, 0.35, length(vCookLocal.xz));
float cookBrown = smoothstep(0.0, 1.0, cookedAmount * 1.5 - cookN * 0.5 + cookEdge * 0.15);
float cookCharred = smoothstep(0.0, 1.0, burntAmount * 1.6 - cookN * 0.6 + cookEdge * 0.2);
vec3 cookColor = mix(uRaw, uCooked, cookBrown);
cookColor = mix(cookColor, uBurnt, cookCharred);

// Grill marks on upward-facing surfaces.
float cookUp = smoothstep(0.5, 0.9, vCookNormal.y);
float cookStripes = smoothstep(0.72, 0.86, fract((vCookLocal.x + vCookLocal.z) * 6.0));
cookColor *= 1.0 - cookStripes * cookUp * uMarks * cookBrown * 0.6;

diffuseColor.rgb *= cookColor;

float cookRoughness = mix(mix(uRoughness.x, uRoughness.y, cookBrown), uRoughness.z, cookCharred);

float cookPulse = 0.5 + 0.5 * sin(uTime * 6.0 + cookN * 6.2831);
vec3 cookEmissive = vec3(1.0, 0.3, 0.05) * uHeat * 0.06 * cookPulse;
float cookEmber = step(0.86, cookNoise(cookQ * 60.0 + uTime * 0.7)) * cookCharred * uHeat;
cookEmissive += vec3(1.0, 0.28, 0.0) * cookEmber * 2.0;
