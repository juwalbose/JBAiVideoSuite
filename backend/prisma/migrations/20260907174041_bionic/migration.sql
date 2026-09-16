-- CreateTable
CREATE TABLE "LLMSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "modelName" TEXT NOT NULL,
    "temperature" REAL NOT NULL,
    "maxTokens" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "BackendSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiUrl" TEXT NOT NULL,
    "dbPath" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ComfyUISettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "deviceId" TEXT NOT NULL,
    "pollInterval" INTEGER NOT NULL DEFAULT 4000,
    "taskTTL" INTEGER NOT NULL DEFAULT 600
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'single',
    "duration" INTEGER NOT NULL DEFAULT 120,
    "episodeCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "episode" INTEGER NOT NULL DEFAULT 1,
    "narrativeArc" TEXT NOT NULL,
    "rawInput" TEXT,
    CONSTRAINT "Story_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Beat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "storyId" TEXT,
    "order" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    CONSTRAINT "Beat_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "episode" INTEGER NOT NULL DEFAULT 1,
    "beatId" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "characteristics" TEXT,
    "imagePath" TEXT,
    "prompt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT,
    "imagePath" TEXT,
    "characterSheet" TEXT,
    "scenes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetState_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "beatId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "cameraMovement" TEXT,
    "duration" REAL,
    "videoPath" TEXT,
    CONSTRAINT "Shot_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppActionMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "promptFile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ComfyWorkflowMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "workflowFile" TEXT,
    "resolutionJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "episode" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Script_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinalVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "totalDuration" REAL,
    "exportPath" TEXT,
    "thumbnailUrl" TEXT,
    CONSTRAINT "FinalVideo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "episode" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    "audioType" TEXT NOT NULL,
    "transcript" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AudioAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShotList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "episode" INTEGER NOT NULL DEFAULT 1,
    "shot" INTEGER NOT NULL,
    "scene" INTEGER NOT NULL DEFAULT 0,
    "beats" TEXT NOT NULL DEFAULT '[]',
    "loc" TEXT NOT NULL DEFAULT '',
    "subs" TEXT NOT NULL DEFAULT '',
    "frames" INTEGER NOT NULL,
    "duration" REAL NOT NULL,
    "camera" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "dialogue" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "locationAssetId" TEXT,
    "locationStateId" TEXT,
    "characterAssetIds" TEXT,
    "characterStateIds" TEXT,
    "propAssetIds" TEXT,
    "propStateIds" TEXT,
    "sceneDialogAudioId" TEXT,
    "characterAudioIds" TEXT,
    "characterAudioTypes" TEXT,
    "musicOn" BOOLEAN NOT NULL DEFAULT false,
    "musicDesc" TEXT NOT NULL DEFAULT '',
    "videoPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShotList_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Story_projectId_episode_key" ON "Story"("projectId", "episode");

-- CreateIndex
CREATE UNIQUE INDEX "AppActionMapping_action_key" ON "AppActionMapping"("action");

-- CreateIndex
CREATE UNIQUE INDEX "ComfyWorkflowMapping_action_key" ON "ComfyWorkflowMapping"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Script_projectId_episode_key" ON "Script"("projectId", "episode");

-- CreateIndex
CREATE UNIQUE INDEX "FinalVideo_projectId_key" ON "FinalVideo"("projectId");

-- CreateIndex
CREATE INDEX "Asset_projectId_episode_idx" ON "Asset"("projectId", "episode");

-- CreateIndex
CREATE INDEX "AudioAsset_projectId_episode_idx" ON "AudioAsset"("projectId", "episode");

-- CreateIndex
CREATE INDEX "ShotList_projectId_episode_idx" ON "ShotList"("projectId", "episode");
