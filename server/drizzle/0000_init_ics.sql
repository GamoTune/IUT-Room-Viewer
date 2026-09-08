CREATE TYPE "public"."lesson_type" AS ENUM('CM', 'TD', 'TP', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."room_kind" AS ENUM('salle', 'amphi');--> statement-breakpoint
CREATE TYPE "public"."year" AS ENUM('A1', 'A2', 'A3');--> statement-breakpoint
CREATE TABLE "ics_source" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ics_source_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"year" "year" NOT NULL,
	"group_code" varchar(10) NOT NULL,
	"week_number" smallint NOT NULL,
	"url" text NOT NULL,
	"etag" varchar(128),
	"last_modified" varchar(64),
	"content_hash" varchar(40),
	"backup_path" text,
	"fetched_at" timestamp with time zone,
	"imported_at" timestamp with time zone,
	CONSTRAINT "ics_source_unique" UNIQUE("year","group_code","week_number")
);
--> statement-breakpoint
CREATE TABLE "lesson" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lesson_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"dedup_key" varchar(40) NOT NULL,
	"start_utc" timestamp with time zone NOT NULL,
	"end_utc" timestamp with time zone NOT NULL,
	"type" "lesson_type" NOT NULL,
	"subject_id" integer NOT NULL,
	"teacher_id" integer,
	"raw_summary" varchar(255) NOT NULL,
	CONSTRAINT "lesson_dedup_key_unique" UNIQUE("dedup_key")
);
--> statement-breakpoint
CREATE TABLE "lesson_group" (
	"lesson_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	CONSTRAINT "lesson_group_lesson_id_group_id_source_id_pk" PRIMARY KEY("lesson_id","group_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "lesson_room" (
	"lesson_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	CONSTRAINT "lesson_room_lesson_id_room_id_pk" PRIMARY KEY("lesson_id","room_id")
);
--> statement-breakpoint
CREATE TABLE "room" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "room_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(20) NOT NULL,
	"floor" smallint NOT NULL,
	"kind" "room_kind" DEFAULT 'salle' NOT NULL,
	"display_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "room_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "student_group" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "student_group_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(10) NOT NULL,
	"year" "year" NOT NULL,
	"main_group" smallint NOT NULL,
	"sub_group" varchar(2),
	CONSTRAINT "student_group_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subject" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subject_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(20) NOT NULL,
	"label" varchar(150) NOT NULL,
	CONSTRAINT "subject_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "teacher" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "teacher_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"initials" varchar(10) NOT NULL,
	"full_name" varchar(100),
	CONSTRAINT "teacher_initials_unique" UNIQUE("initials")
);
--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_teacher_id_teacher_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teacher"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_group" ADD CONSTRAINT "lesson_group_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_group" ADD CONSTRAINT "lesson_group_group_id_student_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."student_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_group" ADD CONSTRAINT "lesson_group_source_id_ics_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."ics_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_room" ADD CONSTRAINT "lesson_room_lesson_id_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_room" ADD CONSTRAINT "lesson_room_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_window" ON "lesson" USING btree ("start_utc","end_utc");--> statement-breakpoint
CREATE INDEX "lesson_group_group" ON "lesson_group" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "lesson_group_source" ON "lesson_group" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "lesson_room_room" ON "lesson_room" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "student_group_year" ON "student_group" USING btree ("year");