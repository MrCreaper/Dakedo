const fs = require(`fs`);
const fse = require('fs-extra');
const child = require(`child_process`);
const beautify = require('beautify');
const readline = require('readline');

const W__dirname = `Z:/${__dirname}`.replace(`//`, `/`); // we are Z, they are C

var config = {
    ProjectName: "FSD",
    ModName: "Cool modTM",
    ProjectFile: `/../FSD.uproject`,
    UnrealEngineLocation: "/home/me/Games/epic-games-store/drive_c/Program Files/Epic Games/UE_4.27",
    SteamInstall: "/home/me/.local/share/Steam/steamapps/common/Deep Rock Galactic",
    logs: "./logs.txt", // empty for no logs
    startDRG: false,
};

const configPath = `./config.json`;
const forceNew = false;
if (fs.existsSync(configPath) && !forceNew)
    config = require(configPath);

fs.writeFileSync(configPath, beautify(JSON.stringify(config), { format: 'json' }));

if (!fs.existsSync(`${config.UnrealEngineLocation}/Engine/Binaries/Win64/UE4Editor-Cmd.exe`)) return console.log(`Engine not found!\n${config.UnrealEngineLocation}/Engine/Binaries/Win64/UE4Editor-Cmd.exe`);
if (!fs.existsSync(`${config.SteamInstall}`)) return console.log(`DRG not found!\n${config.SteamInstall}`);

var logsDisabled = false;
if (!config.logs) {
    fs.mkdirSync(`./temp/`);
    config.logs = `./temp/backuplogs.txt`;
    logsDisabled = true;
}

async function exitHandler(err, skip = false) {
    if (fs.existsSync(`./temp/`))
        fs.rmSync(`./temp/`, { recursive: true, force: true });
    if (cookingChild)
        cookingChild.destroy();
    if (err && err != `SIGINT`)
        console.log(err);
    else
        console.log(`Ok.`);
    process.exit();
}

process.on('exit', exitHandler);

//catches ctrl+c event
process.on('SIGINT', exitHandler);

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler);
process.on('SIGUSR2', exitHandler);

//catches uncaught exceptions
process.on('uncaughtException', exitHandler);

fs.writeFileSync(config.logs, ``);

console.log(config);
console.log(`cooking ${config.ModName}...`);

fs.appendFileSync(config.logs, `${beautify(JSON.stringify(config), { format: 'json' })}\n`);

function pack() {
    if (fs.existsSync(`./temp/`))
        fs.rmSync(`./temp/`, { recursive: true, force: true });
    fs.mkdirSync(`./temp/`);
    fs.writeFileSync(`./temp/Input.txt`, `"${W__dirname}/temp/PackageInput/" "../../../FSD/"`);
    fse.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`, `./temp/PackageInput/Content/`, { overwrite: true });

    child.exec(`wine "${config.UnrealEngineLocation}/Engine/Binaries/Win64/UnrealPak.exe" "${W__dirname}/temp/${config.ModName}.pak" "-Create='${W__dirname}/temp/Input.txt'"`)
        .on('exit', async () => {
            console.log(`Packer fucked off.`);
            fs.rmSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}`, { recursive: true, force: true });
            fs.mkdirSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}`);
            fs.renameSync(`./temp/${config.ModName}.pak`, `${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
            fs.rmSync(`./temp/`, { recursive: true, force: true });
            console.log(`Done!`);

            if (config.startDRG)
                child.exec(`steam steam://rungameid/548430`).on(`exit`, () => console.log(`Lauched DRG`)); // most likely

            function askQuestion(query) {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });

                return new Promise(r => rl.question(query, ans => {
                    rl.close();
                    if (ans != ``) console.log(`Executing rm -R /`);
                    r(ans);
                }))
            }

            await askQuestion("Press escape to get out!");
        })
        .stdout.on('data', (d) => fs.appendFileSync(config.logs, String(d)));
}

var cookingChild = child.exec(`wine "${config.UnrealEngineLocation}/Engine/Binaries/Win64/UE4Editor-Cmd.exe" "${W__dirname}${config.ProjectFile}" "-run=cook" "-targetplatform=WindowsNoEditor"`)
    .on('exit', () => {
        var d = fs.readFileSync(config.logs);
        if (d.includes(`LogInit: Display: Success - `))
            if (!d.includes(`LogInit: Display: Success - 0 error(s),`)) {
                console.log(`Built!`);
                pack();
            } else if (!logsDisabled)
                console.log(`Failed. Check the logs and fix your damn "code"`);
            else {
                console.log(`Failed. Check the logs and-... oh wait, you disabled logs. Lucky for you, I make backups.`);
                fs.renameSync(config.logs, `./logs.txt`);
            }
        else console.log(`What the fuck did you do.`);
    })
    .stdout.on('data', (d) => fs.appendFileSync(config.logs, String(d)));