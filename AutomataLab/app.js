"use strict";

const STORAGE_KEY = "automata-lab-machine-v1";
const SVG_NS = "http://www.w3.org/2000/svg";
const EPSILON = "λ";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const clone = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const unique = values => [...new Set(values)];

function newMachine(type = "DFA") {
  const nonterminals = type === "PDA" ? ["A", "B"] : ["TM", "LBA"].includes(type) ? ["X", "Y", "Z"] : [];
  return { version: 1, type, name: `Neuer ${type}`, alphabet: ["0", "1"], nonterminals, emptySymbol: "λ", stackAlphabet: [...nonterminals, "□"], blank: "□", boundaryLeft: "⊢", boundaryRight: "⊣", initialStack: "□", initialHead: 0, acceptance: "final", states: [], transitions: [] };
}

let machine = newMachine();
let selection = null;
let tool = "select";
let history = [];
let future = [];
let zoom = 1;
let panX = 0;
let panY = 0;
let dragState = null;
let transitionSource = null;
let draftPoint = null;
let pendingTransition = null;
let playTimer = 0;
let toastTimer = 0;
let operationLog = [];
let sim = emptySimulation();
let programSuggestionIndex = 0;

function emptySimulation() {
  return { configs: [], step: 0, status: "idle", word: "", seen: new Set(), activeTransitions: [], message: "Bereit zur Simulation" };
}

function snapshot() { return JSON.stringify(machine); }

function persist(showToast = false) {
  try {
    localStorage.setItem(STORAGE_KEY, snapshot());
    $("#saveState").textContent = `Gespeichert ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
    if (showToast) toast("Im Browser gespeichert");
  } catch { toast("Browser-Speicher nicht verfügbar"); }
}

function commit(mutator, logMessage = "") {
  history.push(snapshot());
  if (history.length > 80) history.shift();
  future = [];
  mutator();
  persist();
  resetSimulation(false);
  if (logMessage) addLog(logMessage);
  render();
}

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  machine = normalizeMachine(JSON.parse(history.pop()));
  selection = null;
  persist();
  resetSimulation(false);
  render();
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  machine = normalizeMachine(JSON.parse(future.pop()));
  selection = null;
  persist();
  resetSimulation(false);
  render();
}

function addLog(message, detail = "") {
  operationLog.unshift({ message, detail, time: new Date().toLocaleTimeString("de-DE") });
  operationLog = operationLog.slice(0, 80);
  renderLog();
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 1800);
}

function normalizeSymbol(value, emptySymbol = "") {
  const text = String(value ?? "").trim();
  return ["", "lambda", "λ", "ε", "eps", "epsilon", String(emptySymbol).toLowerCase()].includes(text.toLowerCase()) ? EPSILON : text;
}

function normalizeMachine(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.states) || !Array.isArray(value.transitions)) throw new Error("Ungültige AutomataLab-Datei");
  const type = ["DFA", "NFA", "PDA", "TM", "LBA"].includes(value.type) ? value.type : "DFA";
  const base = newMachine(type);
  const alphabet = unique((value.alphabet || []).map(String).filter(Boolean));
  const inferredNonterminals = type === "PDA"
    ? (value.stackAlphabet || []).filter(symbol => symbol !== (value.blank || "□") && !alphabet.includes(symbol))
    : ["TM", "LBA"].includes(type) ? (value.transitions || []).flatMap(rule => [rule.read, rule.write]).filter(symbol => symbol && ![value.blank || "□", value.boundaryLeft || "⊢", value.boundaryRight || "⊣"].includes(symbol) && !alphabet.includes(symbol)) : [];
  const nonterminals = unique((value.nonterminals || inferredNonterminals || base.nonterminals).map(String).filter(Boolean));
  return {
    ...base, ...value, version: 1, type,
    name: String(value.name || `Importierter ${type}`),
    alphabet,
    nonterminals,
    emptySymbol: String(value.emptySymbol || "λ"),
    stackAlphabet: type === "PDA" ? unique([...nonterminals, String(value.blank || "□")]) : unique((value.stackAlphabet || base.stackAlphabet).map(String).filter(Boolean)),
    blank: String(value.blank || "□"),
    boundaryLeft: String(value.boundaryLeft || "⊢"),
    boundaryRight: String(value.boundaryRight || "⊣"),
    initialStack: String(value.initialStack ?? value.blank ?? "□"),
    initialHead: Number(value.initialHead) || 0,
    acceptance: ["final", "empty"].includes(value.acceptance) ? value.acceptance : "final",
    states: value.states.map((state, index) => ({ id: String(state.id || uid("q")), name: String(state.name ?? `q${index}`), x: Number(state.x) || 100 + index * 100, y: Number(state.y) || 150, start: Boolean(state.start), final: Boolean(state.final) })),
    transitions: value.transitions.map(rule => ({ id: String(rule.id || uid("t")), from: String(rule.from), to: String(rule.to), read: normalizeSymbol(rule.read, value.emptySymbol), pop: normalizeSymbol(rule.pop, value.emptySymbol), push: normalizeSymbol(rule.push, value.emptySymbol), write: String(rule.write ?? ""), move: ["L", "R", "N"].includes(rule.move) ? rule.move : "R" }))
  };
}

function stateById(id) { return machine.states.find(state => state.id === id); }
function transitionById(id) { return machine.transitions.find(rule => rule.id === id); }
function rulesBetween(from, to) { return machine.transitions.filter(rule => rule.from === from && rule.to === to); }
function stateLabel(id) { return stateById(id)?.name || "?"; }
function displaySymbol(symbol, value = machine) { return symbol === EPSILON ? (value.emptySymbol || "λ") : symbol; }
function isTapeMachine(type = machine.type) { return ["TM", "LBA"].includes(type); }

function addState(x, y) {
  const index = machine.states.length;
  const state = { id: uid("q"), name: `q${index}`, x, y, start: !machine.states.some(item => item.start), final: false };
  commit(() => { machine.states.push(state); selection = { kind: "state", id: state.id }; }, `Zustand ${state.name} angelegt`);
}

function deleteSelection() {
  if (!selection) return;
  commit(() => {
    if (selection.kind === "state") {
      machine.states = machine.states.filter(state => state.id !== selection.id);
      machine.transitions = machine.transitions.filter(rule => rule.from !== selection.id && rule.to !== selection.id);
    } else machine.transitions = machine.transitions.filter(rule => rule.id !== selection.id);
    selection = null;
  }, "Auswahl gelöscht");
}

function setTool(next) {
  tool = next;
  transitionSource = null;
  draftPoint = null;
  $$(".tool").forEach(button => button.classList.toggle("active", button.dataset.tool === tool));
  $("#modeHint").textContent = ({ select: "Zustände auswählen und verschieben", state: "Auf die Fläche klicken, um einen Zustand anzulegen", transition: "Quellzustand und anschließend Zielzustand anklicken", delete: "Zustand oder Übergang zum Löschen anklicken" })[tool];
  renderGraph();
}

function svgPoint(event) {
  const rect = $("#graph").getBoundingClientRect();
  return { x: (event.clientX - rect.left - panX) / zoom, y: (event.clientY - rect.top - panY) / zoom };
}

function applyView() {
  $("#world").setAttribute("transform", `translate(${panX} ${panY}) scale(${zoom})`);
  $("#zoomValue").textContent = `${Math.round(zoom * 100)} %`;
}

function edgeGeometry(from, to) {
  if (from.id === to.id) {
    return { path: `M ${from.x - 22} ${from.y - 29} C ${from.x - 68} ${from.y - 90}, ${from.x + 68} ${from.y - 90}, ${from.x + 22} ${from.y - 29}`, labelX: from.x, labelY: from.y - 79 };
  }
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / length, uy = dy / length;
  const reverse = machine.transitions.some(rule => rule.from === to.id && rule.to === from.id);
  const curve = reverse ? 30 : 0;
  const nx = -uy, ny = ux;
  const x1 = from.x + ux * 39, y1 = from.y + uy * 39;
  const x2 = to.x - ux * 43, y2 = to.y - uy * 43;
  const cx = (x1 + x2) / 2 + nx * curve, cy = (y1 + y2) / 2 + ny * curve;
  return { path: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, labelX: cx, labelY: cy - 10 };
}

function ruleLabel(rule) {
  return displaySymbol(rule.read || (isTapeMachine() ? machine.blank : EPSILON));
}

function ruleDetailLabel(rule) {
  if (machine.type === "PDA") return `${displaySymbol(rule.read || EPSILON)}, ${displaySymbol(rule.pop || EPSILON)} → ${displaySymbol(rule.push || EPSILON)}`;
  if (isTapeMachine()) return `${rule.read || machine.blank} → ${rule.write || machine.blank}, ${rule.move || "N"}`;
  return displaySymbol(rule.read || EPSILON);
}

function renderGraph() {
  const edgeLayer = $("#edgeLayer"), stateLayer = $("#stateLayer"), draftLayer = $("#draftLayer");
  edgeLayer.innerHTML = "";
  stateLayer.innerHTML = "";
  draftLayer.innerHTML = "";
  const groups = new Map();
  for (const rule of machine.transitions) {
    const key = `${rule.from}|${rule.to}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  }
  for (const rules of groups.values()) {
    const from = stateById(rules[0].from), to = stateById(rules[0].to);
    if (!from || !to) continue;
    const geometry = edgeGeometry(from, to);
    const labels = rules.map(ruleLabel);
    const width = Math.max(42, Math.min(270, Math.max(...labels.map(label => label.length)) * 6.5 + 14));
    const height = labels.length * 15 + 8;
    const selected = selection?.kind === "transition" && rules.some(rule => rule.id === selection.id);
    const active = rules.some(rule => sim.activeTransitions.includes(rule.id));
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", `edge-group${selected ? " selected" : ""}${active ? " active" : ""}`);
    group.dataset.transitionId = rules[0].id;
    group.innerHTML = `<path class="edge-hit" d="${geometry.path}"></path><path class="edge-path" d="${geometry.path}"></path><rect class="edge-label-bg" x="${geometry.labelX - width / 2}" y="${geometry.labelY - height / 2}" width="${width}" height="${height}" rx="5"></rect>${labels.map((label, index) => `<text class="edge-label" x="${geometry.labelX}" y="${geometry.labelY - (labels.length - 1) * 7.5 + index * 15}">${esc(label)}</text>`).join("")}`;
    edgeLayer.appendChild(group);
  }
  for (const state of machine.states) {
    if (state.start) {
      const arrow = document.createElementNS(SVG_NS, "path");
      arrow.setAttribute("class", "start-arrow");
      arrow.setAttribute("d", `M ${state.x - 82} ${state.y} L ${state.x - 42} ${state.y}`);
      stateLayer.appendChild(arrow);
    }
    const group = document.createElementNS(SVG_NS, "g");
    const selected = selection?.kind === "state" && selection.id === state.id;
    const active = sim.configs.some(config => config.stateId === state.id);
    group.setAttribute("class", `graph-state${selected ? " selected" : ""}${active ? " active" : ""}`);
    group.dataset.stateId = state.id;
    group.setAttribute("transform", `translate(${state.x} ${state.y})`);
    group.innerHTML = `<circle class="state-circle" r="36"></circle>${state.final ? '<circle class="state-final" r="30"></circle>' : ""}<text class="state-label">${esc(state.name)}</text>`;
    stateLayer.appendChild(group);
  }
  if (transitionSource && draftPoint) {
    const from = stateById(transitionSource);
    if (from) draftLayer.innerHTML = `<path class="draft-line" d="M ${from.x} ${from.y} L ${draftPoint.x} ${draftPoint.y}"></path>`;
  }
  applyView();
}

function symbolSelect(id, label, symbols, selected) {
  const values = unique(symbols.filter(Boolean));
  return `<label><span>${label}</span><select id="${id}">${values.map(symbol => `<option value="${esc(symbol)}" ${symbol === selected ? "selected" : ""}>${esc(displaySymbol(symbol))}</option>`).join("")}</select></label>`;
}

function transitionFields(rule = {}) {
  const terminals = machine.alphabet;
  const workSymbols = unique([...machine.alphabet, ...machine.nonterminals, ...(machine.type === "LBA" ? [machine.boundaryLeft, machine.boundaryRight] : [machine.blank])]);
  if (machine.type === "PDA") return `<div class="property-section">${symbolSelect("trRead", "Terminal lesen", [...terminals, EPSILON], rule.read || EPSILON)}${symbolSelect("trPop", "Nichtterminal vom Keller", [...machine.nonterminals, machine.blank, EPSILON], rule.pop || machine.blank)}<label><span>Durch Kellerwort ersetzen</span><input id="trPush" value="${esc(displaySymbol(rule.push || EPSILON))}" list="stackSymbols"><datalist id="stackSymbols">${unique([...machine.nonterminals, machine.blank, EPSILON]).map(symbol => `<option value="${esc(displaySymbol(symbol))}">`).join("")}</datalist></label></div>`;
  if (isTapeMachine()) return `<div class="property-section">${symbolSelect("trRead", "Bandsymbol lesen", workSymbols, rule.read || machine.blank)}${symbolSelect("trWrite", "Bandsymbol schreiben", workSymbols, rule.write || machine.blank)}<label><span>Kopfbewegung</span><select id="trMove"><option ${rule.move === "L" ? "selected" : ""}>L</option><option ${rule.move === "R" || !rule.move ? "selected" : ""}>R</option><option ${rule.move === "N" ? "selected" : ""}>N</option></select></label></div>`;
  return symbolSelect("trRead", "Terminal lesen", machine.type === "NFA" ? [...terminals, EPSILON] : terminals, rule.read || terminals[0] || "");
}

function openTransitionDialog(fromId, toId, editId = null) {
  const rule = editId ? transitionById(editId) : null;
  pendingTransition = { fromId, toId, editId };
  $("#transitionTitle").textContent = `${stateLabel(fromId)} → ${stateLabel(toId)}`;
  $("#transitionFields").innerHTML = transitionFields(rule || {});
  $("#transitionHelp").textContent = machine.type === "PDA" ? `${machine.emptySymbol} erzeugt einen Lambda-Sprung. Mit „Top entfernen“ und leerem Ersatzwort wird dabei genau ein Kellerelement entfernt.` : isTapeMachine() ? "Band- und Markierungssymbole stammen aus den Maschineneigenschaften. Wähle zusätzlich die Kopfbewegung L, R oder N." : machine.type === "NFA" ? `Es können Terminale aus Σ oder ${machine.emptySymbol} gewählt werden.` : "Es kann genau ein Terminal aus Σ gewählt werden.";
  $("#transitionDialog").showModal();
  setTimeout(() => $("#trRead")?.focus(), 30);
}

function submitTransition() {
  if (!pendingTransition) return;
  const base = { from: pendingTransition.fromId, to: pendingTransition.toId, read: normalizeSymbol($("#trRead")?.value, machine.emptySymbol), pop: EPSILON, push: EPSILON, write: "", move: "R" };
  let rules;
  if (["DFA", "NFA"].includes(machine.type)) rules = [{ ...base, id: uid("t") }];
  else if (machine.type === "PDA") rules = [{ ...base, id: uid("t"), pop: normalizeSymbol($("#trPop").value, machine.emptySymbol), push: normalizeSymbol($("#trPush").value, machine.emptySymbol) }];
  else rules = [{ ...base, id: uid("t"), write: $("#trWrite").value || machine.blank, move: $("#trMove").value }];
  if (!rules.length || !rules[0].read) { toast("Übergangsregel ist unvollständig"); return; }
  commit(() => {
    if (pendingTransition.editId) machine.transitions = machine.transitions.filter(rule => rule.id !== pendingTransition.editId);
    machine.transitions.push(...rules);
    selection = { kind: "transition", id: rules[0].id };
  }, `${rules.length} Übergangsregel${rules.length === 1 ? "" : "n"} angelegt`);
  pendingTransition = null;
  $("#transitionDialog").close();
}

function renderInspector() {
  const empty = $("#inspectorEmpty"), form = $("#propertyForm");
  if (!selection) {
    empty.classList.add("hidden");
    form.classList.remove("hidden");
    const nonterminalHint = machine.type === "PDA" ? "Keller-/Nichtterminale N" : isTapeMachine() ? "Arbeits-/Nichtterminale N" : "Nichtterminale N";
    const tapeFields = machine.type === "TM" ? `<label><span>Band-Leersymbol</span><input name="blank" value="${esc(machine.blank)}" maxlength="3"></label>` : machine.type === "LBA" ? `<label><span>Linke Bandgrenze</span><input name="boundaryLeft" value="${esc(machine.boundaryLeft)}" maxlength="3"></label><label><span>Rechte Bandgrenze</span><input name="boundaryRight" value="${esc(machine.boundaryRight)}" maxlength="3"></label>` : "";
    form.innerHTML = `<div class="property-section"><h3>Symbolmengen dieses Automaten</h3><label><span>Terminale Σ</span><input name="alphabet" value="${esc(machine.alphabet.join(", "))}" placeholder="z. B. a, b"></label><label><span>${nonterminalHint}</span><input name="nonterminals" value="${esc(machine.nonterminals.join(", "))}" placeholder="z. B. A, B"></label><label><span>Leerwort-/Lambda-Symbol</span><input name="emptySymbol" value="${esc(machine.emptySymbol)}" maxlength="3" placeholder="λ"></label>${machine.type === "PDA" ? `<label><span>Kelleralphabet Γ</span><input value="${esc(machine.stackAlphabet.join(", "))}" disabled></label><label><span>Akzeptanz</span><select name="acceptance"><option value="final" ${machine.acceptance === "final" ? "selected" : ""}>Endzustand</option><option value="empty" ${machine.acceptance === "empty" ? "selected" : ""}>Leerer Keller</option></select></label>` : ""}${tapeFields}</div><div class="property-section"><h3>Definition</h3><div class="formal-tuple">${formalDefinition()}</div></div>`;
    return;
  }
  empty.classList.add("hidden"); form.classList.remove("hidden");
  if (selection.kind === "state") {
    const state = stateById(selection.id);
    if (!state) { selection = null; renderInspector(); return; }
    form.innerHTML = `<div class="property-section"><h3>Zustand ${esc(state.name)}</h3><label><span>Name</span><input name="name" value="${esc(state.name)}"></label><label class="check-row"><input name="start" type="checkbox" ${state.start ? "checked" : ""}><span>Startzustand</span></label><label class="check-row"><input name="final" type="checkbox" ${state.final ? "checked" : ""}><span>Endzustand</span></label></div><div class="property-section"><h3>Position</h3><label><span>x</span><input name="x" type="number" value="${Math.round(state.x)}"></label><label><span>y</span><input name="y" type="number" value="${Math.round(state.y)}"></label></div><button class="btn danger-btn" data-delete type="button">Zustand löschen</button>`;
  } else {
    const rule = transitionById(selection.id);
    if (!rule) { selection = null; renderInspector(); return; }
    const siblings = rulesBetween(rule.from, rule.to);
    form.innerHTML = `<div class="property-section"><h3>${esc(stateLabel(rule.from))} → ${esc(stateLabel(rule.to))}</h3>${siblings.map(item => `<button class="btn ${item.id === rule.id ? "primary" : ""}" data-select-rule="${item.id}" type="button">Terminal ${esc(ruleLabel(item))}</button>`).join("")}</div><div class="property-section"><h3>Gewählte Regel</h3><div class="formal-tuple">${esc(ruleDetailLabel(rule))}</div><button class="btn" data-edit-rule type="button">Regel bearbeiten</button></div><button class="btn danger-btn" data-delete type="button">Regel löschen</button>`;
  }
}

function updateProperty(target) {
  if (!target.name) return;
  if (!selection) {
    commit(() => {
      if (["alphabet", "nonterminals"].includes(target.name)) {
        machine[target.name] = unique(target.value.split(",").map(value => value.trim()).filter(Boolean));
        if (machine.type === "PDA") machine.stackAlphabet = unique([...machine.nonterminals, machine.blank]);
      }
      else machine[target.name] = target.value;
    }, "Maschineneigenschaft geändert");
    return;
  }
  if (selection.kind !== "state") return;
  const state = stateById(selection.id);
  if (!state) return;
  commit(() => {
    if (target.name === "start" && target.checked && machine.type !== "NFA") machine.states.forEach(item => { item.start = false; });
    state[target.name] = target.type === "checkbox" ? target.checked : target.type === "number" ? Number(target.value) : target.value.trim();
  }, `Zustand ${state.name} geändert`);
}

function validateMachine() {
  const issues = [];
  if (!machine.emptySymbol) issues.push("Leerwortsymbol fehlt");
  if (machine.alphabet.includes(machine.emptySymbol)) issues.push("Leerwortsymbol darf kein Terminal sein");
  const starts = machine.states.filter(state => state.start);
  if (!starts.length) issues.push("Kein Startzustand");
  if (["DFA", "PDA", "TM", "LBA"].includes(machine.type) && starts.length > 1) issues.push("Mehr als ein Startzustand");
  if (!machine.states.some(state => state.final) && machine.acceptance !== "empty") issues.push("Kein Endzustand");
  const duplicateNames = machine.states.filter((state, index) => machine.states.findIndex(item => item.name === state.name) !== index);
  if (duplicateNames.length) issues.push("Zustandsnamen nicht eindeutig");
  if (machine.type === "DFA") {
    if (machine.transitions.some(rule => rule.read === EPSILON)) issues.push(`DFA enthält ${machine.emptySymbol}-Übergang`);
    for (const state of machine.states) for (const symbol of machine.alphabet) {
      const count = machine.transitions.filter(rule => rule.from === state.id && rule.read === symbol).length;
      if (count > 1) issues.push(`Nichtdeterministisch: δ(${state.name},${symbol})`);
      if (count === 0) issues.push(`Unvollständig: δ(${state.name},${symbol})`);
    }
  }
  if (machine.type === "PDA") {
    if (!isPdaDeterministic()) issues.push("PDA ist nichtdeterministisch");
    if (machine.transitions.some(rule => rule.read !== EPSILON && !machine.alphabet.includes(rule.read))) issues.push("Übergang liest unbekanntes Terminal");
    if (machine.transitions.some(rule => rule.pop !== EPSILON && !machine.stackAlphabet.includes(rule.pop))) issues.push("Übergang nutzt unbekanntes Kellersymbol");
  }
  if (isTapeMachine()) {
    if (!isTmDeterministic()) issues.push(`${machine.type} ist nichtdeterministisch`);
    if (machine.alphabet.includes(machine.blank)) issues.push("Leersymbol darf nicht in Σ liegen");
    const tapeSymbols = new Set([...machine.alphabet, ...machine.nonterminals, machine.blank, machine.boundaryLeft, machine.boundaryRight]);
    if (machine.transitions.some(rule => !tapeSymbols.has(rule.read) || !tapeSymbols.has(rule.write))) issues.push("Übergang nutzt unbekanntes Bandsymbol");
    if (machine.type === "LBA" && machine.boundaryLeft === machine.boundaryRight) issues.push("LBA-Bandgrenzen müssen verschieden sein");
  }
  return unique(issues);
}

function isPdaDeterministic() {
  for (const state of machine.states) for (const top of machine.stackAlphabet) {
    const rules = machine.transitions.filter(rule => rule.from === state.id && rule.pop === top);
    const reads = rules.map(rule => rule.read);
    if (new Set(reads).size !== reads.length) return false;
    if (reads.includes(EPSILON) && reads.length > 1) return false;
  }
  return true;
}

function isTmDeterministic() {
  const keys = machine.transitions.map(rule => `${rule.from}|${rule.read}`);
  return new Set(keys).size === keys.length;
}

function machineKindLabel() {
  if (machine.type === "PDA") return isPdaDeterministic() ? "DPDA" : "PDA";
  if (machine.type === "TM") return isTmDeterministic() ? "DTM" : "NTM";
  if (machine.type === "LBA") return "LBA";
  return machine.type;
}

function reachableStateIds() {
  const reached = new Set(machine.states.filter(state => state.start).map(state => state.id));
  const queue = [...reached];
  while (queue.length) {
    const id = queue.shift();
    for (const rule of machine.transitions.filter(item => item.from === id)) if (!reached.has(rule.to)) { reached.add(rule.to); queue.push(rule.to); }
  }
  return reached;
}

function renderValidation() {
  const issues = validateMachine();
  const unreachable = machine.states.filter(state => !reachableStateIds().has(state.id));
  $("#validationCard").innerHTML = `<strong>Validierung</strong>${issues.length ? issues.slice(0, 5).map(issue => `<div class="warn">● ${esc(issue)}</div>`).join("") : '<div class="ok">● Formale Bedingungen erfüllt</div>'}${unreachable.length ? `<div class="warn">● ${unreachable.length} unerreichbar</div>` : ""}`;
}

function formalDefinition() {
  const sigma = `{${machine.alphabet.join(", ")}}`, states = `{${machine.states.map(state => state.name).join(", ")}}`, starts = machine.states.filter(state => state.start).map(state => state.name), finals = `{${machine.states.filter(state => state.final).map(state => state.name).join(", ")}}`;
  if (machine.type === "DFA") return `M = (${sigma}, ${states}, δ, ${starts[0] || "–"}, ${finals})`;
  if (machine.type === "NFA") return `M = (${sigma}, ${states}, δ, {${starts.join(", ")}}, ${finals})`;
  if (machine.type === "PDA") return `M = (${sigma}, {${machine.stackAlphabet.join(", ")}}, ${states}, δ, ${starts[0] || "–"}, ${finals})`;
  if (machine.type === "LBA") return `M = (${sigma}, {${unique([...machine.alphabet, ...machine.nonterminals, machine.boundaryLeft, machine.boundaryRight]).join(", ")}}, ${states}, δ, ${starts[0] || "–"}, ${finals})`;
  return `M = (${sigma}, {${unique([...machine.alphabet, ...machine.nonterminals, machine.blank]).join(", ")}}, ${states}, δ, ${starts[0] || "–"}, ${finals}, ${machine.blank})`;
}

function renderStatus() {
  const kind = machineKindLabel();
  $("#statusText").textContent = `${kind} · ${machine.states.length} Zustände · ${machine.transitions.length} Regeln`;
  $("#selectionText").textContent = selection ? selection.kind === "state" ? `Zustand ${stateLabel(selection.id)}` : `Übergang ${ruleLabel(transitionById(selection.id) || {})}` : "Keine Auswahl";
  $("#machineType").value = machine.type;
  $("#machineName").value = machine.name;
  $("#undoBtn").disabled = !history.length;
  $("#redoBtn").disabled = !future.length;
}

function render() {
  $$(".pda-only").forEach(element => element.classList.toggle("hidden", machine.type !== "PDA"));
  $$(".tm-only").forEach(element => element.classList.toggle("hidden", !isTapeMachine()));
  $("#initialStack").value = machine.initialStack || machine.blank;
  $("#initialHead").value = machine.initialHead || 0;
  renderGraph();
  renderInspector();
  renderValidation();
  renderStatus();
  renderSimulation();
  renderLog();
  renderProgramMeta();
}

// Simulation ---------------------------------------------------------------

function configKey(config) {
  if (machine.type === "PDA") return `${config.stateId}|${config.pos}|${config.stack.join("")}`;
  if (isTapeMachine()) return `${config.stateId}|${config.head}|${Object.entries(config.tape).sort((a, b) => Number(a[0]) - Number(b[0])).map(([key, value]) => `${key}:${value}`).join(";")}`;
  return `${config.stateId}|${config.pos}`;
}

function epsilonClosure(configs) {
  if (! ["NFA"].includes(machine.type)) return configs;
  const result = [...configs], queue = [...configs], seen = new Set(configs.map(configKey));
  while (queue.length) {
    const config = queue.shift();
    for (const rule of machine.transitions.filter(item => item.from === config.stateId && item.read === EPSILON)) {
      const next = { ...config, stateId: rule.to, path: [...config.path, rule.id] };
      const key = configKey(next);
      if (!seen.has(key)) { seen.add(key); result.push(next); queue.push(next); }
    }
  }
  return result;
}

function resetSimulation(renderNow = true) {
  clearInterval(playTimer); playTimer = 0;
  sim = emptySimulation();
  sim.word = $("#wordInput")?.value || "";
  if (renderNow) render();
}

function startSimulation() {
  const starts = machine.states.filter(state => state.start);
  sim = emptySimulation();
  sim.word = $("#wordInput").value;
  if (!starts.length) { sim.status = "rejected"; sim.message = "Kein Startzustand definiert"; renderSimulation(); return false; }
  if (["DFA", "NFA"].includes(machine.type)) sim.configs = epsilonClosure(starts.map(state => ({ stateId: state.id, pos: 0, path: [] })));
  if (machine.type === "PDA") sim.configs = [{ stateId: starts[0].id, pos: 0, stack: [...(machine.initialStack || machine.blank)], path: [] }];
  if (isTapeMachine()) {
    const tape = {}; [...sim.word].forEach((symbol, index) => { tape[index] = symbol; });
    if (machine.type === "LBA") { tape[-1] = machine.boundaryLeft; tape[sim.word.length] = machine.boundaryRight; }
    sim.configs = starts.map(state => ({ stateId: state.id, head: Number(machine.initialHead) || 0, tape, minHead: machine.type === "LBA" ? -1 : undefined, maxHead: machine.type === "LBA" ? sim.word.length : undefined, path: [] }));
  }
  sim.seen = new Set(sim.configs.map(configKey));
  sim.status = "running"; sim.message = "Startkonfiguration geladen";
  addLog("Simulation gestartet", `Eingabe: ${sim.word || machine.emptySymbol}`);
  render(); return true;
}

function isAccepted(config) {
  const state = stateById(config.stateId);
  if (!state) return false;
  if (["DFA", "NFA"].includes(machine.type)) return config.pos === sim.word.length && state.final;
  if (machine.type === "PDA") return config.pos === sim.word.length && (machine.acceptance === "empty" ? config.stack.length === 0 : state.final);
  return state.final;
}

function stepFinite() {
  if (sim.configs.some(isAccepted)) return finishSimulation("accepted", "Wort akzeptiert");
  const next = [], used = [];
  for (const config of sim.configs) {
    if (config.pos >= sim.word.length) continue;
    const symbol = sim.word[config.pos];
    for (const rule of machine.transitions.filter(item => item.from === config.stateId && item.read === symbol)) {
      next.push({ stateId: rule.to, pos: config.pos + 1, path: [...config.path, rule.id] }); used.push(rule.id);
    }
  }
  sim.configs = epsilonClosure(next);
  sim.activeTransitions = unique([...used, ...sim.configs.flatMap(config => config.path.slice(-1))]);
  if (!sim.configs.length) return finishSimulation("rejected", "Keine passende Überführung");
  if (sim.configs.some(isAccepted)) return finishSimulation("accepted", "Wort akzeptiert");
  if (sim.configs.every(config => config.pos >= sim.word.length)) return finishSimulation("rejected", "Eingabe vollständig, kein Endzustand erreicht");
}

function stepPda() {
  if (sim.configs.some(isAccepted)) return finishSimulation("accepted", machine.acceptance === "empty" ? "Mit leerem Keller akzeptiert" : "Im Endzustand akzeptiert");
  const next = [], used = [];
  for (const config of sim.configs) {
    const top = config.stack[0];
    for (const rule of machine.transitions.filter(item => item.from === config.stateId)) {
      const consumes = rule.read !== EPSILON;
      if (consumes && sim.word[config.pos] !== rule.read) continue;
      if (rule.pop !== EPSILON && top !== rule.pop) continue;
      const stack = [...config.stack];
      if (rule.pop !== EPSILON) stack.shift();
      if (rule.push !== EPSILON) stack.unshift(...[...rule.push]);
      const candidate = { stateId: rule.to, pos: config.pos + (consumes ? 1 : 0), stack, path: [...config.path, rule.id] };
      const key = configKey(candidate);
      if (!sim.seen.has(key)) { sim.seen.add(key); next.push(candidate); used.push(rule.id); }
    }
  }
  sim.configs = next.slice(0, 500); sim.activeTransitions = unique(used);
  if (!next.length) return finishSimulation("rejected", "Keine Folgekonfiguration");
  if (sim.configs.some(isAccepted)) return finishSimulation("accepted", "Wort akzeptiert");
}

function tapeRead(config) { return config.tape[config.head] ?? machine.blank; }

function stepTm() {
  if (sim.configs.some(isAccepted)) return finishSimulation("accepted", "Endzustand erreicht");
  const next = [], used = [];
  for (const config of sim.configs) for (const rule of machine.transitions.filter(item => item.from === config.stateId && item.read === tapeRead(config))) {
    const tape = { ...config.tape }, current = tapeRead(config), write = rule.write || machine.blank;
    if (machine.type === "LBA" && [machine.boundaryLeft, machine.boundaryRight].includes(current) && write !== current) continue;
    if (write === machine.blank && machine.type !== "LBA") delete tape[config.head]; else tape[config.head] = write;
    const head = config.head + (rule.move === "L" ? -1 : rule.move === "R" ? 1 : 0);
    if (machine.type === "LBA" && (head < config.minHead || head > config.maxHead)) continue;
    const candidate = { stateId: rule.to, head, tape, minHead: config.minHead, maxHead: config.maxHead, path: [...config.path, rule.id] };
    const key = configKey(candidate);
    if (!sim.seen.has(key)) { sim.seen.add(key); next.push(candidate); used.push(rule.id); }
  }
  sim.configs = next.slice(0, 500); sim.activeTransitions = unique(used);
  if (!next.length) return finishSimulation("rejected", "Maschine hält verwerfend");
  if (sim.configs.some(isAccepted)) return finishSimulation("accepted", "Endzustand erreicht");
}

function finishSimulation(status, message) {
  sim.status = status; sim.message = message;
  clearInterval(playTimer); playTimer = 0;
  addLog(status === "accepted" ? "Akzeptiert" : "Verworfen", message);
}

function simulationStep() {
  if (sim.status === "idle" && !startSimulation()) return;
  if (sim.status !== "running") return;
  const limit = Math.max(1, Number($("#stepLimit").value) || 250);
  if (sim.step >= limit) { finishSimulation("limit", `Schrittlimit ${limit} erreicht`); render(); return; }
  sim.step++;
  if (["DFA", "NFA"].includes(machine.type)) stepFinite();
  else if (machine.type === "PDA") stepPda(); else stepTm();
  sim.message = sim.status === "running" ? `Schritt ${sim.step}: ${sim.configs.length} aktive Konfiguration${sim.configs.length === 1 ? "" : "en"}` : sim.message;
  addLog(`Simulationsschritt ${sim.step}`, sim.message);
  render();
}

function togglePlay() {
  if (playTimer) { clearInterval(playTimer); playTimer = 0; $("#simPlayBtn").textContent = "▶ Abspielen"; return; }
  if (sim.status !== "running" && !startSimulation()) return;
  $("#simPlayBtn").textContent = "Ⅱ Pause";
  const delay = Math.max(60, Number($("#simSpeed").value) || 420);
  playTimer = setInterval(() => { simulationStep(); if (sim.status !== "running") { clearInterval(playTimer); playTimer = 0; $("#simPlayBtn").textContent = "▶ Abspielen"; } }, delay);
}

function configText(config) {
  if (["DFA", "NFA"].includes(machine.type)) return `(${stateLabel(config.stateId)}, ${sim.word.slice(config.pos) || machine.emptySymbol})`;
  if (machine.type === "PDA") return `(${stateLabel(config.stateId)}, ${sim.word.slice(config.pos) || machine.emptySymbol}, ${config.stack.join("") || machine.emptySymbol})`;
  return `(${stateLabel(config.stateId)}, Kopf ${config.head}, liest ${tapeRead(config)})`;
}

function renderSimulation() {
  const simulationNames = { DFA: "Deterministischen Automaten ausführen", NFA: "Nichtdeterministischen Automaten ausführen", PDA: "Kellerautomaten ausführen", TM: "Turingmaschine ausführen", LBA: "Linear beschränkten Automaten ausführen" };
  $("#simMachineTitle").textContent = simulationNames[machine.type];
  $("#inputDataLabel").textContent = isTapeMachine() ? "BAND" : "EINGABE";
  $("#memoryDataLabel").textContent = machine.type === "PDA" ? "KELLER" : isTapeMachine() ? "BANDKONFIGURATION" : "AKTIVE ZUSTÄNDE";
  const status = $("#simStatus"); status.className = `sim-status ${sim.status}`; status.textContent = sim.message;
  const first = sim.configs[0];
  if (isTapeMachine()) {
    let displayConfig = first;
    if (!displayConfig && machine.type === "LBA") {
      const tape = { [-1]: machine.boundaryLeft, [sim.word.length]: machine.boundaryRight }; [...sim.word].forEach((symbol, index) => { tape[index] = symbol; });
      displayConfig = { tape, head: machine.initialHead, minHead: -1, maxHead: sim.word.length };
    }
    const positions = displayConfig ? Object.keys(displayConfig.tape).map(Number) : [];
    const center = displayConfig?.head || 0, min = machine.type === "LBA" && displayConfig ? displayConfig.minHead : Math.min(center - 5, ...positions, 0), max = machine.type === "LBA" && displayConfig ? displayConfig.maxHead : Math.max(center + 5, ...positions, 5);
    $("#wordTape").innerHTML = Array.from({ length: max - min + 1 }, (_, offset) => { const index = min + offset; return `<span class="tape-cell ${displayConfig?.head === index ? "head" : ""}" title="Position ${index}">${esc(displayConfig?.tape[index] ?? machine.blank)}</span>`; }).join("");
    $("#machineMemory").textContent = first ? `Bandkonfiguration · Zustand ${stateLabel(first.stateId)} · Kopfposition ${first.head}${machine.type === "LBA" ? " · Grenzen erzwungen" : ""}` : `${machine.type}-Band wird beim Start initialisiert`;
  } else {
    const position = first?.pos ?? 0;
    $("#wordTape").innerHTML = (sim.word ? [...sim.word] : [machine.emptySymbol]).map((symbol, index) => `<span class="tape-cell ${index < position ? "consumed" : index === position ? "current" : ""}">${esc(symbol)}</span>`).join("");
    if (machine.type === "PDA") {
      const stack = first?.stack || [...(machine.initialStack || machine.blank)];
      $("#machineMemory").innerHTML = `<div class="stack-stage"><div class="stack-box">${stack.length ? stack.map(symbol => `<span class="stack-cell">${esc(symbol)}</span>`).join("") : `<span class="stack-cell">${esc(machine.emptySymbol)}</span>`}</div><div class="stack-caption"><strong>Keller</strong><br>Top oben · ${sim.configs.length} aktive Konfiguration${sim.configs.length === 1 ? "" : "en"}</div></div>`;
    } else $("#machineMemory").textContent = `Aktive Zustände: ${unique(sim.configs.map(config => stateLabel(config.stateId))).join(", ") || "–"}`;
  }
  $("#configList").innerHTML = sim.configs.length ? sim.configs.map(config => `<div class="config-item ${isAccepted(config) ? "accept" : ""}">${esc(configText(config))}</div>`).join("") : '<div class="empty"><p>Noch keine Konfigurationen.</p></div>';
}

function renderLog() {
  $("#operationLog").innerHTML = operationLog.length ? operationLog.map(entry => `<div class="log-entry"><strong>${esc(entry.message)}</strong><p>${esc(entry.detail)}${entry.detail ? " · " : ""}${entry.time}</p></div>`).join("") : "<p>Operationen und Simulationsschritte erscheinen hier.</p>";
}

// Transformations ----------------------------------------------------------

function epsilonClosureIds(ids) {
  const result = new Set(ids), queue = [...ids];
  while (queue.length) {
    const id = queue.shift();
    for (const rule of machine.transitions.filter(item => item.from === id && item.read === EPSILON)) if (!result.has(rule.to)) { result.add(rule.to); queue.push(rule.to); }
  }
  return [...result].sort();
}

function determinize() {
  if (machine.type !== "NFA") { toast("Potenzmengenkonstruktion benötigt einen NFA"); return; }
  const starts = epsilonClosureIds(machine.states.filter(state => state.start).map(state => state.id));
  if (!starts.length) { toast("Kein Startzustand"); return; }
  const result = newMachine("DFA"); result.name = `${machine.name} – DFA`; result.alphabet = machine.alphabet.filter(symbol => symbol !== EPSILON);
  const subsetMap = new Map(), queue = [];
  const addSubset = subset => {
    const key = subset.join("|"); if (subsetMap.has(key)) return subsetMap.get(key);
    const index = subsetMap.size; const names = subset.map(stateLabel);
    const state = { id: uid("q"), name: `{${names.join(",") || "∅"}}`, x: 150 + (index % 4) * 180, y: 130 + Math.floor(index / 4) * 150, start: index === 0, final: subset.some(id => stateById(id)?.final), subset };
    subsetMap.set(key, state); result.states.push(state); queue.push(state); return state;
  };
  addSubset(starts);
  while (queue.length) {
    const from = queue.shift();
    for (const symbol of result.alphabet) {
      const targets = epsilonClosureIds(unique(from.subset.flatMap(id => machine.transitions.filter(rule => rule.from === id && rule.read === symbol).map(rule => rule.to))));
      if (!targets.length) continue;
      const to = addSubset(targets); result.transitions.push({ id: uid("t"), from: from.id, to: to.id, read: symbol, pop: EPSILON, push: EPSILON, write: "", move: "R" });
    }
  }
  result.states.forEach(state => delete state.subset);
  commit(() => { machine = result; selection = null; }, "Potenzmengenkonstruktion abgeschlossen");
}

function completeDfaData(source) {
  const result = clone(source); let trap = null;
  for (const state of [...result.states]) for (const symbol of result.alphabet) if (!result.transitions.some(rule => rule.from === state.id && rule.read === symbol)) {
    if (!trap) { trap = { id: uid("q"), name: "qTrap", x: 160 + (result.states.length % 4) * 180, y: 130 + Math.floor(result.states.length / 4) * 150, start: false, final: false }; result.states.push(trap); }
    result.transitions.push({ id: uid("t"), from: state.id, to: trap.id, read: symbol, pop: EPSILON, push: EPSILON, write: "", move: "R" });
  }
  if (trap) for (const symbol of result.alphabet) result.transitions.push({ id: uid("t"), from: trap.id, to: trap.id, read: symbol, pop: EPSILON, push: EPSILON, write: "", move: "R" });
  return result;
}

function completeDfa() {
  if (machine.type !== "DFA") { toast("Nur DFA können so vervollständigt werden"); return; }
  const completed = completeDfaData(machine);
  if (completed.states.length === machine.states.length) { toast("DFA ist bereits vollständig"); return; }
  commit(() => { machine = completed; selection = null; }, "Fangzustand ergänzt");
}

function removeUnreachable() {
  const reached = reachableStateIds();
  const count = machine.states.length - reached.size;
  if (!count) { toast("Alle Zustände sind erreichbar"); return; }
  commit(() => { machine.states = machine.states.filter(state => reached.has(state.id)); machine.transitions = machine.transitions.filter(rule => reached.has(rule.from) && reached.has(rule.to)); selection = null; }, `${count} unerreichbare Zustände entfernt`);
}

function minimizeDfa() {
  if (machine.type !== "DFA" || machine.transitions.some(rule => rule.read === EPSILON) || validateMachine().some(issue => issue.includes("Nichtdeterministisch"))) { toast("Minimierung benötigt einen deterministischen DFA"); return; }
  let source = completeDfaData(machine);
  const startIds = new Set(machine.states.filter(state => state.start).map(state => state.id));
  const reachable = new Set(); const queue = [...startIds]; queue.forEach(id => reachable.add(id));
  while (queue.length) { const id = queue.shift(); for (const rule of source.transitions.filter(item => item.from === id)) if (!reachable.has(rule.to)) { reachable.add(rule.to); queue.push(rule.to); } }
  source.states = source.states.filter(state => reachable.has(state.id)); source.transitions = source.transitions.filter(rule => reachable.has(rule.from) && reachable.has(rule.to));
  let partitions = [source.states.filter(state => state.final).map(state => state.id), source.states.filter(state => !state.final).map(state => state.id)].filter(group => group.length);
  let changed = true;
  while (changed) {
    changed = false; const next = [];
    for (const group of partitions) {
      const buckets = new Map();
      for (const id of group) {
        const signature = source.alphabet.map(symbol => { const to = source.transitions.find(rule => rule.from === id && rule.read === symbol)?.to; return partitions.findIndex(part => part.includes(to)); }).join("|");
        if (!buckets.has(signature)) buckets.set(signature, []); buckets.get(signature).push(id);
      }
      next.push(...buckets.values()); if (buckets.size > 1) changed = true;
    }
    partitions = next;
  }
  const result = newMachine("DFA"); result.name = `${machine.name} – minimal`; result.alphabet = [...source.alphabet];
  const groupState = new Map();
  partitions.forEach((group, index) => { const members = group.map(id => source.states.find(state => state.id === id)); const state = { id: uid("q"), name: members.map(item => item.name).join("/") || "∅", x: 150 + (index % 4) * 190, y: 140 + Math.floor(index / 4) * 150, start: members.some(item => item.start), final: members.some(item => item.final) }; result.states.push(state); group.forEach(id => groupState.set(id, state)); });
  for (const [index, group] of partitions.entries()) for (const symbol of result.alphabet) { const original = source.transitions.find(rule => rule.from === group[0] && rule.read === symbol); if (original) result.transitions.push({ id: uid("t"), from: result.states[index].id, to: groupState.get(original.to).id, read: symbol, pop: EPSILON, push: EPSILON, write: "", move: "R" }); }
  commit(() => { machine = result; selection = null; }, `DFA auf ${result.states.length} Zustände minimiert`);
}

function transitionTableHtml() {
  if (["DFA", "NFA"].includes(machine.type)) {
    const symbols = unique([...machine.alphabet, ...(machine.transitions.some(rule => rule.read === EPSILON) ? [EPSILON] : [])]);
    return `<table class="transition-table"><thead><tr><th>Zustand</th>${symbols.map(symbol => `<th>${esc(symbol)}</th>`).join("")}</tr></thead><tbody>${machine.states.map(state => `<tr><td>${state.start ? "→" : ""}${state.final ? "*" : ""}${esc(state.name)}</td>${symbols.map(symbol => `<td>${esc(machine.transitions.filter(rule => rule.from === state.id && rule.read === symbol).map(rule => stateLabel(rule.to)).join(", ") || "–")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  return `<table class="transition-table"><thead><tr><th>Von</th><th>Regel</th><th>Nach</th></tr></thead><tbody>${machine.transitions.map(rule => `<tr><td>${esc(stateLabel(rule.from))}</td><td>${esc(ruleDetailLabel(rule))}</td><td>${esc(stateLabel(rule.to))}</td></tr>`).join("")}</tbody></table>`;
}

function grammarText() {
  if (!["DFA", "NFA"].includes(machine.type)) return "Eine rechtslineare Grammatik wird nur für endliche Automaten erzeugt.";
  const lines = [];
  for (const state of machine.states) {
    const rules = machine.transitions.filter(rule => rule.from === state.id && rule.read !== EPSILON).map(rule => `${rule.read}${stateLabel(rule.to)}`);
    if (state.final) rules.push(machine.emptySymbol);
    for (const rule of machine.transitions.filter(rule => rule.from === state.id && rule.read === EPSILON)) rules.push(stateLabel(rule.to));
    lines.push(`${state.name} → ${rules.join(" | ") || "∅"}`);
  }
  return `G = (Σ, N, S, R)\nΣ = {${machine.alphabet.join(", ")}}\nN = {${machine.states.map(state => state.name).join(", ")}}\nS = ${machine.states.find(state => state.start)?.name || "–"}\n\n${lines.join("\n")}`;
}

function showInfo(title, content, eyebrow = "ANALYSE") {
  $("#infoTitle").textContent = title; $("#infoEyebrow").textContent = eyebrow; $("#infoContent").innerHTML = content; $("#infoDialog").showModal();
}

// Textueller Programmeditor -------------------------------------------------

function programHelp() {
  if (machine.type === "PDA") return `PDA: (von, Eingabe, Keller-Top) -> (nach, Ersatzwort). ${machine.emptySymbol} kennzeichnet Lambda-Sprünge und das leere Ersatzwort.`;
  if (isTapeMachine()) return `${machine.type}: (von, gelesen) -> (nach, geschrieben, L|R|N). Konfigurationen werden als Tupel in runden Klammern geschrieben.`;
  return `${machine.type}: (von, Symbol) -> (nach). Beim NFA sind ${machine.emptySymbol}-Regeln erlaubt.`;
}

function serializeProgram() {
  const starts = machine.states.filter(state => state.start).map(state => state.name);
  const finals = machine.states.filter(state => state.final).map(state => state.name);
  const directives = [`# AutomataLab ${machine.type}`, `@alphabet ${machine.alphabet.join(",")}`, `@nonterminals ${machine.nonterminals.join(",")}`, `@empty ${machine.emptySymbol}`, `@start ${starts.join(",")}`, `@final ${finals.join(",")}`];
  if (machine.type === "PDA") directives.push(`@stack ${machine.stackAlphabet.join(",")}`, `@initial-stack ${machine.initialStack || machine.blank}`, `@accept ${machine.acceptance}`);
  if (machine.type === "TM") directives.push(`@blank ${machine.blank}`, `@head ${machine.initialHead}`);
  if (machine.type === "LBA") directives.push(`@boundaries ${machine.boundaryLeft},${machine.boundaryRight}`, `@head ${machine.initialHead}`);
  const rules = machine.transitions.map(rule => {
    if (machine.type === "PDA") return `(${stateLabel(rule.from)}, ${displaySymbol(rule.read)}, ${displaySymbol(rule.pop)}) -> (${stateLabel(rule.to)}, ${displaySymbol(rule.push)})`;
    if (isTapeMachine()) return `(${stateLabel(rule.from)}, ${rule.read}) -> (${stateLabel(rule.to)}, ${rule.write}, ${rule.move})`;
    return `(${stateLabel(rule.from)}, ${displaySymbol(rule.read)}) -> (${stateLabel(rule.to)})`;
  });
  return `${directives.join("\n")}\n\n${rules.join("\n")}`;
}

function formatProgramComments(source) {
  return String(source).replace(/(^|\n)([\t ]*)#(?=[\t ]|$)/g, "$1$2▷");
}

function formatProgramSource(source) {
  return formatProgramComments(source).split("\n").map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("▷") || trimmed.startsWith("#") || trimmed.startsWith("@") || !line.includes("->")) return line;
    const [left, right] = line.split(/\s*->\s*/);
    const wrap = side => { const value = side.trim(); return value.startsWith("(") && value.endsWith(")") ? value : `(${value})`; };
    return `${wrap(left)} -> ${wrap(right)}`;
  }).join("\n");
}

function updateProgramEditorUi(showSuggestions = false) {
  const editor = $("#programEditor");
  const lines = editor.value.split("\n");
  $("#programLineNumbers").textContent = lines.map((_, index) => index + 1).join("\n");
  $("#programLineNumbers").scrollTop = editor.scrollTop;
  const beforeCursor = editor.value.slice(0, editor.selectionStart);
  const line = beforeCursor.split("\n").length;
  const column = beforeCursor.length - beforeCursor.lastIndexOf("\n");
  $("#programCursor").textContent = `Zeile ${line}, Spalte ${column}`;
  if (showSuggestions) renderProgramSuggestions(true);
}

function programSuggestions() {
  const states = machine.states.map(state => ({ label: state.name, detail: "Zustand", insert: state.name }));
  const directives = [
    ["@alphabet", "Terminale", "@alphabet "], ["@nonterminals", "Arbeitssymbole", "@nonterminals "],
    ["@empty", "Leerwortsymbol", `@empty ${machine.emptySymbol}`],
    ["@start", "Startzustand", "@start "], ["@final", "Endzustände", "@final "],
    ["@blank", "TM-Leersymbol", "@blank □"], ["@head", "TM-Kopfposition", "@head 0"],
    ["@boundaries", "LBA-Bandgrenzen", "@boundaries ⊢,⊣"],
    ["@stack", "PDA-Kelleralphabet", "@stack "], ["@initial-stack", "PDA-Startkeller", "@initial-stack □"],
    ["@accept", "PDA-Akzeptanz", "@accept final"]
  ].filter(item => machine.type === "PDA" ? !["@blank", "@head", "@boundaries"].includes(item[0]) : machine.type === "TM" ? !["@stack", "@initial-stack", "@accept", "@boundaries"].includes(item[0]) : machine.type === "LBA" ? !["@stack", "@initial-stack", "@accept", "@blank"].includes(item[0]) : !["@blank", "@head", "@boundaries", "@stack", "@initial-stack", "@accept"].includes(item[0]))
    .map(([label, detail, insert]) => ({ label, detail, insert }));
  const template = isTapeMachine() ? "(q0, 0) -> (q1, X, R)" : machine.type === "PDA" ? `(q0, a, □) -> (q1, ${machine.emptySymbol})` : "(q0, a) -> (q1)";
  return [...directives, ...states, { label: "Regelvorlage", detail: machine.type, insert: template }, { label: "Kommentar", detail: "wird zu ▷", insert: "# Kommentar" }];
}

function renderProgramSuggestions(force = false) {
  const editor = $("#programEditor"), popup = $("#programSuggestions");
  const before = editor.value.slice(0, editor.selectionStart);
  const token = before.match(/[^\s,]*$/)?.[0] || "";
  if (!force && !token.startsWith("@")) { popup.classList.add("hidden"); return; }
  const query = token.toLowerCase();
  const items = programSuggestions().filter(item => !query || item.label.toLowerCase().includes(query)).slice(0, 8);
  programSuggestionIndex = Math.min(programSuggestionIndex, Math.max(0, items.length - 1));
  popup.innerHTML = items.map((item, index) => `<button class="suggestion-item ${index === programSuggestionIndex ? "active" : ""}" type="button" data-suggestion="${index}"><span>${esc(item.label)}</span><small>${esc(item.detail)}</small></button>`).join("");
  popup.classList.toggle("hidden", !items.length);
  popup._items = items;
}

function applyProgramSuggestion(index = programSuggestionIndex) {
  const popup = $("#programSuggestions"), item = popup._items?.[index];
  if (!item) return;
  const editor = $("#programEditor"), start = editor.selectionStart, before = editor.value.slice(0, start);
  const tokenLength = before.match(/[^\s,]*$/)?.[0]?.length || 0;
  editor.setRangeText(item.insert, start - tokenLength, editor.selectionEnd, "end");
  editor.value = formatProgramComments(editor.value);
  popup.classList.add("hidden"); editor.focus(); updateProgramEditorUi();
}

function normalizeEditorComments() {
  const editor = $("#programEditor"), start = editor.selectionStart, end = editor.selectionEnd;
  const formattedBefore = formatProgramComments(editor.value.slice(0, start));
  const formattedSelection = formatProgramComments(editor.value.slice(start, end));
  editor.value = formatProgramComments(editor.value);
  editor.setSelectionRange(formattedBefore.length, formattedBefore.length + formattedSelection.length);
}

function insertProgramText(text) {
  const editor = $("#programEditor");
  editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, "end");
  normalizeEditorComments(); editor.focus(); updateProgramEditorUi();
}

function programFingerprint(value = machine) {
  const stateNames = new Map(value.states.map(state => [state.id, state.name]));
  return JSON.stringify({
    type: value.type, alphabet: value.alphabet, nonterminals: value.nonterminals, emptySymbol: value.emptySymbol, stackAlphabet: value.stackAlphabet, blank: value.blank, boundaryLeft: value.boundaryLeft, boundaryRight: value.boundaryRight,
    initialStack: value.initialStack, initialHead: value.initialHead, acceptance: value.acceptance,
    states: value.states.map(state => [state.name, state.start, state.final]).sort(),
    transitions: value.transitions.map(rule => [stateNames.get(rule.from), rule.read, rule.pop, rule.push, rule.write, rule.move, stateNames.get(rule.to)]).sort()
  });
}

function refreshProgramEditor(forceGraph = false) {
  const editor = $("#programEditor");
  const sourceIsCurrent = machine.programSource && machine.programFingerprint === programFingerprint();
  editor.value = formatProgramSource(!forceGraph && sourceIsCurrent ? machine.programSource : serializeProgram());
  editor.dataset.machineType = machine.type;
  $("#programDiagnostics").className = "program-diagnostics";
  $("#programDiagnostics").textContent = sourceIsCurrent && !forceGraph
    ? `${machine.transitions.length} kommentierte Beispielregeln geladen.`
    : `${machine.transitions.length} Regeln aus dem Graph übernommen.`;
  updateProgramEditorUi();
}

function renderProgramMeta() {
  $("#programTitle").textContent = `${machineKindLabel()}-Programm`;
  $("#programHelp").textContent = programHelp();
  if ($("#programEditor").dataset.machineType !== machine.type) refreshProgramEditor();
}

function parseProgram(text, sourceMachine = machine) {
  const draft = clone(sourceMachine);
  draft.transitions = [];
  const errors = [];
  const ruleRows = [];
  const getOrCreateState = name => {
    const clean = String(name || "").trim();
    if (!clean) return null;
    let state = draft.states.find(item => item.name === clean);
    if (!state) {
      const index = draft.states.length;
      state = { id: uid("q"), name: clean, x: 150 + (index % 4) * 180, y: 130 + Math.floor(index / 4) * 145, start: false, final: false };
      draft.states.push(state);
    }
    return state;
  };
  const csv = value => value.split(",").map(part => part.trim()).filter(Boolean);

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("▷")) return;
    if (line.startsWith("@")) {
      const match = line.match(/^@(\S+)\s*(.*)$/);
      const key = match?.[1]?.toLowerCase(), value = match?.[2]?.trim() || "";
      if (key === "alphabet") draft.alphabet = unique(csv(value));
      else if (key === "empty") draft.emptySymbol = value || "λ";
      else if (key === "nonterminals") {
        draft.nonterminals = unique(csv(value));
        if (draft.type === "PDA") draft.stackAlphabet = unique([...draft.nonterminals, draft.blank]);
      }
      else if (key === "stack" && draft.type === "PDA") {
        draft.stackAlphabet = unique(csv(value));
        draft.nonterminals = draft.stackAlphabet.filter(symbol => symbol !== draft.blank && !draft.alphabet.includes(symbol));
      }
      else if (key === "blank" && draft.type === "TM") draft.blank = value || "□";
      else if (key === "boundaries" && draft.type === "LBA") { const bounds = csv(value); draft.boundaryLeft = bounds[0] || "⊢"; draft.boundaryRight = bounds[1] || "⊣"; }
      else if (key === "head" && ["TM", "LBA"].includes(draft.type)) draft.initialHead = Number(value) || 0;
      else if (key === "initial-stack" && draft.type === "PDA") draft.initialStack = value || draft.blank;
      else if (key === "accept" && draft.type === "PDA" && ["final", "empty"].includes(value)) draft.acceptance = value;
      else if (key === "start") {
        const names = csv(value); if (draft.type !== "NFA" && names.length > 1) errors.push(`Zeile ${index + 1}: nur ein Startzustand erlaubt`);
        draft.states.forEach(state => { state.start = false; }); names.forEach(name => { const state = getOrCreateState(name); if (state) state.start = true; });
      } else if (key === "final") {
        draft.states.forEach(state => { state.final = false; }); csv(value).forEach(name => { const state = getOrCreateState(name); if (state) state.final = true; });
      } else errors.push(`Zeile ${index + 1}: unbekannte Direktive @${key || "?"}`);
      return;
    }
    const sides = line.split(/\s*->\s*/);
    if (sides.length !== 2) { errors.push(`Zeile ${index + 1}: „->“ fehlt`); return; }
    const unwrap = side => { const value = side.trim(); return value.startsWith("(") && value.endsWith(")") ? value.slice(1, -1) : value; };
    const left = unwrap(sides[0]).split(",").map(value => value.trim());
    const right = unwrap(sides[1]).split(",").map(value => value.trim());
    if (["DFA", "NFA"].includes(draft.type) && (left.length !== 2 || right.length !== 1)) errors.push(`Zeile ${index + 1}: erwartet „von, symbol -> nach“`);
    else if (draft.type === "PDA" && (left.length !== 3 || right.length !== 2)) errors.push(`Zeile ${index + 1}: erwartet „von, eingabe, top -> nach, ersatz“`);
    else if (["TM", "LBA"].includes(draft.type) && (left.length !== 2 || right.length !== 3 || !["L", "R", "N"].includes(right[2]))) errors.push(`Zeile ${index + 1}: erwartet „(von, gelesen) -> (nach, geschrieben, L|R|N)“`);
    else ruleRows.push({ line: index + 1, left, right });
  });

  for (const row of ruleRows) {
    const from = getOrCreateState(row.left[0]), to = getOrCreateState(row.right[0]);
    if (!from || !to) { errors.push(`Zeile ${row.line}: Zustandsname fehlt`); continue; }
    const rule = { id: uid("t"), from: from.id, to: to.id, read: normalizeSymbol(row.left[1], draft.emptySymbol), pop: EPSILON, push: EPSILON, write: "", move: "R" };
    if (draft.type === "PDA") { rule.pop = normalizeSymbol(row.left[2], draft.emptySymbol); rule.push = normalizeSymbol(row.right[1], draft.emptySymbol); }
    if (["TM", "LBA"].includes(draft.type)) { rule.write = row.right[1] || draft.blank; rule.move = row.right[2]; }
    draft.transitions.push(rule);
  }
  return { draft: normalizeMachine(draft), errors };
}

function applyProgram() {
  const source = formatProgramSource($("#programEditor").value);
  const result = parseProgram(source);
  const diagnostics = $("#programDiagnostics");
  if (result.errors.length) {
    diagnostics.className = "program-diagnostics error";
    diagnostics.textContent = result.errors.join("\n");
    return;
  }
  result.draft.programSource = source;
  result.draft.programFingerprint = programFingerprint(result.draft);
  commit(() => { machine = result.draft; selection = null; }, `${result.draft.transitions.length} programmierte Regeln übernommen`);
  diagnostics.className = "program-diagnostics";
  diagnostics.textContent = `Programm gültig: ${machine.states.length} Zustände, ${machine.transitions.length} Regeln.`;
  setTimeout(fitGraph, 0);
}

// Examples -----------------------------------------------------------------

function exampleMachine(kind) {
  if (kind === "dfa") return normalizeMachine({ type: "DFA", name: "Endet auf 01", alphabet: ["0", "1"], states: [{ id: "q0", name: "q0", x: 170, y: 220, start: true, final: false }, { id: "q1", name: "q1", x: 390, y: 140, start: false, final: false }, { id: "q2", name: "q2", x: 610, y: 220, start: false, final: true }], transitions: [{ id: "a", from: "q0", to: "q1", read: "0" }, { id: "b", from: "q0", to: "q0", read: "1" }, { id: "c", from: "q1", to: "q1", read: "0" }, { id: "d", from: "q1", to: "q2", read: "1" }, { id: "e", from: "q2", to: "q1", read: "0" }, { id: "f", from: "q2", to: "q0", read: "1" }] });
  if (kind === "nfa") return normalizeMachine({ type: "NFA", name: "Enthält 01", alphabet: ["0", "1"], states: [{ id: "q0", name: "q0", x: 170, y: 220, start: true }, { id: "q1", name: "q1", x: 390, y: 140 }, { id: "q2", name: "q2", x: 610, y: 220, final: true }], transitions: [{ id: "a", from: "q0", to: "q0", read: "0" }, { id: "b", from: "q0", to: "q0", read: "1" }, { id: "c", from: "q0", to: "q1", read: "0" }, { id: "d", from: "q1", to: "q2", read: "1" }, { id: "e", from: "q2", to: "q2", read: "0" }, { id: "f", from: "q2", to: "q2", read: "1" }] });
  if (kind === "tm-copy") {
    const source = `# Komplexe Einband-TM: Ein Binärmuster w wird als w#w kopiert.
# Beispiel: Aus 101 entsteht nach dem Halt 101#101.
# X und Y markieren bereits kopierte Zeichen des Originals.
@alphabet 0,1,#
@nonterminals X,Y
@empty λ
@start q_init
@final q_accept
@blank □
@head 0

# 1. Hinter dem Original einen Trenner anlegen
q_init, 0 -> q_init, 0, R
q_init, 1 -> q_init, 1, R
q_init, □ -> q_rewind, #, L
q_rewind, 0 -> q_rewind, 0, L
q_rewind, 1 -> q_rewind, 1, L
q_rewind, □ -> q_find, □, R

# 2. Nächstes noch nicht kopiertes Zeichen markieren
q_find, X -> q_find, X, R
q_find, Y -> q_find, Y, R
q_find, 0 -> q_seek_0, X, R
q_find, 1 -> q_seek_1, Y, R
q_find, # -> q_restore, #, L

# 3a. Für eine markierte 0 bis hinter den Trenner laufen
q_seek_0, X -> q_seek_0, X, R
q_seek_0, Y -> q_seek_0, Y, R
q_seek_0, 0 -> q_seek_0, 0, R
q_seek_0, 1 -> q_seek_0, 1, R
q_seek_0, # -> q_append_0, #, R

# 3b. Für eine markierte 1 bis hinter den Trenner laufen
q_seek_1, X -> q_seek_1, X, R
q_seek_1, Y -> q_seek_1, Y, R
q_seek_1, 0 -> q_seek_1, 0, R
q_seek_1, 1 -> q_seek_1, 1, R
q_seek_1, # -> q_append_1, #, R

# 4. Zeichen am Ende der Kopie anhängen
q_append_0, 0 -> q_append_0, 0, R
q_append_0, 1 -> q_append_0, 1, R
q_append_0, □ -> q_back, 0, L
q_append_1, 0 -> q_append_1, 0, R
q_append_1, 1 -> q_append_1, 1, R
q_append_1, □ -> q_back, 1, L

# 5. Zum linken Rand zurückkehren und nächste Runde starten
q_back, 0 -> q_back, 0, L
q_back, 1 -> q_back, 1, L
q_back, # -> q_back, #, L
q_back, X -> q_back, X, L
q_back, Y -> q_back, Y, L
q_back, □ -> q_find, □, R

# 6. Markierungen entfernen; auf dem Band bleibt w#w
q_restore, X -> q_restore, 0, L
q_restore, Y -> q_restore, 1, L
q_restore, □ -> q_accept, □, R`;
    const names = ["q_init", "q_rewind", "q_find", "q_seek_0", "q_seek_1", "q_append_0", "q_append_1", "q_back", "q_restore", "q_accept"];
    const seed = normalizeMachine({ type: "TM", name: "Binärmuster kopieren w → w#w", states: names.map((name, index) => ({ id: `copy_${index}`, name, x: 130 + (index % 5) * 190, y: 120 + Math.floor(index / 5) * 230 })), transitions: [] });
    const example = parseProgram(source, seed).draft;
    example.name = seed.name; example.exampleWord = "101"; example.programSource = source; example.programFingerprint = programFingerprint(example);
    return example;
  }
  if (kind === "pda-palindrome") {
    const source = `# Nichtdeterministischer PDA für Binärpalindrome.
# Der Automat rät per Lambda-Sprung die Wortmitte und vergleicht danach rückwärts.
@alphabet 0,1
@nonterminals X,Y
@empty λ
@start q_push
@final q_accept
@stack X,Y,□
@initial-stack □
@accept final

# Erste Hälfte auf dem Keller speichern
(q_push, 0, □) -> (q_push, X□)
(q_push, 1, □) -> (q_push, Y□)
(q_push, 0, X) -> (q_push, XX)
(q_push, 1, X) -> (q_push, YX)
(q_push, 0, Y) -> (q_push, XY)
(q_push, 1, Y) -> (q_push, YY)

# Gerade Wortlänge: Wortmitte ohne Eingabeverbrauch raten
(q_push, λ, □) -> (q_match, □)
(q_push, λ, X) -> (q_match, X)
(q_push, λ, Y) -> (q_match, Y)

# Ungerade Wortlänge: genau ein Mittelzeichen überspringen
(q_push, 0, □) -> (q_match, □)
(q_push, 1, □) -> (q_match, □)
(q_push, 0, X) -> (q_match, X)
(q_push, 1, X) -> (q_match, X)
(q_push, 0, Y) -> (q_match, Y)
(q_push, 1, Y) -> (q_match, Y)

# Zweite Hälfte mit dem Keller vergleichen und Elemente entfernen
(q_match, 0, X) -> (q_match, λ)
(q_match, 1, Y) -> (q_match, λ)

# Lambda-Sprung entfernt das Bodenzeichen und akzeptiert
(q_match, λ, □) -> (q_accept, λ)`;
    const seed = normalizeMachine({ type: "PDA", name: "Binärpalindrome mit λ-Sprung", states: [{ id: "pp", name: "q_push", x: 180, y: 220 }, { id: "pm", name: "q_match", x: 470, y: 220 }, { id: "pa", name: "q_accept", x: 760, y: 220 }], transitions: [] });
    const example = parseProgram(source, seed).draft;
    example.name = seed.name; example.exampleWord = "0110"; example.programSource = source; example.programFingerprint = programFingerprint(example);
    return example;
  }
  if (kind === "lba") {
    const source = `# Linear beschränkter Automat für aⁿbⁿcⁿ mit n >= 1.
# Das Eingabeband liegt fest zwischen ⊢ und ⊣; jede Runde markiert ein a, b und c.
@alphabet a,b,c
@nonterminals X,Y,Z
@empty λ
@start q0
@final q_accept
@boundaries ⊢,⊣
@head 0

# Nächstes a markieren
(q0, X) -> (q0, X, R)
(q0, a) -> (q1, X, R)
(q0, Y) -> (q_check, Y, R)

# Zugehöriges b markieren
(q1, a) -> (q1, a, R)
(q1, Y) -> (q1, Y, R)
(q1, b) -> (q2, Y, R)

# Zugehöriges c markieren
(q2, b) -> (q2, b, R)
(q2, Z) -> (q2, Z, R)
(q2, c) -> (q_back, Z, L)

# Innerhalb der Bandgrenzen zum Anfang zurücklaufen
(q_back, a) -> (q_back, a, L)
(q_back, b) -> (q_back, b, L)
(q_back, X) -> (q_back, X, L)
(q_back, Y) -> (q_back, Y, L)
(q_back, Z) -> (q_back, Z, L)
(q_back, ⊢) -> (q0, ⊢, R)

# Am Ende dürfen nur vollständig markierte Blöcke übrig sein
(q_check, Y) -> (q_check, Y, R)
(q_check, Z) -> (q_check, Z, R)
(q_check, ⊣) -> (q_accept, ⊣, N)`;
    const names = ["q0", "q1", "q2", "q_back", "q_check", "q_accept"];
    const seed = normalizeMachine({ type: "LBA", name: "LBA für aⁿbⁿcⁿ", states: names.map((name, index) => ({ id: `lba_${index}`, name, x: 130 + (index % 3) * 270, y: 130 + Math.floor(index / 3) * 250 })), transitions: [] });
    const example = parseProgram(source, seed).draft;
    example.name = seed.name; example.exampleWord = "aabbcc"; example.programSource = source; example.programFingerprint = programFingerprint(example);
    return example;
  }
  const isPda = kind === "pda";
  const source = isPda ? `# Kellerautomat für Spiegelwörter w#wᴿ
# Vor dem Trenner wird das Wort im Keller gespeichert.
# Danach muss jedes Zeichen spiegelbildlich zum Keller passen.
@alphabet a,b,#
@nonterminals A,B
@empty λ
@start q_push
@final q_accept
@stack A,B,□
@initial-stack □
@accept final

# Phase 1: Eingabezeichen auf den Keller legen
q_push, a, □ -> q_push, A□
q_push, b, □ -> q_push, B□
q_push, a, A -> q_push, AA
q_push, b, A -> q_push, BA
q_push, a, B -> q_push, AB
q_push, b, B -> q_push, BB

# Das Trennzeichen wechselt in die Vergleichsphase
q_push, #, □ -> q_pop, □
q_push, #, A -> q_pop, A
q_push, #, B -> q_pop, B

# Phase 2: passende Zeichen vom Keller entfernen
q_pop, a, A -> q_pop, λ
q_pop, b, B -> q_pop, λ
q_pop, λ, □ -> q_accept, □`
    : `# Turingmaschine für die Sprache aⁿbⁿcⁿ mit n >= 1
# Pro Runde werden ein a, ein b und ein c als X, Y, Z markiert.
@alphabet a,b,c
@nonterminals X,Y,Z
@empty λ
@start q0
@final q_accept
@blank □
@head 0

# Nächstes unmarkiertes a suchen und markieren
q0, X -> q0, X, R
q0, a -> q1, X, R
q0, Y -> q4, Y, R
q0, Z -> q4, Z, R

# Zum nächsten unmarkierten b laufen
q1, a -> q1, a, R
q1, Y -> q1, Y, R
q1, b -> q2, Y, R

# Zum nächsten unmarkierten c laufen
q2, b -> q2, b, R
q2, Z -> q2, Z, R
q2, c -> q3, Z, L

# An den linken Bandrand zurückkehren
q3, a -> q3, a, L
q3, b -> q3, b, L
q3, X -> q3, X, L
q3, Y -> q3, Y, L
q3, Z -> q3, Z, L
q3, □ -> q0, □, R

# Nur noch vollständig markierte b- und c-Blöcke erlauben
q4, Y -> q4, Y, R
q4, Z -> q4, Z, R
q4, □ -> q_accept, □, N`;
  const seed = normalizeMachine({
    type: isPda ? "PDA" : "TM", name: isPda ? "Spiegelwort w#wᴿ" : "aⁿbⁿcⁿ erkennen",
    states: isPda
      ? [{ id: "qp", name: "q_push", x: 170, y: 220 }, { id: "qo", name: "q_pop", x: 430, y: 220 }, { id: "qa", name: "q_accept", x: 690, y: 220 }]
      : [{ id: "q0", name: "q0", x: 120, y: 220 }, { id: "q1", name: "q1", x: 320, y: 110 }, { id: "q2", name: "q2", x: 520, y: 110 }, { id: "q3", name: "q3", x: 520, y: 330 }, { id: "q4", name: "q4", x: 720, y: 220 }, { id: "qa", name: "q_accept", x: 900, y: 220 }],
    transitions: []
  });
  const example = parseProgram(source, seed).draft;
  example.name = seed.name;
  example.exampleWord = isPda ? "ab#ba" : "aabbcc";
  example.programSource = source;
  example.programFingerprint = programFingerprint(example);
  return example;
}

// Events -------------------------------------------------------------------

function bindPaneResizers() {
  const root = document.documentElement;
  try {
    const saved = JSON.parse(localStorage.getItem("automata-lab-pane-sizes") || "{}");
    if (saved.toolbox) root.style.setProperty("--toolbox-width", `${saved.toolbox}px`);
    if (saved.inspector) root.style.setProperty("--inspector-width", `${saved.inspector}px`);
  } catch { /* Invalid UI preferences are ignored. */ }
  $$("[data-resize-pane]").forEach(handle => handle.addEventListener("pointerdown", event => {
    if (window.innerWidth <= 920) return;
    event.preventDefault(); handle.setPointerCapture(event.pointerId); handle.classList.add("dragging"); document.body.classList.add("resizing-pane");
    const pane = handle.dataset.resizePane, startX = event.clientX;
    const element = pane === "toolbox" ? $(".toolbox") : $(".inspector"), startWidth = element.getBoundingClientRect().width;
    const move = moveEvent => {
      const delta = (moveEvent.clientX - startX) * (pane === "inspector" ? -1 : 1);
      const otherWidth = (pane === "toolbox" ? $(".inspector") : $(".toolbox")).getBoundingClientRect().width;
      const max = Math.min(pane === "toolbox" ? 380 : 600, window.innerWidth - otherWidth - 470);
      const width = Math.round(Math.max(pane === "toolbox" ? 145 : 260, Math.min(max, startWidth + delta)));
      root.style.setProperty(pane === "toolbox" ? "--toolbox-width" : "--inspector-width", `${width}px`);
    };
    const stop = () => {
      handle.classList.remove("dragging"); document.body.classList.remove("resizing-pane");
      handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", stop); handle.removeEventListener("pointercancel", stop);
      const sizes = { toolbox: Math.round($(".toolbox").getBoundingClientRect().width), inspector: Math.round($(".inspector").getBoundingClientRect().width) };
      localStorage.setItem("automata-lab-pane-sizes", JSON.stringify(sizes));
      renderGraph();
    };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", stop); handle.addEventListener("pointercancel", stop);
  }));
}

function bindGraphEvents() {
  const graph = $("#graph"), viewport = $("#graphViewport");
  graph.addEventListener("dblclick", event => { if (!event.target.closest("[data-state-id],[data-transition-id]")) { const point = svgPoint(event); addState(point.x, point.y); } });
  graph.addEventListener("mousedown", event => {
    const stateElement = event.target.closest("[data-state-id]");
    const edgeElement = event.target.closest("[data-transition-id]");
    if (event.button === 2) {
      const startX = event.clientX, startY = event.clientY, baseX = panX, baseY = panY; viewport.classList.add("panning");
      const move = moveEvent => { panX = baseX + moveEvent.clientX - startX; panY = baseY + moveEvent.clientY - startY; applyView(); };
      const up = () => { viewport.classList.remove("panning"); window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); return;
    }
    if (stateElement) {
      const id = stateElement.dataset.stateId;
      if (tool === "delete") { selection = { kind: "state", id }; deleteSelection(); return; }
      if (tool === "transition") return;
      if (event.shiftKey) {
        transitionSource = id; draftPoint = svgPoint(event); renderGraph(); return;
      }
      selection = { kind: "state", id }; render();
      if (tool === "select") {
        const state = stateById(id), point = svgPoint(event), offsetX = point.x - state.x, offsetY = point.y - state.y, before = snapshot();
        dragState = id; stateElement.classList.add("dragging");
        const move = moveEvent => { const p = svgPoint(moveEvent); state.x = p.x - offsetX; state.y = p.y - offsetY; renderGraph(); };
        const up = () => { dragState = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); if (before !== snapshot()) { history.push(before); future = []; persist(); addLog(`Zustand ${state.name} verschoben`); } render(); };
        window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      }
      return;
    }
    if (edgeElement) {
      selection = { kind: "transition", id: edgeElement.dataset.transitionId };
      if (tool === "delete") deleteSelection(); else render();
      return;
    }
    if (tool === "state" && event.button === 0) { const point = svgPoint(event); addState(point.x, point.y); }
    else { selection = null; render(); }
  });
  graph.addEventListener("mousemove", event => { if (transitionSource) { draftPoint = svgPoint(event); renderGraph(); } });
  graph.addEventListener("mouseup", event => {
    if (!transitionSource || event.button !== 0) return;
    const target = event.target.closest("[data-state-id]"); const source = transitionSource; transitionSource = null; draftPoint = null; renderGraph();
    if (target) openTransitionDialog(source, target.dataset.stateId);
  });
  graph.addEventListener("click", event => {
    if (tool !== "transition") return;
    const state = event.target.closest("[data-state-id]"); if (!state) return;
    if (!transitionSource) { transitionSource = state.dataset.stateId; draftPoint = { x: stateById(transitionSource).x, y: stateById(transitionSource).y }; renderGraph(); }
    else { const source = transitionSource; transitionSource = null; draftPoint = null; openTransitionDialog(source, state.dataset.stateId); }
  });
  viewport.addEventListener("contextmenu", event => event.preventDefault());
  viewport.addEventListener("wheel", event => {
    event.preventDefault(); const rect = graph.getBoundingClientRect(); const mouseX = event.clientX - rect.left, mouseY = event.clientY - rect.top; const worldX = (mouseX - panX) / zoom, worldY = (mouseY - panY) / zoom; const next = Math.max(.25, Math.min(2.5, zoom * (event.deltaY < 0 ? 1.1 : .9))); panX = mouseX - worldX * next; panY = mouseY - worldY * next; zoom = next; applyView();
  }, { passive: false });
}

function fitGraph() {
  if (!machine.states.length) { zoom = 1; panX = 0; panY = 0; applyView(); return; }
  const viewport = $("#graphViewport"), xs = machine.states.map(state => state.x), ys = machine.states.map(state => state.y); const minX = Math.min(...xs) - 100, maxX = Math.max(...xs) + 100, minY = Math.min(...ys) - 100, maxY = Math.max(...ys) + 100; zoom = Math.max(.25, Math.min(1.4, viewport.clientWidth / (maxX - minX), viewport.clientHeight / (maxY - minY))); panX = (viewport.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom; panY = (viewport.clientHeight - (maxY - minY) * zoom) / 2 - minY * zoom; applyView();
}

function downloadJson() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(machine, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = `${machine.name.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "automat"}.automata.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function initEvents() {
  bindPaneResizers();
  bindGraphEvents();
  $$(".tool").forEach(button => button.addEventListener("click", () => setTool(button.dataset.tool)));
  $$(".tab").forEach(button => button.addEventListener("click", () => { $$(".tab").forEach(item => item.classList.toggle("active", item === button)); $$(".tab-pane").forEach(pane => pane.classList.toggle("active", pane.id === `${button.dataset.tab}Pane`)); if (button.dataset.tab === "program") refreshProgramEditor(); }));
  $("#propertyForm").addEventListener("change", event => updateProperty(event.target));
  $("#propertyForm").addEventListener("click", event => { if (event.target.closest("[data-delete]")) deleteSelection(); const select = event.target.closest("[data-select-rule]"); if (select) { selection = { kind: "transition", id: select.dataset.selectRule }; render(); } if (event.target.closest("[data-edit-rule]")) { const rule = transitionById(selection.id); openTransitionDialog(rule.from, rule.to, rule.id); } });
  $("#transitionSubmit").addEventListener("click", event => { event.preventDefault(); submitTransition(); });
  $("#machineType").addEventListener("change", event => { if (!confirm("Beim Wechsel des Maschinentyps werden Zustände und Übergänge gelöscht. Fortfahren?")) { event.target.value = machine.type; return; } commit(() => { machine = newMachine(event.target.value); selection = null; }, `Neuen ${event.target.value} angelegt`); fitGraph(); });
  $("#machineName").addEventListener("change", event => commit(() => { machine.name = event.target.value.trim() || `Mein ${machine.type}`; }));
  $("#undoBtn").addEventListener("click", undo); $("#redoBtn").addEventListener("click", redo);
  $("#saveBtn").addEventListener("click", () => persist(true)); $("#exportBtn").addEventListener("click", downloadJson); $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", async event => { const file = event.target.files[0]; if (!file) return; try { const imported = normalizeMachine(JSON.parse(await file.text())); commit(() => { machine = imported; selection = null; }, "Automat importiert"); fitGraph(); } catch (error) { toast(error.message); } event.target.value = ""; });
  $("#newBtn").addEventListener("click", () => { if (confirm("Aktuellen Automaten verwerfen?")) commit(() => { machine = newMachine(machine.type); selection = null; }, "Neuer Automat"); });
  $$("[data-example]").forEach(button => button.addEventListener("click", () => {
    const example = exampleMachine(button.dataset.example);
    $("#wordInput").value = example.exampleWord || "";
    commit(() => { machine = example; selection = null; }, `Beispiel ${example.name} geladen`);
    refreshProgramEditor();
    setTimeout(fitGraph, 0);
  }));
  $("#simResetBtn").addEventListener("click", () => resetSimulation()); $("#simStepBtn").addEventListener("click", simulationStep); $("#simPlayBtn").addEventListener("click", togglePlay); $("#wordInput").addEventListener("input", () => resetSimulation());
  $("#initialStack").addEventListener("change", event => commit(() => { machine.initialStack = event.target.value || machine.blank; }, "Startkeller geändert"));
  $("#initialHead").addEventListener("change", event => commit(() => { machine.initialHead = Number(event.target.value) || 0; }, "TM-Kopfposition geändert"));
  $("#programRefreshBtn").addEventListener("click", () => refreshProgramEditor(true));
  $("#programApplyBtn").addEventListener("click", applyProgram);
  $("#insertCommentBtn").addEventListener("click", () => insertProgramText("# "));
  $("#showSuggestionsBtn").addEventListener("click", () => { $("#programEditor").focus(); renderProgramSuggestions(true); });
  $("#programSuggestions").addEventListener("mousedown", event => {
    const item = event.target.closest("[data-suggestion]");
    if (item) { event.preventDefault(); applyProgramSuggestion(Number(item.dataset.suggestion)); }
  });
  $("#programEditor").addEventListener("input", () => { normalizeEditorComments(); updateProgramEditorUi(); renderProgramSuggestions(); });
  $("#programEditor").addEventListener("scroll", event => { $("#programLineNumbers").scrollTop = event.target.scrollTop; });
  $("#programEditor").addEventListener("click", () => updateProgramEditorUi());
  $("#programEditor").addEventListener("keyup", event => { if (!["ArrowUp", "ArrowDown"].includes(event.key)) updateProgramEditorUi(); });
  $("#programEditor").addEventListener("keydown", event => {
    const popup = $("#programSuggestions"), visible = !popup.classList.contains("hidden");
    if (event.ctrlKey && event.code === "Space") { event.preventDefault(); renderProgramSuggestions(true); return; }
    if (visible && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const length = popup._items?.length || 1;
      programSuggestionIndex = (programSuggestionIndex + (event.key === "ArrowDown" ? 1 : -1) + length) % length;
      renderProgramSuggestions(true); return;
    }
    if (visible && (event.key === "Enter" || event.key === "Tab")) { event.preventDefault(); applyProgramSuggestion(); return; }
    if (event.key === "Escape") { popup.classList.add("hidden"); return; }
    if (event.key === "Tab") { event.preventDefault(); insertProgramText("  "); }
  });
  $("#determinizeBtn").addEventListener("click", determinize); $("#completeBtn").addEventListener("click", completeDfa); $("#minimizeBtn").addEventListener("click", minimizeDfa); $("#removeUnreachableBtn").addEventListener("click", removeUnreachable);
  $("#fitBtn").addEventListener("click", fitGraph); $("#tableBtn").addEventListener("click", () => showInfo("Übergangstabelle", transitionTableHtml())); $("#formalBtn").addEventListener("click", () => showInfo("Formale Definition", `<div class="formal-tuple">${esc(formalDefinition())}</div>`)); $("#grammarBtn").addEventListener("click", () => showInfo("Rechtslineare Grammatik", `<pre class="formal-tuple">${esc(grammarText())}</pre>`, "KONVERTIERUNG"));
  document.addEventListener("keydown", event => { if (event.key === "Delete" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) deleteSelection(); if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); } });
  window.addEventListener("resize", () => renderGraph());
}

try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) machine = normalizeMachine(JSON.parse(saved)); } catch { localStorage.removeItem(STORAGE_KEY); }
initEvents();
render();
if (!machine.states.length) { machine = exampleMachine("dfa"); persist(); render(); setTimeout(fitGraph, 20); }
