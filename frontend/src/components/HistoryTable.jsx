function HistoryTable({
    history,
    selectedDay,
    onSelect
}) {
    return (
        <div
            className="table-wrapper"
        >
            <table
                data-testid="history-table"
            >
                <thead>
                    <tr>
                        <th>Day</th>
                        <th>Cost</th>
                        <th>Lost Revenue</th>
                        <th>Savings</th>
                    </tr>
                </thead>

                <tbody>
                    {history.map(day => (
                        <tr
                            key={day.day_id}
                            data-testid={
                                `history-row-${day.day_id}`
                            }
                            className={
                                selectedDay ===
                                day.day_id
                                    ? "selected"
                                    : ""
                            }
                            onClick={() =>
                                onSelect(
                                    day.day_id
                                )
                            }
                        >
                            <td>
                                <strong>
                                    {
                                        day.day_id
                                    }
                                </strong>
                            </td>

                            <td
                                data-testid={
                                    `history-cost-${day.day_id}`
                                }
                                data-value={
                                    day.total_cost
                                }
                            >
                                ₹
                                {day.total_cost.toLocaleString(
                                    "en-IN"
                                )}
                            </td>

                            <td
                                data-testid={
                                    `history-lost-${day.day_id}`
                                }
                                data-value={
                                    day.lost_revenue
                                }
                            >
                                ₹
                                {day.lost_revenue.toLocaleString(
                                    "en-IN"
                                )}
                            </td>

                            <td
                                data-testid={
                                    `history-savings-${day.day_id}`
                                }
                                data-value={
                                    day.savings_vs_baseline
                                }
                            >
                                ₹
                                {day.savings_vs_baseline.toLocaleString(
                                    "en-IN"
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default HistoryTable;