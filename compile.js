const fs = require(`fs`);
const fse = require('fs-extra');
const child = require(`child_process`);
const beautify = require('beautify');
const path = require('path');
const find = require('find-process');

(async () => {
    __dirname = path.dirname(process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0])); // fix pkg dirname
    const W__dirname = `Z:/${__dirname}`.replace(`//`, `/`); // we are Z, they are C

    var config = {
        ProjectName: "FSD",
        ModName: "Cool modTM",
        ProjectFile: `/../FSD.uproject`,
        UnrealEngineLocation: "/home/me/Games/epic-games-store/drive_c/Program Files/Epic Games/UE_4.27",
        SteamInstall: "/home/me/.local/share/Steam/steamapps/common/Deep Rock Galactic",
        logs: "./logs.txt", // empty for no logs
        startDRG: false,
        dontKillDRG: false,
        leaveWhenDone: true,
    };

    function isJsonString(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }
    const keypress = async () => {
        process.stdin.setRawMode(true)
        return new Promise(r => process.stdin.once('data', () => {
            process.stdin.setRawMode(false);
            r();
        }))
    }

    const configPath = `./config.json`;
    const forceNew = false;
    if (fs.existsSync(configPath) && !forceNew) {
        var tempconfig = fs.readFileSync(configPath);
        if (!isJsonString(tempconfig)) {
            writeConfig(config);
            console.log("Config fucked, please update it again.");
            await keypress();
            exitHandler();
            return;
        }
        tempconfig = JSON.parse(tempconfig);
        Object.keys(config).forEach(x => {
            if (tempconfig[x] && typeof config[x] == typeof tempconfig[x])
                config[x] = tempconfig[x];
        });
    }
    writeConfig(config);
    function writeConfig(c) {
        fs.writeFileSync(configPath, beautify(JSON.stringify(c), { format: 'json' }));
    }

    if (process.argv.includes(`-drg`))
        config.startDRG = !config.startDRG;

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
    var maxConfigKeyLenght = 0;
    Object.keys(config).forEach(x => {
        if (x.length > maxConfigKeyLenght)
            maxConfigKeyLenght = x.length;
    });
    Object.keys(config).forEach(x =>
        fs.appendFileSync(config.logs, `${`${x}:`.padEnd(maxConfigKeyLenght + 3)}${config[x]}\n`)
    );
    //fs.appendFileSync(config.logs, `${beautify(JSON.stringify(config), { format: 'json' })}\n`);

    function pack() {
        console.log(`packing ${config.ModName}...`);
        fs.appendFileSync(config.logs, `\npacking ${config.ModName}...\n\n`);

        if (fs.existsSync(`./temp/`) && !logsDisabled)
            fs.rmSync(`./temp/`, { recursive: true, force: true });
        else
            fs.mkdirSync(`./temp/`);
        fs.writeFileSync(`./temp/Input.txt`, `"${W__dirname}/temp/PackageInput/" "../../../FSD/"`);
        fse.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`, `./temp/PackageInput/Content/`, { overwrite: true });
        fse.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/AssetRegistry.bin`, `./temp/PackageInput/AssetRegistry.bin`, { overwrite: true });

        child.exec(`wine "${config.UnrealEngineLocation}/Engine/Binaries/Win64/UnrealPak.exe" "${W__dirname}/temp/${config.ModName}.pak" "-Create="${W__dirname}/temp/Input.txt""`)
            .on('exit', async () => {
                var d = fs.readFileSync(config.logs);
                if (d.includes(`LogPakFile: Error: Failed to load `)) {
                    console.log(`Failed to load ${d.toString().split(`\n`).find(x => x.includes(`LogPakFile: Error: Failed to load `)).replace(`LogPakFile: Error: Failed to load `, ``)}`);
                    await keypress();
                    exitHandler();
                }
                // godda kill before adding
                fs.rmSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}`, { recursive: true, force: true });
                fs.mkdirSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}`);
                fs.renameSync(`./temp/${config.ModName}.pak`, `${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
                console.log(`Done!`);

                if (config.startDRG) {
                    if (!config.dontKillDRG) {
                        var prcList = await find('name', 'FSD');
                        //console.log(prcList);
                        prcList.forEach(x => {
                            if (x.cmd.toLocaleLowerCase().replace(/\\/g, `/`).includes(`/steam/`))
                                process.kill(x.pid);
                        })
                    }
                    await new Promise(r =>
                        child.exec(`steam steam://rungameid/548430`)
                            .on(`exit`, () => {
                                console.log(`Lauched DRG`); // most likely
                                exitHandler();
                                r();
                            })
                            .stdout.on('data', (d) => fs.appendFileSync(config.logs, String(d)))
                    )
                } else
                    if (!config.leaveWhenDone) {
                        console.log("Press enter to get out!");
                        await keypress();
                        exitHandler();
                    } else exitHandler();
            })
            .stdout.on('data', (d) => fs.appendFileSync(config.logs, String(d)));
    }

    console.log(`cooking ${config.ModName}...`);
    fs.appendFileSync(config.logs, `cooking ${config.ModName}...\n`);
    var cookingChild = child.exec(`wine "${config.UnrealEngineLocation}/Engine/Binaries/Win64/UE4Editor-Cmd.exe" "${W__dirname}${config.ProjectFile}" "-run=cook" "-targetplatform=WindowsNoEditor"`)
        .on('exit', async () => {
            var d = fs.readFileSync(config.logs);
            if (d.includes(`LogInit: Display: Success - `))
                if (d.includes(`LogInit: Display: Success - 0 error(s),`)) {
                    console.log(`Cooked!`);
                    pack();
                } else if (!logsDisabled) {
                    console.log(`Failed. Check the logs and fix your damn "code"`);
                    await keypress();
                    exitHandler();
                } else {
                    console.log(`Failed. Check the logs and-... oh wait, you disabled logs. Lucky for you, I make backups.`);
                    fs.renameSync(config.logs, `./logs.txt`);
                    await keypress();
                    exitHandler();
                }
            else {
                console.log(`What the fuck did you do.`);
                await keypress();
                exitHandler();
            }
        })
        .stdout.on('data', (d) => fs.appendFileSync(config.logs, String(d)));
})();