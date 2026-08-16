import { MODULE_ID } from "../constants.js";

const TEXT_EDITOR = foundry.applications.ux?.TextEditor?.implementation ?? globalThis.TextEditor;

async function enrich(value, { secrets = false } = {}) {
  const source = value ?? "";
  if (!TEXT_EDITOR?.enrichHTML) return source;

  try {
    return await TEXT_EDITOR.enrichHTML(source, { async: true, secrets });
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to enrich investigator biography text.`, error);
    return source;
  }
}

function getOneBlockBackstorySetting() {
  try {
    return Boolean(game.settings.get("CoC7", "oneBlockBackstory"));
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to read the CoC7 backstory mode setting.`, error);
    return false;
  }
}

function buildSanityEvents(document) {
  const events = Array.isArray(document.system.sanityLossEvents)
    ? document.system.sanityLossEvents
    : [];

  return events.map((event, index) => ({
    index,
    type: event?.type ?? "",
    totalLoss: event?.totalLoss ?? "",
    immunity: Boolean(event?.immunity)
  }));
}

function buildBooks(document) {
  const books = Array.isArray(document.system.books) ? document.system.books : [];

  return books.map((book, index) => {
    const progress = Number(book?.progress ?? 0);
    const necessary = Number(book?.necessary ?? 0);
    const currentPercent = necessary > 0
      ? Math.max(0, Math.min(100, Math.round((progress / necessary) * 100)))
      : 0;

    return {
      index,
      name: book?.name ?? "",
      fullStudies: Number(book?.fullStudies ?? 0),
      progress,
      necessary,
      currentPercent,
      summary: game.i18n.format(`${MODULE_ID}.Fields.BookStudySummary`, {
        fullStudies: Number(book?.fullStudies ?? 0),
        currentPercent
      })
    };
  });
}

/**
 * Build player-facing biography data and, for GMs only, hidden Keeper data.
 */
export async function buildInvestigatorBiographyView(document, { isKeeper = false } = {}) {
  const oneBlock = getOneBlockBackstorySetting();
  const backstory = document.system.backstory ?? "";
  const rawSections = Array.isArray(document.system.biography) ? document.system.biography : [];
  const enrichedBackstory = oneBlock ? await enrich(backstory, { secrets: isKeeper }) : "";
  const enrichedSections = oneBlock
    ? []
    : await Promise.all(rawSections.map(async (section, index) => ({
      index,
      title: section?.title ?? "",
      value: section?.value ?? "",
      enriched: await enrich(section?.value ?? "", { secrets: isKeeper }),
      isFirst: index === 0,
      isLast: index === rawSections.length - 1
    })));

  const biography = {
    oneBlock,
    backstory,
    enrichedBackstory,
    sections: enrichedSections,
    hasContent: oneBlock
      ? Boolean(backstory?.trim())
      : enrichedSections.some((section) => section.title?.trim() || section.value?.trim())
  };

  if (!isKeeper) return { biography, keeper: null };

  const sanityEvents = buildSanityEvents(document);
  const keeperNotes = document.system.description?.keeper ?? "";
  const keeper = {
    keeperNotes,
    enrichedKeeperNotes: await enrich(keeperNotes, { secrets: true }),
    sanity: {
      value: Number(document.system.attribs?.san?.value ?? 0),
      max: Number(document.system.attribs?.san?.max ?? 0),
      dailyLoss: Number(document.system.attribs?.san?.dailyLoss ?? 0),
      dailyLimit: Number(document.system.attribs?.san?.dailyLimit ?? 0)
    },
    encounters: sanityEvents.filter((event) => !event.immunity),
    immunities: sanityEvents.filter((event) => event.immunity),
    mythosInsanityExperienced: Boolean(document.system.flags?.mythosInsanityExperienced),
    mythosHardened: Boolean(document.system.flags?.mythosHardened),
    naturalHealing: document.system.config?.naturalHealing ?? "",
    books: buildBooks(document)
  };

  return { biography, keeper };
}
