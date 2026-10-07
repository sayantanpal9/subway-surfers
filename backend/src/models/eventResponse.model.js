import mongoose from 'mongoose';

const eventResponseSchema = new mongoose.Schema({
  seq: Number,

  type: {
    type: String,
    enum: ['walk_in', 'online']
  },

  status: String,

  lines: [
    {
      item_id: String,
      from_shelf: Number
    }
  ]
});

const EventResponse = mongoose.model('EventResponse', eventResponseSchema);

export default EventResponse;