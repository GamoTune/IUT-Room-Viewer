// Module for fetching timetable data from IUT Limoges API and saving to database
const { YEARS, getLatestTimetableEntry, getTimetableEntries } = require('edt-iut-info-limoges');
require("dotenv").config();
// Prisma ORM client for database operations
const { PrismaClient } = require("../generated/edt-client");
const term = require('terminal-kit').terminal;


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
async function format_groups(lessons, year) {
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
async function format_rooms(lessons) {
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
async function format_timetablesEntries(timeTablesEntries) {
    const data = [];
    // Process each timetable entry
    for (const timeTableEntry of timeTablesEntries) {
        const timeTable = await timeTableEntry.getTimetable();

        // Apply formatting transformations to lessons
        let lessons = await format_groups(timeTable.lessons, timeTableEntry.from_year);
        lessons = await format_rooms(lessons);

        // Merge formatted lessons into the main data structure
        timeTableEntry.lessons = lessons;
        data.push(timeTableEntry);
    }

    return data;
}


function isOutDated(old_edt, new_edt) {
    const old_date = new Date(old_edt);
    const new_date = new Date(new_edt);
    return new_date > old_date;
}



/**
 * Fetch all available timetables for all academic years
 * @returns {Promise<Object>} Formatted timetable data for all years
 */
async function fetch_all_timetables() {
    // Fetch complete timetable entries for each academic year
    const timeTableEntriesA1 = await format_timetablesEntries(await getTimetableEntries(YEARS.A1));
    const timeTableEntriesA2 = await format_timetablesEntries(await getTimetableEntries(YEARS.A2));
    const timeTableEntriesA3 = await format_timetablesEntries(await getTimetableEntries(YEARS.A3));

    return [
        timeTableEntriesA1, timeTableEntriesA2, timeTableEntriesA3
    ]
}

/**
 * Fetch only the latest/current timetable for all academic years
 * @returns {Promise<Object>} Formatted timetable data for current period
 */
async function fetch_today_timetable() {
    // Fetch only the most recent timetable entry for each academic year
    const timeTableEntryA1 = await format_timetablesEntries([await getLatestTimetableEntry(YEARS.A1)]);
    const timeTableEntryA2 = await format_timetablesEntries([await getLatestTimetableEntry(YEARS.A2)]);
    const timeTableEntryA3 = await format_timetablesEntries([await getLatestTimetableEntry(YEARS.A3)]);

    return [
        timeTableEntryA1, timeTableEntryA2, timeTableEntryA3
    ]
}


// On instancie Prisma UNE SEULE FOIS en dehors de la fonction
const prisma = new PrismaClient();

async function add_to_db(data) {
    try {
        term.yellow("Starting update of database with fetched timetable data...\n");

        // --- Log des stats (inchangé) ---
        let totalYears = 0;
        let totalTimetables = 0;
        let totalLessons = 0;
        for (const year of data) {
            totalYears += 1;
            totalTimetables += year.length;
            for (const timetable of year) {
                totalLessons += timetable.lessons.length;
            }
        }
        term.blue(`Fetched Data Summary:\n- Academic Years: ${totalYears}\n- Timetables: ${totalTimetables}\n- Lessons: ${totalLessons}\n\n`);

        // --- Barre de progression ---
        const progressBar = term.progressBar({
            width: 50,
            title: 'Processing data',
            eta: true,
            percent: true
        });

        let currentLessonNum = 0;

        // --- Boucle Principale ---
        for (const year of data) {
            for (const timetable of year) {

                // 1. Gestion de l'EDT (Timetable)
                const edtRecord = await processTimetableEntry(timetable);

                // Si processTimetableEntry retourne null, c'est que l'EDT est à jour, on passe au suivant
                if (!edtRecord) {
                    // On met à jour la barre de progression pour les leçons skippées
                    currentLessonNum += timetable.lessons.length;
                    if (totalLessons > 0) {
                        progressBar.update(currentLessonNum / totalLessons);
                    }
                    continue;
                }

                // 2. Traitement des cours pour cet EDT
                for (const lesson of timetable.lessons) {
                    await processLesson(lesson, edtRecord.id);

                    currentLessonNum++;
                    // Mise à jour de la barre de progression (calcul du pourcentage)
                    if (totalLessons > 0) {
                        progressBar.update(currentLessonNum / totalLessons);
                    }
                }
            }
        }

        term.green('\n✅ Database update completed successfully!\n');

    } catch (err) {
        console.error('Error in add_to_db:', err);
        term.red('❌ Error during database update: ' + err.message + '\n');
    } finally {
        // Optionnel : fermer la connexion si le script s'arrête complètement après ça
        // await prisma.$disconnect();
    }
}

/**
 * Gère la création ou la mise à jour de l'index EDT.
 * Retourne l'objet EDT si on doit traiter les cours, ou null si c'est déjà à jour.
 */
async function processTimetableEntry(timetable) {
    const whereCondition = {
        week_number: timetable.week_number,
        from_year: timetable.from_year
    };

    const existingTimetable = await prisma.edt_index.findFirst({
        where: {
            week_number: timetable.week_number,
            from_year: timetable.from_year
        }
    });

    if (existingTimetable) {
        // Si l'EDT existe mais n'est pas périmé, on retourne null pour sauter le traitement
        if (!isOutDated(existingTimetable.last_updated, timetable.last_updated)) {
            return null;
        }

        // Mise à jour de l'EDT
        const updatedEdt = await prisma.edt_index.update({
            where: { id: existingTimetable.id },
            data: {
                link: timetable.link,
                last_updated: new Date(timetable.last_updated),
            },
        });

        // Nettoyage des anciens cours liés à cet EDT (Cascade manuelle)
        // Note: Prisma peut gérer ça via "onDelete: Cascade" dans le schema, 
        // mais vu ton schema actuel, il faut le faire manuellement pour lesson_group.

        // 1. Trouver les IDs des lessons liées
        const lessonsToDelete = await prisma.lesson.findMany({
            where: { edt_id: updatedEdt.id },
            select: { id: true }
        });
        const lessonIds = lessonsToDelete.map(l => l.id);

        if (lessonIds.length > 0) {
            // 2. Supprimer les liaisons groupes
            await prisma.lesson_group.deleteMany({
                where: { lesson_id: { in: lessonIds } }
            });
            // 3. Supprimer les leçons
            await prisma.lesson.deleteMany({
                where: { id: { in: lessonIds } }
            });
        }

        return updatedEdt;
    } else {
        // Création d'un nouvel EDT
        return await prisma.edt_index.create({
            data: {
                link: timetable.link,
                last_updated: new Date(timetable.last_updated),
                week_number: timetable.week_number,
                from_year: timetable.from_year
            }
        });
    }
}

/**
 * Gère l'insertion d'une leçon et de toutes ses dépendances (Prof, Salle, Matière, Groupe)
 */
async function processLesson(lesson, timeTableID) {
    // Validation / Valeurs par défaut
    const lessonContent = lesson.content || {};
    const teacherName = lessonContent.teacher || null;
    const roomName = lessonContent.room || null;
    const contentCode = lessonContent.type || "N/A";
    const contentName = lessonContent.lesson_from_reference || lessonContent.description || "N/A";

    // --- Étape A : Préparer le contenu (obligatoire) ---
    const content = await prisma.content.upsert({
        where: { code: contentCode },
        update: { name: contentName },
        create: {
            code: contentCode,
            name: contentName
        }
    });

    // --- Étape B : Préparer les entités optionnelles (Prof, Salle) ---
    let teacher = null;
    let room = null;

    if (teacherName) {
        teacher = await prisma.teacher.upsert({
            where: { name: teacherName },
            update: {},
            create: { name: teacherName },
        });
    }

    if (roomName) {
        room = await prisma.room.upsert({
            where: { name: roomName },
            update: {},
            create: { name: roomName },
        });
    }

    // --- Étape C : Créer/Mettre à jour la leçon ---
    // On utilise findFirst + create/update au lieu de upsert car les champs 
    // nullable (room_id, teacher_id) dans @@unique posent des problèmes
    const startDate = new Date(lesson.start_date);
    const endDate = new Date(lesson.end_date);

    const existingLesson = await prisma.lesson.findFirst({
        where: {
            type: lesson.type,
            start_datetime: startDate,
            end_datetime: endDate,
            content_id: content.id,
            room_id: room?.id ?? null,
            teacher_id: teacher?.id ?? null,
        }
    });

    let session;
    if (existingLesson) {
        session = await prisma.lesson.update({
            where: { id: existingLesson.id },
            data: { edt_id: timeTableID }
        });
    } else {
        session = await prisma.lesson.create({
            data: {
                type: lesson.type,
                start_datetime: startDate,
                end_datetime: endDate,
                content_id: content.id,
                room_id: room?.id ?? null,
                teacher_id: teacher?.id ?? null,
                edt_id: timeTableID,
            }
        });
    }

    // --- Étape D : Gestion du Groupe ---
    const mainGroup = lesson.group?.main;
    const subGroup = lesson.group?.sub;

    if (mainGroup !== undefined) {
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

        // --- Étape E : Lier la leçon au groupe ---
        await prisma.lesson_group.upsert({
            where: {
                lesson_id_group_id: {
                    lesson_id: session.id,
                    group_id: group.id,
                }
            },
            update: {},
            create: {
                lesson_id: session.id,
                group_id: group.id,
            }
        });
    }
}





/**
 * Save formatted timetable data to the database using Prisma ORM
 * Uses upsert operations to handle duplicates gracefully
 * @param {Promise<Object>} data - Formatted timetable data with lessons array
 */

/*
async function add_to_db(data) {
    try {
        term.yellow("Starting update of database with fetched timetable data...\n");

        // First loop to log stats
        let totalYears = 0;
        let totalTimetables = 0;
        let totalLessons = 0;
        for (const year of data) {
            totalYears += 1;
            totalTimetables += year.length;
            for (const timetable of year) {
                totalLessons += timetable.lessons.length;
            }
        }
        term.blue(`Fetched Data Summary:\n`);
        term.blue(`- Academic Years: ${totalYears}\n`);
        term.blue(`- Timetables: ${totalTimetables}\n`);
        term.blue(`- Lessons: ${totalLessons}\n\n`);

        let currentLessonNum = 0;

        const progressBar = term.progressBar({
            width: 50,
            title: 'Processing data',
            eta: true
        });


        // Initialize Prisma client for database operations
        const prisma = new PrismaClient();

        // Process each year
        for (const year of data) {
            // Process each timetables in the year
            timeTableLoop: for (const timetable of year) {

                    // ----- TimeTable Entry -----
                    // Create timetable entry record if it doesn't exist, otherwise retrieve existing one
                    const whereCondition = {
                        week_number: timetable.week_number,
                        from_year: timetable.from_year
                    };

                    const existingTimetable = await prisma.edt_index.findUnique({
                        where: whereCondition
                    });

                    let selectedTimeTable;
                    if (existingTimetable) {
                        if (isOutDated(existingTimetable.last_updated, timetable.last_updated)){
                            selectedTimeTable = await prisma.edt_index.update({
                                where: { id: existingTimetable.id },
                                data: {
                                    link: timetable.link,
                                    last_updated: new Date(timetable.last_updated),
                                    week_number: timetable.week_number,
                                    from_year: timetable.from_year
                                },
                            });
                        } else { continue timeTableLoop }
                    } else {
                        selectedTimeTable = await prisma.edt_index.create({
                            data: {
                                link: timetable.link,
                                last_updated: new Date(timetable.last_updated),
                                week_number: timetable.week_number,
                                from_year: timetable.from_year
                            }
                        });
                    }
                    const timeTableID = selectedTimeTable.id


                // Process each lesson in the timetable
                for (const lesson of timetable.lessons) {
                    
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




                    currentLessonNum += 1;
                }
            }
        }


    } catch (err) {

    }

    

    /*
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
}*/