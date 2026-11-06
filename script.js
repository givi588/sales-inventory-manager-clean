"use strict";

// Preserve the existing v2 storage format for saved products and sales.
const Core = globalThis.InventoryCore;
const STORAGE_KEY = "sales-inventory-state-v2";
const LEGACY_KEY = "sales-inventory-products-v1";

const $ = id => document.getElementById(id);
const form = $("product-form");
const nameInput = $("product-name");
const priceInput = $("product-price");
const quantityInput = $("product-quantity");
const searchInput = $("product-search");
const sortInput = $("product-sort");
const saveButton = $("save-product");
const cancelButton = $("cancel-edit");

let products = [];
let sales = [];
let editingIndex = null;
let canSave = true;
let lastSavedRaw = null;
let legacyRawAtLoad = null;

function status(id, text, type = "") {
  const el = $(id);
  el.textContent = text;
  el.className = "status" + (type ? " " + type : "");
}

function message(text, type = "") { status("form-message", text, type); }

function disableEditing(reason) {
  canSave = false;
  saveButton.disabled = true;
  $("import-json").disabled = true;
  $("storage-message").textContent = reason;
  $("download-raw").classList.remove("hidden");
  renderProducts();
}

function loadState() {
  try {
    lastSavedRaw = localStorage.getItem(STORAGE_KEY);
    legacyRawAtLoad = localStorage.getItem(LEGACY_KEY);

    if (lastSavedRaw !== null) {
      const state = Core.parseBackup(lastSavedRaw);
      products = state.products;
      sales = state.sales;
      return;
    }
    if (legacyRawAtLoad !== null) {
      const old = JSON.parse(legacyRawAtLoad);
      if (!Core.validProducts(old)) throw new Error("Invalid previous inventory.");
      // Read only; the old key is never modified.
      products = old.map(p => ({ name: p.name, price: p.price, quantity: p.quantity }));
    }
  } catch (_) {
    // Invalid storage is left untouched. No silent reset or overwrite.
    disableEditing("Saved data could not be read. No changes are allowed. Download raw data and keep this browser storage for recovery.");
  }
}

// Compare before writing to avoid overwriting a change seen in another tab.
function persist(nextProducts, nextSales = sales) {
  if (!canSave) return false;
  let raw;
  try { raw = Core.encodeState(nextProducts, nextSales); }
  catch (error) { message(error.message, "error"); return false; }
  try {
    if (localStorage.getItem(STORAGE_KEY) !== lastSavedRaw ||
        (lastSavedRaw === null && localStorage.getItem(LEGACY_KEY) !== legacyRawAtLoad)) {
      disableEditing("Another tab changed your saved data. Reload this page before editing.");
      return false;
    }
    localStorage.setItem(STORAGE_KEY, raw);
    lastSavedRaw = raw;
    products = nextProducts;
    sales = nextSales;
    return true;
  } catch (_) {
    message("Saving failed. Your current saved products and sales were not changed.", "error");
    return false;
  }
}

function resetEditor() {
  editingIndex = null;
  form.reset();
  $("editor-heading").textContent = "Add a product";
  saveButton.textContent = "Add product";
  cancelButton.classList.add("hidden");
  [nameInput, priceInput, quantityInput].forEach(el => el.removeAttribute("aria-invalid"));
}

function readProduct() {
  [nameInput, priceInput, quantityInput].forEach(el => el.removeAttribute("aria-invalid"));
  const name = nameInput.value.trim();
  const rawPrice = priceInput.value.trim();
  const rawQuantity = quantityInput.value.trim();
  const price = Number(rawPrice);
  const quantity = Number(rawQuantity);
  if (!name || name.length > 50) return { error: "Name must contain 1–50 characters.", field: nameInput };
  if (products.some((p, i) => i !== editingIndex &&
      p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return { error: "This product name already exists.", field: nameInput };
  }
  if (rawPrice === "" || !Number.isFinite(price) || price < 0 || price > 100000 ||
      Math.abs(price * 100 - Math.round(price * 100)) >= .000001) {
    return { error: "Price must be $0–$100,000 with at most two decimals.", field: priceInput };
  }
  if (!/^\d+$/.test(rawQuantity) || !Number.isSafeInteger(quantity) || quantity > 10000) {
    return { error: "Quantity must be a whole number between 0 and 10,000.", field: quantityInput };
  }
  if (editingIndex === null && products.length >= Core.MAX_PRODUCTS) {
    return { error: "Maximum of 1,000 products reached.", field: nameInput };
  }
  return { value: { name, price: Math.round(price * 100) / 100, quantity } };
}

function submitProduct(event) {
  event.preventDefault();
  if (!canSave) return;
  const result = readProduct();
  if (result.error) {
    result.field.setAttribute("aria-invalid", "true");
    result.field.focus();
    message(result.error, "error");
    return;
  }
  const changed = products.slice();
  const editing = editingIndex !== null;
  if (editing) changed[editingIndex] = result.value;
  else changed.push(result.value);
  if (!persist(changed)) return;
  resetEditor();
  renderAll();
  message(editing ? "Product updated." : "Product added.", "success");
  nameInput.focus();
}

function startEdit(index) {
  if (!canSave || !products[index]) return;
  const product = products[index];
  editingIndex = index;
  nameInput.value = product.name;
  priceInput.value = String(product.price);
  quantityInput.value = String(product.quantity);
  $("editor-heading").textContent = "Edit product";
  saveButton.textContent = "Save changes";
  cancelButton.classList.remove("hidden");
  message("");
  nameInput.focus();
}

function removeProduct(index) {
  const product = products[index];
  if (!canSave || !product) return;
  if (!confirm(`Delete "${product.name}" from inventory? Previous recorded sales will remain.`)) return;
  const changed = products.filter((_, i) => i !== index);
  if (!persist(changed)) return;
  resetEditor();
  renderAll();
  message("Product removed. Sales history was kept.", "success");
}

function sellOne(index) {
  const product = products[index];
  if (!canSave || !product) return;
  if (product.quantity === 0) { message("No stock available.", "error"); return; }
  if (sales.length >= Core.MAX_SALES) { message("Sales history limit reached. Back up your data.", "error"); return; }
  const changed = products.map((p, i) => i === index ? { ...p, quantity: p.quantity - 1 } : p);
  const sale = { name: product.name, price: product.price, quantity: 1, soldAt: new Date().toISOString() };
  if (!persist(changed, [...sales, sale])) return;
  resetEditor();
  renderAll();
  message(`Sold 1 unit of ${product.name}; sale recorded.`, "success");
}

function restock(index, input) {
  const product = products[index];
  if (!canSave || !product) return;
  const raw = input.value.trim();
  const quantity = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(quantity) || quantity < 1 ||
      quantity + product.quantity > 10000) {
    message("Restock quantity must be a positive whole number; maximum stock is 10,000.", "error");
    input.focus();
    return;
  }
  const changed = products.map((p, i) => i === index ? { ...p, quantity: p.quantity + quantity } : p);
  if (!persist(changed)) return;
  resetEditor();
  renderAll();
  message(`Added ${quantity} unit(s) to ${product.name}.`, "success");
}

function createButton(text, variant, onClick, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  if (variant) button.className = variant;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function renderProducts() {
  const list = $("product-list");
  list.replaceChildren();
  const visible = Core.visibleProducts(products, searchInput.value, sortInput.value);
  $("product-count").textContent = `${visible.length} shown / ${products.length} total`;
  $("empty-state").classList.toggle("hidden", visible.length !== 0);
  $("empty-state").textContent = products.length ? "No matching products." : "No products yet.";

  for (const { product, index } of visible) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = product.name;
    const info = document.createElement("p");
    info.className = "product-meta";
    const dollars = (Core.moneyCents(product.price) * product.quantity / 100).toFixed(2);
    info.textContent = `$${product.price.toFixed(2)} × ${product.quantity} units · Stock value $${dollars}`;
    item.append(title, info);
    if (product.quantity <= 5) {
      const warning = document.createElement("span");
      warning.className = "stock-warning";
      warning.textContent = product.quantity === 0 ? "Out of stock" : "Low stock";
      item.appendChild(warning);
    }
    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.append(
      createButton("Sell 1", "", () => sellOne(index), !canSave || product.quantity === 0),
      createButton("Edit", "secondary", () => startEdit(index), !canSave),
      createButton("Delete", "danger", () => removeProduct(index), !canSave)
    );
    const restockGroup = document.createElement("div");
    restockGroup.className = "restock-control";
    const amount = document.createElement("input");
    amount.type = "number";
    amount.min = "1";
    amount.max = String(10000 - product.quantity);
    amount.step = "1";
    amount.value = "1";
    amount.setAttribute("aria-label", `Units to restock for ${product.name}`);
    amount.disabled = !canSave || product.quantity >= 10000;
    const restockButton = createButton(
      "Restock", "secondary", () => restock(index, amount),
      !canSave || product.quantity >= 10000
    );
    amount.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.isComposing || event.repeat) return;
      event.preventDefault();
      if (!restockButton.disabled) restockButton.click();
    });
    restockGroup.append(amount, restockButton);
    actions.appendChild(restockGroup);
    item.appendChild(actions);
    list.appendChild(item);
  }
  const sums = Core.totals(products, sales);
  $("total-value").textContent = `Total inventory value: $${(sums.stockCents / 100).toFixed(2)}`;
}

function renderSales() {
  const list = $("sales-list");
  list.replaceChildren();
  for (const sale of sales.slice(-30).reverse()) {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = sale.name;
    const detail = document.createElement("p");
    detail.className = "sale-meta";
    detail.textContent = `1 unit · $${sale.price.toFixed(2)} · ${new Date(sale.soldAt).toLocaleString()}`;
    item.append(name, detail);
    list.appendChild(item);
  }
  $("sales-count").textContent = `${sales.length} recorded` + (sales.length > 30 ? " (latest 30 shown)" : "");
  $("sales-empty").classList.toggle("hidden", sales.length > 0);
  const totals = Core.totals(products, sales);
  $("sales-total").textContent = `Total revenue: $${(totals.revenueCents / 100).toFixed(2)}`;

  const chart = $("sales-chart");
  chart.replaceChildren();
  const grouped = Core.saleBreakdown(sales);
  const max = Math.max(1, ...grouped.map(item => item.cents));
  for (const item of grouped) {
    const row = document.createElement("div");
    const label = document.createElement("div");
    label.className = "bar-label";
    const name = document.createElement("span");
    name.textContent = `${item.name} (${item.count})`;
    const value = document.createElement("span");
    value.textContent = `$${(item.cents / 100).toFixed(2)}`;
    label.append(name, value);
    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = (item.cents / max * 100) + "%";
    track.appendChild(fill);
    row.append(label, track);
    chart.appendChild(row);
  }
}

function renderSummary() {
  const t = Core.totals(products, sales);
  $("stat-products").textContent = String(products.length);
  $("stat-units").textContent = t.units.toLocaleString();
  $("stat-stock").textContent = "$" + (t.stockCents / 100).toFixed(2);
  $("stat-low").textContent = String(t.lowStock);
  $("stat-sales").textContent = String(t.salesCount);
  $("stat-revenue").textContent = "$" + (t.revenueCents / 100).toFixed(2);
}

function renderAll() { renderSummary(); renderProducts(); renderSales(); }

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportData(kind) {
  if (!canSave) { status("backup-message", "Saved data needs recovery before exporting normal reports.", "error"); return; }
  try {
    if (kind === "inventory") download("inventory.csv", Core.inventoryCsv(products), "text/csv;charset=utf-8");
    if (kind === "sales") download("sales.csv", Core.salesCsv(sales), "text/csv;charset=utf-8");
    if (kind === "json") download("sales-inventory-backup.json", Core.encodeState(products, sales), "application/json;charset=utf-8");
    status("backup-message", kind === "json" ? "JSON backup downloaded." : "CSV report downloaded.", "success");
  } catch (_) { status("backup-message", "Download could not be created.", "error"); }
}

function exportRaw() {
  try {
    const raw = JSON.stringify({
      note: "Diagnostic raw storage only. Not a normal import file.",
      state: localStorage.getItem(STORAGE_KEY),
      previousInventory: localStorage.getItem(LEGACY_KEY)
    }, null, 2);
    download("inventory-raw-recovery.json", raw, "application/json;charset=utf-8");
    status("backup-message", "Raw recovery copy downloaded; do not clear browser site data.", "success");
  } catch (_) { status("backup-message", "Unable to download raw data.", "error"); }
}

async function restoreJson(event) {
  const fileInput = event.target;
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = "";
  if (!file || !canSave) return;
  if (file.size > Core.MAX_BYTES) {
    status("backup-message", "File is too large (maximum 1 MB).", "error");
    return;
  }
  $("import-json").disabled = true;
  status("backup-message", "Reading backup...");
  try {
    const imported = Core.parseBackup(await file.text());
    if (!confirm(`Replace all current products and sales with ${imported.products.length} products and ${imported.sales.length} recorded sales? Export a backup of current data first.`)) {
      status("backup-message", "Restore cancelled. Your data was not changed.");
      return;
    }
    if (!persist(imported.products, imported.sales)) {
      status("backup-message", "Backup could not be saved. Your existing stored data was not replaced.", "error");
      return;
    }
    resetEditor();
    searchInput.value = "";
    sortInput.value = "default";
    renderAll();
    message("");
    status("backup-message", "Backup restored successfully.", "success");
  } catch (error) {
    status("backup-message", error.message || "Invalid backup file.", "error");
  } finally {
    $("import-json").disabled = !canSave;
  }
}

loadState();
form.addEventListener("submit", submitProduct);
cancelButton.addEventListener("click", () => { resetEditor(); message(""); });
searchInput.addEventListener("input", renderProducts);
sortInput.addEventListener("change", renderProducts);
$("export-inventory").addEventListener("click", () => exportData("inventory"));
$("export-sales").addEventListener("click", () => exportData("sales"));
$("export-json").addEventListener("click", () => exportData("json"));
$("download-raw").addEventListener("click", exportRaw);
$("import-json").addEventListener("click", () => $("backup-file").click());
$("backup-file").addEventListener("change", restoreJson);
window.addEventListener("storage", event => {
  if (event.key === STORAGE_KEY || event.key === LEGACY_KEY || event.key === null) {
    disableEditing("Saved data changed in another tab. Reload before making changes.");
  }
});
renderAll();
