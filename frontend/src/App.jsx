import { useEffect, useState } from "react";
import axios from "axios";

import Header from "./components/Header";
import KpiGrid from "./components/KpiGrid";
import ItemsTable from "./components/ItemsTable";
import CostChart from "./components/CostChart";
import EventFeed from "./components/EventFeed";
import HistoryTable from "./components/HistoryTable";

import "./App.css";

const API = "/api/v1";

const emptySummary = {
    day_id: "No day loaded",
    status: "idle",
    events_processed: 0,
    events_total: 0,

    totals: {
        refill_cost: 0,
        online_pull_cost: 0,
        lost_revenue: 0,
        total_cost: 0,
        refill_count: 0,
        units_lost: 0,
        units_pulled_from_inventory: 0,
        walk_in_revenue_captured: 0,
        online_revenue: 0,
        gross_revenue: 0
    },

    baseline: {
        shelf_first_cost: 0,
        inventory_only_cost: 0,
        total_cost: 0
    },

    savings_vs_baseline: 0,
    items: [],
    processed_events: []
};

function App() {
    const [summary, setSummary] =
        useState(emptySummary);

    const [history, setHistory] =
        useState([]);

    const [selectedDay, setSelectedDay] =
        useState(null);

    async function fetchSummary(dayId) {
        if (!dayId) {
            return;
        }

        try {
            const response = await axios.get(
                `${API}/day/${dayId}/summary`
            );

            console.log(
                "SUMMARY:",
                response.data
            );

            setSummary(response.data);

        } catch (error) {
            console.error(
                "SUMMARY ERROR:",
                error
            );
        }
    }

    async function fetchHistory() {
        try {
            const response = await axios.get(
                `${API}/days`
            );

            console.log(
                "HISTORY:",
                response.data
            );

            const days = response.data;

            setHistory(days);

            if (days.length === 0) {
                return;
            }

            if (!selectedDay) {
                const latestDay =
                    days[days.length - 1].day_id;

                setSelectedDay(
                    latestDay
                );

                fetchSummary(
                    latestDay
                );
            }

        } catch (error) {
            console.error(
                "HISTORY ERROR:",
                error
            );
        }
    }

    useEffect(() => {
        fetchHistory();

        const interval = setInterval(() => {
            fetchHistory();

            if (selectedDay) {
                fetchSummary(
                    selectedDay
                );
            }
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [selectedDay]);

    async function handleHistoryClick(dayId) {
        setSelectedDay(dayId);

        await fetchSummary(dayId);
    }

    const progress =
        summary.events_total > 0
            ? Math.round(
                (summary.events_processed /
                    summary.events_total) *
                100
            )
            : 0;

    return (
        <div className="app">

            <Header
                dayId={summary.day_id}
                status={summary.status}
                progress={progress}
            />

            <main className="dashboard">

                <KpiGrid
                    summary={summary}
                />

                <div className="main-grid">

                    <section className="panel chart-panel">

                        <div className="panel-header">
                            <div>
                                <h2>
                                    Cost Overview
                                </h2>

                                <p>
                                    System cost vs baseline
                                </p>
                            </div>
                        </div>

                        <CostChart
                            summary={summary}
                        />

                    </section>

                    <section className="panel history-panel">

                        <div className="panel-header">
                            <div>
                                <h2>
                                    History
                                </h2>

                                <p>
                                    Previous simulation runs
                                </p>
                            </div>
                        </div>

                        <HistoryTable
                            history={history}
                            selectedDay={
                                selectedDay
                            }
                            onSelect={
                                handleHistoryClick
                            }
                        />

                    </section>

                </div>

                <section className="panel">

                    <div className="panel-header">
                        <div>
                            <h2>
                                Items
                            </h2>

                            <p>
                                Current inventory performance
                            </p>
                        </div>
                    </div>

                    <ItemsTable
                        items={summary.items}
                    />

                </section>

                <section className="panel">

                    <div className="panel-header">
                        <div>
                            <h2>
                                Event Feed
                            </h2>

                            <p>
                                Latest processed events
                            </p>
                        </div>
                    </div>

                    <EventFeed
                        events={
                            summary.processed_events
                        }
                    />

                </section>

            </main>

        </div>
    );
}

export default App;