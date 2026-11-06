"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../data.js");
const products = [
  { name: "Keyboard", price: 30, quantity: 25 },
  { name: "Mouse", price: 25, quantity: 3 }
];
const sales = [
  { name: "Keyboard", price: 30, quantity: 1, soldAt: "2026-11-06T12:00:00.000Z" },
  { name: "Mouse", price: 25, quantity: 1, soldAt: "2026-11-06T12:05:00.000Z" }
];

test("valid inventory accepts 2 products", () => assert.equal(D.validProducts(products), true));
test("empty inventory is valid", () => assert.equal(D.validProducts([]), true));
test("reject empty product name", () => assert.equal(D.validProducts([{name:" ",price:1,quantity:1}]), false));
test("reject duplicate names case-insensitively", () => assert.equal(D.validProducts([...products,{name:"keyboard",price:1,quantity:1}]), false));
test("reject negative stock", () => assert.equal(D.validProducts([{name:"X",price:1,quantity:-1}]), false));
test("reject fractional stock", () => assert.equal(D.validProducts([{name:"X",price:1,quantity:1.5}]), false));
test("reject prices with more than two decimals", () => assert.equal(D.validProducts([{name:"X",price:1.234,quantity:1}]), false));
test("allow zero stock", () => assert.equal(D.validProducts([{name:"X",price:0,quantity:0}]), true));
test("reject sale with zero quantity", () => assert.equal(D.validSale({...sales[0],quantity:0}), false));
test("reject sale with invalid date", () => assert.equal(D.validSale({...sales[0],soldAt:"yesterday"}), false));
test("totals calculate inventory value and revenue", () => {
  assert.deepEqual(D.totals(products,sales),{units:28,stockCents:82500,revenueCents:5500,lowStock:1,salesCount:2});
});
test("sales breakdown aggregates revenue by product", () => {
  const results = D.saleBreakdown([...sales,sales[0]]);
  assert.equal(results[0].name,"Keyboard");
  assert.equal(results[0].count,2);
  assert.equal(results[0].cents,6000);
});
test("search matches case-insensitively", () => assert.equal(D.visibleProducts(products,"KEY", "default")[0].index,0));
test("sort by low quantity changes display order without changing original", () => {
  const results=D.visibleProducts(products,"","quantity-low");
  assert.equal(results[0].product.name,"Mouse");
  assert.equal(products[0].name,"Keyboard");
});
test("price descending sort places expensive first", () => assert.equal(D.visibleProducts(products,"","price-high")[0].product.name,"Keyboard"));
test("JSON backup round trips exact fields", () => {
  const out=D.parseBackup(D.encodeState(products,sales));
  assert.deepEqual(out,{products,sales});
});
test("JSON backup preserves Unicode and literal apostrophe", () => {
  const p=[{name:"Café",price:1.5,quantity:2}];
  const s=[{name:"'Keyboard",price:1,quantity:1,soldAt:sales[0].soldAt}];
  assert.deepEqual(D.parseBackup(D.encodeState(p,s)),{products:p,sales:s});
});
test("reject invalid JSON backup", () => assert.throws(()=>D.parseBackup("{wrong"),/valid JSON/));
test("reject future backup version", () => assert.throws(()=>D.parseBackup(JSON.stringify({version:3,products:[],sales:[]})),/invalid/));
test("reject oversized backup", () => assert.throws(()=>D.parseBackup("a".repeat(1000001)),/smaller/));
test("reject sale with negative price", () => assert.throws(()=>D.encodeState([], [{...sales[0],price:-30}]),/Invalid/));
test("CSV escapes embedded double quotes and commas", () => {
  const csv=D.inventoryCsv([{name:'Books, "rare"',price:3,quantity:2}]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"Books, ""rare"""'));
});
test("CSV neutralizes spreadsheet formulas", () => {
  const csv=D.inventoryCsv([{name:"=1+1",price:2,quantity:1}]);
  assert.ok(csv.includes('"\'=1+1"'));
});
test("sales CSV includes original historical prices and timestamps", () => {
  const csv=D.salesCsv(sales);
  assert.ok(csv.includes('"30.00"'));
  assert.ok(csv.includes('"2026-11-06T12:00:00.000Z"'));
});
test("max 1000 products enforced", () => {
  const big=Array.from({length:1001},(_,i)=>({name:"x"+i,price:1,quantity:1}));
  assert.equal(D.validProducts(big),false);
});
test("max 10000 sales enforced", () => {
  const big=Array.from({length:10001},()=>sales[0]);
  assert.throws(()=>D.encodeState([],big),/Invalid/);
});
