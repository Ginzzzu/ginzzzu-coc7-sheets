import { MODULE_ID } from "../constants.js";

function normalizeFormulaPart(value) {
  return (value ?? "").toString().trim().replace(/\s+/g, "");
}

function appendModifier(formula, modifier) {
  const normalized = normalizeFormulaPart(modifier);
  if (!normalized || normalized === "0") return formula;
  return `${formula}${normalized.startsWith("+") || normalized.startsWith("-") ? "" : "+"}${normalized}`;
}

function halfDamageBonus(damageBonus) {
  let formula = normalizeFormulaPart(damageBonus) || "0";
  if (!formula.startsWith("-") && !formula.startsWith("+")) formula = `+${formula}`;

  const values = [...formula.matchAll(/([+-])(\d+)(d(\d+))?/gi)];
  let lastPosition = 0;
  for (const value of values) {
    const found = formula.indexOf(value[0], lastPosition);
    if (found < 0) continue;

    const sign = value[1];
    const amount = Number(value[2]);
    const dieFaces = value[4] === undefined ? null : Number(value[4]);
    const halved = dieFaces === null
      ? (sign === "-" ? Math.ceil(amount / 2) : Math.floor(amount / 2)).toString()
      : `${amount}D${sign === "-" ? Math.ceil(dieFaces / 2) : Math.floor(dieFaces / 2)}`;
    const replacement = `${sign}${halved}`;

    formula = formula.slice(0, found) + replacement + formula.slice(found + value[0].length);
    lastPosition = found + replacement.length;
  }

  return formula;
}

/**
 * Build the damage formula used by a native CoC7 weapon, including full or half damage bonus.
 *
 * @param {Actor} actor
 * @param {Item} weapon
 * @param {string} rangeKey
 * @returns {string}
 */
export function buildWeaponDamageFormula(actor, weapon, rangeKey = "normal") {
  let formula = normalizeFormulaPart(weapon.system?.range?.[rangeKey]?.damage);
  if (!formula) return "";

  const properties = weapon.system?.properties ?? {};
  const damageBonus = actor.system?.attribs?.db?.value;
  if (properties.addb) formula = appendModifier(formula, damageBonus);
  else if (properties.ahdb) formula = appendModifier(formula, halfDamageBonus(damageBonus));

  return formula;
}

/**
 * Roll a weapon's damage formula to chat without applying it to a target.
 *
 * @param {Actor} actor
 * @param {Item} weapon
 * @param {string} rangeKey
 * @returns {Promise<Roll|null>}
 */
export async function rollWeaponDamage(actor, weapon, rangeKey = "normal") {
  const formula = buildWeaponDamageFormula(actor, weapon, rangeKey);
  if (!formula || !Roll.validate(formula)) {
    ui.notifications.warn(game.i18n.format(`${MODULE_ID}.Notifications.InvalidDamageFormula`, {
      weapon: weapon.name
    }));
    return null;
  }

  const roll = await new Roll(formula, actor.parsedValues?.() ?? {}).roll();
  await roll.toMessage({
    flavor: game.i18n.format(`${MODULE_ID}.Messages.DamageRoll`, { weapon: weapon.name }),
    speaker: ChatMessage.getSpeaker({ actor })
  });
  return roll;
}
