// Module for querying room availability data from the database
require("dotenv").config();
// Prisma ORM client for database operations
const { PrismaClient } = require("@prisma/client");



/**
 * Get detailed information about lessons in a specific room during a time period
 * @param {string} roomName - Name of the room to query
 * @param {string|Date} startTime - Start time for the query period
 * @param {string|Date} endTime - End time for the query period
 * @returns {Array} Array of lesson objects occurring in the room during the specified time
 */
async function get_info_about(roomName, startTime, endTime) {

    // Convert input times to Date objects for consistency
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // Initialize Prisma client for database operations
    const prisma = new PrismaClient();

    // Query lessons that overlap with the specified time period
    // A lesson overlaps if: lesson_start < query_end AND lesson_end > query_start
    const roomInfo = await prisma.lesson.findMany({
        where: {
            room: {
                name: roomName // Filter by specific room name
            },
            AND: [
                {
                    start_datetime: {
                        lt: endDate.toISOString() // Lesson starts before query period ends
                    }
                },
                {
                    end_datetime: {
                        gt: startDate.toISOString() // Lesson ends after query period starts
                    }
                }
            ]
        },
        include: {
            room: true, // Include room details
            content: true, // Include lesson content/subject details
            teacher: true, // Include teacher information
            lesson_group: {
                include: {
                    group: true // Include student group information
                }
            }
        },
        orderBy: {
            room: {
                name: 'asc' // Sort results by room name
            }
        }
    });

    // Transform Prisma result to simplified object structure
    // Maps complex relational data to flat objects for easier consumption
    return roomInfo.map(l => ({
        salle: l.room?.name, // Room name
        type: l.type, // Lesson type (e.g., lecture, lab, etc.)
        start_datetime: l.start_datetime, // Lesson start time
        end_datetime: l.end_datetime, // Lesson end time
        code: l.content?.code, // Subject/course code
        content_name: l.content?.name, // Subject/course name
        teacher_name: l.teacher?.name, // Teacher's name
        main_group: l.lesson_group[0]?.group?.main_group, // Main student group
        sub_group: l.lesson_group[0]?.group?.sub_group // Sub-group within main group
    }));
}



/**
 * Get availability status for all rooms during a specified time period
 * @param {Date} startTime - Start time for availability check
 * @param {Date} endTime - End time for availability check
 * @returns {Object} Object mapping room names to their lesson data (null if available)
 */
async function rooms_availability(startTime, endTime) {

    // Convert Date objects to ISO strings for database queries
    const start = startTime.toISOString();
    const end = endTime.toISOString();

    // Initialize Prisma client and fetch all room names
    const prisma = new PrismaClient();
    const allRooms = await prisma.room.findMany({
        select: {
            name: true // Only need room names, not full room objects
        }
    });
    const roomNames = allRooms.map(r => r.name); // Extract names into simple array


    // Build availability map: room name -> lesson data (or null if available)
    const roomInUse = {}
    for (const roomName of roomNames) {
        // Get lesson information for this room during the time period
        const info = await get_info_about(roomName, start, end);

        // Special business logic: R46 and R47 are connected rooms
        // If one is occupied, both should be considered occupied
        let mergedInfo = info;
        if (roomName === "R46") {
            const r47Info = await get_info_about("R47", start, end);
            mergedInfo = [...info, ...r47Info]; // Combine lessons from both rooms
        } else if (roomName === "R47") {
            const r46Info = await get_info_about("R46", start, end);
            mergedInfo = [...info, ...r46Info]; // Combine lessons from both rooms
        }

        // Store lesson data if room is occupied, null if available
        roomInUse[roomName] = mergedInfo.length > 0 ? mergedInfo : null;
    }

    return roomInUse; // Return complete availability map
}


// Export the main function for checking room availability
module.exports = { rooms_availability };