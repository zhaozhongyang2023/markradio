"""deck-companion Plugin 单元测试"""
import unittest
import os
import json
import tempfile
import sys

# 设置插件目录为 deck-companion 目录
PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))

class TestPlugin(unittest.TestCase):
    """测试 Plugin.get_api_base URL 解析逻辑"""

    def setUp(self):
        # 保存原始环境变量
        self._original_env = os.environ.get("MOODWAVE_API_BASE")
        os.environ.pop("MOODWAVE_API_BASE", None)

        # 创建临时 home 目录模拟
        self.tmp_home = tempfile.mkdtemp()
        self._original_home = os.environ.get("HOME")
        os.environ["HOME"] = self.tmp_home

        # 移除可能存在的 config.json
        self.config_path = os.path.join(PLUGIN_DIR, "config.json")
        self._config_existed = os.path.exists(self.config_path)

    def tearDown(self):
        # 恢复环境
        if self._original_env is not None:
            os.environ["MOODWAVE_API_BASE"] = self._original_env
        else:
            os.environ.pop("MOODWAVE_API_BASE", None)

        if self._original_home is not None:
            os.environ["HOME"] = self._original_home

        # 清理临时文件
        import shutil
        shutil.rmtree(self.tmp_home, ignore_errors=True)

        # 恢复 config.json
        if not self._config_existed and os.path.exists(self.config_path):
            os.remove(self.config_path)

    async def _get_api_base(self):
        """内联 Plugin.get_api_base 逻辑进行测试"""
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

        env = os.environ.get("MOODWAVE_API_BASE", "")
        if env:
            return env

        return "http://127.0.0.1:38765"

    def test_default_url_when_nothing_configured(self):
        """无配置时返回默认 URL"""
        import asyncio
        result = asyncio.run(self._get_api_base())
        self.assertEqual(result, "http://127.0.0.1:38765")

    def test_env_var_takes_precedence_over_default(self):
        """环境变量优先于默认值"""
        os.environ["MOODWAVE_API_BASE"] = "http://192.168.3.121:38765"
        import asyncio
        result = asyncio.run(self._get_api_base())
        self.assertEqual(result, "http://192.168.3.121:38765")

    def test_home_config_takes_highest_precedence(self):
        """~/moodwave-config.json 优先级最高"""
        config = {"apiBase": "http://10.0.0.1:9999"}
        config_path = os.path.join(self.tmp_home, "moodwave-config.json")
        with open(config_path, "w") as f:
            json.dump(config, f)

        # 即使有环境变量，config 文件也优先
        os.environ["MOODWAVE_API_BASE"] = "http://env-var-host:8888"

        import asyncio
        result = asyncio.run(self._get_api_base())
        self.assertEqual(result, "http://10.0.0.1:9999")

    def test_config_missing_apibase_falls_through(self):
        """config.json 缺少 apiBase key 时不使用"""
        config = {"otherSetting": "value"}
        config_path = os.path.join(self.tmp_home, "moodwave-config.json")
        with open(config_path, "w") as f:
            json.dump(config, f)

        os.environ["MOODWAVE_API_BASE"] = "http://env-host:8080"

        import asyncio
        result = asyncio.run(self._get_api_base())
        self.assertEqual(result, "http://env-host:8080")


class TestPluginJson(unittest.TestCase):
    """测试 plugin.json Schema 合规性"""

    @classmethod
    def setUpClass(cls):
        manifest_path = os.path.join(PLUGIN_DIR, "plugin.json")
        with open(manifest_path, "r") as f:
            cls.manifest = json.load(f)

    def test_required_fields_present(self):
        """必需字段存在"""
        self.assertIn("name", self.manifest)
        self.assertIn("author", self.manifest)
        self.assertIn("api_version", self.manifest)
        self.assertTrue(isinstance(self.manifest["name"], str))
        self.assertTrue(len(self.manifest["name"]) > 0)

    def test_api_version_is_integer(self):
        """api_version 为整数"""
        self.assertIsInstance(self.manifest["api_version"], int)
        self.assertGreaterEqual(self.manifest["api_version"], 1)

    def test_publish_section(self):
        """publish 段存在且有 tags 和 description"""
        publish = self.manifest.get("publish", {})
        self.assertIn("tags", publish)
        self.assertIn("description", publish)
        self.assertIsInstance(publish["tags"], list)
        self.assertTrue(len(publish["tags"]) > 0)
        self.assertTrue(len(publish["description"]) > 0)

    def test_flags_is_list(self):
        """flags 为数组"""
        self.assertIsInstance(self.manifest.get("flags", []), list)


class TestDeckCompanionBuild(unittest.TestCase):
    """冒烟测试: TypeScript 编译通过"""

    def test_typescript_compiles(self):
        """npx tsc --noEmit 通过"""
        import subprocess
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            cwd=PLUGIN_DIR,
            capture_output=True,
            text=True,
            timeout=60
        )
        self.assertEqual(
            result.returncode, 0,
            f"TypeScript 编译失败:\n{result.stdout}\n{result.stderr}"
        )


if __name__ == "__main__":
    unittest.main()
