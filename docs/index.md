# JBAiVideoSuite — How-To Guide

A step-by-step guide to installing, configuring, and using **JBAiVideoSuite**.

> **Status:** Work in progress. Screenshots are placeholders and will be replaced with real captures as the UI stabilizes.

---

## Table of Contents

1. [Installation](#installation)
2. [Settings](#settings)
   - [App Settings](#app-settings)
   - [LLM Settings](#llm-settings)
   - [Backend Settings](#backend-settings)
   - [ComfyUI Settings](#comfyui-settings)
   - [ComfyUI Workflows](#comfyui-workflows)
   - [Creating ComfyUI Workflow JSON Files](#creating-comfyui-workflow-json-files)
   - [System Prompts](#system-prompts)
   - [Generating Your Own System Prompts](#generating-your-own-system-prompts)
3. [Status Indicators](#status-indicators)
4. [AI Assistant Chat](#ai-assistant-chat)
5. [Comfy Generation Tab](#comfy-generation-tab)
6. [Direct The Video Tab](#direct-the-video-tab)
   - [Creating a Project](#creating-a-project)
   - [Opening a Project](#opening-a-project)
   - [Exporting a Project](#exporting-a-project)
   - [Importing a Project](#importing-a-project)
   - [Deleting a Project](#deleting-a-project)
   - [Single Video vs. Episodic Flow](#single-video-vs-episodic-flow)
   - [Story Stage](#story-stage)
   - [Script Stage](#script-stage)
   - [Assets Stage](#assets-stage)
   - [Shot List Stage](#shot-list-stage)
   - [Takes Stage](#takes-stage)
   - [Final Video Stage](#final-video-stage)

---

## Installation

JBAiVideoSuite is a local-first video production suite. It has two halves:

- **Backend** — a FastAPI + Prisma (SQLite) service on port `8000`
- **Frontend** — a Next.js dev server on port `3000`

Both are launched together by the `StartApp.bat` script at the repo root.

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.12+ | Used by the backend venv |
| Node.js | 20+ | Used by the frontend |
| LM Studio | latest | Local LLM server (OpenAI-compatible API) |
| ComfyUI | latest | Image/video generation server |

### Step 1 — Clone the repository

```powershell
git clone <repo-url> JBAiVideoSuite
cd JBAiVideoSuite
```

### Step 2 — Set up the backend

The backend lives in `backend/` and ships with a pre-built virtual environment (`backend/.venv`). If you are cloning fresh, recreate it:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Then generate the Prisma client and create the SQLite database:

```powershell
prisma generate
prisma db push
```

> The database file is created at `backend/prisma/database.db`. Default settings (LLM, backend, ComfyUI) are seeded automatically on first startup.

### Step 3 — Set up the frontend

```powershell
cd ..\frontend
npm install
```

### Step 4 — Launch the app

From the repo root, double-click **`StartApp.bat`** (or run it from a terminal). It will:

1. Start the FastAPI backend in a new console window (`uvicorn main:app --reload --port 8000`)
2. Start the Next.js frontend in another console window (`npm run dev`)
3. Wait 3 seconds, then open `http://localhost:3000` in your default browser

![StartApp launching both services](images/placeholder.svg)

> **Tip:** Keep both console windows open while you work. Closing them stops the corresponding service.

### Step 5 — Verify the install

- Backend health: open `http://127.0.0.1:8000/` — you should see `{"message": "JBAiVideoSuite API is running"}`
- Frontend: the app header should read **JBAiVideoSuite** with the tabs *Direct The Video* and *Comfy Generation*

---

## Settings

The **Settings** page is reachable from the app header. It has six tabs, each covering a different area of configuration.

![Settings page overview](images/placeholder.svg)

### App Settings

Maps **system prompts** to app actions, and **ComfyUI workflows** to generation actions. Also holds the resolution presets used for asset and video generation.

![App Settings tab](images/placeholder.svg)

**LLM System Prompt Mapping** — for each app action, pick which system prompt file (from `assets/systemprompts/`) to use. Leave as *None* to use the built-in default.

| Action | Purpose |
|--------|---------|
| Develop Raw Story | Expands a raw story idea into a narrative arc |
| Extract Cast | Pulls characters, locations, and props from the story |
| Generate Script | Writes the episode script from the story |
| Generate Image Prompt | Builds image prompts for assets |
| Generate Shot Video Prompt | Builds video prompts for individual shots |
| Generate Take Video Prompt | Builds consolidated video prompts for takes (groups of shots) |
| Refine Dialog | Polishes dialogue lines |
| Generate Shots | Breaks the script into a shot list |

**ComfyUI Generation Mapping** — for each generation action, pick which workflow JSON file (from `assets/workflows/`) to use.

| Action | Purpose |
|--------|---------|
| Asset Generation | Generates character/location/prop images |
| Character Sheet Generation | Generates a character reference sheet |
| MinimaxH3 Ref2VA Generation | Generates video clips from reference images |

**Resolution Settings** — under *Asset Generation*, set the output resolution for each asset type (character, location, prop). Under *MinimaxH3 Ref2VA Generation*, set the low-res and high-res video resolutions.

Click **Save Mappings** to persist everything.

> Two collapsible sections at the bottom show the **Expected Asset JSON Format** and **Expected Shot JSON Format** — useful when writing custom system prompts.

### LLM Settings

Connects to your local **LM Studio** server.

![LLM Settings tab](images/placeholder.svg)

| Field | Description |
|-------|-------------|
| IP Address | Host running LM Studio (e.g. `127.0.0.1`) |
| Port | LM Studio's OpenAI-compatible port (default `1234`) |
| Model Name | The model identifier LM Studio reports |
| Temperature | Sampling temperature (default `0.7`) |

Click **Test Connection & List Models** to verify the connection. A green `🟢 Healthy` status means the server is reachable and at least one model is loaded. A red `🔴 Unreachable` means LM Studio is not running or the IP/port is wrong.

The list of available models appears below the test button. Pick one as your **Model Name**.

Click **Save LLM Settings** to persist.

> **Tip:** If your model supports reasoning (e.g. DeepSeek R1, Qwen reasoning variants), consider disabling it in LM Studio's model settings. Most of the work this app does is formatting and structuring — not deep reasoning — so turning reasoning off can make responses noticeably faster with no quality loss.

### Backend Settings

Points the frontend at the backend API.

![Backend Settings tab](images/placeholder.svg)

| Field | Description |
|-------|-------------|
| API URL | Backend base URL (default `http://127.0.0.1:8000`) |
| Database Path | Path to the SQLite database (default `backend/prisma/database.db`) |

Click **Save Backend Settings** to persist.

### ComfyUI Settings

Connects to your local **ComfyUI** server.

![ComfyUI Settings tab](images/placeholder.svg)

| Field | Description |
|-------|-------------|
| IP Address | Host running ComfyUI (default `127.0.0.1`) |
| Port | ComfyUI's port (default `8188`) |
| Device ID | GPU device index (default `0`) |
| Poll Interval (ms) | How often to poll for task completion (default `4000`) |

Click **Test Connection & Status** to verify the connection. Click **Save ComfyUI Settings** to persist.

### ComfyUI Workflows

Manages the ComfyUI workflow JSON files available to the app.

![ComfyUI Workflows tab](images/placeholder.svg)

- **Add New Workflow JSON** — upload a `.json` workflow file. It is stored in `assets/workflows/` and becomes selectable in *App Settings → ComfyUI Generation Mapping*.
- **Refresh** — re-reads the `assets/workflows/` directory.
- The list below shows all available workflows. Click one to select it.

### Creating ComfyUI Workflow JSON Files

The app reads ComfyUI workflows in **API format** (not the UI format). You build the workflow in ComfyUI, export it as API JSON, then tag each input node with a role prefix so the app knows what to inject.

**Step 1 — Build the workflow in ComfyUI**

Design your workflow normally in the ComfyUI UI. Add the nodes you need (loaders, samplers, decoders, output nodes, etc.).

**Step 2 — Export as API format**

In ComfyUI, go to **Workflow → Export (API)** or use the API export button. This produces a JSON file where each node is keyed by its ID and inputs are either literal values or `[nodeId, slot]` references.

**Step 3 — Tag input nodes with roles**

The app identifies which nodes to inject values into by looking at the `_meta.title` field. Each input node's title must follow this pattern:

```
(input:role) Label
```

Where `role` tells the app what kind of input it is:

| Role | Node Type | Example Title | What the App Injects |
|------|-----------|---------------|----------------------|
| `prompt` | `PrimitiveStringMultiline` | `(Input:prompt) Prompt` | The generation prompt text |
| `image` | `LoadImage` | `(input:image) Image1` | An image filename from the gallery |
| `audio` | `LoadAudio` | `(input:audio) Audio1` | An audio filename |
| `seed` | `PrimitiveInt` | `(Input:seed) Seed` | A numeric seed value |
| `width` | `PrimitiveInt` | `(Input:width) Width` | Width in pixels |
| `height` | `PrimitiveInt` | `(Input:height) Height` | Height in pixels |
| `duration` | `PrimitiveFloat` | `(Input:duration) Duration` | Duration in seconds |

**Step 4 — Tag output nodes**

Output nodes use the `(output:type)` prefix:

| Type | Node Type | Example Title |
|------|-----------|---------------|
| `image` | `PreviewImage` | `(output:image) Image Output` |
| `video` | `VHS_VideoCombine` | `(output:video) Video` |

**Example — Text-to-Image workflow (Krea2):**

```json
{
  "135": {
    "inputs": { "value": "A portrait of..." },
    "class_type": "PrimitiveStringMultiline",
    "_meta": { "title": "(Input:prompt) Prompt" }
  },
  "136": {
    "inputs": { "value": 1920 },
    "class_type": "PrimitiveInt",
    "_meta": { "title": "(Input:width) Width" }
  },
  "137": {
    "inputs": { "value": 1088 },
    "class_type": "PrimitiveInt",
    "_meta": { "title": "(Input:height) Height" }
  },
  "138": {
    "inputs": { "value": 0 },
    "class_type": "PrimitiveInt",
    "_meta": { "title": "(Input:seed) Seed" }
  },
  "71": {
    "inputs": { "images": ["54", 0] },
    "class_type": "PreviewImage",
    "_meta": { "title": "(output:image) Image Output" }
  }
}
```

**Example — Reference-to-Video workflow (MiniMax H3):**

```json
{
  "138": {
    "inputs": { "value": "**subject_definitions**\n..." },
    "class_type": "PrimitiveStringMultiline",
    "_meta": { "title": "(Input:prompt) Prompt" }
  },
  "137": {
    "inputs": { "image": "character.png" },
    "class_type": "LoadImage",
    "_meta": { "title": "(input:image) Image1" }
  },
  "5649": {
    "inputs": { "image": "ref2.png" },
    "class_type": "LoadImage",
    "_meta": { "title": "(input:image) Ref 2" }
  },
  "5678": {
    "inputs": { "audio": "voice.mp3" },
    "class_type": "LoadAudio",
    "_meta": { "title": "(input:audio) Audio1" }
  },
  "5650": {
    "inputs": { "value": 42 },
    "class_type": "PrimitiveInt",
    "_meta": { "title": "(Input:seed) Seed" }
  },
  "132": {
    "inputs": { "value": 5 },
    "class_type": "PrimitiveFloat",
    "_meta": { "title": "(Input:duration) Duration" }
  },
  "150": {
    "inputs": { "images": ["122", 0], "audio": ["121", 0] },
    "class_type": "VHS_VideoCombine",
    "_meta": { "title": "(output:video) Video" }
  }
}
```

> **Tip:** The case of `Input` vs `input` in the title doesn't matter — the app matches on the role word (`prompt`, `image`, `audio`, `seed`, `width`, `height`, `duration`) and the `input`/`output` prefix.

> **Note:** You can have multiple nodes with the same role (e.g. three `(input:image)` nodes for a multi-reference workflow). The app will create a picker for each one.

### System Prompts

Manages the system prompt `.txt` files available to the app.

![System Prompts tab](images/placeholder.svg)

- **Add New System Prompt (.txt)** — upload a `.txt` prompt file. It is stored in `assets/systemprompts/` and becomes selectable in *App Settings → LLM System Prompt Mapping*.
- **Refresh** — re-reads the `assets/systemprompts/` directory.
- The list below shows all available prompts. Click one to select it.

### Generating Your Own System Prompts

You will need to generate a few system prompts with your favorite LLM of choice — use the best one available, but even a local model should work. Each prompt is a plain `.txt` file that instructs the LLM on its role, constraints, and output format for a specific app action.

There are eight prompts to generate. Here is what each one does and the exact output format it must produce.

---

#### 1. Rough Story Development

**App Action:** Develop Raw Story
**Prompt File:** `FleshoutStory_SystemPrompt.txt`

Here we are providing the LLM with a simple story in a few lines or even just a one-liner with a duration. The system prompt needs to help flesh it out into a 3–5 paragraph dialogue-less story arc, following either of these formats based on story complexity:

- **3 paragraphs** — Three-Act Structure: Setup, Confrontation, Resolution
- **5 paragraphs** — Five-Act Structure: Inciting Incident, Rising Action, Climax, Falling Action, Resolution

**Output Format**

You must format your output exactly like the structure below, using Markdown.

```markdown
# Narrative Treatment
**Target Duration:** [Requested Duration]
**Logline:** [A refined, 1-2 sentence version of the user's input prompt]

## Cast & Environments
*   **[Character Name]:** [1-2 sentences detailing physical appearance, core motivation, and visual state].
*   **[Location Name]:** [1-2 sentences detailing the physical space, lighting, and atmosphere].

## The Arc
**[Act 1 / Paragraph 1 Title]**
[Write the first paragraph here, focusing heavily on establishing the physical space, the characters' initial states, and the inciting action. Strictly no dialogue.]

**[Act 2 / Paragraph 2 Title]**
[Write the second paragraph here, escalating the action, introducing new environments if necessary, and pushing characters to their breaking points.]

**[Act 3 / Paragraph 3 Title]**
[Write the third paragraph here...]

*(Continue for exactly 3 or 5 paragraphs total, ensuring the final paragraph provides a clear visual resolution or a distinct cliffhanger.)*
```

---

#### 2. Story to Script

**App Action:** Generate Script
**Prompt File:** `Story2Script_SystemPrompt.txt`

We provide the LLM with our 3–5 paragraph story (without dialogues) generated by the previous system prompt and ask it to convert it into a well-formatted script with beats. Here we need to generate necessary dialogues and character interaction in detail. The output structure needs to be maintained as requested.

**Output Format**

You must format your script exactly like the structure below, using Markdown.

```markdown
# Episode [Number]: [Episode Title]
**Episode Hook:** [1-sentence summary of the hook]
**Episode Cliffhanger:** [1-sentence summary of the ending]

## Scene [Index]: [Location] - [Lighting/Time of Day]
**Characters Present:** [Name 1, Name 2, etc.]
**Key Props:** [Prop 1, Prop 2]

*   **Beat 1 [Action]:** [Common, macroscopic action description.]
*   **Beat 2 [Line]:** **[SPEAKER NAME]** *(Delivery/Tone)* "Exact dialogue goes here."
*   **Beat 3 [Action]:** [Action description.]
*   **Beat 4 [Line]:** **VO** *(Speaker Name, Delivery)* "Voiceover text."
[... Continue beats until requested scene/episode ends ...]
```

---

#### 3. Extract Cast

**App Action:** Extract Cast
**Prompt File:** `ExtractCharactersLocationsProps_SystemPrompt.txt`

We will give the LLM the full script generated by the previous system prompt and ask it to extract recurring characters, locations, and props in a specified JSON format. We need all the different states for these — e.g., *Jake in Suit*, *Jake in Bathrobe*, *Jake Injured*, or *Cemetery Location at Day*, *Cemetery Location at Night*, or *Staff*, *Staff Broken*.

**Output Format**

You must format your breakdown exactly like the JSON structure below.

```json
{
  "characters": [
    {
      "name": "[Character Name]",
      "description": "[Brief 1-sentence physical description based on script context]",
      "states": [
        {
          "name": "[State Name: e.g., Base/Default or Wounded]",
          "description": "[Description of this specific look, outfit, or condition]",
          "scenes": [[Array of integer scene numbers, e.g., 1, 2]]
        }
      ]
    }
  ],
  "locations": [
    {
      "name": "[Base Location Name]",
      "description": "[Brief 1-sentence architectural/spatial description]",
      "states": [
        {
          "name": "[Lighting/Condition: e.g., Day, Night, Raining]",
          "description": "[Description of the specific environmental condition]",
          "scenes": [[Array of integer scene numbers, e.g., 1]]
        }
      ]
    }
  ],
  "props": [
    {
      "name": "[Prop Name]",
      "description": "[Brief visual description of the interactable item]",
      "associatedCharacters": [
        "[Character Name 1]",
        "[Character Name 2]"
      ],
      "states": [
        {
          "name": "[State Name: e.g., Base/Closed or Open/Broken]",
          "description": "[Description of the prop's specific condition]",
          "scenes": [[Array of integer scene numbers, e.g., 2, 4, 5]]
        }
      ]
    }
  ]
}
```

---

#### 4. Dialog Refine

**App Action:** Refine Dialog
**Prompt File:** `ScriptDialogRefiner_SystemPrompt.txt`

The LLM is given the generated script in order to do a second pass for dialog refinement. Additionally, the LLM will also get characteristic details of each of the characters — their nature, talking style, motivations — so that it can regenerate the dialogues accordingly. Nothing else in the script can be altered, only the dialogues, but the LLM can add more dialogues if the situation calls for it.

---

#### 5. Script to Shots

**App Action:** Generate Shots
**Prompt File:** `Script2Shots_SystemPrompt.txt`

The LLM is supplied with a final script with beats to be converted into corresponding shots tailored for the features and limitations of the MiniMax H3 video generation model. The output needs to follow the strict JSON structure provided.

**Output Format**

When processing a user's script, output a structured shot list strictly as a JSON object.

```json
{
  "shots": [
    {
      "shot": "[Integer: e.g., 1]",
      "scene": "[Integer: e.g., 1]",
      "beats": "[Array of Integers: e.g., [2, 3]]",
      "loc": "[String: Exact name of the location from the scene heading, e.g., The Deep Forest]",
      "subs": "[Array of Strings: Exact names of the characters visible in this shot, e.g., [\"Sage Kanva\", \"Shakuntala\"]]",
      "frames": "[Integer matching 17n+5 grid: e.g., 158]",
      "duration": "[Float: e.g., 6.5]",
      "camera": "[Explicit placement and cropping instructions]",
      "action": "[Staggered emotional beats, hiding transitions via blinks or movement]",
      "dialogue": "[<d>[Language] Text</d> or VO notes, leave blank if none]",
      "note": "[Brief justification based on empirical rules]"
    }
  ]
}
```

---

#### 6. Shot to MiniMax H3 Video Prompt

**App Action:** Generate Shot Video Prompt
**Prompt File:** `GenerateVideoPrompt_SystemPrompt.txt`

The LLM needs to generate a well-formatted reference-to-video prompt for the MiniMax H3 video model based on the guide found here:
[MiniMax H3 Video Prompt Writing Guide](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/docs/VIDEO_PROMPT_WRITING_GUIDE_ref_en.md)

The LLM will get the whole script scene text for context, the details of the specific beat which we are developing into a video scene, and the reference images/audio to be mapped into the formatted prompt.

---

#### 7. Text to Image Prompt Generation

**App Action:** Generate Image Prompt
**Prompt File:** `GenerateImagePrompt_SystemPrompt.txt`

Generate text-to-image prompts for your chosen workflow and image model.

---

#### 8. Ref to Video Prompt Generation

**App Action:** *(optional — used by the Comfy Generation tab)*
**Prompt File:** `Krea2_SystemPrompt.txt` or a custom ref-to-video prompt

Ref-to-video prompt generation for MiniMax H3 based on the official guide.

---

**How to generate a prompt:**

1. Open your favorite LLM (LM Studio, ChatGPT, Claude, etc.)
2. Describe the role you need, including the exact output format shown above for each prompt
3. Save the LLM's output as a `.txt` file in `assets/systemprompts/`
4. In the app, go to **Settings → System Prompts** and click **Refresh**
5. In **Settings → App Settings**, map the prompt to its action under *LLM System Prompt Mapping*

> **Tip:** You don't need all 8 prompts to use the app. The minimum viable set is: FleshoutStory, Story2Script, ExtractCharactersLocationsProps, and Script2Shots. The rest (dialog refiner, image/video prompt generators, Krea2) enhance the workflow but can be left unmapped.

> **Note:** The prompts in this repo are examples. Feel free to modify them or write your own — the app only cares that the output format matches what it expects (see the collapsible JSON format sections in *App Settings*).

---

## Status Indicators

The app header shows two live status indicators so you can see at a glance whether your LLM and ComfyUI servers are reachable.

![Header status indicators](images/placeholder.svg)

### LLM Status

The **LLM** indicator shows the state of your LM Studio connection:

| Indicator | Meaning |
|-----------|---------|
| `🟢 <model-name>` | A model is loaded and ready to use |
| `🔵 No Models Loaded` | LM Studio is reachable but no model is loaded |
| `🔴 UNREACHABLE` | LM Studio is not running or the IP/port is wrong |

**Buttons next to the LLM status:**

| Button | When it appears | What it does |
|--------|----------------|--------------|
| 🔄 (refresh icon) | Always | Re-checks LLM and ComfyUI status |
| ➕ (plus icon) | When `🔵 No Models Loaded` | Loads the configured model into LM Studio |
| ➖ (minus icon) | When `🟢 <model-name>` | Unloads the model from LM Studio (frees VRAM) |

> **Tip:** Unload the model when you're done generating to free up VRAM for ComfyUI. Load it again when you need to generate text.

### ComfyUI Status

The **ComfyUI** indicator shows whether your ComfyUI server is online:

| Indicator | Meaning |
|-----------|---------|
| `🟢 Online` | ComfyUI is reachable and ready to accept jobs |
| `🔴 Offline` | ComfyUI is not running or the IP/port is wrong |

**Buttons next to the ComfyUI status:**

| Button | When it appears | What it does |
|--------|----------------|--------------|
| 🔄 (refresh icon) | Always | Re-checks LLM and ComfyUI status |

> Both status indicators are checked automatically when the app loads. Use the refresh button to re-check after starting or stopping a server.

---

## AI Assistant Chat

A collapsible chat panel is available on **every screen** of the app. It gives you a persistent conversation with your LLM that persists across tabs and projects.

![AI Assistant chat panel](images/placeholder.svg)

### Opening & Closing

- **Open** — click the vertical **CHAT** tab on the right edge of the screen (visible when the panel is closed)
- **Close** — click the **×** button in the panel header

The panel takes up the right quarter of the screen when open. The main content area shrinks to make room.

### Header Controls

| Control | Description |
|---------|-------------|
| **System Prompt dropdown** | Select a system prompt from `assets/systemprompts/` to shape the assistant's behavior. Choose *No System Prompt* for a generic assistant. |
| **Clear** | Wipes all messages, resets the system prompt to *None*, and clears the backend session |
| **×** | Closes the panel (reveals the CHAT tab) |

> Changing the system prompt mid-conversation injects a reset message so the LLM drops the previous prompt's influence.

### Messages

- **User messages** appear right-aligned in blue
- **Assistant messages** appear left-aligned in gray
- A **"Thinking..."** indicator shows while the LLM is generating a response
- Messages persist in `localStorage` — they survive page refreshes and tab switches

### Attachments

Click the **📎** button to attach a file to your next message:

| File type | Behavior |
|-----------|----------|
| **Images** (`image/*`) | Shown as a thumbnail preview above the input. Sent to the LLM as a base64 image. |
| **Text** (`.md`, `.txt`) | Shown as a filename chip. The file contents are appended to your message text. |

Remove an attachment by clicking the **×** next to its preview.

### Tips

- Use the chat to brainstorm story ideas, refine dialogue, or ask questions about your project — the conversation is independent of any specific project
- Attach a character sheet image and ask the assistant to describe it for use in a prompt
- Attach a `.txt` file with reference material and ask the assistant to summarize or extract details

---

## Comfy Generation Tab

The **Comfy Generation** tab is a standalone playground for running ComfyUI workflows directly — no project required. It's useful for testing prompts, generating reference images, or producing assets outside the main video pipeline.

![Comfy Generation tab](images/placeholder.svg)

The tab is split into two columns:

### Left Column — Gallery

A grid of all images and videos in `assets/generated/`.

![Gallery panel](images/placeholder.svg)

- **Add** — upload a new image to the gallery
- **Refresh** — re-read the `assets/generated/` directory
- **Click an image** — opens a detail modal where you can:
  - **Delete** — remove the image from the gallery
  - **Map to Asset** — assign the image to a character, location, or prop in your current project (select type → asset → state → image type → Assign)

> Videos in the gallery are marked with a small **VIDEO** badge in the top-right corner.

### Right Column — Workflow Selector + Preview

**Workflow Selector** — a dropdown listing all workflows from `assets/workflows/`. Next to it, a status badge shows:

- `Gen complete` (green) — no tasks in the queue
- `N tasks queued` (amber) — N generations are currently running

**Preview** — once a workflow is selected, its inputs are parsed and displayed:

![Workflow input manager](images/placeholder.svg)

| Section | Description |
|---------|-------------|
| **Result preview** | Shows the generated image or video once complete. Displays "Result will appear here" while waiting. |
| **Seed** | Numeric seed input with a **Random** button (only if the workflow has a seed node) |
| **Float inputs** | Any float-type inputs from the workflow (e.g. strength, scale) |
| **Resolution** | Dropdown of common resolutions (512×512 through 3840×2160) plus manual W/H inputs |
| **Generate** | Queues the generation. Becomes **Queue Another** while a task is running |
| **String inputs** | Textareas for prompt strings (one per string input in the workflow) |
| **Images** | Image pickers for each image input role (e.g. reference images) |
| **Audio** | Audio pickers for each audio input role (e.g. voice samples) |

> **How it works:** When you click **Generate**, the app uploads any selected image/audio files to ComfyUI, injects all input values into the workflow JSON, and queues the job. The app polls ComfyUI at the configured interval (default 4 s) until the result is ready, then displays it in the preview area.

> **Note:** If no workflows are available, the tab shows a message directing you to add some in **Settings → ComfyUI Workflows**.

---

## Direct The Video Tab

The **Direct The Video** tab is the main production pipeline. It takes you from a raw story idea all the way to a finished video through five stages: **Story → Script → Assets → Shot List → Final Video**.

Before you can work on any stage, you need a project. Projects are managed from the **Project Library**, which is the first screen you see when the tab is open.

![Project Library](images/placeholder.svg)

### Creating a Project

Click the **+ New Project** button at the bottom of the Project Library. A modal appears:

![New Project modal](images/placeholder.svg)

| Field | Description |
|-------|-------------|
| **Project Name** | A short name for your project (e.g. *The Mars Explorer*). Required. |
| **Video Type** | **Single Video** — one continuous video. **Episodic** — a series with multiple episodes. |

Click **Create Project** to save it. The project appears in the library grid with a cover preview (the first character sheet, if one exists) and a type badge.

> **Tip:** The project name is used as the default export filename. Spaces are replaced with underscores.

### Opening a Project

Click any project card in the grid to open it. The active project is highlighted with a blue border. Once inside, you'll see the project name, its type badge, and the five stage tabs across the top.

A **← Back to Library** button in the top-left takes you back to the project grid.

### Exporting a Project

Each project card in the library has an **Export** button (download icon) in its bottom-right corner. Clicking it opens an export modal:

![Export modal](images/placeholder.svg)

| Field | Description |
|-------|-------------|
| **Filename** | The export filename. Defaults to `<project_name>_export.json`. Editable. |
| **Include settings & mappings** | When checked, the export includes your current LLM prompt mappings, ComfyUI workflow mappings, and resolution settings. Uncheck to export only project data. |

Click **Export** to download the JSON file. The file contains:

- Project metadata (name, type, ID)
- Story, script, beats
- Assets (characters, locations, props) and their states
- Shot list
- Final video references
- *(Optional)* Settings and mappings

> **Tip:** Keep a copy of your export file as a backup. You can re-import it at any time to restore the project.

### Importing a Project

Click the **Import Project** button at the bottom of the Project Library. Select a previously exported `.json` file. The project is created in your library with all its data intact.

> **Note:** Importing creates a *new* project — it does not merge with an existing one. If you import a file that was exported from a project with the same name, you'll have two separate projects.

### Deleting a Project

There are two ways to delete projects:

**Delete a single project** — open the project, then click the **Delete Project** button (red, top-right of the project header). A confirmation dialog asks: *Delete "<name>"? This cannot be undone.* Click OK to proceed. All associated data (story, script, assets, shots, final video) is removed from the database.

**Delete all projects** — in the Project Library, click the **Delete All** button (red, top-right of the header). A confirmation dialog asks: *Do you want to remove all projects?* Click OK to wipe every project and its data.

> ⚠️ **Warning:** Deletion is permanent. Export your project first if you might need it later.

### Single Video vs. Episodic Flow

The two project types differ only in one way: **episodic projects have an episode selector**, while single video projects do not.

An episodic project is simply a **collection of single video flows** — each episode runs through the exact same five stages (Story → Script → Assets → Shot List → Final Video) independently.

| | Single Video | Episodic |
|---|---|---|
| **Episodes** | One (implicit) | Multiple — switch with the episode selector |
| **Stage tabs** | Story, Script, Assets, Shot List, Final Video | Same five tabs, but scoped to the selected episode |
| **Data** | All data belongs to the single project | Each episode has its own story, script, assets, shots, and final video |

**How it works in practice:**

1. Create an **Episodic** project
2. An episode selector appears (e.g. *Episode 1*, *Episode 2*, …)
3. Work through the five stages for Episode 1
4. Switch to Episode 2 — the stages reset and you start fresh
5. Repeat for as many episodes as you need

> **Tip:** Assets (characters, locations, props) are shared across episodes within the same project. You define them once in Episode 1 and they're available in every subsequent episode.

> **Note:** A Single Video project behaves identically to a one-episode Episodic project — it just hides the episode selector since there's only one.

### Story Stage

The **Story** stage is where you start your production. It has two main sections: your raw idea and the AI-generated narrative arc.

![Story stage](images/placeholder.svg)

**Project Details** — the project name is editable here. Changes are saved when you click **Save**.

**1. Raw Idea** — a large textarea where you type your story concept. This can be as short as a sentence or as long as a paragraph. Examples:

- *"A lonely astronaut discovers a signal from a dead planet"*
- *"Two rival chefs compete in an underground cooking contest"*

**Duration** — a stepper control (− / +) that sets the target video length in 15-second increments. For single video projects this is the total video duration; for episodic projects it's the duration per episode. Default is 2 minutes.

**2. Narrative Arc** — appears after you generate. This is the LLM's expanded version of your raw idea: a structured narrative with a beginning, middle, and end. It's editable, so you can tweak the arc before moving on.

**Episodes** *(episodic projects only)* — a number input to set how many episodes the series will have. Changing this updates the episode selector in the header.

**Buttons:**

| Button | What it does |
|--------|--------------|
| **Generate Narrative Arc** | Sends your raw idea to the LLM and fills the Narrative Arc box. The button becomes **Regenerate Arc** if an arc already exists. |
| **Save** | Persists the project name, duration, episode count, raw idea, and narrative arc to the database. |
| **Next** | Jumps to the Script stage. Disabled until a narrative arc exists. |

> **Tip:** You can edit the narrative arc freely before saving. The LLM uses it as the source for script generation, so make sure it captures the story you want.

### Script Stage

The **Script** stage turns your narrative arc into a full screenplay-style script, extracts the cast, and lets you refine dialogue.

![Script stage](images/placeholder.svg)

**Script** — a large textarea showing the generated script. It's fully editable. The script is generated from the narrative arc you saved in the Story stage.

**Buttons:**

| Button | What it does |
|--------|--------------|
| **Generate Script** | Sends the narrative arc to the LLM and fills the Script box. Becomes **Regenerate Script** if a script already exists. Disabled until a narrative arc exists. |
| **Refine Dialog** | Sends the current script to the LLM for dialogue polishing. The refined version appears in a separate **Refined Dialog** box below. |
| **Extract Assets** | Sends the script to the LLM to extract characters, locations, and props. The result appears in the **Extracted Assets** box below. |

**Refined Dialog** *(appears after Refine Dialog)* — a teal-bordered textarea showing the LLM's polished version of your script. Edit it if needed, then click **Apply Dialog Refinement** to replace the main script with the refined version.

**Extracted Assets** — a purple-bordered textarea showing the cast as formatted text:

```
CHARACTERS
========================================

• Captain Nova
  A seasoned explorer...
  - Default: Standard uniform (Scenes: 1, 3, 5)
  - Injured: Bandaged arm (Scenes: 7, 8)

LOCATIONS
========================================

• Mars Base
  A modular habitat...
  - Day: Bright exterior (Scenes: 1, 2)

PROPS
========================================

• Signal Device
  A handheld scanner...
  Characters: Captain Nova
  Scenes: 3, 4, 5
```

The raw JSON is stored behind the scenes and saved to the database when you click **Save**. The formatted view is for readability — you can edit it, but only valid JSON changes will be persisted.

**Save** — persists the script and (if valid) the extracted assets to the database.

**Next** — jumps to the Assets stage. Only appears after assets have been saved.

> **Tip:** The Extract Assets step is what feeds the Assets stage. If your cast looks wrong, edit the script and re-extract rather than manually editing the JSON.

### Assets Stage

The **Assets** stage is where you manage all the visual and audio elements for your project. It's split into a left panel (asset list) and a right panel (detail editor).

![Assets stage](images/placeholder.svg)

**Left Panel — Asset List**

Four tabs at the top: **Characters**, **Locations**, **Props**, **Audio**.

- **Characters / Locations / Props** — each item in the list is either an asset (no states) or an asset + state pair (e.g. *Captain Nova — Default*, *Captain Nova — Injured*). Click an item to load it in the right panel.
- **Audio** — lists imported audio files. Click to load in the right panel.

**Buttons at the bottom of the left panel:**

| Button | Tab | What it does |
|--------|-----|--------------|
| **+ Add Asset / State** | Characters, Locations, Props | Opens a modal to add a new asset or a new state to an existing asset |
| **⚡ Generate All Prompts** | Characters, Locations, Props | Iterates through every state and generates an image prompt for each. Shows progress (*Generating 3/12…*) and a **Stop** button |
| **+ Import Audio** | Audio | Opens a modal to import an audio file |

**Right Panel — Detail Editor**

For **Characters / Locations / Props**, the detail editor shows:

| Field | Description |
|-------|-------------|
| **Name** | Asset name (editable) |
| **State** | State name (editable, only if the asset has states) |
| **Type** | Character, Location, or Prop (read-only) |
| **Asset Description** | What the asset looks like overall |
| **State Description** | What this specific state looks like |
| **Image** | Preview of the assigned image. Has a **Generate Image** button that sends the prompt to ComfyUI |
| **Character Sheet** | *(Characters only)* Preview of the character sheet. Has a **Generate Sheet** button (requires an image to be assigned first) |
| **Prompt** | The image generation prompt. Editable. Has **Generate Prompt** (LLM), **Copy Prompt**, **Save Asset**, and **Delete** buttons |

> **Tip:** You can assign images from the Gallery (Comfy Generation tab → Map to Asset) instead of generating them. The **Generate Image** button uses the prompt you've written or generated.

For **Audio**, the detail editor shows:

| Field | Description |
|-------|-------------|
| **Name** | Audio file name (editable) |
| **Type** | Voice Sample, Character Dialog, or Scene Dialog |
| **Audio File** | Path + audio player |
| **Transcript** | Text transcription of the audio (editable) |
| **Save Audio / Delete** | Persist changes or remove the file |

**Add Asset / State Modal**

| Field | Description |
|-------|-------------|
| **Asset** | Dropdown: pick an existing asset (to add a state) or choose *+ New Character/Location/Prop* |
| **Asset Name** | *(New only)* Name for the new asset |
| **Asset Description** | *(New only)* Description for the new asset |
| **State Name** | Name for the state (e.g. *Default*, *Injured*, *Night*) |
| **State Description** | Description for the state |

**Import Audio Modal**

| Field | Description |
|-------|-------------|
| **Audio File** | File picker (accepts any audio format) |
| **Name** | Display name for the audio |
| **Type** | Voice Sample, Character Dialog, or Scene Dialog |
| **Transcript** | Text transcription |

### Shot List Stage

The **Shot List** stage breaks your script into individual shots — the building blocks for video generation. Each shot has a location, subjects, camera direction, action, dialogue, and a generation prompt.

![Shot List stage](images/placeholder.svg)

**Header**

- **Shot List (N shots)** — title with shot count
- **+ Add Shot** — adds a blank shot at the end
- **⚡ Generate All Prompts** — generates a video prompt for every shot. Shows progress and a **Stop** button

**Shot Navigation**

- **← Prev / Next →** — step through shots
- **Dropdown** — jump to a specific shot
- **Delete Shot** — removes the current shot

**Shot Fields**

| Field | Description |
|-------|-------------|
| **Shot #** | Shot number |
| **Scene** | Scene number |
| **Beats** | Comma-separated beat numbers (e.g. `1, 2, 3`) |
| **Frames** | Frame count for the shot |
| **Duration (s)** | Shot duration in seconds |
| **Location** | Where the shot takes place |
| **Subjects** | Who/what is in the shot |
| **Camera** | Camera direction (e.g. *wide shot, slow pan left*) |
| **Action** | What happens in the shot |
| **Dialogue** | Any spoken lines |
| **Note** | Additional notes |

**Linked Assets**

Each shot can be linked to project assets:

| Field | Description |
|-------|-------------|
| **Location** | Dropdown: pick a location asset + state |
| **Characters** | Up to 4 character slots. Each slot: pick a character asset + state. **+ Add Character** to add more |
| **Audio Type** | Toggle: **None**, **Scene Dialog**, or **Voice Samples** |
| **Audio** | If *Scene Dialog*: pick a scene dialog audio file. If *Voice Samples*: pick a voice sample per character |
| **Props** | Up to 4 prop slots. Each slot: pick a prop asset + state. **+ Add Prop** to add more |

**Music**

- **On / Off** toggle
- When **On**, a text field appears for describing the background music

**Prompt**

- A large textarea for the video generation prompt
- **Generate Prompt** — sends the shot data to the LLM to build a prompt
- **Copy Prompt** — copies the prompt to clipboard

**Raw JSON**

A textarea at the bottom where you can paste the raw JSON output from the LLM. Click **Load Shots** to parse it into the shot list. This is useful if the auto-parse fails.

**Buttons**

| Button | What it does |
|--------|--------------|
| **Generate Shots** | Sends the script to the LLM and generates a full shot list. Becomes **Regenerate Shots** if shots already exist. Disabled until a script exists. |
| **Save Shots** | Persists all shots to the database. Shows a green confirmation when successful. |

> **Tip:** The shot list is what feeds the Final Video stage. Each shot's prompt, linked assets, and audio are used to generate the video clip for that shot.

### Takes Stage

The **Takes** stage groups consecutive shots into "takes" — each take is a continuous video segment of up to 15 seconds. This lets the video model generate longer, more coherent runs instead of many short clips.

> **Note:** The Takes tab is hidden by default. Enable it by checking the **Enable Takes** checkbox in the Shot List stage header. The setting persists in your browser (localStorage).

![Takes stage](images/placeholder.svg)

**Header**

- **Takes (N)** — title with take count
- **+ Add Take** — appends a new take starting after the last take's end shot
- **Delete Last Take** — removes the final take (immediate, no save needed)
- **Save Takes** — persists all takes to the database

**Take Selector**

- **Take** dropdown — select which take to edit. Shows the take number and its end shot (e.g. *Take 2 (ends at shot 5)*)

**End Shot Selector**

- **End Shot** dropdown — pick where this take ends. Options are constrained:
  - Minimum: start shot + 1 (a take must contain at least 2 shots)
  - Maximum: the next take's end shot − 1 (takes cannot overlap)
- Shows the shot range (e.g. *shots 3–5*)

**Total Duration**

- Sum of all shot durations in the take
- Shows a ⚠ warning if the total exceeds 15 seconds

**Consolidated Actions**

- Read-only list of all shot actions in the take, one per line
- Format: `Shot N: action text`

**Consolidated Assets**

- Read-only list of all unique assets (with states) referenced by shots in the take
- Split into three columns: **Locations**, **Characters**, **Props**
- Each entry shows `AssetName — StateName`

**Prompt**

- A large textarea for the consolidated video generation prompt
- **Generate Prompt** — sends the take's shots to the LLM (using the *Generate Take Video Prompt* system prompt) to build a consolidated prompt. The LLM receives:
  - Total take duration
  - Per-scene sections (scene text from script + each shot's beats, camera, action, dialogue, audio instructions)
  - Consolidated reference assets
  - Background music
- **Copy Prompt** — copies the prompt to clipboard

**How Takes Work**

- Takes are sequential and non-overlapping
- Take 1 starts at shot 1. Each subsequent take starts at the previous take's end shot + 1
- The start shot is derived automatically — you only select the end shot
- A take must contain at least 2 shots
- The Final Video stage uses the take's consolidated prompt (when takes are enabled) instead of individual shot prompts

> **Tip:** Use takes when you want longer, more continuous video segments. Keep each take under 15 seconds for best results with the video model.

### Final Video Stage

The **Final Video** stage is where you generate video clips for each shot and preview the assembled sequence. It has two sub-tabs: **Generate Clips** and **Assemble Clips**.

![Final Video stage](images/placeholder.svg)

#### Generate Clips

The main working area for producing video clips.

**Shot Selector** — **← Prev / Next →** buttons and a dropdown to jump between shots. Shows the current shot number and duration.

**Video Preview** — a large video player (960×544 aspect ratio). Shows the generated clip once complete, or *"Video preview will appear here"* while waiting.

**Shot Detail** — a panel below the preview showing:

| Field | Description |
|-------|-------------|
| **Prompt** | The video generation prompt (editable). This is the prompt you wrote or generated in the Shot List stage. |
| **Asset Previews** | Small thumbnails of the linked location, characters (uses character sheet if available), and props. Shows *"Image missing"* if an asset has no image. |
| **Audio** | Audio players for any linked audio files (scene dialog or voice samples) |
| **Duration** | Shot duration in seconds (editable, 0.1s steps) |
| **Seed** | Numeric seed for the generation. **Randomize** button for a random seed |

**Buttons:**

| Button | What it does |
|--------|--------------|
| **Gen Low Res** | Generates the clip at low resolution (faster, for previewing). The result appears in the video preview. |
| **Gen High Res** | Generates the clip at high resolution (final quality). The result is saved to the shot's `videoPath`. |
| **Save** | Persists all shots (including any prompt edits) to the database. |

> **Tip:** Use **Gen Low Res** to quickly check if the prompt and assets look right before committing to a full high-res render.

> **Note:** If no shots exist, the stage shows *"No shots found. Generate shots in the Shot List tab first."*

#### Assemble Clips

A preview mode for watching your shots play in sequence.

**Video Preview** — a video player showing the clip for the currently selected shot. Shows *"No video generated for Shot N"* if the shot hasn't been rendered yet.

**Play Sequence** — a button that plays all shots in order. Shots without a generated video are skipped (1.5s pause). Click **Stop** to halt playback.

**Shot Strip** — a horizontal scrollable strip of thumbnails, one per shot. Each thumbnail shows the video (or *"No video"* if not generated) with the shot number overlaid. Click a thumbnail to jump to that shot.

**Export Video** — currently disabled. Export functionality is coming soon.

> **Tip:** Generate all your clips in the Generate Clips tab first, then switch to Assemble Clips to preview the full sequence before exporting.
