# DRG Linux Modding

## Problems with the virgin native ue4

Now some might follow [this](https://docs.unrealengine.com/4.27/en-US/SharingAndReleasing/Linux/BeginnerLinuxDeveloper/SettingUpAnUnrealWorkflow/) offical guide. But.. if you do it like that, its annoying to compile for windows, modio kinda dosent work etc. etc.

## Getting the chad wine ue4

1. Get [Lutris](https://lutris.net) (Preferably not snap)
2. Download [wine](https://github.com/lutris/docs/blob/master/WineDependencies.md) (just in case)

```sudo dpkg --add-architecture i386 && sudo apt update && sudo apt install -y wine64 wine32 libasound2-plugins:i386 libsdl2-2.0-0:i386 libdbus-1-3:i386 libsqlite3-0:i386```

3. Get [Epic Games Store](https://lutris.net/games/epic-games-store/)
4. Download Unreal Engine 4.27
- (optional) Remove optional garbage
5. Get something like the [template project](https://github.com/DRG-Modding/FSD-Template)
6. Download the [latest release](https://github.com/MrCreaper/drg-linux-modding/releases) of this (unless you wana run it raw with node) and add to the project folder, **IN ITS OWN SPECIAL LITTLE FOLDER**
- (optional) make a link to the compiler :)
7. Run for first time setup
8. Setup config.json
9. Add this file to `~/.local/applications/Unreal Engine 4.27.desktop`
```
[Desktop Entry]
Type=Application
Name=Unreal Engine 4.27
MimeType=application/uproject;
Exec=wine "/home/ME/Games/epic-games-store/drive_c/Program Files/Epic Games/UE_4.27/Engine/Binaries/Win64/UE4Editor-Cmd.exe"
Terminal=false
Icon=I have no Idea how this works
```

## development

Build w/[pkg](https://www.npmjs.com/package/pkg)