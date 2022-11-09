# DRG Modding Compiler

A compiler that runs and is nice

## UI

Move with `up`/`w` and `down`/`s`, `left`/`a` and `right`/`d` to move logs and `enter`/`return`/`space` to select.
`tab` to go to "logMode", which just hides the options and lets you focus on the logs.

p.s `ctrl+c` = abort. So please use `q` or the quit option.

## Config

```js
var config = {
    ProjectName: "FSD",
    ModName: ``, // auto found
    ProjectFile: "/../FSD.uproject", // also general folder
    DirsToCook: [], // folder named after ModName is automaticlly included
    UnrealEngine: "", // auto generated
    drg: "", // auto generated
    cmds: {
        Cooking: "", // auto generated DONT FUCKING USE -Compressed
        Packing: "", // auto generated
        UnPacking: "", // auto generated
        CompileAll: "", // auto generated
    },
    logging: {
        file: "./logs.txt", // empty for no logs
        external: [], // show new logs from another file
        cleaning: {
            misc: true, // cleans up paths, and a few more
            prefixes: true, // Removes Log{something}:
            removeWarnings: true, // Remove lines containing "Warning: "
            removeOther: false, // Remove everything that isnt super important (use with caution)
            clearOnCook: true, // clear logs before cooking
            clearOnNewSession: true, // clear logs when started
        },
        logConfig: false, // only on cmd version
        staticColor: true, // color mod names
    },
    startDRG: false, // when cooked
    killDRG: true, // when starting cook
    ui: {
        enabled: true,  // use the ui version by default
        cleanBox: true, // clean logs around the options
        cleanSelected: false, // clean logs only between selection arrows
        shortcuts: [
            /*{
                name: "cook & publish", // display name
                color: "00f0f0", // hex color
                run: "cook,publish", // functions
                index: 2, // index on list
            },*/
        ],
        selectArrows: true,
    },
    backup: {
        folder: "./backups", // leave empty for no backups
        onCompile: true,
        max: 5, // -1 for infinite
        pak: false,
        blacklist: [".git"],
        all: false, // backup the entire project by default
    },
    zip: {
        onCompile: true, // placed in the mods/{mod name} folder
        backups: false,
        to: ["./"], // folders to place the zip in. Add the zip to the current folder, for if you want to add the zip to github and to modio https://github.com/nickelc/upload-to-modio
    },
    modio: {
        token: "", // https://mod.io/me/access > oauth access
        gameid: 2475, // DRG
        modid: 0, // aka "Resource ID"
        onCompile: false, // upload on compile
        deleteOther: true, // deletes older or non-active files
        dateVersion: true, // make version from the date year.month.date, otherwise get version from project
        msPatch: true, // adds ms to the end of the dateVersion. Less prefered then default (applied when deleteOther=false).
        xm: true, // use am/pm or 24h
        updateCache: true, // update cache for the mod, no download's needed!
        cache: "", // auto generated
    },
    presets: {
        "release": {
            modio: {
                modid: 1,
            }
        },
        "mod^2": {
            ModName: `mod2`,
            modio: {
                modid: 2,
            }
        },
    },
    update: true, // automaticlly update
};
```

### Config path variables

- {UnrealEngine}
- {drg}
- {me} - username
- {mod} - modname
- {pf} - project file (.uproject)
- {dir} - compiler directory (win on wine)

## Shortcuts

If you dont want to do a simple cook & publish then you can just run normal nodejs code as well,
just start it with "code{newline}".

Example:

```js
{
    name: "hack the mainframe",
    color: "00ff00",
    run: "code
    consolelog(`Mainframe hacked!`);",
    index: -1,
}
```

### Shortcut functions

- cook (cooks and packs)
- publish (uploads current build of mod in the mods folder)
- backup (backups)
- refreshDirsToNeverCook (Refreshes ./Config/DefaultGame.ini > DirectoriesToNeverCook list)

## Compiler Options

If you are too cool for the UI you can use options. Using any options disables ui.

- -verify (verifies settings, prob)
- {mod name} (just adding a mod name will set it as the ModName for the compile)
- -drg (toggles startDRG)
- -bu (backups)
- -lbu{id} (loads backup, exclude id to unload backup) (NOTE: dose not load all of "full" backups)
- -listbu (lists backups)
- {pak file} (adding path to the pak file will decompile it or if you are using the release you can just drag the file on it)
- -unpackdrg (unpacks drg)
- -publish (publishes version to modio)
- -export (uses [umodel](https://github.com/gildor2/UEViewer) to export textures, and nothing else)
- -exportFlat (same as above but flattens textures to a single folder)

No "clear backups" command, you clear that on your own. Your tears.

## Install

1. Download the [latest release](https://github.com/MrCreaper/drg-linux-modding/releases/latest)
2. Make the folder hieracy something like this (or u know edit the config ¯\\\_(ツ)\_/¯)
   - FSD
     - FSD.uproject
     - compiler
       - compiler.exe

3. Skim over/setup the config.json

### development

Build with `npm run pkg`

[umodel](https://github.com/gildor2/UEViewer) is included in the project (normal wanted pnglib for some reason).

Also if you oh so wish, I have exposed some of the functions.
So you can just do

```js
var compiler = require('./compile.js');
compiler.cook(); // or something
```

and mess around.
