import { MODULE_ID, SETTINGS } from "../constants.js";

/**
 * Register module settings for automatic skill development tracking.
 */
export function registerSkillDevelopmentSettings() {
  game.settings.register(MODULE_ID, SETTINGS.AUTO_DEVELOPMENT, {
    name: `${MODULE_ID}.Settings.AutoDevelopment.Name`,
    hint: `${MODULE_ID}.Settings.AutoDevelopment.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.ALLOW_LUCK_DEVELOPMENT, {
    name: `${MODULE_ID}.Settings.AllowLuckDevelopment.Name`,
    hint: `${MODULE_ID}.Settings.AllowLuckDevelopment.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
}

/**
 * Check if the current client is the lead active GM.
 * Ensures only one GM performs authoritative updates in multiplayer.
 * @returns {boolean}
 */
function isLeadGM() {
  if (!game.user.isGM) return false;
  const activeGMs = game.users.filter((u) => u.isGM && u.active).sort((a, b) => a.id.localeCompare(b.id));
  return activeGMs.length === 0 || activeGMs[0]?.id === game.user.id;
}

/**
 * Resolve an Actor Document from a given UUID string.
 * @param {string} uuid
 * @returns {Promise<Actor|null>}
 */
async function resolveActor(uuid) {
  if (!uuid || typeof uuid !== "string") return null;
  try {
    const doc = await fromUuid(uuid);
    if (!doc) return null;
    if (doc.documentName === "Actor" || doc instanceof foundry.documents.BaseActor) {
      return doc;
    }
    if (doc.actor) {
      return doc.actor;
    }
    return null;
  } catch (_error) {
    return null;
  }
}

/**
 * Resolve an Item Document from a given UUID or ID string, optionally searching within an Actor.
 * @param {string} identifier
 * @param {Actor|null} [actor]
 * @returns {Promise<Item|null>}
 */
async function resolveItem(identifier, actor = null) {
  if (!identifier || typeof identifier !== "string") return null;
  try {
    const doc = await fromUuid(identifier);
    if (doc?.documentName === "Item" || doc instanceof foundry.documents.BaseItem) {
      return doc;
    }
  } catch (_error) {
    // Continue to actor lookup
  }

  if (actor?.items) {
    return actor.items.get(identifier)
      ?? actor.items.find((i) => i.uuid === identifier || i.id === identifier || i.name === identifier)
      ?? null;
  }

  return null;
}

/**
 * Check if the current client is designated to process this message.
 * Ensures exactly one active client performs database writes in multiplayer.
 * The lead active GM takes precedence; if no GM is online, the message author executes.
 * @param {ChatMessage} message
 * @param {boolean} [forceProcess]
 * @returns {boolean}
 */
function shouldProcessMessage(message, forceProcess = false) {
  if (game.settings.get("CoC7", "xpEnabled") === false) return false;
  if (game.settings.get(MODULE_ID, SETTINGS.AUTO_DEVELOPMENT) === false) return false;
  if (forceProcess) return true;

  // Active GM always processes if online, providing authoritative execution
  const hasActiveGM = game.users.some((user) => user.isGM && user.active);
  if (hasActiveGM) {
    return isLeadGM();
  }

  // If no GM is active in the world, the message author processes
  return Boolean(message.isAuthor);
}

/**
 * Calculate the total rolled from a CoC7 dicePool descriptor.
 * @param {object} dicePool
 * @returns {number|null}
 */
function calculateDicePoolTotal(dicePool) {
  const rolled = Array.isArray(dicePool?.rolledDice)
    ? ([...dicePool.rolledDice].reverse().find((r) => r?.rolled) ?? dicePool.rolledDice[dicePool.rolledDice.length - 1])
    : null;
  if (!rolled) return null;

  const baseDie = Number(rolled.baseDie) || 0;
  const unitDie = Number(rolled.unitDie) === 10 ? 0 : (Number(rolled.unitDie) || 0);
  const poolModifier = Number(dicePool.currentPoolModifier ?? 0);
  const bonusDice = Array.isArray(rolled.bonusDice) ? rolled.bonusDice : [];
  const penaltyDice = Array.isArray(rolled.penaltyDice) ? rolled.penaltyDice : [];

  const decaders = [baseDie];
  if (poolModifier < 0) {
    decaders.push(...penaltyDice.slice(0, Math.abs(poolModifier)));
  } else if (poolModifier > 0) {
    decaders.push(...bonusDice.slice(0, poolModifier));
  }

  const values = decaders.map((value) => {
    const decader = value === 10 ? 0 : value * 10;
    return decader === 0 && unitDie === 0 ? 100 : decader + unitDie;
  });

  const rawTotal = poolModifier < 0 ? Math.max(...values) : Math.min(...values);
  const flatModifier = Number(dicePool.flatDiceModifier ?? 0);
  const luckSpent = Number(dicePool.luckSpent ?? 0);

  return Math.max(1, Math.min(100, rawTotal + flatModifier - luckSpent));
}

/**
 * Check whether a dicePool represents a successful check.
 * Checks both HTML render classes and dicePool values for complete robustness.
 * @param {object} dicePool
 * @param {string} [content]
 * @returns {boolean}
 */
function isRollSuccess(dicePool, content = "") {
  if (typeof dicePool?.setSuccess === "boolean") return dicePool.setSuccess;
  if (typeof dicePool?.isSuccess === "boolean" && dicePool.isSuccess) return true;
  if (typeof dicePool?.isRolledSuccess === "boolean" && dicePool.isRolledSuccess) return true;

  // Inspect CoC7 chat template output classes
  if (typeof content === "string" && content.length > 0) {
    if (content.includes("success-regular") ||
        content.includes("success-hard") ||
        content.includes("success-extreme") ||
        content.includes("dice-formula critical") ||
        content.includes("dice-formula success")) {
      return true;
    }
    if (content.includes("dice-formula failure") ||
        content.includes("dice-formula fumble") ||
        content.includes("dice-total failure") ||
        content.includes("dice-total fumble")) {
      return false;
    }
  }

  // Mathematical fallback based on threshold and difficulty
  const total = calculateDicePoolTotal(dicePool);
  if (total === null) return false;

  const threshold = Number(dicePool.threshold);
  if (!Number.isFinite(threshold) || threshold <= 0) return false;

  const flatThreshold = Number(dicePool.flatThresholdModifier ?? 0);
  const regular = threshold + flatThreshold;
  const difficulty = Number(dicePool.difficulty ?? 1);

  if (total === 1) return true;

  const fumbleThreshold = regular < 50 ? 96 : 100;
  if (total >= fumbleThreshold) return false;

  let target = regular;
  if (difficulty === 2) target = Math.floor(regular / 2); // Hard
  else if (difficulty === 3) target = Math.floor(regular / 5); // Extreme
  else if (difficulty === 4) target = 1; // Critical

  return total <= target;
}

/**
 * Mark a skill Item for development if valid and not already marked.
 * Re-renders any open sheets for the parent actor.
 * @param {Item} skill
 * @returns {Promise<boolean>}
 */
async function markSkillForDevelopment(skill) {
  if (!skill || skill.type !== "skill") return false;
  if (skill.system?.properties?.noxpgain) return false;
  if (skill.system?.flags?.developement) return false;

  await skill.update({ "system.flags.developement": true });
  console.info(`${MODULE_ID} | Marked skill for development: "${skill.name}" on ${skill.parent?.name ?? "actor"}`);

  const actor = skill.parent;
  if (actor) {
    if (typeof actor.render === "function") {
      actor.render(false);
    }
    for (const app of Object.values(ui.windows ?? {})) {
      if (app.document?.uuid === actor.uuid && typeof app.render === "function") {
        app.render(false);
      }
    }
    if (foundry?.applications?.instances) {
      for (const app of foundry.applications.instances.values()) {
        if (app.document?.uuid === actor.uuid && typeof app.render === "function") {
          app.render({ parts: ["body"] });
        }
      }
    }
  }

  return true;
}

/**
 * Resolve the target skill Item from a CoC7Check load descriptor.
 * In CoC7Check, load.key holds the item/skill UUID.
 * @param {object} load
 * @returns {Promise<Item|null>}
 */
async function resolveSkillFromCheck(load) {
  const itemIdentifier = load.key ?? load.itemUuid;
  if (!itemIdentifier) return null;

  const actor = load.actorUuid ? await resolveActor(load.actorUuid) : null;
  let item = await resolveItem(itemIdentifier, actor);
  if (!item) return null;

  // If the check was rolled through a weapon, resolve the main skill associated with that weapon
  if (item.type === "weapon") {
    const resolvedActor = actor ?? item.actor;
    const skillId = item.system?.skill?.main?.id;
    if (skillId && resolvedActor) {
      const skill = await resolveItem(skillId, resolvedActor);
      if (skill && skill.type === "skill") return skill;
    }
    const altSkillId = item.system?.skill?.alternativ?.id;
    if (altSkillId && resolvedActor) {
      const altSkill = await resolveItem(altSkillId, resolvedActor);
      if (altSkill && altSkill.type === "skill") return altSkill;
    }
  }

  if (item.type === "skill") {
    return item;
  }

  return null;
}

/**
 * Process standard skill/weapon checks (CoC7Check).
 * @param {ChatMessage} message
 * @param {object} load
 * @param {object} options
 */
async function processCoC7Check(message, load, options) {
  const dicePool = load.dicePool;
  if (!dicePool) return;

  const isPushed = Boolean(
    load.cardType === "C/PU" ||
    load.cardType === "push" ||
    (Array.isArray(dicePool.rolledDice) && dicePool.rolledDice.length > 1)
  );

  const isSuccess = isRollSuccess(dicePool, message.content);
  const luckSpent = Number(dicePool.luckSpent ?? 0);

  if (!isSuccess) return;
  if (isPushed) return;
  if (!options.allowLuck && luckSpent > 0) return;

  const skill = await resolveSkillFromCheck(load);
  if (skill) {
    await markSkillForDevelopment(skill);
  }
}

/**
 * Process combined checks (CoC7ChatCombinedMessage).
 * Fixes native CoC7 omission where development is only checked on manual card toggle.
 * @param {ChatMessage} message
 * @param {object} load
 * @param {object} options
 */
async function processCoC7Combined(message, load, options) {
  const actorRolls = load.actorRolls;
  if (!actorRolls || typeof actorRolls !== "object") return;

  for (const [actorKey, rollGroup] of Object.entries(actorRolls)) {
    const actorUuid = actorKey.replace(/\//g, ".");
    const actor = await resolveActor(actorUuid);

    const rolls = Array.isArray(rollGroup?.rolls) ? rollGroup.rolls : [];
    for (const roll of rolls) {
      if (roll.type !== "skill") continue;
      const skillKey = roll.key ?? roll.uuid;
      if (!skillKey) continue;

      const skill = await resolveItem(skillKey, actor);
      if (!skill || skill.type !== "skill") continue;

      const dicePool = roll.dicePool ?? rollGroup.dicePool;
      const isSuccess = isRollSuccess(dicePool, message.content);
      const isPushed = Boolean(dicePool?.rolledDice?.length > 1);
      const luckSpent = Number(dicePool?.luckSpent ?? 0);

      if (isSuccess && !isPushed && (options.allowLuck || luckSpent === 0)) {
        await markSkillForDevelopment(skill);
      }
    }
  }
}

/**
 * Process melee combat checks (CoC7ChatCombatMelee).
 * @param {ChatMessage} message
 * @param {object} load
 * @param {object} options
 */
async function processCoC7Melee(message, load, options) {
  const dicePool = load.dicePool;
  if (!dicePool) return;

  const isSuccess = isRollSuccess(dicePool, message.content);
  const luckSpent = Number(dicePool.luckSpent ?? 0);

  if (!isSuccess) return;
  if (!options.allowLuck && luckSpent > 0) return;

  const itemUuid = load.itemUuid;
  if (!itemUuid) return;

  const actorUuid = load.participant === 1 ? load.targetUuid : load.attackerUuid;
  const actor = await resolveActor(actorUuid);
  const item = await resolveItem(itemUuid, actor);

  let skill = null;
  if (item?.type === "skill") {
    skill = item;
  } else if (item?.type === "weapon") {
    const skillId = item.system?.skill?.main?.id;
    skill = await resolveItem(skillId, actor);
  }

  if (skill && skill.type === "skill") {
    await markSkillForDevelopment(skill);
  }
}

/**
 * Process ranged combat checks (CoC7ChatCombatRanged).
 * @param {ChatMessage} message
 * @param {object} load
 * @param {object} options
 */
async function processCoC7Ranged(message, load, options) {
  const shots = Array.isArray(load.shots) ? load.shots : [];
  const anySuccess = shots.some((shot) => isRollSuccess(shot.dicePool, message.content));
  if (!anySuccess) return;

  const weaponUuid = load.itemUuid;
  const actorUuid = load.actorUuid;
  const actor = await resolveActor(actorUuid);
  const weapon = await resolveItem(weaponUuid, actor);

  const skillId = weapon?.system?.skill?.main?.id;
  const skill = await resolveItem(skillId, actor);
  if (skill && skill.type === "skill") {
    await markSkillForDevelopment(skill);
  }
}

/**
 * Process opposed checks (CoC7ChatOpposedMessage).
 * @param {ChatMessage} message
 * @param {object} load
 * @param {object} options
 */
async function processCoC7Opposed(message, load, options) {
  const actorRolls = load.actorRolls;
  if (!actorRolls || typeof actorRolls !== "object") return;

  for (const [actorKey, rollGroup] of Object.entries(actorRolls)) {
    const actorUuid = actorKey.replace(/\//g, ".");
    const actor = await resolveActor(actorUuid);

    const rolls = Array.isArray(rollGroup?.rolls) ? rollGroup.rolls : [];
    for (const roll of rolls) {
      const skillUuid = roll.skillUuid ?? (roll.type === "skill" ? roll.key : null);
      if (!skillUuid) continue;

      const skill = await resolveItem(skillUuid, actor);
      if (!skill || skill.type !== "skill") continue;

      const dicePool = roll.dicePool ?? rollGroup.dicePool;
      const isSuccess = isRollSuccess(dicePool, message.content);
      const luckSpent = Number(dicePool?.luckSpent ?? 0);

      if (isSuccess && (options.allowLuck || luckSpent === 0)) {
        await markSkillForDevelopment(skill);
      }
    }
  }
}

/**
 * Main dispatcher for chat messages containing CoC7 rolls.
 * @param {ChatMessage} message
 * @param {object} [options]
 * @param {boolean} [options.forceProcess]
 */
async function onChatMessage(message, { forceProcess = false } = {}) {
  if (!shouldProcessMessage(message, forceProcess)) return;

  const load = message.flags?.CoC7?.load;
  if (!load || typeof load.as !== "string") return;

  const allowLuck = Boolean(game.settings.get(MODULE_ID, SETTINGS.ALLOW_LUCK_DEVELOPMENT));
  const options = { allowLuck };

  switch (load.as) {
    case "CoC7Check":
      await processCoC7Check(message, load, options);
      break;
    case "CoC7ChatCombinedMessage":
      await processCoC7Combined(message, load, options);
      break;
    case "CoC7ChatCombatMelee":
      await processCoC7Melee(message, load, options);
      break;
    case "CoC7ChatCombatRanged":
      await processCoC7Ranged(message, load, options);
      break;
    case "CoC7ChatOpposedMessage":
      await processCoC7Opposed(message, load, options);
      break;
  }
}

/**
 * Scan recent chat messages on world load to catch any rolls that occurred recently.
 * @param {number} [limit]
 */
async function catchUpRecentMessages(limit = 30) {
  if (!isLeadGM()) return;
  if (game.settings.get("CoC7", "xpEnabled") === false) return;
  if (game.settings.get(MODULE_ID, SETTINGS.AUTO_DEVELOPMENT) === false) return;

  const messages = game.messages.contents.slice(-limit);
  console.info(`${MODULE_ID} | Catching up ${messages.length} recent chat messages for skill development.`);
  for (const message of messages) {
    try {
      await onChatMessage(message, { forceProcess: true });
    } catch (_error) {
      // Non-fatal catch-up error
    }
  }
}

/**
 * Register Foundry hooks for automatic skill development evaluation.
 */
export function registerSkillDevelopmentHooks() {
  registerSkillDevelopmentSettings();

  Hooks.on("createChatMessage", async (message) => {
    try {
      await onChatMessage(message);
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to evaluate skill development on createChatMessage.`, error);
    }
  });

  Hooks.on("updateChatMessage", async (message) => {
    try {
      await onChatMessage(message);
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to evaluate skill development on updateChatMessage.`, error);
    }
  });

  Hooks.once("ready", async () => {
    try {
      await catchUpRecentMessages(30);
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to catch up recent chat messages for skill development.`, error);
    }
  });
}
