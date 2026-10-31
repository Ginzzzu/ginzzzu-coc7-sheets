import { MODULE_ID } from "./constants.js";
import { registerInvestigatorSheet, registerItemSheet, registerKeeperNpcSheet } from "./register-sheet.js";
import { registerAmmoConsumptionHooks } from "./services/ammo-consumption.js";
import { registerSkillDevelopmentHooks } from "./services/skill-development.js";
import {
  formatUsesPerRound,
  parseUsesPerRound,
  patchCoC7WeaponSystem,
  repairAllWeapons
} from "./services/weapon-compatibility.js";

const runtime = {
  registrationErrors: [],
  keeperNpcSheetClass: null,
  investigatorSheetClass: null,
  itemSheetClass: null
};

function publishApi() {
  const module = game.modules.get(MODULE_ID);
  if (!module) return;

  module.api = Object.freeze({
    getRegistrationErrors: () => [...runtime.registrationErrors],
    getKeeperNpcSheetClass: () => runtime.keeperNpcSheetClass,
    getInvestigatorSheetClass: () => runtime.investigatorSheetClass,
    getItemSheetClass: () => runtime.itemSheetClass,
    getSheetClasses: () => Object.freeze({
      keeperNpc: runtime.keeperNpcSheetClass,
      investigator: runtime.investigatorSheetClass,
      item: runtime.itemSheetClass
    }),
    repairAllWeapons: (options) => repairAllWeapons(options),
    formatUsesPerRound: (weapon) => formatUsesPerRound(weapon),
    parseUsesPerRound: (normal, max) => parseUsesPerRound(normal, max),
    patchWeaponSystem: () => patchCoC7WeaponSystem()
  });
}

function recordRegistrationFailure(scope, error) {
  runtime.registrationErrors.push({ scope, error });
  console.error(`${MODULE_ID} | Failed to register ${scope}.`, error);
}

Hooks.once("init", () => {
  publishApi();

  try {
    runtime.keeperNpcSheetClass = registerKeeperNpcSheet();
    console.info(`${MODULE_ID} | Alternative CoC7 Keeper NPC sheet registered.`);
  } catch (error) {
    recordRegistrationFailure("Keeper NPC sheet", error);
  }

  try {
    runtime.investigatorSheetClass = registerInvestigatorSheet();
    console.info(`${MODULE_ID} | Alternative CoC7 investigator sheet registered.`);
  } catch (error) {
    recordRegistrationFailure("investigator sheet", error);
  }

  try {
    runtime.itemSheetClass = registerItemSheet();
    console.info(`${MODULE_ID} | Alternative CoC7 Item sheet registered.`);
  } catch (error) {
    recordRegistrationFailure("Item sheet", error);
  }

  try {
    registerAmmoConsumptionHooks();
  } catch (error) {
    recordRegistrationFailure("ammunition hooks", error);
  }

  try {
    registerSkillDevelopmentHooks();
  } catch (error) {
    recordRegistrationFailure("skill development hooks", error);
  }

  try {
    patchCoC7WeaponSystem();
  } catch (error) {
    recordRegistrationFailure("weapon compatibility patch", error);
  }
});

Hooks.once("ready", () => {
  try {
    patchCoC7WeaponSystem();
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to apply weapon compatibility patch on ready.`, error);
  }

  try {
    if (!runtime.registrationErrors.length || !game.user.isGM) return;
    ui.notifications.error(`${MODULE_ID}.Notifications.RegistrationFailed`, {
      localize: true,
      permanent: true
    });
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to display the registration error.`, error);
  }
});
