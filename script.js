const { YEARS, getTimetableEntries } = require('edt-iut-info-limoges');


const liste_salles = {
    "R46": ["R46"],
    "R50": ["R50"],
    "R51": ["R51"],
    "R52": ["R52"],
    "103": ["103"],
    "104": ["104"],
    "105": ["105"],
    "108": ["108"],
    "109": ["109"],
    "111": ["111"],
    "112": ["112"],
    "104-5": ["104", "105"],
    "108-9": ["108", "109"],
    "111-2": ["111", "112"],
    "205": ["205"],
    "206": ["206"],
    "208": ["208"],
    "209": ["209"],
    ".": ["."],
};


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


// Récupération de l'état de toutes les salles à une date/heure spécifique
async function get_all_rooms_availability(startTime, endTime) {
    // Récupération des emplois du temps des trois années
    const timeTablesEntry = await get_all_tables();

    // Initialisation de l'état des salles
    const roomStatus = {};


    for (const rooms of Object.keys(liste_salles)) {
        for (const room of liste_salles[rooms]) {
            roomStatus[room] = true;
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
                        if (rooms.includes(room)) {
                            roomStatus[room] = false;
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
