import { ITEM_TEMPLATE_PATH, MODULE_ID } from "../constants.js";
import { buildItemViewModel } from "../services/item-view-data.js";

const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const TAB_IDS = new Set(["description", "keeper", "prices", "effects"]);

function getSubmittedValue(submitData, fieldName) {
  return foundry.utils.getProperty(submitData, fieldName);
}

/**
 * Handle form submission for CoC7 Item sheets without interfering with ProseMirror toolbars.
 */
export async function submitNativeItemForm(event, form, formData) {
  if (!this.isEditable) return;

  if (event.submitter?.closest?.("prose-mirror")) return;

  try {
    const submitData = typeof this._prepareSubmitData === "function"
      ? this._prepareSubmitData(event, form, formData)
      : formData.object;
    const fieldName = event.target?.name;

    if (fieldName) {
      await this.document.update({ [fieldName]: getSubmittedValue(submitData, fieldName) });
      return;
    }

    await this.document.update(submitData);
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to update the CoC7 Item.`, error);
  }
}

/**
 * Silver-metallic styled sheet for Call of Cthulhu 7e Items.
 */
export class GinzzzuCoC7ItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  gcsActiveTab = "description";
  gcsEditing = false;
  #portraitObserver = null;
  #portraitUpdatePending = null;

  static DEFAULT_OPTIONS = {
    classes: ["coc7", "sheet", MODULE_ID, "gcks-window", "gcs-window", "gcs-item-window"],
    window: {
      resizable: true
    },
    position: {
      width: 600,
      height: 660
    },
    form: {
      handler: submitNativeItemForm,
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    body: {
      template: ITEM_TEMPLATE_PATH,
      scrollable: [".gcs-scroll-region"]
    }
  };

  get title() {
    return `${game.i18n.localize("ginzzzu-coc7-sheets.ItemTypes.item")}: ${this.document.name}`;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const document = this.document;
    const isKeeper = game.user.isGM;
    const requestedTab = TAB_IDS.has(this.gcsActiveTab) ? this.gcsActiveTab : "description";
    const activeTab = requestedTab === "keeper" && !isKeeper ? "description" : requestedTab;
    const isEditing = this.isEditable && this.gcsEditing;

    const viewModel = await buildItemViewModel(document, {
      isEditing,
      isKeeper
    });

    return {
      ...context,
      document,
      item: document,
      gcs: {
        ...viewModel,
        activeTab,
        tabs: {
          description: { active: activeTab === "description" },
          keeper: { active: activeTab === "keeper", visible: isKeeper },
          prices: { active: activeTab === "prices" },
          effects: { active: activeTab === "effects" }
        }
      }
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.#listen("[data-action=\"gcs-toggle-edit\"]", "click", this.#onToggleEdit);
    this.#listen("[data-action=\"gcs-select-tab\"]", "click", this.#onSelectTab);
    this.#listen("[data-action=\"gcs-adjust-quantity\"]", "click", this.#onAdjustQuantity);
    this.#listen("[data-action=\"gcs-show-art\"]", "click", this.#onShowArt);
    this.#listen("[data-action=\"gcs-toggle-era\"]", "click", this.#onToggleEra);
    this.#listen("[data-action=\"gcs-add-effect\"]", "click", this.#onAddEffect);
    this.#listen("[data-action=\"gcs-edit-effect\"]", "click", this.#onEditEffect);
    this.#listen("[data-action=\"gcs-delete-effect\"]", "click", this.#onDeleteEffect);
    this.#listen("[data-action=\"gcs-toggle-effect\"]", "click", this.#onToggleEffect);

    this.#observePortraitSelection();
  }

  async close(options = {}) {
    this.#portraitObserver?.disconnect();
    this.#portraitObserver = null;
    return super.close(options);
  }

  #listen(selector, eventName, handler) {
    const elements = this.element.querySelectorAll(selector);
    for (const element of elements) {
      element.addEventListener(eventName, handler.bind(this));
    }
  }

  async #onToggleEdit(event) {
    event.preventDefault();
    if (!this.isEditable) return;
    this.gcsEditing = !this.gcsEditing;
    await this.render({ parts: ["body"] });
  }

  async #onSelectTab(event) {
    event.preventDefault();
    const tab = event.currentTarget.dataset.tab;
    if (!TAB_IDS.has(tab)) return;
    if (tab === "keeper" && !game.user.isGM) return;

    this.gcsActiveTab = tab;
    await this.render({ parts: ["body"] });
  }

  async #onAdjustQuantity(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const direction = Number.parseInt(event.currentTarget.dataset.direction ?? "1", 10);
    const step = event.shiftKey ? 5 : 1;
    const current = Number(this.document.system.quantity ?? 1);
    const updated = Math.max(0, current + (direction * step));

    await this.document.update({ "system.quantity": updated }, { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onShowArt(event) {
    event.preventDefault();
    const img = this.document.img;
    if (!img) return;

    const popout = new ImagePopout(img, {
      title: this.document.name,
      uuid: this.document.uuid
    });
    popout.render(true);
  }

  async #onToggleEra(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const eraId = event.currentTarget.dataset.era;
    if (!eraId) return;

    const currentPrices = foundry.utils.deepClone(this.document.system.price ?? {});
    if (currentPrices[eraId] !== undefined) {
      delete currentPrices[eraId];
    } else {
      currentPrices[eraId] = 0;
    }

    await this.document.update({ "system.price": currentPrices }, { render: false });
    await this.render({ parts: ["body"] });
  }

  async #onAddEffect(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const effectData = {
      name: this.document.name || game.i18n.localize("ginzzzu-coc7-sheets.Values.NewEffect"),
      icon: this.document.img || "icons/svg/aura.svg",
      origin: this.document.uuid,
      disabled: false
    };

    const [created] = await this.document.createEmbeddedDocuments("ActiveEffect", [effectData]);
    if (created?.sheet) await created.sheet.render({ force: true });
    await this.render({ parts: ["body"] });
  }

  async #onEditEffect(event) {
    event.preventDefault();
    const effectId = event.currentTarget.closest("[data-effect-id]")?.dataset.effectId;
    const effect = this.document.effects.get(effectId);
    if (effect?.sheet) await effect.sheet.render({ force: true });
  }

  async #onDeleteEffect(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const effectId = event.currentTarget.closest("[data-effect-id]")?.dataset.effectId;
    if (!effectId) return;

    await this.document.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
    await this.render({ parts: ["body"] });
  }

  async #onToggleEffect(event) {
    event.preventDefault();
    if (!this.isEditable) return;

    const effectId = event.currentTarget.closest("[data-effect-id]")?.dataset.effectId;
    const effect = this.document.effects.get(effectId);
    if (!effect) return;

    await effect.update({ disabled: !effect.disabled });
    await this.render({ parts: ["body"] });
  }

  #observePortraitSelection() {
    this.#portraitObserver?.disconnect();
    this.#portraitObserver = null;

    if (!this.isEditable) return;
    const portrait = this.element.querySelector(".gcs-portrait, .gcks-portrait");
    if (!portrait) return;

    this.#portraitObserver = new MutationObserver(() => {
      const selectedPath = this.#getPortraitPathFromMarkup();
      if (!selectedPath || selectedPath === this.document.img) return;
      void this.#persistPortrait(selectedPath);
    });
    this.#portraitObserver.observe(portrait, { attributes: true, attributeFilter: ["src"] });
  }

  #getPortraitPathFromMarkup() {
    const inputValue = this.element.querySelector(".gcks-portrait-path, .gcs-item-portrait-path")?.value?.trim();
    if (inputValue && inputValue !== this.document.img) return inputValue;

    const imageValue = this.element.querySelector(".gcs-portrait, .gcks-portrait")?.getAttribute("src")?.trim();
    if (!imageValue || imageValue === this.document.img || imageValue.startsWith("data:")) return null;
    return imageValue;
  }

  async #persistPortrait(selectedPath) {
    if (!this.isEditable || !selectedPath || selectedPath === this.document.img) return;
    if (this.#portraitUpdatePending === selectedPath) return;

    this.#portraitUpdatePending = selectedPath;
    try {
      await this.document.update({ img: selectedPath });
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to save the item image.`, error);
    } finally {
      if (this.#portraitUpdatePending === selectedPath) this.#portraitUpdatePending = null;
    }
  }
}
