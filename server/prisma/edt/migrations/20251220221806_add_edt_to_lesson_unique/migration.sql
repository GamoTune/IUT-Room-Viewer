-- CreateTable
CREATE TABLE `content` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `content_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(10) NOT NULL,
    `start_datetime` DATETIME(0) NOT NULL,
    `end_datetime` DATETIME(0) NOT NULL,
    `content_id` INTEGER NOT NULL,
    `room_id` INTEGER NULL,
    `teacher_id` INTEGER NULL,
    `edt_id` INTEGER NULL,

    INDEX `content_id`(`content_id`),
    INDEX `room_id`(`room_id`),
    INDEX `teacher_id`(`teacher_id`),
    INDEX `lesson_edt_index_id_fk`(`edt_id`),
    UNIQUE INDEX `lesson_type_start_datetime_end_datetime_content_id_room_id_t_key`(`type`, `start_datetime`, `end_datetime`, `content_id`, `room_id`, `teacher_id`, `edt_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson_group` (
    `lesson_id` INTEGER NOT NULL,
    `group_id` INTEGER NOT NULL,

    INDEX `group_id`(`group_id`),
    PRIMARY KEY (`lesson_id`, `group_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(20) NOT NULL,

    UNIQUE INDEX `room_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_group` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `main_group` INTEGER NOT NULL,
    `sub_group` INTEGER NOT NULL,

    UNIQUE INDEX `student_group_main_group_sub_group_key`(`main_group`, `sub_group`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NULL,

    UNIQUE INDEX `teacher_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `edt_index` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `link` TEXT NOT NULL,
    `last_updated` DATETIME(0) NOT NULL,
    `week_number` INTEGER NOT NULL,
    `from_year` TINYTEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lesson` ADD CONSTRAINT `lesson_edt_index_id_fk` FOREIGN KEY (`edt_id`) REFERENCES `edt_index`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lesson` ADD CONSTRAINT `lesson_ibfk_1` FOREIGN KEY (`content_id`) REFERENCES `content`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `lesson` ADD CONSTRAINT `lesson_ibfk_2` FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `lesson` ADD CONSTRAINT `lesson_ibfk_3` FOREIGN KEY (`teacher_id`) REFERENCES `teacher`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `lesson_group` ADD CONSTRAINT `lesson_group_ibfk_1` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `lesson_group` ADD CONSTRAINT `lesson_group_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `student_group`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
