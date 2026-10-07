import mongoose from 'mongoose';
import Event from './event.model.js'

const dayLoadSchema = new mongoose.Schema({
  day_id: String,

  items: [
    {
      item_id: String,
      name: String,
      category: String,
      unit_price_paise: Number,
      initial_shelf_qty: Number,
      refill_cost_per_unit_paise: Number,
      online_pull_cost_per_unit_paise: Number
    }
  ],

  events: [Event.schema],
});

const DayLoad = mongoose.model('DayLoad', dayLoadSchema);

export default DayLoad;