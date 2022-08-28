# DRG Modding Compiler
A compiler that runs on anything with some quality of life features

## Compiler Options
- {mod name} (just adding a mod name will set it as the ModName for the compile)
- drg (toggles startDRG)
- bu (backups)
- lbu{id} (loads backup, exclude id to unload backup)
- listbu (list backups)
- No "clear backups" command, you clear that on your own. Your tears.

### development
Build w/[pkg](https://www.npmjs.com/package/pkg)

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