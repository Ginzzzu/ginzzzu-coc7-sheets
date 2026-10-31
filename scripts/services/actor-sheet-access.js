/** LIMITED is a portrait-only view; OBSERVER retains the normal read-only sheet. */
export function isLimitedActorView(document) {
  return !game.user.isGM && document.testUserPermission(game.user, "LIMITED", {exact: true});
}

export function limitedActorContext(document) {
  return {
    portrait: {name: document.name, img: document.img}
  };
}

/** Foundry disables all form controls for observers, including view navigation. */
export function enableReadOnlyNavigation(element, actions) {
  for (const action of actions) {
    for (const control of element.querySelectorAll(`[data-action="${action}"]`)) {
      control.disabled = false;
    }
  }
}
