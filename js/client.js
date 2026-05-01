// Capability registration for the Sub-tasks Power-Up.
// Loaded only by index.html (the iframe connector) — popups have their own scripts.

(function () {
    'use strict';

    const ICON = './icons/subtask.svg';

    TrelloPowerUp.initialize({
        'card-buttons': function (t) {
            return [
                {
                    icon: ICON,
                    text: 'Add sub-task',
                    callback: function (t) {
                        return t.popup({
                            title: 'Add sub-task',
                            url: 'popups/add-subtask.html',
                            height: 280,
                        });
                    },
                },
                {
                    icon: ICON,
                    text: 'Change parent',
                    callback: function (t) {
                        return t.popup({
                            title: 'Change parent',
                            url: 'popups/change-parent.html',
                            height: 320,
                        });
                    },
                },
            ];
        },

        'card-back-section': function (t) {
            return {
                title: 'Sub-tasks',
                icon: ICON,
                content: {
                    type: 'iframe',
                    url: t.signUrl('./popups/children-section.html'),
                    height: 220,
                },
            };
        },

        'card-badges': async function (t) {
            const childIds = await SubtaskGraph.getChildIds(t);
            const parentId = await SubtaskGraph.getParentId(t);
            const badges = [];
            if (childIds.length) {
                badges.push({
                    text: childIds.length + (childIds.length === 1 ? ' sub-task' : ' sub-tasks'),
                    icon: ICON,
                    color: null,
                });
            }
            if (parentId) {
                badges.push({ text: 'sub-task', icon: ICON, color: null });
            }
            return badges;
        },

        'card-detail-badges': async function (t) {
            const childIds = await SubtaskGraph.getChildIds(t);
            const parentId = await SubtaskGraph.getParentId(t);
            const badges = [];
            if (childIds.length) {
                badges.push({
                    title: 'Sub-tasks',
                    text: String(childIds.length),
                    color: null,
                });
            }
            if (parentId) {
                badges.push({
                    title: 'Parent',
                    text: 'View',
                    color: null,
                    callback: function (t) {
                        return t.showCard(parentId);
                    },
                });
            }
            return badges;
        },

        'board-buttons': function () {
            return [
                {
                    icon: { dark: ICON, light: ICON },
                    text: 'Rebuild sub-tasks',
                    callback: function (t) {
                        return t.popup({
                            title: 'Rebuild sub-task index',
                            url: 'popups/rebuild.html',
                            height: 200,
                        });
                    },
                },
            ];
        },
    });
})();
