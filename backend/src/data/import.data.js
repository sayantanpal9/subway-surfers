import fs from 'fs'
import {parse} from 'csv-parse/sync'

const csvData = fs.readFileSync("./items.csv", "utf8");

const rows = parse(csvData, {
  columns: true,
  skip_empty_lines: true,
});

const items = {};

for (const row of rows) {
  items[row.item_id] = {
    item_id: row.item_id,
    name: row.name,
    category: row.category,
    unit_price_paise: Number(row.unit_price_paise),
    initial_shelf_qty: Number(row.initial_shelf_qty),
    refill_cost_per_unit_paise: Number(row.refill_cost_per_unit_paise),
    online_pull_cost_per_unit_paise: Number(row.online_pull_cost_per_unit_paise),
  };
}

fs.writeFileSync(
  "./items.json",
  JSON.stringify(items, null, 2)
);

console.log("items.json created successfully!");
export default items;