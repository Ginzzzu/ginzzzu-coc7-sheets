import { MODULE_ID } from "./constants.js";
import { registerInvestigatorSheet, registerKeeperNpcSheet } from "./register-sheet.js";
import { registerAmmoConsumptionHooks } from "./services/ammo-consumption.js";

const runtime = {
  registrationErrors: [],
  keeperNpcSheetClass: null,
  investigatorSheetClass: null
};

function publishApi() {
  const module = game.modules.get(MODULE_ID);
  if (!module) return;

  module.api = Object.freeze({
    getRegistrationErrors: () => [...runtime.registrationErrors],
    getKeeperNpcSheetClass: () => runtime.keeperNpcSheetClass,
    getInvestigatorSheetClass: () => runtime.investigatorSheetClass,
    getSheetClasses: () => Object.freeze({
      keeperNpc: runtime.keeperNpcSheetClass,
      investigator: runtime.investigatorSheetClass
    })
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
    registerAmmoConsumptionHooks();
  } catch (error) {
    recordRegistrationFailure("ammunition hooks", error);
  }
});

Hooks.once("ready", () => {
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
