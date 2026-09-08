import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1788887305876 implements MigrationInterface {
    name = 'Initial1788887305876'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."room_kind_enum" AS ENUM('salle', 'amphi')`);
        await queryRunner.query(`CREATE TABLE "room" ("id" SERIAL NOT NULL, "name" character varying(20) NOT NULL, "floor" smallint NOT NULL, "kind" "public"."room_kind_enum" NOT NULL DEFAULT 'salle', "display_order" smallint NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_535c742a3606d2e3122f441b26c" UNIQUE ("name"), CONSTRAINT "PK_c6d46db005d623e691b2fbcba23" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2f9d781f5281ee51350befd719" ON "room"  ("display_order") `);
        await queryRunner.query(`CREATE TABLE "subject" ("id" SERIAL NOT NULL, "code" character varying(20) NOT NULL, "label" character varying(150) NOT NULL, CONSTRAINT "UQ_92374adc6b583e8cf659977e489" UNIQUE ("code"), CONSTRAINT "PK_12eee115462e38d62e5455fc054" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "teacher" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, CONSTRAINT "UQ_55be152c2c710d5939dae9a86aa" UNIQUE ("name"), CONSTRAINT "PK_2f807294148612a9751dacf1026" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."lesson_type_enum" AS ENUM('CM', 'TD', 'TP', 'OTHER')`);
        await queryRunner.query(`CREATE TABLE "lesson" ("id" SERIAL NOT NULL, "dedup_key" character varying(40) NOT NULL, "start_utc" TIMESTAMP WITH TIME ZONE NOT NULL, "end_utc" TIMESTAMP WITH TIME ZONE NOT NULL, "type" "public"."lesson_type_enum" NOT NULL, "raw_content" character varying(255) NOT NULL, "subject_id" integer NOT NULL, "teacher_id" integer, CONSTRAINT "UQ_b060bc162689e0b8b983e9193a2" UNIQUE ("dedup_key"), CONSTRAINT "PK_0ef25918f0237e68696dee455bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c33dbe749cbb4506c098ae9e93" ON "lesson"  ("start_utc", "end_utc") `);
        await queryRunner.query(`CREATE TYPE "public"."student_group_year_enum" AS ENUM('A1', 'A2', 'A3')`);
        await queryRunner.query(`CREATE TABLE "student_group" ("id" SERIAL NOT NULL, "code" character varying(10) NOT NULL, "year" "public"."student_group_year_enum" NOT NULL, "main_group" smallint NOT NULL, "sub_group" character varying(2), CONSTRAINT "UQ_3609c5b82be95c3be931d5ddf32" UNIQUE ("code"), CONSTRAINT "PK_1bd5a468c54488b86d50a117f15" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e8f7a7d0bc54b5a564fffffced" ON "student_group"  ("year") `);
        await queryRunner.query(`CREATE TABLE "lesson_group" ("lesson_id" integer NOT NULL, "group_id" integer NOT NULL, "source_id" integer NOT NULL, CONSTRAINT "PK_339512362cf7756cf2f5c65e6d3" PRIMARY KEY ("lesson_id", "group_id", "source_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b33c995745368fff8c0a142411" ON "lesson_group"  ("source_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8eab14b67feaf09d4239f7d500" ON "lesson_group"  ("group_id") `);
        await queryRunner.query(`CREATE TYPE "public"."edt_source_year_enum" AS ENUM('A1', 'A2', 'A3')`);
        await queryRunner.query(`CREATE TYPE "public"."edt_source_format_enum" AS ENUM('pdf', 'ics')`);
        await queryRunner.query(`CREATE TABLE "edt_source" ("id" SERIAL NOT NULL, "year" "public"."edt_source_year_enum" NOT NULL, "scope" character varying(10) NOT NULL, "week_number" smallint NOT NULL, "format" "public"."edt_source_format_enum" NOT NULL, "url" text NOT NULL, "etag" character varying(128), "last_modified" character varying(64), "content_hash" character varying(40), "backup_path" text, "fetched_at" TIMESTAMP WITH TIME ZONE, "imported_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "edt_source_unique" UNIQUE ("scope", "week_number", "format"), CONSTRAINT "PK_9612accde9a838f4c8f138f7ded" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_529e4f6ad7e96ee0c2197a85fb" ON "edt_source"  ("year") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "discord_id" bigint NOT NULL, "name" character varying(100), "global_name" character varying(100), CONSTRAINT "UQ_ecb6461da358b6d8a4f83d611a0" UNIQUE ("discord_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "requests" ("id" SERIAL NOT NULL, "request_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "request_text" text NOT NULL, "user_id" integer NOT NULL, CONSTRAINT "PK_0428f484e96f9e6a55955f29b5f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9e5e2eb56e3837b43e5a547be2" ON "requests"  ("user_id") `);
        await queryRunner.query(`CREATE TABLE "lesson_room" ("lesson_id" integer NOT NULL, "room_id" integer NOT NULL, CONSTRAINT "PK_121725ff7f1591488e2b05b7a16" PRIMARY KEY ("lesson_id", "room_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b347d1e61e4a47c77b9539c3a0" ON "lesson_room"  ("lesson_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a15cb2bc22939c339fcba6bd48" ON "lesson_room"  ("room_id") `);
        await queryRunner.query(`ALTER TABLE "lesson" ADD CONSTRAINT "FK_aeaae22f4d629e1df4e54ca9695" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson" ADD CONSTRAINT "FK_cfe1b52c46b3d6f61ad5be1663c" FOREIGN KEY ("teacher_id") REFERENCES "teacher"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_group" ADD CONSTRAINT "FK_0bfd78e7229d01a6b7d9e0eb4ce" FOREIGN KEY ("lesson_id") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_group" ADD CONSTRAINT "FK_8eab14b67feaf09d4239f7d500d" FOREIGN KEY ("group_id") REFERENCES "student_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_group" ADD CONSTRAINT "FK_b33c995745368fff8c0a1424117" FOREIGN KEY ("source_id") REFERENCES "edt_source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requests" ADD CONSTRAINT "FK_9e5e2eb56e3837b43e5a547be23" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_room" ADD CONSTRAINT "FK_b347d1e61e4a47c77b9539c3a00" FOREIGN KEY ("lesson_id") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "lesson_room" ADD CONSTRAINT "FK_a15cb2bc22939c339fcba6bd481" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lesson_room" DROP CONSTRAINT "FK_a15cb2bc22939c339fcba6bd481"`);
        await queryRunner.query(`ALTER TABLE "lesson_room" DROP CONSTRAINT "FK_b347d1e61e4a47c77b9539c3a00"`);
        await queryRunner.query(`ALTER TABLE "requests" DROP CONSTRAINT "FK_9e5e2eb56e3837b43e5a547be23"`);
        await queryRunner.query(`ALTER TABLE "lesson_group" DROP CONSTRAINT "FK_b33c995745368fff8c0a1424117"`);
        await queryRunner.query(`ALTER TABLE "lesson_group" DROP CONSTRAINT "FK_8eab14b67feaf09d4239f7d500d"`);
        await queryRunner.query(`ALTER TABLE "lesson_group" DROP CONSTRAINT "FK_0bfd78e7229d01a6b7d9e0eb4ce"`);
        await queryRunner.query(`ALTER TABLE "lesson" DROP CONSTRAINT "FK_cfe1b52c46b3d6f61ad5be1663c"`);
        await queryRunner.query(`ALTER TABLE "lesson" DROP CONSTRAINT "FK_aeaae22f4d629e1df4e54ca9695"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a15cb2bc22939c339fcba6bd48"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b347d1e61e4a47c77b9539c3a0"`);
        await queryRunner.query(`DROP TABLE "lesson_room"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e5e2eb56e3837b43e5a547be2"`);
        await queryRunner.query(`DROP TABLE "requests"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_529e4f6ad7e96ee0c2197a85fb"`);
        await queryRunner.query(`DROP TABLE "edt_source"`);
        await queryRunner.query(`DROP TYPE "public"."edt_source_format_enum"`);
        await queryRunner.query(`DROP TYPE "public"."edt_source_year_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8eab14b67feaf09d4239f7d500"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b33c995745368fff8c0a142411"`);
        await queryRunner.query(`DROP TABLE "lesson_group"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e8f7a7d0bc54b5a564fffffced"`);
        await queryRunner.query(`DROP TABLE "student_group"`);
        await queryRunner.query(`DROP TYPE "public"."student_group_year_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c33dbe749cbb4506c098ae9e93"`);
        await queryRunner.query(`DROP TABLE "lesson"`);
        await queryRunner.query(`DROP TYPE "public"."lesson_type_enum"`);
        await queryRunner.query(`DROP TABLE "teacher"`);
        await queryRunner.query(`DROP TABLE "subject"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2f9d781f5281ee51350befd719"`);
        await queryRunner.query(`DROP TABLE "room"`);
        await queryRunner.query(`DROP TYPE "public"."room_kind_enum"`);
    }

}
