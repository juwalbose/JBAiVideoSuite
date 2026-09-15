# JBAiVideoSuite

> 📖 **Access detailed documentation:** [https://juwalbose.github.io/JBAiVideoSuite/](https://juwalbose.github.io/JBAiVideoSuite/)

An AI-powered video production pipeline that takes you from a raw story idea to a final video through five stages:

**Story → Script → Assets → Shot List → Final Video**

Built with Next.js (frontend), FastAPI (backend), Prisma + SQLite (database), and integrates with LM Studio (LLM) and ComfyUI (image/video generation).

- Vibe coded using Qwen 3.8 27B EXL3 3BPW locally on a 4070Ti (16GB VRAM)

---

## Features

- **Project Library** — Create, select, and manage multiple video projects
- **Story Stage** — Enter a raw story idea, generate a narrative arc via LLM
- **Script Stage** — Generate a full script from the story, refine dialog, extract cast
- **Assets Stage** — Manage Characters, Locations, and Props with states; generate image prompts; map generated images
- **Shot List Stage** — Generate a shot list from the script
- **Final Video** — Two sub-tabs:
  - **Generate Clips** — Per-shot video generation via ComfyUI (MinimaxH3 Ref2VA workflow). Editable prompt, asset previews (location/characters/props), audio players, seed + duration controls, low/high-res generation, save to shot
  - **Assemble Clips** — Full-width video preview (16:9), shot strip with thumbnails, play sequence (auto-advances through shots), export placeholder
- **Playground** — Run ComfyUI workflows with a visual gallery and input manager (image + audio inputs)
- **Chat Panel** — LLM chat with system prompt support
- **Settings** — Configure LLM, ComfyUI, backend, workflows, system prompts, app action mappings, and video resolution presets

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.12+ | Backend runtime |
| Node.js | 20+ | Frontend runtime |
| LM Studio | latest | Local LLM server (OpenAI-compatible API) |
| ComfyUI | latest | Image + video generation |

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/juwalbose/JBAiVideoSuite.git
cd JBAiVideoSuite
```

### 2. Set up the backend

```bash
cd backend

# Create a virtual environment
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install fastapi uvicorn prisma httpx pydantic python-multipart

# Generate the Prisma client
prisma generate

# Create the database
prisma db push
```

### 3. Set up the frontend

```bash
cd ../frontend

# Install dependencies
npm install
```

### 4. Configure settings

On first launch, the app will prompt you to configure:

- **Backend URL** — `http://127.0.0.1:8000` (default)
- **LM Studio** — IP, port, model name, temperature, max tokens
- **ComfyUI** — IP, port, device ID

You can also edit these in the **Settings** tab within the app.

### 5. Add system prompts (optional)

The app ships with default system prompts in `assets/systemprompts/`. You can add or edit them via the **Settings → System Prompts** tab, or drop `.txt` files into the folder.

### 6. Add ComfyUI workflows (optional)

Drop ComfyUI workflow JSON files into `assets/workflows/`. They will appear in the Playground and Settings → Workflows.

---

## Running the App

### Option A: One-click launcher (Windows)

Double-click `StartApp.bat` in the project root. This starts both the backend and frontend and opens the browser.

### Option B: Manual

**Terminal 1 — Backend:**

```bash
cd backend
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Project Structure

```
JBAiVideoSuite/
├── StartApp.bat              # Windows one-click launcher
├── assets/
│   ├── generated/            # Generated images + videos (ComfyUI output)
│   ├── audio/                # Generated audio files
│   ├── systemprompts/        # LLM system prompt .txt files
│   └── workflows/            # ComfyUI workflow JSON files
├── backend/
│   ├── main.py               # FastAPI app entry point
│   ├── models.py             # Pydantic models
│   ├── database.py           # Prisma DB connection
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── database.db       # SQLite database (created by prisma db push)
│   └── routes/
│       ├── settings.py       # LLM/ComfyUI/Backend settings CRUD
│       ├── projects.py       # Project CRUD, story/script generation
│       ├── assets.py         # Asset/state CRUD, prompt generation
│       ├── handshake.py      # LLM health check
│       ├── comfyui.py        # ComfyUI health check + image upload
│       ├── playground.py     # Workflow list/parse/generate (image + audio)
│       ├── playground_parser.py  # Workflow JSON parser (role extraction)
│       ├── gallery.py        # Generated image gallery
│       ├── systemprompts.py  # System prompt CRUD
│       ├── chat.py           # LLM chat
│       ├── appsettings.py    # App action mapping + video resolution presets
│       ├── shotlist.py       # Shot list CRUD (includes videoPath)
│       └── videogen.py       # Per-shot video generation (MinimaxH3 Ref2VA)
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── index.tsx     # Studio (5-stage pipeline)
    │   │   └── Settings.tsx  # Settings page
    │   ├── components/
    │   │   ├── studio/       # Story, Script, Assets, ShotList, FinalVideo stages
    │   │   │   └── FinalVideoStage.tsx  # Generate Clips + Assemble Clips
    │   │   ├── playground/   # ComfyUI workflow runner
    │   │   ├── settings/     # Settings panels
    │   │   ├── Gallery.tsx   # Image gallery with map-to-asset
    │   │   ├── AudioPicker.tsx  # Audio file picker
    │   │   └── ChatPanel.tsx # LLM chat
    │   └── store/
    │       ├── projectStore.ts   # Project state (Zustand)
    │       └── settingsStore.ts  # Settings state (Zustand)
    └── package.json
```

---

## The 5-Stage Pipeline

| Stage | What it does |
|-------|-------------|
| **Story** | Enter a raw idea → LLM generates a narrative arc |
| **Script** | Generate a full script → refine dialog → extract cast (characters, locations, props) |
| **Assets** | Review/edit extracted assets → generate image prompts → map generated images to asset states |
| **Shot List** | Generate a shot list from the script |
| **Final Video** | **Generate Clips** — per-shot video gen via ComfyUI (editable prompt, asset/audio previews, seed, duration, low/high res). **Assemble Clips** — preview, shot strip, play sequence, export |

---

## Configuration

All settings are stored in the SQLite database and editable via the **Settings** tab:

- **LLM Settings** — LM Studio connection (IP, port, model, temperature, max tokens)
- **ComfyUI Settings** — ComfyUI connection (IP, port, device ID, poll interval)
- **Backend Settings** — API URL
- **Workflows** — Manage ComfyUI workflow files
- **System Prompts** — Upload/edit `.txt` system prompt files
- **App Settings** — Map app actions (e.g., "Generate Script") to specific system prompts
- **Video Resolutions** — Low/High res presets (width × height) for MinimaxH3 Ref2VA video generation

---

## Video Generation

Per-shot video generation uses the **MinimaxH3 Ref2VA** ComfyUI workflow. The backend:

1. Loads the mapped workflow JSON
2. Injects prompt, seed, width, height, duration from the shot
3. Collects reference images (location, character sheets, props) and audio (scene dialog, character audio) from linked assets
4. Uploads files to ComfyUI and queues the prompt
5. Polls ComfyUI history for completion
6. Saves the generated video to `assets/generated/`
7. For **high-res** generation, persists `videoPath` to the shot in the database

Resolution presets are configured in **Settings → MinimaxH3 Ref2VA Generation** (default: low 960×544, high 1920×1080).

---

## License

See [LICENSE](LICENSE) for details.
