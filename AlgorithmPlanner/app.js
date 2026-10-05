"use strict";

const STORAGE_KEY = "algorithmPlanner.project.v1";
const MAX_HISTORY = 60;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const clone = value => JSON.parse(JSON.stringify(value));
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const defaults = {
    process: () => ({ id: uid("node"), type: "process", code: "ergebnis = wert * 2", label: "Wert verarbeiten" }),
    input: () => ({ id: uid("node"), type: "input", variable: "wert", prompt: "Wert eingeben:", dataType: "int" }),
    output: () => ({ id: uid("node"), type: "output", expression: "ergebnis", label: "Ergebnis ausgeben" }),
    if: () => ({ id: uid("node"), type: "if", condition: "wert > 0", then: [], else: [] }),
    while: () => ({ id: uid("node"), type: "while", condition: "wert > 0", body: [] }),
    for: () => ({ id: uid("node"), type: "for", variable: "i", start: "0", end: "10", step: "1", body: [] }),
    call: () => ({ id: uid("node"), type: "call", routineId: "", arguments: "", assignTo: "" }),
    return: () => ({ id: uid("node"), type: "return", expression: "ergebnis" }),
    comment: () => ({ id: uid("node"), type: "comment", text: "Beschreibung des nächsten Schritts" })
};

function blankState() {
    const mainId = uid("routine");
    return {
        version: 2,
        name: "Mein Programm",
        view: "structogram",
        visualStyle: "neon",
        activeRoutineId: mainId,
        routines: [{ id: mainId, name: "algorithm", kind: "main", visibility: "public", parameters: "", algorithm: [], flowComments: [] }],
        classes: [],
        relations: []
    };
}

let state = blankState();
let selection = null;
let branchTarget = null;
let history = [];
let future = [];
let pendingNodeType = null;
let toastTimer = 0;
let selectedNodeIds = new Set();
let zoomLevel = 1;
let dragInProgress = false;

const diagramCanvas = $("#diagramCanvas");
const inspector = $("#nodeInspector");

function snapshot() {
    return JSON.stringify(state);
}

function activeRoutine() {
    return state.routines.find(routine => routine.id === state.activeRoutineId) || state.routines[0];
}

function resetSelection() {
    selection = null;
    selectedNodeIds.clear();
    branchTarget = null;
}

function persistLocal(showMessage = false) {
    try {
        localStorage.setItem(STORAGE_KEY, snapshot());
        const status = $("#storageStatus");
        if (status) {
            status.textContent = `Gespeichert ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
            status.title = `Automatisch im localStorage dieses Browsers gespeichert (${STORAGE_KEY})`;
        }
        if (showMessage) toast("Im Browser gespeichert");
    } catch {
        toast("Lokales Speichern wurde vom Browser blockiert");
    }
}

function commit(mutator, message = "") {
    history.push(snapshot());
    if (history.length > MAX_HISTORY) history.shift();
    future = [];
    mutator();
    persistLocal();
    render();
    if (message) toast(message);
}

function undo() {
    if (!history.length) return;
    future.push(snapshot());
    state = JSON.parse(history.pop());
    resetSelection();
    persistLocal();
    render();
}

function redo() {
    if (!future.length) return;
    history.push(snapshot());
    state = JSON.parse(future.pop());
    resetSelection();
    persistLocal();
    render();
}

function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 2100);
}

function activateInspectorTab(name) {
    $$(".tab").forEach(item => item.classList.toggle("active", item.dataset.tab === name));
    $$(".tab-content").forEach(item => item.classList.toggle("active", item.id === `${name}Tab`));
}

function walkNodes(nodes, visitor, parent = null, branch = "root") {
    for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        if (visitor(node, nodes, index, parent, branch) === false) return false;
        if (node.type === "if") {
            if (walkNodes(node.then, visitor, node, "then") === false) return false;
            if (walkNodes(node.else, visitor, node, "else") === false) return false;
        } else if (node.body) {
            if (walkNodes(node.body, visitor, node, "body") === false) return false;
        }
    }
    return true;
}

function locateNode(id) {
    let result = null;
    for (const routine of state.routines) {
        walkNodes(routine.algorithm, (node, container, index, parent, branch) => {
            if (node.id === id) {
                result = { node, container, index, parent, branch, routine };
                return false;
            }
        });
        if (result) break;
    }
    return result;
}

function selectedClass() {
    return selection?.kind === "class" ? state.classes.find(item => item.id === selection.id) : null;
}

function selectedRelation() {
    return selection?.kind === "relation" ? state.relations.find(item => item.id === selection.id) : null;
}

function locateFlowComment(id) {
    for (const routine of state.routines) {
        const comment = routine.flowComments.find(item => item.id === id);
        if (comment) return { comment, routine };
    }
    return null;
}

function selectedFlowComment() {
    return selection?.kind === "flowComment" ? locateFlowComment(selection.id)?.comment : null;
}

function addFlowComment() {
    const routine = activeRoutine();
    const index = routine.flowComments.length;
    const comment = { id: uid("note"), text: "Hinweis zum Ablauf", x: 455 + (index % 2) * 210, y: 80 + Math.floor(index / 2) * 110 };
    commit(() => {
        routine.flowComments.push(comment);
        selectedNodeIds.clear();
        selection = { kind: "flowComment", id: comment.id };
    }, "Freier Kommentar hinzugefügt");
    activateInspectorTab("properties");
}

async function addAlgorithmNode(type) {
    if (!defaults[type]) return;
    pendingNodeType = type;
    const sourceRoutine = activeRoutine();
    let autoRoutine = null;
    if (type === "call") {
        autoRoutine = { id: uid("routine"), name: `unterroutine_${state.routines.length}`, kind: "subroutine", visibility: "private", parameters: "", algorithm: [], flowComments: [] };
    }
    const selected = selection?.kind === "node" ? locateNode(selection.id) : null;

    if (selected?.node.type === "if" && !branchTarget) {
        $("#branchDialog").showModal();
        return;
    }

    let destination = sourceRoutine.algorithm;
    let index = destination.length;
    if (selected) {
        if (branchTarget && branchTarget.parentId === selected.node.id && ["then", "else"].includes(branchTarget.branch)) {
            destination = selected.node[branchTarget.branch];
            index = destination.length;
        } else if (branchTarget && branchTarget.parentId === selected.node.id && branchTarget.branch === "body" && selected.node.body) {
            destination = selected.node.body;
            index = destination.length;
        } else if (branchTarget && branchTarget.parentId === selected.node.id && branchTarget.branch === "routine" && selected.node.type === "call") {
            destination = state.routines.find(routine => routine.id === selected.node.routineId)?.algorithm || destination;
            index = destination.length;
        } else if (["while", "for"].includes(selected.node.type)) {
            destination = selected.node.body;
            index = destination.length;
        } else if (selected.node.type === "call") {
            destination = state.routines.find(routine => routine.id === selected.node.routineId)?.algorithm || destination;
            index = destination.length;
        } else {
            destination = selected.container;
            index = selected.index + 1;
        }
    }

    const node = defaults[type]();
    if (type === "call") node.routineId = autoRoutine.id;
    commit(() => {
        if (autoRoutine) state.routines.push(autoRoutine);
        destination.splice(index, 0, node);
        selection = { kind: "node", id: node.id };
        selectedNodeIds = new Set([node.id]);
        state.activeRoutineId = locateNode(node.id)?.routine.id || state.activeRoutineId;
        branchTarget = null;
    }, "Baustein eingefügt");
}

function completeBranchInsert(branch) {
    const selected = selection?.kind === "node" ? locateNode(selection.id) : null;
    if (!selected || !pendingNodeType) return;
    const node = defaults[pendingNodeType]();
    let autoRoutine = null;
    if (pendingNodeType === "call") {
        autoRoutine = { id: uid("routine"), name: `unterroutine_${state.routines.length}`, kind: "subroutine", visibility: "private", parameters: "", algorithm: [], flowComments: [] };
        node.routineId = autoRoutine.id;
    }
    let destination;
    let index;
    if (branch === "after") {
        destination = selected.container;
        index = selected.index + 1;
    } else {
        destination = selected.node[branch];
        index = destination.length;
    }
    commit(() => {
        if (autoRoutine) state.routines.push(autoRoutine);
        destination.splice(index, 0, node);
        selection = { kind: "node", id: node.id };
        selectedNodeIds = new Set([node.id]);
        state.activeRoutineId = locateNode(node.id)?.routine.id || state.activeRoutineId;
        branchTarget = null;
    }, "Baustein eingefügt");
    pendingNodeType = null;
}

function addClass() {
    const offset = state.classes.length % 6;
    const item = {
        id: uid("class"),
        name: `NeueKlasse${state.classes.length + 1}`,
        stereotype: "class",
        abstract: false,
        x: 45 + (offset % 3) * 285,
        y: 45 + Math.floor(offset / 3) * 250,
        attributes: [],
        methods: []
    };
    commit(() => {
        state.classes.push(item);
        selection = { kind: "class", id: item.id };
    }, "Klasse angelegt");
}

function addClassMember(kind) {
    const item = selectedClass();
    if (!item) {
        toast("Wähle zuerst eine Klasse aus.");
        return;
    }
    commit(() => {
        if (kind === "attribute") item.attributes.push({ id: uid("attr"), visibility: "private", name: "attribut", type: "String", defaultValue: "" });
        else item.methods.push({ id: uid("method"), visibility: "public", name: "methode", returnType: "void", parameters: "" });
    }, kind === "attribute" ? "Attribut hinzugefügt" : "Methode hinzugefügt");
}

function openRelationDialog() {
    if (state.classes.length < 2) {
        toast("Für eine Beziehung werden mindestens zwei Klassen benötigt.");
        return;
    }
    const options = state.classes.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
    $("#relationFrom").innerHTML = options;
    $("#relationTo").innerHTML = options;
    const current = selectedClass();
    if (current) $("#relationFrom").value = current.id;
    $("#relationTo").selectedIndex = state.classes.findIndex(item => item.id !== $("#relationFrom").value);
    $("#relationLabel").value = "";
    $("#relationDialog").showModal();
}

function createRelation() {
    const from = $("#relationFrom").value;
    const to = $("#relationTo").value;
    if (from === to) {
        toast("Eine Klasse kann hier nicht mit sich selbst verbunden werden.");
        return false;
    }
    const relation = { id: uid("rel"), from, to, type: $("#relationType").value, label: $("#relationLabel").value.trim(), fromMultiplicity: "", toMultiplicity: "" };
    commit(() => {
        state.relations.push(relation);
        selection = { kind: "relation", id: relation.id };
    }, "Beziehung angelegt");
    return true;
}

function addRoutine() {
    const count = state.routines.length;
    const routine = { id: uid("routine"), name: `unterroutine_${count}`, kind: "subroutine", visibility: "private", parameters: "", algorithm: [], flowComments: [] };
    commit(() => {
        state.routines.push(routine);
        state.activeRoutineId = routine.id;
        resetSelection();
    }, "Unterroutine angelegt");
}

function deleteActiveRoutine() {
    if (state.routines.length === 1) {
        toast("Die einzige Hauptroutine kann nicht gelöscht werden.");
        return;
    }
    const routine = activeRoutine();
    if (!confirm(`Routine „${routine.name}“ wirklich löschen?`)) return;
    commit(() => {
        state.routines = state.routines.filter(item => item.id !== routine.id);
        if (!state.routines.some(item => item.kind === "main")) state.routines[0].kind = "main";
        state.activeRoutineId = state.routines[0].id;
        resetSelection();
    }, "Routine gelöscht");
}

function deleteSelection() {
    if (!selection) return;
    commit(() => {
        if (selection.kind === "node") {
            const ids = selectedNodeIds.size ? [...selectedNodeIds] : [selection.id];
            const locations = ids.map(locateNode).filter(Boolean).sort((a, b) => b.index - a.index);
            for (const found of locations) {
                if (found.container[found.index]?.id === found.node.id) found.container.splice(found.index, 1);
                else {
                    const currentIndex = found.container.findIndex(node => node.id === found.node.id);
                    if (currentIndex >= 0) found.container.splice(currentIndex, 1);
                }
            }
        } else if (selection.kind === "class") {
            state.classes = state.classes.filter(item => item.id !== selection.id);
            state.relations = state.relations.filter(item => item.from !== selection.id && item.to !== selection.id);
        } else if (selection.kind === "relation") {
            state.relations = state.relations.filter(item => item.id !== selection.id);
        } else if (selection.kind === "flowComment") {
            const found = locateFlowComment(selection.id);
            if (found) found.routine.flowComments = found.routine.flowComments.filter(item => item.id !== selection.id);
        }
        resetSelection();
    }, "Auswahl gelöscht");
}

function moveSelection(direction) {
    if (selection?.kind !== "node") return;
    const locations = [...selectedNodeIds].map(locateNode).filter(Boolean);
    if (!locations.length) return;
    const sameContainer = locations.every(item => item.container === locations[0].container);
    if (!sameContainer) { toast("Pfeilverschiebung ist nur innerhalb eines Bereichs möglich."); return; }
    const container = locations[0].container;
    const indexes = locations.map(item => container.findIndex(node => node.id === item.node.id)).sort((a, b) => a - b);
    if ((direction < 0 && indexes[0] === 0) || (direction > 0 && indexes[indexes.length - 1] === container.length - 1)) return;
    commit(() => {
        if (direction < 0) {
            const before = container[indexes[0] - 1];
            container.splice(indexes[0] - 1, 1);
            container.splice(indexes[indexes.length - 1], 0, before);
        } else {
            const after = container[indexes[indexes.length - 1] + 1];
            container.splice(indexes[indexes.length - 1] + 1, 1);
            container.splice(indexes[0], 0, after);
        }
    });
}

function nodeText(node) {
    switch (node.type) {
        case "process": return node.label || node.code;
        case "input": return `${node.variable} einlesen`;
        case "output": return node.label || `${node.expression} ausgeben`;
        case "if": return node.condition;
        case "while": return `solange ${node.condition}`;
        case "for": return `${node.variable} = ${node.start} … ${node.end}`;
        case "call": {
            const routine = state.routines.find(item => item.id === node.routineId);
            const call = `${routine?.name || "Unterroutine"}(${node.arguments || ""})`;
            return node.assignTo ? `${node.assignTo} ← ${call}` : call;
        }
        case "return": return `Rückgabe ${node.expression}`;
        case "comment": return node.text;
        default: return node.type;
    }
}

function typeLabel(type) {
    return ({ process: "Verarbeitung", input: "Eingabe", output: "Ausgabe", if: "Verzweigung", while: "Solange-Schleife", for: "Zählschleife", call: "Unterroutinenaufruf", return: "Rückgabe", comment: "Kommentar" })[type] || type;
}

function renderStructogram() {
    const renderSequence = (nodes, parentId = "", branch = "") => {
        const blocks = nodes.length ? nodes.map(renderNode).join("") : '<div class="empty-branch">Noch keine Bausteine</div>';
        const target = parentId ? `<button class="nest-drop-zone${branchTarget?.parentId === parentId && branchTarget?.branch === branch ? " active" : ""}" data-nest-parent="${parentId}" data-nest-branch="${branch}" type="button">+ Hier verschachteln</button>` : "";
        return blocks + target;
    };
    const renderNode = node => {
        const selected = selection?.kind === "node" && selection.id === node.id ? " selected" : "";
        const multi = selectedNodeIds.has(node.id) ? " multi-selected" : "";
        if (node.type === "if") {
            return `<div class="struct-block struct-if${selected}${multi}" draggable="true" data-node-id="${node.id}"><div class="struct-condition"><span class="block-type">Wenn</span>${escapeHtml(node.condition)}</div><div class="struct-branches"><div class="struct-branch"><div class="branch-label">Dann</div>${renderSequence(node.then, node.id, "then")}</div><div class="struct-branch"><div class="branch-label">Sonst</div>${renderSequence(node.else, node.id, "else")}</div></div></div>`;
        }
        if (["while", "for"].includes(node.type)) {
            return `<div class="struct-block struct-loop${selected}${multi}" draggable="true" data-node-id="${node.id}"><div class="loop-header"><span class="block-type">${escapeHtml(typeLabel(node.type))}</span>${escapeHtml(nodeText(node))}</div><div class="loop-body">${renderSequence(node.body, node.id, "body")}</div></div>`;
        }
        if (node.type === "call") {
            const target = state.routines.find(routine => routine.id === node.routineId);
            const active = branchTarget?.parentId === node.id && branchTarget?.branch === "routine" ? " active" : "";
            return `<div class="struct-block struct-call${selected}${multi}" draggable="true" data-node-id="${node.id}"><span class="block-type">${escapeHtml(typeLabel(node.type))}</span>${escapeHtml(nodeText(node))}<button class="nest-drop-zone call-target${active}" data-nest-parent="${node.id}" data-nest-branch="routine" type="button">+ In ${escapeHtml(target?.name || "Unterroutine")} einfügen</button></div>`;
        }
        return `<div class="struct-block${node.type === "comment" ? " struct-comment" : ""}${node.type === "call" ? " struct-call" : ""}${selected}${multi}" draggable="true" data-node-id="${node.id}"><span class="block-type">${escapeHtml(typeLabel(node.type))}</span>${escapeHtml(nodeText(node))}</div>`;
    };

    diagramCanvas.innerHTML = `<div class="multi-diagram-grid">${state.routines.map(routine => `<section class="routine-column ${routine.id === state.activeRoutineId ? "active-routine" : ""}" data-routine-id="${routine.id}"><div class="routine-caption">${routine.kind === "main" ? "Hauptalgorithmus" : "Unterroutine"}</div><div class="structogram"><div class="struct-title">${escapeHtml(routine.name)}</div>${renderSequence(routine.algorithm)}<button class="drop-at-end" data-drop-routine="${routine.id}" type="button">+ In ${escapeHtml(routine.name)} einfügen</button></div></section>`).join("")}</div>`;
}

function buildFlowchart(routine, routineIndex) {
    const placed = [];
    const edges = [];
    const nodeWidth = 210;
    const nodeHeight = 62;

    function addPlaced(node, x, y) {
        const height = node.type === "if" ? 90 : nodeHeight;
        placed.push({ node, x: x - nodeWidth / 2, y, width: node.type === "if" ? 170 : nodeWidth, height });
        return { id: node.id, x, y, height };
    }

    function connect(from, to, label = "") {
        edges.push({ from, to, label });
    }

    function layoutSequence(nodes, x, y, incoming = []) {
        let exits = incoming;
        let first = null;
        let cursorY = y;
        for (const node of nodes) {
            const current = addPlaced(node, x, cursorY);
            if (!first) first = current;
            exits.forEach(exit => connect(exit, current));

            if (node.type === "if") {
                const branchY = cursorY + 145;
                const thenResult = layoutSequence(node.then, x - 190, branchY, []);
                const elseResult = layoutSequence(node.else, x + 190, branchY, []);
                if (thenResult.first) connect(current, thenResult.first, "ja");
                if (elseResult.first) connect(current, elseResult.first, "nein");
                exits = [
                    ...(thenResult.exits.length ? thenResult.exits : [{ ...current, x: x - 55 }]),
                    ...(elseResult.exits.length ? elseResult.exits : [{ ...current, x: x + 55 }])
                ];
                cursorY = Math.max(thenResult.bottom, elseResult.bottom, branchY) + 75;
            } else if (["while", "for"].includes(node.type)) {
                const bodyResult = layoutSequence(node.body, x + 190, cursorY + 115, []);
                if (bodyResult.first) {
                    connect(current, bodyResult.first, "ja");
                    bodyResult.exits.forEach(exit => connect(exit, current, "zurück"));
                }
                exits = [current];
                cursorY = Math.max(cursorY + 105, bodyResult.bottom + 55);
            } else {
                exits = [current];
                cursorY += 105;
            }
        }
        return { first, exits, bottom: cursorY };
    }

    const start = { id: "__start", x: 340, y: 20, height: 54 };
    placed.push({ node: { id: "__start", type: "start" }, x: 235, y: 20, width: 210, height: 54 });
    const result = layoutSequence(routine.algorithm, 340, 120, [start]);
    const endY = Math.max(result.bottom, 150);
    const end = { id: "__end", x: 340, y: endY, height: 54 };
    placed.push({ node: { id: "__end", type: "end" }, x: 235, y: endY, width: 210, height: 54 });
    result.exits.forEach(exit => connect(exit, end));
    if (!routine.algorithm.length) connect(start, end);

    const maxX = Math.max(680, ...placed.map(item => item.x + item.width + (["while", "for", "call"].includes(item.node.type) ? 210 : 70)), ...routine.flowComments.map(comment => comment.x + 230));
    const minX = Math.min(0, ...placed.map(item => item.x - (item.node.type === "if" ? 130 : 50)));
    const shift = minX < 0 ? -minX : 0;
    placed.forEach(item => item.x += shift);
    edges.forEach(edge => { edge.from = { ...edge.from, x: edge.from.x + shift }; edge.to = { ...edge.to, x: edge.to.x + shift }; });

    const positions = new Map(placed.map(item => [item.node.id, item]));
    const edgeSvg = edges.map(edge => {
        const from = positions.get(edge.from.id) || edge.from;
        const to = positions.get(edge.to.id) || edge.to;
        const x1 = from.x + (from.width || 0) / 2;
        const y1 = from.y + (from.height || 54);
        const x2 = to.x + (to.width || 0) / 2;
        const y2 = to.y;
        const mid = Math.max(y1 + 24, (y1 + y2) / 2);
        const path = `M ${x1} ${y1} L ${x1} ${mid} L ${x2} ${mid} L ${x2} ${y2}`;
        const label = edge.label ? `<text class="flow-edge-label" x="${x1 + 7}" y="${mid - 5}">${escapeHtml(edge.label)}</text>` : "";
        return `<path class="flow-edge" d="${path}" marker-end="url(#arrow_${routineIndex})"></path>${label}`;
    }).join("");

    const nodesHtml = placed.map(item => {
        const id = item.node.id;
        const system = id.startsWith("__");
        const selected = selection?.kind === "node" && selection.id === id ? " selected" : "";
        const multi = selectedNodeIds.has(id) ? " multi-selected" : "";
        const label = item.node.type === "start" ? "Start" : item.node.type === "end" ? "Ende" : nodeText(item.node);
        return `<div class="flow-node ${item.node.type}${selected}${multi}" ${system ? "" : `draggable="true" data-node-id="${id}"`} style="left:${item.x}px;top:${item.y}px"><span>${escapeHtml(label)}</span></div>`;
    }).join("");
    const nestTargetsHtml = placed.filter(item => ["if", "while", "for", "call"].includes(item.node.type)).map(item => {
        if (item.node.type === "if") {
            const thenActive = branchTarget?.parentId === item.node.id && branchTarget?.branch === "then" ? " active" : "";
            const elseActive = branchTarget?.parentId === item.node.id && branchTarget?.branch === "else" ? " active" : "";
            return `<button class="flow-nest-target branch-then${thenActive}" data-nest-parent="${item.node.id}" data-nest-branch="then" style="left:${item.x - 105}px;top:${item.y + 98}px" type="button">+ Dann</button><button class="flow-nest-target branch-else${elseActive}" data-nest-parent="${item.node.id}" data-nest-branch="else" style="left:${item.x + item.width + 15}px;top:${item.y + 98}px" type="button">+ Sonst</button>`;
        }
        const isCall = item.node.type === "call";
        const branch = isCall ? "routine" : "body";
        const active = branchTarget?.parentId === item.node.id && branchTarget?.branch === branch ? " active" : "";
        const targetRoutine = isCall ? state.routines.find(routine => routine.id === item.node.routineId) : null;
        return `<button class="flow-nest-target ${isCall ? "call-target" : "loop-target"}${active}" data-nest-parent="${item.node.id}" data-nest-branch="${branch}" style="left:${item.x + item.width + 18}px;top:${item.y + 15}px" type="button">+ In ${isCall ? escapeHtml(targetRoutine?.name || "Unterroutine") : "Schleife"}</button>`;
    }).join("");
    const commentsHtml = routine.flowComments.map(comment => `<aside class="flow-comment${selection?.kind === "flowComment" && selection.id === comment.id ? " selected" : ""}" data-flow-comment-id="${comment.id}" style="left:${comment.x}px;top:${comment.y}px">${escapeHtml(comment.text)}</aside>`).join("");
    const flowHeight = Math.max(endY + 130, ...routine.flowComments.map(comment => comment.y + 120));

    return `<section class="routine-column ${routine.id === state.activeRoutineId ? "active-routine" : ""}" data-routine-id="${routine.id}"><div class="routine-caption">${routine.kind === "main" ? "Hauptalgorithmus" : "Unterroutine"}: ${escapeHtml(routine.name)}</div><div class="flow-wrap" style="width:${maxX + shift}px;height:${flowHeight}px"><svg class="flow-svg" width="100%" height="100%"><defs><marker id="arrow_${routineIndex}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#7594aa"></path></marker></defs>${edgeSvg}</svg>${nodesHtml}${nestTargetsHtml}${commentsHtml}</div><button class="drop-at-end" data-drop-routine="${routine.id}" type="button">+ In ${escapeHtml(routine.name)} einfügen</button></section>`;
}

function renderFlowchart() {
    diagramCanvas.innerHTML = `<div class="multi-diagram-grid">${state.routines.map(buildFlowchart).join("")}</div>`;
    bindFlowCommentDrag();
}

function visibilitySymbol(value) {
    return ({ public: "+", private: "−", protected: "#", package: "~" })[value] || "+";
}

function renderUml() {
    const byId = new Map(state.classes.map(item => [item.id, item]));
    const relations = state.relations.map(relation => {
        const from = byId.get(relation.from);
        const to = byId.get(relation.to);
        if (!from || !to) return "";
        const x1 = from.x + 115;
        const y1 = from.y + 80;
        const x2 = to.x + 115;
        const y2 = to.y + 80;
        const middleX = (x1 + x2) / 2;
        const selected = selection?.kind === "relation" && selection.id === relation.id ? " style=\"stroke:#38bdf8;stroke-width:3\"" : "";
        const markers = relation.type === "aggregation" ? ' marker-start="url(#diamondOpen)"' : relation.type === "composition" ? ' marker-start="url(#diamondFilled)"' : "";
        const label = [relation.fromMultiplicity, relation.label, relation.toMultiplicity].filter(Boolean).join("  ");
        return `<g data-relation-id="${relation.id}" class="uml-relation"><path class="uml-edge ${relation.type}"${selected}${markers} d="M ${x1} ${y1} L ${middleX} ${y1} L ${middleX} ${y2} L ${x2} ${y2}"></path>${label ? `<text class="uml-edge-label" x="${middleX + 5}" y="${(y1 + y2) / 2 - 5}">${escapeHtml(label)}</text>` : ""}<path d="M ${middleX - 8} ${(y1 + y2) / 2 - 12} h16 v24 h-16 z" fill="transparent" pointer-events="all"></path></g>`;
    }).join("");

    const classes = state.classes.map(item => {
        const selected = selection?.kind === "class" && selection.id === item.id ? " selected" : "";
        const attributes = item.attributes.length ? item.attributes.map(attr => `${visibilitySymbol(attr.visibility)} ${escapeHtml(attr.name)}: ${escapeHtml(attr.type)}${attr.defaultValue ? ` = ${escapeHtml(attr.defaultValue)}` : ""}`).join("<br>") : '<span class="uml-empty">keine Attribute</span>';
        const methods = item.methods.length ? item.methods.map(method => `${visibilitySymbol(method.visibility)} ${escapeHtml(method.name)}(${escapeHtml(method.parameters)}): ${escapeHtml(method.returnType)}`).join("<br>") : '<span class="uml-empty">keine Methoden</span>';
        return `<article class="uml-class${selected}" data-class-id="${item.id}" style="left:${item.x}px;top:${item.y}px"><div class="uml-class-header"><span class="uml-stereotype">«${escapeHtml(item.stereotype || "class") }»</span>${item.abstract ? `<em>${escapeHtml(item.name)}</em>` : escapeHtml(item.name)}</div><div class="uml-compartment">${attributes}</div><div class="uml-compartment">${methods}</div></article>`;
    }).join("");

    const empty = state.classes.length ? "" : '<div class="empty-state"><span class="empty-icon">▣</span><h3>Noch keine Klassen</h3><p>Füge links deine erste Klasse hinzu.</p></div>';
    diagramCanvas.innerHTML = `<div class="uml-board"><svg class="uml-lines" width="900" height="650"><defs><marker id="triangle" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto"><path d="M1,1 L13,7 L1,13 Z" fill="#09141e" stroke="#8aa4b7"></path></marker><marker id="umlArrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M1,1 L9,5 L1,9" fill="none" stroke="#8aa4b7"></path></marker><marker id="diamondOpen" markerWidth="16" markerHeight="12" refX="1" refY="6" orient="auto"><path d="M1,6 L7,1 L13,6 L7,11 Z" fill="#09141e" stroke="#8aa4b7"></path></marker><marker id="diamondFilled" markerWidth="16" markerHeight="12" refX="1" refY="6" orient="auto"><path d="M1,6 L7,1 L13,6 L7,11 Z" fill="#8aa4b7" stroke="#8aa4b7"></path></marker></defs>${relations}</svg>${classes}${empty}</div>`;
    bindUmlDrag();
}

function renderInspector() {
    const empty = $("#emptyInspector");
    if (!selection) {
        if (state.view !== "uml") {
            empty.classList.add("hidden");
            inspector.classList.remove("hidden");
            renderRoutineInspector();
            return;
        }
        empty.classList.remove("hidden");
        inspector.classList.add("hidden");
        return;
    }

    empty.classList.add("hidden");
    inspector.classList.remove("hidden");
    if (selection.kind === "node") renderNodeInspector(locateNode(selection.id)?.node);
    else if (selection.kind === "class") renderClassInspector(selectedClass());
    else if (selection.kind === "flowComment") renderFlowCommentInspector(selectedFlowComment());
    else renderRelationInspector(selectedRelation());
}

function renderRoutineInspector() {
    const routine = activeRoutine();
    inspector.innerHTML = `<div class="form-section"><div class="form-title"><span>${routine.kind === "main" ? "Hauptalgorithmus" : "Unterroutine"}</span><small>Routine</small></div><label><span>Name</span><input data-routine-field="name" value="${escapeHtml(routine.name)}"></label>${routine.kind === "subroutine" ? `<label><span>Sichtbarkeit</span><select data-routine-field="visibility"><option value="private" ${routine.visibility === "private" ? "selected" : ""}>private</option><option value="protected" ${routine.visibility === "protected" ? "selected" : ""}>protected</option><option value="public" ${routine.visibility === "public" ? "selected" : ""}>public</option></select></label><label><span>Parameter</span><input data-routine-field="parameters" value="${escapeHtml(routine.parameters)}" placeholder="wert: int, name: String"></label><small>Parameter werden als <code>name: Typ</code> angegeben und vom Aufrufbaustein mit Argumenten versorgt.</small>` : ""}</div>`;
}

function field(label, name, value, type = "text", extra = "") {
    return `<label><span>${label}</span><input name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra}></label>`;
}

function textarea(label, name, value) {
    return `<label><span>${label}</span><textarea name="${name}">${escapeHtml(value)}</textarea></label>`;
}

function renderNodeInspector(node) {
    if (!node) { selection = null; renderInspector(); return; }
    let content = `<div class="form-section"><div class="form-title"><span>${escapeHtml(typeLabel(node.type))}</span><small>${node.id.split("_").pop()}</small></div>`;
    if (node.type === "process") content += `${field("Bezeichnung", "label", node.label)}${textarea("Anweisung", "code", node.code)}`;
    if (node.type === "input") content += `${field("Variable", "variable", node.variable)}${field("Eingabeaufforderung", "prompt", node.prompt)}<label><span>Datentyp</span><select name="dataType">${["int", "float", "string", "boolean"].map(type => `<option ${node.dataType === type ? "selected" : ""}>${type}</option>`).join("")}</select></label>`;
    if (node.type === "output") content += `${field("Bezeichnung", "label", node.label)}${field("Ausdruck", "expression", node.expression)}`;
    if (["if", "while"].includes(node.type)) content += field("Bedingung", "condition", node.condition);
    if (node.type === "for") content += `${field("Laufvariable", "variable", node.variable)}<div class="inline-fields">${field("Start", "start", node.start)}${field("Ende inkl.", "end", node.end)}</div>${field("Schritt", "step", node.step)}`;
    if (node.type === "call") content += `<label><span>Zielroutine</span><select name="routineId">${state.routines.map(routine => `<option value="${routine.id}" ${node.routineId === routine.id ? "selected" : ""}>${escapeHtml(routine.name)}</option>`).join("")}</select></label>${field("Argumente", "arguments", node.arguments, "text", 'placeholder="wert, name"')}${field("Ergebnisvariable (optional)", "assignTo", node.assignTo, "text", 'placeholder="ergebnis"')}`;
    if (node.type === "return") content += field("Rückgabewert", "expression", node.expression);
    if (node.type === "comment") content += textarea("Kommentar", "text", node.text);
    content += "</div>";
    if (node.type === "if") content += `<div class="form-section"><span class="form-title">Einfügeziel</span><div class="branch-targets"><button class="branch-target ${branchTarget?.branch === "then" ? "active" : ""}" data-branch="then" type="button">Dann-Zweig</button><button class="branch-target ${branchTarget?.branch === "else" ? "active" : ""}" data-branch="else" type="button">Sonst-Zweig</button></div><small>Wähle ein Ziel und danach links einen Baustein.</small></div>`;
    if (["while", "for"].includes(node.type)) content += `<div class="form-section"><button class="branch-target ${branchTarget?.branch === "body" ? "active" : ""}" data-branch="body" type="button">Schleifeninhalt als Einfügeziel</button></div>`;
    inspector.innerHTML = content;
}

function renderClassInspector(item) {
    if (!item) { selection = null; renderInspector(); return; }
    const visibilityOptions = value => ["public", "private", "protected", "package"].map(option => `<option value="${option}" ${value === option ? "selected" : ""}>${option}</option>`).join("");
    const attributes = item.attributes.map(attr => `<div class="repeat-row" data-member-id="${attr.id}" data-member-kind="attribute"><select class="visibility" name="visibility">${visibilityOptions(attr.visibility)}</select><input name="name" value="${escapeHtml(attr.name)}" aria-label="Attributname"><input name="type" value="${escapeHtml(attr.type)}" aria-label="Datentyp"><button class="mini-remove" data-remove-member type="button">×</button></div><div class="repeat-row" data-member-id="${attr.id}" data-member-kind="attribute"><span></span><input name="defaultValue" value="${escapeHtml(attr.defaultValue)}" placeholder="Standardwert"><span></span><span></span></div>`).join("");
    const methods = item.methods.map(method => `<div class="repeat-row method" data-member-id="${method.id}" data-member-kind="method"><select class="visibility" name="visibility">${visibilityOptions(method.visibility)}</select><input name="name" value="${escapeHtml(method.name)}" aria-label="Methodenname"><input name="returnType" value="${escapeHtml(method.returnType)}" aria-label="Rückgabetyp"><button class="mini-remove" data-remove-member type="button">×</button></div><div class="repeat-row" data-member-id="${method.id}" data-member-kind="method"><span></span><input name="parameters" value="${escapeHtml(method.parameters)}" placeholder="Parameter: name: Typ"><span></span><span></span></div>`).join("");
    inspector.innerHTML = `<div class="form-section"><div class="form-title"><span>Klasse</span><small>UML</small></div>${field("Klassenname", "name", item.name)}<label><span>Stereotyp</span><select name="stereotype">${["class", "interface", "abstract", "enumeration"].map(value => `<option ${item.stereotype === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label><span><input name="abstract" type="checkbox" ${item.abstract ? "checked" : ""}> Abstrakte Klasse</span></label></div><div class="form-section"><div class="form-title"><span>Attribute</span><button class="btn btn-small btn-ghost" data-add-member="attribute" type="button">+ Attribut</button></div><div class="repeat-list">${attributes || "<small>Noch keine Attribute</small>"}</div></div><div class="form-section"><div class="form-title"><span>Methoden</span><button class="btn btn-small btn-ghost" data-add-member="method" type="button">+ Methode</button></div><div class="repeat-list">${methods || "<small>Noch keine Methoden</small>"}</div></div>`;
}

function renderRelationInspector(relation) {
    if (!relation) { selection = null; renderInspector(); return; }
    const name = id => state.classes.find(item => item.id === id)?.name || "?";
    inspector.innerHTML = `<div class="form-section"><div class="form-title"><span>UML-Beziehung</span><small>${escapeHtml(name(relation.from))} → ${escapeHtml(name(relation.to))}</small></div><label><span>Typ</span><select name="type">${["association", "inheritance", "aggregation", "composition", "dependency"].map(value => `<option ${relation.type === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>${field("Beschriftung", "label", relation.label)}<div class="inline-fields">${field("Multiplizität von", "fromMultiplicity", relation.fromMultiplicity)}${field("Multiplizität nach", "toMultiplicity", relation.toMultiplicity)}</div></div>`;
}

function renderFlowCommentInspector(comment) {
    if (!comment) { resetSelection(); renderInspector(); return; }
    inspector.innerHTML = `<div class="form-section"><div class="form-title"><span>Freier Kommentar</span><small>Flussdiagramm</small></div>${textarea("Kommentartext", "text", comment.text)}<div class="inline-fields">${field("X-Position", "x", comment.x, "number")}${field("Y-Position", "y", comment.y, "number")}</div><small>Dieser Kommentar dokumentiert den Plan, ist aber nicht mit dem Kontrollfluss verbunden und erzeugt keinen Code.</small></div>`;
}

function bindUmlDrag() {
    $$(".uml-class", diagramCanvas).forEach(element => {
        element.addEventListener("pointerdown", event => {
            if (event.button !== 0) return;
            const item = state.classes.find(entry => entry.id === element.dataset.classId);
            if (!item) return;
            selection = { kind: "class", id: item.id };
            const startX = event.clientX;
            const startY = event.clientY;
            const originalX = item.x;
            const originalY = item.y;
            const before = snapshot();
            element.setPointerCapture(event.pointerId);
            const move = moveEvent => {
                item.x = Math.max(0, Math.min(670, originalX + moveEvent.clientX - startX));
                item.y = Math.max(0, Math.min(520, originalY + moveEvent.clientY - startY));
                element.style.left = `${item.x}px`;
                element.style.top = `${item.y}px`;
            };
            const up = () => {
                element.removeEventListener("pointermove", move);
                element.removeEventListener("pointerup", up);
                if (before !== snapshot()) { history.push(before); future = []; }
                persistLocal();
                render();
            };
            element.addEventListener("pointermove", move);
            element.addEventListener("pointerup", up);
        });
    });
}

function bindFlowCommentDrag() {
    $$(".flow-comment", diagramCanvas).forEach(element => {
        element.addEventListener("pointerdown", event => {
            if (event.button !== 0) return;
            event.stopPropagation();
            const found = locateFlowComment(element.dataset.flowCommentId);
            if (!found) return;
            selectedNodeIds.clear();
            selection = { kind: "flowComment", id: found.comment.id };
            state.activeRoutineId = found.routine.id;
            element.classList.add("selected", "dragging");
            renderInspector();
            const before = snapshot();
            const startX = event.clientX;
            const startY = event.clientY;
            const originalX = Number(found.comment.x) || 0;
            const originalY = Number(found.comment.y) || 0;
            element.setPointerCapture(event.pointerId);
            const move = moveEvent => {
                found.comment.x = Math.max(0, originalX + (moveEvent.clientX - startX) / zoomLevel);
                found.comment.y = Math.max(0, originalY + (moveEvent.clientY - startY) / zoomLevel);
                element.style.left = `${found.comment.x}px`;
                element.style.top = `${found.comment.y}px`;
            };
            const up = () => {
                element.removeEventListener("pointermove", move);
                element.removeEventListener("pointerup", up);
                if (before !== snapshot()) { history.push(before); future = []; persistLocal(); }
                render();
            };
            element.addEventListener("pointermove", move);
            element.addEventListener("pointerup", up);
        });
    });
}

function render() {
    $("#projectName").value = state.name;
    $$(".segment").forEach(button => button.classList.toggle("active", button.dataset.view === state.view));
    const uml = state.view === "uml";
    document.body.classList.toggle("formal-mode", state.visualStyle === "formal");
    $("#visualStyle").value = state.visualStyle;
    $("#algorithmPalette").classList.toggle("hidden", uml);
    $("#umlPalette").classList.toggle("hidden", !uml);
    $$(".flow-only").forEach(element => element.classList.toggle("hidden", state.view !== "flowchart"));
    $$(".algorithm-only").forEach(element => element.classList.toggle("hidden", uml));
    $("#routineSelect").innerHTML = state.routines.map(routine => `<option value="${routine.id}" ${routine.id === state.activeRoutineId ? "selected" : ""}>${escapeHtml(routine.name)}</option>`).join("");
    $("#routineName").value = activeRoutine()?.name || "";
    $("#deleteRoutineBtn").disabled = uml || state.routines.length === 1;
    $("#viewLabel").textContent = ({ structogram: "Struktogramm", flowchart: "Flussdiagramm", uml: "UML-Klassendiagramm" })[state.view];
    $("#canvasLegend").textContent = uml ? "Klassen können mit der Maus verschoben werden. Mausrad zoomt, rechte Maustaste verschiebt die Fläche." : "Strg+Klick wählt mehrere Operationen. Ziehen verschiebt die Auswahl. Mausrad zoomt, rechte Maustaste verschiebt die Fläche.";
    if (state.view === "structogram") renderStructogram();
    else if (state.view === "flowchart") renderFlowchart();
    else renderUml();
    renderInspector();
    renderCode();
    $("#undoBtn").disabled = !history.length;
    $("#redoBtn").disabled = !future.length;
    const located = selection?.kind === "node" ? locateNode(selection.id) : null;
    $("#moveUpBtn").disabled = !located || located.index === 0;
    $("#moveDownBtn").disabled = !located || located.index === located.container.length - 1;
    $("#deleteBtn").disabled = !selection;
}

function updateInspectorField(target) {
    if (target.dataset.routineField) {
        commit(() => { activeRoutine()[target.dataset.routineField] = target.value.trim(); });
        return;
    }
    if (!target.name) return;
    const before = snapshot();
    let object = null;
    if (selection?.kind === "node") object = locateNode(selection.id)?.node;
    if (selection?.kind === "class") object = selectedClass();
    if (selection?.kind === "relation") object = selectedRelation();
    if (selection?.kind === "flowComment") object = selectedFlowComment();
    const memberRow = target.closest("[data-member-id]");
    if (memberRow && object) {
        const collection = memberRow.dataset.memberKind === "attribute" ? object.attributes : object.methods;
        object = collection.find(item => item.id === memberRow.dataset.memberId);
    }
    if (!object) return;
    object[target.name] = target.type === "checkbox" ? target.checked : target.type === "number" ? Number(target.value) : target.value;
    history.push(before);
    if (history.length > MAX_HISTORY) history.shift();
    future = [];
    persistLocal();
    render();
}

function selectDiagramElement(event) {
    if (dragInProgress) return;
    const target = event.target;
    const node = target.closest("[data-node-id]");
    const flowComment = target.closest("[data-flow-comment-id]");
    const nestTarget = target.closest("[data-nest-parent]");
    const umlClass = target.closest("[data-class-id]");
    const relation = target.closest("[data-relation-id]");
    const routineElement = target.closest("[data-routine-id]");
    if (nestTarget) {
        const parentId = nestTarget.dataset.nestParent;
        selection = { kind: "node", id: parentId };
        selectedNodeIds = new Set([parentId]);
        branchTarget = { parentId, branch: nestTarget.dataset.nestBranch };
        state.activeRoutineId = locateNode(parentId)?.routine.id || state.activeRoutineId;
        render();
        return;
    } else if (flowComment) {
        selectedNodeIds.clear();
        selection = { kind: "flowComment", id: flowComment.dataset.flowCommentId };
        state.activeRoutineId = locateFlowComment(selection.id)?.routine.id || state.activeRoutineId;
    } else if (node) {
        const id = node.dataset.nodeId;
        if (event.ctrlKey || event.metaKey) {
            if (selectedNodeIds.has(id)) selectedNodeIds.delete(id); else selectedNodeIds.add(id);
            if (!selectedNodeIds.size) selection = null;
            else selection = { kind: "node", id: selectedNodeIds.has(id) ? id : [...selectedNodeIds][0] };
        } else {
            selection = { kind: "node", id };
            selectedNodeIds = new Set([id]);
        }
        state.activeRoutineId = locateNode(id)?.routine.id || state.activeRoutineId;
    } else if (umlClass) {
        selectedNodeIds.clear();
        selection = { kind: "class", id: umlClass.dataset.classId };
    } else if (relation) {
        selectedNodeIds.clear();
        selection = { kind: "relation", id: relation.dataset.relationId };
    } else if (routineElement && state.view !== "uml") {
        state.activeRoutineId = routineElement.dataset.routineId;
        resetSelection();
    } else return;
    branchTarget = null;
    render();
}

function nodeContains(node, targetId) {
    let found = false;
    if (node.type === "if") {
        walkNodes(node.then, child => { if (child.id === targetId) found = true; });
        walkNodes(node.else, child => { if (child.id === targetId) found = true; });
    } else if (node.body) walkNodes(node.body, child => { if (child.id === targetId) found = true; });
    return found;
}

function orderedMovableNodes() {
    const result = [];
    for (const routine of state.routines) {
        walkNodes(routine.algorithm, node => {
            if (!selectedNodeIds.has(node.id)) return;
            let location = locateNode(node.id);
            let parent = location?.parent;
            let nestedInSelection = false;
            while (parent) {
                if (selectedNodeIds.has(parent.id)) { nestedInSelection = true; break; }
                parent = locateNode(parent.id)?.parent;
            }
            if (!nestedInSelection) result.push(node);
        });
    }
    return result;
}

function moveSelectedByDrop(targetId, position, targetRoutineId) {
    const moving = orderedMovableNodes();
    if (!moving.length) return;
    const targetLocation = targetId ? locateNode(targetId) : null;
    if (targetLocation && moving.some(node => node.id === targetId || nodeContains(node, targetId))) {
        toast("Ein Block kann nicht in sich selbst verschoben werden.");
        return;
    }
    commit(() => {
        const removals = moving.map(node => locateNode(node.id)).filter(Boolean);
        const containers = [...new Set(removals.map(item => item.container))];
        for (const container of containers) {
            const ids = new Set(removals.filter(item => item.container === container).map(item => item.node.id));
            for (let index = container.length - 1; index >= 0; index--) if (ids.has(container[index].id)) container.splice(index, 1);
        }
        let destination;
        let insertIndex;
        if (targetId) {
            const refreshed = locateNode(targetId);
            destination = refreshed.container;
            insertIndex = refreshed.index + (position === "after" ? 1 : 0);
        } else {
            const routine = state.routines.find(item => item.id === targetRoutineId) || activeRoutine();
            destination = routine.algorithm;
            insertIndex = destination.length;
        }
        destination.splice(insertIndex, 0, ...moving);
        const destinationRoutine = targetId ? locateNode(targetId)?.routine : state.routines.find(item => item.id === targetRoutineId);
        if (destinationRoutine) state.activeRoutineId = destinationRoutine.id;
        selection = { kind: "node", id: moving[0].id };
        selectedNodeIds = new Set(moving.map(node => node.id));
    }, `${moving.length} Operation${moving.length === 1 ? "" : "en"} verschoben`);
}

function moveSelectedIntoNestedContainer(parentId, branch) {
    const moving = orderedMovableNodes();
    const parentLocation = locateNode(parentId);
    if (!moving.length || !parentLocation) return;
    if (moving.some(node => node.id === parentId || nodeContains(node, parentId))) {
        toast("Ein Block kann nicht in sich selbst verschachtelt werden.");
        return;
    }
    const validBranch = parentLocation.node.type === "if"
        ? ["then", "else"].includes(branch)
        : ["while", "for"].includes(parentLocation.node.type)
            ? branch === "body"
            : parentLocation.node.type === "call" && branch === "routine";
    if (!validBranch) return;
    if (branch === "routine" && !state.routines.some(routine => routine.id === parentLocation.node.routineId)) return;
    commit(() => {
        const removals = moving.map(node => locateNode(node.id)).filter(Boolean);
        const containers = [...new Set(removals.map(item => item.container))];
        for (const container of containers) {
            const ids = new Set(removals.filter(item => item.container === container).map(item => item.node.id));
            for (let index = container.length - 1; index >= 0; index--) if (ids.has(container[index].id)) container.splice(index, 1);
        }
        const refreshed = locateNode(parentId);
        const destination = branch === "routine"
            ? state.routines.find(routine => routine.id === refreshed.node.routineId)?.algorithm
            : refreshed.node[branch];
        destination.push(...moving);
        state.activeRoutineId = refreshed.routine.id;
        selection = { kind: "node", id: moving[0].id };
        selectedNodeIds = new Set(moving.map(node => node.id));
        branchTarget = { parentId, branch };
    }, `${moving.length} Operation${moving.length === 1 ? "" : "en"} verschachtelt`);
}

function clearDropIndicators() {
    $$(".drop-before, .drop-after, .drag-over", diagramCanvas).forEach(element => element.classList.remove("drop-before", "drop-after", "drag-over"));
}

function initDragAndDrop() {
    diagramCanvas.addEventListener("dragstart", event => {
        const element = event.target.closest("[data-node-id]");
        if (!element || state.view === "uml") return;
        const id = element.dataset.nodeId;
        if (!selectedNodeIds.has(id)) {
            selectedNodeIds = new Set([id]);
            selection = { kind: "node", id };
        }
        dragInProgress = true;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", [...selectedNodeIds].join(","));
        requestAnimationFrame(() => element.classList.add("dragging"));
    });
    diagramCanvas.addEventListener("dragover", event => {
        if (!dragInProgress) return;
        const nest = event.target.closest("[data-nest-parent]");
        const node = event.target.closest("[data-node-id]");
        const end = event.target.closest("[data-drop-routine]");
        if (!nest && !node && !end) return;
        event.preventDefault();
        clearDropIndicators();
        if (nest) nest.classList.add("drag-over");
        else if (node) {
            const position = event.clientY < node.getBoundingClientRect().top + node.getBoundingClientRect().height / 2 ? "before" : "after";
            node.classList.add(position === "before" ? "drop-before" : "drop-after");
            node.dataset.dropPosition = position;
        } else end.classList.add("drag-over");
    });
    diagramCanvas.addEventListener("drop", event => {
        if (!dragInProgress) return;
        event.preventDefault();
        const nest = event.target.closest("[data-nest-parent]");
        const node = event.target.closest("[data-node-id]");
        const end = event.target.closest("[data-drop-routine]");
        if (nest) moveSelectedIntoNestedContainer(nest.dataset.nestParent, nest.dataset.nestBranch);
        else if (node) moveSelectedByDrop(node.dataset.nodeId, node.dataset.dropPosition || "after", null);
        else if (end) moveSelectedByDrop(null, "after", end.dataset.dropRoutine);
        clearDropIndicators();
        setTimeout(() => { dragInProgress = false; }, 0);
    });
    diagramCanvas.addEventListener("dragend", () => {
        clearDropIndicators();
        $$(".dragging", diagramCanvas).forEach(element => element.classList.remove("dragging"));
        setTimeout(() => { dragInProgress = false; }, 0);
    });
}

function serializeAndDownload(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizedImportedState(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.classes) || !Array.isArray(value.relations)) throw new Error("Ungültiges AlgorithmPlanner-Projekt");
    const base = blankState();
    let routines;
    if (Array.isArray(value.routines) && value.routines.length) {
        routines = value.routines.map((routine, index) => ({
            id: String(routine.id || uid("routine")),
            name: String(routine.name || (index ? `unterroutine_${index}` : "algorithm")),
            kind: index === 0 || routine.kind === "main" ? "main" : "subroutine",
            visibility: routine.visibility || (index ? "private" : "public"),
            parameters: String(routine.parameters || ""),
            algorithm: Array.isArray(routine.algorithm) ? routine.algorithm : [],
            flowComments: Array.isArray(routine.flowComments) ? routine.flowComments : []
        }));
    } else if (Array.isArray(value.algorithm)) {
        routines = [{ id: base.activeRoutineId, name: "algorithm", kind: "main", visibility: "public", parameters: "", algorithm: value.algorithm, flowComments: [] }];
    } else throw new Error("Das Projekt enthält keinen Algorithmus.");
    const activeRoutineId = routines.some(routine => routine.id === value.activeRoutineId) ? value.activeRoutineId : routines[0].id;
    return { ...base, ...value, version: 2, name: String(value.name || "Importiertes Projekt"), view: ["structogram", "flowchart", "uml"].includes(value.view) ? value.view : "structogram", visualStyle: ["neon", "formal"].includes(value.visualStyle) ? value.visualStyle : "neon", routines, activeRoutineId };
}

function loadExample() {
    const example = blankState();
    example.name = "Notenstatistik";
    if (state.view === "uml") {
        example.view = "uml";
        const student = { id: uid("class"), name: "Schueler", stereotype: "class", abstract: false, x: 60, y: 70, attributes: [{ id: uid("attr"), visibility: "private", name: "name", type: "String", defaultValue: "" }, { id: uid("attr"), visibility: "private", name: "noten", type: "List<int>", defaultValue: "" }], methods: [{ id: uid("method"), visibility: "public", name: "berechneDurchschnitt", returnType: "double", parameters: "" }] };
        const course = { id: uid("class"), name: "Kurs", stereotype: "class", abstract: false, x: 410, y: 300, attributes: [{ id: uid("attr"), visibility: "private", name: "titel", type: "String", defaultValue: "" }], methods: [{ id: uid("method"), visibility: "public", name: "fuegeSchuelerHinzu", returnType: "void", parameters: "schueler: Schueler" }] };
        example.classes = [student, course];
        example.relations = [{ id: uid("rel"), from: course.id, to: student.id, type: "aggregation", label: "enthält", fromMultiplicity: "1", toMultiplicity: "0..*" }];
    } else {
        example.view = state.view;
        const input = defaults.input(); input.variable = "note"; input.prompt = "Note (1-6):";
        const decision = defaults.if(); decision.condition = "note >= 1 && note <= 6";
        const valid = defaults.output(); valid.expression = '"Gültige Note"';
        const invalid = defaults.output(); invalid.expression = '"Ungültige Eingabe"';
        decision.then.push(valid); decision.else.push(invalid);
        example.routines[0].algorithm = [input, decision];
    }
    commit(() => { state = example; resetSelection(); }, "Beispiel geladen");
}

function initEvents() {
    $$("[data-view]").forEach(button => button.addEventListener("click", () => {
        state.view = button.dataset.view;
        resetSelection();
        persistLocal();
        render();
    }));
    $$("[data-add]").forEach(button => button.addEventListener("click", () => addAlgorithmNode(button.dataset.add)));
    $("#addFlowCommentBtn").addEventListener("click", addFlowComment);
    $$("[data-uml-add]").forEach(button => button.addEventListener("click", () => {
        const action = button.dataset.umlAdd;
        if (action === "class") addClass();
        else if (action === "relation") openRelationDialog();
        else addClassMember(action);
    }));
    diagramCanvas.addEventListener("click", selectDiagramElement);
    inspector.addEventListener("change", event => updateInspectorField(event.target));
    inspector.addEventListener("click", event => {
        const branch = event.target.closest("[data-branch]");
        if (branch && selection?.kind === "node") {
            branchTarget = { parentId: selection.id, branch: branch.dataset.branch };
            renderInspector();
            return;
        }
        const add = event.target.closest("[data-add-member]");
        if (add) addClassMember(add.dataset.addMember);
        const remove = event.target.closest("[data-remove-member]");
        if (remove) {
            const row = remove.closest("[data-member-id]");
            const item = selectedClass();
            if (!item) return;
            commit(() => {
                const key = row.dataset.memberKind === "attribute" ? "attributes" : "methods";
                item[key] = item[key].filter(member => member.id !== row.dataset.memberId);
            }, "Eintrag entfernt");
        }
    });
    $$(".tab").forEach(button => button.addEventListener("click", () => {
        $$(".tab").forEach(item => item.classList.toggle("active", item === button));
        $$(".tab-content").forEach(item => item.classList.toggle("active", item.id === `${button.dataset.tab}Tab`));
        if (button.dataset.tab === "code") renderCode();
    }));
    $("#projectName").addEventListener("change", event => commit(() => { state.name = event.target.value.trim() || "Mein Programm"; }));
    $("#routineSelect").addEventListener("change", event => {
        state.activeRoutineId = event.target.value;
        resetSelection();
        persistLocal();
        render();
    });
    $("#routineName").addEventListener("change", event => commit(() => { activeRoutine().name = event.target.value.trim() || "routine"; }));
    $("#addRoutineBtn").addEventListener("click", addRoutine);
    $("#deleteRoutineBtn").addEventListener("click", deleteActiveRoutine);
    $("#visualStyle").addEventListener("change", event => commit(() => { state.visualStyle = event.target.value; }));
    $("#undoBtn").addEventListener("click", undo);
    $("#redoBtn").addEventListener("click", redo);
    $("#moveUpBtn").addEventListener("click", () => moveSelection(-1));
    $("#moveDownBtn").addEventListener("click", () => moveSelection(1));
    $("#deleteBtn").addEventListener("click", deleteSelection);
    $("#newBtn").addEventListener("click", () => {
        if (confirm("Das aktuelle Modell verwerfen und neu beginnen?")) commit(() => { state = blankState(); resetSelection(); }, "Neues Projekt angelegt");
    });
    $("#exampleBtn").addEventListener("click", loadExample);
    $("#saveBtn").addEventListener("click", () => persistLocal(true));
    $("#exportBtn").addEventListener("click", () => serializeAndDownload(JSON.stringify(state, null, 2), `${safeFileName(state.name)}.algorithm-planner.json`, "application/json"));
    $("#importBtn").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", async event => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const imported = normalizedImportedState(JSON.parse(await file.text()));
            commit(() => { state = imported; resetSelection(); }, "Projekt importiert");
        } catch (error) { toast(error.message); }
        event.target.value = "";
    });
    $("#languageSelect").addEventListener("change", renderCode);
    $("#copyCodeBtn").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText($("#codeOutput").textContent); toast("Code kopiert"); }
        catch { toast("Kopieren wurde vom Browser blockiert"); }
    });
    $("#downloadCodeBtn").addEventListener("click", () => {
        const language = $("#languageSelect").value;
        const extensions = { java: "java", csharp: "cs", cpp: "cpp", python: "py", prolog: "pl", javascript: "js" };
        const baseName = language === "java" && state.view !== "uml" ? className(state.name) : safeFileName(state.name);
        serializeAndDownload($("#codeOutput").textContent, `${baseName}.${extensions[language]}`, "text/plain;charset=utf-8");
    });
    $("#fitBtn").addEventListener("click", fitCanvas);
    $("#pdfBtn").addEventListener("click", () => window.print());
    $("#helpBtn").addEventListener("click", () => $("#helpDialog").showModal());
    $("#branchDialog").addEventListener("close", event => { if (["then", "else", "after"].includes(event.target.returnValue)) completeBranchInsert(event.target.returnValue); else pendingNodeType = null; });
    $("#createRelationBtn").addEventListener("click", event => { event.preventDefault(); if (createRelation()) $("#relationDialog").close(); });
    document.addEventListener("keydown", event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
        if (event.key === "Delete" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) deleteSelection();
    });
    initDragAndDrop();
    initCanvasNavigation();
}

function applyZoom(nextZoom, clientX = null, clientY = null) {
    const scroll = $("#canvasScroll");
    const previous = zoomLevel;
    const next = Math.max(.35, Math.min(2.25, nextZoom));
    if (Math.abs(next - previous) < .001) return;
    const rect = scroll.getBoundingClientRect();
    const localX = clientX == null ? scroll.clientWidth / 2 : clientX - rect.left;
    const localY = clientY == null ? scroll.clientHeight / 2 : clientY - rect.top;
    const contentX = (scroll.scrollLeft + localX) / previous;
    const contentY = (scroll.scrollTop + localY) / previous;
    zoomLevel = next;
    diagramCanvas.style.zoom = String(zoomLevel);
    scroll.scrollLeft = contentX * next - localX;
    scroll.scrollTop = contentY * next - localY;
    $("#zoomLabel").textContent = `${Math.round(zoomLevel * 100)} %`;
}

function fitCanvas() {
    const scroll = $("#canvasScroll");
    diagramCanvas.style.zoom = "1";
    zoomLevel = 1;
    const width = Math.max(1, diagramCanvas.scrollWidth);
    const height = Math.max(1, diagramCanvas.scrollHeight);
    const target = Math.min(1, (scroll.clientWidth - 24) / width, (scroll.clientHeight - 24) / height);
    applyZoom(Math.max(.35, target), scroll.getBoundingClientRect().left, scroll.getBoundingClientRect().top);
    scroll.scrollTo({ left: 0, top: 0, behavior: "smooth" });
}

function initCanvasNavigation() {
    const scroll = $("#canvasScroll");
    scroll.addEventListener("wheel", event => {
        event.preventDefault();
        applyZoom(zoomLevel * (event.deltaY < 0 ? 1.1 : .9), event.clientX, event.clientY);
    }, { passive: false });
    scroll.addEventListener("contextmenu", event => event.preventDefault());
    scroll.addEventListener("pointerdown", event => {
        if (event.button !== 2) return;
        event.preventDefault();
        const startX = event.clientX;
        const startY = event.clientY;
        const left = scroll.scrollLeft;
        const top = scroll.scrollTop;
        scroll.classList.add("panning");
        scroll.setPointerCapture(event.pointerId);
        const move = moveEvent => {
            scroll.scrollLeft = left - (moveEvent.clientX - startX);
            scroll.scrollTop = top - (moveEvent.clientY - startY);
        };
        const stop = () => {
            scroll.classList.remove("panning");
            scroll.removeEventListener("pointermove", move);
            scroll.removeEventListener("pointerup", stop);
            scroll.removeEventListener("pointercancel", stop);
        };
        scroll.addEventListener("pointermove", move);
        scroll.addEventListener("pointerup", stop);
        scroll.addEventListener("pointercancel", stop);
    });
}

function safeFileName(value) {
    return String(value || "algorithm").trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "algorithm";
}

function loadLocalProject() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try { state = normalizedImportedState(JSON.parse(raw)); }
    catch { localStorage.removeItem(STORAGE_KEY); }
}

// Code generation -----------------------------------------------------------

function indent(level) { return "    ".repeat(level); }

function className(value) {
    const cleaned = String(value || "GeneratedProgram").replace(/[^a-zA-Z0-9_$]/g, " ").trim().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join("");
    return /^\d/.test(cleaned) ? `Program${cleaned}` : cleaned || "GeneratedProgram";
}

function variableName(value, language) {
    let name = String(value || "value").replace(/[^a-zA-Z0-9_]/g, "_");
    if (/^\d/.test(name)) name = `value_${name}`;
    if (language === "prolog") name = name.charAt(0).toUpperCase() + name.slice(1);
    return name;
}

function routineFunctionName(value, language = "") {
    let name = String(value || "routine").replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "") || "routine";
    if (/^\d/.test(name)) name = `routine_${name}`;
    if (language === "csharp") name = name.charAt(0).toUpperCase() + name.slice(1);
    if (language === "prolog") name = name.charAt(0).toLowerCase() + name.slice(1);
    return name;
}

function expression(value, language) {
    let result = String(value || "").trim();
    if (language === "python") result = result.replace(/&&/g, " and ").replace(/\|\|/g, " or ").replace(/!([^=])/g, "not $1").replace(/\btrue\b/gi, "True").replace(/\bfalse\b/gi, "False");
    if (language === "prolog") result = result.replace(/&&/g, ",").replace(/\|\|/g, ";").replace(/==/g, "=:=").replace(/!=/g, "=\\=");
    return result;
}

function generateImperative(language) {
    const warnings = [];
    let helpers = [];
    let declared = new Set();
    const types = {
        java: { int: "int", float: "double", string: "String", boolean: "boolean" },
        csharp: { int: "int", float: "double", string: "string", boolean: "bool" },
        cpp: { int: "int", float: "double", string: "std::string", boolean: "bool" }
    };

    const inputLine = (node, level) => {
        const name = variableName(node.variable, language);
        declared.add(name);
        const prompt = JSON.stringify(node.prompt || "Eingabe:");
        if (language === "java") {
            const reads = { int: "Integer.parseInt(scanner.nextLine())", float: "Double.parseDouble(scanner.nextLine())", string: "scanner.nextLine()", boolean: "Boolean.parseBoolean(scanner.nextLine())" };
            return `${indent(level)}System.out.print(${prompt});\n${indent(level)}${types.java[node.dataType] || "String"} ${name} = ${reads[node.dataType] || reads.string};`;
        }
        if (language === "csharp") {
            const reads = { int: "int.Parse(Console.ReadLine()!)", float: "double.Parse(Console.ReadLine()!)", string: "Console.ReadLine() ?? string.Empty", boolean: "bool.Parse(Console.ReadLine()!)" };
            return `${indent(level)}Console.Write(${prompt});\n${indent(level)}${types.csharp[node.dataType] || "string"} ${name} = ${reads[node.dataType] || reads.string};`;
        }
        const declaration = types.cpp[node.dataType] || "std::string";
        return `${indent(level)}std::cout << ${prompt};\n${indent(level)}${declaration} ${name};\n${indent(level)}std::cin >> ${name};`;
    };

    function lines(nodes, level) {
        const output = [];
        for (const node of nodes) {
            if (node.type === "comment") output.push(`${indent(level)}// ${node.text}`);
            if (node.type === "process") {
                let code = node.code.trim();
                const assignment = code.match(/^([A-Za-z_$][\w$]*)\s*=\s*(.+)$/);
                if (assignment && !declared.has(assignment[1])) {
                    declared.add(assignment[1]);
                    const declaration = language === "cpp" ? "auto" : "var";
                    code = `${declaration} ${assignment[1]} = ${assignment[2]}`;
                }
                output.push(`${indent(level)}${code.replace(/;?\s*$/, ";")}`);
            }
            if (node.type === "input") output.push(inputLine(node, level));
            if (node.type === "call") {
                const target = state.routines.find(routine => routine.id === node.routineId);
                const call = `${routineFunctionName(target?.name || "routine", language)}(${node.arguments || ""})`;
                if (node.assignTo) {
                    const name = variableName(node.assignTo, language);
                    const declaration = declared.has(name) ? "" : `${language === "cpp" ? "auto" : "var"} `;
                    declared.add(name);
                    output.push(`${indent(level)}${declaration}${name} = ${call};`);
                } else output.push(`${indent(level)}${call};`);
            }
            if (node.type === "output") {
                const call = language === "java" ? "System.out.println" : language === "csharp" ? "Console.WriteLine" : "std::cout << ";
                output.push(language === "cpp" ? `${indent(level)}${call}${expression(node.expression, language)} << std::endl;` : `${indent(level)}${call}(${expression(node.expression, language)});`);
            }
            if (node.type === "if") {
                output.push(`${indent(level)}if (${expression(node.condition, language)}) {`);
                output.push(node.then.length ? lines(node.then, level + 1) : `${indent(level + 1)}// TODO`);
                if (node.else.length) { output.push(`${indent(level)}} else {`); output.push(lines(node.else, level + 1)); }
                output.push(`${indent(level)}}`);
            }
            if (node.type === "while") {
                output.push(`${indent(level)}while (${expression(node.condition, language)}) {`);
                output.push(node.body.length ? lines(node.body, level + 1) : `${indent(level + 1)}// TODO: Schleifeninhalt`);
                output.push(`${indent(level)}}`);
            }
            if (node.type === "for") {
                const name = variableName(node.variable, language);
                output.push(`${indent(level)}for (int ${name} = ${node.start}; ${name} <= ${node.end}; ${name} += ${node.step}) {`);
                output.push(node.body.length ? lines(node.body, level + 1) : `${indent(level + 1)}// TODO: Schleifeninhalt`);
                output.push(`${indent(level)}}`);
            }
            if (node.type === "return") {
                if (language === "cpp") output.push(`${indent(level)}return ${expression(node.expression, language)};`);
                else output.push(`${indent(level)}return ${expression(node.expression, language)};`);
            }
        }
        return output.join("\n");
    }

    const name = className(state.name);
    const hasReturn = routine => { let found = false; walkNodes(routine.algorithm, node => { if (node.type === "return") found = true; }); return found; };
    if (language === "java") {
        const methods = state.routines.map(routine => {
            declared = new Set();
            const parsedParameters = parseParameters(routine.parameters);
            parsedParameters.forEach(parameter => declared.add(variableName(parameter.name, "java")));
            const body = lines(routine.algorithm, 2) || `${indent(2)}// TODO: Algorithmus modellieren`;
            const parameters = parsedParameters.map(parameter => `${mapType(parameter.type, "java")} ${variableName(parameter.name, "java")}`).join(", ");
            const visibility = routine.kind === "main" ? "public" : routine.visibility || "private";
            return `    ${visibility} static Object ${routineFunctionName(routine.name)}(${parameters}) {\n        Scanner scanner = new Scanner(System.in);\n${body}\n${hasReturn(routine) ? "" : "        return null;\n"}    }`;
        }).join("\n\n");
        return { code: `import java.util.Scanner;\n\npublic class ${name} {\n${methods}\n\n    public static void main(String[] args) {\n        ${routineFunctionName(state.routines.find(item => item.kind === "main")?.name)}();\n    }\n}\n`, warnings };
    }
    if (language === "csharp") {
        const methods = state.routines.map(routine => {
            declared = new Set();
            const parsedParameters = parseParameters(routine.parameters);
            parsedParameters.forEach(parameter => declared.add(variableName(parameter.name, "csharp")));
            const body = lines(routine.algorithm, 2) || `${indent(2)}// TODO: Algorithmus modellieren`;
            const parameters = parsedParameters.map(parameter => `${mapType(parameter.type, "csharp")} ${variableName(parameter.name, "csharp")}`).join(", ");
            const requestedVisibility = routine.kind === "main" ? "public" : routine.visibility || "private";
            const visibility = requestedVisibility === "protected" ? "private" : requestedVisibility;
            return `    ${visibility} static object? ${routineFunctionName(routine.name, "csharp")}(${parameters})\n    {\n${body}\n${hasReturn(routine) ? "" : "        return null;\n"}    }`;
        }).join("\n\n");
        return { code: `using System;\n\npublic static class ${name}\n{\n${methods}\n\n    public static void Main()\n    {\n        ${routineFunctionName(state.routines.find(item => item.kind === "main")?.name, "csharp")}();\n    }\n}\n`, warnings };
    }
    if (language === "cpp") {
        const declarations = state.routines.map(routine => {
            const parameters = parseParameters(routine.parameters).map(parameter => `${mapType(parameter.type, "cpp")} ${variableName(parameter.name, "cpp")}`).join(", ");
            return `${routine.kind === "subroutine" && routine.visibility === "private" ? "static " : ""}std::any ${routineFunctionName(routine.name)}(${parameters});`;
        }).join("\n");
        const functions = state.routines.map(routine => {
            declared = new Set();
            const parsedParameters = parseParameters(routine.parameters);
            parsedParameters.forEach(parameter => declared.add(variableName(parameter.name, "cpp")));
            const body = (lines(routine.algorithm, 2) || `${indent(2)}// TODO: Algorithmus modellieren`).replace(/^        /gm, "    ");
            const parameters = parsedParameters.map(parameter => `${mapType(parameter.type, "cpp")} ${variableName(parameter.name, "cpp")}`).join(", ");
            return `${routine.kind === "subroutine" && routine.visibility === "private" ? "static " : ""}std::any ${routineFunctionName(routine.name)}(${parameters}) {\n${body}\n${hasReturn(routine) ? "" : "    return {};\n"}}`;
        }).join("\n\n");
        return { code: `#include <any>\n#include <iostream>\n#include <string>\n\n${declarations}\n\n${functions}\n\nint main() {\n    ${routineFunctionName(state.routines.find(item => item.kind === "main")?.name)}();\n    return 0;\n}\n`, warnings };
    }
    return { code: helpers.join("\n"), warnings };
}

function generatePython() {
    function lines(nodes, level) {
        const output = [];
        for (const node of nodes) {
            if (node.type === "comment") output.push(`${indent(level)}# ${node.text}`);
            if (node.type === "process") output.push(`${indent(level)}${expression(node.code, "python")}`);
            if (node.type === "input") {
                const casts = { int: "int", float: "float", string: "str", boolean: "bool" };
                const call = `input(${JSON.stringify(node.prompt || "Eingabe:")})`;
                const converted = node.dataType === "string" ? call : node.dataType === "boolean" ? `${call}.strip().lower() in ("true", "1", "ja", "yes")` : `${casts[node.dataType] || "str"}(${call})`;
                output.push(`${indent(level)}${variableName(node.variable, "python")} = ${converted}`);
            }
            if (node.type === "call") {
                const target = state.routines.find(routine => routine.id === node.routineId);
                const call = `${routineFunctionName(target?.name || "routine")}(${node.arguments || ""})`;
                output.push(`${indent(level)}${node.assignTo ? `${variableName(node.assignTo, "python")} = ` : ""}${call}`);
            }
            if (node.type === "output") output.push(`${indent(level)}print(${expression(node.expression, "python")})`);
            if (node.type === "if") {
                output.push(`${indent(level)}if ${expression(node.condition, "python")}:`);
                output.push(node.then.length ? lines(node.then, level + 1) : `${indent(level + 1)}pass`);
                if (node.else.length) { output.push(`${indent(level)}else:`); output.push(lines(node.else, level + 1)); }
            }
            if (node.type === "while") { output.push(`${indent(level)}while ${expression(node.condition, "python")}:`); output.push(node.body.length ? lines(node.body, level + 1) : `${indent(level + 1)}pass`); }
            if (node.type === "for") { output.push(`${indent(level)}for ${variableName(node.variable, "python")} in range(${node.start}, (${node.end}) + 1, ${node.step}):`); output.push(node.body.length ? lines(node.body, level + 1) : `${indent(level + 1)}pass`); }
            if (node.type === "return") output.push(`${indent(level)}return ${expression(node.expression, "python")}`);
        }
        return output.join("\n");
    }
    const functions = state.routines.map(routine => `def ${routineFunctionName(routine.name)}(${parseParameters(routine.parameters).map(parameter => variableName(parameter.name, "python")).join(", ")}):\n${lines(routine.algorithm, 1) || "    pass"}`).join("\n\n\n");
    const main = state.routines.find(routine => routine.kind === "main") || state.routines[0];
    return { code: `${functions}\n\n\nif __name__ == "__main__":\n    ${routineFunctionName(main.name)}()\n`, warnings: [] };
}

function generateJavaScript() {
    let declared = new Set();
    function lines(nodes, level) {
        const output = [];
        for (const node of nodes) {
            if (node.type === "comment") output.push(`${indent(level)}// ${node.text}`);
            if (node.type === "process") {
                let code = node.code.trim();
                const assignment = code.match(/^([A-Za-z_$][\w$]*)\s*=\s*(.+)$/);
                if (assignment && !declared.has(assignment[1])) { declared.add(assignment[1]); code = `let ${assignment[1]} = ${assignment[2]}`; }
                output.push(`${indent(level)}${code.replace(/;?\s*$/, ";")}`);
            }
            if (node.type === "input") {
                const raw = `prompt(${JSON.stringify(node.prompt || "Eingabe:")})`;
                const convert = node.dataType === "int" ? `Number.parseInt(${raw}, 10)` : node.dataType === "float" ? `Number.parseFloat(${raw})` : node.dataType === "boolean" ? `${raw} === "true"` : raw;
                const name = variableName(node.variable, "javascript");
                declared.add(name);
                output.push(`${indent(level)}const ${name} = ${convert};`);
            }
            if (node.type === "call") {
                const target = state.routines.find(routine => routine.id === node.routineId);
                const call = `${routineFunctionName(target?.name || "routine")}(${node.arguments || ""})`;
                if (node.assignTo) {
                    const name = variableName(node.assignTo, "javascript");
                    const declaration = declared.has(name) ? "" : "let ";
                    declared.add(name);
                    output.push(`${indent(level)}${declaration}${name} = ${call};`);
                } else output.push(`${indent(level)}${call};`);
            }
            if (node.type === "output") output.push(`${indent(level)}console.log(${node.expression});`);
            if (node.type === "if") { output.push(`${indent(level)}if (${node.condition}) {`); output.push(node.then.length ? lines(node.then, level + 1) : `${indent(level + 1)}// TODO`); if (node.else.length) { output.push(`${indent(level)}} else {`); output.push(lines(node.else, level + 1)); } output.push(`${indent(level)}}`); }
            if (node.type === "while") { output.push(`${indent(level)}while (${node.condition}) {`); output.push(node.body.length ? lines(node.body, level + 1) : `${indent(level + 1)}// TODO: Schleifeninhalt`); output.push(`${indent(level)}}`); }
            if (node.type === "for") { const name = variableName(node.variable, "javascript"); output.push(`${indent(level)}for (let ${name} = ${node.start}; ${name} <= ${node.end}; ${name} += ${node.step}) {`); output.push(node.body.length ? lines(node.body, level + 1) : `${indent(level + 1)}// TODO: Schleifeninhalt`); output.push(`${indent(level)}}`); }
            if (node.type === "return") output.push(`${indent(level)}return ${node.expression};`);
        }
        return output.join("\n");
    }
    const functions = state.routines.map(routine => {
        declared = new Set();
        const parameters = parseParameters(routine.parameters).map(parameter => variableName(parameter.name, "javascript"));
        parameters.forEach(parameter => declared.add(parameter));
        return `function ${routineFunctionName(routine.name)}(${parameters.join(", ")}) {\n${lines(routine.algorithm, 1) || "    // TODO: Algorithmus modellieren"}\n}`;
    }).join("\n\n");
    const main = state.routines.find(routine => routine.kind === "main") || state.routines[0];
    return { code: `${functions}\n\n${routineFunctionName(main.name)}();\n`, warnings: ["Eingaben verwenden prompt() und sind für eine Browserumgebung ausgelegt."] };
}

function prologExpression(value) {
    return expression(String(value).replace(/\b([a-z][a-zA-Z0-9_]*)\b/g, word => ["true", "false", "is", "mod"].includes(word) ? word : variableName(word, "prolog")), "prolog");
}

function generateProlog() {
    let helperIndex = 0;
    const helpers = [];
    function goals(nodes, level, resultName = "Result") {
        const output = [];
        for (const node of nodes) {
            if (node.type === "comment") output.push(`${indent(level)}% ${node.text}`);
            if (node.type === "process") {
                const match = node.code.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.+)$/);
                output.push(`${indent(level)}${match ? `${variableName(match[1], "prolog")} is ${prologExpression(match[2])}` : `% TODO: ${node.code}`},`);
            }
            if (node.type === "input") output.push(`${indent(level)}write(${JSON.stringify(node.prompt || "Eingabe:")}), read(${variableName(node.variable, "prolog")}),`);
            if (node.type === "call") {
                const target = state.routines.find(routine => routine.id === node.routineId);
                const argumentsList = String(node.arguments || "").split(",").map(value => value.trim()).filter(Boolean).map(prologExpression);
                const result = node.assignTo ? variableName(node.assignTo, "prolog") : "_";
                output.push(`${indent(level)}${routineFunctionName(target?.name || "routine", "prolog")}(${[...argumentsList, result].join(", ")}),`);
            }
            if (node.type === "output") output.push(`${indent(level)}writeln(${prologExpression(node.expression)}),`);
            if (node.type === "if") output.push(`${indent(level)}(${prologExpression(node.condition)} ->\n${goals(node.then, level + 1)}\n${indent(level)};\n${goals(node.else, level + 1)}\n${indent(level)}),`);
            if (node.type === "while") {
                const helper = `while_${++helperIndex}`;
                output.push(`${indent(level)}${helper},`);
                helpers.push(`${helper} :-\n    (${prologExpression(node.condition)} ->\n${goals(node.body, 2)}\n        ${helper}\n    ;\n        true\n    ).`);
            }
            if (node.type === "for") output.push(`${indent(level)}forall(between(${node.start}, ${node.end}, ${variableName(node.variable, "prolog")}), (\n${goals(node.body, level + 1)}\n${indent(level)}    true\n${indent(level)})),`);
            if (node.type === "return") output.push(`${indent(level)}${resultName} = ${prologExpression(node.expression)},`);
        }
        return output.join("\n");
    }
    const predicates = state.routines.map(routine => {
        let body = goals(routine.algorithm, 1);
        body = body ? `${body}\n    true` : "    true";
        const parameters = parseParameters(routine.parameters).map(parameter => variableName(parameter.name, "prolog"));
        return `${routineFunctionName(routine.name, "prolog")}(${[...parameters, "Result"].join(", ")}) :-\n${body}.`;
    }).join("\n\n");
    const mainRoutine = state.routines.find(routine => routine.kind === "main") || state.routines[0];
    return { code: `:- initialization(main, main).\n\n${predicates}\n\nmain :-\n    ${routineFunctionName(mainRoutine.name, "prolog")}(Result),\n    (var(Result) -> true ; format("Ergebnis: ~w~n", [Result])).\n${helpers.length ? `\n${helpers.join("\n\n")}\n` : ""}`, warnings: ["Prolog besitzt ein anderes Ausführungsmodell. Zuweisungen werden als arithmetische is/2-Ausdrücke und Schleifen als Hilfsprädikate erzeugt."] };
}

function parseParameters(text) {
    return String(text || "").split(",").map(value => value.trim()).filter(Boolean).map(value => {
        const [name, type] = value.split(":").map(part => part.trim());
        return { name: name || "value", type: type || "Object" };
    });
}

function mapType(type, language) {
    const normalized = String(type || "").toLowerCase();
    const maps = {
        java: { string: "String", int: "int", integer: "int", double: "double", float: "double", bool: "boolean", boolean: "boolean", void: "void" },
        csharp: { string: "string", int: "int", integer: "int", double: "double", float: "double", bool: "bool", boolean: "bool", void: "void" },
        cpp: { string: "std::string", int: "int", integer: "int", double: "double", float: "double", bool: "bool", boolean: "bool", void: "void" },
        python: {}, javascript: {}, prolog: {}
    };
    return maps[language][normalized] || type || (language === "java" ? "Object" : language === "csharp" ? "object" : "auto");
}

function inheritanceTarget(item) {
    const relation = state.relations.find(entry => entry.type === "inheritance" && entry.from === item.id);
    return relation ? state.classes.find(entry => entry.id === relation.to)?.name : "";
}

function defaultForType(type, language) {
    if (type === "void") return "";
    if (["int", "double", "float"].includes(type.toLowerCase())) return "0";
    if (["boolean", "bool"].includes(type.toLowerCase())) return language === "python" ? "False" : "false";
    if (language === "cpp") return "{}";
    if (language === "python" || language === "javascript") return "None";
    return "null";
}

function generateUml(language) {
    const warnings = [];
    if (!state.classes.length) return { code: language === "prolog" ? "% Noch keine Klassen modelliert.\n" : "// Noch keine Klassen modelliert.\n", warnings };
    const blocks = state.classes.map(item => {
        const parent = inheritanceTarget(item);
        if (language === "java") {
            const attributes = item.attributes.map(attr => `    ${attr.visibility === "package" ? "" : `${attr.visibility} `}${mapType(attr.type, language)} ${attr.name}${attr.defaultValue ? ` = ${attr.defaultValue}` : ""};`).join("\n");
            const methods = item.methods.map(method => { const params = parseParameters(method.parameters).map(param => `${mapType(param.type, language)} ${param.name}`).join(", "); const type = mapType(method.returnType, language); const declaration = item.stereotype === "interface" ? ";" : ` {\n        // TODO: implementieren${type !== "void" ? `\n        return ${defaultForType(type, language)};` : ""}\n    }`; return `    ${method.visibility === "package" ? "" : `${method.visibility} `}${type} ${method.name}(${params})${declaration}`; }).join("\n\n");
            const keyword = item.stereotype === "interface" ? "interface" : `${item.abstract || item.stereotype === "abstract" ? "abstract " : ""}class`;
            return `${keyword} ${item.name}${parent ? ` extends ${parent}` : ""} {\n${attributes}${attributes && methods ? "\n\n" : ""}${methods}\n}`;
        }
        if (language === "csharp") {
            const attributes = item.attributes.map(attr => `    ${attr.visibility === "package" ? "internal" : attr.visibility} ${mapType(attr.type, language)} ${attr.name}${attr.defaultValue ? ` = ${attr.defaultValue}` : ""};`).join("\n");
            const methods = item.methods.map(method => { const params = parseParameters(method.parameters).map(param => `${mapType(param.type, language)} ${param.name}`).join(", "); const type = mapType(method.returnType, language); return `    ${method.visibility === "package" ? "internal" : method.visibility} ${type} ${method.name}(${params})\n    {\n        // TODO: implementieren${type !== "void" ? `\n        return ${defaultForType(type, language)};` : ""}\n    }`; }).join("\n\n");
            return `${item.abstract ? "abstract " : ""}class ${item.name}${parent ? ` : ${parent}` : ""}\n{\n${attributes}${attributes && methods ? "\n\n" : ""}${methods}\n}`;
        }
        if (language === "cpp") {
            const grouped = ["public", "protected", "private"].map(visibility => { const attrs = item.attributes.filter(attr => attr.visibility === visibility || (visibility === "public" && attr.visibility === "package")).map(attr => `    ${mapType(attr.type, language)} ${attr.name}${attr.defaultValue ? ` = ${attr.defaultValue}` : ""};`); const methods = item.methods.filter(method => method.visibility === visibility || (visibility === "public" && method.visibility === "package")).map(method => { const params = parseParameters(method.parameters).map(param => `${mapType(param.type, language)} ${param.name}`).join(", "); const type = mapType(method.returnType, language); return `    ${type} ${method.name}(${params}) {${type !== "void" ? ` return ${defaultForType(type, language)};` : ""} }`; }); return attrs.length || methods.length ? `${visibility}:\n${[...attrs, ...methods].join("\n")}` : ""; }).filter(Boolean).join("\n\n");
            return `class ${item.name}${parent ? ` : public ${parent}` : ""} {\n${grouped}\n};`;
        }
        if (language === "python") {
            const constructor = item.attributes.length ? `    def __init__(self):\n${item.attributes.map(attr => `        self.${attr.name} = ${attr.defaultValue || "None"}`).join("\n")}` : "";
            const methods = item.methods.map(method => { const params = parseParameters(method.parameters).map(param => param.name); return `    def ${method.name}(self${params.length ? `, ${params.join(", ")}` : ""}):\n        # TODO: implementieren\n        ${method.returnType.toLowerCase() === "void" ? "pass" : "return None"}`; }).join("\n\n");
            return `class ${item.name}(${parent || "object"}):\n${constructor || methods ? [constructor, methods].filter(Boolean).join("\n\n") : "    pass"}`;
        }
        if (language === "javascript") {
            const constructor = `    constructor() {\n${item.attributes.map(attr => `        this.${attr.name} = ${attr.defaultValue || "null"};`).join("\n") || "        // Keine Attribute"}\n    }`;
            const methods = item.methods.map(method => { const params = parseParameters(method.parameters).map(param => param.name).join(", "); return `    ${method.name}(${params}) {\n        // TODO: implementieren\n    }`; }).join("\n\n");
            return `class ${item.name}${parent ? ` extends ${parent}` : ""} {\n${constructor}${methods ? `\n\n${methods}` : ""}\n}`;
        }
        const facts = [`class(${item.name.toLowerCase()}).`, ...item.attributes.map(attr => `attribute(${item.name.toLowerCase()}, ${attr.name.toLowerCase()}, ${attr.type.toLowerCase()}).`), ...item.methods.map(method => `method(${item.name.toLowerCase()}, ${method.name.toLowerCase()}, ${method.returnType.toLowerCase()}).`)];
        return facts.join("\n");
    });
    if (language === "cpp") blocks.unshift("#include <string>\n");
    if (language === "prolog") {
        blocks.push(...state.relations.map(relation => `${relation.type}(${state.classes.find(item => item.id === relation.from)?.name.toLowerCase()}, ${state.classes.find(item => item.id === relation.to)?.name.toLowerCase()}).`));
        warnings.push("UML-Strukturen werden in Prolog als Fakten und Beziehungen abgebildet.");
    }
    return { code: `${blocks.join("\n\n")}\n`, warnings };
}

function renderCode() {
    const language = $("#languageSelect").value;
    let result;
    if (state.view === "uml") result = generateUml(language);
    else if (["java", "csharp", "cpp"].includes(language)) result = generateImperative(language);
    else if (language === "python") result = generatePython();
    else if (language === "prolog") result = generateProlog();
    else result = generateJavaScript();
    $("#codeOutput").textContent = result.code;
    $("#codeWarnings").innerHTML = result.warnings.map(warning => `Hinweis: ${escapeHtml(warning)}`).join("<br>");
}

loadLocalProject();
initEvents();
render();
