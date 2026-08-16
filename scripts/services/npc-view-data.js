import { MODULE_ID } from "../constants.js";
import { getEffectiveSkillValue } from "./skill-values.js";
import { buildWeaponDamageFormula } from "./weapon-damage.js";

const TEXT_EDITOR = foundry.applications.ux?.TextEditor?.implementation ?? globalThis.TextEditor;

function getWeaponSkill(document, weapon, key) {
  const getterName = key === "main" ? "skillMain" : "skillAlternative";
  const computed = weapon.system?.[getterName];
  if (computed?.type === "skill") return computed;

  const id = weapon.system?.skill?.[key]?.id;
  const embedded = id ? document.items.get(id) : null;
  return embedded?.type === "skill" ? embedded : null;
}

function buildDamageRanges(weapon) {
  const labels = {
    normal: "CoC7.rangeCombatCard.BaseRange",
    long: "CoC7.rangeCombatCard.LongRange",
    extreme: "CoC7.rangeCombatCard.ExtremeRange"
  };
  return Object.entries(weapon.system?.range ?? {})
    .filter(([, range]) => range?.damage)
    .map(([key, range]) => ({
      key,
      label: game.i18n.localize(labels[key] ?? "CoC7.WeaponRange"),
      damage: range.damage,
      distance: range.value ?? null
    }));
}

function buildPropertyLabels(weapon) {
  const properties = weapon.system?.properties ?? {};
  const labels = [];
  if (properties.rngd) labels.push(game.i18n.localize(`${MODULE_ID}.WeaponProperties.Ranged`));
  if (properties.shotgun) labels.push(game.i18n.localize(`${MODULE_ID}.WeaponProperties.Shotgun`));
  if (properties.addb) labels.push(game.i18n.localize(`${MODULE_ID}.WeaponProperties.AddDb`));
  if (properties.ahdb) labels.push(game.i18n.localize(`${MODULE_ID}.WeaponProperties.AddHalfDb`));
  return labels;
}

export function buildWeaponViewModels(document) {
  return document.items
    .filter((item) => item.type === "weapon")
    .sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang))
    .map((weapon) => {
      const mainSkill = getWeaponSkill(document, weapon, "main");
      const alternativeCandidate = getWeaponSkill(document, weapon, "alternativ");
      const alternativeSkill = alternativeCandidate?.id !== mainSkill?.id ? alternativeCandidate : null;
      const damageRanges = buildDamageRanges(weapon);
      const primaryDamageRange = damageRanges.find((range) => range.key === "normal") ?? damageRanges[0] ?? null;
      const damageFormula = primaryDamageRange
        ? buildWeaponDamageFormula(document, weapon, primaryDamageRange.key)
        : "";
      return {
        id: weapon.id,
        uuid: weapon.uuid,
        name: weapon.name,
        img: weapon.img,
        mainSkill: mainSkill
          ? { uuid: mainSkill.uuid, name: mainSkill.name, value: getEffectiveSkillValue(mainSkill) }
          : null,
        alternativeSkill: alternativeSkill
          ? { uuid: alternativeSkill.uuid, name: alternativeSkill.name, value: getEffectiveSkillValue(alternativeSkill) }
          : null,
        damageRanges,
        hasMultipleDamageRanges: damageRanges.length > 1,
        primaryDamage: primaryDamageRange?.damage ?? game.i18n.localize(`${MODULE_ID}.Fields.NotSet`),
        primaryDamageRange: primaryDamageRange?.key ?? "normal",
        damageFormula,
        canRollDamage: Boolean(damageFormula),
        damageTooltip: damageFormula
          ? game.i18n.format(`${MODULE_ID}.Hints.DamageRoll`, { formula: damageFormula })
          : "",
        propertyLabels: buildPropertyLabels(weapon),
        isRanged: Boolean(weapon.system?.properties?.rngd),
        hasAmmoTracker: Boolean(weapon.system?.properties?.rngd) && weapon.system?.bullets !== null,
        ammo: weapon.system?.ammo ?? null,
        bullets: weapon.system?.bullets ?? null,
        malfunction: weapon.system?.malfunction ?? null,
        hasMalfunction: weapon.system?.malfunction !== null && weapon.system?.malfunction !== undefined,
        usesPerRound: weapon.system?.usesPerRound?.normal ?? ""
      };
    });
}

function getTypeLabel(type) {
  const key = `${MODULE_ID}.ItemTypes.${type}`;
  const localized = game.i18n.localize(key);
  return localized === key ? game.i18n.localize(`${MODULE_ID}.ItemTypes.Other`) : localized;
}

export function buildInventoryViewModels(document) {
  return document.items
    .filter((item) => !["skill", "weapon"].includes(item.type))
    .sort((left, right) => {
      const typeOrder = left.type.localeCompare(right.type, game.i18n.lang);
      return typeOrder || left.name.localeCompare(right.name, game.i18n.lang);
    })
    .map((item) => ({
      id: item.id,
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      type: item.type,
      typeLabel: getTypeLabel(item.type),
      quantity: Number(item.system?.quantity ?? 1),
      showQuantity: Number(item.system?.quantity ?? 1) !== 1
    }));
}

export async function enrichNpcText(document, editable) {
  const fallback = {
    personalDescription: document.system.biography?.personalDescription?.value ?? "",
    keeperDescription: document.system.description?.keeper ?? ""
  };
  if (!TEXT_EDITOR?.enrichHTML) return fallback;

  try {
    const [personalDescription, keeperDescription] = await Promise.all([
      TEXT_EDITOR.enrichHTML(fallback.personalDescription, { async: true, secrets: editable }),
      TEXT_EDITOR.enrichHTML(fallback.keeperDescription, { async: true, secrets: editable })
    ]);
    return { personalDescription, keeperDescription };
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to enrich NPC text.`, error);
    return fallback;
  }
}
