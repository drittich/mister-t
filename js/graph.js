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

    // Walk descendants of `cardId` (DFS). Used for filtering out cards that
    // can't legally become a parent of `cardId`.
    async function getDescendantIds(t, cardId) {
        const out = new Set();
        const stack = [cardId];
        while (stack.length) {
            const cur = stack.pop();
            const kids = await getChildIds(t, cur);
            for (const k of kids) {
                if (!out.has(k)) {
                    out.add(k);
                    stack.push(k);
                }
            }
        }
        return out;
    }

    // Rebuild every parent's childIds from the authoritative parentId on each card.
    // Returns { scanned, parentsUpdated }.
    async function rebuildIndex(t, onProgress) {
        const cards = await t.cards('all');
        const groups = new Map(); // parentId -> [childId]
        let scanned = 0;
        for (const card of cards) {
            const pid = await getParentId(t, card.id);
            if (pid) {
                if (!groups.has(pid)) groups.set(pid, []);
                groups.get(pid).push(card.id);
            }
            scanned++;
            if (onProgress) onProgress(scanned, cards.length);
        }
        // Write fresh childIds for parents that have children.
        let parentsUpdated = 0;
        for (const [parentId, kids] of groups.entries()) {
            await setChildIdsOn(t, parentId, kids);
            parentsUpdated++;
        }
        // Clear childIds on parents that no longer have any (best-effort: only clears
        // cards we already know about — i.e. cards on the board).
        for (const card of cards) {
            if (!groups.has(card.id)) {
                const existing = await getChildIds(t, card.id);
                if (existing.length > 0) {
                    await setChildIdsOn(t, card.id, []);
                }
            }
        }
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
