const code_main_group = {
    '-1': 'A1',
    '-2': 'A2',
    '-3': 'A3',
    '1': 'G1',
    '2': 'G2',
    '3': 'G3',
    '4': 'G4',
    '5': 'G5',
    '6': 'G6',
    '7': 'G7',
    '8': 'G8',
}

const code_sub_group = {
    '-1': null,
    '0': 'A',
    '1': 'B'
}


async function format_room_info(name, room) {
    if (room == null) {
        room = '`' + name + ' ✅ - Disponible' + '`'
    }
    else if (room.length > 1) {
        room = '`' + name + ' ❌ - Occupée' + '`'
    } else if (room.length == 1) {
        room = room[0];
        room.main_group = code_main_group[room.main_group] ?? room.main_group;
        room.sub_group = code_sub_group[room.sub_group] ?? '';
        room = '`' + name +' ❌ - ' + room.code + ' (' + room.teacher_name + ') (' + room.main_group + room.sub_group + ')' + '`'
    }
    return room;
}



async function create_fields(rooms) {
    // Separate rooms by floor
    const RDC = [];
    const E1 = [];
    const E2 = [];
    const Amph = [];

    for (const room of Object.keys(rooms)) {

        let room_info = await format_room_info(room, rooms[room]);

        if (room.startsWith('R')) {
            RDC.push(room_info);
        } else if (room.startsWith('1')) {
            E1.push(room_info);
        } else if (room.startsWith('2')) {
            E2.push(room_info);
        } else if (room.startsWith('A')) {
            Amph.push(room_info);
        }
    }

    const embedFields = [
        { name: 'RDC', value: RDC.join('\n'), inline: true },
        { name: '1er étage', value: E1.join('\n'), inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '2ème étage', value: E2.join('\n'), inline: true },
        { name: 'Amphithéâtres', value: Amph.join('\n'), inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
    ];
    return embedFields;

}

module.exports = {
    create_fields
}