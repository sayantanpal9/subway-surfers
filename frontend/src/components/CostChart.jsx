function CostChart({ summary }) {
    const optimized = summary.totals.total_cost;
    const shelfFirst = summary.baseline.shelf_first_cost;
    const inventoryOnly = summary.baseline.inventory_only_cost;

    const max = Math.max(
        optimized,
        shelfFirst,
        inventoryOnly,
        1
    );

    return (
        <div className="cost-chart">
            <div className="bar-row">
                <div className="bar-label">Optimized</div>

                <div className="bar-track">
                    <div
                        className="bar optimized"
                        style={{
                            width: `${(optimized / max) * 100}%`
                        }}
                    />
                </div>

                <div className="bar-value">
                    {optimized.toLocaleString("en-IN")}
                </div>
            </div>

            <div className="bar-row">
                <div className="bar-label">Shelf-First</div>

                <div className="bar-track">
                    <div
                        className="bar"
                        style={{
                            width: `${(shelfFirst / max) * 100}%`
                        }}
                    />
                </div>

                <div className="bar-value">
                    {shelfFirst.toLocaleString("en-IN")}
                </div>
            </div>

            <div className="bar-row">
                <div className="bar-label">Inventory-Only</div>

                <div className="bar-track">
                    <div
                        className="bar"
                        style={{
                            width: `${(inventoryOnly / max) * 100}%`
                        }}
                    />
                </div>

                <div className="bar-value">
                    {inventoryOnly.toLocaleString("en-IN")}
                </div>
            </div>
        </div>
    );
}

export default CostChart;