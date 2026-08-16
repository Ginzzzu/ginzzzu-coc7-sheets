export function buildCharacteristicViewModels(document) {
  const overrides = foundry.utils.flattenObject(document.overrides ?? {});
  const characteristics = {};
  const characteristicsSchema = document.system.schema.getField("characteristics");
  const configuredOrder = game.settings.get("CoC7", "characteristicsOrder");
  const characteristicKeys = Array.isArray(configuredOrder)
    ? configuredOrder
    : [...(characteristicsSchema?.keys?.() ?? Object.keys(document.system.characteristics ?? {}))];

  for (const key of characteristicKeys) {
    const characteristic = document.system.characteristics?.[key];
    const field = characteristicsSchema?.getField?.(key);
    if (!characteristic) continue;
    if (characteristic.value === null || characteristic.value === undefined) continue;

    const value = Number(characteristic.value);
    characteristics[key] = {
      key,
      short: field?.label ?? key.toUpperCase(),
      label: field?.hint ?? key,
      value,
      formula: characteristic.formula ?? "",
      sourceValue: document._source.system.characteristics?.[key]?.value ?? value,
      activeEffectValue: overrides[`system.characteristics.${key}.value`] !== undefined,
      hard: Math.floor(value / 2),
      extreme: Math.floor(value / 5)
    };
  }

  return characteristics;
}

export function buildAttributeViewModels(document) {
  const attribs = {};
  const attribsSchema = document.system.schema.getField("attribs");
  const attributeKeys = attribsSchema?.keys?.() ?? Object.keys(document.system.attribs ?? {});
  for (const key of attributeKeys) attribs[key] = document.system.attribs[key];
  return attribs;
}

export function buildInvestigatorIdentity(document) {
  const infos = document.system.infos ?? {};
  return {
    occupation: infos.occupation ?? "",
    age: infos.age ?? "",
    sex: infos.sex ?? "",
    residence: infos.residence ?? "",
    birthplace: infos.birthplace ?? "",
    playername: infos.playername ?? ""
  };
}
