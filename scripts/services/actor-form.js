import { MODULE_ID } from "../constants.js";

function getSubmittedValue(submitData, fieldName) {
  if (Object.hasOwn(submitData, fieldName)) return submitData[fieldName];
  return foundry.utils.getProperty(submitData, fieldName);
}

function mergeBiography(document, changes) {
  // CoC7 stores biography as an ArrayField. Indexed object updates must be
  // merged into the existing array or Foundry can replace the other sections.
  const biography = foundry.utils.deepClone(document.system.biography ?? []);
  for (const [index, section] of Object.entries(changes)) {
    if (!/^\d+$/.test(index) || !biography[index] || !section) continue;
    for (const key of ["title", "value"]) {
      if (section[key] !== undefined) biography[index][key] = section[key];
    }
  }
  return biography;
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
      const value = getSubmittedValue(submitData, fieldName);
      if (value === undefined) return;
      const biographyMatch = fieldName.match(/^system\.biography\.(\d+)\.(title|value)$/);
      if (biographyMatch) {
        await this.document.update({
          "system.biography": mergeBiography(this.document, {
            [biographyMatch[1]]: { [biographyMatch[2]]: value }
          })
        });
        return;
      }
      await this.document.update({ [fieldName]: value });
      return;
    }

    const updateData = foundry.utils.expandObject(submitData);
    if (updateData.system?.biography) {
      updateData.system.biography = mergeBiography(this.document, updateData.system.biography);
    }
    await this.document.update(updateData);
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to update the CoC7 Actor.`, error);
  }
}
