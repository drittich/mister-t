// Sub-task graph helpers — shared by all popups, the card-back section, and client.js.
// Data model: card/shared/parentId (string|null) and card/shared/childIds (string[]).

(function (global) {
    'use strict';

    const SCOPE = 'shared';
    const KEY_PARENT = 'parentId';
    const KEY_CHILDREN = 'childIds';

    async function getParentId(t, cardId) {
        return (await t.get(cardId || 'card', SCOPE, KEY_PARENT)) || null;
    }

    async function getChildIds(t, cardId) {
        return (await t.get(cardId || 'card', SCOPE, KEY_CHILDREN)) || [];
    }

    async function setParentIdOn(t, cardId, parentId) {
        if (parentId === null) {
            return t.remove(cardId, SCOPE, KEY_PARENT);
        }
        return t.set(cardId, SCOPE, KEY_PARENT, parentId);
    }

    async function setChildIdsOn(t, cardId, childIds) {
        return t.set(cardId, SCOPE, KEY_CHILDREN, childIds);
    }

    // Walk ancestors from `proposedParentId` via parentId chain.
    // Returns true if `childId` appears anywhere up the chain — i.e. a cycle would form.
    async function detectCycle(t, childId, proposedParentId) {
        if (!proposedParentId) return false;
        if (proposedParentId === childId) return true;
        const visited = new Set();
        let cursor = proposedParentId;
        while (cursor && !visited.has(cursor)) {
            if (cursor === childId) return true;
            visited.add(cursor);
            cursor = await getParentId(t, cursor);
        }
        return false;
    }

    // Authoritative re-parent. Pass newParentId === null to detach.
    // - Validates no cycle.
    // - Removes child from old parent's childIds.
    // - Sets parentId on child (or removes it).
    // - Adds child to new parent's childIds.
    async function setParent(t, childId, newParentId) {
        if (newParentId && (await detectCycle(t, childId, newParentId))) {
            throw new Error('That would create a cycle — pick a different parent.');
        }

        const oldParentId = await getParentId(t, childId);
        if (oldParentId === newParentId) return;

        if (oldParentId) {
            const oldChildren = await getChildIds(t, oldParentId);
            await setChildIdsOn(t, oldParentId, oldChildren.filter((id) => id !== childId));
        }

        await setParentIdOn(t, childId, newParentId);

        if (newParentId) {
            const newChildren = await getChildIds(t, newParentId);
            if (!newChildren.includes(childId)) {
                await setChildIdsOn(t, newParentId, newChildren.concat(childId));
            }
        }
    }

    // Walk descendants of `cardId` breadth-first, fetching each level's
    // childIds in parallel (bounded). For a tree of depth D and N nodes,
    // that's roughly D round-trips to the Trello host instead of N.
    async function getDescendantIds(t, cardId) {
        const out = new Set();
        let frontier = [cardId];
        while (frontier.length) {
            const childLists = await mapLimit(frontier, 8, (id) => getChildIds(t, id));
            const next = [];
            for (const kids of childLists) {
                for (const k of kids) {
                    if (!out.has(k)) {
                        out.add(k);
                        next.push(k);
                    }
                }
            }
            frontier = next;
        }
        return out;
    }

    // Run `worker(item)` over `items` with at most `limit` in flight at once.
    // Bounded so a board of thousands of cards doesn't fire thousands of
    // concurrent postMessage round-trips at the host iframe.
    async function mapLimit(items, limit, worker) {
        const results = new Array(items.length);
        let next = 0;
        const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
            while (true) {
                const i = next++;
                if (i >= items.length) return;
                results[i] = await worker(items[i], i);
            }
        });
        await Promise.all(runners);
        return results;
    }

    // Rebuild every parent's childIds from the authoritative parentId on each card.
    // Returns { scanned, parentsUpdated }.
    async function rebuildIndex(t, onProgress) {
        const cards = await t.cards('all');
        const CONCURRENCY = 8;

        // Phase 1: read every card's parentId in parallel.
        let scanned = 0;
        const parentIds = await mapLimit(cards, CONCURRENCY, async (card) => {
            const pid = await getParentId(t, card.id);
            scanned++;
            if (onProgress) onProgress(scanned, cards.length);
            return pid;
        });
        const groups = new Map(); // parentId -> [childId]
        cards.forEach((card, i) => {
            const pid = parentIds[i];
            if (pid) {
                if (!groups.has(pid)) groups.set(pid, []);
                groups.get(pid).push(card.id);
            }
        });

        // Phase 2: write fresh childIds for parents that have children.
        const groupEntries = Array.from(groups.entries());
        await mapLimit(groupEntries, CONCURRENCY, ([parentId, kids]) => setChildIdsOn(t, parentId, kids));
        const parentsUpdated = groupEntries.length;

        // Phase 3: clear stale childIds on cards that no longer have any.
        // Best-effort: only clears cards we already know about — i.e. cards
        // on the board.
        const orphans = cards.filter((c) => !groups.has(c.id));
        await mapLimit(orphans, CONCURRENCY, async (card) => {
            const existing = await getChildIds(t, card.id);
            if (existing.length > 0) {
                await setChildIdsOn(t, card.id, []);
            }
        });

        return { scanned, parentsUpdated };
    }

    global.SubtaskGraph = {
        getParentId,
        getChildIds,
        setParent,
        detectCycle,
        getDescendantIds,
        rebuildIndex,
    };
})(window);
