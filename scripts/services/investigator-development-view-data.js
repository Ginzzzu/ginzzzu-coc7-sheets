function safeNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPointPool(label, spent, target, { optional = false } = {}) {
  const normalizedSpent = safeNumber(spent);
  const normalizedTarget = safeNumber(target);
  return {
    label,
    spent: normalizedSpent,
    target: normalizedTarget,
    visible: !optional || normalizedTarget !== 0 || normalizedSpent !== 0,
    valid: normalizedSpent === normalizedTarget,
    percent: normalizedTarget > 0
      ? Math.max(0, Math.min(100, Math.round((normalizedSpent / normalizedTarget) * 100)))
      : (normalizedSpent === 0 ? 100 : 0)
  };
}

/**
 * Build the investigator development workspace using only native CoC7 data and APIs.
 */
export function buildInvestigatorDevelopmentView(actor) {
  const markedSkills = actor.items
    .filter((item) => item.type === "skill" && item.system.flags?.developement && !item.system.properties?.noxpgain)
    .map((skill) => {
      const value = safeNumber(skill.system.value);
      return {
        id: skill.id,
        uuid: skill.uuid,
        name: skill.name,
        img: skill.img,
        value,
        hard: Math.floor(value / 2),
        extreme: Math.floor(value / 5)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));

  const development = actor.system.development ?? {};
  const pointPools = [
    buildPointPool(game.i18n.localize("CoC7.SkillPersonal"), actor.personalPointsSpent, development.personal),
    buildPointPool(game.i18n.localize("CoC7.SkillOccupation"), actor.occupationPointsSpent, development.occupation),
    buildPointPool(game.i18n.localize("CoC7.SkillArchetype"), actor.archetypePointsSpent, development.archetype, { optional: true }),
    buildPointPool(game.i18n.localize("ginzzzu-coc7-sheets.Fields.ExperiencePackage"), actor.experiencePackagePointsSpent, development.experiencePackage, { optional: true })
  ].filter((pool) => pool.visible);

  return {
    allowDevelopment: game.settings.get("CoC7", "developmentEnabled"),
    developmentRollForLuck: game.settings.get("CoC7", "developmentRollForLuck"),
    hasDevelopmentPhase: Boolean(actor.hasDevelopmentPhase),
    markedSkills,
    markedCount: markedSkills.length,
    pointPools,
    experiencePoints: safeNumber(actor.experiencePoints),
    hasPointWarnings: pointPools.some((pool) => !pool.valid)
  };
}
