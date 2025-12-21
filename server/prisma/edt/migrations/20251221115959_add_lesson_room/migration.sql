/*
  Warnings:

  - You are about to drop the column `room_id` on the `lesson` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[type,start_datetime,end_datetime,content_id,teacher_id,edt_id]` on the table `lesson` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `lesson` DROP FOREIGN KEY `lesson_ibfk_2`;

-- DropForeignKey
ALTER TABLE `lesson_group` DROP FOREIGN KEY `lesson_group_ibfk_1`;

-- DropIndex
DROP INDEX `lesson_type_start_datetime_end_datetime_content_id_room_id_t_key` ON `lesson`;

-- DropIndex
DROP INDEX `room_id` ON `lesson`;

-- AlterTable
ALTER TABLE `lesson` DROP COLUMN `room_id`;

-- CreateTable
CREATE TABLE `lesson_room` (
    `lesson_id` INTEGER NOT NULL,
    `room_id` INTEGER NOT NULL,

    INDEX `lesson_room_room_id`(`room_id`),
    PRIMARY KEY (`lesson_id`, `room_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `lesson_type_start_datetime_end_datetime_content_id_teacher_i_key` ON `lesson`(`type`, `start_datetime`, `end_datetime`, `content_id`, `teacher_id`, `edt_id`);

-- AddForeignKey
ALTER TABLE `lesson_group` ADD CONSTRAINT `lesson_group_ibfk_1` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `lesson_room` ADD CONSTRAINT `lesson_room_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `lesson_room` ADD CONSTRAINT `lesson_room_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
