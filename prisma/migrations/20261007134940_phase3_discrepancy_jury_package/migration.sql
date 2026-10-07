-- CreateEnum
CREATE TYPE "discrepancy_status" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "jury_package_status" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "jury_exhibit_discrepancy_status" AS ENUM ('CLEAN', 'FLAGGED');

-- CreateTable
CREATE TABLE "discrepancy_flags" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "exhibit_id" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "status" "discrepancy_status" NOT NULL DEFAULT 'OPEN',
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB NOT NULL,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "acknowledged_event_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_event_id" TEXT,

    CONSTRAINT "discrepancy_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jury_packages" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "status" "jury_package_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized_at" TIMESTAMP(3),
    "finalized_by" TEXT,

    CONSTRAINT "jury_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jury_package_exhibits" (
    "id" TEXT NOT NULL,
    "jury_package_id" TEXT NOT NULL,
    "exhibit_id" TEXT NOT NULL,
    "discrepancy_status" "jury_exhibit_discrepancy_status" NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jury_package_exhibits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_discrepancy_flags_case_status" ON "discrepancy_flags"("case_id", "status");

-- CreateIndex
CREATE INDEX "idx_discrepancy_flags_exhibit_rule" ON "discrepancy_flags"("exhibit_id", "rule_code");

-- CreateIndex
CREATE INDEX "idx_jury_packages_case_status" ON "jury_packages"("case_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_jury_package_exhibit" ON "jury_package_exhibits"("jury_package_id", "exhibit_id");

-- AddForeignKey
ALTER TABLE "discrepancy_flags" ADD CONSTRAINT "discrepancy_flags_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancy_flags" ADD CONSTRAINT "discrepancy_flags_exhibit_id_fkey" FOREIGN KEY ("exhibit_id") REFERENCES "exhibits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancy_flags" ADD CONSTRAINT "discrepancy_flags_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancy_flags" ADD CONSTRAINT "discrepancy_flags_acknowledged_event_id_fkey" FOREIGN KEY ("acknowledged_event_id") REFERENCES "exhibit_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrepancy_flags" ADD CONSTRAINT "discrepancy_flags_resolved_by_event_id_fkey" FOREIGN KEY ("resolved_by_event_id") REFERENCES "exhibit_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jury_packages" ADD CONSTRAINT "jury_packages_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jury_packages" ADD CONSTRAINT "jury_packages_finalized_by_fkey" FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jury_package_exhibits" ADD CONSTRAINT "jury_package_exhibits_jury_package_id_fkey" FOREIGN KEY ("jury_package_id") REFERENCES "jury_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jury_package_exhibits" ADD CONSTRAINT "jury_package_exhibits_exhibit_id_fkey" FOREIGN KEY ("exhibit_id") REFERENCES "exhibits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
