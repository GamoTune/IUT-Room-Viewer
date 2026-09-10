import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSaeLessonType1789032980000 implements MigrationInterface {
    name = 'AddSaeLessonType1789032980000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // `ALTER TYPE ... ADD VALUE` ne se réverse pas : on recrée le type, ce
        // qui laisse une descente possible.
        await queryRunner.query(`ALTER TYPE "public"."lesson_type_enum" RENAME TO "lesson_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."lesson_type_enum" AS ENUM('CM', 'TD', 'TP', 'SAE', 'OTHER')`);
        await queryRunner.query(
            `ALTER TABLE "lesson" ALTER COLUMN "type" TYPE "public"."lesson_type_enum" USING "type"::"text"::"public"."lesson_type_enum"`,
        );
        await queryRunner.query(`DROP TYPE "public"."lesson_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Les SAÉ étaient rangées en TD avant cette migration : on les y remet.
        await queryRunner.query(`UPDATE "lesson" SET "type" = 'TD' WHERE "type" = 'SAE'`);
        await queryRunner.query(`ALTER TYPE "public"."lesson_type_enum" RENAME TO "lesson_type_enum_new"`);
        await queryRunner.query(`CREATE TYPE "public"."lesson_type_enum" AS ENUM('CM', 'TD', 'TP', 'OTHER')`);
        await queryRunner.query(
            `ALTER TABLE "lesson" ALTER COLUMN "type" TYPE "public"."lesson_type_enum" USING "type"::"text"::"public"."lesson_type_enum"`,
        );
        await queryRunner.query(`DROP TYPE "public"."lesson_type_enum_new"`);
    }
}
