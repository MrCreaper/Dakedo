# DRG Modding Compiler

A compiler that runs and is nice

## Config

```yaml
{
    ProjectName: "FSD", // kinda useless
    ModName: findModName(),
    ProjectFile: `/../FSD.uproject`,
    DirsToCook: [], // folder named after ModName is automaticlly included
    UnrealEngine: ``,
    SteamInstall: ``,
    CookingCmd: ``,
    PackingCmd: ``,
    UnPackingCmd: ``,
    logs: "./logs.txt", // empty for no logs
    startDRG: false,
    killDRG: true,
    logConfig: false,
    ui: true, // use the ui version by default
    backup: {
        onCompile: true,
        max: 5, // -1 for infinite
        pak: false,
        blacklist: [`.git`],
    },
    zip: {
        onCompile: true, // placed in the mods/{mod name} folder
        backups: false,
        to: [`./`], // folders to place the zip in, add the zip to the mod folder, for if you want to add the zip to github and to modio https://github.com/nickelc/upload-to-modio
    },
    modio: {
        token: ``, // https://mod.io/me/access > oauth access
        gameid: 2475,
        modid: 0,
        onCompile: false, // upload on compile
        deleteOther: true, // deletes older or non-active files
        dateVersion: true, // make version from the date year.month.date, otherwise get version from project
    },
    update: true, // automaticlly check for updates
}
```

## Compiler Options

If you are too cool for the UI you can use options. Using any options on startup disables ui.
Options require a "-" prefix (example: `./compile -drg` will toggle drg config)

- verify (verifies settings, prob)
- {mod name} (just adding a mod name will set it as the ModName for the compile)
- drg (toggles startDRG)
- bu (backups)
- lbu{id} (loads backup, exclude id to unload backup)
- listbu (lists backups)
- {pak file} (adding path to the pak file will decompile it or if you are using the release you can just drag the file on it)
- unpackdrg (unpacks drg)
- publish (publishes version to modio)
- export (uses [umodel](https://github.com/gildor2/UEViewer) to export textures, and nothing else)
- exportFlat (same as above but flattens textures to a single folder)

No "clear backups" command, you clear that on your own. Your tears.

## Install

1. Download the [latest release](https://github.com/MrCreaper/drg-linux-modding/releases/latest) of this (unless you wana run it raw with node) and add to the project folder, **IN ITS OWN SPECIAL LITTLE FOLDER**

- (optional) make a link to the compiler :)

2. Run for first time setup

- Setup config.json

### development

Build w/[pkg](https://www.npmjs.com/package/pkg)

[umodel](https://github.com/gildor2/UEViewer) is included in the project (normal wanted pnglib for some reason).

Also if you oh so wish, I have exposed some of the functions.
So you can just do `var compiler = require('./compile.js')` and mess around.
It dose use the config.json configs, keep that in mind I guess.
(or just change the config variable :D)
