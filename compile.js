const fs = require(`fs`);
const fse = require('fs-extra');
const child = require(`child_process`);
const beautify = require('beautify');

const W__dirname = `Z:/${__dirname}`.replace(`//`, `/`); // we are Z, they are C

var config = {
    ProjectName: "FSD",
    ModName: "Cool modTM",
    ProjectFile: `/../FSD.uproject`,
    UnrealEngineLocation: "/home/me/Games/epic-games-store/drive_c/Program Files/Epic Games/UE_4.27",
    SteamInstall: "/home/me/.local/share/Steam/steamapps/common/Deep Rock Galactic",
    logs: "./logs.txt", // empty for fuck off
    startDRG: false,
};

const configPath = `./config.json`;
const forceNew = false;
if (fs.existsSync(configPath) && !forceNew)
    config = require(configPath);

fs.writeFileSync(configPath, beautify(JSON.stringify(config), { format: 'json' }));

if (!fs.existsSync(`${config.UnrealEngineLocation}/Engine/Binaries/Win64/UE4Editor-Cmd.exe`)) return console.log(`Engine not found!`);

fs.writeFileSync(config.logs, ``);

console.log(config);
console.log(`cooking ${config.ModName}...`);

fs.appendFileSync(config.logs, `${beautify(JSON.stringify(config), { format: 'json' })}\n`);

function pack() {
    fs.mkdirSync(`./Temp/`);
    fs.writeFileSync(`./Temp/Input.txt`, `"${W__dirname}/Temp/PackageInput/" "../../../FSD/"`);
    fse.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`, `./Temp/PackageInput/Content/`, { overwrite: true });

    console.log(`wine "${config.UnrealEngineLocation}/Engine/Binaries/Win64/UnrealPak.exe" "${W__dirname}/Temp/${config.ModName}.pak" "-Create='${W__dirname}/Temp/Input.txt'"`)

    child.exec(`wine "${config.UnrealEngineLocation}/Engine/Binaries/Win64/UnrealPak.exe" "${W__dirname}/Temp/${config.ModName}.pak" "-Create='${W__dirname}/Temp/Input.txt'"`)
        .on('exit', () => {
            console.log(`Packer fucked off.`);
            fs.rmSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}`, { recursive: true, force: true });
            fs.mkdirSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}`);
            fs.renameSync(`./Temp/${config.ModName}.pak`, `${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
            fs.rmSync(`./Temp/`, { recursive: true, force: true });
            console.log(`Done!`);
            if(config.startDRG)
            child.exec(`steam steam://rungameid/548430`).on(`exit`, () => console.log(`Lauched DRG`)); // most likely
        })
        .stdout.on('data', (d) => fs.appendFileSync(config.logs, String(d)));
}

child.exec(`wine "${config.UnrealEngineLocation}/Engine/Binaries/Win64/UE4Editor-Cmd.exe" "${W__dirname}${config.ProjectFile}" "-run=cook" "-targetplatform=WindowsNoEditor"`)
    .on('exit', () => {
        var d = fs.readFileSync(config.logs);
        if (d.includes(`LogInit: Display: Success - `))
            if (d.includes(`LogInit: Display: Success - 0 error(s),`)) {
                console.log(`Built!`);
                pack();
            } else console.log(`Failed. Check the logs and fix your damn "code"`);
            else console.log(`What the fuck did you do.`);
    })
    .stdout.on('data', (d) => fs.appendFileSync(config.logs, String(d)));