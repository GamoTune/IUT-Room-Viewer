async function create_fields(rooms) {
    // Préparer les données des salles
    const RDC = [];
    const E1 = [];
    const E2 = [];

    var roomDisplay = '';

    for (const [room, data] of Object.entries(rooms)) {
        if (Object.keys(data).length > 0) {
            const emoji = data.isAvailable ? '✅' : '❌';
            const lesson = data.lesson.type;
            const teacher = data.lesson.teacher;
            const group = data.lesson.group;
            roomDisplay = `${room} ${emoji} - ${lesson} (${teacher}, ${group})`;
        } else {
            roomDisplay = `${room} ✅ - Disponible`;
        }

        if (room.startsWith('R')) {
            RDC.push(roomDisplay);
        } else if (room.startsWith('1')) {
            E1.push(roomDisplay);
        } else if (room.startsWith('2')) {
            E2.push(roomDisplay);
        }
    }

    // Si aucune salle n'est disponible
    if (RDC.length === 0 && E1.length === 0 && E2.length === 0) {
        return {};
    }

    // Préparer les champs pour l'embed
    const embedFields = [];
    if (RDC.length > 0) {
        embedFields.push({ name: 'RDC', value: RDC.join('\n'), inline: true });
    }
    if (E1.length > 0) {
        embedFields.push({ name: 'Premier étage', value: E1.join('\n'), inline: true });
    }
    if (E2.length > 0) {
        embedFields.push({ name: 'Deuxième étage', value: E2.join('\n'), inline: true });
    }

    return embedFields;
}

module.exports = {
    create_fields
}


