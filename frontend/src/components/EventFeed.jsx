function EventFeed({ events }) {
    const latest =
        [...events]
            .sort(
                (a, b) =>
                    b.seq - a.seq
            )
            .slice(0, 50);

    return (
        <div
            className="event-feed"
            data-testid="event-feed"
        >
            {latest.length === 0 ? (
                <div className="empty">
                    No events processed yet.
                </div>
            ) : (
                latest.map(event => (
                    <div
                        className="event-row"
                        key={event.seq}
                    >
                        <div className="event-seq">
                            #{event.seq}
                        </div>

                        <div
                            className={`event-type ${event.type}`}
                        >
                            {event.type}
                        </div>

                        {event.type ===
                            "online" && (
                            <div className="event-lines">
                                {event.lines?.map(
                                    line => (
                                        <span
                                            key={
                                                line.item_id
                                            }
                                        >
                                            {
                                                line.item_id
                                            }
                                            {" → "}
                                            {
                                                line.from_shelf
                                            }
                                        </span>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}

export default EventFeed;