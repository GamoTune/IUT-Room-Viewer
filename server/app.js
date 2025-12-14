// Main server application for automated timetable fetching and database updates
// Performs initial full sync then runs periodic updates
const { fetch_all_timetables, fetch_today_timetable, add_to_db } = require("./fetch_and_save");

// Configuration: Update interval set to 1 hour
const WAIT_TIME = 1000 * 60 * 60 * 1; // 1 hour in milliseconds (ms * sec * min * hours)

/**
 * Periodic function that fetches current timetable data and updates the database
 * Runs every WAIT_TIME interval to keep database current
 * Uses lightweight fetch_today_timetable() for regular updates
 */
async function periodic() {
    console.log("Fetching today's timetable and saving to database...");
    try {
        // Fetch only current/today's timetable data (lighter operation)
        const data = await fetch_today_timetable();
        await add_to_db(data);
        console.log("Timetable fetched and saved to database successfully.");
    } catch (error) {
        // Log any errors but continue the periodic cycle
        console.error("Error fetching or saving timetable:", error);
    }
    // Schedule next periodic update after WAIT_TIME
    setTimeout(main, WAIT_TIME);
}

/**
 * Main application function that handles initial setup and starts periodic updates
 * Performs a complete timetable sync on startup, then switches to periodic updates
 */
async function main() {
    console.log("Performing initial full fetch of all timetables and saving to database...");
    // Initial complete sync: fetch all available timetables for all years
    fetch_all_timetables()
        .then(all => add_to_db(all)) // Save complete dataset to database
        .then(() => periodic()); // Start periodic update cycle
};

// Start the application
main();

/*
 * Application Flow:
 * 1. Initial startup: Complete timetable sync (fetch_all_timetables)
 * 2. Regular updates: Lightweight current data sync (fetch_today_timetable)
 * 3. Continuous cycle: Updates every hour to keep data fresh
 */