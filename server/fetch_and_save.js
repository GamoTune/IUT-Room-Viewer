const { YEARS, getLatestTimetableEntry, getTimetableEntries } = require('edt-iut-info-limoges');
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");


module.exports = { fetch_today_timetable, add_to_db, fetch_all_timetables };



const CUSTOM_YEARS = {
    A1: -1,
    A2: -2,
    A3: -3,
}



async function format_groups(lessons, year){
    for (const lesson of lessons) {
        if (!lesson.group) {
            lesson.group = { main: CUSTOM_YEARS[year], sub: -1 };
        } else if (!("sub" in lesson.group) || lesson.group.sub === undefined) {
            lesson.group.sub = -1;
        }
    }

    return lessons;
}

async function format_rooms(lessons){
    for (const lesson of lessons) {
        if (lesson.content.room.includes("-")) {
            const [roomBase, room_Number] = lesson.content.room.split("-");
            lesson.content.room = roomBase;

            // Create a copy of the lesson with the incremented room number
            const newLesson = JSON.parse(JSON.stringify(lesson));
            newLesson.content.room = (parseInt(roomBase) + 1).toString();
            lessons.push(newLesson);
        }
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

async function format_timetables(timeTablesEntries){
    const data = {
        fetched_at: new Date().toISOString(),
        lessons: []
    };
    
    for (const timeTableEntry of timeTablesEntries) {
        const timeTable = await timeTableEntry.getTimetable();

        // Format lessons to add custom groups
        let lessons = await format_groups(timeTable.lessons, timeTableEntry.from_year);
        lessons = await format_rooms(lessons);

        data.lessons = data.lessons.concat(lessons);
    }

    return data;
}



async function fetch_all_timetables() {
    const timeTableEntryA1 = await getTimetableEntries(YEARS.A1);
    const timeTableEntryA2 = await getTimetableEntries(YEARS.A2);
    const timeTableEntryA3 = await getTimetableEntries(YEARS.A3);

    let timeTablesEntries = timeTableEntryA1.concat(timeTableEntryA2, timeTableEntryA3);
    
    return await format_timetables(timeTablesEntries);
}

async function fetch_today_timetable() {
    const timeTableEntryA1 = await getLatestTimetableEntry(YEARS.A1);
    const timeTableEntryA2 = await getLatestTimetableEntry(YEARS.A2);
    const timeTableEntryA3 = await getLatestTimetableEntry(YEARS.A3);

    let timeTablesEntries = [timeTableEntryA1, timeTableEntryA2, timeTableEntryA3];

    return await format_timetables(timeTablesEntries);
}



async function add_to_db(data) {

    const prisma = new PrismaClient();

    for (const lesson of data.lessons) {

        // Watch for special cases
        if (!lesson.content.lesson_from_reference) { lesson.content.lesson_from_reference = lesson.content.description || "N/A"; }
        if (!lesson.content.teacher) { lesson.content.teacher = "N/A"; }
        if (!lesson.content.room) { lesson.content.room = "N/A"; }
        if (!lesson.content.type) { lesson.content.type = "N/A"; }

        // ---- 1. Teacher ----
        const teacher = await prisma.teacher.upsert({
            where: { name: lesson.content.teacher },
            update: {}, // Nothing to update if the teacher already exists
            create: { name: lesson.content.teacher },
        });
        const teacherId = teacher.id;

        // ---- 2. Room ----
        const room = await prisma.room.upsert({
            where: { name: lesson.content.room },
            update: {},
            create: { name: lesson.content.room },
        });
        const roomId = room.id;

        // ---- 3. Topic ----

        const content = await prisma.content.upsert({
            where: {
                code: lesson.content.type,
                name: lesson.content.lesson_from_reference
            },
            update: {},
            create: {
                code: lesson.content.type,
                name: lesson.content.lesson_from_reference
            }
        });
        const contentId = content.id;

        // ---- 4. Session ----
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
            update: {},
            create: {
                type: lesson.type,
                start_datetime: lesson.start_date,
                end_datetime: lesson.end_date,
                content: { connect: { id: contentId } },
                room: { connect: { id: roomId } },
                teacher: { connect: { id: teacherId } },
            },
        });
        const lessonId = session.id;


        // ---- 5. Group ----
        const mainGroup = lesson.group?.main;
        const subGroup = lesson.group?.sub;

        const group = await prisma.student_group.upsert({
            where: {
                main_group_sub_group: {
                    main_group: mainGroup,
                    sub_group: subGroup,
                },
            },
            update: {},
            create: {
                main_group: mainGroup,
                sub_group: subGroup,
            },
        });
        const groupId = group.id;

        // ---- 6. Link session <-> group ----
        await prisma.lesson_group.upsert({
            where: {
                lesson_id_group_id: {
                    lesson_id: lessonId,
                    group_id: groupId,
                }
            },
            update: {},
            create: {
                lesson: { connect: { id: lessonId } },
                group: { connect: { id: groupId } },
            }
        });
    }

    console.log("🎉 Import finished");

    await prisma.$disconnect();
}