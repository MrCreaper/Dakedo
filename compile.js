const fs = require(`fs`);
const fse = require('fs-extra');
const child = require(`child_process`);
const beautify = require('beautify');
const path = require('path');
const find = require('find-process');
const https = require(`https`);
const os = require(`os`);

function formatTime(time) {
    var weeks = Math.abs(Math.floor(time / (1000 * 60 * 60 * 24 * 7)));
    var days = Math.abs(Math.floor(time / (1000 * 60 * 60 * 24)));
    var hours = Math.abs(Math.floor((time % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
    var minutes = Math.abs(Math.floor((time % (1000 * 60 * 60)) / (1000 * 60)));
    var seconds = Math.abs(Math.floor((time % (1000 * 60)) / 1000));
    var t = "";
    if (weeks) t += ` ${weeks}w`
    if (days) t += ` ${days}d`
    if (hours) t += ` ${hours}h`
    if (minutes) t += ` ${minutes}min`
    if (seconds) t += ` ${seconds}s`
    return t;
}

(async () => {
    __dirname = path.dirname(process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0])); // fix pkg dirname
    async function update() {
        const version = require(`${__dirname}/package.json`).version;
        const repo = `MrCreaper/drg-linux-modding`;
        return new Promise(async r => {
            var resp = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
            resp = await resp.json();
            if (resp.tag_name == version && !resp.draft && !resp.prerelease)
                r();
            else {
                const asset = resp.assets.find(x => x.name.includes(os.platform()));
                if (!asset) return console.log(`No compatible update download found.. (${os.platform()})`);
                console.log(`Downloading update...`);
                //if (!fs.accessSync(__dirname)) return console.log(`No access to local dir`);
                download(asset.browser_download_url);
                function download(url) {
                    https.get(url, down => {
                        if (down.headers.location) return download(down.headers.location); // github redirects to their cdn, and https dosent know redirects :\
                        var file = fs.createWriteStream(`${__dirname}/${asset.name.replace(`-${os.platform()}`, ``)}`);
                        down.pipe(file
                            .on(`finish`, () => {
                                file.close();
                                console.log(`Update finished! ${version} => ${resp.tag_name}`);
                                r();
                            }))
                    });
                }
            }
        });
    }
    await update();
    const W__dirname = `Z:/${__dirname}`.replace(`//`, `/`); // we are Z, they are C

    var ignoredDirs = [];
    fs.readFileSync(`${__dirname}/../Config/DefaultGame.ini`,`utf8`).split(`\n`).forEach(x => {
        ignoredDirs.push(x.replace(`+DirectoriesToNeverCook=(Path="/Game/`, ``).replace(`")`, ``));
    });

    function findModName() {
        var name = ``;
        fs.readdirSync(`${__dirname}/../Content`).forEach(x => {
            if (ignoredDirs.includes(x)) return;
            name = x;
        });
        return name;
    }

    var config = {
        ProjectName: "FSD",
        ModName: findModName(),
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

    const configPath = `${__dirname}/config.json`;
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
        fs.mkdirSync(`${__dirname}/temp/`);
        config.logs = `${__dirname}/temp/backuplogs.txt`;
        logsDisabled = true;
    }

    async function exitHandler(err, skip = false) {
        if (fs.existsSync(`${__dirname}/temp/`))
            fs.rmSync(`${__dirname}/temp/`, { recursive: true, force: true });
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

    if (!fs.existsSync(`${__dirname}/../Content/${config.ModName}`)) return console.log(`Your mod couldnt be found, ModName should be the same as in the content folder.`);

    if (process.argv.includes(`-bu`))
        return backup();

    function backup() {
        console.log(`Making backup...`);
        if (!fs.existsSync(`${__dirname}/backups`))
            fs.mkdirSync(`${__dirname}/backups`);
        const id = fs.readdirSync(`${__dirname}/backups`).length;
        var buf = `${__dirname}/backups/${id} - ${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')}`;
        fs.mkdirSync(buf);
        fse.copySync(`${__dirname}/${config.ModName}`, `${buf}/${config.ModName}`);
        console.log(`Backup done! id: ${id}`);
    }

    if (process.argv.find(x => x.includes(`-lbu`)))
        return loadbackup(process.argv.find(x => x.includes(`-lbu`)).replace(`-lbu`, ``));

    function loadbackup(id) {
        if (!id && fs.existsSync(`${__dirname}/../Content/${config.ModName} Latest`)) {
            console.log(`Unloading backup...`);
            if (fs.existsSync(`${__dirname}/../Content/${config.ModName}`))
                fs.rmSync(`${__dirname}/../Content/${config.ModName}`, { recursive: true, force: true });
            fs.renameSync(`${__dirname}/../Content/${config.ModName} Latest`, `${__dirname}/../Content/${config.ModName}`);
            console.log(`Unloaded backup.`);
            return;
        }
        if (!isNaN(id) && !Number.isInteger(parseInt(id))) return console.log(`Invalid id. ${id}`);
        var backuppath = fs.readdirSync(`${__dirname}/backups`).find(x => x.startsWith(`${id} - `))
        if (!backuppath) return console.log(`Invalid backup id!`);
        var folder = backuppath.split(`/`)[backuppath.split(`/`).length - 1];
        console.log(`Loading backup ${folder.split(` - `)[0]} from${formatTime(new Date() - new Date(folder.split(` - `)[1]))} ago`);
        var configFile = `${__dirname}/../Config/DefaultGame.ini`;
        var read = fs.readFileSync(configFile);
        if (!read.includes(`\n+DirectoriesToNeverCook=(Path="/Game/${config.ModName} Latest`)) { // add to never cook
            var out = ``;
            var listFound = false;
            read.split(`\n`).forEach(x => {
                out += `${x}\n`;
                if (x.includes(`+DirectoriesToNeverCook=(Path=`)) {
                    if (!listFound) listFound = true;
                } else if (listFound) {
                    out += `\n+DirectoriesToNeverCook=(Path="/Game/${config.ModName} Latest")`;
                    listFound = false;
                }
            });
        }
        if (fs.existsSync(`${__dirname}/../Content/${config.ModName}`) && fs.existsSync(`${__dirname}/../Content/${config.ModName} Latest`)) {
            console.log(`Backup already loaded, removing.`);
            fs.rmSync(`${__dirname}/../Content/${config.ModName}`, { recursive: true, force: true });
        }
        fs.renameSync(`${__dirname}/../Content/${config.ModName}`, `${__dirname}/../Content/${config.ModName} Latest`);
        fse.copySync(`${__dirname}/backups/${backuppath}/${config.ModName}`, `${__dirname}/../Content/${config.ModName}`);
    }

    function pack() {
        console.log(`packing ${config.ModName}...`);
        fs.appendFileSync(config.logs, `\npacking ${config.ModName}...\n\n`);

        if (fs.existsSync(`${__dirname}/temp/`) && !logsDisabled)
            fs.rmSync(`${__dirname}/temp/`, { recursive: true, force: true });
        else
            fs.mkdirSync(`${__dirname}/temp/`);
        fs.writeFileSync(`${__dirname}/temp/Input.txt`, `"${W__dirname}/temp/PackageInput/" "../../../FSD/"`);
        fse.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`, `${__dirname}/temp/PackageInput/Content/`, { overwrite: true });
        fse.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/AssetRegistry.bin`, `${__dirname}/temp/PackageInput/AssetRegistry.bin`, { overwrite: true });

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
                fs.renameSync(`${__dirname}/temp/${config.ModName}.pak`, `${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
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
                    fs.renameSync(config.logs, `${__dirname}/logs.txt`);
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