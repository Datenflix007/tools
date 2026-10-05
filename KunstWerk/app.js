const canvas = document.querySelector('#editorCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const fileInput = document.querySelector('#fileInput');
const dropOverlay = document.querySelector('#dropOverlay');
const documentStatus = document.querySelector('#documentStatus');

const imageCanvas = document.createElement('canvas');
const imageCtx = imageCanvas.getContext('2d', { willReadFrequently: true });

const state = {
  hasImage: false,
  fileName: 'Unbenannt',
  tool: 'pan',
  zoom: 1,
  panX: 0,
  panY: 0,
  dpr: 1,
  pointerDown: false,
  pointerStart: null,
  pointerLast: null,
  selection: null,
  selectionDraft: null,
  cropDraft: null,
  magicMarks: [],
  hoverImagePoint: null,
  brushSize: 80,
  blockSize: 12,
  magicSize: 44,
  magicTolerance: 48,
  history: [],
  future: [],
  historyLimit: 30,
  adjustmentBase: null,
  adjustmentDirty: false,
};

const controls = {
  openButton: document.querySelector('#openButton'),
  saveButton: document.querySelector('#saveButton'),
  undoButton: document.querySelector('#undoButton'),
  redoButton: document.querySelector('#redoButton'),
  fitButton: document.querySelector('#fitButton'),
  actualSizeButton: document.querySelector('#actualSizeButton'),
  pixelateSelectionButton: document.querySelector('#pixelateSelectionButton'),
  clearSelectionButton: document.querySelector('#clearSelectionButton'),
  cropSelectionButton: document.querySelector('#cropSelectionButton'),
  dismissSelectionButton: document.querySelector('#dismissSelectionButton'),
  edgeBackgroundButton: document.querySelector('#edgeBackgroundButton'),
  magicCutoutButton: document.querySelector('#magicCutoutButton'),
  clearMagicButton: document.querySelector('#clearMagicButton'),
  brushSize: document.querySelector('#brushSize'),
  blockSize: document.querySelector('#blockSize'),
  magicSize: document.querySelector('#magicSize'),
  magicTolerance: document.querySelector('#magicTolerance'),
  applyAdjustmentsButton: document.querySelector('#applyAdjustmentsButton'),
  resetAdjustmentsButton: document.querySelector('#resetAdjustmentsButton'),
};

function hasMeaningfulAdjustments() {
  return [...document.querySelectorAll('[data-adjustment]')].some((input) => Number(input.value) !== 0);
}

function imageDataSnapshot() {
  return imageCtx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
}

function restoreImageData(snapshot) {
  imageCanvas.width = snapshot.width;
  imageCanvas.height = snapshot.height;
  imageCtx.putImageData(snapshot, 0, 0);
  clearSelection();
  clearMagic(false);
  render();
}

function pushHistory() {
  if (!state.hasImage) return;
  state.history.push(imageDataSnapshot());
  if (state.history.length > state.historyLimit) {
    state.history.shift();
  }
  state.future.length = 0;
  updateUiState();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRect(rect) {
  if (!rect) return null;
  const x0 = rect.x0 ?? rect.left;
  const y0 = rect.y0 ?? rect.top;
  const x1 = rect.x1 ?? rect.right;
  const y1 = rect.y1 ?? rect.bottom;
  const left = clamp(Math.min(x0, x1), 0, imageCanvas.width);
  const top = clamp(Math.min(y0, y1), 0, imageCanvas.height);
  const right = clamp(Math.max(x0, x1), 0, imageCanvas.width);
  const bottom = clamp(Math.max(y0, y1), 0, imageCanvas.height);
  if (right - left < 3 || bottom - top < 3) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function formatStatus() {
  if (!state.hasImage) return 'Kein Bild geladen';
  const zoom = Math.round(state.zoom * 100);
  return `${state.fileName} · ${imageCanvas.width} × ${imageCanvas.height} px · ${zoom} %`;
}

function updateUiState() {
  const enabled = state.hasImage;
  const hasSelection = enabled && Boolean(state.selection);
  const hasMagic = enabled && state.magicMarks.length > 0;
  documentStatus.textContent = formatStatus();
  dropOverlay.classList.toggle('hidden', enabled);

  for (const button of document.querySelectorAll('button[data-filter]')) {
    button.disabled = !enabled;
  }
  for (const button of document.querySelectorAll('.tool-button')) {
    button.classList.toggle('active', button.dataset.tool === state.tool);
  }

  controls.saveButton.disabled = !enabled;
  controls.undoButton.disabled = state.history.length === 0;
  controls.redoButton.disabled = state.future.length === 0;
  controls.fitButton.disabled = !enabled;
  controls.actualSizeButton.disabled = !enabled;
  controls.pixelateSelectionButton.disabled = !hasSelection;
  controls.clearSelectionButton.disabled = !hasSelection;
  controls.cropSelectionButton.disabled = !hasSelection;
  controls.dismissSelectionButton.disabled = !hasSelection;
  controls.edgeBackgroundButton.disabled = !enabled;
  controls.magicCutoutButton.disabled = !hasMagic;
  controls.clearMagicButton.disabled = !hasMagic;
  controls.applyAdjustmentsButton.disabled = !enabled || !hasMeaningfulAdjustments();
  controls.resetAdjustmentsButton.disabled = !enabled || (!state.adjustmentDirty && !hasMeaningfulAdjustments());
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  state.dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * state.dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * state.dpr));
  render();
}

function fitImage() {
  if (!state.hasImage) return;
  const rect = canvas.getBoundingClientRect();
  const pad = 36;
  const scaleX = (rect.width - pad * 2) / imageCanvas.width;
  const scaleY = (rect.height - pad * 2) / imageCanvas.height;
  state.zoom = clamp(Math.min(scaleX, scaleY), 0.04, 20);
  state.panX = (rect.width - imageCanvas.width * state.zoom) / 2;
  state.panY = (rect.height - imageCanvas.height * state.zoom) / 2;
  render();
  updateUiState();
}

function actualSize() {
  if (!state.hasImage) return;
  const rect = canvas.getBoundingClientRect();
  state.zoom = 1;
  state.panX = (rect.width - imageCanvas.width) / 2;
  state.panY = (rect.height - imageCanvas.height) / 2;
  render();
  updateUiState();
}

function screenToImage(point) {
  return {
    x: (point.x - state.panX) / state.zoom,
    y: (point.y - state.panY) / state.zoom,
  };
}

function imageToScreen(point) {
  return {
    x: state.panX + point.x * state.zoom,
    y: state.panY + point.y * state.zoom,
  };
}

function eventPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function drawChecker() {
  const rect = canvas.getBoundingClientRect();
  const size = 16;
  ctx.fillStyle = '#eef1f5';
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = '#d7dbe2';
  for (let y = 0; y < rect.height; y += size) {
    for (let x = 0; x < rect.width; x += size) {
      if ((x / size + y / size) % 2 === 0) {
        ctx.fillRect(x, y, size, size);
      }
    }
  }
}

function drawRectOverlay(rect, color, fill) {
  const normalized = normalizeRect(rect);
  if (!normalized) return;
  const start = imageToScreen({ x: normalized.left, y: normalized.top });
  const width = normalized.width * state.zoom;
  const height = normalized.height * state.zoom;
  ctx.save();
  ctx.setLineDash([8, 5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = fill;
  ctx.fillRect(start.x, start.y, width, height);
  ctx.strokeRect(start.x, start.y, width, height);
  ctx.restore();
}

function render() {
  const rect = canvas.getBoundingClientRect();
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  drawChecker();

  if (!state.hasImage) return;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    imageCanvas,
    state.panX,
    state.panY,
    imageCanvas.width * state.zoom,
    imageCanvas.height * state.zoom,
  );
  ctx.restore();

  drawRectOverlay(state.selection, '#f5c84c', 'rgba(245, 200, 76, 0.18)');
  drawRectOverlay(state.selectionDraft, '#f5c84c', 'rgba(245, 200, 76, 0.18)');
  drawRectOverlay(state.cropDraft, '#67a3ff', 'rgba(103, 163, 255, 0.16)');

  ctx.save();
  for (const mark of state.magicMarks) {
    const center = imageToScreen(mark);
    ctx.beginPath();
    ctx.arc(center.x, center.y, (mark.radius || state.magicSize / 2) * state.zoom, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(84, 255, 184, 0.25)';
    ctx.strokeStyle = 'rgba(84, 255, 184, 0.86)';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  if (state.tool === 'pixelate' && state.hoverImagePoint) {
    const center = imageToScreen(state.hoverImagePoint);
    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, (state.brushSize / 2) * state.zoom, 0, Math.PI * 2);
    ctx.strokeStyle = '#f5c84c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    imageCanvas.width = img.naturalWidth;
    imageCanvas.height = img.naturalHeight;
    imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    imageCtx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    state.hasImage = true;
    state.fileName = file.name || 'Bild';
    state.history.length = 0;
    state.future.length = 0;
    state.adjustmentBase = null;
    state.adjustmentDirty = false;
    resetAdjustmentInputs(false);
    clearSelection();
    clearMagic(false);
    fitImage();
    updateUiState();
  };
  img.src = url;
}

function savePng() {
  if (!state.hasImage) return;
  commitAdjustmentPreview(true);
  const link = document.createElement('a');
  const stem = state.fileName.replace(/\.[^.]+$/, '') || 'bildwerk';
  link.download = `${stem}-bildwerk.png`;
  link.href = imageCanvas.toDataURL('image/png');
  link.click();
}

function undo() {
  if (state.history.length === 0) return;
  if (state.adjustmentBase) {
    commitAdjustmentPreview(false);
  }
  state.future.push(imageDataSnapshot());
  restoreImageData(state.history.pop());
  updateUiState();
}

function redo() {
  if (state.future.length === 0) return;
  state.history.push(imageDataSnapshot());
  restoreImageData(state.future.pop());
  updateUiState();
}

function clearSelection() {
  state.selection = null;
  state.selectionDraft = null;
  state.cropDraft = null;
  render();
  updateUiState();
}

function clearMagic(renderAfter = true) {
  state.magicMarks.length = 0;
  if (renderAfter) render();
  updateUiState();
}

function pixelateRegion(rect, blockSize) {
  const normalized = normalizeRect(rect);
  if (!normalized) return false;
  const width = Math.max(1, Math.round(normalized.width));
  const height = Math.max(1, Math.round(normalized.height));
  const sx = Math.round(normalized.left);
  const sy = Math.round(normalized.top);
  const temp = document.createElement('canvas');
  const small = document.createElement('canvas');
  temp.width = width;
  temp.height = height;
  small.width = Math.max(1, Math.floor(width / blockSize));
  small.height = Math.max(1, Math.floor(height / blockSize));
  const tempCtx = temp.getContext('2d');
  const smallCtx = small.getContext('2d');
  tempCtx.drawImage(imageCanvas, sx, sy, width, height, 0, 0, width, height);
  smallCtx.imageSmoothingEnabled = true;
  smallCtx.drawImage(temp, 0, 0, small.width, small.height);
  tempCtx.imageSmoothingEnabled = false;
  tempCtx.clearRect(0, 0, width, height);
  tempCtx.drawImage(small, 0, 0, width, height);
  imageCtx.clearRect(sx, sy, width, height);
  imageCtx.drawImage(temp, sx, sy);
  return true;
}

function pixelateCircle(center, brushSize, blockSize) {
  const radius = brushSize / 2;
  const rect = {
    x0: center.x - radius,
    y0: center.y - radius,
    x1: center.x + radius,
    y1: center.y + radius,
  };
  const normalized = normalizeRect(rect);
  if (!normalized) return false;

  const before = imageCtx.getImageData(
    Math.round(normalized.left),
    Math.round(normalized.top),
    Math.round(normalized.width),
    Math.round(normalized.height),
  );
  if (!pixelateRegion(rect, blockSize)) return false;

  const after = imageCtx.getImageData(
    Math.round(normalized.left),
    Math.round(normalized.top),
    Math.round(normalized.width),
    Math.round(normalized.height),
  );
  const data = after.data;
  const old = before.data;
  for (let y = 0; y < after.height; y += 1) {
    for (let x = 0; x < after.width; x += 1) {
      const imageX = normalized.left + x;
      const imageY = normalized.top + y;
      const inside = (imageX - center.x) ** 2 + (imageY - center.y) ** 2 <= radius ** 2;
      if (!inside) {
        const i = (y * after.width + x) * 4;
        data[i] = old[i];
        data[i + 1] = old[i + 1];
        data[i + 2] = old[i + 2];
        data[i + 3] = old[i + 3];
      }
    }
  }
  imageCtx.putImageData(after, Math.round(normalized.left), Math.round(normalized.top));
  return true;
}

function pixelateSelection() {
  if (!state.selection) return;
  commitAdjustmentPreview(true);
  pushHistory();
  pixelateRegion(state.selection, state.blockSize);
  clearSelection();
  render();
  updateUiState();
}

function clearSelectedPixels() {
  const rect = normalizeRect(state.selection);
  if (!rect) return;
  commitAdjustmentPreview(true);
  pushHistory();
  imageCtx.clearRect(rect.left, rect.top, rect.width, rect.height);
  clearSelection();
  render();
  updateUiState();
}

function cropSelection() {
  const rect = normalizeRect(state.selection);
  if (!rect) return;
  commitAdjustmentPreview(true);
  pushHistory();
  const temp = document.createElement('canvas');
  temp.width = Math.round(rect.width);
  temp.height = Math.round(rect.height);
  temp.getContext('2d').drawImage(
    imageCanvas,
    Math.round(rect.left),
    Math.round(rect.top),
    Math.round(rect.width),
    Math.round(rect.height),
    0,
    0,
    temp.width,
    temp.height,
  );
  imageCanvas.width = temp.width;
  imageCanvas.height = temp.height;
  imageCtx.clearRect(0, 0, temp.width, temp.height);
  imageCtx.drawImage(temp, 0, 0);
  clearSelection();
  clearMagic(false);
  fitImage();
  updateUiState();
}

function getAdjustmentValues() {
  const values = {};
  for (const input of document.querySelectorAll('[data-adjustment]')) {
    values[input.dataset.adjustment] = Number(input.value);
  }
  return values;
}

function resetAdjustmentInputs(update = true) {
  for (const input of document.querySelectorAll('[data-adjustment]')) {
    input.value = '0';
  }
  if (update) updateUiState();
}

function cloneImageData(source) {
  return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
}

function applyBasicAdjustments(data, values) {
  const brightness = values.brightness * 2.2;
  const contrast = values.contrast;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const saturation = 1 + values.saturation / 100;
  const warmth = values.warmth;
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    let r = pixels[i];
    let g = pixels[i + 1];
    let b = pixels[i + 2];

    r = contrastFactor * (r - 128) + 128 + brightness + warmth * 0.42;
    g = contrastFactor * (g - 128) + 128 + brightness + warmth * 0.08;
    b = contrastFactor * (b - 128) + 128 + brightness - warmth * 0.42;

    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    pixels[i] = clamp(gray + (r - gray) * saturation, 0, 255);
    pixels[i + 1] = clamp(gray + (g - gray) * saturation, 0, 255);
    pixels[i + 2] = clamp(gray + (b - gray) * saturation, 0, 255);
  }
  return data;
}

function runCanvasFilter(data, filter) {
  const temp = document.createElement('canvas');
  temp.width = data.width;
  temp.height = data.height;
  const tempCtx = temp.getContext('2d', { willReadFrequently: true });
  tempCtx.putImageData(data, 0, 0);
  const output = document.createElement('canvas');
  output.width = data.width;
  output.height = data.height;
  const outputCtx = output.getContext('2d', { willReadFrequently: true });
  outputCtx.filter = filter;
  outputCtx.drawImage(temp, 0, 0);
  return outputCtx.getImageData(0, 0, data.width, data.height);
}

function sharpenData(data, amount) {
  if (amount <= 0) return data;
  const src = data.data;
  const out = new Uint8ClampedArray(src);
  const width = data.width;
  const height = data.height;
  const factor = amount / 100;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const center = src[i + c] * (1 + 4 * factor);
        const neighbors =
          src[i - 4 + c] * factor +
          src[i + 4 + c] * factor +
          src[i - width * 4 + c] * factor +
          src[i + width * 4 + c] * factor;
        out[i + c] = clamp(center - neighbors, 0, 255);
      }
    }
  }
  return new ImageData(out, width, height);
}

function previewAdjustments() {
  if (!state.hasImage) return;
  if (!state.adjustmentBase) {
    state.adjustmentBase = imageDataSnapshot();
  }
  const values = getAdjustmentValues();
  let output = applyBasicAdjustments(cloneImageData(state.adjustmentBase), values);
  if (values.blur > 0) {
    output = runCanvasFilter(output, `blur(${values.blur / 3}px)`);
  }
  if (values.sharpness > 0) {
    output = sharpenData(output, values.sharpness);
  }
  imageCtx.putImageData(output, 0, 0);
  state.adjustmentDirty = hasMeaningfulAdjustments();
  render();
  updateUiState();
}

function commitAdjustmentPreview(commit) {
  if (!state.adjustmentBase) return;
  if (commit && state.adjustmentDirty) {
    state.history.push(state.adjustmentBase);
    if (state.history.length > state.historyLimit) {
      state.history.shift();
    }
    state.future.length = 0;
  } else {
    imageCtx.putImageData(state.adjustmentBase, 0, 0);
  }
  state.adjustmentBase = null;
  state.adjustmentDirty = false;
  resetAdjustmentInputs(false);
  render();
  updateUiState();
}

function mutatePixels(mutator) {
  if (!state.hasImage) return;
  commitAdjustmentPreview(true);
  pushHistory();
  const data = imageDataSnapshot();
  mutator(data);
  imageCtx.putImageData(data, 0, 0);
  clearSelection();
  render();
  updateUiState();
}

function grayscale(data) {
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
    pixels[i] = gray;
    pixels[i + 1] = gray;
    pixels[i + 2] = gray;
  }
}

function sepia(data) {
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    pixels[i] = clamp(r * 0.393 + g * 0.769 + b * 0.189, 0, 255);
    pixels[i + 1] = clamp(r * 0.349 + g * 0.686 + b * 0.168, 0, 255);
    pixels[i + 2] = clamp(r * 0.272 + g * 0.534 + b * 0.131, 0, 255);
  }
}

function invert(data) {
  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255 - pixels[i];
    pixels[i + 1] = 255 - pixels[i + 1];
    pixels[i + 2] = 255 - pixels[i + 2];
  }
}

function autocontrast(data) {
  const pixels = data.data;
  let low = 255;
  let high = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const lum = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
    low = Math.min(low, lum);
    high = Math.max(high, lum);
  }
  const range = Math.max(1, high - low);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = clamp(((pixels[i] - low) / range) * 255, 0, 255);
    pixels[i + 1] = clamp(((pixels[i + 1] - low) / range) * 255, 0, 255);
    pixels[i + 2] = clamp(((pixels[i + 2] - low) / range) * 255, 0, 255);
  }
}

function equalize(data) {
  const pixels = data.data;
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < pixels.length; i += 4) {
    const lum = Math.round(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
    histogram[lum] += pixels[i + 3] > 0 ? 1 : 0;
  }
  const cdf = new Array(256).fill(0);
  let running = 0;
  for (let i = 0; i < 256; i += 1) {
    running += histogram[i];
    cdf[i] = running;
  }
  if (running === 0) return;
  for (let i = 0; i < pixels.length; i += 4) {
    const lum = Math.round(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
    const mapped = (cdf[lum] / running) * 255;
    const factor = mapped / Math.max(1, lum);
    pixels[i] = clamp(pixels[i] * factor, 0, 255);
    pixels[i + 1] = clamp(pixels[i + 1] * factor, 0, 255);
    pixels[i + 2] = clamp(pixels[i + 2] * factor, 0, 255);
  }
}

function posterize(data) {
  const pixels = data.data;
  const step = 64;
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = Math.floor(pixels[i] / step) * step + step / 2;
    pixels[i + 1] = Math.floor(pixels[i + 1] / step) * step + step / 2;
    pixels[i + 2] = Math.floor(pixels[i + 2] / step) * step + step / 2;
  }
}

function vignette(data) {
  const pixels = data.data;
  const cx = data.width / 2;
  const cy = data.height / 2;
  const maxDistance = Math.sqrt(cx * cx + cy * cy);
  for (let y = 0; y < data.height; y += 1) {
    for (let x = 0; x < data.width; x += 1) {
      const i = (y * data.width + x) * 4;
      const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDistance;
      const factor = 1 - Math.max(0, distance - 0.35) * 0.72;
      pixels[i] *= factor;
      pixels[i + 1] *= factor;
      pixels[i + 2] *= factor;
    }
  }
}

function edgeEnhance() {
  if (!state.hasImage) return;
  commitAdjustmentPreview(true);
  pushHistory();
  const output = sharpenData(imageDataSnapshot(), 70);
  imageCtx.putImageData(output, 0, 0);
  clearSelection();
  render();
  updateUiState();
}

function applyFilter(name) {
  const filters = { grayscale, sepia, invert, autocontrast, equalize, posterize, vignette };
  if (name === 'edge') {
    edgeEnhance();
    return;
  }
  mutatePixels(filters[name]);
}

function colorDistanceSquared(data, index, color) {
  return (data[index] - color[0]) ** 2 + (data[index + 1] - color[1]) ** 2 + (data[index + 2] - color[2]) ** 2;
}

function nearestPaletteDistanceSquared(data, index, palette) {
  let best = Number.POSITIVE_INFINITY;
  for (const color of palette) {
    const distance = colorDistanceSquared(data, index, color);
    if (distance < best) best = distance;
  }
  return best;
}

function backgroundColorPalette(data) {
  const pixels = data.data;
  const buckets = new Map();
  const step = Math.max(1, Math.floor(Math.max(data.width, data.height) / 420));

  function addSample(x, y) {
    const i = (y * data.width + x) * 4;
    if (pixels[i + 3] < 12) return;
    const key = `${pixels[i] >> 4},${pixels[i + 1] >> 4},${pixels[i + 2] >> 4}`;
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += pixels[i];
    bucket.g += pixels[i + 1];
    bucket.b += pixels[i + 2];
    buckets.set(key, bucket);
  }

  for (let x = 0; x < data.width; x += step) {
    addSample(x, 0);
    addSample(x, data.height - 1);
  }
  for (let y = 0; y < data.height; y += step) {
    addSample(0, y);
    addSample(data.width - 1, y);
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 18)
    .map((bucket) => [bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count]);
}

function isCloseToPalette(pixels, index, palette, threshold) {
  return palette.some(
    (color) =>
      (pixels[index] - color[0]) ** 2 +
        (pixels[index + 1] - color[1]) ** 2 +
        (pixels[index + 2] - color[2]) ** 2 <=
      threshold,
  );
}

function softenCutoutEdges(data, removedMask) {
  const pixels = data.data;
  const nextAlpha = new Uint8ClampedArray(data.width * data.height);
  for (let i = 0; i < nextAlpha.length; i += 1) {
    nextAlpha[i] = pixels[i * 4 + 3];
  }

  for (let y = 1; y < data.height - 1; y += 1) {
    for (let x = 1; x < data.width - 1; x += 1) {
      const offset = y * data.width + x;
      if (removedMask[offset] || pixels[offset * 4 + 3] === 0) continue;

      let removedNeighbors = 0;
      for (let yy = -1; yy <= 1; yy += 1) {
        for (let xx = -1; xx <= 1; xx += 1) {
          if (xx === 0 && yy === 0) continue;
          removedNeighbors += removedMask[(y + yy) * data.width + x + xx];
        }
      }
      if (removedNeighbors > 0) {
        nextAlpha[offset] = Math.min(nextAlpha[offset], 255 - removedNeighbors * 18);
      }
    }
  }

  for (let offset = 0; offset < nextAlpha.length; offset += 1) {
    pixels[offset * 4 + 3] = nextAlpha[offset];
  }
}

function countMask(mask) {
  let count = 0;
  for (const value of mask) {
    count += value;
  }
  return count;
}

function countOpaquePixels(data) {
  let count = 0;
  for (let i = 3; i < data.data.length; i += 4) {
    count += data.data[i] > 0 ? 1 : 0;
  }
  return count;
}

function buildPaletteFromMask(data, mask, maxColors = 160, quantShift = 3) {
  const pixels = data.data;
  const buckets = new Map();

  for (let offset = 0; offset < mask.length; offset += 1) {
    if (!mask[offset]) continue;
    const i = offset * 4;
    if (pixels[i + 3] < 12) continue;
    const key = `${pixels[i] >> quantShift},${pixels[i + 1] >> quantShift},${pixels[i + 2] >> quantShift}`;
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += pixels[i];
    bucket.g += pixels[i + 1];
    bucket.b += pixels[i + 2];
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    .map((bucket) => [bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count]);
}

function floodOutsidePixels(data, blockedMask) {
  const outside = new Uint8Array(data.width * data.height);
  const queue = [];
  const pixels = data.data;

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= data.width || y >= data.height) return;
    const offset = y * data.width + x;
    if (outside[offset] || blockedMask[offset]) return;
    if (pixels[offset * 4 + 3] === 0) return;
    outside[offset] = 1;
    queue.push(offset);
  }

  for (let x = 0; x < data.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, data.height - 1);
  }
  for (let y = 0; y < data.height; y += 1) {
    enqueue(0, y);
    enqueue(data.width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const offset = queue[head];
    head += 1;
    const x = offset % data.width;
    const y = Math.floor(offset / data.width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  return outside;
}

function expandInteriorIntoBarrier(interiorMask, barrierMask, width, height, radius) {
  const keepMask = new Uint8Array(interiorMask);
  const distance = new Uint16Array(width * height);
  const queue = [];

  function seedBarrier(offset) {
    if (!barrierMask[offset] || keepMask[offset]) return;
    keepMask[offset] = 1;
    distance[offset] = 1;
    queue.push(offset);
  }

  for (let offset = 0; offset < interiorMask.length; offset += 1) {
    if (!interiorMask[offset]) continue;
    const x = offset % width;
    const y = Math.floor(offset / width);
    if (x > 0) seedBarrier(offset - 1);
    if (x < width - 1) seedBarrier(offset + 1);
    if (y > 0) seedBarrier(offset - width);
    if (y < height - 1) seedBarrier(offset + width);
  }

  let head = 0;
  while (head < queue.length) {
    const offset = queue[head];
    head += 1;
    if (distance[offset] >= radius) continue;
    const x = offset % width;
    const y = Math.floor(offset / width);
    const nextDistance = distance[offset] + 1;

    for (const neighbor of [
      x > 0 ? offset - 1 : -1,
      x < width - 1 ? offset + 1 : -1,
      y > 0 ? offset - width : -1,
      y < height - 1 ? offset + width : -1,
    ]) {
      if (neighbor < 0 || !barrierMask[neighbor] || keepMask[neighbor]) continue;
      keepMask[neighbor] = 1;
      distance[neighbor] = nextDistance;
      queue.push(neighbor);
    }
  }

  return keepMask;
}

function isNaturalBackgroundCandidate(pixels, index) {
  const r = pixels[index];
  const g = pixels[index + 1];
  const b = pixels[index + 2];
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const chroma = maxChannel - minChannel;
  const greenVegetation = g > r * 1.08 && g > b * 1.02 && chroma > 24;
  const blueSky = b > r * 1.08 && g > r * 1.02 && b - r > 20;
  return greenVegetation || blueSky;
}

function removeNaturalBackgroundSpillFromKeepMask(data, keepMask, outsideMask) {
  const outsidePalette = buildPaletteFromMask(data, outsideMask, 120, 4);
  if (outsidePalette.length === 0) return keepMask;

  const cleanedMask = new Uint8Array(keepMask);
  const pixels = data.data;
  const cleanupThreshold = Math.max(30, state.magicTolerance + 10) ** 2;

  for (let offset = 0; offset < keepMask.length; offset += 1) {
    if (!keepMask[offset]) continue;
    const i = offset * 4;
    if (pixels[i + 3] === 0 || !isNaturalBackgroundCandidate(pixels, i)) continue;
    if (nearestPaletteDistanceSquared(pixels, i, outsidePalette) <= cleanupThreshold) {
      cleanedMask[offset] = 0;
    }
  }

  return cleanedMask;
}

function applyKeepMask(data, keepMask) {
  const pixels = data.data;
  const removedMask = new Uint8Array(keepMask.length);
  let keptCount = 0;
  let removedCount = 0;

  for (let offset = 0; offset < keepMask.length; offset += 1) {
    const alphaIndex = offset * 4 + 3;
    if (pixels[alphaIndex] === 0) continue;
    if (keepMask[offset]) {
      keptCount += 1;
    } else {
      pixels[alphaIndex] = 0;
      removedMask[offset] = 1;
      removedCount += 1;
    }
  }

  if (removedCount > 0) {
    softenCutoutEdges(data, removedMask);
  }
  return { keptCount, removedCount };
}

function removeBackgroundFromEdges() {
  if (!state.hasImage) return;
  commitAdjustmentPreview(true);
  pushHistory();
  const data = imageDataSnapshot();
  const pixels = data.data;
  const palette = backgroundColorPalette(data);
  if (palette.length === 0) {
    state.history.pop();
    updateUiState();
    return;
  }
  const tolerance = Math.max(24, state.magicTolerance + 18) ** 2;
  const visited = new Uint8Array(data.width * data.height);
  const removedMask = new Uint8Array(data.width * data.height);
  const queue = [];

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= data.width || y >= data.height) return;
    const offset = y * data.width + x;
    if (visited[offset]) return;
    const i = offset * 4;
    const close = pixels[i + 3] > 0 && isCloseToPalette(pixels, i, palette, tolerance);
    if (!close) return;
    visited[offset] = 1;
    queue.push(offset);
  }

  for (let x = 0; x < data.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, data.height - 1);
  }
  for (let y = 0; y < data.height; y += 1) {
    enqueue(0, y);
    enqueue(data.width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const offset = queue[head];
    head += 1;
    const x = offset % data.width;
    const y = Math.floor(offset / data.width);
    pixels[offset * 4 + 3] = 0;
    removedMask[offset] = 1;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  const removedCount = removedMask.reduce((sum, value) => sum + value, 0);
  if (removedCount === 0) {
    state.history.pop();
    updateUiState();
    return;
  }

  softenCutoutEdges(data, removedMask);
  imageCtx.putImageData(data, 0, 0);
  clearSelection();
  clearMagic(false);
  render();
  updateUiState();
}

function buildMagicMask(width, height, extraRadius = 0) {
  const mask = new Uint8Array(width * height);
  for (const mark of state.magicMarks) {
    const radius = (mark.radius || state.magicSize / 2) + extraRadius;
    const left = Math.max(0, Math.floor(mark.x - radius));
    const right = Math.min(width - 1, Math.ceil(mark.x + radius));
    const top = Math.max(0, Math.floor(mark.y - radius));
    const bottom = Math.min(height - 1, Math.ceil(mark.y + radius));
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        if ((x - mark.x) ** 2 + (y - mark.y) ** 2 <= radius ** 2) {
          mask[y * width + x] = 1;
        }
      }
    }
  }
  return mask;
}

function buildMagicContourKeepMask(data, strokeMask) {
  const closeRadius = Math.max(2, Math.round(state.magicSize * 0.16));
  const barrierMask = buildMagicMask(data.width, data.height, closeRadius);
  const outsideMask = floodOutsidePixels(data, barrierMask);
  const interiorMask = new Uint8Array(strokeMask.length);
  const pixels = data.data;

  for (let offset = 0; offset < interiorMask.length; offset += 1) {
    interiorMask[offset] = pixels[offset * 4 + 3] > 0 && !outsideMask[offset] && !barrierMask[offset] ? 1 : 0;
  }

  const opaqueCount = countOpaquePixels(data);
  const interiorCount = countMask(interiorMask);
  if (interiorCount < Math.max(24, opaqueCount * 0.012) || interiorCount > opaqueCount * 0.94) {
    return null;
  }

  const growRadius = Math.max(3, Math.round(state.magicSize * 0.56));
  const keepMask = expandInteriorIntoBarrier(interiorMask, barrierMask, data.width, data.height, growRadius);
  return removeNaturalBackgroundSpillFromKeepMask(data, keepMask, outsideMask);
}

function connectedMaskFromSeeds(candidateMask, seedMask, width, height) {
  const result = new Uint8Array(candidateMask.length);
  const queue = [];

  for (let offset = 0; offset < seedMask.length; offset += 1) {
    if (!seedMask[offset] || !candidateMask[offset]) continue;
    result[offset] = 1;
    queue.push(offset);
  }

  let head = 0;
  while (head < queue.length) {
    const offset = queue[head];
    head += 1;
    const x = offset % width;
    const y = Math.floor(offset / width);
    for (const neighbor of [
      x > 0 ? offset - 1 : -1,
      x < width - 1 ? offset + 1 : -1,
      y > 0 ? offset - width : -1,
      y < height - 1 ? offset + width : -1,
    ]) {
      if (neighbor < 0 || result[neighbor] || !candidateMask[neighbor]) continue;
      result[neighbor] = 1;
      queue.push(neighbor);
    }
  }

  return result;
}

function buildMagicColorKeepMask(data, strokeMask) {
  const foregroundPalette = buildPaletteFromMask(data, strokeMask);
  const backgroundPalette = backgroundColorPalette(data);
  if (foregroundPalette.length === 0) return null;

  const candidateMask = new Uint8Array(strokeMask.length);
  const pixels = data.data;
  const hardThreshold = Math.max(18, state.magicTolerance + 12) ** 2;

  for (let offset = 0; offset < candidateMask.length; offset += 1) {
    const i = offset * 4;
    if (pixels[i + 3] === 0) continue;
    const foregroundDistance = nearestPaletteDistanceSquared(pixels, i, foregroundPalette);
    const backgroundDistance = nearestPaletteDistanceSquared(pixels, i, backgroundPalette);
    const keep =
      Boolean(strokeMask[offset]) ||
      foregroundDistance <= hardThreshold ||
      foregroundDistance < backgroundDistance * 0.74;
    candidateMask[offset] = keep ? 1 : 0;
  }

  return connectedMaskFromSeeds(candidateMask, strokeMask, data.width, data.height);
}

function magicCutout() {
  if (!state.hasImage || state.magicMarks.length === 0) return;
  commitAdjustmentPreview(true);
  pushHistory();
  const data = imageDataSnapshot();
  const mask = buildMagicMask(data.width, data.height);

  const keepMask = buildMagicContourKeepMask(data, mask) || buildMagicColorKeepMask(data, mask);
  if (!keepMask) {
    state.history.pop();
    updateUiState();
    return;
  }

  const result = applyKeepMask(data, keepMask);
  if (result.removedCount === 0 || result.keptCount === 0) {
    state.history.pop();
    updateUiState();
    return;
  }

  imageCtx.putImageData(data, 0, 0);
  clearSelection();
  clearMagic(false);
  render();
  updateUiState();
}

function handlePointerDown(event) {
  if (!state.hasImage) return;
  canvas.setPointerCapture(event.pointerId);
  state.pointerDown = true;
  state.pointerStart = eventPoint(event);
  state.pointerLast = state.pointerStart;
  const imagePoint = screenToImage(state.pointerStart);

  if (state.tool === 'pan') return;

  if (state.tool === 'select') {
    state.selection = null;
    state.selectionDraft = { x0: imagePoint.x, y0: imagePoint.y, x1: imagePoint.x, y1: imagePoint.y };
    render();
    updateUiState();
    return;
  }

  if (state.tool === 'crop') {
    state.cropDraft = { x0: imagePoint.x, y0: imagePoint.y, x1: imagePoint.x, y1: imagePoint.y };
    render();
    return;
  }

  if (state.tool === 'pixelate') {
    commitAdjustmentPreview(true);
    pushHistory();
    pixelateCircle(imagePoint, state.brushSize, state.blockSize);
    render();
    return;
  }

  if (state.tool === 'magic') {
    state.magicMarks.push({ x: imagePoint.x, y: imagePoint.y, radius: state.magicSize / 2 });
    render();
    updateUiState();
  }
}

function handlePointerMove(event) {
  if (!state.hasImage) return;
  const point = eventPoint(event);
  const imagePoint = screenToImage(point);
  state.hoverImagePoint =
    imagePoint.x >= 0 && imagePoint.y >= 0 && imagePoint.x <= imageCanvas.width && imagePoint.y <= imageCanvas.height
      ? imagePoint
      : null;

  if (!state.pointerDown) {
    render();
    return;
  }

  if (state.tool === 'pan') {
    const dx = point.x - state.pointerLast.x;
    const dy = point.y - state.pointerLast.y;
    state.panX += dx;
    state.panY += dy;
    state.pointerLast = point;
    render();
    updateUiState();
    return;
  }

  if (state.tool === 'select' && state.selectionDraft) {
    state.selectionDraft.x1 = imagePoint.x;
    state.selectionDraft.y1 = imagePoint.y;
    render();
    return;
  }

  if (state.tool === 'crop' && state.cropDraft) {
    state.cropDraft.x1 = imagePoint.x;
    state.cropDraft.y1 = imagePoint.y;
    render();
    return;
  }

  if (state.tool === 'pixelate') {
    pixelateCircle(imagePoint, state.brushSize, state.blockSize);
    render();
    return;
  }

  if (state.tool === 'magic') {
    const last = state.magicMarks[state.magicMarks.length - 1];
    const distance = last ? Math.hypot(last.x - imagePoint.x, last.y - imagePoint.y) : Infinity;
    if (distance >= state.magicSize * 0.35) {
      state.magicMarks.push({ x: imagePoint.x, y: imagePoint.y, radius: state.magicSize / 2 });
      render();
      updateUiState();
    }
  }
}

function handlePointerUp(event) {
  if (!state.pointerDown) return;
  canvas.releasePointerCapture(event.pointerId);
  state.pointerDown = false;

  if (state.tool === 'select') {
    state.selection = normalizeRect(state.selectionDraft);
    state.selectionDraft = null;
  }

  if (state.tool === 'crop') {
    state.selection = normalizeRect(state.cropDraft);
    state.cropDraft = null;
    cropSelection();
  }

  render();
  updateUiState();
}

function zoomAt(point, factor) {
  if (!state.hasImage) return;
  const before = screenToImage(point);
  state.zoom = clamp(state.zoom * factor, 0.04, 24);
  state.panX = point.x - before.x * state.zoom;
  state.panY = point.y - before.y * state.zoom;
  render();
  updateUiState();
}

function setTool(tool) {
  state.tool = tool;
  state.selectionDraft = null;
  state.cropDraft = null;
  updateUiState();
  render();
}

controls.openButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
controls.saveButton.addEventListener('click', savePng);
controls.undoButton.addEventListener('click', undo);
controls.redoButton.addEventListener('click', redo);
controls.fitButton.addEventListener('click', fitImage);
controls.actualSizeButton.addEventListener('click', actualSize);
controls.pixelateSelectionButton.addEventListener('click', pixelateSelection);
controls.clearSelectionButton.addEventListener('click', clearSelectedPixels);
controls.cropSelectionButton.addEventListener('click', cropSelection);
controls.dismissSelectionButton.addEventListener('click', clearSelection);
controls.edgeBackgroundButton.addEventListener('click', removeBackgroundFromEdges);
controls.magicCutoutButton.addEventListener('click', magicCutout);
controls.clearMagicButton.addEventListener('click', () => clearMagic());
controls.applyAdjustmentsButton.addEventListener('click', () => commitAdjustmentPreview(true));
controls.resetAdjustmentsButton.addEventListener('click', () => commitAdjustmentPreview(false));

controls.brushSize.addEventListener('input', () => {
  state.brushSize = Number(controls.brushSize.value);
  render();
});
controls.blockSize.addEventListener('input', () => {
  state.blockSize = Number(controls.blockSize.value);
});
controls.magicSize.addEventListener('input', () => {
  state.magicSize = Number(controls.magicSize.value);
});
controls.magicTolerance.addEventListener('input', () => {
  state.magicTolerance = Number(controls.magicTolerance.value);
});

for (const button of document.querySelectorAll('.tool-button')) {
  button.addEventListener('click', () => setTool(button.dataset.tool));
}

for (const input of document.querySelectorAll('[data-adjustment]')) {
  input.addEventListener('input', previewAdjustments);
}

for (const button of document.querySelectorAll('button[data-filter]')) {
  button.addEventListener('click', () => applyFilter(button.dataset.filter));
}

canvas.addEventListener('pointerdown', handlePointerDown);
canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerup', handlePointerUp);
canvas.addEventListener('pointercancel', handlePointerUp);
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  zoomAt(eventPoint(event), factor);
});

window.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 's') {
    event.preventDefault();
    savePng();
    return;
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
    return;
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    redo();
    return;
  }
  const shortcuts = { h: 'pan', a: 'select', c: 'crop', p: 'pixelate', m: 'magic' };
  const tool = shortcuts[event.key.toLowerCase()];
  if (tool) setTool(tool);
});

window.addEventListener('resize', resizeCanvas);
document.addEventListener('dragover', (event) => {
  event.preventDefault();
  document.body.classList.add('dragging-file');
});
document.addEventListener('dragleave', (event) => {
  if (event.target === document.body) {
    document.body.classList.remove('dragging-file');
  }
});
document.addEventListener('drop', (event) => {
  event.preventDefault();
  document.body.classList.remove('dragging-file');
  loadFile(event.dataTransfer.files[0]);
});

resizeCanvas();
updateUiState();
