import { MODULE_ID } from "../constants.js";

const CONDITION_DEFINITIONS = Object.freeze([
  {
    key: "prone",
    labelKey: "CoC7.Prone",
    icon: "game-icon game-icon-falling"
  },
  {
    key: "unconscious",
    labelKey: "CoC7.Unconscious",
    icon: "game-icon game-icon-knocked-out-stars"
  },
  {
    key: "criticalWounds",
    labelKey: "CoC7.CriticalWounds",
    icon: "game-icon game-icon-arm-sling"
  },
  {
    key: "dying",
    labelKey: "CoC7.Dying",
    icon: "game-icon game-icon-heart-beats"
  },
  {
    key: "dead",
    labelKey: "CoC7.Dead",
    icon: "fa-solid fa-skull"
  },
  {
    key: "tempoInsane",
    labelKey: "CoC7.BoutOfMadness",
    icon: "game-icon game-icon-hanging-spider"
  },
  {
    key: "indefInsane",
    labelKey: "CoC7.IndefiniteInsanity",
    activeLabelKey: "CoC7.UnderlyingInsanity",
    icon: "game-icon game-icon-tentacles-skull"
  }
]);

export function buildConditionViewModels(document) {
  return CONDITION_DEFINITIONS.map((definition) => {
    const active = typeof document.hasConditionStatus === "function"
      ? document.hasConditionStatus(definition.key)
      : Boolean(document.system.conditions?.[definition.key]?.value);
    const labelKey = active && definition.activeLabelKey
      ? definition.activeLabelKey
      : definition.labelKey;

    return {
      ...definition,
      active,
      label: game.i18n.localize(labelKey)
    };
  });
}

export function buildDocumentContextViewModel(document) {
  const isTokenInstance = Boolean(document.isToken);
  return {
    isTokenInstance,
    icon: isTokenInstance ? "fa-solid fa-cube" : "fa-solid fa-database",
    label: game.i18n.localize(
      isTokenInstance
        ? `${MODULE_ID}.Context.TokenInstance`
        : `${MODULE_ID}.Context.SourceActor`
    ),
    detail: isTokenInstance ? (document.token?.name ?? document.name) : ""
  };
}
