import { MODULE_ID } from "../constants.js";

/**
 * Safely parses the normal and maximum rate of fire from weapon data.
 * Handles inputs like "1 (3)", "1(2)", "1 или 2", "1-3", "1/2", "1", etc.
 *
 * @param {string|number|null|undefined} normalValue
 * @param {string|number|null|undefined} maxValue
 * @returns {{ normal: string, max: string }}
 */
export function parseUsesPerRound(normalValue, maxValue) {
  let normal = normalValue !== null && normalValue !== undefined ? String(normalValue).trim() : "1";
  let max = maxValue !== null && maxValue !== undefined ? String(maxValue).trim() : "";

  // Check if normal contains parentheses like "1 (3)" or "1(2)"
  const parensMatch = normal.match(/^([^\s(]+)\s*\(([^)]+)\)$/);
  if (parensMatch) {
    normal = parensMatch[1].trim();
    if (!max) max = parensMatch[2].trim();
  } else {
    // Check for range patterns like "1 или 2", "1 or 2", "1-3", "1 - 2"
    const rangeMatch = normal.match(/^(\d+(?:\/\d+)?)\s*(?:[-–—]|или|or)\s*(\d+)$/i);
    if (rangeMatch) {
      normal = rangeMatch[1].trim();
      if (!max) max = rangeMatch[2].trim();
    }
  }

  // Also check if max has parentheses like "(3)"
  if (max) {
    const maxParens = max.match(/\(([^)]+)\)/);
    if (maxParens) max = maxParens[1].trim();
  }

  return { normal, max };
}

/**
 * Formats the weapon's rate of fire for display on character and NPC sheets.
 * E.g., if normal is 1 and max is 3, displays as "1 (3)".
 *
 * @param {Item} weapon
 * @returns {string}
 */
export function formatUsesPerRound(weapon) {
  const system = weapon?.system;
  if (!system?.usesPerRound) return "";

  const { normal, max } = parseUsesPerRound(
    system.usesPerRound.normal,
    system.usesPerRound.max
  );

  if (normal && max && normal !== max && !normal.includes(`(${max})`)) {
    return `${normal} (${max})`;
  }
  return normal || max || "";
}

/**
 * Evaluates whether the weapon is capable of single-shot fire.
 * Never throws a Roll parse syntax error even on invalid or complex formulas.
 *
 * @param {object} weaponSystem - The weapon item's system data model
 * @returns {boolean}
 */
export function evaluateSingleShot(weaponSystem) {
  const rawNormal = (weaponSystem?.usesPerRound?.normal ?? "").toString().trim();
  if (!rawNormal || rawNormal === "-" || rawNormal === "0") return false;

  const { normal } = parseUsesPerRound(rawNormal, weaponSystem?.usesPerRound?.max);
  if (!normal || normal === "-" || normal === "0") return false;

  const num = Number(normal);
  if (!Number.isNaN(num)) return num > 0;

  try {
    const roll = new Roll(normal);
    if (roll.isDeterministic) {
      return roll.evaluateSync().total > 0;
    }
  } catch {
    // If not a parseable roll formula, check if it contains a positive digit (e.g. 1/2, 1/3)
    return /\b[1-9]\d*/.test(normal);
  }
  return true;
}

/**
 * Evaluates whether the weapon is capable of multiple shots in a round.
 * Checks both `usesPerRound.max` and any parenthesized maximum in `usesPerRound.normal`.
 *
 * @param {object} weaponSystem - The weapon item's system data model
 * @returns {boolean}
 */
export function evaluateMultipleShots(weaponSystem) {
  const { normal, max } = parseUsesPerRound(
    weaponSystem?.usesPerRound?.normal,
    weaponSystem?.usesPerRound?.max
  );

  if (max && max !== "-" && max !== "0") {
    const num = Number(max);
    if (!Number.isNaN(num)) return num > 1;

    try {
      const roll = new Roll(max);
      if (roll.isDeterministic) {
        return roll.evaluateSync().total > 1;
      }
    } catch {
      // Ignore formula parse error
    }
  }

  // If max was not > 1, check if normal rate is greater than 1 (e.g. 2 attacks per round)
  const normalNum = Number(normal);
  if (!Number.isNaN(normalNum) && normalNum > 1) return true;

  try {
    const roll = new Roll(normal);
    if (roll.isDeterministic) {
      return roll.evaluateSync().total > 1;
    }
  } catch {
    // Ignore formula parse error
  }

  return false;
}

/**
 * Patches the CoC7 weapon data model and document prototype to prevent
 * SyntaxError crashes when calculating singleShot and multipleShots.
 * Also derives clean `normal` and `max` in memory so combat cards properly
 * calculate maximum allowed shots.
 *
 * @returns {boolean} True if the patch was successfully applied
 */
export function patchCoC7WeaponSystem() {
  const WeaponDataModel = CONFIG.Item?.dataModels?.weapon;
  if (!WeaponDataModel?.prototype) return false;

  const proto = WeaponDataModel.prototype;

  // 1. Patch singleShot getter on Weapon DataModel prototype
  Object.defineProperty(proto, "singleShot", {
    get() {
      return evaluateSingleShot(this);
    },
    configurable: true,
    enumerable: true
  });

  // 2. Patch multipleShots getter on Weapon DataModel prototype
  Object.defineProperty(proto, "multipleShots", {
    get() {
      return evaluateMultipleShots(this);
    },
    configurable: true,
    enumerable: true
  });

  // 3. Wrap prepareDerivedData to ensure usesPerRound has clean in-memory values
  if (!proto._gciWeaponPatched) {
    const originalPrepareDerivedData = proto.prepareDerivedData;
    proto.prepareDerivedData = function (...args) {
      if (originalPrepareDerivedData) {
        originalPrepareDerivedData.apply(this, args);
      }
      try {
        if (this.usesPerRound) {
          const { normal, max } = parseUsesPerRound(this.usesPerRound.normal, this.usesPerRound.max);
          if (normal && normal !== this.usesPerRound.normal) {
            this.usesPerRound.normal = normal;
          }
          if (max && !this.usesPerRound.max) {
            this.usesPerRound.max = max;
          }
        }
      } catch (err) {
        console.warn(`${MODULE_ID} | Error in weapon prepareDerivedData normalization`, err);
      }
    };
    proto._gciWeaponPatched = true;
  }

  // 4. Patch Item documentClass prototype for backwards compatibility (Item.singleShot / Item.multipleShots)
  const ItemClass = CONFIG.Item?.documentClass;
  if (ItemClass?.prototype) {
    Object.defineProperty(ItemClass.prototype, "singleShot", {
      get() {
        return this.type === "weapon" ? this.system?.singleShot ?? false : null;
      },
      configurable: true,
      enumerable: true
    });

    Object.defineProperty(ItemClass.prototype, "multipleShots", {
      get() {
        return this.type === "weapon" ? this.system?.multipleShots ?? false : null;
      },
      configurable: true,
      enumerable: true
    });
  }

  return true;
}

/**
 * Utility for GMs to permanently clean up weapon items in the world database
 * (both in world items collection and embedded in world actors).
 *
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false]
 * @returns {Promise<{ repaired: number, examined: number, details: Array<{ name: string, actor: string, before: object, after: object }> }>}
 */
export async function repairAllWeapons({ dryRun = false } = {}) {
  const details = [];
  let examined = 0;

  async function checkWeapon(weapon, actorName = null) {
    if (weapon.type !== "weapon" || !weapon.system?.usesPerRound) return;
    examined++;

    const rawNormal = weapon.system.usesPerRound.normal;
    const rawMax = weapon.system.usesPerRound.max;
    const { normal, max } = parseUsesPerRound(rawNormal, rawMax);

    const normalNeedsChange = rawNormal !== null && rawNormal !== undefined && String(rawNormal).trim() !== normal;
    const maxNeedsChange = max && (!rawMax || String(rawMax).trim() !== max);

    if (normalNeedsChange || maxNeedsChange) {
      details.push({
        name: weapon.name,
        actor: actorName || "World Item",
        before: { normal: rawNormal, max: rawMax },
        after: { normal, max }
      });

      if (!dryRun) {
        const updateData = {};
        if (normalNeedsChange) updateData["system.usesPerRound.normal"] = normal;
        if (maxNeedsChange) updateData["system.usesPerRound.max"] = max;
        await weapon.update(updateData);
      }
    }
  }

  // Check world items
  for (const item of game.items.filter((i) => i.type === "weapon")) {
    await checkWeapon(item);
  }

  // Check world actors
  for (const actor of game.actors) {
    for (const weapon of actor.items.filter((i) => i.type === "weapon")) {
      await checkWeapon(weapon, actor.name);
    }
  }

  const repaired = details.length;
  console.info(`${MODULE_ID} | Weapon repair complete. Examined: ${examined}, Repaired: ${repaired}.`, details);

  const notificationKey = dryRun
    ? `${MODULE_ID}.Notifications.WeaponRepairDryRun`
    : `${MODULE_ID}.Notifications.WeaponRepairSuccess`;

  ui.notifications?.info?.(game.i18n.format(notificationKey, { count: repaired }));

  return { repaired, examined, details };
}
