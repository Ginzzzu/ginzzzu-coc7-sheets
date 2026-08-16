import { MODULE_ID } from "../constants.js";

const RANGED_CARD_TYPE = "CoC7ChatCombatRanged";
const PENDING_TTL_MS = 120_000;
const pendingByWeapon = new Map();
const trackedMessages = new Map();

function getRangedCardData(message) {
  const data = message?.flags?.CoC7?.load;
  return data?.as === RANGED_CARD_TYPE ? data : null;
}

function asAmmo(value) {
  const parsed = Number.parseInt(value ?? 0, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function clearExpiredPending() {
  const cutoff = Date.now() - PENDING_TTL_MS;
  for (const [weaponUuid, pending] of pendingByWeapon) {
    if (pending.startedAt < cutoff) pendingByWeapon.delete(weaponUuid);
  }
}

async function refreshOpenKeeperSheets(actorUuid) {
  const renders = [];
  for (const application of foundry.applications.instances.values()) {
    if (application.document?.uuid !== actorUuid) continue;
    if (!application.element?.classList?.contains(MODULE_ID)) continue;
    renders.push(application.render({ parts: ["body"] }));
  }
  await Promise.allSettled(renders);
}

async function synchronizeTrackedMessage(messageId) {
  const tracked = trackedMessages.get(messageId);
  if (!tracked || game.settings.get("CoC7", "disregardAmmo")) return;

  const message = game.messages.get(messageId);
  const data = getRangedCardData(message);
  if (!data) return;

  const totalBulletsFired = asAmmo(data.totalBulletsFired);
  if (totalBulletsFired <= tracked.lastTotalBulletsFired) return;

  const weapon = await fromUuid(tracked.weaponUuid);
  if (!weapon || weapon.type !== "weapon") {
    trackedMessages.delete(messageId);
    return;
  }

  const expectedAmmo = Math.max(0, tracked.initialAmmo - totalBulletsFired);
  const actualAmmo = asAmmo(weapon.system?.ammo);

  // CoC7 normally spends ammunition before updating its ranged-combat card.
  // Only repair the value when it is still higher than the card's shot count
  // permits, so native consumption can never be applied twice.
  if (actualAmmo > expectedAmmo) {
    await weapon.update({ "system.ammo": expectedAmmo });
  } else {
    await refreshOpenKeeperSheets(weapon.parent?.uuid);
  }

  tracked.lastTotalBulletsFired = totalBulletsFired;
}

async function onCreateChatMessage(message) {
  const data = getRangedCardData(message);
  if (!data?.itemUuid) return;

  clearExpiredPending();
  const pending = pendingByWeapon.get(data.itemUuid);
  if (!pending) return;

  pendingByWeapon.delete(data.itemUuid);
  trackedMessages.set(message.id, {
    weaponUuid: data.itemUuid,
    initialAmmo: pending.initialAmmo,
    lastTotalBulletsFired: 0
  });

  await synchronizeTrackedMessage(message.id);
}

async function onUpdateChatMessage(message) {
  if (!trackedMessages.has(message.id)) return;
  await synchronizeTrackedMessage(message.id);
}

function onDeleteChatMessage(message) {
  trackedMessages.delete(message.id);
}

async function onUpdateItem(item, changes) {
  if (item.type !== "weapon" || !item.parent?.uuid) return;
  if (foundry.utils.getProperty(changes, "system.ammo") === undefined
    && foundry.utils.getProperty(changes, "system.bullets") === undefined) return;

  await refreshOpenKeeperSheets(item.parent.uuid);
}

export function trackRangedWeaponUse(weapon) {
  if (weapon?.type !== "weapon") return;
  if (!weapon.system?.properties?.rngd || weapon.system?.bullets === null) return;
  if (game.settings.get("CoC7", "disregardAmmo")) return;

  clearExpiredPending();
  pendingByWeapon.set(weapon.uuid, {
    initialAmmo: asAmmo(weapon.system.ammo),
    startedAt: Date.now()
  });
}

export function registerAmmoConsumptionHooks() {
  Hooks.on("createChatMessage", async (message) => {
    try {
      await onCreateChatMessage(message);
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to synchronize ammunition for a new CoC7 combat card.`, error);
    }
  });

  Hooks.on("updateChatMessage", async (message) => {
    try {
      await onUpdateChatMessage(message);
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to synchronize ammunition after a CoC7 attack.`, error);
    }
  });

  Hooks.on("deleteChatMessage", (message) => {
    try {
      onDeleteChatMessage(message);
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to clear ammunition card tracking.`, error);
    }
  });

  Hooks.on("updateItem", async (item, changes) => {
    try {
      await onUpdateItem(item, changes);
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to refresh the Keeper sheet after ammunition changed.`, error);
    }
  });
}
