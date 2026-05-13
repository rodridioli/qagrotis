-- CreateTable
CREATE TABLE "ClockworkIntegration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "apiToken" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClockworkIntegration_pkey" PRIMARY KEY ("id")
);
