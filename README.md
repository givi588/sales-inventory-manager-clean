# Sales & Inventory Manager

A browser-based application for tracking products, stock levels, and sales using HTML, CSS, and vanilla JavaScript. All application data stays in the browser; no account or backend is required.

**[Live application](https://givi588.github.io/sales-inventory-manager/)** · **[Source code](https://github.com/givi588/sales-inventory-manager)**

## Features

- Add, edit, delete, search, and sort products.
- Record a sale with its price and timestamp; reduce the corresponding stock by one unit.
- Restock products using the button or Enter key.
- Review product counts, available units, low-stock warnings, inventory value, and recorded revenue.
- View recent sales and revenue by product.
- Export inventory and sales reports as CSV files.
- Download an exact JSON backup of products and sales, and restore it after validation and confirmation.
- Retain saved data across page reloads using browser localStorage.
- Use a responsive interface with labeled controls, keyboard support, and clear feedback.

## Getting started

No runtime dependencies or installation are needed for the deployed site.

To run locally, open a terminal in the repository directory:

```bash
python -m http.server 8000
```

Visit [http://localhost:8000/](http://localhost:8000/). On Windows, `py -m http.server 8000` works when the Python launcher is installed.

Use the same browser origin when returning to existing data. Different domains, ports, and browsers have separate localStorage data.

## Data and privacy

Data is stored only in the browser. Clearing site data or losing the device can erase the records. There is no remote backup, device synchronization, authentication, or encryption. Use **Back up JSON** to save a copy outside the browser, especially before importing another file.

JSON is the recommended format for restoring exact product and sales records. CSV files are spreadsheet reports, not full backups.

The current storage format uses `sales-inventory-state-v2` and supports reading existing data from `sales-inventory-products-v1`. Previous saved data is not cleared during the upgrade.

Supported limits: 1,000 products, 10,000 sales, 10,000 units per product, and 1 MB per stored state or backup. Prices are displayed in USD. Revenue is gross sales value, not profit; the application does not calculate purchase costs or taxes.

This is a single-browser inventory utility, not an accounting platform or a system for confidential, regulated, or legally required business records.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | Accessible forms, dashboard, inventory, and sales views |
| `style.css` | Responsive layout and visual styling |
| `data.js` | Validation, business rules, totals, reports, and backup parsing |
| `script.js` | Interface interactions, storage, and rendering |
| `tests/data.test.cjs` | Automated business-logic tests |
| `.github/workflows/tests.yml` | GitHub Actions checks |
| `TESTING.md` | Manual verification checklist and testing limitations |

## Testing

Requires Node.js 22 or newer for local test commands:

```bash
node --check data.js
node --check script.js
node --test tests/data.test.cjs
```

The test suite contains 26 Node.js business-logic checks. GitHub Actions runs the syntax checks and tests on pushes and pull requests. See [the workflow results](https://github.com/givi588/sales-inventory-manager/actions) and [manual verification checklist](TESTING.md) for coverage and limitations.

## Deployment

The application is served as static files from the `main` branch using GitHub Pages. No build step is required.

## Limitations

- All information is local to the current browser and origin.
- Data is not synchronized between tabs or devices; stale-tab changes are detected, but localStorage cannot provide fully atomic cross-tab writes.
- Revenue is tracked; expenses, taxes, and profit are not.
- Automated unit tests do not substitute for complete browser, accessibility, or accounting verification.
