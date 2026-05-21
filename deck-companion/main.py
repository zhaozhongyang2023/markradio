import os
import json

PLUGIN_DIR = os.path.dirname(os.path.realpath(__file__))

class Plugin:
    async def get_api_base(self):
        # 1. config.json in plugin directory
        config_path = os.path.join(PLUGIN_DIR, "config.json")
        try:
            with open(config_path, 'r') as f:
                cfg = json.load(f)
                if cfg.get("apiBase"):
                    return cfg["apiBase"]
        except Exception:
            pass
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
