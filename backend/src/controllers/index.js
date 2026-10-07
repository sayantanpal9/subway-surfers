import DayLoad from "../models/dayload.model.js";
import EventResponse from "../models/eventResponse.model.js";

let currentDay = null;
let lastProcessed = 0;
let totalEvents = 0;

let items = new Map();
let shelf = new Map();

let optimalDecisions = new Map();

let eventBuffer = [];

let baseline = {
    shelf_first_cost: 0,
    inventory_only_cost: 0,
    total_cost: 0
};

let optimalCost = 0;

let itemStats = new Map();

let totals = {
    refill_cost: 0,
    online_pull_cost: 0,
    lost_revenue: 0,
    refill_count: 0,
    units_lost: 0,
    units_pulled_from_inventory: 0,
    walk_in_revenue_captured: 0,
    online_revenue: 0
};

function createEmptyTotals() {
    return {
        refill_cost: 0,
        online_pull_cost: 0,
        lost_revenue: 0,
        refill_count: 0,
        units_lost: 0,
        units_pulled_from_inventory: 0,
        walk_in_revenue_captured: 0,
        online_revenue: 0
    };
}

function resetState() {
    currentDay = null;
    lastProcessed = 0;
    totalEvents = 0;

    items = new Map();
    shelf = new Map();

    optimalDecisions = new Map();

    eventBuffer = [];

    baseline = {
        shelf_first_cost: 0,
        inventory_only_cost: 0,
        total_cost: 0
    };

    optimalCost = 0;

    itemStats = new Map();

    totals = createEmptyTotals();
}

function initializeItemStats(item) {
    itemStats.set(item.item_id, {
        shelf_qty: item.initial_shelf_qty,
        refill_count: 0,
        units_lost: 0,
        lost_revenue: 0,
        units_pulled: 0,
        pull_cost: 0,
        refill_cost: 0
    });
}

function addRefill(itemId) {
    const item = items.get(itemId);

    const cost =
        item.initial_shelf_qty *
        item.refill_cost_per_unit_paise;

    totals.refill_count++;
    totals.refill_cost += cost;

    const stats = itemStats.get(itemId);

    stats.refill_count++;
    stats.refill_cost += cost;

    shelf.set(
        itemId,
        item.initial_shelf_qty
    );
}

async function saveEvent(response) {
    eventBuffer.push({
        day_id: currentDay,
        ...response
    });

    if (eventBuffer.length >= 1000) {
        const batch = eventBuffer;
        eventBuffer = [];

        await EventResponse.insertMany(batch);
    }
}

async function flushEventBuffer() {
    if (eventBuffer.length === 0) {
        return;
    }

    const batch = eventBuffer;
    eventBuffer = [];

    await EventResponse.insertMany(batch);
}

function optimizeItem(item, events) {
    const Q = item.initial_shelf_qty;
    const n = events.length;

    let next = new Float64Array(Q + 1);
    let current = new Float64Array(Q + 1);

    const choices = new Array(n);

    for (let i = n - 1; i >= 0; i--) {
        const event = events[i];

        if (event.type === "online") {
            choices[i] = new Int32Array(Q + 1);
        }

        for (let s = 1; s <= Q; s++) {
            if (event.type === "walk_in") {
                if (event.qty <= s) {
                    let nextShelf =
                        s - event.qty;

                    let cost = 0;

                    if (nextShelf === 0) {
                        cost +=
                            Q *
                            item.refill_cost_per_unit_paise;

                        nextShelf = Q;
                    }

                    current[s] =
                        cost +
                        next[nextShelf];

                } else {
                    current[s] =
                        event.qty *
                        item.unit_price_paise +
                        next[s];
                }

            } else {
                let bestCost =
                    Number.MAX_SAFE_INTEGER;

                let bestShelf = 0;

                const maxFromShelf =
                    Math.min(
                        event.qty,
                        s
                    );

                for (
                    let fromShelf = 0;
                    fromShelf <= maxFromShelf;
                    fromShelf++
                ) {
                    let nextShelf =
                        s - fromShelf;

                    let cost =
                        (event.qty - fromShelf) *
                        item.online_pull_cost_per_unit_paise;

                    if (nextShelf === 0) {
                        cost +=
                            Q *
                            item.refill_cost_per_unit_paise;

                        nextShelf = Q;
                    }

                    const total =
                        cost +
                        next[nextShelf];

                    if (total < bestCost) {
                        bestCost = total;
                        bestShelf = fromShelf;
                    }
                }

                current[s] = bestCost;
                choices[i][s] = bestShelf;
            }
        }

        const temp = next;
        next = current;
        current = temp;
    }

    let shelfQty = Q;

    for (let i = 0; i < n; i++) {
        const event = events[i];

        if (event.type === "online") {
            const fromShelf =
                choices[i][shelfQty];

            optimalDecisions.set(
                `${event.seq}:${item.item_id}`,
                fromShelf
            );

            shelfQty -= fromShelf;

            if (shelfQty === 0) {
                shelfQty = Q;
            }

        } else {
            if (event.qty <= shelfQty) {
                shelfQty -= event.qty;

                if (shelfQty === 0) {
                    shelfQty = Q;
                }
            }
        }
    }

    return next[Q];
}

function calculateBaseline(events, mode) {
    const baselineShelf = new Map();

    for (const item of items.values()) {
        baselineShelf.set(
            item.item_id,
            item.initial_shelf_qty
        );
    }

    let cost = 0;

    for (const event of events) {
        for (const line of event.lines) {
            const item = items.get(line.item_id);

            let s =
                baselineShelf.get(
                    line.item_id
                );

            if (event.type === "walk_in") {
                if (line.qty <= s) {
                    s -= line.qty;

                    if (s === 0) {
                        cost +=
                            item.initial_shelf_qty *
                            item.refill_cost_per_unit_paise;

                        s =
                            item.initial_shelf_qty;
                    }

                } else {
                    cost +=
                        line.qty *
                        item.unit_price_paise;
                }

            } else {
                let fromShelf;

                if (mode === "shelf_first") {
                    fromShelf =
                        Math.min(
                            line.qty,
                            s
                        );
                } else {
                    fromShelf = 0;
                }

                const fromInventory =
                    line.qty - fromShelf;

                cost +=
                    fromInventory *
                    item.online_pull_cost_per_unit_paise;

                s -= fromShelf;

                if (s === 0) {
                    cost +=
                        item.initial_shelf_qty *
                        item.refill_cost_per_unit_paise;

                    s =
                        item.initial_shelf_qty;
                }
            }

            baselineShelf.set(
                line.item_id,
                s
            );
        }
    }

    return cost;
}

function prepareOptimizer(events) {
    const eventsByItem = new Map();

    for (const item of items.values()) {
        eventsByItem.set(
            item.item_id,
            []
        );
    }

    for (const event of events) {
        for (const line of event.lines) {
            eventsByItem
                .get(line.item_id)
                .push({
                    seq: event.seq,
                    type: event.type,
                    qty: line.qty
                });
        }
    }

    optimalDecisions = new Map();
    optimalCost = 0;

    for (const item of items.values()) {
        const itemEvents =
            eventsByItem.get(
                item.item_id
            );

        optimalCost +=
            optimizeItem(
                item,
                itemEvents
            );
    }

    baseline.shelf_first_cost =
        calculateBaseline(
            events,
            "shelf_first"
        );

    baseline.inventory_only_cost =
        calculateBaseline(
            events,
            "inventory_only"
        );

    baseline.total_cost =
        Math.min(
            baseline.shelf_first_cost,
            baseline.inventory_only_cost
        );
}

export async function health(req, res) {
    res.json({
        status: "ok"
    });
}

export async function dayload(req, res) {
    try {
        const data = req.body;

        if (!data) {
            return res.status(400).json({
                error: "invalid_request",
                message: "Request body is required"
            });
        }

        if (
            !data.day_id ||
            !data.items ||
            !data.events
        ) {
            return res.status(400).json({
                error: "invalid_request",
                message:
                    "day_id, items and events are required"
            });
        }

        resetState();

        currentDay = data.day_id;
        totalEvents = data.events.length;

        for (const item of data.items) {
            items.set(
                item.item_id,
                item
            );

            shelf.set(
                item.item_id,
                item.initial_shelf_qty
            );

            initializeItemStats(item);
        }

        console.log("Running optimizer...");

        prepareOptimizer(
            data.events
        );

        console.log("Optimizer finished.");

        console.log(
            "Optimal cost:",
            optimalCost
        );

        console.log(
            "Baseline:",
            baseline.total_cost
        );

        await DayLoad.deleteOne({
            day_id: data.day_id
        });

        await EventResponse.deleteMany({
            day_id: data.day_id
        });

        await DayLoad.create({
            day_id: data.day_id,
            items: data.items,
            events: data.events
        });

        res.json({
            day_id: data.day_id,
            status: "ready",
            event_count:
                data.events.length
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "load_failed",
            message: error.message
        });
    }
}

export async function dayevent(req, res) {
    try {
        const data = req.body;

        if (!data) {
            return res.status(400).json({
                error: "invalid_request",
                message: "Request body is required"
            });
        }

        if (
            data.seq !==
            lastProcessed + 1
        ) {
            return res.status(409).json({
                error: "out_of_order",
                expected:
                    lastProcessed + 1
            });
        }

        if (data.type === "walk_in") {
            for (const line of data.lines) {
                const item =
                    items.get(
                        line.item_id
                    );

                let currentShelf =
                    shelf.get(
                        line.item_id
                    );

                const stats =
                    itemStats.get(
                        line.item_id
                    );

                if (
                    line.qty <=
                    currentShelf
                ) {
                    currentShelf -=
                        line.qty;

                    totals.walk_in_revenue_captured +=
                        line.qty *
                        item.unit_price_paise;

                    if (
                        currentShelf === 0
                    ) {
                        shelf.set(
                            line.item_id,
                            0
                        );

                        addRefill(
                            line.item_id
                        );

                        currentShelf =
                            item.initial_shelf_qty;
                    }

                    shelf.set(
                        line.item_id,
                        currentShelf
                    );

                    stats.shelf_qty =
                        currentShelf;

                } else {
                    const lost =
                        line.qty *
                        item.unit_price_paise;

                    totals.lost_revenue +=
                        lost;

                    totals.units_lost +=
                        line.qty;

                    stats.lost_revenue +=
                        lost;

                    stats.units_lost +=
                        line.qty;

                    stats.shelf_qty =
                        currentShelf;
                }
            }

            lastProcessed =
                data.seq;

            const response = {
                seq: data.seq,
                type: "walk_in",
                status: "ok"
            };

            await saveEvent(
                response
            );

            if (
                lastProcessed ===
                totalEvents
            ) {
                await flushEventBuffer();
            }

            return res.json(
                response
            );
        }

        if (data.type === "online") {
            const responseLines = [];

            for (const line of data.lines) {
                const item =
                    items.get(
                        line.item_id
                    );

                let currentShelf =
                    shelf.get(
                        line.item_id
                    );

                let fromShelf =
                    optimalDecisions.get(
                        `${data.seq}:${line.item_id}`
                    );

                if (
                    fromShelf === undefined ||
                    !Number.isInteger(
                        fromShelf
                    )
                ) {
                    fromShelf = 0;
                }

                fromShelf = Math.max(
                    0,
                    Math.min(
                        fromShelf,
                        line.qty,
                        currentShelf
                    )
                );

                const fromInventory =
                    line.qty -
                    fromShelf;

                currentShelf -=
                    fromShelf;

                const pullCost =
                    fromInventory *
                    item.online_pull_cost_per_unit_paise;

                totals.units_pulled_from_inventory +=
                    fromInventory;

                totals.online_pull_cost +=
                    pullCost;

                totals.online_revenue +=
                    line.qty *
                    item.unit_price_paise;

                const stats =
                    itemStats.get(
                        line.item_id
                    );

                stats.units_pulled +=
                    fromInventory;

                stats.pull_cost +=
                    pullCost;

                if (
                    currentShelf === 0
                ) {
                    shelf.set(
                        line.item_id,
                        0
                    );

                    addRefill(
                        line.item_id
                    );

                    currentShelf =
                        item.initial_shelf_qty;
                }

                shelf.set(
                    line.item_id,
                    currentShelf
                );

                stats.shelf_qty =
                    currentShelf;

                responseLines.push({
                    item_id:
                        line.item_id,
                    from_shelf:
                        fromShelf
                });
            }

            lastProcessed =
                data.seq;

            const response = {
                seq: data.seq,
                type: "online",
                lines:
                    responseLines
            };

            await saveEvent(
                response
            );

            if (
                lastProcessed ===
                totalEvents
            ) {
                await flushEventBuffer();
            }

            return res.json(
                response
            );
        }

        return res.status(400).json({
            error: "invalid_event_type"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error:
                "event_processing_failed",
            message:
                error.message
        });
    }
}

export async function getDays(req, res) {
    try {
        const days =
            await DayLoad.find({})
                .select("day_id")
                .lean();

        const result =
            days.map(day => ({
                day_id:
                    day.day_id,

                total_cost:
                    day.day_id === currentDay
                        ? totals.refill_cost +
                          totals.online_pull_cost +
                          totals.lost_revenue
                        : 0,

                lost_revenue:
                    day.day_id === currentDay
                        ? totals.lost_revenue
                        : 0,

                savings_vs_baseline:
                    day.day_id === currentDay
                        ? baseline.total_cost -
                          (
                              totals.refill_cost +
                              totals.online_pull_cost +
                              totals.lost_revenue
                          )
                        : 0
            }));

        res.json(result);

    } catch (error) {
        res.status(500).json({
            error:
                "history_failed",
            message:
                error.message
        });
    }
}

export async function getSummary(req, res) {
    try {
        const dayId =
            req.params.day_id;

        const day =
            await DayLoad.findOne({
                day_id: dayId
            }).lean();

        if (!day) {
            return res.status(404).json({
                error:
                    "day_not_found"
            });
        }

        const events =
            await EventResponse.find({
                day_id: dayId
            })
                .sort({
                    seq: -1
                })
                .limit(50)
                .lean();

        events.reverse();

        const totalCost =
            totals.refill_cost +
            totals.online_pull_cost +
            totals.lost_revenue;

        const grossRevenue =
            totals.walk_in_revenue_captured +
            totals.online_revenue;

        let status = "idle";

        if (currentDay === dayId) {
            if (lastProcessed === 0) {
                status = "ready";
            } else if (
                lastProcessed ===
                totalEvents
            ) {
                status = "finished";
            } else {
                status = "running";
            }
        }

        const savings =
            baseline.total_cost -
            totalCost;

        const itemResults = [];

        if (currentDay === dayId) {
            for (
                const item
                of items.values()
            ) {
                const stats =
                    itemStats.get(
                        item.item_id
                    );

                itemResults.push({
                    item_id:
                        item.item_id,

                    shelf_qty:
                        shelf.get(
                            item.item_id
                        ),

                    refill_count:
                        stats.refill_count,

                    units_lost:
                        stats.units_lost,

                    lost_revenue:
                        stats.lost_revenue,

                    units_pulled:
                        stats.units_pulled,

                    pull_cost:
                        stats.pull_cost,

                    refill_cost:
                        stats.refill_cost
                });
            }
        }

        res.json({
            day_id: dayId,

            status,

            events_processed:
                currentDay === dayId
                    ? lastProcessed
                    : 0,

            events_total:
                day.events.length,

            totals: {
                refill_cost:
                    totals.refill_cost,

                online_pull_cost:
                    totals.online_pull_cost,

                lost_revenue:
                    totals.lost_revenue,

                total_cost:
                    totalCost,

                refill_count:
                    totals.refill_count,

                units_lost:
                    totals.units_lost,

                units_pulled_from_inventory:
                    totals.units_pulled_from_inventory,

                walk_in_revenue_captured:
                    totals.walk_in_revenue_captured,

                online_revenue:
                    totals.online_revenue,

                gross_revenue:
                    grossRevenue
            },

            baseline: {
                shelf_first_cost:
                    baseline.shelf_first_cost,

                inventory_only_cost:
                    baseline.inventory_only_cost,

                total_cost:
                    baseline.total_cost
            },

            savings_vs_baseline:
                savings,

            items:
                itemResults,

            processed_events:
                events
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error:
                "summary_failed",
            message:
                error.message
        });
    }
}

export async function getDayEvents(req, res) {
    try {
        const dayId =
            req.params.day_id;

        const events =
            await EventResponse.find({
                day_id: dayId
            })
                .sort({
                    seq: 1
                })
                .lean();

        if (events.length === 0) {
            const day =
                await DayLoad.findOne({
                    day_id: dayId
                }).lean();

            if (!day) {
                return res.status(404).json({
                    error:
                        "day_not_found"
                });
            }
        }

        res.json(events);

    } catch (error) {
        res.status(500).json({
            error:
                "events_failed",
            message:
                error.message
        });
    }
}