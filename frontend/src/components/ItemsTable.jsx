import { useMemo, useState } from "react";

function ItemsTable({ items }) {
    const [search, setSearch] =
        useState("");

    const [sortLost, setSortLost] =
        useState(false);

    const filteredItems =
        useMemo(() => {
            let result =
                [...items];

            if (search.trim()) {
                const query =
                    search
                        .toLowerCase()
                        .trim();

                result =
                    result.filter(
                        item =>
                            item.item_id
                                .toLowerCase()
                                .includes(query)
                    );
            }

            if (sortLost) {
                result.sort(
                    (a, b) =>
                        b.lost_revenue -
                        a.lost_revenue
                );
            }

            return result;
        }, [
            items,
            search,
            sortLost
        ]);

    return (
        <div>
            <div className="table-controls">
                <input
                    data-testid="item-search"
                    value={search}
                    onChange={e =>
                        setSearch(
                            e.target.value
                        )
                    }
                    placeholder="Search item..."
                />

                <button
                    data-testid="sort-lost"
                    onClick={() =>
                        setSortLost(
                            value =>
                                !value
                        )
                    }
                    className={
                        sortLost
                            ? "active"
                            : ""
                    }
                >
                    Sort by lost revenue
                </button>
            </div>

            <div className="table-wrapper">
                <table
                    data-testid="items-table"
                >
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Shelf</th>
                            <th>Lost Revenue</th>
                            <th>Refills</th>
                            <th>Units Pulled</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredItems.map(
                            item => (
                                <tr
                                    key={
                                        item.item_id
                                    }
                                    data-testid={
                                        `item-row-${item.item_id}`
                                    }
                                >
                                    <td>
                                        <strong>
                                            {
                                                item.item_id
                                            }
                                        </strong>
                                    </td>

                                    <td
                                        data-testid={
                                            `item-shelf-${item.item_id}`
                                        }
                                        data-value={
                                            item.shelf_qty
                                        }
                                    >
                                        {
                                            item.shelf_qty
                                        }
                                    </td>

                                    <td
                                        data-testid={
                                            `item-lost-${item.item_id}`
                                        }
                                        data-value={
                                            item.lost_revenue
                                        }
                                    >
                                        ₹
                                        {item.lost_revenue.toLocaleString(
                                            "en-IN"
                                        )}
                                    </td>

                                    <td
                                        data-testid={
                                            `item-refills-${item.item_id}`
                                        }
                                        data-value={
                                            item.refill_count
                                        }
                                    >
                                        {
                                            item.refill_count
                                        }
                                    </td>

                                    <td
                                        data-testid={
                                            `item-pulled-${item.item_id}`
                                        }
                                        data-value={
                                            item.units_pulled
                                        }
                                    >
                                        {
                                            item.units_pulled
                                        }
                                    </td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default ItemsTable;