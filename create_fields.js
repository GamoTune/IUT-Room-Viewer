async function create_fields(rooms) {
    // Préparer les données des salles
    const RDC = [];
    const E1 = [];
    const E2 = [];

    for (const [room, isAvailable] of Object.entries(rooms)) {
        const emoji = isAvailable ? '✅' : '❌';
        const roomDisplay = `${room} ${emoji}`;

        if (room.startsWith('1')) {
            E1.push(roomDisplay);
        } else if (room.startsWith('2')) {
            E2.push(roomDisplay);
        } else {
            RDC.push(roomDisplay);
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