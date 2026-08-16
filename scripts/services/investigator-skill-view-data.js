import { getEffectiveSkillValue } from "./skill-values.js";

const FILTER_IDS = new Set(["all", "occupation", "combat", "marked"]);

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSearch(value) {
  return String(value ?? "").trim().toLocaleLowerCase(game.i18n.lang);
}

function isCombatSkill(skill) {
  const properties = skill.system.properties ?? {};
  return Boolean(properties.fighting || properties.firearm || properties.ranged);
}

function buildSkillViewModel(skill) {
  const value = getEffectiveSkillValue(skill);
  const adjustments = skill.system.adjustments ?? {};
  const flags = skill.system.flags ?? {};

  return {
    id: skill.id,
    uuid: skill.uuid,
    img: skill.img,
    name: skill.name,
    displayName: skill.name,
    value,
    hard: Math.floor(value / 2),
    extreme: Math.floor(value / 5),
    developmentMarked: Boolean(flags.developement),
    canMarkDevelopment: !skill.system.properties?.noxpgain,
    isOccupation: Boolean(flags.occupation),
    isCombat: isCombatSkill(skill),
    isRare: Boolean(skill.system.properties?.rarity),
    adjustments: {
      base: numberValue(adjustments.base),
      personal: numberValue(adjustments.personal),
      occupation: numberValue(adjustments.occupation),
      archetype: numberValue(adjustments.archetype),
      experiencePackage: numberValue(adjustments.experiencePackage),
      experience: numberValue(adjustments.experience)
    },
    hasArchetype: Boolean(flags.archetype) || numberValue(adjustments.archetype) !== 0,
    hasExperiencePackage: Boolean(flags.experiencePackage)
      || numberValue(adjustments.experiencePackage) !== 0
  };
}

/** Build filtered investigator skill rows without changing native CoC7 Items. */
export function buildInvestigatorSkillView(document, { filter = "all", search = "" } = {}) {
  const activeFilter = FILTER_IDS.has(filter) ? filter : "all";
  const query = normalizeSearch(search);
  const allSkills = document.items
    .filter((item) => item.type === "skill")
    .map(buildSkillViewModel)
    .sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));

  const visibleSkills = allSkills.filter((skill) => {
    if (activeFilter === "occupation" && !skill.isOccupation) return false;
    if (activeFilter === "combat" && !skill.isCombat) return false;
    if (activeFilter === "marked" && !skill.developmentMarked) return false;
    return !query || skill.name.toLocaleLowerCase(game.i18n.lang).includes(query);
  });

  return {
    activeFilter,
    search,
    skills: visibleSkills,
    totalCount: allSkills.length,
    visibleCount: visibleSkills.length,
    showArchetype: allSkills.some((skill) => skill.hasArchetype),
    showExperiencePackage: allSkills.some((skill) => skill.hasExperiencePackage),
    filters: [
      { id: "all", label: game.i18n.localize("ginzzzu-coc7-sheets.Filters.All"), active: activeFilter === "all" },
      { id: "occupation", label: game.i18n.localize("ginzzzu-coc7-sheets.Filters.Occupation"), active: activeFilter === "occupation" },
      { id: "combat", label: game.i18n.localize("ginzzzu-coc7-sheets.Filters.Combat"), active: activeFilter === "combat" },
      { id: "marked", label: game.i18n.localize("ginzzzu-coc7-sheets.Filters.Marked"), active: activeFilter === "marked" }
    ]
  };
}
