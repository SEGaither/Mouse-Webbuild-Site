const STORAGE_KEY = "dwf-site-builder-layout-v1";

const canvas = document.getElementById("siteCanvas");
const defaultLayoutTemplate = document.getElementById("defaultLayoutTemplate");

const noSelectionState = document.getElementById("noSelectionState");
const selectionPanel = document.getElementById("selectionPanel");

const propType = document.getElementById("propType");
const propText = document.getElementById("propText");
const propHref = document.getElementById("propHref");
const propSrc = document.getElementById("propSrc");
const propX = document.getElementById("propX");
const propY = document.getElementById("propY");
const propW = document.getElementById("propW");
const propH = document.getElementById("propH");
const propBg = document.getElementById("propBg");
const propColor = document.getElementById("propColor");
const propFontSize = document.getElementById("propFontSize");
const propRadius = document.getElementById("propRadius");
const propAlign = document.getElementById("propAlign");

const saveLayoutBtn = document.getElementById("saveLayoutBtn");
const resetLayoutBtn = document.getElementById("resetLayoutBtn");
const exportHtmlBtn = document.getElementById("exportHtmlBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const previewToggleBtn = document.getElementById("previewToggleBtn");

const deleteBtn = document.getElementById("deleteBtn");
const duplicateBtn = document.getElementById("duplicateBtn");
const bringForwardBtn = document.getElementById("bringForwardBtn");
const sendBackwardBtn = document.getElementById("sendBackwardBtn");

let layout = [];
let selectedId = null;
let previewMode = false;

let dragState = null;
let resizeState = null;

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uid(prefix = "el") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadDefaultLayout() {
  return safeParse(defaultLayoutTemplate.textContent.trim(), []);
}

function loadLayout() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return loadDefaultLayout();
  return safeParse(saved, loadDefaultLayout());
}

function saveLayout() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

function flattenElements(elements, parentId = null, acc = []) {
  for (const el of elements) {
    acc.push({ el, parentId });
    if (Array.isArray(el.children) && el.children.length) {
      flattenElements(el.children, el.id, acc);
    }
  }
  return acc;
}

function findElementAndParent(id, elements = layout, parent = null) {
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.id === id) {
      return { element: el, parentArray: elements, index: i, parent };
    }
    if (Array.isArray(el.children)) {
      const found = findElementAndParent(id, el.children, el);
      if (found) return found;
    }
  }
  return null;
}

function removeElement(id) {
  const found = findElementAndParent(id);
  if (!found) return;
  found.parentArray.splice(found.index, 1);
}

function duplicateElement(id) {
  const found = findElementAndParent(id);
  if (!found) return;
  const copy = deepClone(found.element);
  reassignIds(copy);
  copy.x += 30;
  copy.y += 30;
  found.parentArray.splice(found.index + 1, 0, copy);
  selectedId = copy.id;
}

function reassignIds(el) {
  el.id = uid("el");
  if (Array.isArray(el.children)) {
    el.children.forEach(reassignIds);
  }
}

function moveElementOrder(id, direction) {
  const found = findElementAndParent(id);
  if (!found) return;
  const { parentArray, index } = found;
  if (direction === "forward" && index < parentArray.length - 1) {
    [parentArray[index], parentArray[index + 1]] = [parentArray[index + 1], parentArray[index]];
  }
  if (direction === "backward" && index > 0) {
    [parentArray[index], parentArray[index - 1]] = [parentArray[index - 1], parentArray[index]];
  }
}

function selectElement(id) {
  selectedId = id;
  render();
  syncSelectionPanel();
}

function clearSelection() {
  selectedId = null;
  render();
  syncSelectionPanel();
}

function syncSelectionPanel() {
  const found = selectedId ? findElementAndParent(selectedId) : null;

  if (!found) {
    noSelectionState.classList.remove("hidden");
    selectionPanel.classList.add("hidden");
    return;
  }

  noSelectionState.classList.add("hidden");
  selectionPanel.classList.remove("hidden");

  const el = found.element;
  propType.value = el.type || "";
  propText.value = el.text || "";
  propHref.value = el.href || "";
  propSrc.value = el.src || "";
  propX.value = el.x ?? 0;
  propY.value = el.y ?? 0;
  propW.value = el.w ?? 0;
  propH.value = el.h ?? 0;
  propBg.value = el.style?.background ?? "";
  propColor.value = el.style?.color ?? "";
  propFontSize.value = el.style?.fontSize ?? "";
  propRadius.value = el.style?.radius ?? "";
  propAlign.value = el.style?.textAlign ?? "left";
}

function applyPanelChanges() {
  const found = selectedId ? findElementAndParent(selectedId) : null;
  if (!found) return;

  const el = found.element;
  el.text = propText.value;
  el.href = propHref.value;
  el.src = propSrc.value;
  el.x = Number(propX.value || 0);
  el.y = Number(propY.value || 0);
  el.w = Number(propW.value || 0);
  el.h = Number(propH.value || 0);

  el.style = el.style || {};
  el.style.background = propBg.value;
  el.style.color = propColor.value;
  el.style.fontSize = Number(propFontSize.value || 16);
  el.style.radius = Number(propRadius.value || 0);
  el.style.textAlign = propAlign.value;

  render();
}

function baseStyle(el) {
  const s = el.style || {};
  return `
    left:${el.x}px;
    top:${el.y}px;
    width:${el.w}px;
    height:${el.h}px;
    background:${s.background || "transparent"};
    color:${s.color || "#ffffff"};
    font-size:${Number(s.fontSize || 16)}px;
    border-radius:${Number(s.radius || 0)}px;
    text-align:${s.textAlign || "left"};
  `;
}

function createElementNode(el, parentOffsetX = 0, parentOffsetY = 0) {
  const node = document.createElement("div");
  node.className = `builder-el${selectedId === el.id ? " selected" : ""}${previewMode ? " preview" : ""}`;
  node.dataset.id = el.id;
  node.dataset.type = el.type;
  node.style.cssText = baseStyle(el);

  const content = document.createElement(el.type === "button" ? "a" : "div");
  content.className = "builder-el-content";
  content.style.width = "100%";
  content.style.height = "100%";

  if (el.type === "button") {
    content.href = el.href || "#";
  }

  if (el.type === "heading" || el.type === "text") {
    content.classList.add("inline-editable");
    content.contentEditable = previewMode ? "false" : "true";
    content.innerText = el.text || "";
    content.addEventListener("input", () => {
      const found = findElementAndParent(el.id);
      if (!found) return;
      found.element.text = content.innerText;
      if (selectedId === el.id) syncSelectionPanel();
    });
  } else if (el.type === "button") {
    content.classList.add("inline-editable");
    content.contentEditable = previewMode ? "false" : "true";
    content.innerText = el.text || "Button";
    content.addEventListener("input", () => {
      const found = findElementAndParent(el.id);
      if (!found) return;
      found.element.text = content.innerText;
      if (selectedId === el.id) syncSelectionPanel();
    });
  } else if (el.type === "image") {
    const img = document.createElement("img");
    img.src = el.src || "";
    img.alt = el.text || "";
    content.appendChild(img);
  } else if (el.type === "card") {
    const img = document.createElement("img");
    img.className = "card-preview-image";
    img.src = el.src || "";
    img.alt = el.text || "";

    const body = document.createElement("div");
    body.className = "card-preview-body";

    const title = document.createElement("div");
    title.className = "card-preview-title inline-editable";
    title.contentEditable = previewMode ? "false" : "true";
    title.innerText = el.text || "Card Title";

    const copy = document.createElement("div");
    copy.className = "card-preview-copy inline-editable";
    copy.contentEditable = previewMode ? "false" : "true";
    copy.innerText = el.copy || "Card description.";

    title.addEventListener("input", () => {
      const found = findElementAndParent(el.id);
      if (!found) return;
      found.element.text = title.innerText;
      if (selectedId === el.id) syncSelectionPanel();
    });

    copy.addEventListener("input", () => {
      const found = findElementAndParent(el.id);
      if (!found) return;
      found.element.copy = copy.innerText;
    });

    body.appendChild(title);
    body.appendChild(copy);
    content.appendChild(img);
    content.appendChild(body);
  } else if (el.type === "section") {
    if (Array.isArray(el.children)) {
      for (const child of el.children) {
        const childNode = createElementNode(child, el.x, el.y);
        content.appendChild(childNode);
      }
    }
  }

  node.appendChild(content);

  if (!previewMode) {
    const handle = document.createElement("div");
    handle.className = "resize-handle";
    node.appendChild(handle);

    node.addEventListener("mousedown", (event) => {
      if (event.target === handle) return;
      if (event.target.closest(".inline-editable") && document.activeElement === event.target) return;
      if (event.target.closest(".builder-el")?.dataset.id !== el.id) return;
      startDrag(event, el.id);
    });

    handle.addEventListener("mousedown", (event) => {
      startResize(event, el.id);
    });

    node.addEventListener("click", (event) => {
      event.stopPropagation();
      selectElement(el.id);
    });
  }

  return node;
}

function render() {
  canvas.innerHTML = "";
  canvas.classList.toggle("preview-mode", previewMode);
  document.body.classList.toggle("preview-mode", previewMode);

  for (const el of layout) {
    canvas.appendChild(createElementNode(el));
  }
}

function canvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left + canvas.scrollLeft,
    y: clientY - rect.top + canvas.scrollTop
  };
}

function startDrag(event, id) {
  event.preventDefault();
  event.stopPropagation();

  const found = findElementAndParent(id);
  if (!found) return;

  selectElement(id);

  const point = canvasPoint(event.clientX, event.clientY);
  dragState = {
    id,
    startX: point.x,
    startY: point.y,
    originalX: found.element.x,
    originalY: found.element.y
  };
}

function startResize(event, id) {
  event.preventDefault();
  event.stopPropagation();

  const found = findElementAndParent(id);
  if (!found) return;

  selectElement(id);

  const point = canvasPoint(event.clientX, event.clientY);
  resizeState = {
    id,
    startX: point.x,
    startY: point.y,
    originalW: found.element.w,
    originalH: found.element.h
  };
}

function onPointerMove(event) {
  if (dragState) {
    const found = findElementAndParent(dragState.id);
    if (!found) return;

    const point = canvasPoint(event.clientX, event.clientY);
    found.element.x = Math.max(0, Math.round(dragState.originalX + (point.x - dragState.startX)));
    found.element.y = Math.max(0, Math.round(dragState.originalY + (point.y - dragState.startY)));
    render();
    syncSelectionPanel();
  }

  if (resizeState) {
    const found = findElementAndParent(resizeState.id);
    if (!found) return;

    const point = canvasPoint(event.clientX, event.clientY);
    found.element.w = Math.max(60, Math.round(resizeState.originalW + (point.x - resizeState.startX)));
    found.element.h = Math.max(40, Math.round(resizeState.originalH + (point.y - resizeState.startY)));
    render();
    syncSelectionPanel();
  }
}

function onPointerUp() {
  if (dragState || resizeState) {
    saveLayout();
  }
  dragState = null;
  resizeState = null;
}

function addElement(type) {
  const next = {
    id: uid("el"),
    type,
    x: 60,
    y: 860,
    w: 260,
    h: 80,
    text: "",
    href: "",
    src: "",
    style: {
      background: "rgba(255,255,255,0.04)",
      color: "#ffffff",
      fontSize: 18,
      radius: 14,
      textAlign: "left"
    }
  };

  if (type === "heading") {
    next.text = "New Heading";
    next.w = 360;
    next.h = 80;
    next.style.fontSize = 40;
    next.style.background = "transparent";
  }

  if (type === "text") {
    next.text = "New text block";
    next.w = 360;
    next.h = 100;
    next.style.background = "transparent";
    next.style.color = "#d6dde3";
    next.style.fontSize = 18;
  }

  if (type === "button") {
    next.text = "New Button";
    next.href = "#";
    next.w = 180;
    next.h = 52;
    next.style.background = "linear-gradient(180deg, #e0c28b 0%, #c9a76a 100%)";
    next.style.color = "#0a1219";
    next.style.radius = 999;
    next.style.textAlign = "center";
  }

  if (type === "image") {
    next.text = "Image";
    next.src = "./images/logo.jpg";
    next.w = 260;
    next.h = 220;
    next.style.background = "rgba(255,255,255,0.03)";
  }

  if (type === "card") {
    next.text = "New Card";
    next.copy = "Card description";
    next.src = "./images/big-brown.jpg";
    next.w = 280;
    next.h = 340;
    next.style.background = "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))";
  }

  if (type === "section") {
    next.text = "";
    next.w = 600;
    next.h = 220;
    next.style.background = "rgba(255,255,255,0.03)";
    next.children = [];
  }

  layout.push(next);
  selectedId = next.id;
  render();
  syncSelectionPanel();
  saveLayout();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" });
  triggerDownload(blob, "layout.json");
}

function renderStaticElement(el) {
  const s = el.style || {};
  const commonStyle = [
    "position:absolute",
    `left:${el.x}px`,
    `top:${el.y}px`,
    `width:${el.w}px`,
    `height:${el.h}px`,
    `background:${s.background || "transparent"}`,
    `color:${s.color || "#ffffff"}`,
    `font-size:${Number(s.fontSize || 16)}px`,
    `border-radius:${Number(s.radius || 0)}px`,
    `text-align:${s.textAlign || "left"}`,
    "overflow:hidden"
  ].join(";");

  if (el.type === "heading") {
    return `<div style="${commonStyle};font-weight:800;line-height:1.02;padding:6px 8px;">${escapeHtml(el.text || "")}</div>`;
  }

  if (el.type === "text") {
    return `<div style="${commonStyle};line-height:1.45;padding:6px 8px;">${escapeHtml(el.text || "")}</div>`;
  }

  if (el.type === "button") {
    return `<a href="${escapeAttr(el.href || "#")}" style="${commonStyle};display:flex;align-items:center;justify-content:center;text-decoration:none;font-weight:800;padding:0 14px;">${escapeHtml(el.text || "Button")}</a>`;
  }

  if (el.type === "image") {
    return `<div style="${commonStyle};padding:10px;"><img src="${escapeAttr(el.src || "")}" alt="${escapeAttr(el.text || "")}" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;background:rgba(255,255,255,0.03);display:block;" /></div>`;
  }

  if (el.type === "card") {
    return `
      <div style="${commonStyle};display:grid;grid-template-rows:1fr auto;border:1px solid rgba(255,255,255,0.07);">
        <img src="${escapeAttr(el.src || "")}" alt="${escapeAttr(el.text || "")}" style="width:100%;height:100%;object-fit:cover;display:block;" />
        <div style="padding:14px;">
          <div style="font-size:18px;font-weight:800;margin-bottom:8px;color:#dfbe84;">${escapeHtml(el.text || "")}</div>
          <div style="font-size:14px;color:#d4dde3;">${escapeHtml(el.copy || "")}</div>
        </div>
      </div>
    `;
  }

  if (el.type === "section") {
    const children = (el.children || []).map(renderStaticElement).join("");
    return `<div style="${commonStyle};">${children}</div>`;
  }

  return "";
}

function exportHtml() {
  const bodyHtml = layout.map(renderStaticElement).join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Exported Deep Water Fossils Page</title>
</head>
<body style="margin:0;background:#07131c;color:#f4f7fa;font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;">
<div style="position:relative;width:1200px;min-height:1800px;margin:0 auto;background:linear-gradient(180deg,#04111a 0%,#071823 100%);">
${bodyHtml}
</div>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html" });
  triggerDownload(blob, "exported-page.html");
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function bindPropertyInputs() {
  [
    propText,
    propHref,
    propSrc,
    propX,
    propY,
    propW,
    propH,
    propBg,
    propColor,
    propFontSize,
    propRadius,
    propAlign
  ].forEach(input => {
    input.addEventListener("input", applyPanelChanges);
    input.addEventListener("change", () => saveLayout());
  });
}

function bindButtons() {
  document.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => addElement(btn.dataset.add));
  });

  saveLayoutBtn.addEventListener("click", () => {
    saveLayout();
    alert("Layout saved to browser storage.");
  });

  resetLayoutBtn.addEventListener("click", () => {
    const confirmed = confirm("Reset the entire layout to default?");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    layout = loadDefaultLayout();
    selectedId = null;
    render();
    syncSelectionPanel();
  });

  exportHtmlBtn.addEventListener("click", exportHtml);
  exportJsonBtn.addEventListener("click", exportJson);

  previewToggleBtn.addEventListener("click", () => {
    previewMode = !previewMode;
    previewToggleBtn.textContent = previewMode ? "Exit Preview" : "Preview Mode";
    render();
    syncSelectionPanel();
  });

  deleteBtn.addEventListener("click", () => {
    if (!selectedId) return;
    removeElement(selectedId);
    selectedId = null;
    render();
    syncSelectionPanel();
    saveLayout();
  });

  duplicateBtn.addEventListener("click", () => {
    if (!selectedId) return;
    duplicateElement(selectedId);
    render();
    syncSelectionPanel();
    saveLayout();
  });

  bringForwardBtn.addEventListener("click", () => {
    if (!selectedId) return;
    moveElementOrder(selectedId, "forward");
    render();
    saveLayout();
  });

  sendBackwardBtn.addEventListener("click", () => {
    if (!selectedId) return;
    moveElementOrder(selectedId, "backward");
    render();
    saveLayout();
  });

  canvas.addEventListener("click", (event) => {
    if (event.target === canvas) {
      clearSelection();
    }
  });
}

function init() {
  layout = loadLayout();
  bindPropertyInputs();
  bindButtons();
  render();
  syncSelectionPanel();

  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);
}

init();
