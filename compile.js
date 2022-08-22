const fs = require('fs-extra');
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

function findModName() {
    var neverCookDirs = [];
    if (!fs.existsSync(`${__dirname}/../Config/DefaultGame.ini`)) return `No DefaultGame.ini found.`
    fs.readFileSync(`${__dirname}/../Config/DefaultGame.ini`, `utf8`).split(`\n`).forEach(x =>
        neverCookDirs.push(x.replace(`+DirectoriesToNeverCook=(Path="/Game/`, ``).replace(`")`, ``))
    );

    if (!fs.existsSync(`${__dirname}/../Content`)) return `No name found.`
    var name = ``;
    fs.readdirSync(`${__dirname}/../Content`).forEach(x => {
        if (!neverCookDirs.includes(x)) name = x;
    });
    return name;
}

(async () => {
    __dirname = path.dirname(process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0])); // fix pkg dirname
    var updateCompleted = false;
    async function update() {
        const version = require(`./package.json`).version;
        const repo = `MrCreaper/drg-linux-modding`;
        return new Promise(async r => {
            var resp = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
            resp = await resp.json();
            if (resp.tag_name.toLocaleLowerCase().replace(/v/g, ``) == version && !resp.draft && !resp.prerelease)
                r();
            else {
                if (!process.pkg) {
                    r();
                    return console.log(`Not downloading update for .js version`);
                }
                const asset = resp.assets.find(x => x.name.includes(os.platform()));
                if (!asset) return console.log(`No compatible update download found.. (${os.platform()})`);
                console.log(`Downloading update...`);
                //if (!fs.accessSync(__dirname)) return console.log(`No access to local dir`);
                download(asset.browser_download_url,)
                function download(url) {
                    https.get(url, down => {
                        if (down.headers.location) return download(down.headers.location); // github redirects to their cdn, and https dosent know redirects :\
                        var filePath = `${__dirname}/${asset.name.replace(`-${os.platform()}`, ``)}`;
                        var file = fs.createWriteStream(filePath);
                        down.pipe(file
                            .on(`finish`, () => {
                                file.close();
                                fs.chmodSync(filePath, 0777)
                                updateCompleted = true;
                                console.log(`Update finished! ${version} => ${resp.tag_name.replace(/v/g, ``)}`);
                                r();
                            }))
                    });
                }
            }
        });
    }
    await update();
    const W__dirname = `Z:/${__dirname}`.replace(`//`, `/`); // we are Z, they are C

    const username = os.userInfo().username;

    var config = {
        ProjectName: "FSD",
        ModName: findModName(),
        ProjectFile: `/../FSD.uproject`,
        DirsToNeverCook: [], // folder named after ModName is automaticlly included
        UnrealEngine: ``,
        SteamInstall: ``,
        CookingCmd: ``,
        PackingCmd: ``,
        logs: "./logs.txt", // empty for no logs
        startDRG: false,
        dontKillDRG: false,
        leaveWhenDone: true,
        backupOnCompile: true,
        MaxBackups: -1,
    };

    var platformPaths = {
        win: {
            UnrealEngine: `C:\\Program Files (x86)\\Epic Games\\UE_4.27`,
            SteamInstall: `C:\\Program Files (x86)\\Steam\\steamapps\\common\\Deep Rock Galactic`,
            CookingCmd: `{UnrealEngine}/Engine/Binaries/Win64/UE4Editor-Cmd.exe ${__dirname}${config.ProjectFile} -run=cook -targetplatform=WindowsNoEditor`,
            PackingCmd: `{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe ${__dirname}/temp/${config.ModName}.pak -Create="${__dirname}/temp/Input.txt`,
        },
        linux: {
            UnrealEngine: `/home/${username}/Documents/UE_4.27`,
            SteamInstall: `/home/${username}/.local/share/Steam/steamapps/common/Deep Rock Galactic`,
            CookingCmd: `{UnrealEngine}/Engine/Binaries/Linux/UE4Editor-Cmd ${__dirname}${config.ProjectFile} -run=cook -targetplatform=WindowsNoEditor`,
            PackingCmd: `{UnrealEngine}/Engine/Binaries/Linux/UnrealPak ${__dirname}/temp/${config.ModName}.pak -Create="${__dirname}/temp/Input.txt"`,
        },
        linuxwine: {
            UnrealEngine: `/home/${username}/Games/epic-games-store/drive_c/Program Files/Epic Games/UE_4.27`,
            SteamInstall: `/home/${username}/.local/share/Steam/steamapps/common/Deep Rock Galactic`,
            CookingCmd: `wine "{UnrealEngine}/Engine/Binaries/Win64/UE4Editor-Cmd.exe" "${W__dirname}${config.ProjectFile}" "-run=cook" "-targetplatform=WindowsNoEditor"`,
            PackingCmd: `wine "{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe" "${W__dirname}/temp/${config.ModName}.pak" "-Create="${W__dirname}/temp/Input.txt""`,
        },
        macos: {
            UnrealEngine: `no idea`,
            SteamInstall: `no idea`,
            CookingCmd: `no idea`,
            PackingCmd: `no idea`,
        },
    };

    Object.keys(platformPaths).forEach(plat =>
        Object.keys(platformPaths[plat]).forEach(x => platformPaths[plat][x] = platformPaths[plat][x].replace(/{UnrealEngine}/g, platformPaths[plat].UnrealEngine))
    );

    const wine = fs.existsSync(platformPaths.linuxwine.UnrealEngine);
    const paths = platformPaths[`${os.platform()}${wine ? `wine` : ``}`];

    Object.keys(paths).forEach(key => {
        if (!config[key])
            config[key] = paths[key]
    });

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

    // config ready, verify
    if (!fs.existsSync(`${__dirname}/../Content/${config.ModName}`)) return console.log(`Your mod couldnt be found, ModName should be the same as in the content folder.`);
    if (!fs.existsSync(`${__dirname}${config.ProjectFile}`)) return console.log(`Couldnt find project file`);
    if (!fs.existsSync(config.UnrealEngine)) return console.log(`Couldnt find ue4`);
    if (!fs.existsSync(config.SteamInstall)) return console.log(`Couldnt find drg`);

    if (!fs.existsSync(`${__dirname}/../Config/DefaultGame.ini`)) return console.log(`Couldnt find Config/DefaultGame.ini`);

    writeConfig(config);
    function writeConfig(c) {
        fs.writeFileSync(configPath, beautify(JSON.stringify(c), { format: 'json' }));
    }

    if (process.argv.includes(`-verify`)) return;

    if (process.argv.includes(`-drg`))
        config.startDRG = !config.startDRG;

    const tempModName = process.argv.find(x => !x.includes(`/`) && !x.includes(`-`));
    if (tempModName)
        config.ModName = tempModName;
    if (!fs.existsSync(`${__dirname}/../Content/${config.ModName}`)) return console.log(`Your mod couldnt be found, ModName should be the same as in the content folder.`);

    var logsDisabled = false;
    if (!config.logs) {
        fs.mkdirSync(`${__dirname}/temp/`);
        config.logs = `${__dirname}/temp/backuplogs.txt`;
        logsDisabled = true;
    }

    async function exitHandler(err, skip = false) {
        if (fs.existsSync(`${__dirname}/temp/`))
            fs.rmSync(`${__dirname}/temp/`, { recursive: true, force: true });
        if (!updateCompleted && fs.existsSync(`${__dirname}/compile`))
            fs.rmSync(`${__dirname}/compile`);
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

    var maxConfigKeyLenght = 0;
    Object.keys(config).forEach(x => {
        if (x.length > maxConfigKeyLenght)
            maxConfigKeyLenght = x.length;
    });
    Object.keys(config).forEach(x =>
        console.log(`${`${x}:`.padEnd(maxConfigKeyLenght + 3)}${typeof config[x] == `object` ? JSON.stringify(config[x]) : config[x]}`)
    );
    fs.appendFileSync(config.logs, `${beautify(JSON.stringify(config), { format: 'json' })}\n`);

    if (process.argv.includes(`-bu`))
        return backup();

    function backup() {
        return new Promise(r => {
            console.log(`Making backup...`);
            if (!fs.existsSync(`${__dirname}/backups`))
                fs.mkdirSync(`${__dirname}/backups`);
            if (config.MaxBackups != -1) {
                var backups = fs.readdirSync(`${__dirname}/backups`).sort(function (a, b) {
                    var aid = a.split(` - `)[0];
                    if (isNaN(aid)) return;
                    aid = parseInt(aid);

                    var bid = b.split(` - `)[0];
                    if (isNaN(bid)) return;
                    bid = parseInt(bid);

                    if (aid < bid) return -1;
                    if (aid > bid) return 1;
                    return 0;
                }); // oldest => newest
                backups.forEach((x, i) => {
                    //if(i == 0) return; // keep oldest as a keepsake
                    if (backups.length - i > config.MaxBackups)
                        fs.rm(`${__dirname}/backups/${x}`, { recursive: true, force: true });
                });
            }
            var id = -1;
            fs.readdirSync(`${__dirname}/backups`).forEach(x => {
                var xid = x.split(` - `)[0];
                if (isNaN(xid) && xid != `0`) return console.log(`invalid ${x}`);
                xid = parseInt(xid);
                if (xid > id)
                    id = xid;
            });
            id++;
            var buf = `${__dirname}/backups/${id} - ${new Date(new Date().toUTCString()).toISOString().replace(/T/, ' ').replace(/\..+/, '')}`;
            fs.mkdirSync(buf);
            fs.copySync(`${__dirname}/../Content/${config.ModName}`, `${buf}/${config.ModName}`);
            console.log(`Backup done! id: ${id}`);
            r();
        })
    }

    if (process.argv.find(x => x.includes(`-lbu`)))
        return loadbackup(process.argv.find(x => x.includes(`-lbu`)).replace(`-lbu`, ``));

    function refreshDirsToNeverCook(whitelist = []) {
        whitelist.concat(config.DirsToNeverCook)
        var configFile = `${__dirname}/../Config/DefaultGame.ini`;
        var read = fs.readFileSync(configFile, `utf8`).split(`\n`);

        var dirsIndex = read.findIndex(x => x.includes(`+DirectoriesToNeverCook=(Path="/Game/`));
        read.forEach((x, i) => {
            if (x.includes(`+DirectoriesToNeverCook=`))
                read.splice(read.findIndex(y => y == x), 1);
        })
        fs.readdirSync(`${__dirname}/../Content/`).forEach(x => {
            if (!whitelist.includes(x))
                read.splice(dirsIndex, 0, `+DirectoriesToNeverCook=(Path="/Game/${x}")`)
        });
        fs.writeFileSync(configFile, read.join(`\n`));
    }

    function loadbackup(id) {
        if (!id) {
            if (!fs.existsSync(`${__dirname}/../Content/${config.ModName} Latest`))
                console.log(`Missing id.`)
            else {
                console.log(`Unloading backup...`);
                if (fs.existsSync(`${__dirname}/../Content/${config.ModName}`))
                    fs.rmSync(`${__dirname}/../Content/${config.ModName}`, { recursive: true, force: true });
                fs.renameSync(`${__dirname}/../Content/${config.ModName} Latest`, `${__dirname}/../Content/${config.ModName}`);
                console.log(`Unloaded backup.`);;
                return;
            }
        }
        if (!isNaN(id) && !Number.isInteger(parseInt(id))) return console.log(`Invalid id. ${id}`);
        var backuppath = fs.readdirSync(`${__dirname}/backups`).find(x => x.startsWith(`${id} - `))
        if (!backuppath) return console.log(`Invalid backup id!`);
        var folder = backuppath.split(`/`)[backuppath.split(`/`).length - 1];
        console.log(`Loading backup ${folder.split(` - `)[0]} from${formatTime(new Date(new Date().toUTCString()) - new Date(folder.split(` - `)[1]))} ago`);
        if (fs.existsSync(`${__dirname}/../Content/${config.ModName}`) && fs.existsSync(`${__dirname}/../Content/${config.ModName} Latest`)) {
            console.log(`Backup already loaded, removing.`);
            fs.rmSync(`${__dirname}/../Content/${config.ModName}`, { recursive: true, force: true });
        }
        fs.renameSync(`${__dirname}/../Content/${config.ModName}`, `${__dirname}/../Content/${config.ModName} Latest`);
        fs.copySync(`${__dirname}/backups/${backuppath}/${config.ModName}`, `${__dirname}/../Content/${config.ModName}`);
        refreshDirsToNeverCook([config.ModName]);
    }

    // just becomes hidden, for some reason.. and then, bug reporter jumpscare for .1s
    //if (process.argv.includes(`-ue`))
    //return child.exec(`wine "${config.UnrealEngine}/Engine/Binaries/Win64/UE4Editor.exe" "${W__dirname}/../FSD.uproject"`).on('message', console.log)
    //return child.exec(`env WINEPREFIX="/home/creaper/Games/epic-games-store" wine C:\\\\Program\\ Files\\\\Epic\\ Games\\\\UE_4.27\\\\Engine\\\\Binaries\\\\Win64\\\\UE4Editor.exe ${W__dirname}/../FSD.uproject`);

    function pack() {
        console.log(`packing ${config.ModName}...`);
        fs.appendFileSync(config.logs, `\npacking ${config.ModName}...\n\n`);

        if (fs.existsSync(`${__dirname}/temp/`) && !logsDisabled)
            fs.rmSync(`${__dirname}/temp/`, { recursive: true, force: true });
        else
            fs.mkdirSync(`${__dirname}/temp/`);
        fs.writeFileSync(`${__dirname}/temp/Input.txt`, `"${W__dirname}/temp/PackageInput/" "../../../FSD/"`);
        if (!fs.existsSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`)) return console.log(`Cooking fucked up.`);
        fs.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`, `${__dirname}/temp/PackageInput/Content/`, { overwrite: true });
        fs.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/AssetRegistry.bin`, `${__dirname}/temp/PackageInput/AssetRegistry.bin`, { overwrite: true });

        child.exec(config.PackingCmd)
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

                if (config.backupOnCompile)
                    await backup();

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
    console.log(`\ncooking ${config.ModName}...`);
    refreshDirsToNeverCook([config.ModName]);
    fs.appendFileSync(config.logs, `\ncooking ${config.ModName}...\n\n`);

    var cookingChild = child.exec(config.CookingCmd)
        .on('exit', async () => {
            var d = fs.readFileSync(config.logs, `utf8`);
            if (d.includes(`LogInit: Display: Success - 0 error(s),`)) {
                console.log(`Cooked!`);
                pack();
            } else if (d.includes(`LogInit: Display: Failure - `)) {
                var errsFound = false;
                var errs = 0;
                var errorsLogs = ``;
                d.split(`\n`).forEach(x => {
                    if (x.includes(`LogInit: Display: LogProperty: Error: `)) {
                        errs++;
                        var log = x
                            .split(`[  0]`)[1] // after timestamp
                            .replace(/LogInit: Display: LogProperty: Error: /g, ``)
                            .replace(/FStructProperty::Serialize Loading: Property /g, ``)
                            .replace(/StructProperty /g, ``)
                            .replace(/\/Game/g, ``) // file path start
                            .replace(/_C:/g, ` > `) // after file
                            .replace(/:CallFunc_/g, ` > (function) `)
                            .replace(/ExecuteUbergraph_/g, ` > (graph) `)
                            .replace(/>  >/g, `>`)
                            .replace(/:/g, ` > `)
                            .replace(/'/g, ``)
                            .replace(/_/g, ` `)
                            .replace(`. `, ` | ERR: `);
                        log = log.replace(`.${log.split(` `)[0].split(`.`)[1]}`, ``) // weird file.file thing
                        //.replace(/./g, ``) // for some reason it removes the first '/' in the path?
                        while (log.split(` `).find(x => x.includes(`.`))) {
                            log = log.replace(`.${log.split(` `).find(x => x.includes(`.`)).split(`.`)[1]}`, ``) // weird function.function thing
                        }
                        errorsLogs += `${log}\n`;
                    }
                });
                console.log(`Errors ${errs}:\n\n${errorsLogs}`);
                if (logsDisabled) {
                    console.log(`Failed. Check the logs and-... oh wait, you disabled logs. Lucky for you, I make backups.`);
                    fs.renameSync(config.logs, `${__dirname}/logs.txt`);
                    await keypress();
                    exitHandler();
                    return;
                }
                console.log(`${errsFound ? `\n` : ``}Failed. Check the logs${errsFound ? ` (or check the above)` : ``} and fix your damn "code"`);
                await keypress();
                exitHandler();
            } else {
                console.log(`What the fuck did you do.`);
                await keypress();
                exitHandler();
            }
        })
        .stdout.on('data', (d) => fs.appendFileSync(config.logs, String(d)));
})();