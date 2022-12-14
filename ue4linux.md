# Linux Wine UE4

## [Native](https://docs.unrealengine.com/4.27/en-US/SharingAndReleasing/Linux/BeginnerLinuxDeveloper/SettingUpAnUnrealWorkflow/) pros and cons

### Pros

- native speed

### Cons

- a bit more work to setup
  - download, compile
  - windows compiling setup (never figured it out xd)
- converting windows projects
- no marketplace
- modio broken

### Setup script

This is gonna take a couple of hours

Run this in the [github download for 4.27.2](https://github.com/EpicGames/UnrealEngine/tree/4.27-plus)

```bash
./Setup.sh && ./GenerateProjectFiles.sh && make
```

### To start

```bash
./Engine/Binaries/Linux/UE4Editor
```

### Recompile a project

```bash
./Engine/Build/BatchFiles/Linux/Build.sh Linux Development -Project=/home/.../FSD/FSD.uproject -TargetType=Editor
```

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
    - fix by alt+tab ing (or alt+f2 "r")
- epic games shortcut dosent launch UE
  - so godda launch with the epic games launcher
- crashes

## Getting wine (windows) ue4

1. Get [Lutris](https://lutris.net/downloads) (Preferably not snap)
2. Download [wine](https://github.com/lutris/docs/blob/master/WineDependencies.md) (just in case)

```sh
sudo dpkg --add-architecture i386 && sudo apt update && sudo apt install -y wine64 wine32 libasound2-plugins:i386 libsdl2-2.0-0:i386 libdbus-1-3:i386 libsqlite3-0:i386
```

3. Get [Epic Games Store](https://lutris.net/games/epic-games-store/)
4. Download Unreal Engine 4.27

- (optional) Remove optional garbage

5. Get something like the [template project](https://github.com/DRG-Modding/FSD-Template)
