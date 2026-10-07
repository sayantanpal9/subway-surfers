import mongoose from 'mongoose';

const daySummarySchema = new mongoose.Schema({
  day_id: String,

  status: {
    type: String,
    enum: ['idle', 'ready', 'running', 'finished']
  },

  events_processed: Number,
  events_total: Number,

  totals: {
    refill_cost: Number,
    online_pull_cost: Number,
    lost_revenue: Number,
    total_cost: Number,
    refill_count: Number,
    units_lost: Number,
    units_pulled_from_inventory: Number,
    walk_in_revenue_captured: Number,
    online_revenue: Number,
    gross_revenue: Number
  },

  baseline: {
    shelf_first_cost: Number,
    inventory_only_cost: Number,
    total_cost: Number
  },

  savings_vs_baseline: Number,

  items: [
    {
      item_id: String,
      shelf_qty: Number,
      refill_count: Number,
      units_lost: Number,
      lost_revenue: Number,
      units_pulled: Number,
      pull_cost: Number,
      refill_cost: Number
    }
  ]
});

const DaySummary = mongoose.model('DaySummary', daySummarySchema);

export default DaySummary;