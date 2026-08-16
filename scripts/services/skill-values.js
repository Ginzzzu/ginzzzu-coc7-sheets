function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getRawSkillBase(skill) {
  return skill?._source?.system?.base ?? skill?.system?.base ?? "";
}

function getAdjustmentTotal(skill) {
  return Object.values(skill?.system?.adjustments ?? {})
    .reduce((total, value) => total + toFiniteNumber(value), 0);
}

/**
 * Return a positive numeric legacy base value, when the skill stores its final
 * NPC percentage in system.base instead of system.adjustments.base.
 *
 * @param {Item} skill Embedded CoC7 Skill Item.
 * @returns {number|null}
 */
export function getLegacyNumericBase(skill) {
  const rawBase = getRawSkillBase(skill);
  const text = String(rawBase ?? "").trim();
  if (!/^\d+$/.test(text)) return null;

  const base = Number.parseInt(text, 10);
  return Number.isFinite(base) && base > 0 ? base : null;
}

/**
 * Determine whether a Skill is in the narrow legacy state produced by an NPC
 * import that supplied a numeric system.base but no adjustment values.
 *
 * @param {Item} skill Embedded CoC7 Skill Item.
 * @returns {boolean}
 */
export function needsLegacyBaseRepair(skill) {
  if (skill?.type !== "skill") return false;

  const legacyBase = getLegacyNumericBase(skill);
  if (legacyBase === null) return false;

  const preparedValue = toFiniteNumber(skill.system?.value);
  const adjustmentTotal = getAdjustmentTotal(skill);
  return preparedValue === 0 && adjustmentTotal === 0;
}

/**
 * Read the percentage that should be displayed and rolled for a CoC7 Skill.
 *
 * @param {Item} skill Embedded CoC7 Skill Item.
 * @returns {number}
 */
export function getEffectiveSkillValue(skill) {
  const preparedValue = toFiniteNumber(skill?.system?.value);
  if (preparedValue !== 0) return preparedValue;

  const adjustmentTotal = getAdjustmentTotal(skill);
  if (adjustmentTotal !== 0) return adjustmentTotal;

  return getLegacyNumericBase(skill) ?? 0;
}

/**
 * Build one batch update per malformed legacy skill. The caller must submit
 * the returned rows with Actor.updateEmbeddedDocuments.
 *
 * @param {Actor} actor CoC7 NPC Actor.
 * @returns {object[]}
 */
export function buildLegacySkillBaseUpdates(actor) {
  return actor.items
    .filter(needsLegacyBaseRepair)
    .map((skill) => ({
      _id: skill.id,
      "system.adjustments.base": getLegacyNumericBase(skill)
    }));
}
