const ALL_ERAS = [
  { id: "1920", label: "CoC7.Era1920", icon: "fa-solid fa-car" },
  { id: "modern", label: "CoC7.EraModern", icon: "fa-solid fa-mobile-screen" },
  { id: "gaslight", label: "CoC7.EraGasLight", icon: "fa-solid fa-hat-top" },
  { id: "pulp", label: "CoC7.EraPulp", icon: "fa-solid fa-mask" },
  { id: "modernPulp", label: "CoC7.EraModernPulp", icon: "fa-solid fa-bolt" },
  { id: "darkAges", label: "CoC7.EraDarkAges", icon: "fa-solid fa-chess-rook" },
  { id: "darkAgesPulp", label: "CoC7.EraDarkAgesPulp", icon: "fa-solid fa-shield" },
  { id: "downDarkerTrails", label: "CoC7.EraDownDarkerTrails", icon: "fa-solid fa-horse" },
  { id: "downDarkerTrailsPulp", label: "CoC7.EraDownDarkerTrailsPulp", icon: "fa-solid fa-hat-cowboy" },
  { id: "invictus", label: "CoC7.EraInvictus", icon: "fa-solid fa-landmark" },
  { id: "regency", label: "CoC7.EraRegency", icon: "fa-solid fa-feather-pointed" },
  { id: "regencyPulp", label: "CoC7.EraRegencyPulp", icon: "fa-solid fa-gem" }
];

function getWorldEra() {
  try {
    if (game.settings?.settings?.has?.("CoC7.worldEra")) {
      return game.settings.get("CoC7", "worldEra") || "1920";
    }
    if (game.settings?.settings?.has?.("CoC7.era")) {
      return game.settings.get("CoC7", "era") || "1920";
    }
    return "1920";
  } catch {
    return "1920";
  }
}

function localizeMaybe(key) {
  if (!key) return "";
  return game.i18n.has(key) ? game.i18n.localize(key) : key;
}

export async function buildItemViewModel(document, { isEditing = false, isKeeper = false } = {}) {
  const worldEra = getWorldEra();
  const rawPrice = document.system.price ?? {};
  const currentPrice = rawPrice[worldEra] ?? rawPrice["1920"] ?? 0;

  const eras = ALL_ERAS.map((era) => {
    const val = rawPrice[era.id];
    const hasValue = val !== undefined && val !== null && String(val).trim() !== "";
    return {
      id: era.id,
      name: localizeMaybe(era.label),
      icon: era.icon,
      price: val ?? "",
      isEnabled: hasValue,
      isWorldEra: era.id === worldEra
    };
  });

  const enrichedDescriptionValue = await TextEditor.enrichHTML(
    document.system.description?.value ?? "",
    {
      secrets: isKeeper,
      rollData: typeof document.getRollData === "function" ? document.getRollData() : {},
      async: true
    }
  );

  const enrichedDescriptionKeeper = await TextEditor.enrichHTML(
    document.system.description?.keeper ?? "",
    {
      secrets: isKeeper,
      rollData: typeof document.getRollData === "function" ? document.getRollData() : {},
      async: true
    }
  );

  const effects = (document.effects ?? []).map((effect) => ({
    id: effect.id,
    name: effect.name,
    img: effect.img ?? effect.icon ?? "icons/svg/aura.svg",
    disabled: Boolean(effect.disabled)
  }));

  const isEmbedded = Boolean(document.isEmbedded && document.parent);
  const parent = document.parent;
  const parentContext = isEmbedded
    ? {
      isEmbedded: true,
      name: parent.name,
      img: parent.img,
      type: parent.type,
      typeName: localizeMaybe(`ginzzzu-coc7-sheets.Values.${parent.type === "character" ? "CharacterType" : "LocationType"}`)
    }
    : {
      isEmbedded: false
    };

  return {
    name: document.name,
    img: document.img,
    quantity: Number.isFinite(Number(document.system.quantity)) ? Number(document.system.quantity) : 1,
    weight: document.system.weight ?? 0,
    worldEra,
    worldEraName: localizeMaybe(ALL_ERAS.find((e) => e.id === worldEra)?.label ?? worldEra),
    currentPrice,
    eras,
    hasActiveEras: eras.some((e) => e.isEnabled),
    effects,
    hasEffects: effects.length > 0,
    parentContext,
    isKeeper,
    canEdit: true,
    isEditing,
    hasKeeperNotes: Boolean(document.system.description?.keeper?.trim()),
    enrichedDescriptionValue,
    enrichedDescriptionKeeper
  };
}
