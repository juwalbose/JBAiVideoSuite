import json
import re
import os

class PlaygroundParser:
    def __init__(self):
        # Define our known roles and their expected data types for the UI
        self.role_definitions = {
            "prompt": "string",
            "width": "int",
            "height": "int",
            "seed": "int"
        }

    def parse(self, workflow_path):
        """
        Parses a ComfyUI JSON file and returns a structured Playground Object.
        :param workflow_path: Path to the .json file (relative to backend root)
        :return: Dictionary containing inputs, output type, and validity.
        """
        # Use path relative to this file (backend/routes/playground_parser.py)
        # Up 3 levels from here reaches the project root
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        full_path = os.path.join(base_dir, "assets", "workflows", workflow_path.replace(".json", ""))
        if not full_path.endswith(".json"):
            full_path += ".json"

        if not os.path.exists(full_path):
            return {"is_valid": False, "error": f"File not found: {full_path}"}

        with open(full_path, 'r') as f:
            data = json.load(f)

        playground_obj = {
            "workflow_name": full_path.split('/')[-1].replace('.json', '').replace('_', ' '),
            "inputs": {},
            "output_type": None,
            "is_valid": False
        }

        output_nodes = []

        for node_id, node_data in data.items():
            title = node_data.get('_meta', {}).get('title', '')
            match = re.search(r'\((Input|Output):(\w+)\)', title, re.IGNORECASE)
            
            if match:
                tag = match.group(1).lower()
                role = match.group(2).lower()

                if tag == "input":
                    if role in self.role_definitions:
                        node_inputs = node_data.get("inputs", {})
                        default_val = node_inputs.get(role, node_inputs.get("value", "..."))
                        
                        if isinstance(default_val, list):
                            default_val = default_val[0]

                        playground_obj["inputs"][role] = {
                            "type": self.role_definitions[role],
                            "value": default_val
                        }
                
                elif tag == "output":
                    if role in ["image", "video"]:
                        output_nodes.append(role)

        # A workflow is valid only if it has exactly one output node
        if len(output_nodes) == 1:
            playground_obj["output_type"] = output_nodes[0]
            playground_obj["is_valid"] = True
            playground_obj["invalid_reason"] = None
        elif len(output_nodes) > 1:
            playground_obj["output_type"] = f"{len(output_nodes)} outputs"
            playground_obj["is_valid"] = False
            playground_obj["invalid_reason"] = "Multiple outputs detected"
        else:
            playground_obj["output_type"] = "None"
            playground_obj["is_valid"] = False
            playground_obj["invalid_reason"] = "No output nodes found"

        return playground_obj
