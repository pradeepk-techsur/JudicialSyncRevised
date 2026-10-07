-- DropIndex
DROP INDEX "assistant_messages_conversation_id_created_at_idx";

-- AlterTable
ALTER TABLE "assistant_messages" ADD COLUMN     "seq" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "assistant_messages_conversation_id_created_at_seq_idx" ON "assistant_messages"("conversation_id", "created_at", "seq");
