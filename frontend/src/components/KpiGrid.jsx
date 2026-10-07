import KpiCard from "./KpiCard";

function KpiGrid({ summary }) {
    const totals = summary.totals;

    return (
        <div className="kpi-grid">

            <KpiCard
                title="Total Cost"
                value={totals.total_cost}
                label="paise"
            />

            <KpiCard
                title="Baseline Cost"
                value={summary.baseline.total_cost}
                label="paise"
            />

            <KpiCard
                title="Savings"
                value={summary.savings_vs_baseline}
                label="vs baseline"
            />

            <KpiCard
                title="Gross Revenue"
                value={totals.gross_revenue}
                label="paise"
            />

            <KpiCard
                title="Refill Cost"
                value={totals.refill_cost}
                label="paise"
            />

            <KpiCard
                title="Online Pull"
                value={totals.online_pull_cost}
                label="paise"
            />

            <KpiCard
                title="Lost Revenue"
                value={totals.lost_revenue}
                label="paise"
            />

            <KpiCard
                title="Refills"
                value={totals.refill_count}
                label="total refills"
            />

            <KpiCard
                title="Units Lost"
                value={totals.units_lost}
                label="units"
            />

            <KpiCard
                title="Inventory Pulled"
                value={
                    totals.units_pulled_from_inventory
                }
                label="units"
            />

        </div>
    );
}

export default KpiGrid;