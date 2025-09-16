const { YEARS, getLatestTimetableEntry, getTimetableEntries } = require('edt-iut-info-limoges');
const mysql = require("mysql2/promise");
require("dotenv").config();

module.exports = { fetch_today_timetable, add_to_db, fetch_all_timetables };


async function fetch_all_timetables() {
    const timeTableEntryA1 = await getTimetableEntries(YEARS.A1);
    const timeTableEntryA2 = await getTimetableEntries(YEARS.A2);
    const timeTableEntryA3 = await getTimetableEntries(YEARS.A3);
    
    let timeTablesEntries = timeTableEntryA1.concat(timeTableEntryA2, timeTableEntryA3);

    data = {
        fetched_at: new Date().toISOString(),
        lessons: []
    };

    for (const timeTableEntry of timeTablesEntries) {
        const timeTable = await timeTableEntry.getTimetable();
        data.lessons = data.lessons.concat(timeTable.lessons);
    }

    return data;
}




async function fetch_today_timetable() {
    const timeTableEntryA1 = await getLatestTimetableEntry(YEARS.A1);
    const timeTableEntryA2 = await getLatestTimetableEntry(YEARS.A2);
    const timeTableEntryA3 = await getLatestTimetableEntry(YEARS.A3);

    const timeTableA1 = await timeTableEntryA1.getTimetable();
    const timeTableA2 = await timeTableEntryA2.getTimetable();
    const timeTableA3 = await timeTableEntryA3.getTimetable();

    const allLessons = timeTableA1.lessons.concat(timeTableA2.lessons, timeTableA3.lessons);

    const data = {
        fetched_at: new Date().toISOString(),
        lessons: allLessons
    };



    return data;
}




async function add_to_db(data) {

    // Connect to the database
    const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    for (const lesson of data.lessons) {

        // Watch for special cases
        if (!lesson.content.lesson_from_reference) { lesson.content.lesson_from_reference = lesson.content.description || "N/A"; }
        if (!lesson.content.teacher) { lesson.content.teacher = "N/A"; }
        if (!lesson.content.room) { lesson.content.room = "N/A"; }
        if (!lesson.content.type) { lesson.content.type = "N/A"; }

        // ---- 1. Teacher ----
        let [rows] = await db.execute(
            "SELECT id FROM teacher WHERE short_code = ? OR fullname = ?",
            [lesson.content.teacher, lesson.content.teacher]
        );
        let teacherId;
        if (rows.length === 0) {
            const [result] = await db.execute(
                "INSERT INTO teacher (short_code, fullname) VALUES (?, ?)",
                [lesson.content.teacher, lesson.content.teacher]
            );
            teacherId = result.insertId;
        } else {
            teacherId = rows[0].id;
        }

        // ---- 2. Room ----
        [rows] = await db.execute("SELECT id FROM room WHERE name = ?", [lesson.content.room]);
        let roomId;
        if (rows.length === 0) {
            const [result] = await db.execute(
                "INSERT INTO room (name) VALUES (?)",
                [lesson.content.room]
            );
            roomId = result.insertId;
        } else {
            roomId = rows[0].id;
        }

        // ---- 3. Topic ----
        [rows] = await db.execute(
            "SELECT id FROM content WHERE code = ? AND name = ?",
            [lesson.content.type, lesson.content.lesson_from_reference]
        );
        let contentId;
        if (rows.length === 0) {
            const [result] = await db.execute(
                "INSERT INTO content (code, name) VALUES (?, ?)",
                [lesson.content.type, lesson.content.lesson_from_reference]
            );
            contentId = result.insertId;
        } else {
            contentId = rows[0].id;
        }

        // ---- 4. Session ----
        [rows] = await db.execute(
            `SELECT id FROM lesson
            WHERE type = ? AND start_datetime = ? AND end_datetime = ?
            AND content_id = ? AND room_id = ? AND teacher_id = ?`,
            [
                lesson.type,
                lesson.start_date.toJSDate(),
                lesson.end_date.toJSDate(),
                contentId,
                roomId,
                teacherId
            ]
        );

        let lessonId;
        if (rows.length === 0) {
            const [result] = await db.execute(
                `INSERT INTO lesson (type, start_datetime, end_datetime, content_id, room_id, teacher_id)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    lesson.type,
                    lesson.start_date.toJSDate(),
                    lesson.end_date.toJSDate(),
                    contentId,
                    roomId,
                    teacherId
                ]
            );

            lessonId = result.insertId;
            console.log(`✅ The session already exist: ${lesson.type} - ${lesson.content.lesson_from_reference}`);
        } else {
            lessonId = rows[0].id;
            console.log(`⚠ The session already exist: ${lesson.type} - ${lesson.content.lesson_from_reference}`);
        }

        // ---- 5. Group ----
        const mainGroup = lesson.group?.main || null;
        const subGroup = lesson.group?.sub || null;

        if (mainGroup !== null) {
            [rows] = await db.execute(
                "SELECT id FROM student_group WHERE main_group = ? AND (sub_group = ? OR (? IS NULL AND sub_group IS NULL))",
                [mainGroup, subGroup, subGroup]
            );
            let groupId;
            if (rows.length === 0) {
                const [result] = await db.execute(
                    "INSERT INTO student_group (main_group, sub_group) VALUES (?, ?)",
                    [mainGroup, subGroup]
                );
                groupId = result.insertId;
            } else {
                groupId = rows[0].id;
            }

            // ---- 6. Link session <-> group ----
            await db.execute(
                "INSERT IGNORE INTO lesson_group (lesson_id, group_id) VALUES (?, ?)",
                [lessonId, groupId]
            );
        }
    }

    await db.end();
    console.log("🎉 Import finished");
}



module.exports = { fetch_today_timetable, add_to_db, fetch_all_timetables };