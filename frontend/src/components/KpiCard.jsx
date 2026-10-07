function KpiCard({ title, value, label }) {
    const formattedValue =
        typeof value === "number"
            ? value.toLocaleString("en-IN")
            : value;

    return (
        <div className="kpi-card">
            <h3>{title}</h3>

            <div className="value">
                {formattedValue}
            </div>

            {label && (
                <div className="label">
                    {label}
                </div>
            )}
        </div>
    );
}

export default KpiCard;