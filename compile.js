const fs = require('fs-extra');
const child = require(`child_process`);
const PATH = require('path');
const find = require('find-process');
const https = require(`https`);
const os = require(`os`);
const chalk = require(`chalk`);
const zl = require("zip-lib");
var crypto = require('crypto');
const readline = require(`readline`);
const { EventEmitter } = require(`events`);
class Emitter extends EventEmitter { }
const consoleloge = new Emitter();

var latestLog = ``;
var logHistory = [];
/**
 * Custom log function
 * @param {string} log the log
 * @param {boolean} urgent Used for logging very important stuff as module
 * @returns {intreger} logHistory index
 */
function consolelog(log = ``, urgent = false) {
    if (!module.parent || urgent || module.exports.logsEnabled) // stfu if module
        //console.log.apply(arguments);
        console.log(log);
    if (log) {
        latestLog = log;
        var i = logHistory.push(log);
        while (logHistory.length > 100) {
            logHistory.pop();
        }
        consoleloge.emit(`log`, log);
        logFile(`${log}\n`);
        return i;
    }
}

function formatTime(time) {
    var years = Math.abs(Math.floor(time / (1000 * 60 * 60 * 24 * 365)));
    var months = Math.abs(Math.floor(time / (1000 * 60 * 60 * 24 * 7 * 31)));
    var weeks = Math.abs(Math.floor(time / (1000 * 60 * 60 * 24 * 7)));
    var days = Math.abs(Math.floor(time / (1000 * 60 * 60 * 24)));
    var hours = Math.abs(Math.floor((time % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
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
function getLineBreakChar(string) {
    const indexOfLF = string.indexOf('\n', 1)  // No need to check first-character
    if (indexOfLF === -1) {
        if (string.indexOf('\r') !== -1) return '\r'
        return '\n'
    }
    if (string[indexOfLF - 1] === '\r') return '\r\n'
    return '\n'
}
function searchDir(p = ``, search = []) {
    var hits = [];
    queryDir(p);
    function queryDir(path) {
        fs.readdirSync(path).forEach(x => {
            var fp = `${path}/${x}`
            var s = fs.statSync(fp);
            if (s.isDirectory()) queryDir(fp);
            if (/*s.isFile() && */search.includes(x)) hits.push(fp);
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

function findModVersion() {
    var configFile = `${__dirname}/../Config/DefaultGame.ini`;
    var read = fs.readFileSync(configFile, `utf8`).split(`\n`);
    var raw = read.find(x => x.startsWith(`ProjectVersion=`)).replace(`ProjectVersion=`, ``);
    if (!raw) return `unVersioned`;
    return raw;
}

function removeColor(input) {
    return input.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
}
var utcNow = new Date(new Date().toUTCString());

const W__dirname = `Z:/${__dirname}`.replace(`//`, `/`); // we are Z, they are C
__dirname = PATH.dirname(process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0])); // fix pkg dirname

const username = os.userInfo().username;

var config = {
    ProjectName: "FSD", // kinda useless
    ModName: findModName(),
    ProjectFile: `/../FSD.uproject`,
    DirsToCook: [], // folder named after ModName is automaticlly included
    UnrealEngine: ``,
    SteamInstall: ``,
    CookingCmd: ``,
    PackingCmd: ``,
    UnPackingCmd: ``,
    logs: "./logs.txt", // empty for no logs
    startDRG: false,
    killDRG: true,
    logConfig: false,
    ui: true, // use the ui version by default
    backup: {
        onCompile: true,
        max: 5, // -1 for infinite
        pak: false,
        blacklist: [`.git`],
    },
    zip: {
        onCompile: true, // placed in the mods/{mod name} folder
        backups: false,
        to: [`./`], // folders to place the zip in, add the zip to the mod folder, for if you want to add the zip to github and to modio https://github.com/nickelc/upload-to-modio
    },
    modio: {
        token: ``, // https://mod.io/me/access > oauth access
        gameid: 2475,
        modid: 0,
        onCompile: false, // upload on compile
        deleteOther: true, // deletes older or non-active files
        dateVersion: true, // make version from the date year.month.date, otherwise get version from project
    },
    update: true, // automaticlly check for updates
};

const originalplatformPaths = {
    win: {
        UnrealEngine: `C:\\Program Files (x86)\\Epic Games\\UE_4.27`,
        SteamInstall: `C:\\Program Files (x86)\\Steam\\steamapps\\common\\Deep Rock Galactic`,
        CookingCmd: `{UnrealEngine}/Engine/Binaries/Win64/UE4Editor-Cmd.exe ${__dirname}${config.ProjectFile} -run=cook -targetplatform=WindowsNoEditor`,
        PackingCmd: `{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe ${__dirname}/temp/{mod}.pak -Create="${__dirname}/temp/Input.txt`,
        UnPackingCmd: `{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe -platform="Windows" -extract "{path}" "{outpath}"`,
    },
    linux: {
        UnrealEngine: `/home/{me}/Documents/UE_4.27`,
        SteamInstall: `/home/{me}/.local/share/Steam/steamapps/common/Deep Rock Galactic`,
        CookingCmd: `{UnrealEngine}/Engine/Binaries/Linux/UE4Editor-Cmd ${__dirname}${config.ProjectFile} -run=cook -targetplatform=WindowsNoEditor`,
        PackingCmd: `{UnrealEngine}/Engine/Binaries/Linux/UnrealPak ${__dirname}/temp/{mod}.pak -Create="${__dirname}/temp/Input.txt"`,
        UnPackingCmd: `{UnrealEngine}/Engine/Binaries/Linux/UnrealPak -platform="Windows" -extract "{path}" "{outpath}"`,
    },
    linuxwine: {
        UnrealEngine: `/home/{me}/Games/epic-games-store/drive_c/Program Files/Epic Games/UE_4.27`,
        SteamInstall: `/home/{me}/.local/share/Steam/steamapps/common/Deep Rock Galactic`,
        CookingCmd: `wine "{UnrealEngine}/Engine/Binaries/Win64/UE4Editor-Cmd.exe" "${W__dirname}${config.ProjectFile}" "-run=cook" "-targetplatform=WindowsNoEditor"`,
        PackingCmd: `wine "{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe" "${W__dirname}/temp/{mod}.pak" "-Create="${W__dirname}/temp/Input.txt""`,
        UnPackingCmd: `wine "{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe" "-platform="Windows"" "-extract" "{path}" "{outpath}"`,
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
const platformPaths = JSON.parse(JSON.stringify(originalplatformPaths)); // new instance, no longer a refrence

const configPath = `${__dirname}/config.json`;

function writeConfig(c = {}) {
    fs.writeFileSync(configPath, JSON.stringify(c, null, 4));
}

function updatePlatPathVariables() {
    Object.keys(originalplatformPaths).forEach(plat =>
        Object.keys(originalplatformPaths[plat]).forEach(x =>
            platformPaths[plat][x] = originalplatformPaths[plat][x]
                .replace(/{UnrealEngine}/g, platformPaths[plat].UnrealEngine)
                //.replace(/.\//g, `${plat.includes(`wine`) ? W__dirname : __dirname}/`)
                .replace(/{me}/g, username)
                .replace(/{mod}/g, config.ModName)
        )
    );
}
var unVaredConfig = JSON.parse(JSON.stringify(config)); // makes new instance of config
updateConfig();
function updateConfig(forceNew = false) {
    if (fs.existsSync(configPath) && !forceNew) {
        var tempconfig = fs.readFileSync(configPath);
        if (!isJsonString(tempconfig)) {
            writeConfig(config);
            consolelog("Config fucked, please update it again.");
            exitHandler();
            return;
        }
        tempconfig = JSON.parse(tempconfig);
        config = checkConfig(config, tempconfig);
        function checkConfig(base = {}, check = {}) {
            Object.keys(base).forEach(x => {
                if (typeof base[x] == `object`)
                    base[x] = checkConfig(base[x], check[x]);
                else
                    if (check[x] != undefined && typeof base[x] == typeof check[x])
                        base[x] = check[x];
            });
            return base;
        }
    }

    unVaredConfig = JSON.parse(JSON.stringify(config)); // makes new instance of config

    updatePlatPathVariables();
    const wine = fs.existsSync(platformPaths.linuxwine.UnrealEngine);
    const platform = `${os.platform().replace(/[3264]/, ``).replace(`Darwin`, `macos`)}${wine ? `wine` : ``}`;
    var paths = platformPaths[platform];
    if (!paths) paths = platformPaths.givenUpos;
    updatePlatPathVariables();

    Object.keys(paths).forEach(key => {
        if (config[key] == undefined || config[key] == ``) {
            unVaredConfig[key] = originalplatformPaths[platform][key];
            config[key] = paths[key];
        }
    });
    writeConfig(unVaredConfig);
    const tempModName = process.argv.find(x => !x.includes(`/`) && !x.includes(`-`) && fs.existsSync(`${__dirname}/../Content/${x}`));
    if (tempModName) config.ModName = tempModName;
    Object.keys(paths).forEach(x => {
        if (typeof config[x] == `string`)
            config[x] = config[x]
                .replace(/{UnrealEngine}/g, platformPaths[platform].UnrealEngine)
                //.replace(/.\//g, `${plat.includes(`wine`) ? W__dirname : __dirname}/`)
                .replace(/{me}/g, username)
                .replace(/{mod}/g, config.ModName)
    });
}

function logFile(log) {
    fs.appendFileSync(config.logs, removeColor(log))
}

// exports
module.exports.config = config;

module.exports.uploadMod = uploadMod = async (
    zip,
    active = false,
    version = config.modio.dateVersion ? `${utcNow.getUTCFullYear().toString().slice(-2)}.${utcNow.getUTCMonth()}.${utcNow.getUTCDate()}` : findModVersion(),
    changelog = `Uploaded: ${utcNow.toISOString().replace(/T/, ' ').replace(/\..+/, '')} UTC`,
) => {
    return new Promise(async (r, re) => {
        if (fs.statSync(zip).size > 5368709120) return consolelog(`Zip bigger then 5gb`);
        var body = {
            filedata: `@${zip}`,
            //filedata: fs.readFileSync(zip, `binary`),
            //filehash: crypto.createHash('md5').update(fs.readFileSync(zip, `binary`)).digest('hex'),
            version: version,
            //active: active,
            changelog: changelog
        };
        var res = await fetch(`https://api.mod.io/v1/games/${config.modio.gameid}/mods/${config.modio.modid}/files`, { // actually HTTP
            method: 'post',
            headers: {
                'Authorization': `Bearer ${config.modio.token}`,
                'Content-Type': 'multipart/form-data',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body),
        });
        consolelog(body);
        consolelog(await res.json());
        if (res.status == 201)
            r(true);
        else r(res);
    })
};

module.exports.deleteModFile = deleteModFile = async function (id) {
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

module.exports.getFiles = async function getFiles(gameid = config.modio.gameid, modid = config.modio.modid, token = config.modio.token) {
    return new Promise(async (r, re) => {
        var res = await fetch(`https://api.mod.io/v1/games/${gameid}/mods/${modid}/files?api_key=${token}`, {
            method: 'get',
            headers: {
                'Accept': `application/json`,
            },
        });
        if (res.status == 200)
            r((await res.json()).data);
        else r(res);
    })
};

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
        if (!fs.existsSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`)) return consolelog(`Cooking fucked up.`);
        fs.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`, `${__dirname}/temp/PackageInput/Content/`, { overwrite: true });
        fs.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/AssetRegistry.bin`, `${__dirname}/temp/PackageInput/AssetRegistry.bin`, { overwrite: true });

        child.exec(config.PackingCmd)
            .on('exit', async () => {
                if (logs.includes(`LogPakFile: Error: Failed to load `)) {
                    consolelog(`Failed to load ${logs.toString().split(`\n`).find(x => x.includes(`LogPakFile: Error: Failed to load `)).replace(`LogPakFile: Error: Failed to load `, ``)}`);
                    return r();
                }
                fs.moveSync(`${__dirname}/temp/${config.ModName}.pak`, outPath);
                r();
            })
            .stdout.on('data', (d) => logs += String(d));
    });
};

module.exports.unpack = unpack = function (path, outpath = W__dirname) {
    consolelog(`Unpacking ${chalk.cyan(PATH.basename(path).replace(`.pak`, ``))}`);
    if (wine) {
        path = `Z:${path}`;
        //outpath = `Z:${outpath}`;
    }
    const cmd = config.UnPackingCmd.replace(`{path}`, path).replace(`{outpath}`, outpath);
    logFile(`${path}\n${cmd}\n\n`)
    child.exec(cmd)
        .on('exit', async () => {
            var d = fs.readFileSync(config.logs);
            if (d.includes(`LogPakFile: Error: Failed to load `)) {
                consolelog(`Failed to load ${d.toString().split(`\n`).find(x => x.includes(`LogPakFile: Error: Failed to load `)).replace(`LogPakFile: Error: Failed to load `, ``)}`);
                exitHandler();
            } else if (d.includes(`LogPakFile: Display: Extracted `)) {
                consolelog(`Unpacked.`);
                exitHandler();
            }
        })
        .stdout.on('data', (d) => logFile(String(d)));
}


module.exports.backup = backup = function () {
    return new Promise(async r => {
        try {
            consolelog(`Making backup...`);
            if (!fs.existsSync(`${__dirname}/backups`))
                fs.mkdirSync(`${__dirname}/backups`);
            if (config.backup.max != -1) {
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
                    if (backups.length - i - 1 > config.backup.max)
                        fs.rmSync(`${__dirname}/backups/${x}`, { recursive: true, force: true });
                });
            }
            var id = -1;
            fs.readdirSync(`${__dirname}/backups`).forEach(x => {
                var xid = x.split(` - `)[0];
                if (isNaN(xid) && xid != `0`) return consolelog(`invalid ${x}`);
                xid = parseInt(xid);
                if (xid > id)
                    id = xid;
            });
            id++;
            var buf = `${__dirname}/backups/${id} - ${new Date(new Date().toUTCString()).toISOString().replace(/T/, ' ').replace(/\..+/, '')}`; // BackUp Folder
            fs.mkdirSync(buf);
            fs.copySync(`${__dirname}/../Content/${config.ModName}`, `${buf}/${config.ModName}`);
            if (config.backup.pak)
                fs.copySync(`${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`, `${buf}/${config.ModName}.pak`);
            if (config.zip.backups) {
                await zl.archiveFolder(buf, `${buf}.zip`);
                fs.rmSync(buf, { recursive: true, force: true })
            }
            console.log(searchDir(buf, config.backup.blacklist));
            if (config.backup.blacklist.length != 0) searchDir(buf, config.backup.blacklist).forEach(x => fs.rmSync(x, { recursive: true, force: true }));
            consolelog(`Backup done! id: ${chalk.cyan(id)}`);
            r();
        } catch (error) {
            consolelog(error);
            consolelog(`Retrying backup...`);
            r(await backup());
        }
    })
};

module.exports.refreshDirsToNeverCook = refreshDirsToNeverCook = function (whitelist = [config.ModName]) {
    whitelist = whitelist.concat(config.DirsToCook)
    var configFile = `${__dirname}/../Config/DefaultGame.ini`;
    var read = fs.readFileSync(configFile, `utf8`);
    read = read.split(getLineBreakChar(read));

    var dirsIndex = read.findIndex(x => x.includes(`+DirectoriesToNeverCook=(Path="/Game/`));
    read = read.filter(x => !x.includes(`+DirectoriesToNeverCook=`))
    fs.readdirSync(`${__dirname}/../Content/`).forEach(x => {
        if (!whitelist.includes(x))
            read.splice(dirsIndex, 0, `+DirectoriesToNeverCook=(Path="/Game/${x}")`)
    });
    fs.writeFileSync(configFile, read.filter(x => x != ``).join(`\n`));
}

module.exports.loadbackup = loadbackup = async function (id) {
    if (!id)
        if (!fs.existsSync(`${__dirname}/../Content/${config.ModName} Latest`))
            consolelog(`Missing id.`)
        else {
            consolelog(`Unloading backup...`);
            if (fs.existsSync(`${__dirname}/../Content/${config.ModName}`))
                fs.rmSync(`${__dirname}/../Content/${config.ModName}`, { recursive: true, force: true });
            fs.renameSync(`${__dirname}/../Content/${config.ModName} Latest`, `${__dirname}/../Content/${config.ModName}`);
            consolelog(`Unloaded backup.`);
            return;
        }
    if (!isNaN(id) && !Number.isInteger(parseInt(id))) return consolelog(`Invalid id. ${id}`); // custom ids would be nice
    var backuppath = fs.readdirSync(`${__dirname}/backups`).find(x => x.startsWith(`${id} - `))
    if (!backuppath) return consolelog(`Invalid backup id!`);
    var folder = backuppath.split(`/`)[backuppath.split(`/`).length - 1];
    consolelog(`Loading backup ${folder.split(` - `)[0]} from ${formatTime(new Date(new Date().toUTCString()) - new Date(folder.split(` - `)[1]))} ago`);

    if (fs.existsSync(`${__dirname}/../Content/${config.ModName}`) && fs.existsSync(`${__dirname}/../Content/${config.ModName} Latest`)) {
        consolelog(`Backup already loaded, removing.`);
        fs.rmSync(`${__dirname}/../Content/${config.ModName}`, { recursive: true, force: true });
    }

    if (fs.existsSync(`${__dirname}/../Content/${config.ModName}`))
        fs.renameSync(`${__dirname}/../Content/${config.ModName}`, `${__dirname}/../Content/${config.ModName} Latest`);
    if (folder.endsWith(`.zip`))
        await zl.extract(backuppath, `${__dirname}/../Content/${config.ModName}`);
    else {
        if (!fs.existsSync(`${__dirname}/backups/${backuppath}/${config.ModName}`)) return consolelog(`Backup dosent include mod folder.\n${chalk.cyan(backuppath)} includes:\n${fs.readdirSync(`${__dirname}/backups/${backuppath}`).map(x => chalk.cyan(x)).join(`, `)}`);
        fs.copySync(`${__dirname}/backups/${backuppath}/${config.ModName}`, `${__dirname}/../Content/${config.ModName}`);
    }
    refreshDirsToNeverCook();
    consolelog(`Backup loaded!`);
}

module.exports.exportTex = exportTex = (pakFolder = `${config.SteamInstall}/FSD/Content/Paks/`, out = `./export/`, flatPath = ``) => {
    // "no"'s are added couse otherwise I get a buffer overflow
    const cmd = `./umodel${platform == `win` ? `.exe` : ``}`;
    const args = [
        `-export`,
        `*.uasset`,
        `-path="${pakFolder}"`,
        `-out="${out}"`,
        `-game=ue4.27`,
        `-png`,
        `-nooverwrite`,
        `-nomesh`,
        `-noanim`,
        `-nostat`,
        `-novert`,
        `-nomorph`,
        `-nolightmap`,
    ];
    fs.mkdirsSync(out);
    consolelog(`Exporting...`);
    logFile(`\n${cmd} ${args.join(` `)}\n`);
    child.spawn(cmd, args)
        .on('exit', async () => {
            var d = fs.readFileSync(config.logs, `utf8`).split(`\n`);
            var completed = d.find(x => x.includes(`Exported`));
            if (completed) {
                consolelog(completed);
                if (flatPath) {
                    var filteredPath = flatPath;
                    var filter = `.png`;
                    var includes = ``;

                    consolelog(`Searching ${out}\nFiltering to ${filteredPath}\nFilter ${filter}\nIncludes ${includes}`);

                    var copies = {};
                    var i = 0;
                    if (!fs.existsSync(filteredPath))
                        fs.mkdirsSync(filteredPath);
                    read(out);
                    function read(starPath) {
                        var temppath = starPath;
                        fs.readdirSync(temppath).forEach(x => {
                            if (x.endsWith(filter) && x.includes(includes)) {
                                copies[(x.replace(includes, ``).replace(filter, ``))] = x.replace(includes, ``).replace(filter, ``);//`${filteredPath}${x}`;
                                if (!fs.existsSync(`${filteredPath}${x}`))
                                    fs.copyFileSync(`${temppath}${x}`, `${filteredPath}${x}`);
                                else {
                                    fs.copyFileSync(`${temppath}${x}`, `${filteredPath}${i}${x}`);
                                    consolelog(`Copy of ${filteredPath}${i}${x}`);
                                }
                                i++;
                            }
                            else if (!x.includes('.')) read(`${temppath}${x}/`);
                        });
                    }
                    consolelog(`Flattened ${i} files with ${Object.keys(copies).length} copies`);
                }
            } else
                consolelog(`Failed to export :(`);
        })
        .stdout.on('data', (d) => logFile(String(d)));
}

async function update() {
    const repo = `MrCreaper/drg-linux-modding`;
    if (!repo) return;
    const version = require(`./package.json`).version;
    return new Promise(async r => {
        var resp = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
        resp = await resp.json();
        if (resp.message) return r(); //console.log(resp); // usually rate limit error
        if (resp.tag_name.toLocaleLowerCase().replace(/v/g, ``) == version && !resp.draft && !resp.prerelease) return r();
        if (!process.pkg) {
            r();
            return consolelog(`Not downloading update for .js version`);
        }
        const asset = resp.assets.find(x => x.name.includes(os.platform()));
        if (!asset) return consolelog(`No compatible update download found.. (${os.platform()})`);
        consolelog(`Downloading update...`);
        //if (!fs.accessSync(__dirname)) return consolelog(`No access to local dir`);
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
                        consolelog(`Update finished! ${version} => ${resp.tag_name.replace(/v/g, ``)}`);
                        child.spawn(process.argv[0], process.argv.slice(1), {
                            stdio: 'inherit',
                        });
                        //process.exit(); // will make the child proccss "unkillable"
                        //r(); // wait forever
                    }))
            });
        }
    });
}

async function startDrg() {
    return new Promise(async r => {
        await killDrg();
        consolelog(`Launching DRG...`);
        var exited = false;
        setTimeout(() => {
            if (exited) return;
            consolelog(`Timedout launching DRG`);
            r();
        }, 10000);
        child.exec(`steam steam://rungameid/548430`)
            .on(`exit`, () => {
                exited = true;
                consolelog(`Lauched DRG`); // most likely
                r();
            })
            .on(`message`, (d) => logFile(String(d)))
            .stdout.on('data', (d) => logFile(String(d)))
    })
}

async function killDrg() {
    return new Promise(async r => {
        var prcList = await find('name', 'FSD');
        //consolelog(prcList);
        prcList.forEach(x => {
            try {
                if (x.cmd.toLocaleLowerCase().replace(/\\/g, `/`).includes(`/steam/`))
                    process.kill(x.pid);
            } catch (error) { }
        })
        r();
    })
}

// config ready, verify
if (!fs.existsSync(`${__dirname}/../Content/${config.ModName}`) && !process.argv.find(x => x.includes(`-lbu`))) return consolelog(`Your mod couldnt be found, ModName should be the same as in the content folder.`);
if (!fs.existsSync(`${__dirname}${config.ProjectFile}`)) return consolelog(`Couldnt find project file`);
if (!fs.existsSync(config.UnrealEngine)) return consolelog(`Couldnt find ue4\nPath: ${config.UnrealEngine}`);
if (!fs.existsSync(config.SteamInstall)) return consolelog(`Couldnt find drg\nPath: ${config.SteamInstall}`);

if (!fs.existsSync(`${__dirname}/../Config/DefaultGame.ini`)) return consolelog(`Couldnt find Config/DefaultGame.ini`);

var children = [];
async function exitHandler(err) {
    if (fs.existsSync(`${__dirname}/temp/`) && process.pkg) fs.rmSync(`${__dirname}/temp/`, { recursive: true, force: true });
    children.forEach(x => {
        x.destroy();
        children.splice(children.findIndex(x => x == x), 1);
    });
    if (err && err != `SIGINT`) console.log(err);
    if (process.pkg && !uiMode) await keypress();
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

if (module.parent) return; // required as a module
const uiMode = config.ui && process.argv.length == 2;

(async () => {

    if (process.getuid() == 0) {
        consolelog(`Refusing to run as root`);
        return exitHandler();
    }
    if (config.update) await update();

    var options = [
        {
            name: `cook`,
            color: `#00ff00`,
            run: cook,
        },
        {
            name: `publish`,
            color: `#00FFFF`,
            run: publish,
            hidden: () => {
                return config.modio.token && config.modio.gameid && config.modio.modid;
            },
        },
        {
            name: `backup`,
            color: `#03a5fc`,
            run: backup,
        },
        {
            name: `unload backup`,
            color: `#ffa500`,
            run: () => loadbackup(),
            hidden: () => {
                return fs.existsSync(`${__dirname}/../Content/${config.ModName} Latest`);
            },
        },
        { // shows backups which you can load and delete
            name: `list backups`,
            color: `#0328fc`,
            run: () => {
                var listBackupOptions = [
                    {
                        name: `back`,
                        color: `#00FFFF`,
                        run: () => {
                            selectedOptions = options;
                            selected = selectedOptions.filter(x => x.hidden ? x.hidden() : true).findIndex(x => x.name == `list backups`);
                        },
                    },
                ];
                var backuppath = fs.readdirSync(`${__dirname}/backups`);
                if (!backuppath) return consolelog(`Invalid backup id!`);
                backuppath.sort(function (a, b) {
                    var a = new Date(new Date().toUTCString()) - new Date(a.split(` - `)[1])
                    var b = new Date(new Date().toUTCString()) - new Date(b.split(` - `)[1])
                    if (a < b) return 1;
                    if (a > b) return -1;
                    return 0;
                });
                backuppath.forEach(x => {
                    listBackupOptions.push({
                        name: `${chalk.cyan(x.split(` - `)[0])} - ${formatTime(new Date(new Date().toUTCString()) - new Date(x.split(` - `)[1] + `.000Z`))}`,
                        color: `#FFFFFF`,
                        run: () => loadbackup(x.split(` - `)[0]),
                    });
                });
                selectedOptions = listBackupOptions;
                selected = 0;
            },
            hidden: () => fs.readdirSync(`${__dirname}/backups`).length,
        },
        {
            name: `settings`,
            color: `#808080`,
            run: () => {
                var settingsOptions = [
                    {
                        name: () => `${config.ProjectName} > ${config.ModName}`,
                    },
                    {
                        name: `back`,
                        color: `#00FFFF`,
                        run: () => {
                            selectedOptions = options;
                            selected = selectedOptions.filter(x => x.hidden ? x.hidden() : true).findIndex(x => x.name == `settings`);
                        },
                    },
                ];
                addSettings();
                function addSettings(configs = unVaredConfig, path = []) {
                    Object.keys(configs).forEach(key => {
                        var val = configs[key];
                        switch (typeof val) {
                            case `object`:
                                return addSettings(val, path.concat([key]));
                            case `boolean`:
                                break;
                            default:
                                return;
                        }
                        var setting = {
                            name: () => {
                                var name = path.length == 0 ? key : `${path.join(` > `)} > ${key}`;
                                var color = ``;
                                switch (typeof val) {
                                    case `boolean`:
                                        if (val)
                                            color = `#00ff00`; // on
                                        else
                                            color = `#ff0000`; // off
                                        break;
                                    default:
                                        color = `#ffffff`;
                                }
                                return name.replace(key, chalk.hex(color)(key));
                            },
                            run: () => {
                                switch (typeof val) {
                                    case `boolean`:
                                        val = !val;
                                        break;
                                }
                                var unVaredConfig0 = unVaredConfig;
                                path.forEach(x => unVaredConfig0 = unVaredConfig0[x]);
                                unVaredConfig0[key] = val;
                                writeConfig(unVaredConfig);
                                updateConfig();
                            },
                        };
                        settingsOptions.push(setting);
                    });
                }
                selectedOptions = settingsOptions;
                selected = 1;
            },
            hidden: () => fs.readdirSync(`${__dirname}/backups`).length,
        },
        {
            name: `drg`,
            color: `#ffa500`,
            run: startDrg,
        },
        {
            name: `quit`,
            color: `#ff0000`,
            run: exitHandler,
        },
        /*{
            name: `log`,
            color: `#ff0000`,
            run: () => consolelog(`AAA`),
        },*/
    ];
    var selectedOptions = options;
    var selected = 0;
    if (uiMode) {
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) process.stdin.setRawMode(true);
        process.stdin.on('keypress', (chunk, key) => {
            var k = key.name || key.sequence;
            selectedOptions = selectedOptions.filter(x => x.hidden ? x.hidden() : true);
            var selectedOption = selectedOptions[selected];
            //console.log(key);
            switch (k) {
                case `up`:
                    subS();
                    while (!selectedOptions[selected].run) {
                        subS();
                    }
                    function subS() {
                        if (selected - 1 < 0)
                            selected = selectedOptions.length - 1;
                        else
                            selected--;
                    }
                    break;
                case `down`:
                    addS();
                    while (!selectedOptions[selected].run) {
                        addS();
                    }
                    function addS() {
                        if (selected + 1 >= selectedOptions.length)
                            selected = 0;
                        else
                            selected++;
                    }
                    break;
                case `return`:
                    var name = selectedOption.color ? chalk.hex(dyn(selectedOption.color))(dyn(selectedOption.name)) : dyn(selectedOption.name);
                    if (selectedOption && selectedOption.run) {
                        if (selectedOption.running) {
                            // canceling processes would be sick
                            consolelog(`Already running ${name}`);
                        } else {
                            logHistory = [];
                            //consolelog(`Running ${name}...`);
                            var run = selectedOption.run();
                            if (String(run) == `[object Promise]`) {
                                selectedOption.running = true;
                                run.then(() => {
                                    selectedOption.running = false;
                                    draw();
                                });
                            }
                        }
                    } else consolelog(`No run command for ${name}`);
                    break;
                case `q`:
                    return exitHandler();
                case `C`:
                case `c`:
                    if (key.ctrl) return exitHandler();
                    break;
            }
            draw();
        });
        //setInterval(draw, 100);
        draw();
        function dyn(a) { // dynamic
            return typeof a == `function` ? a() : a;
        }
        consoleloge.on('log', log => draw());
        function draw(clean = false, options = selectedOptions) {
            options = options.filter(x => x.hidden ? x.hidden() : true);
            var longestOption = 0;
            options.forEach(x => {
                var l = removeColor(dyn(x.name)).length;
                if (longestOption < l) longestOption = l;
            });
            console.clear();

            // bg logs
            logHistory.slice(Math.max(logHistory.length - process.stdout.rows, 0)).forEach((x, i) => {
                process.stdout.cursorTo(0, /*process.stdout.rows - 2 - */i);
                switch (typeof x) {
                    case `object`:
                        x = JSON.stringify(x);
                        break;
                    case `function`:
                        x = `Function: ${x.name}`;
                        break;
                }
                process.stdout.write(x);
            });

            // options
            options.forEach((x, i) => {
                var name = dyn(x.name);
                switch (name) {
                    case `cook`:
                    case `publish`:
                    case `backup`:
                        if (x.running) name += `ing`;
                        if (x.running == false) name += `ed`;
                        break;
                }
                var nameNC = removeColor(dyn(name))
                var nameC = x.color ? chalk.hex(dyn(x.color))(name) : name; // color if there is a name
                var opt = clean ? ``.padStart(nameNC.length, ` `) : nameC;
                var X = Math.floor(process.stdout.columns * .5 - nameNC.length * .5);
                var Y = Math.floor(process.stdout.rows * .5 - options.length * .5) + i;
                process.stdout.cursorTo(X, Y); // x=left/right y=up/down
                process.stdout.write(opt);
            });

            // selection arrows
            var y = Math.floor(process.stdout.rows * .5 - options.length * .5) + selected;
            process.stdout.cursorTo(Math.floor(process.stdout.columns * .5 - longestOption * .5) - 1, y);
            process.stdout.write(`>`);
            process.stdout.cursorTo(Math.floor(process.stdout.columns * .5 + longestOption * .5), y);
            process.stdout.write(`<`);

            // latest log
            //process.stdout.cursorTo(Math.floor(process.stdout.columns * .5 - latestLog.length * .5), process.stdout.rows - 2);
            //process.stdout.write(latestLog);

            // reset location
            process.stdout.cursorTo(0, process.stdout.rows);
        }
        return;
    }

    if (process.argv.includes(`-verify`)) return;
    //if (process.argv.includes(`-help`)) return consolelog(``);

    if (process.argv.includes(`-gogo`)) {
        fs.rmSync(`${config.SteamInstall}/FSD/Content/Movies`, { recursive: true, force: true });
        fs.rmSync(`${config.SteamInstall}/FSD/Content/Splash`, { recursive: true, force: true });
        return;
    }

    if (process.argv.includes(`-drg`))
        config.startDRG = !config.startDRG;

    var logsDisabled = false;
    if (!config.logs) {
        fs.mkdirSync(`${__dirname}/temp/`);
        config.logs = `${__dirname}/temp/backuplogs.txt`;
        logsDisabled = true;
    }

    // unpack from argument
    var unpackFile = process.argv.find(x => x.includes(`.pak`));

    if (unpackFile) return unpack(unpackFile);

    if (config.logConfig)
        logConfig(config);
    function logConfig(config = config, depth = 0) {
        var maxConfigKeyLenght = 0;
        Object.keys(config).forEach(x => {
            if (x.length > maxConfigKeyLenght)
                maxConfigKeyLenght = x.length;
        });
        Object.keys(config).forEach(x => {
            if (!chalk) return consolelog(`${`${x}:`.padEnd(maxConfigKeyLenght + 3)}${typeof config[x] == `object` ? JSON.stringify(config[x]) : config[x]}`);
            var coloredVal = ``;
            var logged = false;
            function logConf() {
                if (!logged) {
                    const redactList = [`token`];
                    var log = `${`${x}:`.padEnd(maxConfigKeyLenght + 2)}${redactList.includes(x) && coloredVal && coloredVal.length > 10 ? `[REDACTED]` : coloredVal}`;
                    consolelog(log.padStart(log.length + depth));
                }
                logged = true;
            }
            switch (typeof config[x]) {
                case `object`:
                    if (Array.isArray(config[x])) {
                        coloredVal = chalk.cyan(JSON.stringify(config[x]));
                        logConf()
                    } else {
                        logConf();
                        logConfig(config[x], depth + x.length);
                    }
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
                default:
                case `undefined`:
                    coloredVal = chalk.blue(config[x]);
                    break;
            }
            logConf();
        });
    }

    if (config.logConfig) consolelog();
    logFile(`${JSON.stringify(config, null, 4)}\n`);

    if (process.argv.includes(`-bu`)) return backup();

    if (process.argv.find(x => x.includes(`-listbu`))) { // list backups
        var backuppath = fs.readdirSync(`${__dirname}/backups`)
        if (!backuppath) return consolelog(`Invalid backup id!`);
        backuppath.sort(function (a, b) {
            var a = new Date(new Date().toUTCString()) - new Date(a.split(` - `)[1])
            var b = new Date(new Date().toUTCString()) - new Date(b.split(` - `)[1])
            if (a < b) return 1;
            if (a > b) return -1;
            return 0;
        });
        backuppath.forEach(x => {
            consolelog(`${chalk.cyan(x.split(` - `)[0])} - ${formatTime(new Date(new Date().toUTCString()) - new Date(x.split(` - `)[1] + `.000Z`))}`);
        });
        consolelog(`\nBackups: ${chalk.cyan(backuppath.length)}`);
        exitHandler()
        return;
    }

    if (process.argv.find(x => x.includes(`-lbu`)))
        return loadbackup(process.argv.find(x => x.includes(`-lbu`)).replace(`-lbu`, ``));

    // just becomes hidden, for some reason.. and then, bug reporter jumpscare for .1s
    //if (process.argv.includes(`-ue`))
    //return child.exec(`wine "${config.UnrealEngine}/Engine/Binaries/Win64/UE4Editor.exe" "${W__dirname}/../FSD.uproject"`).on('message', log)
    //return child.exec(`env WINEPREFIX="/home/creaper/Games/epic-games-store" wine C:\\\\Program\\ Files\\\\Epic\\ Games\\\\UE_4.27\\\\Engine\\\\Binaries\\\\Win64\\\\UE4Editor.exe ${W__dirname}/../FSD.uproject`);

    async function publish() {
        return new Promise(async r => {
            consolelog(`Publising...`);
            var madeZip = false;
            if (!fs.existsSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}.zip`)) {
                await zl.archiveFolder(`${config.SteamInstall}/FSD/Mods/${config.ModName}/`, `${config.SteamInstall}/FSD/Mods/${config.ModName}.zip`);
                madeZip = true;
            }
            var res = await uploadMod(`${config.SteamInstall}/FSD/Mods/${config.ModName}.zip`, true);
            if (res != true)
                consolelog(`Failed ${res.status}: ${res.statusText}`);
            else consolelog(`Published!`);
            if (madeZip) fs.rmSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}.zip`);
            r();
        })
    }
    if (process.argv.includes(`-onlypublish`))
        return await publish();

    function pack() {
        return new Promise(r => {
            consolelog(`packing...`);
            logFile(`\n${config.PackingCmd}\n\n`);

            if (fs.existsSync(`${__dirname}/temp/`))
                fs.rmSync(`${__dirname}/temp/`, { recursive: true, force: true });
            fs.mkdirSync(`${__dirname}/temp/`);
            fs.writeFileSync(`${__dirname}/temp/Input.txt`, `"${W__dirname}/temp/PackageInput/" "../../../FSD/"`);
            if (!fs.existsSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`)) return consolelog(`Cook didnt cook anything :|`);
            fs.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`, `${__dirname}/temp/PackageInput/Content/`, { overwrite: true });
            fs.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/AssetRegistry.bin`, `${__dirname}/temp/PackageInput/AssetRegistry.bin`, { overwrite: true });

            var ch = child.exec(config.PackingCmd)
                .on('exit', async () => {
                    var d = fs.readFileSync(config.logs);
                    if (d.includes(`LogPakFile: Error: Failed to load `)) {
                        consolelog(`Failed to load ${d.toString().split(`\n`).find(x => x.includes(`LogPakFile: Error: Failed to load `)).replace(`LogPakFile: Error: Failed to load `, ``)}`);
                        return r();
                    }
                    fs.rmSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}`, { recursive: true, force: true });
                    fs.mkdirSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}`);
                    if (!fs.existsSync(`${__dirname}/temp/${config.ModName}.pak`)) {
                        var wrongCook = fs.readdirSync(`${__dirname}/temp/`).find(x => x.endsWith(`.pak`));
                        consolelog(`Failed to cook correct project :)\nYour command:\n${config.PackingCmd.replace(wrongCook, chalk.red(wrongCook))}`);
                        return r();
                    }
                    fs.renameSync(`${__dirname}/temp/${config.ModName}.pak`, `${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
                    consolelog(`Packed!`);

                    if (config.zip.onCompile) {
                        await zl.archiveFolder(`${config.SteamInstall}/FSD/Mods/${config.ModName}/`, `${config.SteamInstall}/FSD/Mods/${config.ModName}.zip`)
                        config.zip.to.forEach(dir =>
                            fs.copySync(`${config.SteamInstall}/FSD/Mods/${config.ModName}.zip`, `${dir}${config.ModName}.zip`)
                        );
                    }

                    if (process.argv.includes(`-publish`) || config.modio.onCompile) publish();
                    /*if(config.modio.deleteOther){
                        var files = await getFiles();
                        files.forEach(x => x. deleteModFile(x.id)) // wait for modio devs to add "active" object
                    }*/
                    if (config.backup.onCompile) await backup();
                    if (config.startDRG) await startDrg();

                    // clear swap, can couse crashes couse it just piles up after compiles for some reason? Requires root
                    /*if (config.ClearSwap || os.freemem() / os.totalmem() > .5) {
                        consolelog(`Clearing swap... ${Math.floor(os.freemem() / os.totalmem() * 100)}%`);
                        await new Promise(r =>
                            child.exec(`swapoff -a && swapon -a && sync; echo 3 > /proc/sys/vm/drop_caches`).on(`close`, () => {
                                consolelog(`Swap cleared.`);
                                r();
                            }));
                    }*/

                    consolelog(`Done in ${chalk.cyan(formatTime(new Date() - startTime))}!`);
                    r();
                })
                .stdout.on('data', (d) => logFile(String(d)));
            children.push(ch);
        });
    }
    if (process.argv.includes(`-unpackdrg`)) return unpack(`${config.SteamInstall}/FSD/Content/Paks/FSD-WindowsNoEditor.pak`);
    if (process.argv.includes(`-export`)) return exportTex();
    if (process.argv.includes(`-exportFlat`)) return exportTex(undefined, undefined, `./flat/`);

    /*module.exports.jsonify = jsonify = function jsonify(file) {
        const { Extractor } = require('node-wick');
    
        // Make a new Extractor by specifying the file path (minus the extension), and the AES encryption key as a hexadecimal string.
        let extractor = new Extractor("pakchunk", "");
    
        // Iterate over all the files in the ucas, and extract them.
        // get_file_list returns an array of file paths within the ucas. You will need the index in the array to extract the files.
        extractor.get_file_list().forEach((v, idx) => {
            // get_file(path) returns a NodeJS Buffer with the decrypted file contents.
            fs.writeFileSync(idx + ".uasset", extractor.get_file(v));
        });
    }*/

    // idk fs.access just false all the time.
    /*if (fs.existsSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor`) && !fs.accessSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor`, fs.constants.W_OK | fs.constants.R_OK)) {
        consolelog(`\nNo access to /Saved/Cooked/WindowsNoEditor`);
        if (platform == `linux`) consolelog(`Please run:\nchmod 7777 -R ${__dirname}/../Saved/Cooked/WindowsNoEditor`);
        //return exitHandler();
        //fs.chmodSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor`,0777); // no access means no access, idiot
    }
    
    if (fs.existsSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`) && !fs.accessSync(`${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`, fs.constants.W_OK | fs.constants.R_OK)) {
        consolelog(`\nNo access to ${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
        if (platform == `linux`) consolelog(`Please run:\nchmod 7777 -R ${config.SteamInstall}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
        //return exitHandler();
        //fs.chmodSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor`,0777); // no access means no access, idiot
    }*/

    if (config.startDRG && config.killDRG) // kill drg and before cooking to save ram
        await killDrg();

    cook();
    var startTime = new Date();
    function cook() {
        return new Promise(r => {
            startTime = new Date();
            consolelog(`Processing ${chalk.cyan(config.ModName)}`);
            consolelog(`cooking...`);
            refreshDirsToNeverCook();
            logFile(`\n${config.CookingCmd}\n\n`);
            killDrg();
            var ch = child.exec(config.CookingCmd)
                .on('exit', async () => {
                    var d = fs.readFileSync(config.logs, `utf8`);
                    if (d.includes(`LogInit: Display: Success - 0 error(s),`)) {
                        consolelog(`Cooked!`);
                        await pack();
                        r();
                    } else if (d.includes(`LogInit: Display: Failure - `)) {
                        var errs = 0;
                        var errorsLogs = ``;
                        d.split(`\n`).forEach(x => {
                            if (!x.includes(`LogInit: Display: `) || !x.includes(` Error: `)) return;
                            errs++;
                            try {
                                var log = x
                                    .split(`[  0]`)[1] // after timestamp
                                    .replace(/LogInit: Display: /g, ``)
                                    .replace(/LogProperty: Error: /g, ``)
                                    .replace(/ Error: /g, ``)
                                    .replace(new RegExp(`Z:`, 'g'), ``)
                                    .replace(new RegExp(W__dirname.replace(`/compiler/`, ``).replace(`\\compiler\\`, ``), 'g'), ``)
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
                                    .replace(`. `, ` | ERR: `)
                                    .trim()
                                    .replace(/  /g, ` `).replace(/  /g, ` `)
                                    .replace(/LogBlueprint/g, `BP`)
                                log = log.replace(`.${log.split(` `)[0].split(`.`)[1]}`, ``) // weird file.file thing
                                //.replace(/./g, ``) // for some reason it removes the first '/' in the path?
                                while (log.split(` `).find(x => x.includes(`.`))) {
                                    log = log.replace(`.${log.split(` `).find(x => x.includes(`.`)).split(`.`)[1]}`, ``) // weird function.function thing
                                }
                                errorsLogs += `${log}\n`;
                            } catch (err) {
                                consolelog(`BEAUTY ERROR: ${x}`);
                                consolelog(err);
                                errorsLogs += `${x}\n`;
                            }
                        });
                        consolelog(`Errors ${errs}:\n\n${errorsLogs}`);
                        if (logsDisabled) {
                            consolelog(`${chalk.red(`Failed`)}y. Check the logs and-... oh wait, you disabled logs. Lucky for you, I make backups.`);
                            fs.renameSync(config.logs, `${__dirname}/logs.txt`);
                            return r();
                        }
                        consolelog(`${errs != 0 ? `\n` : ``}${chalk.red(`Failed`)}. Check the logs${errs != 0 ? ` (or check the above)` : ``} and fix your damn "code"`);
                        return r();
                    } else {
                        consolelog(`What the fuck did you do.`);
                        return r();
                    }
                })
                .stdout.on('data', (d) => logFile(String(d)));
            children.push(ch);
        });
    }
})();

// ~ for console
// recompileshaders all