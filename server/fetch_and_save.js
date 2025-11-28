// Module for fetching timetable data from IUT Limoges API and saving to database
const { YEARS, getLatestTimetableEntry, getTimetableEntries } = require('edt-iut-info-limoges');
require("dotenv").config();
// Prisma ORM client for database operations
const { PrismaClient } = require("../generated/edt-client");

// Export main functions for timetable fetching and database operations
module.exports = { fetch_today_timetable, add_to_db, fetch_all_timetables };


// Custom mapping for academic years to database identifiers
// Negative values are used to distinguish academic years in the database
const CUSTOM_YEARS = {
    A1: -1, // First year students
    A2: -2, // Second year students
    A3: -3, // Third year students
}


/**
 * Format and normalize group information for lessons
 * Ensures all lessons have proper group structure with main and sub group identifiers
 * @param {Array} lessons - Array of lesson objects to format
 * @param {string} year - Academic year (A1, A2, A3)
 * @returns {Promise<Array>} Formatted lessons with normalized group structure
 */
async function format_groups(lessons, year){
    for (const lesson of lessons) {
        // If lesson has no group info, assign default based on academic year
        if (!lesson.group) {
            lesson.group = { main: CUSTOM_YEARS[year], sub: -1 };
        } else if (!("sub" in lesson.group) || lesson.group.sub === undefined) {
            // Ensure sub-group exists, default to -1 if missing
            lesson.group.sub = -1;
        }
    }

    return lessons;
}

/**
 * Format and normalize room names, handling special room naming conventions
 * @param {Array} lessons - Array of lesson objects to format
 * @returns {Promise<Array>} Lessons with normalized room names
 */
async function format_rooms(lessons){
    for (const lesson of lessons) {
        // Handle room ranges (e.g., "111-112" becomes separate entries for "111" and "112")
        if (lesson.content.room.includes("-")) {
            const [roomBase, room_Number] = lesson.content.room.split("-");
            lesson.content.room = roomBase;

            // Create a duplicate lesson for the second room in the range
            const newLesson = JSON.parse(JSON.stringify(lesson));
            newLesson.content.room = (parseInt(roomBase) + 1).toString();
            lessons.push(newLesson);
        }
        // Normalize amphitheater room names ("A" -> "AmphA", "AmpC" -> "AmphC")
        if (lesson.content.room.includes("A")) {
            if (lesson.content.room.includes("Amp")) {
                lesson.content.room = "Amph" + lesson.content.room[3];
            } else {
                lesson.content.room = "Amph" + lesson.content.room[1];
            }
        }
    }

    return lessons;
}

/**
 * Process and format multiple timetable entries into a unified data structure
 * @param {Array} timeTablesEntries - Array of timetable entry objects
 * @returns {Promise<Object>} Formatted data object with timestamp and processed lessons
 */
async function format_timetables(timeTablesEntries){
    // Initialize data structure with fetch timestamp
    const data = {
        fetched_at: new Date().toISOString(),
        lessons: []
    };
    
    // Process each timetable entry
    for (const timeTableEntry of timeTablesEntries) {
        const timeTable = await timeTableEntry.getTimetable();

        // Apply formatting transformations to lessons
        let lessons = await format_groups(timeTable.lessons, timeTableEntry.from_year);
        lessons = await format_rooms(lessons);

        // Merge formatted lessons into the main data structure
        data.lessons = data.lessons.concat(lessons);
    }

    return data;
}


/**
 * Fetch all available timetables for all academic years
 * @returns {Promise<Object>} Formatted timetable data for all years
 */
async function fetch_all_timetables() {
    // Fetch complete timetable entries for each academic year
    const timeTableEntryA1 = await getTimetableEntries(YEARS.A1);
    const timeTableEntryA2 = await getTimetableEntries(YEARS.A2);
    const timeTableEntryA3 = await getTimetableEntries(YEARS.A3);

    // Combine all timetable entries into a single array
    let timeTablesEntries = timeTableEntryA1.concat(timeTableEntryA2, timeTableEntryA3);
    
    return await format_timetables(timeTablesEntries);
}

/**
 * Fetch only the latest/current timetable for all academic years
 * @returns {Promise<Object>} Formatted timetable data for current period
 */
async function fetch_today_timetable() {
    // Fetch only the most recent timetable entry for each academic year
    const timeTableEntryA1 = await getLatestTimetableEntry(YEARS.A1);
    const timeTableEntryA2 = await getLatestTimetableEntry(YEARS.A2);
    const timeTableEntryA3 = await getLatestTimetableEntry(YEARS.A3);

    // Combine latest entries from all years
    let timeTablesEntries = [timeTableEntryA1, timeTableEntryA2, timeTableEntryA3];

    return await format_timetables(timeTablesEntries);
}


/**
 * Save formatted timetable data to the database using Prisma ORM
 * Uses upsert operations to handle duplicates gracefully
 * @param {Promise<Object>} data - Formatted timetable data with lessons array
 */
async function add_to_db(data) {

    const prisma = new PrismaClient();

    // Process each lesson and save to database with proper relationships
    for (const lesson of data.lessons) {

        // Data validation: ensure all required fields have values, default to "N/A" if missing
        if (!lesson.content.lesson_from_reference) { lesson.content.lesson_from_reference = lesson.content.description || "N/A"; }
        if (!lesson.content.teacher) { lesson.content.teacher = "N/A"; }
        if (!lesson.content.room) { lesson.content.room = "N/A"; }
        if (!lesson.content.type) { lesson.content.type = "N/A"; }

        // ---- 1. Teacher ---- 
        // Create teacher record if it doesn't exist, otherwise retrieve existing one
        const teacher = await prisma.teacher.upsert({
            where: { name: lesson.content.teacher },
            update: {}, // No updates needed for existing teachers
            create: { name: lesson.content.teacher },
        });
        const teacherId = teacher.id;

        // ---- 2. Room ----
        // Create room record if it doesn't exist, otherwise retrieve existing one
        const room = await prisma.room.upsert({
            where: { name: lesson.content.room },
            update: {}, // No updates needed for existing rooms
            create: { name: lesson.content.room },
        });
        const roomId = room.id;

        // ---- 3. Content/Subject ----
        // Create subject/content record with code and name
        const content = await prisma.content.upsert({
            where: {
                code: lesson.content.type,
                name: lesson.content.lesson_from_reference
            },
            update: {}, // No updates needed for existing content
            create: {
                code: lesson.content.type,
                name: lesson.content.lesson_from_reference
            }
        });
        const contentId = content.id;

        // ---- 4. Lesson Session ----
        // Create the main lesson record with all relationships
        // Uses composite unique constraint to prevent duplicates
        const session = await prisma.lesson.upsert({
            where: {
                type_start_end_content_room_teacher: {
                    type: lesson.type,
                    start_datetime: lesson.start_date,
                    end_datetime: lesson.end_date,
                    content_id: contentId,
                    room_id: roomId,
                    teacher_id: teacherId,
                },
            },
            update: {}, // No updates needed for existing lessons
            create: {
                type: lesson.type,
                start_datetime: lesson.start_date,
                end_datetime: lesson.end_date,
                content: { connect: { id: contentId } }, // Link to content record
                room: { connect: { id: roomId } }, // Link to room record
                teacher: { connect: { id: teacherId } }, // Link to teacher record
            },
        });
        const lessonId = session.id;


        // ---- 5. Student Group ----
        // Extract group information (main academic year and sub-group)
        const mainGroup = lesson.group?.main;
        const subGroup = lesson.group?.sub;

        // Create student group record with main and sub group identifiers
        const group = await prisma.student_group.upsert({
            where: {
                main_group_sub_group: {
                    main_group: mainGroup,
                    sub_group: subGroup,
                },
            },
            update: {}, // No updates needed for existing groups
            create: {
                main_group: mainGroup,
                sub_group: subGroup,
            },
        });
        const groupId = group.id;

        // ---- 6. Link Lesson to Student Group ----
        // Create many-to-many relationship between lessons and student groups
        await prisma.lesson_group.upsert({
            where: {
                lesson_id_group_id: {
                    lesson_id: lessonId,
                    group_id: groupId,
                }
            },
            update: {}, // No updates needed for existing relationships
            create: {
                lesson: { connect: { id: lessonId } }, // Link to lesson record
                group: { connect: { id: groupId } }, // Link to group record
            }
        });
    }

    console.log("🎉 Import finished");

    // Clean up database connection
    await prisma.$disconnect();
}