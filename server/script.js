const { fetch_all_timetables, fetch_today_timetable, add_to_db } = require("./fetch_and_save");


const WAIT_TIME = 1000 * 60 * 60 * 24; // 24 hours in milliseconds ; milliseconds * seconds * minutes * hours

async function periodic() {
    console.log("Fetching today's timetable and saving to database...");
    try {
        const data = await fetch_today_timetable();
        await add_to_db(data);
        console.log("Timetable fetched and saved to database successfully.");
    } catch (error) {
        console.error("Error fetching or saving timetable:", error);
    }
    setTimeout(main, WAIT_TIME);
}

// First full fetch before starting the interval
async function main() {
    console.log("Performing initial full fetch of all timetables and saving to database...");
    fetch_all_timetables().then(all => add_to_db(all)).then(() => periodic());
};


main()