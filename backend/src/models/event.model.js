import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
    seq: {
        type: Number,
        min: 1,
        required: true
    },
    ts: {
        type: Number,
        min: 0,
        max: 43200,
        required: true
    },
    type: {
        type: String,
        enum: ["walk_in", "online"],
        required: true
    },
    order_id: {
        type: String,
        required: true
    },
    lines: [
        {
            item_id: {
                type: String,
                required: true
            },
            qty: {
                type: Number,
                min: 1,
                required: true
            }
        }
    ]
});

const Event = mongoose.model("Event", eventSchema);

export default Event;