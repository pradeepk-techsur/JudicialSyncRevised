-- AlterTable
ALTER TABLE "jury_packages" ADD COLUMN     "finalization_requested_at" TIMESTAMP(3),
ADD COLUMN     "finalization_requested_by" TEXT;
