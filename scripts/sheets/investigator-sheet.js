import { INVESTIGATOR_TEMPLATE_PATH, MODULE_ID } from "../constants.js";
import { submitNativeActorForm } from "../services/actor-form.js";
import {
  buildAttributeViewModels,
  buildCharacteristicViewModels,
  buildInvestigatorIdentity
} from "../services/character-view-data.js";
import {
  buildConditionViewModels,
  buildDocumentContextViewModel
} from "../services/condition-view-data.js";
import { buildInvestigatorSkillView } from "../services/investigator-skill-view-data.js";
import { buildInvestigatorInventoryView } from "../services/investigator-inventory-view-data.js";
import { buildInvestigatorBiographyView } from "../services/investigator-biography-view-data.js";
import { buildInvestigatorDevelopmentView } from "../services/investigator-development-view-data.js";
import { buildWeaponViewModels } from "../services/npc-view-data.js";
import { rollWeaponDamage } from "../services/weapon-damage.js";
import { trackRangedWeaponUse } from "../services/ammo-consumption.js";
import {
  buildPlayerHudCreationView,
  openPlayerHudCreation
} from "../services/player-hud-integration.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const TAB_IDS = new Set(["characteristics", "skills", "combat", "possessions", "biography", "development", "keeper"]);
const SKILL_ADJUSTMENTS = new Set([
  "personal",
  "occupation",
  "archetype",
  "experiencePackage",
  "experience"
]);

/**
 * Player-facing investigator sheet backed entirely by the native CoC7 character Actor.
 */
export class GinzzzuCoC7InvestigatorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  gciActiveTab = "characteristics";
  gciSkillFilter = "all";
  gciSkillSearch = "";
  #portraitObserver = null;
  #portraitUpdatePending = null;
  #skillSearchRenderTimer = null;
  #skillSearchFocusState = null;

  static DEFAULT_OPTIONS = {
    classes: ["coc7", "sheet", MODULE_ID, "gci-window"],
    position: {
      width: 940,
      height: 720
    },
    form: {
      handler: submitNativeActorForm,
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    body: {
      template: INVESTIGATOR_TEMPLATE_PATH,
      scrollable: [".gci-scroll-region"]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const document = this.document;
    const attribs = buildAttributeViewModels(document);
    const characteristics = buildCharacteristicViewModels(document);
    const isEditing = this.isEditable && !document.system.flags?.locked;
    const isKeeper = game.user.isGM;
    const requestedTab = TAB_IDS.has(this.gciActiveTab) ? this.gciActiveTab : "characteristics";
    const activeTab = requestedTab === "keeper" && !isKeeper ? "characteristics" : requestedTab;
    const biographyView = await buildInvestigatorBiographyView(document, { isKeeper });

    return {
      ...context,
      document,
      actor: document,
      characteristics,
      attribs,
      gci: {
        canEdit: this.isEditable,
        isEditing,
        activeTab,
        tabs: {
          characteristics: { active: activeTab === "characteristics" },
          skills: { active: activeTab === "skills" },
          combat: { active: activeTab === "combat" },
          possessions: { active: activeTab === "possessions" },
          biography: { active: activeTab === "biography" },
          development: { active: activeTab === "development" },
          keeper: { active: activeTab === "keeper" }
        },
        identity: buildInvestigatorIdentity(document),
        conditions: buildConditionViewModels(document),
        skills: buildInvestigatorSkillView(document, {
          filter: this.gciSkillFilter,
          search: this.gciSkillSearch
        }),
        weapons: buildWeaponViewModels(document),
        inventory: buildInvestigatorInventoryView(document, { isEditing, isKeeper }),
        biography: biographyView.biography,
        development: buildInvestigatorDevelopmentView(document),
        keeper: biographyView.keeper,
        isKeeper,
        canToggleConditions: this.isEditable && (
          game.user.isGM || game.settings.get("CoC7", "statusPlayerEditable")
        ),
        documentContext: buildDocumentContextViewModel(document),
        creationAssistant: buildPlayerHudCreationView(document)
      }
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.element.classList.add("character", "gci-character-window");
    this.#listen("[data-action=\"gci-toggle-edit\"]", "click", this.#onToggleEdit);
    this.#listen("[data-action=\"gci-open-creation\"]", "click", this.#onOpenCreation);
    this.#listen("[data-action=\"gci-select-tab\"]", "click", this.#onSelectTab);
    this.#listen(".gci-characteristic-roll", "click", this.#onCharacteristicRoll);
    this.#listen(".gci-attribute-roll", "click", this.#onAttributeRoll);
    this.#listen("[data-action=\"gci-toggle-condition\"]", "click", this.#onToggleCondition);
    this.#listen("[data-action=\"gci-skill-filter\"]", "click", this.#onSkillFilter);
    this.#listen("[data-action=\"gci-skill-search\"]", "input", this.#onSkillSearch);
    this.#listen("[data-action=\"gci-skill-roll\"]", "click", this.#onSkillRoll);
    this.#listen("[data-action=\"gci-toggle-development\"]", "click", this.#onToggleDevelopment);
    this.#listen("[data-action=\"gci-skill-adjustment\"]", "change", this.#onSkillAdjustmentChange);
    this.#listen("[data-action=\"gci-toggle-occupation-skill\"]", "click", this.#onToggleOccupationSkill);
    this.#listen("[data-action=\"gci-edit-skill\"]", "click", this.#onEditSkill);
    this.#listen("[data-action=\"gci-add-skill\"]", "click", this.#onAddSkill);
    this.#listen("[data-action=\"gci-adjust-vital\"]", "click", this.#onAdjustVital);
    this.#listen("[data-action=\"gci-weapon-roll\"]", "click", this.#onWeaponRoll);
    this.#listen("[data-action=\"gci-weapon-skill-roll\"]", "click", this.#onWeaponSkillRoll);
    this.#listen("[data-action=\"gci-weapon-damage-roll\"]", "click", this.#onWeaponDamageRoll);
    this.#listen("[data-action=\"gci-reload-weapon\"]", "click", this.#onReloadWeapon);
    this.#listen("[data-action=\"gci-reload-weapon\"]", "contextmenu", this.#onReloadWeapon);
    this.#listen("[data-action=\"gci-add-weapon\"]", "click", this.#onAddWeapon);
    this.#listen("[data-action=\"gci-edit-weapon\"]", "click", this.#onEditWeapon);
    this.#listen("[data-action=\"gci-delete-weapon\"]", "click", this.#onDeleteWeapon);
    this.#listen("[data-action=\"gci-open-item\"]", "click", this.#onOpenInventoryItem);
    this.#listen("[data-action=\"gci-add-item\"]", "click", this.#onAddInventoryItem);
    this.#listen("[data-action=\"gci-delete-item\"]", "click", this.#onDeleteInventoryItem);
    this.#listen("[data-action=\"gci-toggle-manual-credit\"]", "click", this.#onToggleManualCredit);
    this.#listen("[data-action=\"gci-biography-add\"]", "click", this.#onBiographyAdd);
    this.#listen("[data-action=\"gci-biography-move\"]", "click", this.#onBiographyMove);
    this.#listen("[data-action=\"gci-biography-remove\"]", "click", this.#onBiographyRemove);
    this.#listen("[data-action=\"gci-reset-daily-sanity\"]", "click", this.#onResetDailySanity);
    this.#listen("[data-action=\"gci-sanity-event-add\"]", "click", this.#onSanityEventAdd);
    this.#listen("[data-action=\"gci-sanity-event-delete\"]", "click", this.#onSanityEventDelete);
    this.#listen("[data-action=\"gci-toggle-mythos-flag\"]", "click", this.#onToggleMythosFlag);
    this.#listen("[data-action=\"gci-book-progress-clear\"]", "click", this.#onBookProgressClear);
    this.#listen("[data-action=\"gci-development-phase\"]", "click", this.#onDevelopmentPhase);
    this.#listen("[data-action=\"gci-develop-skill\"]", "click", this.#onDevelopSkill);
    this.#listen("[data-action=\"gci-develop-luck\"]", "click", this.#onDevelopLuck);
    this.#prepareProseMirrorControls();
    this.#restoreSkillSearchFocus();
    this.#observePortraitSelection();
  }

  #prepareProseMirrorControls() {
    const normalizeButtons = () => {
      this.element.querySelectorAll("prose-mirror button").forEach((button) => {
        button.type = "button";
      });
    };

    normalizeButtons();
    requestAnimationFrame(normalizeButtons);
  }

  #listen(selector, eventName, handler) {
    this.element.querySelectorAll(selector).forEach((element) => {
      element.addEventListener(eventName, async (event) => {
        try {
          await handler.call(this, event);
        } catch (error) {
          console.error(`${MODULE_ID} | Investigator sheet action failed.`, error);
        }
      });
    });
  }

  async #onOpenCreation(event) {
    event.preventDefault();
    const opened = await openPlayerHudCreation();
    if (opened) return;
    ui.notifications.warn(`${MODULE_ID}.Notifications.PlayerHudUnavailable`, { localize: true });
  }

  async #onToggleEdit(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const isEditing = !this.document.system.flags?.locked;
    if (isEditing) await this.#persistPortraitFromCurrentMarkup();

    try {
      await this.document.update({ "system.flags.locked": isEditing }, { render: false });
      await this.render({ parts: ["body"] });
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to change investigator edit mode.`, error);
    }
  }

  async #onSelectTab(event) {
    event.preventDefault();
    const tabId = event.currentTarget.dataset.tab;
    if (!TAB_IDS.has(tabId) || (tabId === "keeper" && !game.user.isGM)) return;

    if (this.#skillSearchRenderTimer) {
      window.clearTimeout(this.#skillSearchRenderTimer);
      this.#skillSearchRenderTimer = null;
    }
    if (tabId !== "skills") this.#skillSearchFocusState = null;

    this.gciActiveTab = tabId;
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
      const value = this.document.system.attribs.db.value;
      if (value === null || value === undefined || value === "") return;
      const roll = await new Roll(value.toString(), this.document.parsedValues()).roll();
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

  async #onToggleCondition(event) {
    event.preventDefault();
    if (!(this.isEditable && (game.user.isGM || game.settings.get("CoC7", "statusPlayerEditable")))) return;

    const condition = event.currentTarget.dataset.condition;
    if (!this.document.system.conditions?.[condition]) return;

    await this.document.toggleCondition(condition);
    await this.render({ parts: ["body"] });
  }

  async #onSkillFilter(event) {
    event.preventDefault();
    if (this.#skillSearchRenderTimer) {
      window.clearTimeout(this.#skillSearchRenderTimer);
      this.#skillSearchRenderTimer = null;
    }
    this.#skillSearchFocusState = null;

    this.gciSkillFilter = event.currentTarget.dataset.filter || "all";
    await this.render({ parts: ["body"] });
  }

  async #onSkillSearch(event) {
    if (event.isComposing) return;

    const input = event.currentTarget;
    this.gciSkillSearch = input.value ?? "";
    this.#skillSearchFocusState = {
      start: input.selectionStart ?? this.gciSkillSearch.length,
      end: input.selectionEnd ?? this.gciSkillSearch.length
    };

    if (this.#skillSearchRenderTimer) window.clearTimeout(this.#skillSearchRenderTimer);
    this.#skillSearchRenderTimer = window.setTimeout(async () => {
      this.#skillSearchRenderTimer = null;
      try {
        await this.render({ parts: ["body"] });
      } catch (error) {
        console.error(`${MODULE_ID} | Failed to update investigator skill search.`, error);
      }
    }, 75);
  }

  #restoreSkillSearchFocus() {
    const focusState = this.#skillSearchFocusState;
    if (!focusState || this.gciActiveTab !== "skills") return;
    this.#skillSearchFocusState = null;

    requestAnimationFrame(() => {
      const input = this.element.querySelector('[data-action="gci-skill-search"]');
      if (!(input instanceof HTMLInputElement)) return;

      input.focus({ preventScroll: true });
      const max = input.value.length;
      input.setSelectionRange(
        Math.min(focusState.start, max),
        Math.min(focusState.end, max)
      );
    });
  }

  #getSkillFromEvent(event) {
    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    const skill = itemId ? this.document.items.get(itemId) : null;
    return skill?.type === "skill" ? skill : null;
  }

  async #onSkillRoll(event) {
    event.preventDefault();
    const skill = this.#getSkillFromEvent(event);
    if (!skill) return;
    await this.document.skillCheck({ name: skill.name }, event.shiftKey);
  }

  async #onToggleDevelopment(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const skill = this.#getSkillFromEvent(event);
    if (!skill || skill.system.properties?.noxpgain) return;

    await this.document.updateEmbeddedDocuments("Item", [{
      _id: skill.id,
      "system.flags.developement": !skill.system.flags?.developement
    }], { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onSkillAdjustmentChange(event) {
    if (!(this.isEditable && !this.document.system.flags?.locked)) return;
    const skill = this.#getSkillFromEvent(event);
    const adjustment = event.currentTarget.dataset.adjustment;
    if (!skill || !SKILL_ADJUSTMENTS.has(adjustment)) return;

    const parsed = Number.parseInt(event.currentTarget.value, 10);
    const value = Number.isFinite(parsed) ? parsed : 0;
    await this.document.updateEmbeddedDocuments("Item", [{
      _id: skill.id,
      [`system.adjustments.${adjustment}`]: value
    }], { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onToggleOccupationSkill(event) {
    event.preventDefault();
    if (!(this.isEditable && !this.document.system.flags?.locked)) return;
    const skill = this.#getSkillFromEvent(event);
    if (!skill) return;

    await this.document.updateEmbeddedDocuments("Item", [{
      _id: skill.id,
      "system.flags.occupation": !skill.system.flags?.occupation
    }], { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onEditSkill(event) {
    event.preventDefault();
    const skill = this.#getSkillFromEvent(event);
    if (!skill) return;
    await skill.sheet.render({ force: true });
  }

  async #onAddSkill(event) {
    event.preventDefault();
    if (!(this.isEditable && !this.document.system.flags?.locked)) return;

    const name = game.i18n.localize(`${MODULE_ID}.Values.NewSkill`);
    const [skill] = await this.document.createEmbeddedDocuments("Item", [{
      name,
      type: "skill",
      system: {
        skillName: name,
        base: "0"
      }
    }], { render: false });

    await this.render({ parts: ["body"] });
    if (skill?.sheet) await skill.sheet.render({ force: true });
  }


  async #onAdjustVital(event) {
    event.preventDefault();
    if (!this.isEditable || !this.document.system.flags?.locked) return;

    const key = event.currentTarget.dataset.attrib;
    if (!["hp", "mp", "lck", "san"].includes(key)) return;

    const direction = Number.parseInt(event.currentTarget.dataset.delta ?? "0", 10);
    if (!Number.isFinite(direction) || direction === 0) return;
    const step = event.shiftKey ? 5 : 1;
    const current = Number(this.document.system.attribs?.[key]?.value ?? 0);
    if (!Number.isFinite(current)) return;
    const next = current + direction * step;

    if (key === "hp" && typeof this.document.setHp === "function") {
      await this.document.setHp(next);
    } else if (key === "san" && typeof this.document.setSan === "function") {
      await this.document.setSan(next);
    } else if (key === "lck" && typeof this.document.setLuck === "function") {
      await this.document.setLuck(Math.max(0, next));
    } else {
      const maximum = Number(this.document.system.attribs?.mp?.max);
      const upper = Number.isFinite(maximum) && maximum >= 0 ? maximum : 99;
      const clamped = Math.min(upper, Math.max(0, next));
      await this.document.update({ "system.attribs.mp.value": clamped }, { render: false });
    }

    await this.render({ parts: ["body"] });
  }

  #getWeaponFromEvent(event) {
    const itemUuid = event.currentTarget.closest("[data-item-uuid]")?.dataset.itemUuid;
    if (!itemUuid) return null;
    return fromUuid(itemUuid);
  }

  async #onWeaponRoll(event) {
    event.preventDefault();
    const weapon = await this.#getWeaponFromEvent(event);
    if (!weapon || weapon.type !== "weapon") return;

    const tracksAmmo = Boolean(weapon.system?.properties?.rngd) && weapon.system?.bullets !== null;
    const disregardsAmmo = game.settings.get("CoC7", "disregardAmmo");
    const currentAmmo = Number.parseInt(weapon.system?.ammo ?? 0, 10);
    if (tracksAmmo && !disregardsAmmo && currentAmmo <= 0) {
      ui.notifications.warn(game.i18n.format(`${MODULE_ID}.Notifications.NoAmmo`, { weapon: weapon.name }));
      return;
    }

    trackRangedWeaponUse(weapon);
    await this.document.weaponCheck({ uuid: weapon.uuid }, event.shiftKey);
  }

  async #onWeaponSkillRoll(event) {
    event.preventDefault();
    const skillUuid = event.currentTarget.dataset.skillUuid;
    const skill = skillUuid ? await fromUuid(skillUuid) : null;
    if (!skill || skill.type !== "skill") return;
    await this.document.skillCheck({ name: skill.name }, event.shiftKey);
  }

  async #onWeaponDamageRoll(event) {
    event.preventDefault();
    const weapon = await this.#getWeaponFromEvent(event);
    if (!weapon || weapon.type !== "weapon") return;
    await rollWeaponDamage(this.document, weapon, event.currentTarget.dataset.damageRange || "normal");
  }

  async #onReloadWeapon(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    const weapon = await this.#getWeaponFromEvent(event);
    if (!weapon || weapon.type !== "weapon" || !weapon.system?.properties?.rngd) return;

    if (event.button === 2) {
      if (event.shiftKey) await weapon.system.setBullets(0);
      else await weapon.system.shootAmmunition(1);
    } else if (event.shiftKey) {
      await weapon.system.reload();
    } else {
      await weapon.system.addAmmunition();
    }

    await this.render({ parts: ["body"] });
  }

  async #onAddWeapon(event) {
    event.preventDefault();
    if (!(this.isEditable && !this.document.system.flags?.locked)) return;
    if (typeof this.document.createEmptyWeapon !== "function") return;
    const created = await this.document.createEmptyWeapon(event);
    if (created?.[0]?.sheet) await created[0].sheet.render({ force: true });
  }

  async #onEditWeapon(event) {
    event.preventDefault();
    const weapon = await this.#getWeaponFromEvent(event);
    if (!weapon || weapon.type !== "weapon") return;
    await weapon.sheet.render({ force: true });
  }

  async #onDeleteWeapon(event) {
    event.preventDefault();
    if (!(this.isEditable && !this.document.system.flags?.locked)) return;
    const weapon = await this.#getWeaponFromEvent(event);
    if (!weapon || weapon.type !== "weapon") return;
    await weapon.delete();
    await this.render({ parts: ["body"] });
  }

  #getInventoryItemFromEvent(event) {
    const itemUuid = event.currentTarget.closest("[data-item-uuid]")?.dataset.itemUuid;
    if (!itemUuid) return null;
    return fromUuid(itemUuid);
  }

  async #onOpenInventoryItem(event) {
    event.preventDefault();
    const item = await this.#getInventoryItemFromEvent(event);
    if (!item || item.parent?.id !== this.document.id) return;
    await item.sheet.render({ force: true });
  }

  async #onAddInventoryItem(event) {
    event.preventDefault();
    if (!(this.isEditable && !this.document.system.flags?.locked)) return;

    const type = event.currentTarget.dataset.type;
    if (!["item", "weapon", "armor", "book", "spell"].includes(type)) return;

    if (type === "weapon" && typeof this.document.createEmptyWeapon === "function") {
      const created = await this.document.createEmptyWeapon(event);
      if (created?.[0]?.sheet) await created[0].sheet.render({ force: true });
      return;
    }

    const name = game.i18n.localize(`${MODULE_ID}.Values.NewInventory.${type}`);
    const [item] = await this.document.createEmbeddedDocuments("Item", [{ name, type }], { render: false });
    await this.render({ parts: ["body"] });
    if (item?.sheet) await item.sheet.render({ force: true });
  }

  async #onDeleteInventoryItem(event) {
    event.preventDefault();
    if (!(this.isEditable && !this.document.system.flags?.locked)) return;
    const item = await this.#getInventoryItemFromEvent(event);
    if (!item || item.parent?.id !== this.document.id) return;
    if (item.type === "status" && !game.user.isGM) return;
    await this.document.deleteEmbeddedDocuments("Item", [item.id], { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onToggleManualCredit(event) {
    event.preventDefault();
    if (!(this.isEditable && !this.document.system.flags?.locked)) return;
    await this.document.update({
      "system.flags.manualCredit": !this.document.system.flags?.manualCredit
    }, { render: false });
    await this.render({ parts: ["body"] });
  }


  async #onBiographyAdd(event) {
    event.preventDefault();
    if (!(this.isEditable && !this.document.system.flags?.locked)) return;
    if (game.settings.get("CoC7", "oneBlockBackstory")) return;

    const biography = foundry.utils.deepClone(this.document.system.biography ?? []);
    biography.push({
      title: game.i18n.localize("CoC7.BackgroundNewSection"),
      value: ""
    });
    await this.document.update({ "system.biography": biography }, { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onBiographyMove(event) {
    event.preventDefault();
    if (!(this.isEditable && !this.document.system.flags?.locked)) return;

    const section = event.currentTarget.closest("[data-biography-index]");
    const index = Number.parseInt(section?.dataset.biographyIndex ?? "-1", 10);
    const direction = Number.parseInt(event.currentTarget.dataset.direction ?? "0", 10);
    const biography = foundry.utils.deepClone(this.document.system.biography ?? []);
    const target = index + direction;
    if (!Number.isInteger(index) || index < 0 || target < 0 || target >= biography.length) return;

    [biography[index], biography[target]] = [biography[target], biography[index]];
    await this.document.update({ "system.biography": biography }, { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onBiographyRemove(event) {
    event.preventDefault();
    if (!(this.isEditable && !this.document.system.flags?.locked)) return;

    const section = event.currentTarget.closest("[data-biography-index]");
    const index = Number.parseInt(section?.dataset.biographyIndex ?? "-1", 10);
    const biography = foundry.utils.deepClone(this.document.system.biography ?? []);
    if (!Number.isInteger(index) || index < 0 || index >= biography.length) return;

    biography.splice(index, 1);
    await this.document.update({ "system.biography": biography }, { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onSanityEventAdd(event) {
    event.preventDefault();
    if (!(game.user.isGM && this.isEditable)) return;

    const immunity = event.currentTarget.dataset.type === "immunity";
    const sanityLossEvents = foundry.utils.deepClone(this.document.system.sanityLossEvents ?? []);
    sanityLossEvents.push({ type: "", totalLoss: 0, immunity });
    await this.document.update({ "system.sanityLossEvents": sanityLossEvents }, { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onResetDailySanity(event) {
    event.preventDefault();
    if (!(game.user.isGM && this.isEditable)) return;
    if (typeof this.document.resetDailySanity !== "function") return;

    await this.document.resetDailySanity();
    await this.render({ parts: ["body"] });
  }

  async #onSanityEventDelete(event) {
    event.preventDefault();
    if (!(game.user.isGM && this.isEditable)) return;

    const row = event.currentTarget.closest("[data-sanity-index]");
    const index = Number.parseInt(row?.dataset.sanityIndex ?? "-1", 10);
    const sanityLossEvents = foundry.utils.deepClone(this.document.system.sanityLossEvents ?? []);
    if (!Number.isInteger(index) || index < 0 || index >= sanityLossEvents.length) return;

    sanityLossEvents.splice(index, 1);
    await this.document.update({ "system.sanityLossEvents": sanityLossEvents }, { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onToggleMythosFlag(event) {
    event.preventDefault();
    if (!(game.user.isGM && this.isEditable)) return;

    const flag = event.currentTarget.dataset.flag;
    if (!["mythosInsanityExperienced", "mythosHardened"].includes(flag)) return;
    await this.document.update({
      [`system.flags.${flag}`]: !this.document.system.flags?.[flag]
    }, { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onBookProgressClear(event) {
    event.preventDefault();
    if (!(game.user.isGM && this.isEditable)) return;

    const row = event.currentTarget.closest("[data-book-index]");
    const index = Number.parseInt(row?.dataset.bookIndex ?? "-1", 10);
    const books = foundry.utils.deepClone(this.document.system.books ?? []);
    if (!Number.isInteger(index) || index < 0 || index >= books.length) return;

    books.splice(index, 1);
    await this.document.update({ "system.books": books }, { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onDevelopmentPhase(event) {
    event.preventDefault();
    if (!this.isEditable || !game.settings.get("CoC7", "developmentEnabled")) return;
    if (typeof this.document.developmentPhase !== "function") return;

    await this.document.developmentPhase(event.shiftKey);
    await this.render({ parts: ["body"] });
  }

  async #onDevelopSkill(event) {
    event.preventDefault();
    if (!this.isEditable || !game.settings.get("CoC7", "developmentEnabled")) return;
    if (typeof this.document.developSkill !== "function") return;

    const skillUuid = event.currentTarget.closest("[data-skill-uuid]")?.dataset.skillUuid;
    if (!skillUuid) return;
    await this.document.developSkill(skillUuid, event.shiftKey);
    await this.render({ parts: ["body"] });
  }

  async #onDevelopLuck(event) {
    event.preventDefault();
    if (!this.isEditable || !game.settings.get("CoC7", "developmentRollForLuck")) return;
    if (typeof this.document.developLuck !== "function") return;

    await this.document.developLuck(event.shiftKey);
    await this.render({ parts: ["body"] });
  }

  #observePortraitSelection() {
    this.#portraitObserver?.disconnect();
    this.#portraitObserver = null;

    if (!(this.isEditable && !this.document.system.flags?.locked)) return;
    const portrait = this.element.querySelector(".gci-portrait");
    if (!portrait) return;

    this.#portraitObserver = new MutationObserver(() => {
      const selectedPath = this.#getPortraitPathFromMarkup();
      if (!selectedPath || selectedPath === this.document.img) return;
      void this.#persistPortrait(selectedPath);
    });
    this.#portraitObserver.observe(portrait, { attributes: true, attributeFilter: ["src"] });
  }

  #getPortraitPathFromMarkup() {
    const inputValue = this.element.querySelector(".gci-portrait-path")?.value?.trim();
    if (inputValue && inputValue !== this.document.img) return inputValue;

    const imageValue = this.element.querySelector(".gci-portrait")?.getAttribute("src")?.trim();
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
      console.error(`${MODULE_ID} | Failed to save the investigator portrait.`, error);
    } finally {
      if (this.#portraitUpdatePending === selectedPath) this.#portraitUpdatePending = null;
    }
  }
}
