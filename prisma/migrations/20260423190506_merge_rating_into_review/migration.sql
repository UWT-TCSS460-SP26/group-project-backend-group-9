/*
  Warnings:

  - You are about to drop the `Rating` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,tmdbId,mediaType]` on the table `Review` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `score` to the `Review` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_userId_fkey";

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "score" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Rating";

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_tmdbId_mediaType_key" ON "Review"("userId", "tmdbId", "mediaType");
