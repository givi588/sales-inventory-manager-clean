"use strict";

// All business rules are kept here so they can be tested without a browser.
(function (root) {
  const VERSION = 2; // Preserve compatibility with existing saved state.
  const MAX_PRODUCTS = 1000;
  const MAX_SALES = 10000;
  const MAX_BYTES = 1000000;

  function moneyCents(price) {
    return Math.round(price * 100);
  }

  function validProduct(p) {
    return !!p && typeof p === "object" && !Array.isArray(p) &&
      typeof p.name === "string" && p.name.trim().length > 0 &&
      p.name.trim().length <= 50 && typeof p.price === "number" &&
      Number.isFinite(p.price) && p.price >= 0 && p.price <= 100000 &&
      Math.abs(p.price * 100 - moneyCents(p.price)) < 0.000001 &&
      Number.isSafeInteger(p.quantity) && p.quantity >= 0 && p.quantity <= 10000;
  }

  function validProducts(products) {
    if (!Array.isArray(products) || products.length > MAX_PRODUCTS ||
        !products.every(validProduct)) return false;
    const names = products.map(p => p.name.trim().toLocaleLowerCase());
    return new Set(names).size === names.length;
  }

  function validSale(s) {
    return !!s && typeof s === "object" && !Array.isArray(s) &&
      typeof s.name === "string" && s.name.trim().length > 0 &&
      s.name.trim().length <= 50 && typeof s.price === "number" &&
      Number.isFinite(s.price) && s.price >= 0 && s.price <= 100000 &&
      Math.abs(s.price * 100 - moneyCents(s.price)) < 0.000001 &&
      s.quantity === 1 && typeof s.soldAt === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(s.soldAt) &&
      !Number.isNaN(Date.parse(s.soldAt));
  }

  function validState(state) {
    return !!state && typeof state === "object" && !Array.isArray(state) &&
      state.version === VERSION && validProducts(state.products) &&
      Array.isArray(state.sales) && state.sales.length <= MAX_SALES &&
      state.sales.every(validSale);
  }

  function encodeState(products, sales) {
    const state = { version: VERSION, products, sales };
    if (!validState(state)) throw new Error("Invalid inventory or sales data.");
    const raw = JSON.stringify(state);
    if (raw.length > MAX_BYTES) throw new Error("Data exceeds the 1 MB limit.");
    return raw;
  }

  function parseBackup(raw) {
    if (typeof raw !== "string" || raw.length > MAX_BYTES) {
      throw new Error("Backup must be a JSON file smaller than 1 MB.");
    }
    let data;
    try { data = JSON.parse(raw.replace(/^\uFEFF/, "")); }
    catch (_) { throw new Error("This file does not contain valid JSON."); }
    if (!validState(data)) {
      throw new Error("Backup format or product/sales data is invalid.");
    }
    // Keep only the fields this version understands.
    return {
      products: data.products.map(p => ({ name: p.name, price: p.price, quantity: p.quantity })),
      sales: data.sales.map(s => ({ name: s.name, price: s.price, quantity: 1, soldAt: s.soldAt }))
    };
  }

  function totals(products, sales) {
    const units = products.reduce((sum, p) => sum + p.quantity, 0);
    const stockCents = products.reduce((sum, p) => sum + moneyCents(p.price) * p.quantity, 0);
    const revenueCents = sales.reduce((sum, s) => sum + moneyCents(s.price) * s.quantity, 0);
    const lowStock = products.filter(p => p.quantity <= 5).length;
    return { units, stockCents, revenueCents, lowStock, salesCount: sales.length };
  }

  function visibleProducts(products, search, order) {
    const term = String(search).trim().toLocaleLowerCase();
    const visible = products.map((product, index) => ({ product, index }))
      .filter(({ product }) => product.name.toLocaleLowerCase().includes(term));
    if (order === "name") visible.sort((a, b) => a.product.name.localeCompare(b.product.name));
    if (order === "price-high") visible.sort((a, b) => b.product.price - a.product.price);
    if (order === "quantity-low") visible.sort((a, b) => a.product.quantity - b.product.quantity);
    return visible;
  }

  function saleBreakdown(sales) {
    const grouped = new Map();
    for (const s of sales) {
      const key = s.name.toLocaleLowerCase();
      const entry = grouped.get(key) || { name: s.name, count: 0, cents: 0 };
      entry.count += s.quantity;
      entry.cents += moneyCents(s.price) * s.quantity;
      grouped.set(key, entry);
    }
    return [...grouped.values()].sort((a, b) => b.cents - a.cents).slice(0, 8);
  }

  // CSV is for spreadsheet reporting. Exact round-trip backups use JSON.
  function csvCell(value) {
    const original = String(value);
    const safe = /^[\s]*[=+\-@]/.test(original) ? "'" + original : original;
    return '"' + safe.replace(/"/g, '""') + '"';
  }

  function toCsv(rows) {
    return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }

  function inventoryCsv(products) {
    return toCsv([
      ["Product", "Price", "Quantity", "Stock value"],
      ...products.map(p => [p.name, p.price.toFixed(2), p.quantity,
        ((moneyCents(p.price) * p.quantity) / 100).toFixed(2)])
    ]);
  }

  function salesCsv(sales) {
    return toCsv([
      ["Product", "Unit price", "Quantity", "Revenue", "Sold at (UTC)"],
      ...sales.map(s => [s.name, s.price.toFixed(2), s.quantity,
        ((moneyCents(s.price) * s.quantity) / 100).toFixed(2), s.soldAt])
    ]);
  }

  const api = { VERSION, MAX_PRODUCTS, MAX_SALES, MAX_BYTES, moneyCents,
    validProduct, validProducts, validSale, validState, encodeState, parseBackup,
    totals, visibleProducts, saleBreakdown, inventoryCsv, salesCsv };
  root.InventoryCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
