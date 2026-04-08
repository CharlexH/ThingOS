import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class MacPackagingTests(unittest.TestCase):
    def test_has_py2app_setup_entrypoint(self) -> None:
        setup_py = ROOT / "setup.py"
        self.assertTrue(setup_py.exists(), "setup.py is missing")
        content = setup_py.read_text()
        self.assertIn("py2app", content)
        self.assertIn('APP = ["mac_agent_app.py"]', content)
        self.assertIn("LSUIElement", content)

    def test_has_mac_app_launcher_that_calls_agent_main(self) -> None:
        launcher = ROOT / "mac_agent_app.py"
        self.assertTrue(launcher.exists(), "mac_agent_app.py is missing")
        content = launcher.read_text()
        self.assertIn("from server.agent import main", content)
        self.assertIn("main()", content)


if __name__ == "__main__":
    unittest.main()
