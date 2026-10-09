-- CreateEnum
CREATE TYPE "jury_package_exhibit_status" AS ENUM ('INCLUDED', 'EXCLUDED');

-- AlterEnum
ALTER TYPE "event_type" ADD VALUE 'JURY_PACKAGE_EXHIBIT_EXCLUDED';

-- AlterTable
ALTER TABLE "jury_package_exhibits" ADD COLUMN     "excluded_at" TIMESTAMP(3),
ADD COLUMN     "excluded_by" TEXT,
ADD COLUMN     "exclusion_reason" TEXT,
ADD COLUMN     "status" "jury_package_exhibit_status" NOT NULL DEFAULT 'INCLUDED';

-- CreateIndex
CREATE INDEX "idx_jury_package_exhibits_package_status" ON "jury_package_exhibits"("jury_package_id", "status");

-- AddForeignKey
ALTER TABLE "jury_package_exhibits" ADD CONSTRAINT "jury_package_exhibits_excluded_by_fkey" FOREIGN KEY ("excluded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
