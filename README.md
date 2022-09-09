# DRG Modding Compiler
A compiler that runs on anything with some quality of life features

## Compiler Options
Options require a "-" infront of them (exmaple: `./compile -drg` will toggle drg config)
- verify (verifies settings, prob)
- {mod name} (just adding a mod name will set it as the ModName for the compile)
- drg (toggles startDRG)
- bu (backups)
- lbu{id} (loads backup, exclude id to unload backup)
- listbu (lists backups)
- {pak file} (adding path to the pak file will decompile it or if you are using the release you can just drag the file on it)
- unpackdrg (unpacks drg)
- publish (publishes version to modio)

No "clear backups" command, you clear that on your own. Your tears.

## Config
```yaml
{
    ProjectName: "FSD", // kinda useless
    ModName: findModName(),
    ProjectFile: `/../FSD.uproject`,
    DirsToNeverCook: [], // folder named after ModName is automaticlly included
    UnrealEngine: ``,
    SteamInstall: ``,
    CookingCmd: ``,
    PackingCmd: ``,
    UnPackingCmd: ``,
    logs: "./logs.txt", // empty for no logs
    startDRG: false,
    dontKillDRG: false,
    backup: {
        onCompile: true,
        max: -1,
        pak: false,
        blacklist: [`.git`],
    },
    zip: {
        onCompile: true, // placed where the .pak folder is
        backups: false,
        to: [`./`], // folders to place the zip in, add the zip to the mod folder, for if you want to add the zip to github with https://github.com/nickelc/upload-to-modio
    },
    modio: {
        token: ``, // https://mod.io/me/access > oauth access
        gameid: 2475,
        modid: 0,
        onCompile: false, // upload on compile?
        deleteOther: true, // deletes older or non-active files
        dateVersion: true, // make version from the date year.month.date, otherwise get version from project
    },
}
```

### development
Build w/[pkg](https://www.npmjs.com/package/pkg)

Also if you oh so wish, I have exposed some of the functions.
So you can just do `var compiler = require('./compile.js')` and mess around.
It dose use the config.json configs, keep that in mind I guess.
(or just change the config variable :D)

# Linux Wine UE4

## [Native](https://docs.unrealengine.com/4.27/en-US/SharingAndReleasing/Linux/BeginnerLinuxDeveloper/SettingUpAnUnrealWorkflow/) pros and cons
### pros
- native speed

### cons
- a bit more work to setup
  - download, compile
  - windows compiling setup (never figured it out xd)
- converting windows projects
- no marketplace
- modio broken

## Wine pros and cons
### pros
- marketplace works
  - can use modio
- takes (prob) less time to setup
  - can download

### cons
- some graphical glitches
  - "compiling shaders" just randomlly appearing in random spots
  - frozen screen areas
  - the node menu right click can glitch and not understand wether you want the menu or to move
    - fix by alt+f2 "r"
- epic games shortcut dosent launch UE
  - so godda launch with the epic games launcher
- crashes

## Getting wine (windows) ue4

1. Get [Lutris](https://lutris.net/downloads) (Preferably not snap)
2. Download [wine](https://github.com/lutris/docs/blob/master/WineDependencies.md) (just in case)
```
sudo dpkg --add-architecture i386 && sudo apt update && sudo apt install -y wine64 wine32 libasound2-plugins:i386 libsdl2-2.0-0:i386 libdbus-1-3:i386 libsqlite3-0:i386
```
3. Get [Epic Games Store](https://lutris.net/games/epic-games-store/)
4. Download Unreal Engine 4.27
- (optional) Remove optional garbage
5. Get something like the [template project](https://github.com/DRG-Modding/FSD-Template)
6. Download the [latest release](https://github.com/MrCreaper/drg-linux-modding/releases) of this (unless you wana run it raw with node) and add to the project folder, **IN ITS OWN SPECIAL LITTLE FOLDER**
- (optional) make a link to the compiler :)
7. Run for first time setup
- Setup config.json