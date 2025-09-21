require("dotenv").config();
const { PrismaClient } = require("@prisma/client");





async function get_info_about(roomName, startTime, endTime) {

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    const prisma = new PrismaClient();

    const roomInfo = await prisma.lesson.findMany({
        where: {
            room: {
                name: roomName
            },
            AND: [
                {
                    start_datetime: {
                        lt: endDate.toISOString()
                    }
                },
                {
                    end_datetime: {
                        gt: startDate.toISOString()
                    }
                }
            ]
        },
        include: {
            room: true,
            content: true,
            teacher: true,
            lesson_group: {
                include: {
                    group: true
                }
            }
        },
        orderBy: {
            room: {
                name: 'asc'
            }
        }
    });

    // Transform result to match previous SQL output
    return roomInfo.map(l => ({
        salle: l.room?.name,
        type: l.type,
        start_datetime: l.start_datetime,
        end_datetime: l.end_datetime,
        code: l.content?.code,
        content_name: l.content?.name,
        teacher_name: l.teacher?.name,
        main_group: l.lesson_group[0]?.group?.main_group,
        sub_group: l.lesson_group[0]?.group?.sub_group
    }));
}



async function rooms_availability(startTime, endTime) {

    const start = startTime.toISOString();
    const end = endTime.toISOString();

    const prisma = new PrismaClient();
    const allRooms = await prisma.room.findMany({
        select: {
            name: true
        }
    });
    const roomNames = allRooms.map(r => r.name);


    const roomInUse = {}
    for (const roomName of roomNames) {
        const info = await get_info_about(roomName, start, end);
        roomInUse[roomName] = info.length > 0 ? info : null;
    }

    return roomInUse;
}


module.exports = { rooms_availability };