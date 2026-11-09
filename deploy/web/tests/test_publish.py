import importlib.util
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("publish", Path(__file__).parents[1] / "publish.py")
web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)
SHA = "a" * 40


class ConfigurationTest(unittest.TestCase):
    def setUp(self):
        self.env = dict(RELEASE_SHA=SHA, QINIU_WEB_BUCKET="freeligo-web",
                        QINIU_WEB_ORIGIN="https://www.example.com",
                        VITE_API_BASE_URL="https://api.example.com",
                        QINIU_SPA_FALLBACK_READY="true")

    def test_production_configuration_and_restore_sha(self):
        self.assertEqual(web.configuration(self.env)["sha"], SHA)
        self.env["RESTORE_SHA"] = "b" * 40
        self.assertEqual(web.configuration(self.env)["sha"], "b" * 40)

    def test_invalid_or_unprepared_configuration_is_blocked(self):
        for key, value in (("VITE_API_BASE_URL", "http://localhost:8070"),
                           ("QINIU_WEB_ORIGIN", "https://test.hd-bkt.clouddn.com"),
                           ("QINIU_WEB_ORIGIN", "https://8.160.114.222"),
                           ("QINIU_WEB_ORIGIN", "https://user:password@example.com"),
                           ("QINIU_SPA_FALLBACK_READY", "false"),
                           ("RESTORE_SHA", "main")):
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                web.configuration(dict(self.env, **{key: value}))


class PublishTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dist = Path(self.temp.name)
        (self.dist / "assets").mkdir()
        (self.dist / "assets/app.js").write_bytes(b"console.log('ok')")
        self.content = (f'<script type="module" src="/releases/{SHA}/assets/app.js"></script>').encode()
        (self.dist / "index.html").write_bytes(self.content)
        self.config = dict(sha=SHA, origin="https://www.example.com", restore=False)
        self.storage = Mock()
        self.result = dict(status="failed", entry_may_have_changed=False)

    def fetch(self, url, html=False):
        return b"console.log('ok')" if url.endswith(".js") else self.content

    def publish(self):
        with patch.object(web, "fetch", side_effect=self.fetch):
            web.publish(self.config, self.storage, self.result, self.dist)

    def test_all_resources_precede_root_entry_and_success_is_verified(self):
        self.publish()
        keys = [call.args[0] for call in self.storage.upload.call_args_list]
        self.assertEqual(keys, [f"releases/{SHA}/assets/app.js", f"releases/{SHA}/index.html", "index.html"])
        self.assertEqual(self.result["status"], "success")
        self.storage.refresh.assert_called_once()

    def test_upload_failure_cannot_switch_entry(self):
        self.storage.upload.side_effect = RuntimeError("upload failed")
        with self.assertRaises(RuntimeError):
            self.publish()
        self.assertFalse(self.result["entry_may_have_changed"])
        self.storage.refresh.assert_not_called()

    def test_public_asset_failure_cannot_switch_entry(self):
        with patch.object(web, "fetch", side_effect=OSError("CDN failed")), self.assertRaises(OSError):
            web.publish(self.config, self.storage, self.result, self.dist)
        self.assertFalse(self.result["entry_may_have_changed"])
        self.assertNotIn("index.html", [call.args[0] for call in self.storage.upload.call_args_list])

    def test_refresh_failure_reports_possible_entry_change(self):
        self.storage.refresh.side_effect = RuntimeError("refresh failed")
        with self.assertRaises(RuntimeError):
            self.publish()
        self.assertTrue(self.result["entry_may_have_changed"])
        self.assertEqual(self.result["status"], "failed")

    def test_stale_root_or_missing_route_fallback_is_not_reported_success(self):
        def stale(url, html=False):
            return self.fetch(url, html) if "/releases/" in url else b"old entry"
        with patch.object(web, "fetch", side_effect=stale), \
                patch.object(web.time, "monotonic", side_effect=[0, 0, 181]), \
                patch.object(web.time, "sleep"), self.assertRaises(ValueError):
            web.publish(self.config, self.storage, self.result, self.dist)
        self.assertTrue(self.result["entry_may_have_changed"])
        self.assertEqual(self.result["status"], "failed")

    def test_restore_uses_original_entry_without_rebuilding_or_overwriting_resources(self):
        self.config["restore"] = True
        self.publish()
        self.assertEqual([call.args[0] for call in self.storage.upload.call_args_list], ["index.html"])
        self.assertEqual(self.result["status"], "success")

    def test_wrong_asset_base_or_source_map_is_rejected(self):
        (self.dist / "assets/app.js.map").write_text("source map")
        with self.assertRaises(ValueError):
            self.publish()
        self.storage.upload.assert_not_called()
        with self.assertRaises(ValueError):
            web.entry_assets(b'<script src="/assets/app.js"></script>', SHA)


class ImmutableStorageTest(unittest.TestCase):
    def test_same_commit_with_changed_build_is_rejected(self):
        storage = web.QiniuStorage.__new__(web.QiniuStorage)
        storage.sdk = SimpleNamespace(etag=lambda _: "new-hash")
        storage.bucket = "freeligo-web"
        storage.manager = Mock()
        storage.manager.stat.return_value = ({"hash": "old-hash"}, SimpleNamespace(status_code=200))
        with self.assertRaises(ValueError):
            storage.upload("releases/sha/index.html", Path("index.html"))


if __name__ == "__main__":
    unittest.main()
