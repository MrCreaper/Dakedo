# Dakedo

An all-in-one for everything needed to make DRG mods and more

## UI

- `up` / `w` and `down` / `s` to move
- `enter` / `return` / `space` to select
- `left` / `a` and `right` / `d` to move logs
- `tab` to go to "logMode", which just hides the options and lets you focus on the logs
- `q` to quit normally
- `ctrl+c` is abort. *Except in "input mode"
- `backspace` sends you "back" in sub-menues

### UI Menu

- Main menu
  - `cook`
    - Cook, pack, publish?, start drg?
  - `publish`
    - Only shown if modid, gameid and token are provided
  - `backup`
  - `list backups`
    - `{id} - {modname} - {since} - {size}`
      - [i] shows info
      - [v] verifies
      - [o] open in explorer
  - `settings`
  - `drg`
  - `misc`
    - `update`
      - `dakedo`
      - `project`
      - `project (`[`toucan`](https://github.com/Touci/Toucan-DRG-Framework)`)`
      - `project (`[`template`](https://github.com/DRG-Modding/FSD-Template)`)`
      - `project (unpack)`
      - `generate template`
        - Supposed to make using [UE4SS](https://github.com/UE4SS/UE4SS) simpler
    - `export`
      - `{paks from /FSD/Mods}`
        - [d] deletes the .pak folder
      - `textures`
      - `textures flat`
      - `make empty dirs`
        - Make an empty directories hierachy in the project folder
      - `drg`
    - `compile all`
    - `full backup`
    - `presets`
      - Only shown if there are presets
    - `make mod`
      - Copies Toucan framework template to /Game/{modname}
      - Only shown if Toucan framework is downloaded and /Content/template exists
    - `add desktop shortcut`
      - Only shown on linux and not added
    - `download mod`
      - [o] opens the mods folder
      - Downloads mod into /FSD/Mods/{name}/{pak}
    - `debug`
      - No.
  - `quit`
- Summon menu
  - Only shown if ProjectFile cant be found
  - `Summon Project`
    - Summon a project at its current location

## Config

```js
var config = {
    ProjectName: "FSD",
    ModName: "", // auto found | also can be a path like "_CoolGuy/CoolMod"
    ProjectFile: "/../FSD.uproject", // also general folder
    DirsToCook: [], // folder named after ModName is automaticlly included
    DirsToNeverCook: [], // example: CoolMod/debug
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
            removeMismatches: true, // remove "Mismatch size for type " since usually it dosent matter.
            removeOther: false, // Remove everything that isnt super important (use with caution)
            clearOnCook: true, // clear logs before cooking
            clearOnNewSession: true, // clear logs when started
        },
        logConfig: false, // only on cmd version
        addToTitle: false, // might couse Error sound effect
    },
    startDRG: false, // when cooked
    killDRG: true, // when starting cook
    ui: {
        enabled: true,  // use the ui version by default
        cleanBox: true, // clean logs around the options
        cleanSelected: false, // clean logs only between selection arrows
        shortcuts: [],
        selectArrows: true,
        color: "00ffff", // The shown color for this mod/preset
        bgColor: false, // Mod name color shown as background
        staticColor: true, // color mod names, false will just make cyan
    },
    backup: {
        folder: "./backups", // leave empty for no backups
        onCompile: true,
        max: 20, // -1 for infinite
        maxTotal: false, // false = Maximum backups for each mod. true = total backups. For the above value
        pak: false,
        blacklist: [".git"],
        all: false, // backup the entire project by default
        verifacation: false, // verified backups arent deleted
    },
    zip: {
        onCompile: true, // placed in the mods/{mod name} folder
        backups: false,
        to: [], // folders to copy the zip in.
    },
    modio: {
        token: "", // https://mod.io/me/access > oauth access
        apikey: "", // https://mod.io/me/access > API Access | api key for some commands
        gameid: 2475, // DRG
        modid: 0, // aka "Resource ID"
        onCompile: false, // upload on compile
        deleteOther: true, // deletes older or non-active files
        dateVersion: true, // make version from the date year.month.date, otherwise get version from project
        msPatch: true, // adds ms to the end of the dateVersion. Less prefered then default (applied when deleteOther=false).
        xm: true, // use am/pm or 24h
        updateCache: true, // update cache for the mod, no download's needed!
        changelog: false, // Ask for changelogs on publishing?
        cache: "", // auto generated
    },
    presets: {
        "release": {
            modio: {
                modid: 1,
                changelog: true,
            },
            ui: {
                color: "00ffff",
            },
        },
        "mod^2": {
            ModName: "mod2",
            modio: {
                modid: 2,
            }
        },
    },
    snakeIntervention: false, // INTERtwineing snake? :)
    forceCookByDefault: false, // force cook just ignores errors and tries to pack.
    update: true, // automaticlly update
};
```

### Config path variables

- `{UnrealEngine}`
- `{drg}`
- `{me}` - username
- `{mod}` - modname
- `{pf}` - project file (.uproject)
- `{dir}` - compiler directory (win on wine)

## Shortcuts

If you want to you can run normal nodejs code as well,
just start it with "code\n".

Example:

```js
var codeShortcut = {
    name: "hack the mainframe", // display name
    color: "00ff00", // hex color
    run: "code\nconsolelog(`Mainframe hacked!`);", // code or functions seperated by ","
    index: -1, // index on list
};
```

### Shortcut functions

- `cook` cooks and packs
- `publish` uploads current build of mod in the mods folder
- `backup` backups
- `refreshDirsToNeverCook` Refreshes ./Config/DefaultGame.ini > DirectoriesToNeverCook list

## Compiler Options

If you are too cool for the UI you can use options. Using any options disables ui.
Default is cooking.

- `{mod name}` just adding a mod name will set it as the ModName for the compile
- `{pak file}` adding path to the pak file will decompile it or if you are using the release you can just drag the file on it
- `-verify` verifies settings, prob
- `-drg` toggles startDRG
- `-bu` backups
- `-lbu{id}` loads backup, exclude id to unload backup) (NOTE: dose not load all of "full" backups
- `-listbu` lists backups
- `-unpackdrg` unpacks drg
- `-publish` publishes version to modio
- `-export` uses [umodel](https://github.com/gildor2/UEViewer) to export textures, and nothing else
- `-exportFlat` same as above but flattens textures to a single folder

### About updating

When "updating (unpack)" it wipes all the folders that are included in the unpack.
To avoid your mod gettings wiped, we search through the config and presets and dont update folders that are in use.
Its not a constant worry but its good to keep it in mind.

## Install

Make the folder hieracy something like this (or u know edit the [config](#config) ??\\\_(???)\_/??)

- FSD
  - FSD.uproject
  - compiler
    - [compiler.exe](https://github.com/MrCreaper/dakedo/releases/latest)
    - [config.json](#config) (generated on first run)

### Development

Build with `npm run pkg`

[umodel](https://github.com/gildor2/UEViewer) is included in the project (normal wanted pnglib for some reason).
