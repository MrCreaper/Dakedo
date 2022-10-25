const fs = require('fs-extra');
const child = require(`child_process`);
const PATH = require('path');
const find = require('find-process');
const https = require(`https`);
const os = require(`os`);
const chalk = require(`chalk`);
const zl = require("zip-lib");
var crypto = require('crypto');
var FormData = require('form-data');
const readline = require(`readline`);
const { EventEmitter } = require(`events`);
class Emitter extends EventEmitter { }
const consoleloge = new Emitter();

var latestLog = ``;
var logHistory = [];
var logLimit = 100;
/**
 * Custom log function
 * @param {string} log the log
 * @param {boolean} urgent Used for logging very important stuff as module
 * @returns {intreger} logHistory index
 */
function consolelog(log = ``, urgent = false, save = true, event = true) {
    if (!module.parent || urgent || module.exports.logsEnabled) // stfu if module
        //console.log.apply(arguments);
        console.log(log);
    if (!log && log != 0) return;
    switch (typeof log) {
        case `object`:
            log = JSON.stringify(log, null, 4);
            break;
        case `function`:
            log = `Function: ${log.name}`;
            break;
        default:
            log = String(log);
            break;
    }
    latestLog = log;
    var i = logHistory.push(log);
    while (logHistory.length > logLimit) {
        logHistory.shift();
    }
    if (event)
        consoleloge.emit(`log`, log);
    if (save)
        logFile(`${log}\n`);
    return i;
}

var fittedLogs = [];
function formatLogs(rawlogs = logHistory) {
    var logs = [];
    // split multiple line logs
    rawlogs.forEach(x => logs = logs.concat(x.split(`\n`)));

    logs = wrapLogs(logs);
    function wrapLogs(logs = []) {
        var out = [];
        logs.forEach(x => {
            var log = String(x);
            while (log.length > process.stdout.columns) {
                out.push(log.slice(0, process.stdout.columns));
                log = log.slice(process.stdout.columns);
            }
            out.push(log);
        });
        return out;
    }
    return logs;
}

function filterOffScreenLogs(logs, push = 0) {
    return logs.filter((x, i) => i + push > -1 && !(i + push >= process.stdout.rows));
}

function since(time) {
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

function escapeRegEx(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function formatTime(time) {
    if (config.modio.xm)
        var timeS = time.split(` `);
    if (timeS[1])
        timeS[1] = convertTime(timeS[1]);
    else timeS[0] = convertTime(timeS[0]);
    return timeS.join(` `);
}

function t24hToXM(time) {
    // Check correct time format and split into components
    time = time.toString().match(/^([01]\d|2[0-3])(:)([0-5]\d)(:[0-5]\d)?$/) || [time];

    if (time.length > 1) { // If time format correct
        time = time.slice(1);  // Remove full string match value
        time[5] = +time[0] < 12 ? 'am' : 'pm'; // Set AM/PM
        time[0] = +time[0] % 12 || 12; // Adjust hours
    }
    return time.join(``); // return adjusted time or original string
}

function tXMto24h(time) {
    var hours = Number(time.match(/^(\d+)/)[1]);
    var minutes = Number(time.match(/:(\d+)/)[1]);
    var AMPM = time.match(/\s(.*)$/)[1];
    if (AMPM == "PM" && hours < 12) hours = hours + 12;
    if (AMPM == "AM" && hours == 12) hours = hours - 12;
    var sHours = hours.toString();
    var sMinutes = minutes.toString();
    if (hours < 10) sHours = "0" + sHours;
    if (minutes < 10) sMinutes = "0" + sMinutes;
    return sHours + ":" + sMinutes;
}

/**
 * Clears swap and ram
 * @param {boolean} force 
 * @returns {void}
 */
async function clearMem(force = config.ClearSwap) {
    if (process.getuid() != 0) return; // requires root
    if (os.freemem() / os.totalmem() > .5 || force)
        return new Promise(r =>
            child.exec(`swapoff -a && swapon -a && sync; echo 3 > /proc/sys/vm/drop_caches`).on(`close`, () => {
                consolelog(`Memory cleared.`);
                r();
            }));
}

function removeColor(input) {
    return input.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
}

function getUsername() {
    return child.spawnSync(`users`).output[1].toString().replace(/\n/, ``);
}
var utcNow = new Date(new Date().toUTCString());

__dirname = PATH.dirname(process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0])); // fix pkg dirname
const W__dirname = `Z:/${__dirname}`.replace(`//`, `/`); // we are Z, they are C. for wine

var username = os.userInfo().username;

var config = {
    ProjectName: "FSD",
    ModName: findModName(),
    ProjectFile: `/../FSD.uproject`,
    DirsToCook: [], // folder named after ModName is automaticlly included
    UnrealEngine: ``, // auto generated
    drg: ``, // auto generated
    CookingCmd: ``, // auto generated
    PackingCmd: ``, // auto generated
    UnPackingCmd: ``, // auto generated
    logs: `./logs.txt`, // empty for no logs
    externalLog: ``, // show new logs from another file
    startDRG: false, // when cooked
    killDRG: true, // when starting cook
    logConfig: false, // only on cmd version
    ui: {
        enabled: true,  // use the ui version by default
        cleanBox: true, // clean logs around the options
        cleanSelected: false, // clean logs only between selection arrows
        shortcuts: [
            /*{
                name: `cook & publish`, // display name
                color: `00f0f0`, // hex color
                run: `cook,publish`, // functions
                index: 2, // index on list
            },*/
        ],
    },
    backup: {
        folder: `./backups`, // leave empty
        onCompile: true,
        max: 5, // -1 for infinite
        pak: false,
        blacklist: [`.git`],
        //all: false, // backup the entire project
    },
    zip: {
        onCompile: true, // placed in the mods/{mod name} folder
        backups: false,
        to: [`./`], // folders to place the zip in, add the zip to the mod folder, for if you want to add the zip to github and to modio https://github.com/nickelc/upload-to-modio
    },
    modio: {
        token: ``, // https://mod.io/me/access > oauth access
        gameid: 2475, // DRG
        modid: 0, // aka "Resource ID"
        onCompile: false, // upload on compile
        deleteOther: true, // deletes older or non-active files
        dateVersion: true, // make version from the date year.month.date, otherwise get version from project
        msPatch: true, // adds ms to the end of the dateVersion. Less prefered then default (applied when deleteOther=false).
        xm: true, // use am/pm or 24h
    },
    update: true, // automaticlly check for updates
};

/*
    cookedVariable: { // replace all instances of {key} (RegExp) with {value}
        "[compile time here]": "{time}",
    },
*/

const originalplatformPaths = {
    win: {
        UnrealEngine: `C:\\Program Files (x86)\\Epic Games\\UE_4.27`,
        drg: `C:\\Program Files (x86)\\Steam\\steamapps\\common\\Deep Rock Galactic`,
        CookingCmd: `{UnrealEngine}/Engine/Binaries/Win64/UE4Editor-Cmd.exe {dir}{pf} -run=cook -targetplatform=WindowsNoEditor`,
        PackingCmd: `{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe {dir}/temp/{mod}.pak -Create="{dir}/temp/Input.txt`,
        UnPackingCmd: `{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe -platform="Windows" -extract "{path}" "{outpath}"`,
    },
    linux: {
        UnrealEngine: `/home/{me}/Documents/UE_4.27`,
        drg: `/home/{me}/.local/share/Steam/steamapps/common/Deep Rock Galactic`,
        CookingCmd: `{UnrealEngine}/Engine/Binaries/Linux/UE4Editor-Cmd {dir}{pf} -run=cook -targetplatform=WindowsNoEditor`,
        PackingCmd: `{UnrealEngine}/Engine/Binaries/Linux/UnrealPak {dir}/temp/{mod}.pak -Create="{dir}/temp/Input.txt"`,
        UnPackingCmd: `{UnrealEngine}/Engine/Binaries/Linux/UnrealPak -platform="Windows" -extract "{path}" "{outpath}"`,
    },
    linuxwine: {
        UnrealEngine: `/home/{me}/Games/epic-games-store/drive_c/Program Files/Epic Games/UE_4.27`,
        drg: `/home/{me}/.local/share/Steam/steamapps/common/Deep Rock Galactic`,
        CookingCmd: `wine "{UnrealEngine}/Engine/Binaries/Win64/UE4Editor-Cmd.exe" "{dir}{pf}" "-run=cook" "-targetplatform=WindowsNoEditor"`,
        PackingCmd: `wine "{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe" "{dir}/temp/{mod}.pak" "-Create="{dir}/temp/Input.txt""`,
        UnPackingCmd: `wine "{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe" "-platform="Windows"" "-extract" "{path}" "{outpath}"`,
    },
    macos: {
        UnrealEngine: `no idea`,
        drg: `no idea`,
        CookingCmd: `no idea`,
        PackingCmd: `no idea`,
        UnPackingCmd: `no idea`,
    },
    givenUpos: { // fallback
        UnrealEngine: `no idea`,
        drg: `no idea`,
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
if (process.getuid() != 0) // not running as root
    updateConfig();
async function updateConfig(forceNew = false) {
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
    Object.keys(config/*paths*/).forEach(x => {
        if (typeof config[x] == `string`) {
            config[x] = config[x]
                .replace(/{UnrealEngine}/g, platformPaths[platform].UnrealEngine)
                .replace(/{drg}/g, config.drg)
                //.replace(/.\//g, `${plat.includes(`wine`) ? W__dirname : __dirname}/`)
                .replace(/{me}/g, username)
                .replace(/{mod}/g, config.ModName)
                .replace(/{pf}/g, config.ProjectFile);
            if (platform == `linuxwine`)
                config[x] = config[x]
                    .replace(/{dir}/g, W__dirname); // better to use "{dir}" then "./" since this is running over all configs :)
            else
                config[x] = config[x]
                    .replace(/{dir}/g, __dirname);
        }
    });

    // config ready, verify
    if (!fs.existsSync(`${__dirname}/../Content/${config.ModName}`) && !process.argv.find(x => x.includes(`-lbu`))) return consolelog(`Your mod couldnt be found, ModName should be the same as in the content folder.`);
    if (!fs.existsSync(`${__dirname}${config.ProjectFile}`)) return consolelog(`Couldnt find project file`);
    if (!fs.existsSync(config.UnrealEngine)) return consolelog(`Couldnt find ue4\nPath: ${config.UnrealEngine}`);
    if (!fs.existsSync(config.drg)) return consolelog(`Couldnt find drg\nPath: ${config.drg}`);

    /**
     * Reads a portion of a file
     * @param {string} path 
     * @param {number} at 
     * @returns {promise<string>}
     */
    function readAt(path, at) {
        return new Promise(r => {
            var out = ``;
            fs.createReadStream(path, { start: at }).on(`data`, d => {
                out += String(d);
            }).on(`close`, () => r(out.slice(2))); // I LOVE HIDDEN HEADERS
        })
    }
    function readLength(path) {
        return new Promise(r => {
            var length = 0;
            fs.createReadStream(path).on(`data`, d => {
                length += String(d).length;
            }).on(`close`, () => r(length));
        })
    }
    if (config.externalLog)
        if (!fs.existsSync(config.externalLog))
            consolelog(`Invalid externalLog ${config.externalLog}`);
        else {
            var externalLogsStart = fs.readFileSync(config.externalLog).toString().length;
            fs.watchFile(config.externalLog, async (curr, prev) => {
                if (!fs.existsSync(config.externalLog)) return consolelog(`Failed to find externallog? Its probably fine, il just check again...`);
                var read = fs.readFileSync(config.externalLog).toString().slice(externalLogsStart).replace(/ /g, ``).replace(/[^\x00-\x7F]/g, ""); // so much simpler but whatever
                externalLogsStart += read.length;
                //consolelog(chalk.cyan(read.slice(0, 3).includes(`\n`) ? read.replace(`\n`, ``) : read), undefined, false); // remove starting new line and header
                read.split(`\n`).forEach(x => consolelog(chalk.cyan(x)));
                /*var log = await readAt(config.externalLog, externalLogsStart); // I just had to worry about non-existent 50gb log files of all things :\
                consolelog(chalk.cyan(log.startsWith(`\n`) ? log.replace(`\n`, ``) : log));
                if (log.length)`
                    externalLogsStart += log.length;
                else
                    externalLogsStart = 0;*/
            });
        }
}

function logFile(log) {
    if (config && config.logs)
        fs.appendFileSync(config.logs, removeColor(log))
}

// exports
module.exports.config = config;

function ObjectToForm(obj = {}) {
    var form = new FormData();
    Object.keys(obj).forEach(key => {
        var val = obj[key];
        switch (typeof val) {
            case `boolean`:
                val = String(val);
                break;
        }
        form.append(key, val);
    });
    return form;
}

function getDateVersion() {
    return new Promise(async r => {
        var files = await getFiles();
        if (!files) return r(``);
        var patch = 0;
        var todaysVersion = `${utcNow.getUTCFullYear().toString().slice(-2)}.${utcNow.getUTCMonth() + 1}.${utcNow.getUTCDate()}`;
        files.forEach(f => {
            if (new Date() - new Date(f.date_added) < 86400000 * 100000) // uploaded in the last 24h
                patch++;
        });
        // I dont really want to use a cache for counting patches...
        var ms = new Date().getMilliseconds();
        var ver = `${todaysVersion}${patch && !config.modio.deleteOther ? `-${patch}` : (config.modio.msPatch ? `-${ms}` : ``)}`;
        if (ver == files[0].version && !config.modio.deleteOther)
            r(`${ver.replace(`-${ms}`, `-${ms + 1 == 1000 ? 0 : ms + 1}`)}-LUCKY`); // You had a bad time ONCE
        else
            r(ver);
    })
}

module.exports.uploadMod = uploadMod = async (
    zip = `${__dirname}/${config.ModName}.zip`, // mods folder one dosent have permission so maybe not? `${config.drg}/FSD/Mods/${config.ModName}.zip`
    active = true,
    version = config.modio.dateVersion ? getDateVersion() : findModVersion(),
    changelog = `Uploaded: ${t24hToXM(utcNow.toISOString().replace(/T/, ' ').replace(/\..+/, ''))}`,
    meta = ``,
) => {
    return new Promise(async (r, re) => {
        if (!fs.existsSync(zip)) return r(consolelog(`File dosent exist.\n${zip}`));
        if (fs.statSync(zip).size > 5368709120) return r(consolelog(`Zip bigger then 5gb`));
        if (String(version) == `[object Promise]`) version = await version;
        var body = {
            filedata: fs.createReadStream(zip),
            filehash: crypto.createHash('md5').update(fs.readFileSync(zip)).digest('hex'),
            version: version,
            active: active,
            changelog: changelog,
            metadata_blob: meta,
        };
        var form = ObjectToForm(body);

        var options = {
            hostname: 'api.mod.io',
            port: 443,
            path: `/v1/games/${config.modio.gameid}/mods/${config.modio.modid}/files`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.modio.token}`,
                ...form.getHeaders(),
                'Accept': 'application/json',
            },
        };

        var req = https.request(options, (res) => {
            var data = [];
            res.on('data', (d) => data.push(d));
            req.on(`close`, async () => {
                var buffer = Buffer.concat(data);
                var resp = JSON.parse(buffer.toString());
                if (res.statusCode == 201)
                    r(resp);
                else {
                    if (resp.error.code == 422) {
                        consolelog(`Stupid error. Retrying.. >:(`);
                        r(await uploadMod.apply(null, [...arguments]));
                    }
                    if (resp.error)
                        consolelog(resp.error);
                    else consolelog(resp);
                    r(false);
                }
            });
        });

        req.on('error', (e) => {
            consolelog(`Error publishing:`);
            consolelog(e);
            r(e);
        });

        form.pipe(req)
            .on(`close`, () => req.end());
    })
};

module.exports.deleteModFile = deleteModFile = async function (id) {
    return new Promise(async (r, re) => {
        var options = {
            hostname: 'api.mod.io',
            port: 443,
            path: `/v1/games/${config.modio.gameid}/mods/${config.modio.modid}/files/${id}`,
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${config.modio.token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
        };

        var req = https.request(options, (res) => {
            var data = [];
            res.on('data', (d) => data.push(d));
            req.on(`close`, () => {
                var buffer = Buffer.concat(data);
                var resp = buffer.toString();
                if (res.statusCode == 204)
                    r(true);
                else {
                    if (isJsonString(resp) && JSON.parse(resp).error)
                        consolelog(JSON.parse(resp).error);
                    else consolelog(resp);
                    r(false);
                }
            });
        });

        req.on('error', (e) => r(e));
        req.end();
    })
};

module.exports.getFiles = getFiles = async function (gameid = config.modio.gameid, modid = config.modio.modid, token = config.modio.token) {
    return new Promise(async (r, re) => {
        var options = {
            hostname: 'api.mod.io',
            port: 443,
            path: `/v1/games/${config.modio.gameid}/mods/${config.modio.modid}/files`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.modio.token}`,
                'Accept': 'application/json',
            },
        };

        var req = https.request(options, (res) => {
            var data = [];
            res.on('data', (d) => data.push(d));
            req.on(`close`, () => {
                var buffer = Buffer.concat(data);
                var resp = JSON.parse(buffer.toString());
                if (res.statusCode == 200)
                    r(resp.data);
                else {
                    if (resp.error)
                        consolelog(resp.error);
                    else consolelog(resp);
                    r(false);
                }
            });
        });

        req.on('error', (e) => r(e));
        req.end();
    })
};

globalThis.publish = async function () {
    return new Promise(async r => {
        consolelog(`Publising...`);
        var madeZip = false;
        var zip = `${config.drg}/FSD/Mods/${config.ModName}.zip`;
        if (!fs.existsSync(zip)) {
            await zl.archiveFolder(`${config.drg}/FSD/Mods/${config.ModName}/`, zip);
            madeZip = true;
        }
        var res = await uploadMod(zip);
        if (!res.filename)
            consolelog(`Failed to publish`);
        else {
            consolelog(`Published! ${chalk.cyan(res.version ? `v${res.version}` : res.filename)}`);

            if (config.modio.deleteOther) {
                var files = await getFiles();
                if (files)
                    files.filter(x => x.filename != res.filename).forEach(x => deleteModFile(x.id));
            }
        }
        if (madeZip) fs.rmSync(`${config.drg}/FSD/Mods/${config.ModName}.zip`);

        r(res == true);
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
                fs.copySync(`${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`, `${buf}/${config.ModName}.pak`);
            if (config.zip.backups) {
                await zl.archiveFolder(buf, `${buf}.zip`);
                fs.rmSync(buf, { recursive: true, force: true })
            }
            //console.log(searchDir(buf, config.backup.blacklist));
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
    if (!read.includes(`BuildConfiguration=PPBC_Shipping`)) read.push(`BuildConfiguration=PPBC_Shipping`); // has to be shipping

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
    consolelog(`Loading backup ${folder.split(` - `)[0]} from ${since(new Date(new Date().toUTCString()) - new Date(folder.split(` - `)[1]))} ago`);

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

module.exports.exportTex = exportTex = (pakFolder = `${config.drg}/FSD/Content/Paks/`, out = `./export/`, flatPath = ``) => {
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

if (!fs.existsSync(`${__dirname}/../Config/DefaultGame.ini`)) return consolelog(`Couldnt find Config/DefaultGame.ini`);

var children = [];
async function exitHandler(err) {
    if (fs.existsSync(`${__dirname}/temp/`) && process.pkg) fs.rmSync(`${__dirname}/temp/`, { recursive: true, force: true });
    children.forEach(x => {
        if (!x.kill) console.log(`This isnt a fucking child!`);
        x.kill();
        children.splice(children.findIndex(x => x == x), 1);
    });
    if (err && err != `SIGINT` && err.name && err.message) console.log(err);
    if (process.pkg && err) await keypress();
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

(async () => {
    if (process.getuid() == 0) {
        consolelog(`Running as root`);
        username = getUsername();
        consolelog(`User: ${chalk.cyan(username)}`);
        updateConfig();
    }
    if (config.update) await update();

    function getOptionIndex(name = `cook`, menu = selectedMenu) {
        return menu.filter(x => x.hidden ? x.hidden() : true).findIndex(x => x.name == name);
    }

    var mainMenu = [
        {
            name: (self) => self.running == undefined ? `cook` : (self.running == false ? `cooked` : `cooking`),
            color: `#00ff00`,
            run: cook,
        },
        {
            name: (self) => self.running == undefined ? `publish` : (self.running == false ? `published` : `publishing`),
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
        { // shows backups which you can load
            name: `list backups`,
            color: `#0328fc`,
            run: (self) => {
                var listBackupOptions = [
                    {
                        name: `back`,
                        color: `#00FFFF`,
                        run: () => {
                            selectedMenu = mainMenu;
                            selected = getOptionIndex(self.name);
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
                        name: `${chalk.cyan(x.split(` - `)[0])} - ${since(new Date(new Date().toUTCString()) - new Date(x.split(` - `)[1] + `.000Z`))}`,
                        color: `#FFFFFF`,
                        run: () => loadbackup(x.split(` - `)[0]),
                    });
                });
                selectedMenu = listBackupOptions;
                selected = 0;
            },
            hidden: () => fs.readdirSync(`${__dirname}/backups`).length,
        },
        {
            name: `settings`,
            color: `#808080`,
            run: (self) => {
                var settingsMenu = [
                    {
                        name: () => `${config.ProjectName} > ${config.ModName}`,
                    },
                    {
                        name: `back`,
                        color: `#00FFFF`,
                        run: () => {
                            selectedMenu = mainMenu;
                            selected = getOptionIndex(self.name);
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
                        settingsMenu.push(setting);
                    });
                }
                selectedMenu = settingsMenu;
                selected = 1;
            },
            hidden: () => fs.readdirSync(`${__dirname}/backups`).length,
        },
        {
            name: (self) => self.running == undefined ? `drg` : self.running == false ? `drg` : `launching...`,
            color: `#ffa500`,
            run: startDrg,
        },
        {
            name: `quit`,
            color: `#ff0000`,
            run: exitHandler,
        },
        {
            name: `debug`,
            color: `#00ff00`,
            run: (self) => {
                selectedMenu = [
                    {
                        name: `back`,
                        color: `#00FFFF`,
                        run: () => {
                            selectedMenu = mainMenu;
                            selected = getOptionIndex(self.name);
                        }
                    },
                    {
                        name: `log`,
                        color: `#ffffff`,
                        run: () => consolelog(`AAA ${logHistory.length}`), // remember that the log limit is 100
                    },
                    {
                        name: `bulk log`,
                        color: `#ffffff`,
                        run: () => {
                            for (var i = 0; i < 5; i++) {
                                consolelog(`AAAA ${i}`);
                            }
                        }
                    },
                    {
                        name: `long log`,
                        color: `#ffffff`,
                        run: () => {
                            consolelog(new Array(process.stdout.columns).join(`A`));
                        }
                    },
                    {
                        name: `fill`,
                        color: `#ffffff`,
                        run: () => {
                            for (var i = 0; i < process.stdout.rows; i++) {
                                consolelog(new Array(process.stdout.columns).join(`A`));
                            }
                        }
                    },
                    {
                        name: `time`,
                        color: `#ffffff`,
                        run: () => {
                            consolelog(t24hToXM(new Date()));
                        },
                    },
                    {
                        name: `clear`,
                        color: `#ffffff`,
                        run: () => {
                            logHistory = [];
                        },
                    },
                    {
                        name: `empty`,
                        color: `#ffffff`,
                        run: () => { },
                    },
                ];
                selected = 0;
            },
            hidden: () => !process.pkg,
        },
    ];
    config.ui.shortcuts.forEach(x => {
        var index = x.index == undefined ? mainMenu.length : x.index;
        var shortcut = {
            name: x.name || `No name shortcut`,
            color: x.color || ``,
            run: (self) => {
                return new Promise(async r => {
                    if (x.run.startsWith(`code\n`))
                        eval(x.run.replace(`code\n`, ``));
                    else {
                        const runlist = x.run.split(`,`);
                        for (var i = 0; i < runlist.length; i++) {
                            var runName = runlist[i];
                            var run = module.exports[runName]; // globalThis
                            if (!run) return consolelog(chalk.redBright(`Invalid function "${runName}" in "${x.name}" (index:${index}).\nCheck the readme for a list of commands\nhttps://github.com/MrCreaper/drg-modding-compiler#Shortcut-functions`));
                            await run();
                        }
                        r();
                    }
                });
            },
        };
        mainMenu.splice(index, 0, shortcut);
    });
    var selectedMenu = mainMenu;
    var selected = 0;
    var logPush = 0;
    var logMode = false;
    if (config.ui.enabled && process.argv.length == 2) {
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) process.stdin.setRawMode(true);
        var lastPressKey = ``;
        var lastPressDate = 0;
        var selecting = false;
        process.stdin.on('keypress', (chunk, key) => {
            var k = key.name || key.sequence;
            const doublePress = lastPressKey == k && new Date() - lastPressDate < 1000;
            lastPressKey = k;
            lastPressDate = new Date();
            selectedMenu = selectedMenu.filter(x => x.hidden ? x.hidden() : true);
            var selectedOption = selectedMenu[selected];
            //console.log(key);
            //consolelog(k);
            switch (k) {
                case `w`:
                case `up`:
                    subS();
                    while (!selectedMenu[selected].run) {
                        subS();
                    }
                    function subS() {
                        if (selected - 1 < 0)
                            selected = selectedMenu.length - 1;
                        else
                            selected--;
                    }
                    break;
                case `s`:
                case `down`:
                    addS();
                    while (!selectedMenu[selected].run) {
                        addS();
                    }
                    function addS() {
                        if (selected + 1 >= selectedMenu.length)
                            selected = 0;
                        else
                            selected++;
                    }
                    break;
                case `a`:
                case `left`: // down -
                    if (!logMode && fittedLogs.length > Math.abs(logPush - 1))
                        logPush--;
                    break;
                case `d`:
                case `right`: // up +
                    if (!logMode && logPush + 1 <= 0)
                        logPush++;
                    break;
                case `space`:
                case `return`:
                    var name = selectedOption.color ? chalk.hex(dyn(selectedOption.color, selectedOption))(dyn(selectedOption.name, selectedOption)) : dyn(selectedOption.name, selectedOption);
                    if (selectedOption && selectedOption.run) {
                        if (!selectedOption.running) {
                            // canceling processes would be sick
                            //consolelog(`Running ${name}...`);
                            selecting = true;
                            var run = selectedOption.run(selectedOption);
                            if (String(run) == `[object Promise]`) {
                                selectedOption.running = true;
                                run.then(() => {
                                    selectedOption.running = false;
                                    draw();
                                });
                            }
                        } //else consolelog(`Already runing command for ${name}`);
                    } else consolelog(`No run command for ${name}`);
                    break;
                case `q`:
                    return exitHandler();
                case `C`: // for butter/fat fingers
                case `c`:
                    if (key.ctrl) return process.exit();
                    else cook();
                    break;
                case `tab`:
                    logMode = !logMode;
                    break;
            }
            draw();
        });
        //setInterval(draw, 100);
        draw();
        function dyn(a, arg) { // dynamic
            return typeof a == `function` ? a(arg) : a;
        }
        var lastFittedLogsLength = 0;
        consoleloge.on('log', log => {
            fittedLogs = formatLogs();
            if (fittedLogs.length + logPush > process.stdout.rows)
                logPush -= (logLimit - 1 == logHistory.length ? 0 : fittedLogs.length - lastFittedLogsLength);
            lastFittedLogsLength = fittedLogs.length;
            draw();
        });
        function draw(clean = false, options = selectedMenu) {
            // clear old drawing
            for (var i = 0; i < process.stdout.rows; i++) {
                console.log('\r\n');
            }
            console.clear();

            // bg logs
            filterOffScreenLogs(fittedLogs, logPush).forEach((x, i) => {
                process.stdout.cursorTo(0, i);
                process.stdout.write(String(x));
            });

            if (!logMode) {
                // options
                // filter hidden
                options = options.filter(x => x.hidden ? x.hidden() : true);

                var longestOption = 0;
                options.forEach(x => {
                    var l = removeColor(dyn(x.name, x)).length;
                    if (longestOption < l) longestOption = l;
                });

                // selection arrows values
                var y = Math.floor(process.stdout.rows * .5 - options.length * .5) + selected;
                var left = Math.floor(process.stdout.columns * .5 - longestOption * .5) - 2 + (selecting ? +1 : 0);
                var right = Math.floor(process.stdout.columns * .5 + longestOption * .5) + 1 + (selecting ? -1 : 0);

                if (config.ui.cleanSelected) {
                    process.stdout.cursorTo(left, y);
                    process.stdout.write(new Array(right - left + 1).join(` `));
                }

                options.forEach((x, i) => {
                    var name = dyn(x.name, x);
                    var nameNC = removeColor(name)
                    var nameC = x.color ? chalk.hex(dyn(x.color, x))(name) : name; // color if there is a name
                    var opt = clean ? ``.padStart(nameNC.length, ` `) : nameC;
                    var X = Math.floor(process.stdout.columns * .5 - nameNC.length * .5);
                    var Y = Math.floor(process.stdout.rows * .5 - options.length * .5) + i;

                    if (config.ui.cleanBox) {
                        if (i == 0) {
                            process.stdout.cursorTo(left, Y - 1);
                            process.stdout.write(new Array(right - left + 2).join(` `));
                        }
                        if (i == options.length - 1) {
                            process.stdout.cursorTo(left, Y + 1);
                            process.stdout.write(new Array(right - left + 2).join(` `));
                        }

                        process.stdout.cursorTo(left, Y);
                        process.stdout.write(new Array(right - left + 2).join(` `));
                    }

                    process.stdout.cursorTo(X, Y); // x=left/right y=up/down
                    process.stdout.write(opt);
                });

                // > selecting arrows <

                process.stdout.cursorTo(left, y);
                process.stdout.write(`>`);
                process.stdout.cursorTo(right, y);
                process.stdout.write(`<`);
                if (selecting) setTimeout(() => draw(), 200);
                selecting = false;

                if (logPush) {
                    process.stdout.cursorTo(process.stdout.columns - String(logPush).length, process.stdout.rows);
                    process.stdout.write(chalk.gray(String(logPush)));
                }
            }

            // latest log
            //process.stdout.cursorTo(Math.floor(process.stdout.columns * .5 - latestLog.length * .5), process.stdout.rows - 2);
            //process.stdout.write(latestLog);

            // reset location
            process.stdout.cursorTo(0, process.stdout.rows);
        }
        return;
    }

    if (process.argv.includes(`-verify`)) return;
    if (process.argv.includes(`-publish`)) return publish();
    //if (process.argv.includes(`-help`)) return consolelog(``);

    if (process.argv.includes(`-gogo`)) {
        fs.rmSync(`${config.drg}/FSD/Content/Movies`, { recursive: true, force: true });
        fs.rmSync(`${config.drg}/FSD/Content/Splash`, { recursive: true, force: true });
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
            consolelog(`${chalk.cyan(x.split(` - `)[0])} - ${since(new Date(new Date().toUTCString()) - new Date(x.split(` - `)[1] + `.000Z`))}`);
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
            if (!fs.existsSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`)) return r(consolelog(`Cook didnt cook anything :|`));
            fs.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`, `${__dirname}/temp/PackageInput/Content/`, { overwrite: true });
            fs.moveSync(`${__dirname}/../Saved/Cooked/WindowsNoEditor/${config.ProjectName}/AssetRegistry.bin`, `${__dirname}/temp/PackageInput/AssetRegistry.bin`, { overwrite: true });

            var ch = child.exec(config.PackingCmd)
                .on('exit', async () => {
                    var d = fs.readFileSync(config.logs);
                    if (d.includes(`LogPakFile: Error: Failed to load `)) {
                        consolelog(`Failed to load ${d.toString().split(`\n`).find(x => x.includes(`LogPakFile: Error: Failed to load `)).replace(`LogPakFile: Error: Failed to load `, ``)}`);
                        return r();
                    }
                    fs.rmSync(`${config.drg}/FSD/Mods/${config.ModName}`, { recursive: true, force: true });
                    fs.mkdirSync(`${config.drg}/FSD/Mods/${config.ModName}`);
                    if (!fs.existsSync(`${__dirname}/temp/${config.ModName}.pak`)) {
                        var wrongCook = fs.readdirSync(`${__dirname}/temp/`).find(x => x.endsWith(`.pak`));
                        consolelog(`Failed to cook correct project :)\nYour command:\n${config.PackingCmd.replace(wrongCook, chalk.red(wrongCook))}`);
                        return r();
                    }
                    fs.renameSync(`${__dirname}/temp/${config.ModName}.pak`, `${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
                    consolelog(`Packed!`);

                    /*
                    // Bad fucking idea
                    if (config.cookedVariable) {
                        consolelog(`Cooking variables...`);
                        await new Promise(r => {
                            var f = `${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`;
                            var ft = `${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}TEMP.pak`;
                            var w = fs.createWriteStream(ft);
                            fs.createReadStream(f)
                                .on(`data`, d => {
                                    d = d.toString();
                                    Object.keys(config.cookedVariable).forEach(key => {
                                        d = d.replace(new RegExp(escapeRegEx(key), `g`), config.cookedVariable[key].replace(`{time}`, t24hToXM(utcNow.toISOString().replace(/T/, ' ').replace(/\..+/, ''))));
                                    });
                                    w.write(d);
                                })
                                .on(`end`, () => {
                                    w.end();
                                    //fs.rmSync(f);
                                    //fs.renameSync(ft, f);
                                    r();
                                });
                        });
                        consolelog(`Cooked variables!`);
                    }*/

                    if (config.zip.onCompile) {
                        await zl.archiveFolder(`${config.drg}/FSD/Mods/${config.ModName}/`, `${config.drg}/FSD/Mods/${config.ModName}.zip`);
                        config.zip.to.forEach(dir =>
                            fs.copySync(`${config.drg}/FSD/Mods/${config.ModName}.zip`, `${dir}${config.ModName}.zip`)
                        );
                    }

                    if (config.modio.onCompile) publish();
                    if (config.backup.onCompile) backup();
                    if (config.startDRG) startDrg();

                    consolelog(`Done in ${chalk.cyan(since(new Date() - startTime))}!`);
                    r();
                })
            children.push(ch);
        });
    }
    if (process.argv.includes(`-unpackdrg`)) return unpack(`${config.drg}/FSD/Content/Paks/FSD-WindowsNoEditor.pak`);
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
     
    if (fs.existsSync(`${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`) && !fs.accessSync(`${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`, fs.constants.W_OK | fs.constants.R_OK)) {
        consolelog(`\nNo access to ${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
        if (platform == `linux`) consolelog(`Please run:\nchmod 7777 -R ${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
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
            var ch = child.exec(config.CookingCmd);
            ch.on('exit', async () => {
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
                    consolelog(`Errors ${chalk.redBright(errs)}:\n\n${errorsLogs}`);
                    if (logsDisabled) {
                        consolelog(`${chalk.red(`Failed`)}y. Check the logs and-... oh wait, you disabled logs. Lucky for you, I make backups.`);
                        fs.renameSync(config.logs, `${__dirname}/logs.txt`);
                        return r();
                    }
                    consolelog(`${errs != 0 ? `\n` : ``}${chalk.redBright(`Failed`)}. Check the logs${errs != 0 ? ` (or check the above)` : ``} and fix your damn "code"`);
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
// recompileshaders allCave