function Header({ dayId, status, progress }) {
    return (
        <header className="header">
            <div>
                <h1>Mall Operations Optimiser</h1>
                <p>
                    Real-time simulation and inventory
                    optimisation
                </p>
            </div>

            <div className="header-right">
                <div>
                    <p>Current Day</p>
                    <strong>{dayId}</strong>
                </div>

                <div className="status">
                    {status}
                </div>

                <div>
                    <p>Progress</p>
                    <strong>{progress}%</strong>
                </div>
            </div>
        </header>
    );
}

export default Header;