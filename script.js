const { YEARS, getTimetableEntries } = require('edt-iut-info-limoges');
const fs = require('fs');
const path = require('path');


// Récupération de tous les emplois du temps
async function get_all_tables() {
    const timeTablesA1Entry = await getTimetableEntries(YEARS.A1);
    const timeTablesA2Entry = await getTimetableEntries(YEARS.A2);
    const timeTablesA3Entry = await getTimetableEntries(YEARS.A3);
    const timeTablesEntry = timeTablesA1Entry.concat(timeTablesA2Entry, timeTablesA3Entry);

    return timeTablesEntry;
}


// Récupération de toutes les salles (uniques) utilisées dans les emplois du temps
async function get_all_rooms() {

    const timeTablesEntry = await get_all_tables();

    const rooms = [];

    for (const timeTableEntry of timeTablesEntry) {
        const timeTable = await timeTableEntry.getTimetable();
        for (const lesson of timeTable.lessons) {
            const room = lesson.content.room;

            if (!(room in rooms)) {
                rooms[room] = true;
            }
        }
    }


    return rooms;
}

async function update_prof() {
    const timeTablesEntry = await get_all_tables();
    const profs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/profs.json'), 'utf8'));

    for (const timeTableEntry of timeTablesEntry) {
        const timeTable = await timeTableEntry.getTimetable();
        for (const lesson of timeTable.lessons) {
            const teacher = lesson.content.teacher;
            if (!(teacher in profs || (teacher[0] === "G" && Number(teacher[1])) || teacher[0] === '.')) {
                profs.push(teacher);
            }
        }
    }

    fs.writeFileSync(path.join(__dirname, 'data/profs.json'), JSON.stringify(profs, null, 2));
}



// Récupération de l'état de toutes les salles à une date/heure spécifique
async function get_all_rooms_availability(startTime, endTime, prof=null) {
    // Récupération des emplois du temps des trois années

    const liste_salles = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/rooms.json'), 'utf8'));
    const groupes = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/groupes.json'), 'utf8'));

    const timeTablesEntry = await get_all_tables();

    // Initialisation de l'état des salles
    const roomStatus = {};


    for (const rooms of Object.keys(liste_salles)) {
        for (const room of liste_salles[rooms]) {
            roomStatus[room] = {};
        }
    }

    // Parcours de tous les emplois du temps
    for (const timeTableEntry of timeTablesEntry) {
        const timeTable = await timeTableEntry.getTimetable();
        for (const lesson of timeTable.lessons) {
            const lessonStart = new Date(lesson.start_date);
            const lessonEnd = new Date(lesson.end_date);

            const room = lesson.content.room.toString();

            // Vérifier si la date/heure spécifiée est pendant le cours
            if (lessonStart < endTime && lessonEnd > startTime) {

                // Si la salle est dans la liste des salles à vérifier
                for (const roomKey of Object.keys(liste_salles)) {
                    for (const rooms of liste_salles[roomKey]) {
                        console.log(lesson.content.teacher, prof)
                        if (roomKey == room && (!prof || lesson.content.teacher == prof)) {
                            roomStatus[room] = {
                                isAvailable: false,
                                lesson: {
                                    type: lesson.content.type,
                                    teacher: lesson.content.teacher,
                                    group: `G${lesson.group.main}${lesson.group.sub ? `${groupes[lesson.group.sub]}` : ''}`,
                                },
                            };
                        }
                    }
                }
            }
        }
    }

    // Renvoi de l'état des salles
    return roomStatus;
}



module.exports = {
    get_all_rooms_availability,
};