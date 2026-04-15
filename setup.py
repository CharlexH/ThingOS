from setuptools import setup


APP = ["mac_agent_app.py"]
OPTIONS = {
    "argv_emulation": False,
    "packages": ["server", "rumps", "websockets"],
    "plist": {
        "CFBundleName": "ThingOS",
        "CFBundleDisplayName": "ThingOS",
        "CFBundleIdentifier": "com.charlex.thingos",
        "CFBundleShortVersionString": "0.1.0",
        "CFBundleVersion": "1",
        "LSUIElement": True,
    },
}


setup(
    app=APP,
    name="ThingOS",
    options={"py2app": OPTIONS},
    setup_requires=["py2app"],
)
