const PLAYER_HUD_MODULE_ID = "ginzzzu-coc7-player-hud";
const CREATION_PROGRESS_FLAG = "investigatorCreationProgress";
const RESUMABLE_STATUSES = new Set(["inProgress", "ready"]);
const COMPLETED_STATUS = "completed";
const CREATION_STEP_ORDER = Object.freeze([
  "setup",
  "characteristics",
  "age",
  "derived",
  "occupation",
  "occupationSkills",
  "personalInterests",
  "personalData",
  "review"
]);

function activePlayerHudModule() {
  const module = game.modules.get(PLAYER_HUD_MODULE_ID);
  return module?.active ? module : null;
}

function numericValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function hasMeaningfulBiography(document) {
  const oneBlock = String(document.system?.backstory ?? "").replace(/<[^>]*>/g, "").trim();
  if (oneBlock) return true;

  return (document.system?.biography ?? []).some((section) => {
    const title = String(section?.title ?? "").trim();
    const value = String(section?.value ?? "").replace(/<[^>]*>/g, "").trim();
    return Boolean(title || value);
  });
}

function hasManualCharacterData(document) {
  const infos = document.system?.infos ?? {};
  const identityValues = [
    infos.occupation,
    infos.age,
    infos.sex,
    infos.birthplace,
    infos.residence
  ];
  if (identityValues.some((value) => String(value ?? "").trim())) return true;

  const characteristics = document.system?.characteristics ?? {};
  if (Object.values(characteristics).some((entry) => numericValue(entry?.value) > 0)) return true;
  if (numericValue(document.system?.attribs?.lck?.value) > 0) return true;
  if (hasMeaningfulBiography(document)) return true;

  const items = Array.from(document.items ?? []);
  if (items.some((item) => item.type !== "skill")) return true;
  return items.some((item) => {
    if (item.type !== "skill") return false;
    const adjustments = item.system?.adjustments ?? {};
    return [
      adjustments.personal,
      adjustments.occupation,
      adjustments.archetype,
      adjustments.experiencePackage,
      adjustments.experience
    ].some((value) => numericValue(value) !== 0) || Boolean(item.system?.flags?.occupation);
  });
}

function matchesAssignedSourceActor(document) {
  if (game.user?.isGM || document?.isToken) return false;
  const assigned = game.user?.character;
  return Boolean(assigned && assigned.id === document?.id);
}

function creationProgress(document) {
  const snapshot = document.getFlag?.(PLAYER_HUD_MODULE_ID, CREATION_PROGRESS_FLAG) ?? null;
  return snapshot?.userId === game.user?.id ? snapshot : null;
}

function progressStep(snapshot) {
  const currentStep = CREATION_STEP_ORDER.includes(snapshot?.currentStep)
    ? snapshot.currentStep
    : null;
  if (!currentStep) return null;

  return {
    key: currentStep,
    labelKey: `ginzzzu-coc7-sheets.CreationSteps.${currentStep}`,
    number: CREATION_STEP_ORDER.indexOf(currentStep) + 1,
    total: CREATION_STEP_ORDER.length
  };
}

export function buildPlayerHudCreationView(document) {
  const module = activePlayerHudModule();
  if (!module || typeof module.api?.openCreation !== "function") return null;
  if (!matchesAssignedSourceActor(document)) return null;

  const snapshot = creationProgress(document);
  if (snapshot?.status === COMPLETED_STATUS) return null;

  const resumable = RESUMABLE_STATUSES.has(snapshot?.status);

  if (resumable) {
    return {
      actionLabelKey: "ginzzzu-coc7-sheets.Actions.ResumeCreation",
      hintKey: "ginzzzu-coc7-sheets.Hints.ResumeCreation",
      icon: "fa-solid fa-list-check",
      mode: "resume",
      step: progressStep(snapshot)
    };
  }

  if (hasManualCharacterData(document)) return null;

  return {
    actionLabelKey: "ginzzzu-coc7-sheets.Actions.StartCreation",
    hintKey: "ginzzzu-coc7-sheets.Hints.StartCreation",
    icon: "fa-solid fa-user-plus",
    mode: "start",
    step: null
  };
}

export async function openPlayerHudCreation() {
  const module = activePlayerHudModule();
  const openCreation = module?.api?.openCreation;
  if (typeof openCreation !== "function") return false;
  await openCreation();
  return true;
}
