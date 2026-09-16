"""
Shared filesystem paths for the backend.

All paths are derived from this file's location (backend/paths.py),
so they work regardless of the process working directory.

Repo layout:
    <repo>/
      backend/
        paths.py          <- this file
        main.py
        routes/
          *.py
      assets/
        generated/
        systemprompts/
        workflows/
        audio/
"""
import os

# backend/ directory (parent of this file)
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

# repo root (parent of backend/)
ROOT_DIR = os.path.dirname(BACKEND_DIR)

# assets/ directory (sibling of backend/)
ASSETS_DIR = os.path.join(ROOT_DIR, "assets")

# Common subdirectories
GENERATED_DIR = os.path.join(ASSETS_DIR, "generated")
PROMPTS_DIR = os.path.join(ASSETS_DIR, "systemprompts")
WORKFLOWS_DIR = os.path.join(ASSETS_DIR, "workflows")
AUDIO_DIR = os.path.join(ASSETS_DIR, "audio")
