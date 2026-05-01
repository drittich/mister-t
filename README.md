# Mister-T

A Trello Power-Up that adds **parent / child sub-task relationships** to your
cards — to any depth. Break big cards into smaller ones, navigate the tree from
either direction, and keep your board organised without leaving Trello.

---

## Features

- **Add sub-task** card-button — create a brand-new child card, or attach an
  existing card on the board as a child.
- **Change parent** card-button — re-parent a card under a different one, or
  detach it so it has no parent. Cycles are blocked automatically.
- **Sub-tasks** card-back section — a built-in panel on every card showing:
  - the parent card (with a link to open it and a **Change** action),
  - **‹ Prev / Next ›** buttons to walk through siblings under the same parent,
  - the list of children (click to open, or **Detach** with one-click undo),
  - a clear **empty-state CTA** when the card has no sub-tasks yet,
  - a quick **+ Add sub-task** link when it does.
- **Card badges (front of card)** — at a glance you see *“N sub-tasks”* on
  parents and a *“sub-task”* tag on children, so the tree is visible from the
  board view.
- **Card detail badges** — on the card back, a **Sub-tasks: N** badge and a
  **Parent: View** badge that jumps to the parent card.
- **Rebuild sub-tasks** board-button — repairs the children index from the
  authoritative parent links on each card. Handy after manual data fixes or
  bulk imports.
- **Undo on detach** — detaching a sub-task shows a 6-second undo strip so
  accidental clicks are reversible.
- **Cycle protection** — the graph helper rejects any change that would create
  a loop (A → B → A).

---

## Registering the Power-Up (workspace admin)

1. Go to <https://trello.com/power-ups/admin>.
2. Pick the Workspace this Power-Up is for and click **New**.
3. Fill in:
   - **Name**: Sub-tasks (or whatever you like)
   - **Workspace**: your workspace
   - **Iframe connector URL**: the URL where you’re hosting `index.html`
4. Save, then on the Power-Up’s **Capabilities** tab tick:
   - `card-buttons`
   - `card-back-section`
   - `card-badges`
   - `card-detail-badges`
   - `board-buttons`
5. *(Optional — only needed for the **Create new** sub-task flow.)* On the
   Power-Up’s **API Key** tab, generate a key. The Power-Up reads it via
   `t.getRestApi()`. The first user who creates a sub-task in their browser
   will be prompted once to authorise the Power-Up to write cards.

## Enabling on a board

On any board in that Workspace: **Show menu → Power-Ups → Custom → Sub-tasks → Add**.

---

## Using Mister-T

### Create a sub-task

1. Open any card.
2. Click **Add sub-task** in the card buttons (or the empty-state CTA in the
   *Sub-tasks* section on the card back).
3. Choose:
   - **Create new** — type a name, pick a list, click **Create sub-task**. A
     new card is created on that list and linked as a child.
   - **Attach existing** — search for any card on the board and pick it. It
     becomes a child of the current card.

### Re-parent or detach a card

- Open the card and click **Change parent**, or click **Change** on the parent
  line in the *Sub-tasks* section.
- Pick a different card to be the new parent, or click **Detach** to make this
  card a root (no parent).

### Navigate the tree

- **Down**: click any child in the *Sub-tasks* section.
- **Up**: click the parent line, or use the **Parent: View** detail badge.
- **Sideways**: use **‹ Prev / Next ›** in the parent line to jump between
  siblings under the same parent.

### Rebuild the index

If the children list ever looks out of sync (rare — usually only after manual
plugin-data edits), open the **Rebuild sub-tasks** board-button. It walks every
card, reads each card’s parent link, and regenerates the children index from
that authoritative source.

---

## Tips

- The **Attach existing** and **Change parent** flows do **not** need API
  authorisation — they only update the Power-Up’s plugin data via the iframe
  SDK. Only **Create new** calls the Trello REST API.
- A card whose parent lives on a different board will show *“(card not on this
  board)”* — Mister-T can only resolve names for cards visible on the current
  board.
- After pushing changes to your hosting, Trello may serve cached files for a
  few minutes. Force-reload (Ctrl/Cmd + Shift + R) to pick up updates faster.

---

## Data model

Each card stores at most two keys in its shared plugin data:

| Key | Type | Meaning |
|---|---|---|
| `parentId` | `string` | The parent card’s id, or absent for roots. |
| `childIds` | `string[]` | Denormalised list of child card ids, for fast reads. |

`graph.setParent` is the only authoritative writer — it keeps both sides in
sync, removes the child from any old parent, and rejects cycles before they
form. The denormalised `childIds` list can be regenerated at any time from the
`parentId` links via the **Rebuild sub-tasks** board-button.

> Trello caps plugin data at **4096 chars per scope/visibility per card**. That
> fits roughly **100 child IDs** per parent — well past anything realistic.

---

## Development notes

- **No build step.** Edit files, deploy, reload Trello.
- All capability registration lives in [js/client.js](js/client.js); all
  graph mutation lives in [js/graph.js](js/graph.js).
- Popups are plain HTML files under [popups/](popups/) and share styles via
  [css/popup.css](css/popup.css).
