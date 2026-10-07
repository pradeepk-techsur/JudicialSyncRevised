-- CreateEnum
CREATE TYPE "role_type" AS ENUM ('JUDGE', 'CHAMBERS_STAFF', 'DEPUTY', 'CLERK', 'ATTORNEY', 'ADMIN');

-- CreateEnum
CREATE TYPE "offering_party" AS ENUM ('PLAINTIFF', 'PROSECUTION', 'DEFENSE');

-- CreateEnum
CREATE TYPE "exhibit_status" AS ENUM ('MARKED', 'OFFERED', 'OBJECTED', 'ADMITTED', 'EXCLUDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "objection_status" AS ENUM ('UNRESOLVED', 'SUSTAINED', 'OVERRULED');

-- CreateEnum
CREATE TYPE "event_type" AS ENUM ('STATUS_CHANGE', 'OBJECTION_RAISED', 'RULING_RECORDED', 'CUSTODY_TRANSFER', 'DISCREPANCY_ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "court" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "role_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibits" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "exhibit_label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "offering_party" "offering_party" NOT NULL,
    "associated_witness" TEXT,
    "is_sealed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exhibits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibit_events" (
    "id" TEXT NOT NULL,
    "exhibit_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "event_type" "event_type" NOT NULL,
    "payload" JSONB NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exhibit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibit_current_state" (
    "exhibit_id" TEXT NOT NULL,
    "current_status" "exhibit_status" NOT NULL,
    "last_status_event_id" TEXT NOT NULL,
    "last_status_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exhibit_current_state_pkey" PRIMARY KEY ("exhibit_id")
);

-- CreateTable
CREATE TABLE "objection_current_state" (
    "objection_id" TEXT NOT NULL,
    "exhibit_id" TEXT NOT NULL,
    "status" "objection_status" NOT NULL DEFAULT 'UNRESOLVED',
    "objecting_party" "offering_party" NOT NULL,
    "grounds" TEXT NOT NULL,
    "raised_event_id" TEXT NOT NULL,
    "raised_at" TIMESTAMP(3) NOT NULL,
    "ruling_event_id" TEXT,
    "ruled_at" TIMESTAMP(3),

    CONSTRAINT "objection_current_state_pkey" PRIMARY KEY ("objection_id")
);

-- CreateTable
CREATE TABLE "custody_current_state" (
    "exhibit_id" TEXT NOT NULL,
    "current_custodian_user_id" TEXT NOT NULL,
    "since" TIMESTAMP(3) NOT NULL,
    "last_event_id" TEXT NOT NULL,

    CONSTRAINT "custody_current_state_pkey" PRIMARY KEY ("exhibit_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cases_case_number_key" ON "cases"("case_number");

-- CreateIndex
CREATE INDEX "users_case_id_role_idx" ON "users"("case_id", "role");

-- CreateIndex
CREATE INDEX "exhibits_case_id_idx" ON "exhibits"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "exhibits_case_id_exhibit_label_key" ON "exhibits"("case_id", "exhibit_label");

-- CreateIndex
CREATE INDEX "exhibit_events_exhibit_id_recorded_at_idx" ON "exhibit_events"("exhibit_id", "recorded_at");

-- CreateIndex
CREATE INDEX "exhibit_events_case_id_event_type_recorded_at_idx" ON "exhibit_events"("case_id", "event_type", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "exhibit_events_exhibit_id_sequence_no_key" ON "exhibit_events"("exhibit_id", "sequence_no");

-- CreateIndex
CREATE INDEX "objection_current_state_exhibit_id_status_idx" ON "objection_current_state"("exhibit_id", "status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibits" ADD CONSTRAINT "exhibits_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibit_events" ADD CONSTRAINT "exhibit_events_exhibit_id_fkey" FOREIGN KEY ("exhibit_id") REFERENCES "exhibits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibit_events" ADD CONSTRAINT "exhibit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibit_current_state" ADD CONSTRAINT "exhibit_current_state_exhibit_id_fkey" FOREIGN KEY ("exhibit_id") REFERENCES "exhibits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objection_current_state" ADD CONSTRAINT "objection_current_state_exhibit_id_fkey" FOREIGN KEY ("exhibit_id") REFERENCES "exhibits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_current_state" ADD CONSTRAINT "custody_current_state_exhibit_id_fkey" FOREIGN KEY ("exhibit_id") REFERENCES "exhibits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_current_state" ADD CONSTRAINT "custody_current_state_current_custodian_user_id_fkey" FOREIGN KEY ("current_custodian_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
