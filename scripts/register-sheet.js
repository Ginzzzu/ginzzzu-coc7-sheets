import { MODULE_ID } from "./constants.js";
import { GinzzzuCoC7InvestigatorSheet } from "./sheets/investigator-sheet.js";
import { GinzzzuCoC7KeeperNpcSheet } from "./sheets/keeper-npc-sheet.js";

function getActorsCollection() {
  const ActorsCollection = foundry.documents.collections?.Actors ?? globalThis.Actors;
  if (!ActorsCollection?.registerSheet) {
    throw new Error(`${MODULE_ID} | Foundry Actors.registerSheet API is unavailable.`);
  }
  return ActorsCollection;
}

/** Register the opt-in Keeper sheet for CoC7 NPC and creature Actors. */
export function registerKeeperNpcSheet() {
  const ActorsCollection = getActorsCollection();
  ActorsCollection.registerSheet(MODULE_ID, GinzzzuCoC7KeeperNpcSheet, {
    types: ["npc", "creature"],
    label: game.i18n.localize(`${MODULE_ID}.Sheet.KeeperLabel`),
    makeDefault: false
  });
  return GinzzzuCoC7KeeperNpcSheet;
}

/** Register the opt-in player-facing sheet for CoC7 character Actors. */
export function registerInvestigatorSheet() {
  const ActorsCollection = getActorsCollection();
  ActorsCollection.registerSheet(MODULE_ID, GinzzzuCoC7InvestigatorSheet, {
    types: ["character"],
    label: game.i18n.localize(`${MODULE_ID}.Sheet.InvestigatorLabel`),
    makeDefault: false
  });
  return GinzzzuCoC7InvestigatorSheet;
}
