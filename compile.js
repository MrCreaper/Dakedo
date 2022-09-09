const fs = require('fs-extra');
const child = require(`child_process`);
const path = require('path');
const find = require('find-process');
const https = require(`https`);
const os = require(`os`);
const chalk = require(`chalk`);
const zl = require("zip-lib");

function formatTime(time) {
    var years = Math.abs(Math.floor(time / (1000 * 60 * 60 * 24 * 365)));
    var months = Math.abs(Math.floor(time / (1000 * 60 * 60 * 24 * 7 * 31)));
    var weeks = Math.abs(Math.floor(time / (1000 * 60 * 60 * 24 * 7)));
    var days = Math.abs(Math.floor(time / (1000 * 60 * 60 * 24)));
    var hours = Math.abs(Math.floor((time % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))) - 3; // fuck if I know why it needs -3h
    var minutes = Math.abs(Math.floor((time % (1000 * 60 * 60)) / (1000 * 60)));
    var seconds = Math.abs(Math.floor((time % (1000 * 60)) / 1000));
    var t = ``;
    if (years) t += `${years}y`;
    if (months) t += `${years ? ` ` : ``}${months}m`;
    if (weeks) t += `${months ? ` ` : ``}${weeks}w`;
    if (days) t += `${weeks ? ` ` : ``}${days}d`;
    if (hours) t += `${days ? ` ` : ``}${hours}h`;
    if (minutes) t += `${hours ? ` ` : ``}${minutes}min`;
    if (seconds) t += `${minutes ? ` ` : ``}${seconds}s`;
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
function searchDir(p = ``, search = []) {
    var hits = [];
    queryDir(p);
    function queryDir(path) {
        fs.readdirSync(path).forEach(x => {
            var fp = `${path}/${x}`
            var s = fs.statSync(fp);
            if (s.isDirectory()) queryDir(fp);
            if (s.isFile() && search.includes(x)) hits.push(fp);
        });
    }
    return hits;
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

async function uploadMod(zip) {
    return new Promise(async (r, re) => {
        const d = new Date();
        var res = await fetch(`https://api.mod.io/v1/games/${config.modio.gameid}/mods/${config.modio.modid}/files`, {
            method: 'post',
            headers: {
                'Authorization': `Bearer ${config.modio.token}`,
                'Content-Type': `multipart/form-data`,
                'Accept': `application/json`,
            },
            body: JSON.stringify({
                filedata: fs.readFileSync(zip, `binary`),
                version: config.modioid.dateVersion ? `${d.getUTCFullYear()}.${d.getUTCMonth()}.${d.getUTCDate()}` : version,
                active: true,
                changelog: changelog
            }),
        });
        if (res.status == 201)
            r(true);
        else r(res);
    })
};
async function deleteMod(id) {
    return new Promise(async (r, re) => {
        var res = await fetch(`https://api.mod.io/v1/games/${config.modio.gameid}/mods/${config.modio.modid}/files/${id}`, {
            method: 'delete',
            headers: {
                'Authorization': `Bearer ${config.modio.token}`,
                'Content-Type': `application/x-www-form-urlencoded`,
                'Accept': `application/json`,
            },
        });
        if (res.status == 204)
            r(true);
        else r(res);
    })
};

const W__dirname = `Z:/${__dirname}`.replace(`//`, `/`); // we are Z, they are C

const username = os.userInfo().username;

var config = {
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
    backupOnCompile: true,
    MaxBackups: -1,
    backupPak: false,
    backupBlacklist: [`.git`],
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
};

var platformPaths = {
    win: {
        UnrealEngine: `C:\\Program Files (x86)\\Epic Games\\UE_4.27`,
        SteamInstall: `C:\\Program Files (x86)\\Steam\\steamapps\\common\\Deep Rock Galactic`,
        CookingCmd: `{UnrealEngine}/Engine/Binaries/Win64/UE4Editor-Cmd.exe ${__dirname}${config.ProjectFile} -run=cook -targetplatform=WindowsNoEditor`,
        PackingCmd: `{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe ${__dirname}/temp/${config.ModName}.pak -Create="${__dirname}/temp/Input.txt`,
        UnPackingCmd: `{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe -platform="Windows" -extract "{path}"`,
    },
    linux: {
        UnrealEngine: `/home/${username}/Documents/UE_4.27`,
        SteamInstall: `/home/${username}/.local/share/Steam/steamapps/common/Deep Rock Galactic`,
        CookingCmd: `{UnrealEngine}/Engine/Binaries/Linux/UE4Editor-Cmd ${__dirname}${config.ProjectFile} -run=cook -targetplatform=WindowsNoEditor`,
        PackingCmd: `{UnrealEngine}/Engine/Binaries/Linux/UnrealPak ${__dirname}/temp/${config.ModName}.pak -Create="${__dirname}/temp/Input.txt"`,
        UnPackingCmd: `{UnrealEngine}/Engine/Binaries/Linux/UnrealPak -platform="Windows" -extract "{path}"`,
    },
    linuxwine: {
        UnrealEngine: `/home/${username}/Games/epic-games-store/drive_c/Program Files/Epic Games/UE_4.27`,
        SteamInstall: `/home/${username}/.local/share/Steam/steamapps/common/Deep Rock Galactic`,
        CookingCmd: `wine "{UnrealEngine}/Engine/Binaries/Win64/UE4Editor-Cmd.exe" "${W__dirname}${config.ProjectFile}" "-run=cook" "-targetplatform=WindowsNoEditor"`,
        PackingCmd: `wine "{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe" "${W__dirname}/temp/${config.ModName}.pak" "-Create="${W__dirname}/temp/Input.txt""`,
        UnPackingCmd: `wine "{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe" "-platform="Windows"" "-extract" ""{path}""`,
    },
    macos: {
        UnrealEngine: `no idea`,
        SteamInstall: `no idea`,
        CookingCmd: `no idea`,
        PackingCmd: `no idea`,
        UnPackingCmd: `no idea`,
    },
    givenUpos: { // fallback
        UnrealEngine: `no idea`,
        SteamInstall: `no idea`,
        CookingCmd: `no idea`,
        PackingCmd: `no idea`,
        UnPackingCmd: `no idea`,
    },
};

Object.keys(platformPaths).forEach(plat =>
    Object.keys(platformPaths[plat]).forEach(x =>
        platformPaths[plat][x] = platformPaths[plat][x]
            .replace(/{UnrealEngine}/g, platformPaths[plat].UnrealEngine)
            //.replace(/.\//g, `${plat.includes(`wine`) ? W__dirname : __dirname}/`)
            .replace(/{me}/g, username)
            .replace(/{mod}/g, config.ModName)
    )
);

const wine = fs.existsSync(platformPaths.linuxwine.UnrealEngine);
var paths = platformPaths[`${os.platform().replace(`32`, ``).replace(`Darwin`, `macos`)}${wine ? `wine` : ``}`];
if (!paths) paths = platformPaths.givenUpos;

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
    fs.writeFileSync(configPath, JSON.stringify(c, null, 4));
}

(async () => {
    if (process.getuid() == 0) {
        console.log(`Refusing to run as root`);
        return exitHandler();
    }
    __dirname = path.dirname(process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0])); // fix pkg dirname
    var updateCompleted = false;
    async function update() {
        const repo = `MrCreaper/drg-linux-modding`;
        if (!repo) return;
        const version = require(`./package.json`).version;
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
                                child.spawn(process.argv[0], process.argv.slice(1), {
                                    stdio: 'inherit',
                                });
                                //process.exit(); // will make the child proccss "unkillable"
                                //r(); // wait forever
                            }))
                    });
                }
            }
        });
    }
    await update();

    if (process.argv.includes(`-verify`)) return;

    if (process.argv.includes(`-gogo`)) {
        fs.rmSync(`${config.SteamInstall}/FSD/Content/Movies`, { recursive: true, force: true });
        fs.rmSync(`${config.SteamInstall}/FSD/Content/Splash`, { recursive: true, force: true });
        return;
    }

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
        if (process.pkg)
            await keypress();
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

    // unpack from argument
    var unpackFile = process.argv.find(x => x.includes(`.pak`));
    if (unpackFile) return unpack(unpackFile);

    if (process.argv.includes(`-unpackdrg`)) return unpack(`${config.SteamInstall}/FSD/Content/Paks/FSD-WindowsNoEditor.pak`);

    fs.writeFileSync(config.logs, ``);

    var maxConfigKeyLenght = 0;
    Object.keys(config).forEach(x => {
        if (x.length > maxConfigKeyLenght)
            maxConfigKeyLenght = x.length;
    });
    Object.keys(config).forEach(x => {
        if (!chalk) return console.log(`${`${x}:`.padEnd(maxConfigKeyLenght + 3)}${typeof config[x] == `object` ? JSON.stringify(config[x]) : config[x]}`);
        var coloredVal = ``;
        switch (typeof config[x]) {
            case `object`:
                coloredVal = chalk.cyan(JSON.stringify(config[x]));
                break;
            case `boolean`:
                if (config[x])
                    coloredVal = chalk.green(config[x]);
                else
                    coloredVal = chalk.red(config[x]);
                break;
            case `number`:
                coloredVal = chalk.greenBright(config[x]);
                break;
            case `string`:
                coloredVal = chalk.redBright(config[x]);
                break;
            case `undefined`:
                coloredVal = chalk.blue(config[x]);
                break;
        }
        console.log(`${`${x}:`.padEnd(maxConfigKeyLenght + 3)}${coloredVal}`);
    });
    console.log();
    fs.appendFileSync(config.logs, `${JSON.stringify(config, null, 4)}\n`);

    if (process.argv.includes(`-bu`))
        return backup();

    module.exports.backup = function backup() {
        return new Promise(async r => {
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
                    if (backups.length - i - 1 > config.MaxBackups)
                        fs.rmSync(`${__dirname}/backups/${x}`, { recursive: true, force: true });
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
            var buf = `${__dirname}/backups/${id} - ${new Date(new Date().toUTCString()).toISOString().replace(/T/, ' ').replace(/\..+/, '')}`; // BackUp Folder
            fs.mkdirSync(buf);
            fs.copySync(`${__dirname}/../Content/${config.ModName}`, `${buf}/${config.ModName}`);
            if (config.backupPak)
                fs.copySync(`${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`, `${buf}/${config.ModName}.pak`);
            if (config.zip.backups) {
                await zl.archiveFolder(buf, `${buf}.zip`);
                fs.rmSync(buf, { recursive: true, force: true })
            }
            if (config.backupBlacklist.length != 0) searchDir(buf, config.backupBlacklist).forEach(x => fs.rmSync(x, { recursive: true, force: true }));
            console.log(`Backup done! id: ${chalk.cyan(id)}`);
            r();
        })
    }

    if (process.argv.find(x => x.includes(`-listbu`))) { // list backups
        var backuppath = fs.readdirSync(`${__dirname}/backups`)
        if (!backuppath) return console.log(`Invalid backup id!`);
        backuppath.sort(function (a, b) {
            var a = new Date(new Date().toUTCString()) - new Date(a.split(` - `)[1])
            var b = new Date(new Date().toUTCString()) - new Date(b.split(` - `)[1])
            if (a < b) return 1;
            if (a > b) return -1;
            return 0;
        });
        backuppath.forEach(x => {
            console.log(`${x.split(` - `)[0]} - ${formatTime(new Date(new Date().toUTCString()) - new Date(x.split(` - `)[1]))}`);
        });
        console.log(`\nBackups: ${backuppath.length}`);
        exitHandler()
        return;
    }

    if (process.argv.find(x => x.includes(`-lbu`)))
        return loadbackup(process.argv.find(x => x.includes(`-lbu`)).replace(`-lbu`, ``));

    module.exports.refreshDirsToNeverCook = function refreshDirsToNeverCook(whitelist = []) {
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

    module.exports.loadbackup = function loadbackup(id) {
        if (!id) {
            if (!fs.existsSync(`${__dirname}/../Content/${config.ModName} Latest`))
                console.log(`Missing id.`)
            else {
                console.log(`Unloading backup...`);
                if (fs.existsSync(`${__dirname}/../Content/${config.ModName}`))
                    fs.rmSync(`${__dirname}/../Content/${config.ModName}`, { recursive: true, force: true });
                fs.renameSync(`${__dirname}/../Content/${config.ModName} Latest`, `${__dirname}/../Content/${config.ModName}`);
                console.log(`Unloaded backup.`);
                return;
            }
        }
        if (!isNaN(id) && !Number.isInteger(parseInt(id))) return console.log(`Invalid id. ${id}`); // custom ids would be nice
        var backuppath = fs.readdirSync(`${__dirname}/backups`).find(x => x.startsWith(`${id} - `))
        if (!backuppath) return console.log(`Invalid backup id!`);
        var folder = backuppath.split(`/`)[backuppath.split(`/`).length - 1];
        console.log(`Loading backup ${folder.split(` - `)[0]} from ${formatTime(new Date(new Date().toUTCString()) - new Date(folder.split(` - `)[1]))} ago`);

        if (fs.existsSync(`${__dirname}/../Content/${config.ModName}`) && fs.existsSync(`${__dirname}/../Content/${config.ModName} Latest`)) {
            console.log(`Backup already loaded, removing.`);
            fs.rmSync(`${__dirname}/../Content/${config.ModName}`, { recursive: true, force: true });
        }

        if (folder.endsWith(`.zip`))
            zl.extract(backuppath, `${__dirname}/../Content/${config.ModName}`).then(function () {
            }, console.log);
        else {
            fs.renameSync(`${__dirname}/../Content/${config.ModName}`, `${__dirname}/../Content/${config.ModName} Latest`);
            fs.copySync(`${__dirname}/backups/${backuppath}/${config.ModName}`, `${__dirname}/../Content/${config.ModName}`);
        }
        refreshDirsToNeverCook([config.ModName]);
    }

    // just becomes hidden, for some reason.. and then, bug reporter jumpscare for .1s
    //if (process.argv.includes(`-ue`))
    //return child.exec(`wine "${config.UnrealEngine}/Engine/Binaries/Win64/UE4Editor.exe" "${W__dirname}/../FSD.uproject"`).on('message', console.log)
    //return child.exec(`env WINEPREFIX="/home/creaper/Games/epic-games-store" wine C:\\\\Program\\ Files\\\\Epic\\ Games\\\\UE_4.27\\\\Engine\\\\Binaries\\\\Win64\\\\UE4Editor.exe ${W__dirname}/../FSD.uproject`);

    function pack(config = config) {
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
                    exitHandler();
                }
                fs.rmSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}`, { recursive: true, force: true });
                fs.mkdirSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}`);
                fs.renameSync(`${__dirname}/temp/${config.ModName}.pak`, `${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
                console.log(`Packed!`);

                if (config.zip.onCompile) {
                    console.log("Zipping...");
                    zl.archiveFolder(`${config.SteamInstall}/FSD/Mods/${config.ModName}/`, `${config.SteamInstall}/FSD/Mods/${config.ModName}.zip`).then(function () {
                        console.log("Zipped!");
                        config.zip.to.forEach(dir =>
                            fs.copySync(`${config.SteamInstall}/FSD/Mods/${config.ModName}.zip`, `${dir}${config.ModName}.zip`)
                        );
                    }, console.log);
                }

                if (config.backupOnCompile)
                    await backup();

                if (config.startDRG) {
                    await new Promise(r => {
                        console.log(`Launching DRG...`);
                        child.exec(`steam steam://rungameid/548430`)
                            .on(`exit`, () => {
                                console.log(`Lauched DRG`); // most likely
                                r();
                            })
                            .on(`message`, (d) => fs.appendFileSync(config.logs, String(d)))
                            .stdout.on('data', (d) => fs.appendFileSync(config.logs, String(d)))
                    })
                }

                // clear swap, can couse crashes couse it just piles up after compiles for some reason?
                /*if (config.ClearSwap || os.freemem() / os.totalmem() > .5) {
                    console.log(`Clearing swap... ${Math.floor(os.freemem() / os.totalmem() * 100)}%`);
                    await new Promise(r =>
                        child.exec(`swapoff -a && swapon -a && sync; echo 3 > /proc/sys/vm/drop_caches`).on(`close`, () => {
                            console.log(`Swap cleared.`);
                            r();
                        }));
                }*/

                console.log(`Done!`);
            })
            .stdout.on('data', (d) => fs.appendFileSync(config.logs, String(d)));
    }

    module.exports.unpack = function unpack(path) {
        console.log(`unpacking ${path}`);
        fs.appendFileSync(config.logs, `Unpackign ${path}`)
        child.exec(config.UnPackingCmd.replace(`{path}`, path))
            .on('exit', async () => {
                var d = fs.readFileSync(config.logs);
                if (d.includes(`LogPakFile: Error: Failed to load `)) {
                    console.log(`Failed to load ${d.toString().split(`\n`).find(x => x.includes(`LogPakFile: Error: Failed to load `)).replace(`LogPakFile: Error: Failed to load `, ``)}`);
                    exitHandler();
                }
            })
            .stdout.on('data', (d) => fs.appendFileSync(config.logs, String(d)));
    }

    // idk fs.access just false all the time.
    /*if (fs.existsSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor`) && !fs.accessSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor`, fs.constants.W_OK | fs.constants.R_OK)) {
        console.log(`\nNo access to /Saved/Cooked/WindowsNoEditor`);
        if (platform == `linux`) console.log(`Please run:\nchmod 7777 -R ${__dirname}/../Saved/Cooked/WindowsNoEditor`);
        //return exitHandler();
        //fs.chmodSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor`,0777); // no access means no access, idiot
    }

    if (fs.existsSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`) && !fs.accessSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`, fs.constants.W_OK | fs.constants.R_OK)) {
        console.log(`\nNo access to ${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
        if (platform == `linux`) console.log(`Please run:\nchmod 7777 -R ${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
        //return exitHandler();
        //fs.chmodSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor`,0777); // no access means no access, idiot
    }*/

    if (config.startDRG && !config.dontKillDRG) { // kill drg and before cooking to save ram
        var prcList = await find('name', 'FSD');
        //console.log(prcList);
        prcList.forEach(x => {
            try {
                if (x.cmd.toLocaleLowerCase().replace(/\\/g, `/`).includes(`/steam/`))
                    process.kill(x.pid);
            } catch (error) { }
        })
    }

    console.log(`cooking ${config.ModName}...`);
    refreshDirsToNeverCook([config.ModName]);
    fs.appendFileSync(config.logs, `\ncooking ${config.ModName}...\n\n`);
    cook();

    module.exports.cook = () => {
        var logs = ``;
        return new Promise(r => {
            child.exec(config.CookingCmd)
                .on('exit', async () => {
                    if (logs.includes(`LogInit: Display: Success - 0 error(s),`))
                        r(true);
                    else if (logs.includes(`LogInit: Display: Failure - `))
                        r(false);
                    else r(false);
                })
                .stdout.on('data', (d) => logs += String(d));
        });
    }
    module.exports.pack = (outPath) => {
        var logs = ``;
        return new Promise(r => {
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
                    if (logs.includes(`LogPakFile: Error: Failed to load `)) {
                        console.log(`Failed to load ${logs.toString().split(`\n`).find(x => x.includes(`LogPakFile: Error: Failed to load `)).replace(`LogPakFile: Error: Failed to load `, ``)}`);
                        return r();
                    }
                    fs.moveSync(`${__dirname}/temp/${config.ModName}.pak`, outPath);
                    r();
                })
                .stdout.on('data', (d) => logs += String(d));
        });
    };
    var cookingChild;
    function cook() {
        cookingChild = child.exec(config.CookingCmd)
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
                        if (!x.includes(`LogInit: Display: `) || !x.includes(` Error: `)) return;
                        errs++;
                        try {
                            var log = x
                                .split(`[  0]`)[1] // after timestamp
                                .replace(/LogInit: Display: /g, ``)
                                .replace(/ Error: /g, ``)
                                //.replace("\\LogInit: Display: .*?\\ Error: ",``) // replace everything between ...
                                .replace(/FStructProperty::Serialize Loading: Property /g, ``)
                                .replace(/StructProperty /g, ``)
                                .replace(/\/Game/g, ``) // file path start
                                .replace(/_C:/g, ` > `) // after file
                                .replace(/:CallFunc_/g, ` > (function) `)
                                .replace(/ExecuteUbergraph_/g, ` > (graph) `)
                                .replace(/\[AssetLog\]/g, ``)
                                .replace(/\\/g, `/`)
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
                        } catch (err) {
                            console.log(`BEAUTY ERROR: ${x}`);
                            console.log(err);
                            errorsLogs += `${x}\n`;
                        }
                    });
                    console.log(`Errors ${errs}:\n\n${errorsLogs}`);
                    if (logsDisabled) {
                        console.log(`Failed. Check the logs and-... oh wait, you disabled logs. Lucky for you, I make backups.`);
                        fs.renameSync(config.logs, `${__dirname}/logs.txt`);
                        exitHandler();
                        return;
                    }
                    console.log(`${errsFound ? `\n` : ``}Failed. Check the logs${errsFound ? ` (or check the above)` : ``} and fix your damn "code"`);
                    exitHandler();
                } else {
                    console.log(`What the fuck did you do.`);
                    exitHandler();
                }
            })
            .stdout.on('data', (d) => fs.appendFileSync(config.logs, String(d)));
    }
})();