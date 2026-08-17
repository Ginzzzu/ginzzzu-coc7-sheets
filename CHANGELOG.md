# Changelog

## 1.0

- Keepers can now manually change automatic HP, MP, and Sanity maximums in investigator and creature edit modes.
- A manual maximum change disables CoC7's automatic calculation for that specific attribute in the same Actor update, preventing the system from immediately restoring the calculated value.
- Non-GM owners retain the existing read-only behavior for automatically calculated maximums.

## 0.11.12

- Current and maximum top-row vital values now use the same font size and line height on investigator, Keeper NPC, and creature sheets.

## 0.11.11

- Kept two-vital creature rows compact by centering current/maximum values and their steppers instead of stretching the values across each half of the sheet.

## 0.11.10

- Keeper NPC and creature vitals now render as read-only values outside edit mode instead of active form inputs.
- Added quick increase/decrease steppers for every available top-row vital (HP, MP, Sanity, and Luck); Shift-click changes the value by five.
- Kept direct current/maximum value inputs inside edit mode and preserved native CoC7 HP, Sanity, and Luck updates.

## 0.11.8

- Added a Keeper-only reset control to the investigator Sanity and Insanity panel.
- The control uses CoC7's native daily Sanity reset, clearing the accumulated daily loss and recalculating the one-fifth limit from current Sanity.

## 0.11.7

- Anchored investigator, Keeper NPC, creature, and location portraits to the top center of their frames so cover cropping no longer cuts off the top of portrait artwork.
- Preserved the existing circular/rectangular frames and full-frame portrait fill.

## 0.11.6

- Changed investigator Skills search from commit-on-change behavior to live filtering on the native `input` event.
- Added a short 75 ms render debounce so typing does not trigger redundant full-part renders.
- Restored search focus and caret position after the ApplicationV2 body partial re-renders, so continuous typing remains uninterrupted.
- Clearing the native search field now immediately restores the full filtered skill list without requiring Enter.

## 0.11.5

- Removed the leftover thick left-edge accent from investigator HP, MP, Luck, and Sanity cards so all four vitals use the same even aged-brass frame.
- Removed the left inset stripe from the clickable Damage Bonus derived-stat card and replaced it with a restrained uniform inset bevel.
- Kept values, controls, roll behavior, stepper behavior, and the accepted 0.11.4 Lovecraftian palette unchanged.

## 0.11.4

- Reworked investigator interactive/active states to restore the darker Lovecraftian sheet language instead of bright web-style fills.
- Characteristic roll cards keep their improved readability but now use an aged olive/brass surface with engraved-style inset shading instead of a luminous olive panel.
- Active workspace tabs now read as dark lacquered/brass tabs with a pressed bevel rather than a modern highlighted tab.
- Active skill filters, manual-credit mode, Keeper feature toggles, Keeper tab states and the ready development action now use muted brass, leather and wine tones with inset accents instead of flat saturated fills.
- Roll mechanics, active-state meaning and layout are unchanged.

## 0.11.3

- Reversed the visual hierarchy inside investigator characteristic roll cards: the characteristic abbreviation is now the dominant center label, while the raw score is a smaller secondary value.
- Kept hard/extreme thresholds and roll behavior unchanged.
- Luck and Sanity controls are intentionally unchanged in this patch.

## 0.11.2

- Increased the visual contrast of investigator characteristic roll cards so clickable characteristics no longer blend into passive information panels.
- Added a brighter olive/bronze surface, stronger brass border and top highlight while preserving the existing Lovecraftian green palette.
- Brightened characteristic labels and dice cues; hover now increases contrast without changing layout or roll behavior.

## 0.11.1

- Rebuilt the investigator Characteristics tab into a compact vertical stack: all eight characteristics, one-row derived values, then native CoC7 conditions.
- Eight characteristics use one row at normal sheet widths and automatically fall back to a 4×2 grid on narrower windows.
- Removed redundant always-visible roll/condition instructional copy and the native-check hint card from this workspace to keep the full tab visible without scrolling at the default window size.
- Play-mode MOV, Build, and Armor now render as static readouts rather than readonly form inputs; Damage Bonus remains an explicit roll action.
- Added a consistent action affordance for previously subtle click targets: characteristic rolls, Luck/Sanity checks, Damage Bonus, skill checks, and inventory Item rows now have visible action styling/cues before hover.
- Added a shared `:focus-visible` treatment for investigator controls so keyboard interaction is as clear as pointer interaction.

## 0.11.0

- Added optional integration with `ginzzzu-coc7-player-hud` through its public `module.api.openCreation()` API.
- Assigned non-GM source investigators now show a compact creation assistant only when the Player HUD module is active and the action is relevant.
- Existing in-progress or ready Player HUD creation state shows **Continue creation** with the saved wizard step.
- A conservative **Start creation** action is shown only for an assigned investigator that has no saved creation progress and no meaningful manually entered character data.
- Completed wizard investigators, manually populated investigators, GMs, token instances, and worlds without Player HUD receive no integration banner.
- The integration reads existing Player HUD progress flag only to determine presentation; no creation data is copied into Ginzzzu's CoC7 Sheets.

## 0.10.2

- Removed the standalone Keeper utility panel.
- Grouped Mythos-insanity flags and natural healing into the compact **Character features** panel.
- Increased investigator tab-strip height and limited horizontal tab scrolling to genuinely narrow sheet widths.

## 0.10.1

- Reordered the investigator Keeper tab so active Sanity/insanity information comes first, followed by Sanity-loss encounters, immunities, Mythos-book study, utility data, and Keeper notes last.
- Renamed the primary Keeper Sanity block to “Рассудок и безумие” / “Sanity and Insanity”.
- Moved natural healing out of the Sanity block into a separate low-priority utility panel.
- Kept the existing native CoC7 fields, GM-only visibility, and interactive Keeper rich-text editor unchanged.

## 0.10.0

- Added the investigator Development tab backed by native CoC7 development data and Actor methods.
- Added individual marked-skill development checks, the full development phase, and native Luck development when enabled by CoC7 settings.
- Added marked-skill and character-creation point summaries without introducing module-owned progression data.
- Changed Keeper-facing Sanity labels to the full wording “Рассудок” / “Sanity”, including loss encounters and immunities.
- Fixed rich-text editor toolbar interaction in investigator Biography/Keeper editors by preserving Foundry's native ProseMirror layout and preventing toolbar controls from submitting the Actor form.

## 0.9.0

- Added the investigator Biography tab with native CoC7 one-block and section-based backstory modes.
- Added section creation, ordering, removal, and rich-text editing without module-owned biography data.
- Added a GM-only Keeper tab for hidden notes, Sanity loss encounters, immunities, Mythos flags, daily Sanity summary, and Mythos book study progress.
- Keeper-only controls update native CoC7 fields directly and are not rendered for players.

## 0.8.0

- Added the investigator `Possessions` workspace tab.
- Added grouped native CoC7 Items for gear, weapons, armor, books, spells, Pulp talents, and Keeper statuses.
- Added native Item create/open/delete controls in investigator edit mode without introducing module-owned inventory data.
- Added Credit Rating, spending level, cash, spent value, assets, asset details, and possessions notes using CoC7 `system.monetary`.
- Added automatic/manual monetary mode switching through the native `system.flags.manualCredit` flag.
- Kept weapon combat mechanics and the accepted 0.7.3 card layout unchanged.

## 0.7.3

- Removed the duplicate lower linked-skill control from investigator weapon cards.
- Rebuilt the weapon primary row so Attack, Skill check, Damage, attacks per round and malfunction share one readable card-height row.
- Kept the linked skill name as a tooltip instead of repeating it in a second large cell.
- Made the primary Attack control a distinct burgundy/red action while keeping skill and damage checks neutral.

## 0.7.2

- Reworked investigator weapon-card information hierarchy without changing CoC7 combat behavior.
- Promoted linked skill, attacks per round and malfunction into dedicated readable stat cells.
- Rebuilt ranged damage controls as larger equal segments with separate range label, distance and emphasized damage formula.
- Kept alternative weapon skill available as a distinct native skill-roll control.
- Added responsive layouts so the new stat and range controls remain usable in narrower sheets.

# Changelog

## 0.7.1

- Prevented the investigator header from shrinking over its edit controls, so identity fields and the source/token badge stay inside the header instead of overlapping the vitals row.
- Constrained edit-mode text/number inputs to their grid cells in Characteristics and Skills, avoiding Foundry input minimum widths pushing controls outside their cards or columns.
- Increased workspace hint text for better readability.
- Increased Combat action, weapon metadata, damage-range, ammunition and add-weapon text sizes while keeping the compact card layout.

## 0.7.0

- Added the investigator **Combat** tab with native CoC7 weapon attack cards, linked skill checks, direct damage rolls, ammunition display, native reload controls, weapon editing/deletion, and weapon creation in edit mode.
- Fixed investigator skill table headers so the play-mode columns stay on one horizontal grid row.
- Reworked investigator HP, MP, Luck, and Sanity in play mode: values are no longer editable number inputs and now use compact up/down controls; Shift changes by 5. Direct numeric input remains available only in edit mode.
- Play-mode HP and Sanity changes use native CoC7 Actor methods so normal system consequences continue to apply.
- Applied the Keeper NPC tobacco/leather/brass palette to location sheets as well, while preserving the dedicated location layout.

## 0.6.0

- Added the investigator Skills workspace with native CoC7 skill checks, search, filters, regular/hard/extreme values, and development marks.
- Added investigator edit-mode skill allocation controls for personal, occupation, archetype, experience package, and experience adjustments while keeping native CoC7 Skill Items.
- Added creation of a blank native Skill Item from the investigator sheet and access to the native skill editor.
- Added a dedicated warm tobacco/old-leather palette for human Keeper NPC sheets; creatures keep the purple palette and locations keep their existing palette.

## 0.5.0

- Renamed the package ID to `ginzzzu-coc7-sheets` and the title to **Ginzzzu's CoC7 Sheets**.
- Added a separate opt-in ApplicationV2 investigator sheet for CoC7 `character` Actors.
- Added investigator stage 1: portrait and identity editing, characteristics, HP/MP/Luck/Sanity, derived values, conditions, native CoC7 checks, and native lock/edit state.
- Preserved the existing Keeper NPC/creature/location sheet and ammunition synchronization.
- Extracted shared native Actor form handling and characteristic/attribute view-data helpers.

## 0.4.1

- Changed the ApplicationV2 window title for location Actors to `Location: {name}` / `Локация: {name}`.
- Added an edit-mode `Location mode` switch directly in the sheet header for NPC Actors.
- The switch updates the native `system.infos.type` field, so new location cards can be created entirely through the interface without module flags.
- Switching location mode on immediately opens the two-column location layout; switching it off restores the ordinary Keeper NPC layout.
- When possible, the sheet remembers the previous non-location type for the current open sheet session; otherwise it falls back to the localized Human value.

## 0.4.0

- Added an automatic location mode for NPC Actors whose native `system.infos.type` value is `Локация` or `Location`.
- Location mode keeps the portrait header but removes vitals, characteristics, derived values, conditions, tabs, skills, combat and inventory from the visible sheet.
- Public description and Keeper notes are displayed simultaneously in a fixed one-third / two-thirds column layout.
- Each text column scrolls independently and remains editable through the native Foundry ProseMirror fields.
- Non-GM users never receive the Keeper-notes column; the public description then occupies the available width.
- Location header fields relabel the existing native occupation, age and organization fields as Purpose, Access and Service / affiliation without adding module flags.
- Skipped the imported-skill compatibility repair for location Actors.

## 0.3.1

- Fixed Actor portrait changes being lost when leaving the local edit mode.
- The portrait picker is now available only while the sheet is in edit mode.
- Added a hidden native `img` form field and immediate persistence when Foundry changes the portrait element.
- Added a final save check before switching back to view mode, covering picker implementations which update only the current markup.
- Kept portrait data in the native Actor `img` field without module flags or duplicated storage.

## 0.3.0

- Reworked every weapon row so the weapon name is no longer a hidden click target.
- Added three explicit controls: native CoC7 Attack, standalone Skill check and standalone Damage roll.
- Kept ammunition consumption exclusive to the native Attack flow; skill and damage-only rolls never spend ammunition.
- Added a compact panel for all seven native CoC7 conditions: prone, unconscious, major wound, dying, dead, bout of madness and indefinite insanity.
- Condition buttons call the public CoC7 `toggleCondition` method, preserving system automation, status icons and linked-token synchronization.
- Added a header marker that identifies the opened document as the source Actor or an unlinked token instance.
- Preserved opt-in NPC and creature sheet registration and both visual themes.

## 0.2.5

- Added guarded ammunition synchronization for ranged-combat cards created from the Keeper sheet.
- Records the weapon ammunition before creating the native CoC7 card and compares it with the card's `totalBulletsFired` value after a shot.
- Repairs `system.ammo` only when CoC7 has not already reduced it, preventing double consumption.
- Refreshes open Keeper sheets after native or repaired ammunition updates, so the displayed counter no longer remains stale.
- Opening or cancelling a combat card still consumes no ammunition, and the native `disregardAmmo` setting remains respected.
- Documented that CoC7 result-text and success-star settings are client-scoped and therefore must be configured separately for each user's browser.

## 0.2.4

- Added ammunition-aware ranged attack handling without duplicating CoC7 combat logic.
- Native CoC7 ranged combat now remains the single owner of ammunition consumption: a completed single-shot attack reduces `system.ammo` by one, while burst and automatic attacks consume the amount chosen by the system.
- Opening or cancelling a combat card does not spend ammunition.
- Ranged weapons with a tracked empty magazine are blocked before creating the combat card and show a localized warning.
- Respects the native CoC7 `disregardAmmo` setting.

## 0.2.3

- Moved ammunition out of the damage column into a dedicated compact tracker inside each ranged weapon card.
- Current ammunition is editable directly during play without entering full sheet edit mode.
- Magazine capacity is shown beside the current value and becomes editable in sheet edit mode.
- Ammunition changes update the native CoC7 weapon Item fields (`system.ammo` and `system.bullets`).
- Removed the old ammunition text line that could overlap the damage control.

## 0.2.2

- Increased the combat damage column and separated damage, damage formula and ammunition line heights so Russian ammunition text no longer overlaps the rolled damage value.
- Collapsed empty description fact columns by switching the facts grid to `auto-fit`.
- Completed the creature palette for description facts and rich text, removing remaining NPC-green surfaces.
- Added a creature-specific roll hint that no longer refers to Sanity or Luck when those attributes are absent.

## 0.2.1

- Removed duplicate linked-skill display when CoC7 resolves an empty alternative weapon skill to the same Item as the main skill.
- Added a clickable damage control that rolls the selected weapon damage directly to chat.
- Damage rolls include native full or half damage-bonus properties and do not automatically apply damage to a target.
- Registered the sheet as an opt-in alternative for both `npc` and `creature` Actors.
- Added a dark eldritch-purple creature theme while retaining the same layout and controls.
- Creature Actors omit unassigned characteristics and vitals, and display their native sanity-loss pair when present.


## 0.2.0

- Added a right-side tab workspace for Skills, Combat, Inventory, Description and Keeper notes.
- Added native CoC7 weapon checks directly from each attack row, including Shift-click fast-forward behavior.
- Added linked combat-skill checks, damage display, weapon properties, ammunition display and attacks-per-round editing.
- Added inventory display for all non-skill, non-weapon embedded items, with native item-sheet editing and item creation.
- Added public NPC description and Keeper-only notes using the native CoC7 Actor fields and Foundry ProseMirror editing.
- Added organization display and editing without introducing module flags or duplicated Actor data.
- Kept the sheet opt-in and preserved the 0.1.4 first-open and imported-skill fixes.

## 0.1.4

- Fixed the first-open window lockup caused by starting a second partial render while the initial `ApplicationV2` render was still completing.
- The imported-skill compatibility repair is now scheduled after render listener setup through `queueMicrotask`.
- Removed the unnecessary post-repair `render({ parts: ["body"] })` call.
- Kept the repair batched, one-time per sheet instance and saved with `{ render: false }`.
- No visual, roll or data-model changes.

## 0.1.3

- Corrected imported NPC skills whose intended percentage was stored in numeric `system.base` while CoC7 8.15 expected `system.adjustments.base`.
- The sheet immediately displays the intended regular, hard and extreme values for this narrow legacy state.
- Editable NPC Actors are repaired once with a single batched embedded-document update, so native CoC7 skill rolls and the standard CoC7 sheet use the same corrected values afterward.
- Kept the normal CoC7 roll dialog and Shift-click quick-roll behavior unchanged.

## 0.1.2

- Rebuilt the alternative sheet as an independent `ApplicationV2` Actor sheet registered through `Actors.registerSheet`.
- Kept native CoC7 characteristic, attribute and skill rolls through public Actor methods.
- Preserved opt-in registration: the sheet does not become the default automatically.

## 0.1.0

- Added the first universal opt-in NPC sheet prototype.
