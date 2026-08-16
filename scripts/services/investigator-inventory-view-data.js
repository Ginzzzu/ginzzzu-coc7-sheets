import { getEffectiveSkillValue } from "./skill-values.js";

const INVENTORY_GROUPS = [
  { id: "item", icon: "fa-solid fa-suitcase", addable: true },
  { id: "weapon", icon: "fa-solid fa-gun", addable: true },
  { id: "armor", icon: "fa-solid fa-shield-halved", addable: true },
  { id: "book", icon: "fa-solid fa-book", addable: true },
  { id: "spell", icon: "fa-solid fa-wand-sparkles", addable: true },
  { id: "talent", icon: "fa-solid fa-star", addable: false },
  { id: "status", icon: "fa-solid fa-tag", addable: false, keeperOnly: true }
];

function localizeMaybe(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return game.i18n.has(text) ? game.i18n.localize(text) : text;
}

function itemQuantity(item) {
  const value = Number(item.system?.quantity);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function buildInventoryItem(item) {
  return {
    id: item.id,
    uuid: item.uuid,
    type: item.type,
    img: item.img,
    name: item.name,
    quantity: itemQuantity(item)
  };
}

function findCreditRatingSkill(document) {
  if (document.creditRatingSkill?.type === "skill") return document.creditRatingSkill;
  return document.items.find((item) => item.type === "skill" && item.flags?.CoC7?.cocidFlag?.id === "i.skill.credit-rating") ?? null;
}

function findMonetaryRow(document, creditRating) {
  return document.system.monetary?.values?.find((row) => {
    const minOkay = row.min === null || row.min === undefined || row.min <= creditRating;
    const maxOkay = row.max === null || row.max === undefined || row.max >= creditRating;
    return minOkay && maxOkay;
  }) ?? null;
}

function formattedValue(document, type) {
  if (typeof document.system.formattedMonetaryValue !== "function") return "";
  try {
    return document.system.formattedMonetaryValue(type);
  } catch (error) {
    console.error("ginzzzu-coc7-sheets | Failed to format investigator monetary value.", error);
    return "";
  }
}

/** Build native CoC7 possessions and money view data for an investigator. */
export function buildInvestigatorInventoryView(document, { isEditing = false, isKeeper = false } = {}) {
  const groups = INVENTORY_GROUPS
    .filter((group) => !group.keeperOnly || isKeeper)
    .map((group) => {
      const items = document.items
        .filter((item) => item.type === group.id)
        .map(buildInventoryItem)
        .sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));

      return {
        ...group,
        label: game.i18n.localize(`ginzzzu-coc7-sheets.ItemTypes.${group.id}`),
        canAdd: isEditing && group.addable,
        canDelete: isEditing && (!group.keeperOnly || isKeeper),
        items
      };
    });

  const creditSkill = findCreditRatingSkill(document);
  const creditRating = creditSkill ? getEffectiveSkillValue(creditSkill) : 0;
  const monetary = document.system.monetary ?? {};
  const manualCredit = Boolean(document.system.flags?.manualCredit);
  const row = findMonetaryRow(document, creditRating);

  return {
    groups,
    hasItems: groups.some((group) => group.items.length > 0),
    creditRating,
    creditTier: localizeMaybe(row?.name),
    manualCredit,
    money: {
      spendingLevel: manualCredit ? (monetary.spendingLevel ?? "") : formattedValue(document, "spending"),
      cash: manualCredit ? (monetary.cash ?? "") : formattedValue(document, "cash"),
      spent: monetary.spent ?? "",
      assets: manualCredit ? (monetary.assets ?? "") : formattedValue(document, "assets"),
      assetsDetails: monetary.assetsDetails ?? "",
      notes: document.system.notes ?? ""
    }
  };
}
