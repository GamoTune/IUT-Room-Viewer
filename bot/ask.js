// Module for querying room availability data from the database
require("dotenv").config();
// Prisma ORM client for database operations
const { PrismaClient } = require("../generated/edt-client");
const { code_main_group, code_sub_group } = require("./create_fields");



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



async function edt_group(groupName, startTime, endTime) {
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    const prisma = new PrismaClient();

    const groupNumber = groupName.slice(0, -1);  // Extract main group (e.g., 'G4B' -> 'G4')
    const groupLetter = groupName.slice(2);   // Extract sub-group (e.g., 'G4B' -> 'B')

    // Convert group number and letter to database format

    let formattedGroupNumber;
    let formattedSubGroupLetter;

    for (group of Object.keys(code_main_group)) {
        if (code_main_group[group] === groupNumber) {
            formattedGroupNumber = parseInt(group);
            break;
        }
    }

    for (subgroup of Object.keys(code_sub_group)) {
        if (code_sub_group[subgroup] === groupLetter) {
            formattedSubGroupLetter = parseInt(subgroup);
            break;
        }
    }

    const groupInfo = await prisma.lesson.findMany({
        where: {
            lesson_group: {
                some: {
                    group: {
                        main_group: formattedGroupNumber,
                        sub_group: formattedSubGroupLetter
                    }
                }
            },
            AND: [
                {
                    start_datetime: {
                        lt: endDate.toISOString()
                    }
                },
                {
                    end_datetime: {
                        gt: startDate.toISOString()
                    }
                }
            ]
        },
        include: {
            room: true,
            content: true,
            teacher: true,
            lesson_group: {
                include: {
                    group: true
                }
            }
        },
        orderBy: {
            start_datetime: 'asc'
        }
    });

    return groupInfo.map(l => ({
        salle: l.room?.name,
        type: l.type,
        start_datetime: l.start_datetime,
        end_datetime: l.end_datetime,
        code: l.content?.code,
        content_name: l.content?.name,
        teacher_name: l.teacher?.name,
        main_group: l.lesson_group[0]?.group?.main_group,
        sub_group: l.lesson_group[0]?.group?.sub_group
    }));
}


async function edt_teacher(teacherName, startTime, endTime) {
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    const prisma = new PrismaClient();

    const teacherInfo = await prisma.lesson.findMany({
        where: {
            teacher: {
                name: teacherName
            },
            AND: [
                {
                    start_datetime: {
                        lt: endDate.toISOString()
                    }
                },
                {
                    end_datetime: {
                        gt: startDate.toISOString()
                    }
                }
            ]
        },
        include: {
            room: true,
            content: true,
            teacher: true,
            lesson_group: {
                include: {
                    group: true
                }
            }
        },
        orderBy: {
            start_datetime: 'asc'
        }
    });

    return teacherInfo.map(l => ({
        salle: l.room?.name,
        type: l.type,
        start_datetime: l.start_datetime,
        end_datetime: l.end_datetime,
        code: l.content?.code,
        content_name: l.content?.name,
        teacher_name: l.teacher?.name,
        main_group: l.lesson_group[0]?.group?.main_group,
        sub_group: l.lesson_group[0]?.group?.sub_group
    }));
}


// Export the main function for checking room availability
module.exports = { rooms_availability, edt_group, edt_teacher };