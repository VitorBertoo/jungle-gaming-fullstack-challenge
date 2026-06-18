-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "balance_in_cents" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_player_id_key" ON "wallets"("player_id");
