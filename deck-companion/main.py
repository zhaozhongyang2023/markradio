import os


class Plugin:
    async def get_default_api_base(self):
        return os.environ.get("MOODWAVE_API_BASE", "http://127.0.0.1:38765")

    async def _main(self):
        pass

    async def _unload(self):
        pass
