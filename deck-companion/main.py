import os
import json

PLUGIN_DIR = os.path.dirname(os.path.realpath(__file__))

class Plugin:
    async def get_api_base(self):
        # 1. config.json (try home dir first, then plugin dir)
        config_paths = [
            os.path.join(os.path.expanduser("~"), "moodwave-config.json"),
            os.path.join(PLUGIN_DIR, "config.json")
        ]
        cfg = None
        for p in config_paths:
            try:
                with open(p, 'r') as f:
                    cfg = json.load(f)
                    break
            except Exception:
                continue
        if cfg and cfg.get("apiBase"):
            return cfg["apiBase"]
        # 2. env var
        env = os.environ.get("MOODWAVE_API_BASE", "")
        if env:
            return env
        # 3. default
        return "http://127.0.0.1:38765"

    async def _main(self):
        pass

    async def _unload(self):
        pass
