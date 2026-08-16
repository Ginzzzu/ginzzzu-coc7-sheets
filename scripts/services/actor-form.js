import { MODULE_ID } from "../constants.js";

function getSubmittedValue(submitData, fieldName) {
  return foundry.utils.getProperty(submitData, fieldName);
}

/**
 * Submit native CoC7 Actor fields without copying data into module flags.
 */
export async function submitNativeActorForm(event, form, formData) {
  if (!this.isEditable) return;

  // ProseMirror toolbar controls live inside the sheet form. Some Foundry v14
  // toolbar buttons can otherwise be treated as form submitters, which causes
  // the Actor to re-render before the formatting command is applied.
  if (event.submitter?.closest?.("prose-mirror")) return;

  try {
    const submitData = typeof this._prepareSubmitData === "function"
      ? this._prepareSubmitData(event, form, formData)
      : formData.object;
    const fieldName = event.target?.name;
    const maximumMatch = fieldName?.match(/^system\.attribs\.(hp|mp|san)\.max$/);

    if (maximumMatch && game.user.isGM) {
      const value = Number.parseInt(event.target.value, 10);
      if (!Number.isFinite(value)) return;

      const attributeKey = maximumMatch[1];
      await this.document.update({
        [fieldName]: value,
        [`system.attribs.${attributeKey}.auto`]: false
      });
      return;
    }

    if (fieldName === "system.attribs.san.value") {
      await this.document.setSan(Number.parseInt(event.target.value, 10));
      return;
    }

    if (fieldName === "system.attribs.hp.value") {
      await this.document.setHp(Number.parseInt(event.target.value, 10));
      return;
    }

    if (fieldName) {
      await this.document.update({ [fieldName]: getSubmittedValue(submitData, fieldName) });
      return;
    }

    await this.document.update(submitData);
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to update the CoC7 Actor.`, error);
  }
}
