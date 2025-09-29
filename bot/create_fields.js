// Module for formatting room availability data into Discord embed fields
// Handles room status display and organizing rooms by building floors

// Mapping for main academic groups and years
// Negative values represent academic years (A1, A2, A3)
// Positive values represent specific student groups (G1-G8)
const code_main_group = {
    '-1': 'A1', // First year students
    '-2': 'A2', // Second year students
    '-3': 'A3', // Third year students
    '1': 'G1',  // Student group 1
    '2': 'G2',  // Student group 2
    '3': 'G3',  // Student group 3
    '4': 'G4',  // Student group 4
    '5': 'G5',  // Student group 5
    '6': 'G6',  // Student group 6 (if exists)
    '7': 'G7',  // Student group 7
    '8': 'G8',  // Student group 8
}

// Mapping for sub-groups within main groups
const code_sub_group = {
    '-1': null, // No sub-group for academic years
    '0': 'A',   // Sub-group A
    '1': 'B'    // Sub-group B
}


/**
 * Format room information for Discord display based on availability status
 * @param {string} name - Room name/identifier
 * @param {null|Array} room - Room data (null if available, array of lessons if occupied)
 * @returns {Promise<string>} Formatted room status string for Discord embed
 */
async function format_room_info(name, room) {
    // Room is available (no lessons scheduled)
    if (room == null) {
        room = '`' + name + ' ✅ - Disponible' + '`'
    }
    // Room has multiple lessons (complex schedule)
    else if (room.length > 1) {
        room = '`' + name + ' ❌ - Occupée' + '`'
    } 
    // Room has exactly one lesson (show detailed info)
    else if (room.length == 1) {
        room = room[0];
        // Convert group codes to readable format
        room.main_group = code_main_group[room.main_group] ?? room.main_group;
        room.sub_group = code_sub_group[room.sub_group] ?? '';
        // Format: "Room ❌ - SubjectCode (Teacher) (Group)"
        room = '`' + name +' ❌ - ' + room.code + ' (' + room.teacher_name + ') (' + room.main_group + room.sub_group + ')' + '`'
    }
    return room;
}


/**
 * Create Discord embed fields organized by building floors
 * Processes room availability data and groups by location for better UX
 * @param {Object} rooms - Room availability data (room name -> lesson data or null)
 * @returns {Promise<Array>} Array of Discord embed field objects organized by floor
 */
async function create_fields(rooms) {
    // Initialize arrays for each building floor/area
    const RDC = [];   // Ground floor (Rez-de-chaussée) - rooms starting with 'R'
    const E1 = [];    // First floor (1er étage) - rooms starting with '1'
    const E2 = [];    // Second floor (2ème étage) - rooms starting with '2'
    const Amph = [];  // Amphitheaters - rooms starting with 'A'

    // Process each room and categorize by floor based on naming convention
    for (const room of Object.keys(rooms)) {

        // Format room information for display
        let room_info = await format_room_info(room, rooms[room]);

        // Categorize rooms by floor based on first character of room name
        if (room.startsWith('R')) {
            RDC.push(room_info);   // Ground floor rooms (R46, R50, etc.)
        } else if (room.startsWith('1')) {
            E1.push(room_info);    // First floor rooms (103, 104, etc.)
        } else if (room.startsWith('2')) {
            E2.push(room_info);    // Second floor rooms (208, 209, etc.)
        } else if (room.startsWith('A')) {
            Amph.push(room_info);  // Amphitheaters (AmphA, AmphB, etc.)
        }
    }

    // Create Discord embed fields with organized room data
    // Uses inline layout for compact display, with invisible spacers for formatting
    const embedFields = [
        { name: 'RDC', value: RDC.join('\n'), inline: true },           // Ground floor column
        { name: '1er étage', value: E1.join('\n'), inline: true },      // First floor column
        { name: '\u200B', value: '\u200B', inline: true },              // Invisible spacer for layout
        { name: '2ème étage', value: E2.join('\n'), inline: true },     // Second floor column
        { name: 'Amphithéâtres', value: Amph.join('\n'), inline: true }, // Amphitheaters column
        { name: '\u200B', value: '\u200B', inline: true },              // Invisible spacer for layout
    ];
    return embedFields;

}

// Export the main function for creating formatted Discord embed fields
module.exports = {
    create_fields
}