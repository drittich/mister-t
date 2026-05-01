# Mister-T

A private, internal-only Trello Power-Up that adds parent/child sub-task
relationships to cards (any depth). Static files only — host on GitHub Pages,
register against your workspace, never publish to the Trello directory.

## Features

- **Add sub-task** card-button — create a new card and link it as a child, or
  attach an existing card as a child.
- **Change parent** card-button — re-parent a card or detach it (no parent).
- **Sub-tasks** card-back section — lists children (click to open), shows the
  parent card if any, and has a quick "+ Add sub-task" link.
- **Card badges** — front-of-card shows "N sub-tasks" if the card has children,
  and a "sub-task" tag if it has a parent.
- **Rebuild sub-tasks** board-button — repairs the child index from the
  authoritative `parentId` on each card; useful after manual data fixes.

## Data model

Each card stores at most two keys in its shared plugin data:

- `parentId` — string, the parent card's id, or absent for roots.
- `childIds` — array of strings, denormalised for fast reads.

`graph.setParent` keeps both sides in sync and rejects cycles.

## Hosting on GitHub Pages

1. Push this directory to a public GitHub repo.
2. **Settings → Pages → Source: `main` / root**, save.
3. Wait for the green check; your Power-Up's connector URL will be:
   ```
   https://<your-username>.github.io/<repo-name>/index.html
   ```

## Registering the Power-Up (workspace admin only)

1. Visit <https://trello.com/power-ups/admin>.
2. Pick the Workspace this Power-Up is for, click **New**.
3. Fill in:
   - **Name**: Sub-tasks (or whatever you like)
   - **Workspace**: your workspace
   - **Iframe connector URL**: the GitHub Pages URL from above
4. Save, then in the Power-Up's **Capabilities** tab tick:
   - `card-buttons`
   - `card-back-section`
   - `card-badges`
   - `card-detail-badges`
   - `board-buttons`
5. (Optional, only needed for the **Create new** sub-task flow) On the Power-Up's
   **API Key** tab, generate a key. The Power-Up reads this via
   `t.getRestApi()`. The first user who creates a sub-task in their browser
   will be prompted once to authorize the Power-Up to write cards.

## Enabling on a board

On any board in that Workspace: **Show menu → Power-Ups → Custom → Sub-tasks → Add**.

## Development notes

- No build step. Edit files, push, GitHub Pages serves them.
- GitHub Pages CDN can cache for ~10 min after a push. Force-reload Trello
  (Ctrl/Cmd+Shift+R) to pick up changes faster.
- The "Attach existing" and "Change parent" flows do not need API authorization —
  they only mutate plugin data via the iframe SDK. Only the "Create new" flow
  calls the Trello REST API and needs `t.getRestApi()`.
- Maximum plugin data is 4096 chars per scope/visibility per card. This fits
  ~100 child IDs per parent — way past anything realistic.

## File map

| File | Purpose |
|---|---|
| `index.html` | iframe connector — registers all capabilities |
| `js/client.js` | `TrelloPowerUp.initialize({...})` |
| `js/graph.js` | parent/child mutation, cycle detection, rebuild |
| `popups/add-subtask.html` | Create new + Attach existing |
| `popups/change-parent.html` | Re-parent + Detach |
| `popups/children-section.html` | Card-back section UI |
| `popups/rebuild.html` | Board-level index repair |
| `icons/subtask.svg` | Gray icon for buttons & badges |
| `css/popup.css` | Shared popup styles |
