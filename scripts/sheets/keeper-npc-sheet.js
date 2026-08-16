import { KEEPER_NPC_TEMPLATE_PATH, MODULE_ID } from "../constants.js";
import { submitNativeActorForm } from "../services/actor-form.js";
import { buildAttributeViewModels, buildCharacteristicViewModels } from "../services/character-view-data.js";
import {
  buildLegacySkillBaseUpdates,
  getEffectiveSkillValue,
  needsLegacyBaseRepair
} from "../services/skill-values.js";
import {
  buildInventoryViewModels,
  buildWeaponViewModels,
  enrichNpcText
} from "../services/npc-view-data.js";
import { rollWeaponDamage } from "../services/weapon-damage.js";
import { trackRangedWeaponUse } from "../services/ammo-consumption.js";
import {
  buildConditionViewModels,
  buildDocumentContextViewModel
} from "../services/condition-view-data.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const TAB_IDS = new Set(["skills", "combat", "inventory", "description", "keeper"]);


function isLocationActor(document) {
  const actorType = String(document.system.infos?.type ?? "").trim().toLowerCase();
  return actorType === "локация" || actorType === "location";
}

/**
 * Compact Keeper-facing NPC and creature sheet which stores all data in the native CoC7 Actor.
 */
export class GinzzzuCoC7KeeperNpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  gcksEditing = false;
  gcksActiveTab = "skills";
  gcksPreviousNonLocationType = null;
  #legacySkillRepairAttempted = false;
  #portraitObserver = null;
  #portraitUpdatePending = null;

  static DEFAULT_OPTIONS = {
    classes: ["coc7", "sheet", MODULE_ID, "gcks-window"],
    position: {
      width: 900,
      height: 720
    },
    form: {
      handler: submitNativeActorForm,
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  get title() {
    if (isLocationActor(this.document)) {
      return game.i18n.format(`${MODULE_ID}.WindowTitles.Location`, { name: this.document.name });
    }
    return super.title;
  }

  static PARTS = {
    body: {
      template: KEEPER_NPC_TEMPLATE_PATH,
      scrollable: [".gcks-scroll-region"]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const document = this.document;
    const isLocation = isLocationActor(document);
    const characteristics = buildCharacteristicViewModels(document);
    const attribs = buildAttributeViewModels(document);

    const skills = document.items
      .filter((item) => item.type === "skill")
      .sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang))
      .map((skill) => {
        const value = getEffectiveSkillValue(skill);
        return {
          id: skill.id,
          uuid: skill.uuid,
          name: skill.name,
          skillName: skill.system.skillName || skill.name,
          specialization: skill.system.specialization ?? "",
          isSpecialized: Boolean(skill.system.properties?.special),
          isCombat: Boolean(
            skill.system.properties?.fighting
            || skill.system.properties?.firearm
            || skill.system.properties?.ranged
          ),
          value,
          valueUnmodified: needsLegacyBaseRepair(skill)
            ? value
            : Number(skill.system.valueUnmodified ?? value),
          hard: Math.floor(value / 2),
          extreme: Math.floor(value / 5)
        };
      });

    const activeTab = TAB_IDS.has(this.gcksActiveTab) ? this.gcksActiveTab : "skills";
    const text = await enrichNpcText(document, this.isEditable);
    const tabs = {
      skills: { active: activeTab === "skills" },
      combat: { active: activeTab === "combat" },
      inventory: { active: activeTab === "inventory" },
      description: { active: activeTab === "description" },
      keeper: { active: activeTab === "keeper", visible: game.user.isGM }
    };
    const vitals = {
      hp: attribs.hp?.value !== null && attribs.hp?.value !== undefined,
      mp: attribs.mp?.value !== null && attribs.mp?.value !== undefined,
      san: attribs.san?.value !== null && attribs.san?.value !== undefined,
      lck: attribs.lck?.value !== null && attribs.lck?.value !== undefined
    };
    const vitalCount = Math.max(1, Object.values(vitals).filter(Boolean).length);
    const sanLoss = document.system.special?.sanLoss ?? {};
    const hasSanLoss = Boolean(sanLoss.checkPassed || sanLoss.checkFailled);

    return {
      ...context,
      document,
      actor: document,
      characteristics,
      attribs,
      gcks: {
        canEdit: this.isEditable,
        isEditing: this.isEditable && this.gcksEditing,
        isCreature: document.type === "creature",
        isLocation,
        canUseLocationMode: document.type === "npc" && this.isEditable,
        canViewKeeper: game.user.isGM,
        identityRole: document.system.infos?.occupation || document.system.infos?.type || "",
        vitals,
        vitalCount,
        hasSanLoss,
        sanLossPassed: sanLoss.checkPassed ?? "",
        sanLossFailed: sanLoss.checkFailled ?? "",
        activeTab,
        tabs,
        skills,
        weapons: buildWeaponViewModels(document),
        inventory: buildInventoryViewModels(document),
        attacksPerRound: document.system.special?.attacksPerRound ?? "1",
        enrichedPersonalDescription: text.personalDescription,
        enrichedKeeperDescription: text.keeperDescription,
        conditions: buildConditionViewModels(document),
        canToggleConditions: this.isEditable && (
          game.user.isGM || game.settings.get("CoC7", "statusPlayerEditable")
        ),
        documentContext: buildDocumentContextViewModel(document)
      }
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const isCreature = this.document.type === "creature";
    const isLocation = isLocationActor(this.document);
    const isKeeperNpc = this.document.type === "npc" && !isLocation;
    this.element.classList.toggle("npc", !isCreature);
    this.element.classList.toggle("creature", isCreature);
    this.element.classList.toggle("gcks-npc-window", isKeeperNpc);
    this.element.classList.toggle("gcks-creature-window", isCreature);
    this.element.classList.toggle("gcks-location-window", isLocation);

    this.#listen("[data-action=\"gcks-toggle-edit\"]", "click", this.#onToggleEdit);
    this.#listen("[data-action=\"gcks-toggle-location-mode\"]", "change", this.#onToggleLocationMode);
    this.#listen("[data-action=\"gcks-select-tab\"]", "click", this.#onSelectTab);
    this.#listen(".characteristic-name.rollable", "click", this.#onCharacteristicRoll);
    this.#listen(".attribute-name.rollable", "click", this.#onAttributeRoll);
    this.#listen("[data-action=\"gcks-adjust-vital\"]", "click", this.#onAdjustVital);
    this.#listen(".skill-name.rollable", "click", this.#onSkillRoll);
    this.#listen(".skill-name:not(.rollable)", "change", this.#onSkillNameChange);
    this.#listen(".npc-skill-score", "change", this.#onSkillValueChange);
    this.#listen("[data-action=\"gcks-weapon-roll\"]", "click", this.#onWeaponRoll);
    this.#listen("[data-action=\"gcks-weapon-skill-roll\"]", "click", this.#onWeaponSkillRoll);
    this.#listen("[data-action=\"gcks-weapon-damage-roll\"]", "click", this.#onWeaponDamageRoll);
    this.#listen("[data-action=\"gcks-weapon-ammo-change\"]", "change", this.#onWeaponAmmoChange);
    this.#listen("[data-action=\"gcks-toggle-condition\"]", "click", this.#onToggleCondition);
    this.#listen("[data-action=\"item-add\"]", "click", this.#onItemAdd);
    this.#listen("[data-action=\"item-edit\"]", "click", this.#onItemEdit);
    this.#listen("[data-action=\"item-delete\"]", "click", this.#onItemDelete);
    this.#observePortraitSelection();

    queueMicrotask(() => void this.#repairLegacySkillBases());
  }

  async #repairLegacySkillBases() {
    if (this.#legacySkillRepairAttempted || !this.isEditable || isLocationActor(this.document)) return;
    this.#legacySkillRepairAttempted = true;

    const updates = buildLegacySkillBaseUpdates(this.document);
    if (!updates.length) return;

    try {
      await this.document.updateEmbeddedDocuments("Item", updates, { render: false });
      console.info(`${MODULE_ID} | Repaired ${updates.length} imported Actor skill base value(s) for ${this.document.name}.`);
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to repair imported Actor skill values.`, error);
    }
  }

  #listen(selector, eventName, handler) {
    this.element.querySelectorAll(selector).forEach((element) => {
      element.addEventListener(eventName, async (event) => {
        try {
          await handler.call(this, event);
        } catch (error) {
          console.error(`${MODULE_ID} | Keeper sheet action failed.`, error);
        }
      });
    });
  }

  async #onToggleEdit(event) {
    event.preventDefault();

    if (this.gcksEditing) await this.#persistPortraitFromCurrentMarkup();
    this.gcksEditing = !this.gcksEditing;
    await this.render({ parts: ["body"] });
  }

  async #onToggleLocationMode(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!(this.isEditable && this.document.type === "npc" && this.gcksEditing)) return;

    const enableLocation = event.currentTarget.checked;
    const currentType = String(this.document.system.infos?.type ?? "").trim();
    if (enableLocation && !isLocationActor(this.document)) {
      this.gcksPreviousNonLocationType = currentType || null;
    }

    const nextType = enableLocation
      ? game.i18n.localize(`${MODULE_ID}.Values.LocationType`)
      : this.gcksPreviousNonLocationType
        || game.i18n.localize(`${MODULE_ID}.Values.CharacterType`);

    try {
      await this.document.update({ "system.infos.type": nextType }, { render: false });
      await this.render({ force: true });
    } catch (error) {
      event.currentTarget.checked = !enableLocation;
      console.error(`${MODULE_ID} | Failed to change the sheet location mode.`, error);
    }
  }

  #observePortraitSelection() {
    this.#portraitObserver?.disconnect();
    this.#portraitObserver = null;

    if (!(this.isEditable && this.gcksEditing)) return;
    const portrait = this.element.querySelector(".gcks-portrait");
    if (!portrait) return;

    this.#portraitObserver = new MutationObserver(() => {
      const selectedPath = this.#getPortraitPathFromMarkup();
      if (!selectedPath || selectedPath === this.document.img) return;
      void this.#persistPortrait(selectedPath);
    });
    this.#portraitObserver.observe(portrait, { attributes: true, attributeFilter: ["src"] });
  }

  #getPortraitPathFromMarkup() {
    const inputValue = this.element.querySelector(".gcks-portrait-path")?.value?.trim();
    if (inputValue && inputValue !== this.document.img) return inputValue;

    const imageValue = this.element.querySelector(".gcks-portrait")?.getAttribute("src")?.trim();
    if (!imageValue || imageValue === this.document.img || imageValue.startsWith("data:")) return null;
    return imageValue;
  }

  async #persistPortraitFromCurrentMarkup() {
    const selectedPath = this.#getPortraitPathFromMarkup();
    if (!selectedPath || selectedPath === this.document.img) return;
    await this.#persistPortrait(selectedPath);
  }

  async #persistPortrait(selectedPath) {
    if (!this.isEditable || !selectedPath || selectedPath === this.document.img) return;
    if (this.#portraitUpdatePending === selectedPath) return;

    this.#portraitUpdatePending = selectedPath;
    try {
      await this.document.update({ img: selectedPath });
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to save the Actor portrait.`, error);
    } finally {
      if (this.#portraitUpdatePending === selectedPath) this.#portraitUpdatePending = null;
    }
  }

  async #onSelectTab(event) {
    event.preventDefault();
    const tabId = event.currentTarget.dataset.tab;
    if (!TAB_IDS.has(tabId)) return;
    if (tabId === "keeper" && !game.user.isGM) return;
    this.gcksActiveTab = tabId;
    await this.render({ parts: ["body"] });
  }

  async #onCharacteristicRoll(event) {
    event.preventDefault();
    const key = event.currentTarget.closest(".attribute")?.dataset.characteristic;
    if (!key) return;
    await this.document.characteristicCheck(key, event.shiftKey);
  }

  async #onAttributeRoll(event) {
    event.preventDefault();
    const key = event.currentTarget.closest(".attribute")?.dataset.attrib;
    if (!key) return;

    if (key === "db") {
      const roll = await new Roll(
        this.document.system.attribs.db.value.toString(),
        this.document.parsedValues()
      ).roll();
      if (!roll.isDeterministic) {
        await roll.toMessage({
          flavor: game.i18n.localize("CoC7.BonusDamageRoll"),
          speaker: ChatMessage.getSpeaker({ actor: this.document })
        });
      }
      return;
    }

    await this.document.attributeCheck(key, event.shiftKey);
  }

  async #onAdjustVital(event) {
    event.preventDefault();
    if (!this.isEditable || this.gcksEditing) return;

    const key = event.currentTarget.dataset.attrib;
    if (!["hp", "mp", "lck", "san"].includes(key)) return;

    const direction = Number.parseInt(event.currentTarget.dataset.delta ?? "0", 10);
    if (!Number.isFinite(direction) || direction === 0) return;

    const step = event.shiftKey ? 5 : 1;
    const current = Number(this.document.system.attribs?.[key]?.value ?? 0);
    if (!Number.isFinite(current)) return;
    const next = current + direction * step;

    if (key === "hp") {
      if (typeof this.document.setHp !== "function") return;
      await this.document.setHp(next);
    } else if (key === "san") {
      if (typeof this.document.setSan !== "function") return;
      await this.document.setSan(next);
    } else if (key === "lck") {
      if (typeof this.document.setLuck !== "function") return;
      await this.document.setLuck(Math.max(0, next));
    } else {
      const maximum = Number(this.document.system.attribs?.mp?.max);
      const upper = Number.isFinite(maximum) && maximum >= 0 ? maximum : 99;
      const clamped = Math.min(upper, Math.max(0, next));
      await this.document.update({ "system.attribs.mp.value": clamped }, { render: false });
    }

    await this.render({ parts: ["body"] });
  }

  async #onSkillRoll(event) {
    event.preventDefault();
    const itemUuid = event.currentTarget.closest(".item")?.dataset.itemUuid;
    const skill = itemUuid ? await fromUuid(itemUuid) : null;
    if (!skill) return;
    await this.document.skillCheck({ name: skill.name }, event.shiftKey);
  }

  async #onWeaponRoll(event) {
    event.preventDefault();
    const itemUuid = event.currentTarget.closest(".item")?.dataset.itemUuid;
    const weapon = itemUuid ? await fromUuid(itemUuid) : null;
    if (!weapon || weapon.type !== "weapon") return;

    const tracksAmmo = Boolean(weapon.system?.properties?.rngd) && weapon.system?.bullets !== null;
    const disregardsAmmo = game.settings.get("CoC7", "disregardAmmo");
    const currentAmmo = Number.parseInt(weapon.system?.ammo ?? 0, 10);
    if (tracksAmmo && !disregardsAmmo && currentAmmo <= 0) {
      ui.notifications.warn(
        game.i18n.format(`${MODULE_ID}.Notifications.NoAmmo`, { weapon: weapon.name })
      );
      return;
    }

    // Record the native ammo state before CoC7 creates its ranged-combat card.
    // The synchronization service only repairs a missing update and therefore
    // cannot double-spend ammunition when the system handles it correctly.
    trackRangedWeaponUse(weapon);
    await this.document.weaponCheck({ uuid: weapon.uuid }, event.shiftKey);
  }

  async #onWeaponSkillRoll(event) {
    event.preventDefault();
    const skillUuid = event.currentTarget.dataset.skillUuid;
    const skill = skillUuid ? await fromUuid(skillUuid) : null;
    if (!skill) return;
    await this.document.skillCheck({ name: skill.name }, event.shiftKey);
  }

  async #onWeaponDamageRoll(event) {
    event.preventDefault();
    const itemUuid = event.currentTarget.closest(".item")?.dataset.itemUuid;
    const weapon = itemUuid ? await fromUuid(itemUuid) : null;
    if (!weapon || weapon.type !== "weapon") return;

    const rangeKey = event.currentTarget.dataset.damageRange || "normal";
    await rollWeaponDamage(this.document, weapon, rangeKey);
  }

  async #onToggleCondition(event) {
    event.preventDefault();
    if (!(this.isEditable && (game.user.isGM || game.settings.get("CoC7", "statusPlayerEditable")))) return;

    const condition = event.currentTarget.dataset.condition;
    if (!this.document.system.conditions?.[condition]) return;

    await this.document.toggleCondition(condition);
    await this.render({ parts: ["body"] });
  }

  async #onWeaponAmmoChange(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isEditable) return;

    const field = event.currentTarget.dataset.ammoField;
    if (!["ammo", "bullets"].includes(field)) return;

    const itemUuid = event.currentTarget.closest(".item")?.dataset.itemUuid;
    const weapon = itemUuid ? await fromUuid(itemUuid) : null;
    if (!weapon || weapon.type !== "weapon") return;

    const rawValue = event.currentTarget.value.trim();
    const value = rawValue === "" ? null : Number.parseInt(rawValue, 10);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      event.currentTarget.value = weapon.system?.[field] ?? "";
      return;
    }

    await weapon.update({ [`system.${field}`]: value });
  }

  async #onSkillNameChange(event) {
    event.preventDefault();
    const itemUuid = event.currentTarget.closest(".item")?.dataset.itemUuid;
    const value = event.currentTarget.value.trim();
    const skill = itemUuid ? await fromUuid(itemUuid) : null;
    if (!value || !skill) return;

    const parts = skill.system.constructor.guessNameParts(value);
    if (!parts.system.properties.special && skill.system.properties.special) {
      const specializedParts = skill.system.constructor.getNamePartsSpec(value, skill.system.specialization);
      await skill.update({
        name: specializedParts.name,
        system: {
          skillName: specializedParts.system.skillName,
          specialization: specializedParts.system.specialization
        }
      });
      return;
    }

    await skill.update({
      name: parts.name,
      system: {
        properties: { special: parts.system.properties.special },
        skillName: parts.system.skillName,
        specialization: parts.system.specialization
      }
    });
  }

  async #onSkillValueChange(event) {
    event.preventDefault();
    const value = Number.parseInt(event.currentTarget.value, 10);
    if (!Number.isFinite(value)) return;

    const itemUuid = event.currentTarget.closest(".item")?.dataset.itemUuid;
    const skill = itemUuid ? await fromUuid(itemUuid) : null;
    if (!skill) return;

    const difference = value - getEffectiveSkillValue(skill);
    if (difference === 0) return;
    await skill.update({
      "system.adjustments.experience": Number(skill.system.adjustments?.experience ?? 0) + difference
    });
  }

  async #onItemAdd(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;
    const creators = {
      item: "createEmptyItem",
      skill: "createEmptySkill",
      weapon: "createEmptyWeapon"
    };
    const methodName = creators[type];
    if (!methodName || typeof this.document[methodName] !== "function") return;

    const created = await this.document[methodName](event);
    if (created?.[0]) await created[0].sheet.render({ force: true });
  }

  async #onItemEdit(event) {
    event.preventDefault();
    const itemUuid = event.currentTarget.closest(".item")?.dataset.itemUuid;
    const item = itemUuid ? await fromUuid(itemUuid) : null;
    await item?.sheet.render({ force: true });
  }

  async #onItemDelete(event) {
    event.preventDefault();
    const itemUuid = event.currentTarget.closest(".item")?.dataset.itemUuid;
    const item = itemUuid ? await fromUuid(itemUuid) : null;
    await item?.delete();
  }
}
