import json
import re
from fastapi import APIRouter, Depends
from typing import Any
from database import get_db
from routes.llm_helper import get_system_prompt, call_llm

router = APIRouter(prefix="/projects", tags=["Takes"])


@router.get("/{id}/takes")
async def get_takes(id: str, episode: int = 1, db: Any = Depends(get_db)):
    takes = await db.take.find_many(where={'projectId': id, 'episode': episode})
    takes.sort(key=lambda t: t.endShotIndex)
    return [t.dict() for t in takes]


@router.post("/{id}/takes")
async def save_takes(id: str, payload: dict, episode: int = 1, db: Any = Depends(get_db)):
    """Upsert takes keyed by (projectId, episode, endShotIndex). Preserves existing IDs."""
    takes = payload.get('takes', [])
    created = 0
    updated = 0

    incoming_end_shots = {t.get('endShotIndex', 0) for t in takes}

    async with db.tx() as tx:
        # Delete takes that are no longer in the payload
        existing_takes = await tx.take.find_many(where={'projectId': id, 'episode': episode})
        for et in existing_takes:
            if et.endShotIndex not in incoming_end_shots:
                await tx.take.delete(where={'id': et.id})

        # Upsert the current takes
        for t in takes:
            end_shot = t.get('endShotIndex', 0)
            prompt = t.get('prompt', '')

            existing = await tx.take.find_first(where={
                'projectId': id, 'episode': episode, 'endShotIndex': end_shot
            })

            video_path = t.get('videoPath') or None

            if existing:
                await tx.take.update(where={'id': existing.id}, data={'prompt': prompt, 'videoPath': video_path})
                updated += 1
            else:
                await tx.take.create({
                    'projectId': id,
                    'episode': episode,
                    'endShotIndex': end_shot,
                    'prompt': prompt,
                    'videoPath': video_path,
                })
                created += 1

    return {"status": "success", "count": len(takes), "created": created, "updated": updated}


@router.delete("/{id}/takes/{take_id}")
async def delete_take(id: str, take_id: str, episode: int = 1, db: Any = Depends(get_db)):
    await db.take.delete(where={'id': take_id})
    return {"status": "success"}


@router.delete("/{id}/takes")
async def delete_takes(id: str, episode: int = 1, db: Any = Depends(get_db)):
    await db.take.delete_many(where={'projectId': id, 'episode': episode})
    return {"status": "success"}


def extract_scene(script: str, scene_num: int) -> str:
    pattern = rf'(## Scene {scene_num}:\s*.+?)(?=\n## Scene |\Z)'
    match = re.search(pattern, script, re.DOTALL)
    return match.group(1).strip() if match else ''


def get_state_desc(asset, state_id: str | None) -> str:
    parts = [asset.description or '']
    if state_id:
        for state in (asset.states or []):
            if state.id == state_id and state.description:
                parts.append(state.description)
                break
    return ' '.join(p for p in parts if p).strip()


def parse_json_field(val: any) -> list:
    if isinstance(val, list):
        return val
    if isinstance(val, str) and val.startswith('['):
        try:
            return json.loads(val)
        except Exception:
            return []
    return []


@router.post("/{id}/takes/generate-prompt")
async def generate_take_prompt(id: str, payload: dict, episode: int = 1, db: Any = Depends(get_db)):
    system_prompt = await get_system_prompt(db, "Generate Take Video Prompt")
    if not system_prompt:
        return {"status": "error", "details": "No system prompt mapped for 'Generate Take Video Prompt'."}

    try:
        shots = payload.get('shots', [])
        if not shots:
            return {"status": "error", "details": "No shots provided."}

        script = await db.script.find_first(where={'projectId': id, 'episode': episode})
        script_text = script.content if script else ''

        # Group shots by scene, preserving order
        scenes: dict[int, list] = {}
        for s in shots:
            scene_num = int(s.get('scene', 0))
            scenes.setdefault(scene_num, []).append(s)

        total_duration = sum(float(s.get('duration', 0)) for s in shots)

        parts: list[str] = []
        parts.append(f"Total Take Duration: {total_duration:.2f}s")

        for scene_num in sorted(scenes.keys()):
            scene_shots = scenes[scene_num]
            scene_text = extract_scene(script_text, scene_num) if script_text else ''

            # Scene header + full scene text
            if scene_text:
                parts.append(f"Scene {scene_num}:\n{scene_text}")
            else:
                parts.append(f"Scene {scene_num}:")

            # Per-shot details within this scene
            for s in scene_shots:
                shot_num = s.get('shot', 0)
                beats = s.get('beats', [])
                if isinstance(beats, str):
                    beats = json.loads(beats) if beats.startswith('[') else [int(x) for x in beats.replace('[]', '').split(',') if x.strip()]
                beat_list = ', '.join(str(b) for b in beats) if beats else 'unknown'

                shot_block = (
                    f"Shot {shot_num}:\n"
                    f"- Target Beats: {beat_list}\n"
                    f"- Camera: {s.get('camera', '')}\n"
                    f"- Action: {s.get('action', '')}\n"
                    f"- Dialogue: {s.get('dialogue', '')}"
                )

                # Audio instructions for this shot
                scene_audio_id = s.get('sceneDialogAudioId')
                char_audio_ids = parse_json_field(s.get('characterAudioIds', []))
                char_ids = parse_json_field(s.get('characterAssetIds', []))
                if scene_audio_id:
                    shot_block += "\n- Audio: Use the attached audio reference as the complete synchronized dialogue track for this shot."
                elif char_audio_ids:
                    for i, caid in enumerate(char_audio_ids):
                        if not caid:
                            continue
                        char_name = f"Character {i + 1}"
                        if i < len(char_ids) and char_ids[i]:
                            ch = await db.asset.find_first(where={'id': char_ids[i], 'projectId': id})
                            if ch:
                                char_name = ch.name
                        shot_block += f"\n- Audio: Use audio reference {i + 1} as the voice-timbre reference for {char_name}."

                parts.append(shot_block)

        # Consolidated reference assets (deduplicated across all shots in the take)
        asset_lines: list[str] = []
        seen_loc: set[str] = set()
        seen_char: set[str] = set()
        seen_prop: set[str] = set()

        for s in shots:
            loc_id = s.get('locationAssetId')
            loc_state = s.get('locationStateId')
            if loc_id and loc_id not in seen_loc:
                seen_loc.add(loc_id)
                loc = await db.asset.find_first(where={'id': loc_id, 'projectId': id}, include={'states': True})
                if loc:
                    asset_lines.append(f"- Location: {loc.name} — {get_state_desc(loc, loc_state)}")

            char_ids = parse_json_field(s.get('characterAssetIds', []))
            char_states = parse_json_field(s.get('characterStateIds', []))
            for i, cid in enumerate(char_ids):
                if not cid or cid in seen_char:
                    continue
                seen_char.add(cid)
                ch = await db.asset.find_first(where={'id': cid, 'projectId': id}, include={'states': True})
                if ch:
                    state_id = char_states[i] if i < len(char_states) else None
                    asset_lines.append(f"- Character: {ch.name} — {get_state_desc(ch, state_id)}")

            prop_ids = parse_json_field(s.get('propAssetIds', []))
            prop_states = parse_json_field(s.get('propStateIds', []))
            for i, pid in enumerate(prop_ids):
                if not pid or pid in seen_prop:
                    continue
                seen_prop.add(pid)
                pr = await db.asset.find_first(where={'id': pid, 'projectId': id}, include={'states': True})
                if pr:
                    state_id = prop_states[i] if i < len(prop_states) else None
                    asset_lines.append(f"- Prop: {pr.name} — {get_state_desc(pr, state_id)}")

        if asset_lines:
            parts.append("Reference Assets:\n" + '\n'.join(asset_lines))

        # Background music — use the first shot's music settings
        first_shot = shots[0]
        if first_shot.get('musicOn'):
            parts.append(f"Background Music: {first_shot.get('musicDesc', '')}")
        else:
            parts.append("Background Music: None — do not include any background music.")

        user_content = '\n\n'.join(parts)
        print(f"\n{'='*60}\n[GENERATE TAKE PROMPT] Take (shots {shots[0].get('shot', '?')}–{shots[-1].get('shot', '?')}) — user content sent to LLM:\n{'='*60}\n{user_content}\n{'='*60}\n")
        result = await call_llm(db, system_prompt, user_content)
        return {"status": "success", "prompt": result}
    except Exception as e:
        return {"status": "error", "details": str(e)}
