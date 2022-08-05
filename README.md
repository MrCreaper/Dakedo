# DRG Linux Modding

## Problems with the virgin native ue4

Now some might follow [this](https://docs.unrealengine.com/4.27/en-US/SharingAndReleasing/Linux/BeginnerLinuxDeveloper/SettingUpAnUnrealWorkflow/) offical guide. But.. if you do it like that, its annoying to compile for windows, FSD-Template(/modio) kinda dosent work etc. etc.

## Getting the chad wine ue4

1. Get [Lutris](https://lutris.net)
2. Download [wine](https://github.com/lutris/docs/blob/master/WineDependencies.md) (just in case)
`sudo dpkg --add-architecture i386 && sudo apt update && sudo apt install -y wine64 wine32 libasound2-plugins:i386 libsdl2-2.0-0:i386 libdbus-1-3:i386 libsqlite3-0:i386`
3. Get [Epic games](https://lutris.net/games/epic-games-store/)
4. Download Unreal Engine 4.27
4.1 (optional) Remove optional garbage
5. Get something like the [template project](https://github.com/DRG-Modding/FSD-Template)
6. Download the latest release of this (unless you wana run it raw with node) and add to the project folder, **IN ITS OWN SPECIAL LITTLE FOLDER**
7. Run for first time setup
8. Setup config.json
9. (optional) make a link to the compiler :)