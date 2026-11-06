# Testing and verification

Automated checks validate business rules and JavaScript syntax. The following manual scenarios are useful for verifying behavior in a real browser. Unchecked items are not claims that the scenario has been performed.

## Data persistence

- [ ] Add a product, reload the page, and verify it remains.
- [ ] Confirm that existing saved products and historical sales survive an application update.
- [ ] Confirm data is not shared between different browser origins.
- [ ] Confirm an invalid or oversized backup is rejected without replacing stored data.

## Core functionality

- [ ] Add a product with a name, price, and whole-number quantity.
- [ ] Reject a missing name, duplicate name, negative price, and fractional quantity.
- [ ] Edit a product and verify the totals update.
- [ ] Sell one unit and verify stock decreases and a sales record appears.
- [ ] Restock an item using the button and using Enter in the quantity input.
- [ ] Confirm sales revenue does not change when stock is replenished.
- [ ] Confirm Sell 1 cannot reduce a zero-stock product below zero.
- [ ] Search and sort products; verify the global totals remain unchanged.
- [ ] Delete a product and verify existing sales history remains available.

## Exports and recovery

- [ ] Export inventory and sales CSV files and inspect them in a spreadsheet application.
- [ ] Download a JSON backup; restore it after a temporary change.
- [ ] Cancel an import and verify data stays unchanged.
- [ ] Verify special characters in product names survive JSON backup and restoration.

## Usability

- [ ] Check desktop and mobile layouts.
- [ ] Navigate forms and actions with Tab, Enter, and keyboard focus indicators.
- [ ] Check form validation feedback and error messages.
- [ ] Check 200% browser zoom.

## Automated verification

```bash
node --check data.js
node --check script.js
node --test tests/data.test.cjs
```

The repository's [GitHub Actions workflow](https://github.com/givi588/sales-inventory-manager/actions) runs these checks automatically. The suite contains 26 business-logic tests.

Manual tests, physical-device coverage, accessibility checks with assistive technology, and third-party spreadsheet behavior require separate verification.
