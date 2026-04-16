from setuptools import setup


APP = ["mac_agent_app.py"]
DATA_FILES = [
    (
        "resources",
        [
            "resources/icon.png",
            "resources/icon@2x.png",
        ],
    ),
]
OPTIONS = {
    "argv_emulation": False,
    "packages": ["server", "rumps", "websockets"],
    "plist": {
        "CFBundleName": "ThingOS",
        "CFBundleDisplayName": "ThingOS",
        "CFBundleIdentifier": "com.charlex.thingos",
        "CFBundleShortVersionString": "0.2.0",
        "CFBundleVersion": "2",
        "LSUIElement": True,
    },
}


setup(
    app=APP,
    name="ThingOS",
    data_files=DATA_FILES,
    options={"py2app": OPTIONS},
    setup_requires=["py2app"],
)
