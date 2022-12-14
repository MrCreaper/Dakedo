var config = {
    ProjectName: "FSD",
    ModName: "", // auto found | also can be a path like "_CoolGuy/CoolMod"
    ProjectFile: "/../FSD.uproject", // also general folder
    DirsToCook: [], // folder named after ModName is automaticlly included
    DirsToNeverCook: [], // example: CoolMod/debug
    UnrealEngine: "", // auto generated
    drg: "", // auto generated
    cmds: {
        Cooking: "", // auto generated DONT FUCKING USE -Compressed
        Packing: "", // auto generated
        UnPacking: "", // auto generated
        CompileAll: "", // auto generated
        recompile: "", // auto generated
    },
    logging: {
        file: "./logs.txt", // empty for no logs
        external: [], // show new logs from another file
        cleaning: {
            misc: true, // cleans up paths, and a few more
            prefixes: true, // Removes Log{something}:
            removeWarnings: true, // Remove lines containing "Warning: "
            removeMismatches: true, // remove "Mismatch size for type " since usually it dosent matter.
            removeOther: false, // Remove everything that isnt super important (use with caution)
            clearOnCook: true, // clear logs before cooking
            clearOnNewSession: true, // clear logs when started
        },
        logConfig: false, // only on cmd version
        addToTitle: false, // might couse Error sound effect
    },
    startDRG: false, // when cooked
    killDRG: true, // when starting cook
    ui: {
        enabled: true,  // use the ui version by default
        cleanBox: true, // clean logs around the options
        cleanSelected: false, // clean logs only between selection arrows
        shortcuts: [],
        selectArrows: true,
        color: "00ffff", // The shown color for this mod/preset
        bgColor: false, // Mod name color shown as background
        staticColor: true, // color mod names, false will just make cyan
    },
    backup: {
        folder: "./backups", // leave empty for no backups
        onCompile: true,
        max: 20, // -1 for infinite
        maxTotal: false, // false = Maximum backups for each mod. true = total backups. For the above value
        pak: false,
        blacklist: [".git"],
        all: false, // backup the entire project by default
        verifacation: false, // verified backups arent deleted
    },
    zip: {
        onCompile: true, // placed in the mods/{mod name} folder
        backups: false,
        to: [], // folders to copy the zip in.
    },
    modio: {
        token: "", // https://mod.io/me/access > oauth access
        apikey: "", // https://mod.io/me/access > API Access | api key for some commands
        gameid: 2475, // DRG
        modid: 0, // aka "Resource ID"
        onCompile: false, // upload on compile
        deleteOther: true, // deletes older or non-active files
        dateVersion: true, // make version from the date year.month.date, otherwise get version from project
        msPatch: true, // adds ms to the end of the dateVersion. Less prefered then default (applied when deleteOther=false).
        xm: true, // use am/pm or 24h
        updateCache: true, // update cache for the mod, no download's needed!
        changelog: false, // Ask for changelogs on publishing?
        cache: "", // auto generated
    },
    presets: {
        "release": {
            modio: {
                modid: 1,
                changelog: true,
            },
            ui: {
                color: "00ffff",
            },
        },
        "mod^2": {
            ModName: "mod2",
            modio: {
                modid: 2,
            }
        },
    },
    snakeIntervention: false, // INTERtwineing snake? :)
    forceCookByDefault: false, // force cook just ignores errors and tries to pack.
    update: true, // automaticlly update
};
// This is up here just so I could copy it to the readme easier
// https://github.com/octalmage/robotjs prob wana use this to skip the "press any key to continue" screen

(async () => {
    const fs = require('fs-extra');
    const fswin = require('fswin');
    const child = require(`child_process`);
    const PATH = require('path');
    const find = require('find-process');
    const https = require(`https`);
    const os = require(`os`);
    const chalk = require(`chalk`);
    const zl = require("zip-lib");
    const crypto = require('crypto');
    const FormData = require('form-data');
    const readline = require(`readline`);
    const ini = require('ini');
    const open = require('open');
    const { EventEmitter } = require(`events`);
    class Emitter extends EventEmitter { }
    const consoleloge = new Emitter();
    const package = require(`./package.json`);

    var latestLog = ``;
    var logHistory = [];
    var logLimit = 100;
    /**
     * Custom log function
     * @param {string} log the log
     * @param {boolean} urgent Used for logging very important stuff as module
     * @param {boolean} save Save to file
     * @param {boolean} event run event
     * @param {intreger} update update index
     * @returns {intreger} logHistory index
     */
    function consolelog(
        log = ``,
        urgent = false,
        save = true,
        event = true,
        update = -1,
    ) {
        if (!module.parent || urgent || module.exports.logsEnabled) // stfu if module
            //console.log.apply(arguments);
            console.log(log);
        if (!log && log != 0) return;
        switch (typeof log) {
            case `object`:
                if (log.toString && !Array.isArray(log) && log.toString() != `[object Object]`)
                    log = log.toString();
                else
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
        var i = update;
        if (i == -1) {
            if (save)
                logFile(`${log}\n`);
            i = logHistory.push(log) - 1;
        } else
            logHistory[i] = log;
        while (logHistory.length > logLimit) {
            logHistory.shift();
        }
        if (event)
            consoleloge.emit(`log`, log);
        if (config && config.logging && config.logging.addToTitle)
            setTerminalTitle(`${capitalize(package.name)} - ${log}`);
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
                let log = String(x);
                while (removeColor(log).length > process.stdout.columns) {
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
        return logs.filter((x, i) =>
            i + push > -1 // witchcraft and misery.
            &&
            !(i + push >= process.stdout.rows)
        );
    }

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

    function since(time) {
        var endings = {
            y: time / (1000 * 60 * 60 * 24 * 365),
            m: time / (1000 * 60 * 60 * 24 * 7 * 31),
            w: time / (1000 * 60 * 60 * 24 * 7),
            d: time / (1000 * 60 * 60 * 24),
            h: (time % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
            min: (time % (1000 * 60 * 60)) / (1000 * 60),
            s: (time % (1000 * 60)) / 1000,
        };
        var t = ``;
        Object.keys(endings).forEach(key => {
            let val = Math.abs(Math.floor(endings[key]));
            if (val)
                t += `${t ? ` ` : ``}${val}${key}`;
        });
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
    /**
     * 
     * @param {string} p 
     * @param {string[] || string} search 
     * @param {boolean} strict 
     * @returns 
     */
    function searchDir(p = ``, search = [], strict = true) {
        var hits = [];
        if (!Array.isArray(search)) search = [search];
        queryDir(p);
        function queryDir(path) {
            fs.readdirSync(path).forEach(x => {
                var fp = `${path}/${x}`
                var s = fs.statSync(fp);
                if (strict ? search.includes(x) : search.find(y => y.includes(x)))
                    hits.push(fp);
                else
                    if (s.isDirectory()) queryDir(fp);
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
        if (!fs.existsSync(`${ProjectPath}Config/DefaultGame.ini`)) return `No DefaultGame.ini found.`
        fs.readFileSync(`${ProjectPath}Config/DefaultGame.ini`, `utf8`).split(`\n`).forEach(x =>
            neverCookDirs.push(x.replace(`+DirectoriesToNeverCook=(Path="/Game/`, ``).replace(`")`, ``))
        );

        if (!fs.existsSync(`${ProjectPath}Content`)) return `No name found.`
        var name = ``;
        fs.readdirSync(`${ProjectPath}Content`).forEach(x => {
            if (!neverCookDirs.includes(x)) name = x;
        });
        return name;
    }

    function findModVersion() {
        var configFile = `${ProjectPath}Config/DefaultGame.ini`;
        var read = fs.readFileSync(configFile, `utf8`).split(`\n`);
        var raw = read.find(x => x.startsWith(`ProjectVersion=`)).replace(`ProjectVersion=`, ``);
        if (!raw) return `unVersioned`;
        return raw;
    }

    function escapeRegEx(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    function deepFreeze(object) {
        const propNames = Object.getOwnPropertyNames(object);
        for (const name of propNames) {
            const value = object[name];

            if (value && typeof value === "object")
                deepFreeze(value);
        }
        return Object.freeze(object);
    }

    function formatTime(time) {
        if (typeof time == `object`) time = time.toISOString().replace(/T/, ' ').replace(/\..+/, '')
        if (config.modio.xm) {
            var timeS = time.split(` `);
            if (timeS[1])
                timeS[1] = t24hToXM(timeS[1]);
            else timeS[0] = t24hToXM(timeS[0]);
            return timeS.join(` `);
        } else
            return time;
    }

    /**
     * Format bytes as human-readable text.
     * 
     * @param bytes Number of bytes.
     * @param si True to use metric (SI) units, aka powers of 1000. False to use 
     *           binary (IEC), aka powers of 1024.
     * @param dp Number of decimal places to display.
     * 
     * @return Formatted string.
     */
    function humanFileSize(bytes, si = false, dp = 1) {
        const thresh = si ? 1000 : 1024;
        if (Math.abs(bytes) < thresh) {
            return bytes + ' B';
        }
        const units = si
            ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
            : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
        let u = -1;
        const r = 10 ** dp;
        do {
            bytes /= thresh;
            ++u;
        } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);
        return bytes.toFixed(dp) + ' ' + units[u];
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

    const dirSize = async directory => {
        const { readdir, stat } = require('fs/promises');
        const files = await readdir(directory);
        const stats = files.map(file => stat(PATH.join(directory, file)));

        return (await Promise.all(stats)).reduce((accumulator, { size }) => accumulator + size, 0);
    }

    function getValueColor(val) {
        switch (typeof val) {
            case `boolean`:
                if (val)
                    return color = `#00ff00`; // on
                else
                    return color = `#ff0000`; // off
            case `string`:
                return color = `#ff853d`;
            case `bigint`:
            case `number`:
                return color = `#56f500`;
            case `undefined`:
                return color = `#0000ff`;
            default:
                return color = `#ffffff`;
        }
    }

    function setTerminalTitle(title) {
        process.stdout.write(`${String.fromCharCode(27)}]0;${title}${String.fromCharCode(7)}`);
    }
    setTerminalTitle(capitalize(package.name));

    function openExplorer(path, callback) {
        var cmd = ``;
        switch (platform.replace(`wine`, ``)) {
            case `win`:
                path = path || '=';
                cmd = `explorer`;
                break;
            case `linux`:
                path = path || '/';
                cmd = `xdg-open`;
                break;
            case `mac`:
                path = path || '/';
                cmd = `open`;
                break;
        }
        let p = require(`child_process`).spawn(cmd, [path]);
        p.on('error', (err) => {
            p.kill();
            if (callback)
                return callback(err);
        }).on(`spawn`, () => {
            if (callback)
                return callback();
        });
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
        return String(input).replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
    }

    function staticCText(str, preset) { // static colored text
        var c = staticC(str, preset);
        return (c.bg ? chalk.bgHex(`#${c.c}`) : chalk.hex(`#${c.c}`))(str);
    }

    function staticC(str, set) { // static colored text
        if (!config.ui.staticColor) return { c: `00ffff`, bg: false };
        var preset = set || Object.values(config.presets).concat(config).find(x => x.ModName == str);
        if (preset && preset.ui)
            return {
                c: preset.ui.color ? preset.ui.color : `00ffff`,
                bg: preset.ui.bgColor != undefined ? preset.ui.bgColor : config.ui.bgColor
            };
        return { c: crypto.createHash('md5').update(String(str)).digest('hex').slice(0, 5), bg: false };
    }

    function capitalize(str = ``) {
        var split = str.split(``);
        split[0] = split[0].toUpperCase();
        return split.join(``);
    }

    function getUsername() {
        return child.spawnSync(`users`).output[1].toString().replace(/\\n/g, ``);
    }

    var utcNow = new Date(new Date().toUTCString());

    var selectedPresetKey = ``;

    __dirname = PATH.dirname(process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0])); // fix pkg dirname
    const ProjectPath = PATH.resolve(`${__dirname}${config.ProjectFile}`).replace(PATH.basename(config.ProjectFile), ``);

    var username = os.userInfo().username;

    /*
        cookedVariable: { // replace all instances of {key} (RegExp) with {value}
            "[compile time here]": "{time}",
        },
    */

    const templatePlatformPaths = {
        win: {
            UnrealEngine: `C:\\Program Files (x86)\\Epic Games\\UE_4.27`,
            drg: `C:\\Program Files (x86)\\Steam\\steamapps\\common\\Deep Rock Galactic`,
            cmds: {
                Cooking: `{UnrealEngine}/Engine/Binaries/Win64/UE4Editor-Cmd.exe {dir}{pf} -run=cook -targetplatform=WindowsNoEditor -unattended -NoLogTimes -iterate`,
                Packing: `{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe {dir}/.temp/{mod}.pak -Create="{dir}/.temp/Input.txt`,
                UnPacking: `{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe -platform="Windows" -extract "{path}" "{outpath}"`,
                UnPacking: `{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe -platform="Windows" -extract {path} {outpath} -unattended -NoLogTimes`,
                GenerateProject: `{UnrealEngine}/Engine/Binaries/DotNET/UnrealBuildTool.exe -projectfiles -project="{dir}{pf}" -game -rocket -progress`,
                // {UnrealEngine}/Engine/Binaries/DotNET/UnrealBuildTool.exe Development Win64 -Project="Z:/home/creaper/drg/ammo-percentage-overlay/FSD.uproject" -TargetType=Editor -Progress -NoEngineChanges -NoHotReloadFromIDE
                // {UnrealEngine}/Engine/Build/BatchFiles/Linux/RunMono.sh {UnrealEngine}/Engine/Binaries/DotNET/UnrealBuildTool.exe {ProjectName} -ModuleWithSuffix {ProjectName} ${Math.floor(Math.random() *  100)} Linux Development -editorrecompile -canskiplink "{dir}{pf}" -progress
            },
            modio: {
                cache: `C:\\users\\Public\\mod.io\\2475\\`,
            },
        },
        linux: {
            UnrealEngine: `/home/{me}/Documents/UE_4.27`,
            drg: `/home/{me}/.local/share/Steam/steamapps/common/Deep Rock Galactic`,
            cmds: {
                Cooking: `{UnrealEngine}/Engine/Binaries/Linux/UE4Editor-Cmd {dir}{pf} -run=cook -targetplatform=WindowsNoEditor -unattended -NoLogTime -iterates`,
                Packing: `{UnrealEngine}/Engine/Binaries/Linux/UnrealPak {dir}/.temp/{mod}.pak -Create="{dir}/.temp/Input.txt"`,
                UnPacking: `{UnrealEngine}/Engine/Binaries/Linux/UnrealPak -platform="Windows" -extract "{path}" "{outpath}"`,
                UnPacking: `{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe -platform="Windows" -extract {path} {outpath} -unattended -NoLogTimes`,
            },
            modio: {
                cache: `/home/{me}/.local/share/Steam/steamapps/compatdata/548430/pfx/drive_c/users/Public/mod.io/2475/`,
            },
        },
        linuxwine: {
            UnrealEngine: `/home/{me}/Games/epic-games-store/drive_c/Program Files/Epic Games/UE_4.27`,
            drg: `/home/{me}/.local/share/Steam/steamapps/common/Deep Rock Galactic`,
            cmds: {
                Cooking: `wine "{UnrealEngine}/Engine/Binaries/Win64/UE4Editor-Cmd.exe" "{dir}{pf}" "-run=cook" "-targetplatform=WindowsNoEditor" "-cook" "-unattended" "-NoLogTimes" "-iterate" "-NoShaderCooking" "-auto" "-AUTOCHECKOUTPACKAGES"`, // -CookAll
                CompileAll: `wine "{UnrealEngine}/Engine/Binaries/Win64/UE4Editor-Cmd.exe" "{dir}{pf}" "-run=CompileAllBlueprints" "-unattended" "-NoLogTimes"`,
                Packing: `wine "{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe" "{dir}/.temp/{mod}.pak" "-Create="{dir}/.temp/Input.txt"" "-unattended" "-NoLogTimes"`,
                UnPacking: `wine "{UnrealEngine}/Engine/Binaries/Win64/UnrealPak.exe" "-platform="Windows"" "-extract" "{path}" "{outpath}" "-unattended" "-NoLogTimes"`,
                recompile: `wine "{UnrealEngine}/Engine/Binaries/DotNET/UnrealBuildTool.exe" "Development" "Win64" "-Project="{dir}{pf}"" "-TargetType=Editor" "-Progress" "-NoEngineChanges" "-NoHotReloadFromIDE"`,
            },
            modio: {
                cache: `/home/{me}/.local/share/Steam/steamapps/compatdata/548430/pfx/drive_c/users/Public/mod.io/2475/`,
            },
        },
        macos: {
            UnrealEngine: `no idea`,
            drg: `no idea`,
            cmds: {
                Cooking: `no idea`,
                Packing: `no idea`,
                UnPacking: `no idea`,
                UnPacking: `no idea`,
            },
            modio: {
                cache: `no idea`,
            },
        },
        givenUpos: { // fallback
            UnrealEngine: `no idea`,
            drg: `no idea`,
            cmds: {
                Cooking: `no idea`,
                Packing: `no idea`,
                UnPacking: `no idea`,
            },
            modio: {
                cache: `no idea`,
            },
        },
    };
    const originalplatformPaths = deepFreeze(templatePlatformPaths);
    const platformPaths = JSON.parse(JSON.stringify(templatePlatformPaths)); // new instance, no longer a refrence

    const configPath = `${__dirname}/config.json`;

    function writeConfig(c = unVaredConfig) {
        fs.writeFileSync(configPath, JSON.stringify(c, null, 4));
    }

    function updatePlatPathVariables(editing = platformPaths, original = originalplatformPaths[platform]) {
        if (!original) return console.log(`Missing og platform paths?`);
        Object.keys(original).forEach(x => {
            if (typeof editing[x] == `object`)
                editing[x] = updatePlatPathVariables(original[x], editing[x])
            else
                editing[x] = original[x]
                    .replace(/{UnrealEngine}/g, editing.UnrealEngine)
                    //.replace(/.\//g, `${plat.includes(`wine`) ? W__dirname : __dirname}/`)
                    .replace(/{me}/g, username)
                    .replace(/{mod}/g, config.ModName)
        })
        return editing;
    }

    const wine = fs.existsSync(originalplatformPaths.linuxwine.UnrealEngine.replace(/{me}/g, username));
    const W__dirname = wine ? `Z:/${__dirname}`.replace(`//`, `/`) : __dirname; // we are Z, they are C. for wine (dirname dosent end with /)
    const platform = `${os.platform().toLowerCase().replace(/[0-9]/g, ``).replace(`darwin`, `macos`)}${wine ? `wine` : ``}`;
    var paths = updatePlatPathVariables(platformPaths[platform]);
    if (!paths) paths = platformPaths.givenUpos;

    const runningRoot = process.getuid && process.getuid() == 0; // dosent exist on win?

    var unVaredConfig = JSON.parse(JSON.stringify(config)); // makes new instance of config
    //if (!runningRoot) // I dont remember why this is here
    if (await updateConfig() != true) exitHandler();
    fs.watchFile(configPath, async (curr, prev) => {
        if (curr.size == prev.size) return;
        updateConfig(undefined, undefined, false);
        setPreset();
        consolelog(chalk.gray(`Updated config`));
    });
    async function updateConfig(readFromFile = true, updateFile = true, crashable = true) {
        if (!fs.existsSync(configPath)) {
            writeConfig();
            consolelog(`Wrote config.`);
        }
        if (readFromFile) {
            var tempconfig = fs.readFileSync(configPath);
            if (!isJsonString(tempconfig)) {
                //writeConfig(config);
                consolelog("Config is an invalid json, please check it again.");
                if (crashable) exitHandler();
                return;
            }
            tempconfig = JSON.parse(tempconfig);
            config = checkConfig(config, tempconfig);
            function checkConfig(base = {}, check = {}) {
                Object.keys(base).forEach(x => {
                    if ([`presets`].includes(x)) return base[x] = check[x];;
                    if (typeof base[x] == `object` && !Array.isArray(base[x]))
                        base[x] = checkConfig(base[x], check[x]);
                    else
                        if (check[x] != undefined && typeof base[x] == typeof check[x])
                            base[x] = check[x];
                });
                return base;
            }
        }

        if (!config.ModName) config.ModName = findModName();

        unVaredConfig = JSON.parse(JSON.stringify(config)); // makes new instance of config

        setPathing(paths, config, unVaredConfig, originalplatformPaths[platform]);
        function setPathing(paths, config, unVaredConfig, originalplatformPaths) {
            Object.keys(paths).forEach(key => {
                if (typeof config[key] == `object`)
                    config[key] = setPathing(paths[key], config[key], unVaredConfig[key], originalplatformPaths[key]);
                else
                    if (config[key] == undefined || config[key] == ``) {
                        unVaredConfig[key] = originalplatformPaths[key]; // for the config that is saved
                        config[key] = paths[key]; // for the config that is used
                    }
            });
            return config;
        }
        if (updateFile)
            writeConfig(unVaredConfig);
        const tempModName = process.argv.find(x => !x.includes(`/`) && !x.includes(`-`) && fs.existsSync(`${ProjectPath}Content/${x}`));
        if (tempModName) config.ModName = tempModName;
        variable(config);
        function variable(c) {
            if (typeof c == `string`) {
                var out = c
                    .replace(/{UnrealEngine}/g, platformPaths[platform].UnrealEngine)
                    .replace(/{drg}/g, config.drg)
                    .replace(/{me}/g, username)
                    .replace(/{mod}/g, config.ModName)
                    .replace(/{pf}/g, config.ProjectFile);
                if (platform == `linuxwine`)
                    out = out
                        .replace(/{dir}/g, W__dirname); // better to use "{dir}" then "./" since this is running over all configs :)
                else
                    out = out
                        .replace(/{dir}/g, __dirname);
                return out;
            }
            if (Array.isArray(c))
                c = c.map(x => variable(x));
            else
                Object.keys(c).forEach(x => {
                    switch (typeof c[x]) {
                        case `object`:
                            c[x] = variable(c[x]);
                            break;
                        case `string`:
                            c[x] = variable(c[x]);
                            break;
                    }
                });
            return c;
        }

        // config ready, verify
        if (!fs.existsSync(`${__dirname}${config.ProjectFile}`)) return consolelog(`Couldnt find project file`);
        if (!fs.existsSync(config.UnrealEngine)) return consolelog(`Couldnt find ue4\nPath: ${config.UnrealEngine}`);
        if (!fs.existsSync(config.drg)) return consolelog(`Couldnt find drg\nPath: ${config.drg}`);
        config.DirsToNeverCook.forEach(x => {
            if (!fs.existsSync(`${ProjectPath}Content/${x}`)) return consolelog(`"DirsToNeverCook" Directory dosent exist.\n${x}`);
        });

        if (config.logging.external)
            config.logging.external.forEach(ext => {
                if (!fs.existsSync(ext))
                    consolelog(`Invalid externalLog ${ext}`);
                else {
                    var externalLogsStart = fs.readFileSync(ext).toString().length;
                    fs.watchFile(ext, async (curr, prev) => {
                        if (!fs.existsSync(ext)) return consolelog(`Failed to find externallog? Its probably fine, il just check again...`);
                        var read = fs.readFileSync(ext).toString().slice(externalLogsStart).replace(/ /g, ``).replace(/[^\x00-\x7F]/g, ""); // so much simpler but whatever
                        externalLogsStart += read.length;
                        //consolelog(chalk.cyan(read.slice(0, 3).includes(`\n`) ? read.replace(`\n`, ``) : read), undefined, false); // remove starting new line and header
                        read.split(`\n`).forEach(x => consolelog(chalk.cyan(x)));
                        /*var log = await readAt(config.logging.external, externalLogsStart); // I just had to worry about non-existent 50gb log files of all things :\
                        consolelog(chalk.cyan(log.startsWith(`\n`) ? log.replace(`\n`, ``) : log));
                        if (log.length)`
                            externalLogsStart += log.length;
                        else
                            externalLogsStart = 0;*/
                    });
                }
            });

        if (readFromFile && updateFile)
            setPreset();
        return true;
    }

    // cache
    var cache = {
        myVersionCheck: ``,
        templateVersion: ``,
        templateVersionCheck: ``,
        selectedPreset: ``,
        loadedBackup: [], // list of loaded backups by mod folder name
    };
    const cacheFolder = `${__dirname}/cache/`;
    if (!fs.existsSync(cacheFolder)) {
        fs.mkdirsSync(cacheFolder);
        if (platform == `win`)
            fswin.setAttributesSync(cacheFolder, {
                IS_shown: true,
            });
    }
    const cachePath = `${cacheFolder}cache.json`;
    readCache();
    function readCache() {
        if (!fs.existsSync(cachePath)) return writeCache();
        let read = fs.readFileSync(cachePath);
        if (!isJsonString(read)) return writeCache();
        read = JSON.parse(read);
        Object.keys(cache).forEach(x => {
            if (read[x])
                cache[x] = read[x];
        });
    }
    function writeCache() {
        fs.writeFileSync(cachePath, JSON.stringify(cache, null, 4));
    }

    // temp
    var tempFolder = `${__dirname}/.temp/`; // having it as const is bad :(
    clearTemp();
    function clearTemp() {
        return new Promise(r => {
            if (fs.existsSync(tempFolder)) {
                let log = consolelog(`Clearing temp..`);
                fs.rmSync(tempFolder, { recursive: true, force: true }); // sync just takes a while
                consolelog(chalk.gray(`Temp cleared!`), undefined, undefined, undefined, log);
                r(true);
            } else r(false);
        });
    }

    function makeTemp() {
        if (fs.existsSync(tempFolder)) return;
        fs.mkdirSync(tempFolder);
        if (platform == `win`)
            fswin.setAttributesSync(tempFolder, {
                IS_shown: true
            });
    }

    function logFile(log) {
        if (config && config.logging.file)
            fs.appendFileSync(config.logging.file, removeColor(log))
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
                if (new Date(f.date_added) * 1000 > new Date(new Date().getTime() - (24 * 60 * 60 * 1000))) // uploaded in the last 24h
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

    module.exports.updateCacheState = updateCache = async (
        modFile = {},
        pakPath = `${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`,
        modid = config.modio.modid,
        modname = config.ModName,
    ) => {
        return new Promise(async (r, re) => {
            const statePath = `${config.modio.cache}metadata/state.json`
            if (!fs.existsSync(statePath)) return r(consolelog(`Failed to find modio cache (state.json)\n${statePath}`));
            if (!fs.existsSync(pakPath)) return r(consolelog(`Failed to find cache's new pak.\n${pakPath}`));
            var state = fs.readFileSync(statePath);
            if (!isJsonString(state)) return r(consolelog(`MODIO CACHE/STATE IS CORRUPTED. PANIC!!`));
            state = JSON.parse(state);
            var i = state.Mods.findIndex(x => x.ID == modid);
            if (i == -1) return r(consolelog(`Not subscribed to mod? (modio cache) id:${modid}`));
            if (modFile)
                state.Mods[i].Profile.modfile = modFile;
            state.Mods[i].Profile.modfile.date_added = new Date().getTime();
            fs.writeJSONSync(statePath, state);
            fs.cpSync(pakPath, `${config.modio.cache}mods/${modid}/${modname}.pak`); // copy over old pak
            consolelog(chalk.gray(`Updated modio cache${modFile ? `` : ` (without version)`}`));
            r(true);
        })
    };

    module.exports.uploadMod = uploadMod = async (
        zip = `${__dirname}/${config.ModName}.zip`, // mods folder one dosent have permission so maybe not? `${config.drg}/FSD/Mods/${config.ModName}.zip`
        active = true,
        version = config.modio.dateVersion ? getDateVersion() : findModVersion(),
        changelog = `Uploaded: ${t24hToXM(utcNow.toISOString().replace(/T/, ' ').replace(/\..+/, ''))}`,
        meta = ``,
    ) => {
        return new Promise(async (r, re) => {
            if (config.modio.changelog) {
                var newChangelog = await getInput(`Changelog`);
                if (newChangelog)
                    changelog = newChangelog;
            }
            if (!fs.existsSync(zip)) return r(consolelog(`File dosent exist.\n${zip}`));
            if (fs.statSync(zip).size > 5368709120) return r(consolelog(`Zip bigger then 5gb (${humanFileSize(fs.statSync(zip).size, true, 0).toLowerCase().replace(` `, ``)})`));
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

            var req = https.request({
                hostname: 'api.mod.io',
                port: 443,
                path: `/v1/games/${config.modio.gameid}/mods/${config.modio.modid}/files`,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.modio.token}`,
                    ...form.getHeaders(),
                    'Accept': 'application/json',
                },
            }, (res) => {
                var data = [];
                res.on('data', (d) => data.push(d));
                req.on(`close`, async () => {
                    var buffer = Buffer.concat(data);
                    var resp = JSON.parse(buffer.toString());
                    if (res.statusCode == 201) {
                        if (config.modio.updateCache)
                            updateCache(resp);
                        r(resp);
                        return;
                    }
                    /*if (resp.error.code == 422) {
                        consolelog(`Stupid error. Retrying.. >:(`);
                        return r(await uploadMod(zip, active, version, changelog, meta)); // I dont know how to use call w/arguments :(
                    }*/
                    if (resp.error)
                        consolelog(resp.error);
                    else consolelog(resp);
                    updateCache();
                    r(false);
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

    module.exports.publish = publish = async function () {
        return new Promise(async r => {
            var log = consolelog(`Publising...`);
            var madeZip = false;
            var zip = `${config.drg}/FSD/Mods/${config.ModName}.zip`;
            if (!fs.existsSync(zip)) {
                await zl.archiveFolder(`${config.drg}/FSD/Mods/${config.ModName}/`, zip);
                madeZip = true;
            }
            var res = await uploadMod(zip);
            if (!res.filename)
                consolelog(`Failed to publish`, undefined, undefined, undefined, log);
            else {
                consolelog(`Published! ${chalk.cyan(res.version ? `v${res.version}` : res.filename)}`, undefined, undefined, undefined, log);

                if (config.modio.deleteOther) {
                    var files = await getFiles();
                    if (files)
                        files.filter(x => x.filename != res.filename).forEach(x => deleteModFile(x.id));
                }
            }
            if (madeZip) fs.rmSync(`${config.drg}/FSD/Mods/${config.ModName}.zip`);
            if (config.modio.deleteCache && config.modioCache)
                fs.rm(`${config.modioCache}/${config.modio.modid}`, { recursive: true, force: true })

            r(res == true);
        })
    };

    module.exportstempFolderlate = template = async function () {
        return new Promise(async r => {
            const dir = `${config.drg}/FSD/Binaries/Win64/`;
            fs.mkdirsSync(dir);

            var resp = await getJson({
                hostname: 'api.github.com',
                port: 443,
                protocol: 'https:',
                path: `/repos/${`UE4SS/UE4SS`}/releases/latest`,
                method: 'GET',
                headers: {
                    'User-Agent': `${capitalize(package.name)}/${ver}`,
                },
            });
            if (resp.message) return r();//r(consolelog(`Ratelimited by github? ${resp.message}`)); // usually rate limit error
            function download(url, filePath) {
                return new Promise(async r => {
                    https.get(url, async down => {
                        if (down.headers.location) return r(await download(down.headers.location, filePath)); // github redirects to their cdn, and https dosent know redirects :\
                        var file = fs.createWriteStream(`${dir}${asset.name}`);
                        var log = consolelog(`Downloading ${asset.name}`);
                        down.pipe(file
                            .on(`finish`, async () => {
                                consolelog(`Extracting ${asset.name}...`, undefined, undefined, undefined, log);
                                await zl.extract(`${dir}${asset.name}`, filePath); // extract zip
                                fs.rmSync(`${dir}${asset.name}`); // delete zip
                                consolelog(`Downloaded ${asset.name}`, undefined, undefined, undefined, log);
                                r();
                            }))
                    });
                })
            }

            function updateUESSConfig() {
                // update UE4SS config
                var ssconfig = ini.parse(fs.readFileSync(`${dir}UE4SS-settings.ini`, 'utf-8'))
                ssconfig.IgnoreEngineAndCoreUObject = 1;
                ssconfig.MakeAllFunctionsBlueprintCallable = 1;
                ssconfig.MakeAllPropertyBlueprintsReadWrite = 1;
                ssconfig.MakeEnumClassesBlueprintType = 1;
                fs.writeFileSync(`${dir}UE4SS-settings.ini`, ini.stringify(ssconfig, { section: 'section' }));
            }
            function editMainLua() {
                var mainLuaPath = `${dir}Mods/UHTCompatibleHeaderGeneratorMod/Scripts/main.lua`;
                var mainlua = fs.readFileSync(mainLuaPath).toString();
                var split = mainlua.split(`(`)[1].split(`,`);
                fs.writeFileSync(mainLuaPath, mainlua.replace(`NUM_NINE`, `V`));
                return [
                    `V`, //split[0].replace(`Key.`, ``).replace(/_/g, ` `),
                    split[1].replace(/[{}]/g, ``).replace(`ModifierKey.`, ``).replace(/ /g, ``)
                ]; // keys
            }

            // No point usind dll-inject since it only works on win and win has xinput :)
            switch (platform) {
                case `win`: // xinput
                    var asset = resp.assets.find(x => x.name.includes(`Xinput`)); // download xinput for windows and standard for anything else
                    await download(asset.browser_download_url, dir);
                    updateUESSConfig();
                    var keys = editMainLua();
                    await startDrg();
                    consolelog(chalk.redBright(`You should see a console pop up when you launched drg, if not, we are screwed.`));
                    consolelog(`When you have loaded in and disabled your mods press ${keys.join(` & `)}`);
                    break;
                default: // standard
                    var asset = resp.assets.find(x => x.name.includes(`Standard`)); // download xinput for windows and standard for anything else
                    await download(asset.browser_download_url, dir);
                    updateUESSConfig();
                    var keys = editMainLua();
                    // https://www.youtube.com/watch?v=LpSdNwv_yvQ
                    // https://www.reddit.com/r/linux_gaming/comments/y08u34/how_do_i_use_dll_injection_in_proton/
                    consolelog(`Next we need to inject a dll,\nSteam => DRG => Properties => Set Launch Options:\n\nWINEDLLOVERRIDES="./FSD/Binaries/Win64/ue4ss.dll=n,b" %command%\n\np.s copy from ${config.logging.file} (so no dumb mistakes)`); //for proton:\nWINEDLLOVERRIDES="${dir}standard1_3.dll=n,b" /path/to/proton/bin/wine executable
                    await waitForDrg();
                    consolelog(chalk.redBright(`You should see a console pop up when you launched drg, if not, we are screwed.`));
                    consolelog(`When you have loaded in and disabled your mods press ${keys.join(` & `)}`);
                    break;
            }

            // wait for export
            await new Promise(r => {
                var int = setInterval(() => {
                    if (fs.existsSync(`${dir}FSD`)) { // update later
                        clearInterval(int);
                        r();
                    }
                }, 5000);
            });
            // PART 2 - The building.

            var resp = await getJson(`https://api.github.com/repos/${`modio/modio-ue4`}/releases/latest`);
            if (resp.message) return r(consolelog(`Ratelimited by github? ${resp.message}`)); // usually rate limit error
            var asset = resp.assets.find(x => x.name.includes(`modio`)); // download xinput for windows and standard for anything else
            await download(asset.browser_download_url, dir);

            return;
            // https://github.com/Archengius/UE4GameProjectGenerator

            let cmd = `"${config.UnrealEngine}\\UE4Editor-Cmd.exe" "${W__dirname}/projectGen/GameProjectGenerator.uproject" -run=ProjectGenerator -HeaderRoot="${HEADER_DUMP_PATH}" -ProjectFile="${GAME_PROJECT_FILE}" -PluginManifest="${GAME_PLUGIN_MANIFEST}" -OutputDir="${OUTPUT_DIR}" -stdout -unattended -NoLogTimes`;
        })
    };

    module.exports.cook = () => {
        var logs = ``;
        return new Promise(r => {
            child.exec(config.cmds.Cooking)
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
        return new Promise(async r => {
            await clearTemp();
            makeTemp();
            fs.writeFileSync(`${tempFolder}Input.txt`, `"${W__dirname}/.temp/PackageInput/" "../../../FSD/"`);
            if (!fs.existsSync(`${ProjectPath}Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`)) return consolelog(`Cooking fucked up.`);
            fs.moveSync(`${ProjectPath}Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`, `${tempFolder}PackageInput/Content/`, { overwrite: true });
            fs.moveSync(`${ProjectPath}Saved/Cooked/WindowsNoEditor/${config.ProjectName}/AssetRegistry.bin`, `${tempFolder}PackageInput/AssetRegistry.bin`, { overwrite: true });

            child.exec(config.cmds.Packing)
                .on('exit', async () => {
                    if (logs.includes(`LogPakFile: Error: Failed to load `)) {
                        consolelog(`Failed to load ${logs.toString().split(`\n`).find(x => x.includes(`LogPakFile: Error: Failed to load `)).replace(`LogPakFile: Error: Failed to load `, ``)}`);
                        return r();
                    }
                    fs.moveSync(`${tempFolder}${config.ModName}.pak`, outPath);
                    r();
                })
                .stdout.on('data', (d) => logs += String(d));
        });
    };

    module.exports.unpack = unpack = function (path, outpath) {
        if (!outpath) outpath = `${__dirname}/${PATH.basename(path).split(`.`)[0]}`;
        return new Promise(r => {
            const normalOutPath = outpath;
            fs.rmSync(outpath, { recursive: true, force: true });
            fs.mkdirsSync(outpath);
            if (wine) {
                if (!path.startsWith(`Z:`))
                    path = `Z:${path}`;
                if (outpath.startsWith(`.`))
                    outpath = PATH.resolve(outpath);
                if (!outpath.startsWith(`Z:`))
                    outpath = `Z:${outpath}`;
            }
            const cmd = config.cmds.UnPacking.replace(`{path}`, path).replace(`{outpath}`, outpath);
            logFile(`${path}\n${outpath}\n${cmd}\n\n`)
            child.exec(cmd)
                .on(`exit`, async () => {
                    var d = fs.readFileSync(config.logging.file);
                    if (d.includes(`LogPakFile: Error: Failed to load `)) {
                        consolelog(`Failed to load ${d.toString().split(`\n`).find(x => x.includes(`LogPakFile: Error: Failed to load `)).replace(`LogPakFile: Error: Failed to load `, ``)}`);
                        r(false);
                        return;
                    }
                    if (!path.includes(`FSD-WindowsNoEditor`)) return r(true);
                    // is drg
                    if (!wine) return r(true);
                    var waitingLog = -1;
                    fs.mkdirsSync(`${normalOutPath}/FSD/Content/`);
                    var x = setInterval(() => {
                        if (fs.existsSync(`${normalOutPath}/FSD/Content/`) && fs.readdirSync(`${normalOutPath}/FSD/Content/`).length == 22) {
                            clearInterval(x);
                            if (waitingLog != -1)
                                waitingLog = consolelog(`All files found.`, undefined, undefined, undefined, waitingLog);
                            r(true) // I think sometimes FSD just dosent appear as its done? Something something wine?
                        } else
                            waitingLog = consolelog(`Waiting on FSD content to appear ${fs.readdirSync(`${normalOutPath}/FSD/Content/`).length}/22`, undefined, undefined, undefined, waitingLog);
                    }, 5000);
                })
                .stdout.on('data', (d) => logFile(String(d)));
        })
    }

    module.exports.compileall = compileall = function () {
        return new Promise(r => {
            const cmd = config.cmds.CompileAll;
            logFile(`\n${cmd}\n\n`)
            child.exec(cmd)
                .on(`exit`, async () => {
                    var d = fs.readFileSync(config.logging.file);
                    var split = d.toString().split(`\n`);
                    split.forEach(x => {
                        if (x.includes(`LogBlueprint: Error:`))
                            consolelog(x);
                    });
                    if (d.includes(`With 0 error(s)`))
                        consolelog(`Compiled sucessfully`);
                    else consolelog(`Compiled failed`);
                    r();
                })
                .stdout.on('data', (d) => logFile(String(d)));
        })
    }

    function workWCooked() {
        var configFile = `${ProjectPath}Config/DefaultGame.ini`;
        var lines = [
            `[/Script/UnrealEd.CookerSettings]`,
            `cook.AllowCookedDataInEditorBuilds=True`,
            `s.AllowUnversionedContentInEditor=1`,
        ];
    }

    module.exports.refreshDirsToNeverCook = refreshDirsToNeverCook = function (whitelist = [config.ModName].concat(config.DirsToCook), clear = false) {
        // split up folders for whitelist
        var newList = [];
        whitelist.forEach(x => {
            newList.push(x);
            var split = x.split(`/`);
            var pile = [];
            for (var i = 0; i < split.length - 1; i++) {
                pile.push(split[i]);
                var p = pile.join(`/`);
                if (!newList.includes(p))
                    newList.push(p);
            }
        });
        whitelist = newList;
        // get config
        var configFile = `${ProjectPath}Config/DefaultGame.ini`;
        if (!fs.existsSync(configFile)) {
            fs.mkdirsSync(configFile);
            fs.writeFileSync(``, configFile);
            consolelog(`Failed to find ${chalk.redBright(PATH.basename(configFile))}`);
        }
        // read
        var read = fs.readFileSync(configFile, `utf8`).toString();
        read = read.split(getLineBreakChar(read));

        // find line
        var dirsIndex = read.findIndex(x => x.includes(`+DirectoriesToNeverCook=(Path="/Game/`));
        var header = `[/Script/UnrealEd.ProjectPackagingSettings]`;
        var headerIndex = read.findIndex(x => x.includes(header));
        dirsIndex = headerIndex;
        if (dirsIndex == -1) {
            // if cant find the variables, find the header
            dirsIndex = headerIndex;
            if (dirsIndex == -1) // fuck it, add the header
                dirsIndex = read.push(header);
        }
        var musts = [
            `BuildConfiguration=PPBC_Shipping`,
            `UsePakFile=False`,
            `bShareMaterialShaderCode=False`, // https://forums.unrealengine.com/t/why-are-my-materials-not-rendering-after-updating-to-4-25-any-help-is-greatly-appreciated/466154/5
        ];
        musts.forEach(x => {
            var key = x.split(`=`)[0];
            var val = x.split(`=`)[1];
            // find old value
            var i = read.findIndex(x => x.includes(key));
            // update or add value
            if (i == -1)
                read.splice(dirsIndex, 0, x); // add
            else
                read.splice(i, 1, x); // update
        });
        // remove all old never cooks
        read = read.filter(x => !x.includes(`+DirectoriesToNeverCook=`))
        // find and add new never cooks
        var dirs = [];
        addDir();
        whitelist.forEach(x => {
            var split = x.split(`/`);
            var pile = ``;
            for (var i = 0; i < split.length - 1; i++) {
                pile += `${split[i]}/`;
                addDir(pile);
            }
        });
        function addDir(dir = ``) { // ends with /
            fs.readdirSync(`${ProjectPath}Content/${dir}`).forEach(x => {
                if (!whitelist.includes(x))
                    dirs.push(`${dir}${x}`);
            });
        }
        dirs = dirs.concat(config.DirsToNeverCook);
        dirs.forEach(x => {
            if (!clear)
                if (!whitelist.includes(x) && fs.statSync(`${ProjectPath}Content/${x}`).isDirectory()) // so mods in the same folder get cooked (if the user wants ofc) AND isnt a file
                    read.splice(dirsIndex + 1, 0, `+DirectoriesToNeverCook=(Path="/Game/${x}")`)
        });
        fs.writeFileSync(configFile, read.filter(x => x != ``).join(`\n`));
    }

    const backupInfo = `backupinfo.json`;
    module.exports.backup = backup = function (full = config.backup.all, limit = config.backup.max != -1, meta = {}) {
        if (!config.backup.folder) return;
        return new Promise(async r => {
            try {
                if (full)
                    var log = consolelog(`Making FULL backup...`);
                else
                    var log = consolelog(`Making backup...`);
                fs.mkdirsSync(config.backup.folder);

                var id = -1;
                fs.readdirSync(config.backup.folder).forEach(x => {
                    var xid = x.split(` - `)[0];
                    if (isNaN(xid) && xid != `0`) return consolelog(`invalid ${x}`);
                    xid = parseInt(xid);
                    if (xid > id)
                        id = xid;
                });
                id++;

                // actually start backuping
                var buf = `${config.backup.folder}/${id} - ${new Date(new Date().toUTCString()).toISOString().replace(/T/, ' ').replace(/\..+/, '')}`; // BackUp Folder
                if (platform == `win`) buf = buf.replace(/[/\\?%*:|"<>]/g, '-');
                fs.mkdirsSync(buf);
                // full backup
                if (full) {
                    var s = buf.replace(ProjectPath, ``).split(`/`)[0];
                    var paths = fs.readdirSync(ProjectPath);
                    for (var i = 0; i < paths.length; i++) {
                        var p = paths[i];
                        if (![PATH.basename(__dirname), PATH.basename(config.backup.folder)].includes(p) && !config.backup.blacklist.includes(p))
                            if (p != s) {
                                var logI = consolelog(`Backuping ${chalk.cyan(p)}`);
                                fs.copySync(`${ProjectPath}${p}`, `${buf}/${p}`);
                                consolelog(`Backuped ${chalk.cyan(p)}`, undefined, undefined, undefined, logI);
                            }
                    }
                }
                // full is just an addition, load it yourself.
                if (fs.existsSync(`${ProjectPath}Content/${config.ModName}`)) // some mods just replace stuff
                    fs.copySync(`${ProjectPath}Content/${config.ModName}`, `${buf}/${config.ModName}`);

                // backup pak
                var usedPak = `${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`;
                if (config.backup.pak)
                    if (!fs.existsSync(usedPak))
                        consolelog(`Failed to backup pak\n${chalk.gray(usedPak)}`);
                    else
                        fs.copySync(usedPak, `${buf}/${config.ModName}.pak`);
                // backup info
                fs.writeJSONSync(`${buf}/${backupInfo}`, {
                    id: id,
                    date: new Date(new Date().toUTCString()),
                    size: await dirSize(buf),
                    full: full,
                    modname: config.ModName,
                    verified: config.backup.verifacation ? await getInput(`Backup verifacation; input "y" to verify`) == `y` : undefined,
                    meta: meta,
                });

                // remove blacklisted items
                if (config.backup.blacklist.length != 0)
                    searchDir(buf, config.backup.blacklist)
                        .forEach(x => fs.rmSync(x, { recursive: true, force: true }));

                if (fs.readdirSync(buf).length == 0) {
                    consolelog(`Backup validation failed (didnt backup anything?)`, undefined, undefined, undefined, log);
                    fs.rmSync(buf, { recursive: true, force: true })
                    return r();
                }

                // zip backup
                if (config.zip.backups) {
                    await zl.archiveFolder(buf, `${buf}.zip`);
                    fs.rmSync(buf, { recursive: true, force: true })
                }

                if (limit) {
                    var backups = fs.readdirSync(config.backup.folder).sort(function (a, b) {
                        var aid = a.split(` - `)[0];
                        if (isNaN(aid)) return;
                        aid = parseInt(aid);

                        var bid = b.split(` - `)[0];
                        if (isNaN(bid)) return;
                        bid = parseInt(bid);

                        if (aid < bid) return -1;
                        if (aid > bid) return 1;
                        return 0;
                    }).filter(x => {
                        if (!fs.existsSync(`${config.backup.folder}/${x}/${backupInfo}`)) return true;
                        return !fs.readJsonSync(`${config.backup.folder}/${x}/${backupInfo}`).verified; // keep?/Can delete? | Dont want to do anything to verified backups
                    }); // oldest => newest
                    if (config.backup.maxTotal) {
                        backups.forEach((x, i) => {
                            //if(i == 0) return; // keep oldest as a keepsake
                            if (backups.length - i - 1 > config.backup.max) {
                                //var l = consolelog(`Deleting old backup ${chalk.red(x)}`);
                                fs.rmSync(`${config.backup.folder}/${x}`, { recursive: true, force: true });
                                //consolelog(chalk.gray(`Deleted old backup ${chalk.red(x.replace(/(\r\n|\n|\r)/gm, ""))}`), undefined, undefined, undefined, l);
                            }
                        });
                    } else {
                        var backupsForMods = {};
                        backups.forEach(x => {
                            function wipe() {
                                fs.rmSync(`${config.backup.folder}/${x}`, { recursive: true, force: true });
                            }
                            if (!fs.existsSync(`${config.backup.folder}/${x}/${backupInfo}`)) return wipe()
                            var info = fs.readFileSync(`${config.backup.folder}/${x}/${backupInfo}`);
                            if (!isJsonString(info)) return wipe();
                            info = JSON.parse(info);
                            if (!info.modname) return wipe();
                            if (!backupsForMods[info.modname]) backupsForMods[info.modname] = [];
                            backupsForMods[info.modname].push(x);
                        });
                        Object.values(backupsForMods).forEach(backups => {
                            backups.forEach((x, i) => {
                                //if(i == 0) return; // keep oldest as a keepsake
                                if (backups.length - i - 1 > config.backup.max) {
                                    //var l = consolelog(`Deleting old backup ${chalk.red(x)}`);
                                    fs.rmSync(`${config.backup.folder}/${x}`, { recursive: true, force: true });
                                    //consolelog(chalk.gray(`Deleted old backup ${chalk.red(x.replace(/(\r\n|\n|\r)/gm, ""))}`), undefined, undefined, undefined, l);
                                }
                            });
                        });
                    }
                }

                consolelog(`Backup done! id: ${chalk.cyan(id)}`, undefined, undefined, undefined, log);
                r(true);
            } catch (error) {
                consolelog(`Backup error`, undefined, undefined, undefined, log);
                consolelog(error);
                r(false);
                //consolelog(`Retrying backup...`);
                //r(await module.exports.backup.call(null, ...arguments));
            }
        })
    };

    const latestBackupSuffix = `Latest`;
    module.exports.loadbackup = loadbackup = async function (id) {
        var searchedLB = cache.loadedBackup.concat(
            fs.readdirSync(`${ProjectPath}Content/`)
                .map(x => {
                    if (!x.endsWith(latestBackupSuffix)) return;
                    return x.replace(latestBackupSuffix, ``);
                })
                .filter(x => x)
        );
        cache.loadedBackup = searchedLB.filter(function (elem, pos) {
            return searchedLB.indexOf(elem) == pos;
        });
        if (!id && cache.loadedBackup.length != 0) {
            for (let i = 0; i < cache.loadedBackup.length; i++) {
                let n = cache.loadedBackup[i];
                var log = consolelog(`Unloading backup for ${chalk.cyan(n)}...`);
                // remove old backup
                if (fs.existsSync(`${ProjectPath}Content/${n}`))
                    fs.rmSync(`${ProjectPath}Content/${n}`, { recursive: true, force: true });
                // bring back latest
                if (fs.existsSync(`${ProjectPath}Content/${n}${latestBackupSuffix}`)) {
                    fs.renameSync(`${ProjectPath}Content/${n}${latestBackupSuffix}`, `${ProjectPath}Content/${n}`);
                    consolelog(`Unloaded backup for ${chalk.cyan(n)}.`, undefined, undefined, undefined, log);
                } else consolelog(`Missing latest version for ${chalk.cyan(n)}..?`, undefined, undefined, undefined, log);
                cache.loadedBackup = cache.loadedBackup.splice(i + 1);
                writeCache();
                i--;
            }
            return;
        }
        if (!isNaN(id) && !Number.isInteger(parseInt(id))) return consolelog(`Invalid id. ${id}`); // custom ids would be nice
        var backuppath = fs.readdirSync(config.backup.folder).find(x => x.startsWith(`${id} - `))
        if (!backuppath) return consolelog(`Invalid backup id!`);
        var folder = backuppath.split(`/`)[backuppath.split(`/`).length - 1];
        var log = consolelog(`Loading backup...`);

        var info = {
            id: folder.split(` - `)[0],
            date: new Date(new Date().toUTCString()) - new Date(folder.split(` - `)[1]),
        };
        if (fs.existsSync(`${config.backup.folder}/${backuppath}/${backupInfo}`)) {
            var rawInfo = fs.readFileSync(`${config.backup.folder}/${backuppath}/${backupInfo}`);
            if (isJsonString(rawInfo)) {
                info = JSON.parse(rawInfo);
                consolelog(info.date);
                info.date = new Date(info.date);
            } else return consolelog(`Backup has an invalid ${backupInfo} >:(`);
        } else return consolelog(`I dont want to load a backup without ${backupInfo}.. :(`);

        // Remove already loaded backup
        if (fs.existsSync(`${ProjectPath}Content/${info.modname}`) && fs.existsSync(`${ProjectPath}Content/${info.modname}${latestBackupSuffix}`)) {
            consolelog(`Backup already loaded, removing.`);
            fs.rmSync(`${ProjectPath}Content/${info.modname}`, { recursive: true, force: true });
        }

        if (fs.existsSync(`${ProjectPath}Content/${info.modname}`))
            fs.renameSync(`${ProjectPath}Content/${info.modname}`, `${ProjectPath}Content/${info.modname}${latestBackupSuffix}`);
        if (folder.endsWith(`.zip`))
            await zl.extract(backuppath, `${ProjectPath}Content/${info.modname}`);
        else {
            if (!fs.existsSync(`${config.backup.folder}/${backuppath}/${info.modname}`)) return consolelog(`Backup dosent include mod folder (${info.modname}).\n${chalk.cyan(backuppath)} includes:\n${fs.readdirSync(`${config.backup.folder}/${backuppath}`).map(x => chalk.cyan(x)).join(`, `)}`, undefined, undefined, undefined, log);
            fs.copySync(`${config.backup.folder}/${backuppath}/${info.modname}`, `${ProjectPath}Content/${info.modname}`);
        }
        refreshDirsToNeverCook();
        writeCache();
        cache.loadedBackup.push(info.modname);
        consolelog(`Backup loaded!${info.verified ? ` ${chalk.greenBright(`???`)}` : ``} ${chalk.cyan(info.modname)} from ${chalk.cyan(since(info.date))} ago`, undefined, undefined, undefined, log);
    }

    module.exports.extract = extract = (
        pakFolder = `${config.drg}/FSD/Content/Paks/`,
        out = `./export/`,
        flatPath = ``,
        NOs = [`mesh`, `anim`, `stat`, `vert`, `morph`, `lightmap`], // "no"'s are added couse otherwise I get a buffer overflow
    ) => {
        const cmd = `./umodel${platform == `win` ? `.exe` : ``}`;
        const args = [
            `-export`,
            `*.uasset`,
            `-path="${pakFolder}"`,
            `-out="${out}"`,
            `-game=ue4.27`,
            `-png`,
            `-nooverwrite`,
        ].concat(
            NOs.map(x => `-no${x}`)
        );
        fs.mkdirsSync(out);
        consolelog(`Exporting...`);
        logFile(`\n${cmd} ${args.join(` `)}\n`);
        child.spawn(cmd, args)
            .on('exit', async () => {
                var d = fs.readFileSync(config.logging.file, `utf8`).split(`\n`);
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

    function getJson(options = {
        hostname: 'api.github.com',
        port: 443,
        protocol: 'https:',
        path: `/repos/${repo}/releases/latest`,
        method: 'GET',
        headers: {
            'User-Agent': `${capitalize(package.name)}/${ver}`,
        },
    }) {
        return new Promise(async re => {
            var req = https.get(options, (res) => {
                var data = [];
                res.on('data', (d) => data.push(d));
                req.on(`close`, async () => {
                    var buffer = Buffer.concat(data).toString();
                    if (!isJsonString(buffer)) return consolelog(buffer);
                    var resp = JSON.parse(buffer);
                    if (res.statusCode == 301 && res.headers.location) {
                        options.path = new URL(res.headers.location).pathname;
                        return re(await getJson(options));
                    }
                    re(resp);
                });
            });

            req.on('error', (e) => {
                consolelog(`Error getting json:`);
                consolelog(e);
                re(e);
            });
        });
    }

    function colorVersion(
        oldVersion = `0.0.0`,
        newVersion = `0.0.1`,
        upColor = `00ffff`,
        downColor = `ff0000`,
        noneColor = `808080`
    ) {
        var oldV = oldVersion.split(`.`).map(x => parseInt(x));
        var newV = newVersion.split(`.`).map(x => parseInt(x));
        var outV = [];
        for (var i = 0; i < oldV.length; i++) {
            var o = oldV[i];
            var n = newV[i];
            if (o == n) // no change
                outV.push(chalk.hex(noneColor)(n));
            else if (o < n) // upgrade
                outV.push(chalk.hex(upColor)(n));
            else // downgrade
                outV.push(chalk.hex(downColor)(n));
        }
        return outV.join(`.`);
    }

    async function update(repo = `MrCreaper/drg-linux-modding`, pre = false, force = false) {
        if (!repo) return consolelog(`No repository for update?`);
        const ver = require(`./package.json`).version;
        return new Promise(async r => {
            if (!process.pkg) return r(consolelog(chalk.gray(`Not downloading update for .js version`)));
            if (!force && new Date(new Date().toUTCString()) - new Date(cache.myVersionCheck) < 86400000) return; // 24h
            var log = consolelog(`Checking for update...`);
            var resp = await getJson({
                hostname: 'api.github.com',
                port: 443,
                path: `/repos/${repo}/releases/latest`,
                method: 'GET',
                headers: {
                    'User-Agent': `${capitalize(package.name)}/${ver}`,
                },
            });
            if (resp.message) return r(consolelog(`Update error: ${resp.message.replace(`rate limit`, chalk.redBright(`rate limit`)).replace(/\(.*?\)\s?/g, '')}`, undefined, undefined, undefined, log)); // usually rate limit error
            var newVer = resp.tag_name.toLocaleLowerCase().replace(/v/g, ``);
            if (newVer == ver) return r(consolelog(`Up-to-date (${newVer})`, undefined, undefined, undefined, log));
            if (resp.draft) return r(consolelog(chalk.gray(`Not downloading draft update`, undefined, undefined, undefined, log)));
            if (resp.prerelease && !pre) return r(consolelog(`Not downloading prerelease update`, undefined, undefined, undefined, log));
            const asset = resp.assets.find(x => x.name.includes(platform.replace(`wine`, ``)));
            if (!asset) return r(consolelog(`No compatible update download found.. (${platform.replace(`wine`, ``)})`, undefined, undefined, undefined, log));
            var filePath = process.argv[0];
            if (!fs.existsSync(filePath)) return r(consolelog(`I dont exist..?\n${chalk.gray(filePath)}`, undefined, undefined, undefined, log));
            consolelog(`Downloading update... ${ver} => ${newVer}`, undefined, undefined, undefined, log);
            //if (!fs.accessSync(__dirname)) return consolelog(`No access to local dir`);
            exiting = true; // pause ability to exit
            download(asset.browser_download_url);
            function download(url) {
                https.get(url, down => {
                    if (down.headers.location) return download(down.headers.location); // github redirects to their cdn, and https dosent know redirects :\
                    const tempFile = `${filePath}-${new Date().getTime()}`;
                    fs.renameSync(filePath, tempFile);
                    var file = fs.createWriteStream(filePath);

                    var size = parseInt(down.headers['content-length']);
                    var downloaded = 0;
                    down
                        .on(`data`, d => {
                            downloaded += d.length;
                            consolelog(`Downloading update... ${ver} => ${newVer} ${chalk.cyan((downloaded / size * 100).toFixed(2))}%`, undefined, undefined, undefined, log);
                        })
                        .pipe(file
                            .on(`finish`, () => {
                                file.close();
                                exiting = false; // pause ability to exit
                                if (downloaded / size * 100 != 100) {
                                    fs.rmSync(filePath);
                                    fs.renameSync(tempFile, filePath);
                                    return consolelog(`Update error? v${ver} => v${resp.tag_name.replace(/v/g, ``)} ${chalk.redBright(`${(downloaded / size * 100).toFixed(2)}%`)}`, undefined, undefined, undefined, log);
                                }
                                fs.rmSync(tempFile);
                                fs.chmodSync(filePath, 0777);
                                consolelog(`Update finished! v${ver} => v${colorVersion(ver, resp.tag_name.replace(/v/g, ``))} ${chalk.greenBright(`${(downloaded / size * 100).toFixed(2)}%`)}`, undefined, undefined, undefined, log);
                                cache.myVersionCheck = new Date(new Date().toUTCString());
                                writeCache();
                                try {
                                    child.spawn(process.argv[0], process.argv.splice(1), {
                                        stdio: 'inherit',
                                    })
                                } catch (e) {
                                    exitHandler();
                                }
                            }))
                });

                /*
                        https.get(`https://codeload.github.com/${repo}/zip/main`, async res => {
                if (!res.headers['content-length']) {
                    consolelog(`github fuckery, ${String(res.statusMessage).toLowerCase()}`, undefined, undefined, undefined, mLog); // ok.
                    return r(await downloadRepo.call(null, ...arguments));
                }
                var size = parseInt(res.headers['content-length']);
                var downloaded = 0;
                consolelog(`Downloading 0%`, undefined, undefined, undefined, mLog);
                fs.mkdirsSync(tempFolder);
                var zip = `${tempFolder}${repo.replace(`/`, ``)}.zip`;
                res.on(`data`, d => {
                    downloaded += d.length;
                    consolelog(`Downloading ${(downloaded / size * 100).toFixed(2)}%`, undefined, undefined, undefined, mLog);
                })
                    .pipe(fs.createWriteStream(zip))
                    .on(`close`, async () => {
                        consolelog(`Downloaded, extracting...`, undefined, undefined, undefined, mLog);
                        // extract downloaded zip
                        await zl.extract(zip, `${tempFolder}${repo.replace(`/`, ``)}`);
                        consolelog(`Extracted`, undefined, undefined, undefined, mLog);
                        // simplify directiories
                        fs.moveSync(`${tempFolder}${repo.replace(`/`, ``)}/${repo.split(`/`)[1]}-main/`, path, { overwrite: true });
                        r(true);
                    });
            })
                .on('error', (e) => {
                    consolelog(`Error downloading source zip:`);
                    consolelog(e);
                    r(e);
                });
                */
            }
        });
    }

    async function downloadRepo(path = `${__dirname}/FSD-Template`, repo, mLog = -1) {
        if (!repo) return;
        if (mLog == -1) mLog = logHistory.length;
        return new Promise(async r => {
            https.get(`https://codeload.github.com/${repo}/zip/main`, async res => {
                if (!res.headers['content-length']) {
                    consolelog(`github fuckery, ${String(res.statusMessage).toLowerCase()}`, undefined, undefined, undefined, mLog); // ok.
                    return r(await downloadRepo.call(null, ...arguments));
                }
                var size = parseInt(res.headers['content-length']);
                var downloaded = 0;
                consolelog(`Downloading 0%`, undefined, undefined, undefined, mLog);
                await makeTemp();
                var zip = `${tempFolder}${repo.replace(`/`, ``)}.zip`;
                res.on(`data`, d => {
                    downloaded += d.length;
                    consolelog(`Downloading ${(downloaded / size * 100).toFixed(2)}%`, undefined, undefined, undefined, mLog);
                })
                    .pipe(fs.createWriteStream(zip))
                    .on(`close`, async () => {
                        consolelog(`Downloaded, extracting...`, undefined, undefined, undefined, mLog);
                        // extract downloaded zip
                        await zl.extract(zip, `${tempFolder}${repo.replace(`/`, ``)}`);
                        consolelog(`Extracted`, undefined, undefined, undefined, mLog);
                        // simplify directiories
                        fs.moveSync(`${tempFolder}${repo.replace(`/`, ``)}/${repo.split(`/`)[1]}-main/`, path, { overwrite: true });
                        r(true);
                    });
            })
                .on('error', (e) => {
                    consolelog(`Error downloading source zip:`);
                    consolelog(e);
                    r(e);
                });
        });
    };

    async function updateProject(
        Template = true,
        Unpack = true,
        Toucan = true
    ) {
        return new Promise(async r => {
            var mLog = consolelog(`Updating project...`);
            var updates = {};
            // update template
            if (Template) {
                const templatePath = `${tempFolder}FSD-Template/`;
                var template = await downloadRepo(templatePath, `DRG-Modding/FSD-Template`, mLog);
                if (template != true) return r(consolelog(`Failed to download template`, undefined, undefined, undefined, mLog));

                updates[templatePath] = [ // files we want from the template
                    `Binaries`,
                    `Plugins`,
                    `Source`,
                    `FSD.uproject`,
                    `Config`,
                ];
            }

            // update assets
            if (Unpack) {
                const unpackPath = `${tempFolder}unpack/`;
                // unpack drg INTO /unpack
                var unpackLog = consolelog(`Unpacking DRG...`);
                var unpacked = await unpack(`${config.drg}/FSD/Content/Paks/FSD-WindowsNoEditor.pak`, unpackPath);
                if (!unpacked) return consolelog(`Failed to unpack drg`);
                consolelog(`Unpacked DRG`, undefined, undefined, undefined, unpackLog);
                // files we want from the unpack
                updates[`${unpackPath}FSD/`] = [
                    // Content
                    ...fs.readdirSync(`${unpackPath}FSD/Content`)
                        .filter(x => !x.startsWith(`ShaderArchive`) && !x.toLowerCase().includes(`cache`))
                        .map(x => `Content/${x}`),
                ];
            }

            // update toucan
            if (Toucan) {
                const toucanPath = `${tempFolder}Toucan/`;
                var toucan = await downloadRepo(toucanPath, `Touci/Toucan-DRG-Framework`, mLog);
                if (toucan != true) return r(consolelog(`Failed to download toucan framework`));

                updates[toucanPath] = [ // files we want from the template
                    `Content/Toucan`
                ];
            }
            // :)
            //await backup(true);
            // update folders
            var updateList = [];
            Object.keys(updates).forEach(key => {
                updates[key].forEach(x => {
                    updateList.push([`${key}${x}`, `${ProjectPath}${x}`, x]);
                });
            });
            // Remove folders that include mod files
            var modFolders = []; // I dont think "never cook" actually reads files.. I guess I could remove them for the cook and restore them? | All are in Content/
            Object.values(config.presets).concat(config).forEach(x => {
                if (x.ModName)
                    modFolders.push(x.ModName);
                if (x.DirsToCook)
                    x.DirsToCook.forEach(y => {
                        modFolders.push(y);
                    });
            });
            /*function cleanUpdateList(updateList = []) { // witchcraft and misery
                var cleanUpdateList = [];
                var filterList = [];
                updateList.forEach(x => {
                    if (!x[2].includes(`Content/`)) return cleanUpdateList.push(x);
                    var p = x[2].replace(`Content/`, ``);
                    runFolder(p);
                    function runFolder(p) {
                        var pile = modFolders.find(x => x.startsWith(p));
                        if (!pile) return cleanUpdateList.push([
                            `${x[0].replace(x[2], ``)}Content/${p}`, // source
                            `${x[1].replace(x[2], ``)}Content/${p}`, // dest (project)
                            p,
                        ]);
                        var c = `${p}/${pile.replace(`${p}/`, ``).split(`/`)[0]}`; // next folder in the modfile
                        var b = `${x[0].replace(x[2], ``)}Content/${c}`;
                        // p = current folder in the modfile
                        if (p == pile) return filterList.push(p);
                        cleanUpdateList = cleanUpdateList.concat(
                            fs.readdirSync(b)
                                .filter(x => x != pile.replace(`${p}/`, ``).split(`/`)[1])
                                .map(y => [
                                    `${b}/${y}`, // source
                                    `${ProjectPath}Content/${c}/${y}`, // dest (project)
                                    y,
                                ])
                        );
                        runFolder(c);
                    }
                });
                filterList.forEach(x => consolelog(`Not updating ${x}`));
                return cleanUpdateList
                    .filter(x => !filterList.some(e => x[0].includes(e))) // keep?
                    .map(x =>
                        x.map(y => y.replace(/\/\//g, `/`))
                    )
            }*/
            function cleanUpdateList(rawList = updateList, keepList = modFolders) {
                var newList = [];
                /*[
                    ``, // source + base
                    ``, // dest (project) + base
                    ``, // base
                ]*/
                /*rawList.forEach(move => {
                    if (keepList.includes(move[2])) { // path is in keep list, 
                        fs.readdirSync(move[0]).forEach(x => { // add everything else
                            if (!keepList.includes(`${move[2]}/${x}`)) return; //  thats not in the keep list
                            newList.push([ // to the new list
                                `${move[0]}/${x}`,
                                `${move[1]}/${x}`,
                                `${move[2]}/${x}`,
                            ]);
                        });
                    }
                });*/
                // Check whats needed and "branch out"
                keepList.forEach(item => {
                    processDir(item);
                    function processDir(item) {
                        var pile = ``;
                        item.split(`/`).forEach(dir => {
                            pile += `${dir}/`;

                            var seed = rawList.find(x => x[2] == pile); // find what I need to "branch out" from
                            consolelog(rawList);
                            return consolelog(`${pile}\nITEM: ${item}`);
                            if (!seed) return consolelog(`Missing seed for ${item}\n${pile}\n${x[2]}`);
                            var source = PATH.dirname(seed); // source directory

                            fs.readdirSync(`${source}/${pile}`).forEach(x => {
                                var keep = keepList.find(y => y[2] == `${pile}/${x}`);
                                consolelog(`keep: ${keep}`);
                                if (keep) return processDir(keep); // file is needed 
                            });
                        });
                    }
                });
                return newList;
            }

            //updateList = cleanUpdateList();
            //consolelog(updateList);
            //return;

            var done = 0;
            for (var i = 0; i < updateList.length; i++) {
                var source = updateList[i][0];
                var dest = updateList[i][1];
                try {
                    //consolelog(updateList[i]);
                    //consolelog(dest);
                    //consolelog(source);
                    fs.rmSync(dest, { recursive: true, force: true });
                    if (!fs.existsSync(source))
                        consolelog(`Failed to find update for "${chalk.redBright(PATH.basename(source))}"\nMissing: ${source}`);
                    else {
                        var logI = consolelog(`Updating ${chalk.cyan(PATH.basename(source))}`);
                        fs.moveSync(source, dest);
                        consolelog(`Updated ${chalk.cyan(PATH.basename(source))}`, undefined, undefined, undefined, logI);
                        done++;
                    }
                } catch (e) {
                    consolelog(`ERROR ${chalk.red(e)}\n${source}`, undefined, undefined, undefined, logI);
                    consolelog(e);
                }
            }
            consolelog(`Updated ${chalk.cyan(done)}/${chalk.cyan(updateList.length)}${done == updateList.length ? ` ${chalk.greenBright(`PERFECT!`)}` : ``}`);
            //fs.rmSync(tempFolder, { recursive: true, force: true });
            r(true);
        })
    };

    async function startDrg() {
        return new Promise(async r => {
            await killDrg();
            var log = consolelog(`Launching DRG...`);
            var started = false;
            setTimeout(() => {
                if (started) return;
                consolelog(`Timedout launching DRG`, undefined, undefined, undefined, log);
                r(true);
            }, 10000);
            var result = await open(`steam://rungameid/548430`);
            //result.on(`message`, consolelog);
            if (!result) {
                consolelog(`Failed to launch DRG`, undefined, undefined, undefined, log); // most likely
                return r(true);
            }
            started = true;
            consolelog(`Launched DRG`, undefined, undefined, undefined, log); // most likely
            r(true);
            /*child.exec(`steam steam://rungameid/548430`)
                .on(`exit`, () => {
                    started = true;
                    consolelog(`Launched DRG`, undefined, undefined, undefined, log); // most likely
                    r(true);
                })
                .on(`message`, (d) => logFile(String(d)))
                .stdout.on('data', (d) => logFile(String(d)))*/
        })
    }

    async function DrgRunning() {
        return new Promise(async r => {
            var prcList = await find('name', 'FSD');
            //consolelog(prcList);
            var found = false;
            prcList.forEach(x => {
                try {
                    if (x.cmd.toLocaleLowerCase().replace(/\\/g, `/`).includes(`/steam/`))
                        found = true;
                } catch (error) { }
            })
            r(found);
        })
    }

    async function waitForDrg() {
        return new Promise(async r => {
            if (await DrgRunning()) return r();
            else
                var int = setInterval(async x => {
                    if (await DrgRunning()) {
                        clearInterval(int);
                        r();
                    };
                }, 1000);
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

    setPreset(cache.selectedPreset);

    function setPreset(key = selectedPresetKey) {
        updateConfig(true, false); // clean preset
        if (!key) return;
        var preset = config.presets[key];
        if (selectedPresetKey == key && selectedPresetKey) {
            selectedPresetKey = ``;
            cache.selectedPreset = selectedPresetKey;
            writeCache();
            consolelog(`Preset cleared.`);
            return;
        }
        selectedPresetKey = key;
        cache.selectedPreset = selectedPresetKey;
        writeCache();
        if (!preset) return consolelog(`Invalid preset: ${key}`);
        applyPreset();
        function applyPreset(set = preset, path = []) {
            Object.keys(set).forEach(key => {
                if (!key) return consolelog(`What the fuck is this key? ${key}`);
                function setV(newValue, object = unVaredConfig, stack = JSON.parse(JSON.stringify(path))) {
                    stack = stack.concat([key]);
                    while (stack.length > 1) {
                        object = object[stack.shift()];
                    }
                    return object[stack.shift()] = newValue;
                }
                function getV(object = unVaredConfig, stack = JSON.parse(JSON.stringify(path))) {
                    stack = stack.concat([key]);
                    while (stack.length > 1) {
                        object = object[stack.shift()];
                    }
                    return object[stack.shift()];
                }

                var val = set[key];
                if (typeof val != typeof getV()) return consolelog(`Preset "${selectedPresetKey}" value "${key}" isnt the correct type "${typeof getV(config)}"`);
                if (typeof val == `object` && !Array.isArray(val)) return applyPreset(val, path.concat([key]));
                if (getV() != val) {
                    consolelog(`${chalk.cyan(key)}: ${chalk.gray(getV())} => ${chalk.hex(/*key == `ModName` ? staticC(val) :*/ getValueColor(val))(val)}`);
                    setV(val);
                }
            });
        }
        config = unVaredConfig;
        updateConfig(false, false);
    }

    if (!fs.existsSync(`${ProjectPath}Config/DefaultGame.ini`)) fs.writeFileSync(`${ProjectPath}Config/DefaultGame.ini`, ``);;

    var children = [];
    var exiting = false;
    /**
     * 
     * @param {Error|boolean} err Error or if "true" will just exit normally without waiting for input
     * @returns 
     */
    async function exitHandler(err) {
        if (fs.existsSync(tempFolder) && process.pkg) await clearTemp();
        if (children)
            if (!Array.isArray(children))
                consolelog(children);
            else
                children.forEach(x => {
                    if (!x.kill)
                        console.log(`This isnt a fucking child!`);
                    else
                        x.kill();
                    children.splice(children.findIndex(x => x == x), 1);
                });
        if (err && err != `SIGINT` && err.name && err.message) console.log(err);
        consolelog(err);
        if (process.pkg && err != true) {
            if (exiting) return;
            else consolelog(`[ Press any key to exit ]`);
            exiting = true;
            await keypress();
        }
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
    if (config.logging.cleaning.clearOnNewSession)
        fs.writeFileSync(config.logging.file, ``);

    if (module.parent) return; // required as a module

    if (runningRoot) {
        consolelog(`Running as root`);
        username = getUsername();
        consolelog(`User: ${chalk.cyan(username)}`);
        updateConfig();
    }
    if (config.update && new Date() - new Date(cache.myVersionCheck) > 86400000) update(); // 24h

    function getOptionIndex(name = `cook`, menu = selectedMenu) {
        return menu.filter(x => x.shown ? x.shown() : true).findIndex(x => x.name == name);
    }

    var mainMenu = [
        {
            name: (self) => self.running == undefined ? `cook` : (self.running == false ? `cooked` : `cooking`),
            color: `#00ff00`,
            run: () => {
                return new Promise(async r => {
                    if (config.snakeIntervention) startSnake();
                    let res = await cook();
                    if (config.snakeIntervention) endSnake();
                    r(res);
                })
            },
        },
        {
            name: (self) => self.running == undefined ? `publish` : (self.running == false ? `published` : `publishing`),
            color: `#00FFFF`,
            run: publish,
            shown: () => config.modio.token && config.modio.gameid && config.modio.modid,
        },
        {
            name: `backup`,
            color: `#03a5fc`,
            run: () => backup(),
        },
        {
            name: `unload backup${cache.loadedBackup.concat(
                fs.readdirSync(`${ProjectPath}Content/`).filter(x => x.endsWith(latestBackupSuffix))
            ) > 1 ? `s` : ``}`,
            color: `#ffa500`,
            run: () => loadbackup(),
            shown: () => cache.loadedBackup.concat(
                fs.readdirSync(`${ProjectPath}Content/`).filter(x => x.endsWith(latestBackupSuffix))
            ).length != 0,
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
                var backuppath = fs.readdirSync(config.backup.folder);
                if (!backuppath) return consolelog(`Invalid backup id!`);
                backuppath.sort(function (a, b) {
                    if (!fs.existsSync(`${config.backup.folder}/${a}/${backupInfo}`)) return 0;
                    var A = fs.readFileSync(`${config.backup.folder}/${a}/${backupInfo}`);
                    if (!isJsonString(A)) return 0;
                    A = JSON.parse(A);

                    if (!fs.existsSync(`${config.backup.folder}/${b}/${backupInfo}`)) return 0;
                    var B = fs.readFileSync(`${config.backup.folder}/${b}/${backupInfo}`);
                    if (!isJsonString(B)) return 0;
                    B = JSON.parse(B);

                    var a = A.modname;//new Date(new Date().toUTCString()) - new Date(a.split(` - `)[1])
                    var b = B.modname;//new Date(new Date().toUTCString()) - new Date(b.split(` - `)[1])
                    if (a == config.ModName) return -1; // push selected modname to the top
                    if (a < b) return 1;
                    if (a > b) return -1;
                    return 0;
                });
                //backuppath = backuppath.sort((a, b) => a.split(` - `)[0].localeCompare(b.split(` - `)[0]))
                var totalSize = 0;
                backuppath.forEach(x => {
                    var name = `${chalk.cyan(x.split(` - `)[0])} - ${since(new Date(new Date().toUTCString()) - new Date(x.split(` - `)[1] + `.000Z`))}`;
                    var backupinfo = `${config.backup.folder}/${x}/${backupInfo}`;
                    if (fs.existsSync(backupinfo)) {
                        var info = fs.readFileSync(backupinfo);
                        if (!isJsonString(info)) return;
                        info = JSON.parse(info);
                        if (info.size)
                            totalSize += info.size;
                        name = `${info.full ? chalk.yellowBright(info.id) : chalk.cyan(info.id)} - ${info.modname ? staticCText(info.modname) : chalk.gray(`[empty]`)} - ${since(new Date(new Date().toUTCString()) - new Date(info.date))} - ${chalk.cyan(humanFileSize(info.size, true, 0).toLowerCase().replace(` `, ``))}`;
                        if (info.verified)
                            name += `${info.verified ? chalk.greenBright(` ???`) : ``}`
                    }
                    listBackupOptions.push({
                        name: name, // I could make this dyn() but think that would be a bit ineffecient
                        color: `#FFFFFF`,
                        run: () => loadbackup(x.split(` - `)[0]),
                        key: (k) => {
                            switch (k) {
                                case `y`: // delete, whY
                                    //fs.rmSync(`${config.backup.folder}/${x}`, { recursive: true, force: true });
                                    //consolelog(`Deleted ${x}`);
                                    break;
                                case `v`: // verify
                                    info.verified = !info.verified;
                                    fs.writeJSONSync(backupinfo, info);
                                    const savedSelected = selected;
                                    self.run(self);
                                    selected = savedSelected;
                                    break;
                                case `o`:
                                    let log = consolelog(`Opening ${x} ...`);
                                    openExplorer(`${config.backup.folder}/${x}`, () => consolelog(`Opened`, undefined, undefined, undefined, log));
                                    break;
                                case `i`: // info
                                    var infoList = [
                                        {
                                            name: `back`,
                                            color: `#00FFFF`,
                                            run: () => {
                                                selectedMenu = listBackupOptions;
                                                selected = getOptionIndex(name);
                                            },
                                            key: (k) => {
                                                if (k != `i`) return;
                                                selectedMenu = listBackupOptions;
                                                selected = getOptionIndex(name);
                                            },
                                        },
                                    ];
                                    addInfo();
                                    function addInfo(Info = info) {
                                        Object.keys(Info).forEach(key => {
                                            var val = Info[key];
                                            if (typeof val == `object`) {
                                                if (Object.keys(val) == 0) return;
                                                infoList.push(
                                                    {
                                                        name: `-- ${key} --`,
                                                        color: `#ffffff`,
                                                    }
                                                );
                                                addInfo(val);
                                                return;
                                            }

                                            switch (key) {
                                                case `size`:
                                                    val = humanFileSize(val, true).toLowerCase().replace(` `, ``);
                                                    break;
                                                case `date`:
                                                    val = new Date(val).toISOString().replace(/T/, ' ').replace(/\..+/, '');
                                                    infoList.push(
                                                        {
                                                            name: `since: ${since(new Date(new Date().toUTCString()) - new Date(val))}`,
                                                            color: `#ffffff`,
                                                        }
                                                    );
                                                    break;
                                                case `verified`:
                                                    infoList.push(
                                                        {
                                                            name: `${key}: ${val ? chalk.greenBright(val) : val}`,
                                                            color: `#ffffff`,
                                                        }
                                                    );
                                                    return;
                                            }
                                            infoList.push(
                                                {
                                                    name: `${key}: ${val}`,
                                                    color: `#ffffff`,
                                                }
                                            );
                                        });
                                    }
                                    selectedMenu = infoList;
                                    selected = 0;
                                    break;
                            }
                        },
                    });
                });
                listBackupOptions.splice(1, 0, {
                    name: `Total Size: ${humanFileSize(totalSize, true).toLowerCase().replace(` `, ``)}`,
                    color: `#FFFFFF`,
                });
                selectedMenu = listBackupOptions;
                selected = 0;
            },
            shown: () => fs.existsSync(config.backup.folder) && fs.readdirSync(config.backup.folder).length,
        },
        {
            name: `settings`,
            color: `#808080`,
            run: (self) => {
                selectedMenu = [
                    {
                        name: () => `${config.ProjectName} > ${staticCText(config.ModName)}`,
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
                selected = 1;
                addSettings();
                function addSettings(configs = unVaredConfig, path = []) {
                    var cat = path[0];

                    var category = {
                        catName: cat,
                        name: `-- ${cat} --`,
                        children: [],
                        open: false,
                        run: async (selfCat) => {
                            if (selfCat.open) {
                                selfCat.children.forEach(x =>
                                    selectedMenu.splice(
                                        selectedMenu.findIndex(y => y == x)
                                        , 1)
                                );
                                selfCat.children = [];
                                selfCat.open = false;
                            } else
                                Object.keys(configs).forEach(key => {
                                    var val = configs[key];
                                    switch (typeof val) {
                                        case `object`:
                                            if (key == `presets`) return;
                                            return addSettings(val, path.concat([key]));
                                        case `string`:
                                        case `number`:
                                        case `boolean`:
                                            break;
                                        default:
                                            return;
                                    }
                                    //val  = get();
                                    var setting = {
                                        name: () => `${path.concat(key).join(` > `)}`.replace(key, chalk.hex(getValueColor(val))(key)),
                                        run: async (self) => {
                                            // I hate nodejs values and refrences
                                            function set(newValue, object = unVaredConfig, stack = JSON.parse(JSON.stringify(path))) {
                                                stack = stack.concat([key]);
                                                while (stack.length > 1) {
                                                    object = object[stack.shift()];
                                                }
                                                return object[stack.shift()] = newValue;
                                            }
                                            function get(object = unVaredConfig, stack = JSON.parse(JSON.stringify(path))) {
                                                stack = stack.concat([key]);
                                                while (stack.length > 1) {
                                                    object = object[stack.shift()];
                                                }
                                                return object[stack.shift()];
                                            }
                                            switch (typeof val) {
                                                case `boolean`:
                                                    val = set(!get());
                                                    break;
                                                case `string`:
                                                    val = set(await getInput(`${dyn(self.name, self)}:`, false, -1, get()));
                                                    break;
                                                case `number`:
                                                    val = set(parseInt(await getInput(`${dyn(self.name, self)}:`, true, -1, get())));
                                                    break;
                                            }
                                            writeConfig(unVaredConfig);
                                            updateConfig();
                                        },
                                    };
                                    if (selfCat.catName)
                                        selectedMenu.splice(selectedMenu.findIndex(x => x == selfCat), 0, setting);
                                    else selectedMenu.push(setting);
                                    selfCat.children.push(setting);
                                    selfCat.open = true;
                                });
                        },
                    };
                    if (!cat)
                        category.run(category);
                    else
                        selectedMenu.push(category);
                }
            },
            shown: () => fs.existsSync(config.backup.folder) && fs.readdirSync(config.backup.folder).length,
        },
        {
            name: (self) => self.running == undefined ? `drg` : self.running == false ? `drg` : `launching...`,
            color: `#ffa500`,
            run: startDrg,
        },
        {
            name: `misc`,
            color: `#ffffff`,
            run: (self) => {
                var miscMenu = [
                    {
                        name: `back`,
                        color: `#00FFFF`,
                        run: () => {
                            selectedMenu = mainMenu;
                            selected = getOptionIndex(self.name);
                        },
                    },
                    {
                        name: `update`,
                        color: `#ff00ff`,
                        run: (self) => {
                            selectedMenu = [
                                {
                                    name: `back`,
                                    color: `#00FFFF`,
                                    run: () => {
                                        selectedMenu = miscMenu;
                                        selected = getOptionIndex(self.name);
                                    }
                                },
                                {
                                    name: capitalize(package.name),
                                    color: `#ff00ff`,
                                    run: () => update(undefined, undefined, true),
                                },
                                {
                                    name: `project`,
                                    color: `#ff00ff`,
                                    run: () => updateProject(),
                                },
                                {
                                    name: `project (${chalk.hex(`#ff8c00`)(`toucan`)})`,
                                    color: `#ff00ff`,
                                    run: () => updateProject(false, false, true),
                                },
                                {
                                    name: `project (template)`,
                                    color: `#ff00ff`,
                                    run: () => updateProject(true, false, false),
                                },
                                {
                                    name: `project (unpack)`,
                                    color: `#ff00ff`,
                                    run: () => updateProject(false, true, false),
                                },
                                {
                                    name: `generate template`,
                                    color: `#ff00ff`,
                                    run: template,
                                },
                            ];
                            selected = 0;
                        },
                    },
                    {
                        name: `export`,
                        color: `#00ff00`,
                        run: (self) => {
                            var exportMenu = [
                                {
                                    name: `back`,
                                    color: `#00FFFF`,
                                    run: () => {
                                        selectedMenu = miscMenu;
                                        selected = getOptionIndex(self.name);
                                    }
                                },
                                {
                                    name: `extract textures`,
                                    color: `#00ff0f`,
                                    run: extract,
                                },
                                {
                                    name: `extract textures flat`,
                                    color: `#00ffff`,
                                    run: () => extract(undefined, undefined, `${__dirname}/flat/`),
                                },
                                {
                                    name: `make empty dirs`,
                                    color: `#000000`,
                                    run: async () => {
                                        var log = consolelog(`Unpacking..`);
                                        var unpackDir = `${tempFolder}unpack/`;
                                        await unpack(`${config.drg}/FSD/Content/Paks/FSD-WindowsNoEditor.pak`, unpackDir);
                                        consolelog(`Unpacked, making empty dirs`, undefined, undefined, undefined, log);
                                        doDir();
                                        function doDir(dir = ``) {
                                            fs.readdirSync(`${unpackDir}FSD/Content/${dir}`).forEach(x => {
                                                if (fs.statSync(`${unpackDir}FSD/Content/${dir}/${x}`).isDirectory()) {
                                                    fs.mkdirsSync(`${__dirname}/../Empty/${dir}/${x}`);
                                                    doDir(`${dir}/${x}`);
                                                }
                                            });
                                        }
                                        consolelog(`Empty made`, undefined, undefined, undefined, log);
                                    },
                                },
                                {
                                    name: `drg`,
                                    color: `#ffa500`,
                                    run: async (self) => {
                                        return new Promise(async r => {
                                            var path = `${config.drg}/FSD/Content/Paks/FSD-WindowsNoEditor.pak`;
                                            var log = consolelog(`Unpacking ${chalk.cyan(PATH.basename(path).replace(`.pak`, ``))}`);
                                            await unpack(path);
                                            consolelog(`Unpacked ${chalk.cyan(PATH.basename(path).replace(`.pak`, ``))}`, undefined, undefined, undefined, log);
                                            r();
                                        })
                                    },
                                },
                            ];
                            function searchFolder(folder, search) {
                                var results = [];
                                fs.readdirSync(folder).forEach(x => {
                                    if (fs.statSync(`${folder}${x}`).isDirectory())
                                        results = results.concat(searchFolder(`${folder}${x}/`, search));
                                    else if (x.includes(search))
                                        results.push(`${folder}${x}`);
                                });
                                return results;
                            }
                            searchFolder(`${config.drg}/FSD/Mods/`, `.pak`)
                                .forEach(x => {
                                    let n = PATH.basename(x).replace(`.pak`, ``);
                                    exportMenu.splice(1, 0, {
                                        name: staticCText(n),
                                        color: `#ffffff`,
                                        run: async (self) => {
                                            return new Promise(async r => {
                                                let log = consolelog(`Unpacking ${staticCText(n)}`);
                                                await unpack(x);
                                                consolelog(`Unpacked ${staticCText(n)}`, undefined, undefined, undefined, log);
                                                openExplorer(`${__dirname}/${n}`);
                                                r();
                                            })
                                        },
                                        key: (k, self) => {
                                            switch (k) {
                                                case `d`:
                                                    fs.rmSync(PATH.dirname(x), { recursive: true, force: true });
                                                    selectedMenu.splice(selectedMenu.findIndex(y => y == self), 1);
                                                    break;
                                                case `o`:
                                                    let log = consolelog(`Opening ${x} ...`);
                                                    openExplorer(x, () => consolelog(`Opened`, undefined, undefined, undefined, log));
                                                    break;
                                            }
                                        },
                                    });
                                });
                            selectedMenu = exportMenu;
                            selected = 0;
                        },
                    },
                    {
                        name: `compile all`,
                        color: `#03a5fc`,
                        run: compileall,
                    },
                    {
                        name: `full backup`,
                        color: `#03a5fc`,
                        run: () => backup(true),
                    },
                    {
                        name: () => {
                            var n = `presets`.split(``);
                            n.forEach((x, i) => {
                                if (Object.values(config.presets)[i]) {
                                    var c = staticC(Object.values(config.presets)[i].ModName);
                                    n[i] = chalk.hex(c.c)(x);
                                }
                            });
                            return n.join(``);
                        },
                        run: (self) => {
                            var presetMenu = [
                                {
                                    name: `back`,
                                    color: `#00FFFF`,
                                    run: () => {
                                        selectedMenu = miscMenu;
                                        selected = getOptionIndex(self.name);
                                    }
                                },
                            ];
                            Object.keys(config.presets).forEach(key => {
                                var keyC = staticCText(key, config.presets[key]);
                                presetMenu.push(
                                    {
                                        name: () => selectedPresetKey == key ? `> ${keyC} <` : keyC,
                                        run: () => setPreset(key),
                                    }
                                );
                            });
                            selectedMenu = presetMenu;
                            selected = 0;
                        },
                        shown: () => Object.keys(config.presets).length != 0,
                    },
                    { // feels like a bit too in-your-face, but its in the misc menu so its not THAT in-your-face
                        name: `make mod`,
                        color: `#ff8c00`,
                        run: async () => {
                            var modName = await getInput(`New mod name:`);
                            if (!modName) return;
                            fs.copySync(`${ProjectPath}Content/Toucan/template`, `${ProjectPath}Content/${modName}`);
                            fs.renameSync(`${ProjectPath}Content/${modName}/templateMain.uasset`, `${ProjectPath}Content/${modName}/${modName}Main.uasset`);
                            unVaredConfig.presets[modName] = config.preset[modName] = {
                                "ModName": modName,
                            };
                            writeConfig();
                            setPreset(modName);
                            consolelog(`Made mod "${modName}"`);
                        },
                        shown: () => fs.existsSync(`${ProjectPath}Content/Toucan/template`) && !fs.existsSync(`${ProjectPath}Content/template`),
                    },
                    /*{
                        name: `shortcut log`,
                        color: `#ffffff`,
                        run: (self) => {
                            consolelog([
                                __dirname,
                                PATH.dirname(`${__dirname}../`),
                                PATH.basename(PATH.dirname(`${__dirname}../`))
                            ].join(`\n`));
                        },
                        shown: false,
                    },*/
                    {
                        name: `add desktop shortcut`,
                        color: `#ffffff`,
                        run: (self) => {
                            // https://wiki.archlinux.org/title/desktop_entries
                            // https://specifications.freedesktop.org/desktop-entry-spec/desktop-entry-spec-latest.html#recognized-keys
                            let lines = [
                                `[Desktop Entry]`,
                                `Version=1.5`,
                                `Name=${capitalize(package.name)} | ${PATH.basename(PATH.dirname(`${__dirname}../`))}`, // required
                                `Path=${__dirname}`,
                                `Type=Application`, // required
                                `Terminal=true`,
                                `Exec=${process.argv[0].endsWith(`node`) ? process.argv.join(` `) : process.argv[0]}`,
                                `Comment=${package.description.replace(/\n/g, ` `)}`,
                                `Icon=/home/${username}/.local/share/applications/creaper.png`,
                            ];
                            let n = `${capitalize(package.name)}-${PATH.basename(PATH.dirname(`${__dirname}../`))}`;
                            fs.writeFileSync(`/home/${username}/.local/share/applications/${n}.desktop`, lines.join(`\n`));
                            if (!fs.existsSync(`/home/${username}/.local/share/applications/creaper.png`))
                                fs.copySync(`${__dirname}/creaper.png`, `/home/${username}/.local/share/applications/creaper.png`);
                            consolelog(`Shortcut for ${PATH.basename(PATH.dirname(`${__dirname}../`))} added`);
                        },
                        shown: () => os.platform() == `linux` && !fs.existsSync(`/home/${username}/.local/share/applications/${capitalize(package.name)}-${PATH.basename(PATH.dirname(`${__dirname}../`))}.desktop`),
                    },
                    {
                        name: `go go`, // or just add -nosplash to start args
                        color: `#ffffff`,
                        run: () => {
                            if (fs.existsSync(`${config.drg}/FSD/Content/Movies`))
                                fs.rmSync(`${config.drg}/FSD/Content/Movies`, { recursive: true, force: true });
                            if (fs.existsSync(`${config.drg}/FSD/Content/Splash`))
                                fs.rmSync(`${config.drg}/FSD/Content/Splash`, { recursive: true, force: true });
                            consolelog(`Cleared`);
                        },
                        shown: () => fs.existsSync(`${config.drg}/FSD/Content/Movies`) || fs.existsSync(`${config.drg}/FSD/Content/Splash`),
                    },
                    {
                        name: `download ${chalk.cyan(`mod`)}`,
                        color: `#ffffff`,
                        key: (k, self) => {
                            switch (k) {
                                case `o`:
                                    let log = consolelog(`Opening the mods folder...`);
                                    openExplorer(`${config.drg}/FSD/Mods/$`, () => consolelog(`Opened`, undefined, undefined, undefined, log));
                                    break;
                            }
                        },
                        run: async (self) => {
                            var modid = await getInput(`mod id:`, true);
                            if (!modid) return;
                            if (!config.modio.apikey) return consolelog(`No given api key`);
                            var mLog = consolelog(`Finding mod...`);
                            var resp = await getJson(`https://api.mod.io/v1/games/${config.modio.gameid}/mods/${modid}?api_key=${config.modio.apikey}`);
                            if (resp.error && resp.error.message) return consolelog(resp.error.message, undefined, undefined, undefined, mLog);
                            if (!resp.modfile) return consolelog(`No modfile for mod`, undefined, undefined, undefined, mLog);

                            download(resp.modfile.download.binary_url);
                            function download(url) {
                                return new Promise(r => {
                                    https.get(url, async res => {
                                        if (res.headers.location) return r(await download(res.headers.location));
                                        if (!res.headers['content-length']) {
                                            consolelog(`github fuckery, ${String(res.statusMessage).toLowerCase()}`, undefined, undefined, undefined, mLog); // ok.
                                            return;
                                        }
                                        var size = parseInt(res.headers['content-length']);
                                        var downloaded = 0;
                                        consolelog(`Downloading 0%`, undefined, undefined, undefined, mLog);
                                        makeTemp();
                                        var zip = `${tempFolder}${resp.name.replace(/\//g, ``)}.zip`;
                                        res.on(`data`, d => {
                                            downloaded += d.length;
                                            consolelog(`Downloading ${(downloaded / size * 100).toFixed(2)}%`, undefined, undefined, undefined, mLog);
                                        })
                                            .pipe(fs.createWriteStream(zip))
                                            .on(`close`, async () => {
                                                consolelog(`Downloaded, extracting...`, undefined, undefined, undefined, mLog);
                                                // extract downloaded zip
                                                await zl.extract(zip, zip.replace(`.zip`, ``));
                                                consolelog(`Extracted`, undefined, undefined, undefined, mLog);
                                                // simplify directiories
                                                fs.moveSync(zip.replace(`.zip`, ``), `${config.drg}/FSD/Mods/${resp.modfile.filename.split(`.`)[0]}`, { overwrite: true });
                                                consolelog(`Done`, undefined, undefined, undefined, mLog);
                                                r(true);
                                            });
                                    })
                                        .on('error', (e) => {
                                            consolelog(`Error downloading source zip:`);
                                            consolelog(e);
                                            r(e);
                                        });
                                });
                            }
                        }
                    },
                    {
                        name: `debug`,
                        color: `#00ff00`,
                        run: (self) => {
                            var debugMenu = [
                                {
                                    name: `back`,
                                    color: `#00FFFF`,
                                    run: () => {
                                        selectedMenu = miscMenu;
                                        selected = getOptionIndex(self.name);
                                    }
                                },
                                {
                                    name: `recompile`,
                                    color: `#00ff00`,
                                    run: () => {
                                        logFile(`Recompiling\n${config.cmds.recompile}\n`);
                                        var ch = child.exec(config.cmds.recompile);
                                        ch.on('exit', async () => {
                                            logFile(`Recompiling exited`);
                                        })
                                            .stdout.on('data', (d) => logFile(String(d)));
                                        children.push(ch);
                                    },
                                },
                                {
                                    name: `snake`,
                                    color: `#00ff00`,
                                    run: () => startSnake(),
                                },
                                {
                                    name: `log`,
                                    color: `#ffffff`,
                                    run: () => consolelog(`AAA ${logHistory.length} ${new Date().getSeconds()}`),
                                },
                                {
                                    name: `log logs`,
                                    color: `#ffffff`,
                                    run: () => consolelog(logHistory),
                                },
                                {
                                    name: `bulk log`,
                                    color: `#ffffff`,
                                    run: () => {
                                        for (var i = 0; i < 5; i++) {
                                            consolelog(`AAAA ${i} ${new Date().getSeconds()}`);
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
                                        consolelog(formatTime(new Date()));
                                    },
                                },
                                {
                                    name: `clear`,
                                    color: `#ffffff`,
                                    run: () => {
                                        logHistory = [];
                                        fittedLogs = [];
                                    },
                                },
                                {
                                    name: `empty`,
                                    color: `#ffffff`,
                                    run: () => { },
                                },
                                {
                                    name: `compile c++`,
                                    color: `#ffffff`,
                                    run: () => {
                                        function wineify(cmd) {
                                            return wine ? `wine ${cmd.replace(`C:/Program Files/Epic Games/UE_4.27`, config.UnrealEngine).split(`|`).map(x => `"${x}"`).join(` `)}` : cmd;
                                        }
                                        return new Promise(r => {
                                            var cmd = wineify(`C:/Program Files/Epic Games/UE_4.27/Engine/Binaries/DotNET/UnrealBuildTool.exe|Development|Win64|-Project="Z:/home/${username}/${config.ModName}/plugins/FSD/FSD.uproject"|-TargetType=Editor|-Progress|-NoEngineChanges|-NoHotReloadFromIDE`);
                                            logFile(`\n${cmd}\n\n`);
                                            var ch = child.exec(cmd)
                                                .on('exit', async () => {
                                                    consolelog(`Exited`);
                                                    r();
                                                }).stdout.on('data', (d) => logFile(String(d)));
                                            children.push(ch);
                                        });
                                    },
                                },
                                {
                                    name: `pack`,
                                    color: `#ffffff`,
                                    run: pack,
                                },
                                {
                                    name: (self) => self.running == undefined ? `force cook` : (self.running == false ? `cooked` : `cooking`),
                                    color: `#ff0000`, // if normal cook is happy green, this is evil red >:)
                                    run: () => cook(true),
                                },
                                {
                                    name: `clear project caches`,
                                    color: `#ffffff`,
                                    run: () => {
                                        [
                                            //`${ProjectPath}Binaries`, // requires you to "rebuild" /source stuff :\
                                            `${ProjectPath}Build`,
                                            `${ProjectPath}Intermediate`,
                                            `${ProjectPath}Saved`,
                                            `${ProjectPath}DerivedDataCache`,
                                            `${ProjectPath}Content/PipelineCaches`, // actually fucking required for the /Source
                                            `${config.UnrealEngine}/Engine/Source/Runtime/Applie/MetalRHI/Private/Shaders`,
                                            `${config.UnrealEngine}/Engine/Source/Binaries/Win64/MetalRHI/Private/Shaders`,
                                            `${config.UnrealEngine}/Engine/DerivedDataCache`,
                                            //`${config.UnrealEngine}/Engine/Intermediate`,
                                        ].forEach(x => {
                                            if (fs.existsSync(x)) {
                                                fs.rmSync(x, { recursive: true, force: true });
                                                consolelog(chalk.green(x));
                                            } else
                                                consolelog(chalk.red(x));
                                        });
                                        consolelog(`Cleared`);
                                    },
                                },
                                {
                                    name: `clear cache`,
                                    color: `#ffffff`,
                                    run: () => {
                                        if (fs.existsSync(cacheFolder)) {
                                            fs.rmSync(cacheFolder, { recursive: true, force: true })
                                            consolelog(`Cleared`);
                                        }
                                        else
                                            consolelog(`nothing to clear`);
                                    },
                                },
                                {
                                    name: `empty .uproject`,
                                    color: `#ffffff`,
                                    run: () => {
                                        fs.writeJSONSync(`${__dirname}${config.ProjectFile}`, {
                                            "FileVersion": 3,
                                            "EngineAssociation": "4.27",
                                            "Category": "",
                                            "Description": "",
                                            "Modules": [],
                                            "Plugins": [],
                                            "TargetPlatforms": [
                                                "Windows"
                                            ]
                                        });
                                        consolelog(`Emptied`);
                                    },
                                },
                                {
                                    name: `refresh-dirs-to-never-cook`,
                                    color: `#ffffff`,
                                    run: () => {
                                        refreshDirsToNeverCook();
                                        consolelog(`Refreshed`);
                                    },
                                },
                                {
                                    name: `notes`,
                                    color: `#ffffff`,
                                    run: (self) => {
                                        var notes = {
                                            "game log": `-log=${__dirname}/fuckinglogs.txt`,
                                            "start cmd": process.argv.join(` `),
                                        };
                                        var notesMenu = [
                                            {
                                                name: `back`,
                                                color: `#00FFFF`,
                                                run: () => {
                                                    selectedMenu = debugMenu;
                                                    selected = getOptionIndex(self.name);
                                                }
                                            },
                                        ];
                                        Object.keys(notes).forEach(key => {
                                            var val = notes[key];
                                            notesMenu.push(
                                                {
                                                    name: `${key}:`,
                                                }
                                            );
                                            notesMenu.push(
                                                {
                                                    name: `${val}`,
                                                }
                                            );
                                        });
                                        selectedMenu = notesMenu;
                                        selected = 0;
                                    },
                                },
                                {
                                    name: `vars`,
                                    color: `#ff00ff`,
                                    run: (self) => {
                                        var vars = {
                                            "dirname": `${__dirname}/`,
                                            "filename": PATH.basename(__filename),
                                            "Project path": ProjectPath,
                                            "Platform": platform,
                                        };
                                        var loggables = {
                                            "config": config,
                                        };
                                        var varsMenu = [
                                            {
                                                name: `back`,
                                                color: `#00FFFF`,
                                                run: () => {
                                                    selectedMenu = debugMenu;
                                                    selected = getOptionIndex(self.name);
                                                }
                                            },
                                        ];
                                        Object.keys(vars).forEach(key => {
                                            var val = vars[key];
                                            varsMenu.push(
                                                {
                                                    name: `${key}:`,
                                                }
                                            );
                                            varsMenu.push(
                                                {
                                                    name: `${val}`,
                                                }
                                            );
                                        });
                                        Object.keys(loggables).forEach(key => {
                                            var val = loggables[key];
                                            varsMenu.push(
                                                {
                                                    name: key,
                                                    run: () => consolelog(val),
                                                }
                                            );
                                        });
                                        selectedMenu = varsMenu;
                                        selected = 0;
                                    },
                                },
                                {
                                    name: `dump config`,
                                    color: `#ffffff`,
                                    run: async (self) => {
                                        consolelog(config);
                                    }
                                },
                                {
                                    name: `os`,
                                    color: `#ffffff`,
                                    run: async (self) => {
                                        consolelog({
                                            type: os.type(),
                                            machine: os.machine(),
                                            arch: os.arch(),
                                            name: os.hostname(),
                                            arch: os.arch(),
                                            release: os.release(),
                                            version: os.version(),
                                            user: os.userInfo(),
                                        });
                                    }
                                },
                                {
                                    name: `echo`,
                                    color: `#ffffff`,
                                    run: async (self) => {
                                        let echo = await getInput(`echo:`);
                                        consolelog(`${echo} (${echo.length})`);
                                    }
                                },
                                {
                                    name: `wipe local mods`,
                                    color: `#ffffff`,
                                    run: async (self) => {
                                        searchDir(`${config.drg}/FSD/Mods`, `.pak`, false).forEach(x => {
                                            consolelog(PATH.basename(x));
                                            if (x.replace(PATH.basename(x), ``).endsWith(`/${PATH.basename(x).split(`.`)[0]}/`))
                                                fs.rmSync(x, { recursive: true, force: true });
                                        });
                                        consolelog(`Cleared`);
                                    }
                                },

                                {
                                    name: `update modio cache`,
                                    color: `#ffffff`,
                                    run: () => updateCache(),
                                },
                                {
                                    name: `explore`,
                                    color: `#ffffff`,
                                    run: async (self) => {
                                        let folders = [
                                            config.drg,
                                            `${config.drg}/FSD/Mods`,
                                            `${config.drg}/FSD/Saved/SaveGames/Mods`,
                                            __dirname,
                                            config.ProjectFile,
                                            `${config.modio.cache}metadata`,
                                            `/home/${username}/.local/share/applications/`,
                                        ];
                                        let exploreMenu = [
                                            {
                                                name: `back`,
                                                color: `#00FFFF`,
                                                run: () => {
                                                    selectedMenu = debugMenu;
                                                    selected = getOptionIndex(self.name);
                                                }
                                            },
                                        ];
                                        folders.forEach(x => {
                                            var key = PATH.basename(x)
                                            let val = x;
                                            exploreMenu.push({
                                                name: key,
                                                run: () => {
                                                    if (!fs.existsSync(val)) return consolelog(`Folder dosent exist\n${val}`);
                                                    let log = consolelog(`Opening explorer..`);
                                                    openExplorer(val, err => {
                                                        if (err) return consolelog(`Failed to open explorer ${err}`, undefined, undefined, undefined, log)
                                                        consolelog(`Opened explorer`, undefined, undefined, undefined, log);
                                                    });
                                                }
                                            });
                                        });
                                        selectedMenu = exploreMenu;
                                        selected = 0;
                                    }
                                },
                            ];
                            selectedMenu = debugMenu;
                            selected = 0;
                        },
                        //shown: () => !process.pkg,
                    },
                ];
                selectedMenu = miscMenu;
                selected = 0;
            },
        },
        {
            name: `quit`,
            color: `#ff0000`,
            run: () => exitHandler(true),
        },
    ];
    const summonMenu = [
        {
            name: `Summon project`,
            color: `#ffffff`,
            run: async () => {
                let log = consolelog(`Making compiler location..`);
                fs.mkdirsSync(`${__dirname}/${config.ProjectName}/${capitalize(package.name)}`);
                consolelog(`Moving ${capitalize(package.name)}..`, undefined, undefined, undefined, log);
                fs.moveSync(__filename, `${__dirname}/${config.ProjectName}/${capitalize(package.name)}/${PATH.basename(__filename)}`);
                consolelog(`Summoning project..`, undefined, undefined, undefined, log);
                await updateProject();
                if (fs.existsSync(cachePath))
                    fs.rmSync(cachePath, { recursive: true, force: true });
                consolelog(`Project summoned! Find me in\n${config.ProjectName}/${capitalize(package.name)}/${PATH.basename(__filename)}`, undefined, undefined, undefined, log);
                exitHandler();
            },
        },
        {
            name: `Install epic`,
            color: `#ffffff`,
            run: async () => {
                let log = consolelog(`Downloading epic launcher installer..`);
                switch (platform) {
                    case `win`:
                        function downloadW(url, filePath) {
                            return new Promise(async r => {
                                https.get(url, async down => {
                                    if (down.headers.location) return r(await download(down.headers.location, filePath)); // github redirects to their cdn, and https dosent know redirects :\
                                    let f = `${__dirname}/installer.msi`;
                                    var file = fs.createWriteStream(f);
                                    consolelog(`Downloading installer`, undefined, undefined, undefined, log);
                                    down.pipe(file
                                        .on(`finish`, async () => {
                                            file.close();
                                            consolelog(`Downloaded installer, launching`, undefined, undefined, undefined, log);
                                            child.execFile(f)
                                                .on(`spawn`, () => {
                                                    consolelog(`Unreal Engien > Libary > Engine Version + > Select engine version ${chalk.bold(`4.27`)} and install :)`, undefined, undefined, undefined, log);
                                                })
                                                .on(`exit`, () => {
                                                    consolelog(`Exited`, undefined, undefined, undefined, log);
                                                });
                                        }))
                                });
                            })
                        }
                        await downloadW(`https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/installer/download/EpicGamesLauncherInstaller.msi`);
                        break;
                    case `linux`:
                    case `linuxwine`:
                        // I could install the install script from lutris and use that but this is nicer
                        // https://lutris.net/downloads > https://github.com/lutris/lutris/releases (ubuntu)
                        consolelog(`Downloading lutris...`, undefined, undefined, undefined, log);

                        var resp = await getJson({
                            hostname: 'api.github.com',
                            port: 443,
                            path: `/repos/${`lutris/lutris`}/releases/latest`,
                            method: 'GET',
                            headers: {
                                'User-Agent': `${capitalize(package.name)}/${ver}`,
                            },
                        });
                        const asset = resp.assets.find(x => x.name.includes(`.deb`));
                        download(asset.browser_download_url);
                        function download(url) {
                            https.get(url, down => {
                                if (down.headers.location) return download(down.headers.location); // github redirects to their cdn, and https dosent know redirects :\
                                const tempFile = `${filePath}-${new Date().getTime()}`;
                                fs.renameSync(filePath, tempFile);
                                var file = fs.createWriteStream(filePath);

                                var size = parseInt(down.headers['content-length']);
                                var downloaded = 0;
                                down
                                    .on(`data`, d => {
                                        downloaded += d.length;
                                        consolelog(`Downloading update... ${chalk.cyan((downloaded / size * 100).toFixed(2))}%`, undefined, undefined, undefined, log);
                                    })
                                    .pipe(file
                                        .on(`finish`, async () => {
                                            file.close();
                                            consolelog(`Downloaded, directing to epic games store page. Install that.`, undefined, undefined, undefined, log);

                                            await open(`lutris:epic-games-store-standard`);
                                        }))
                            });
                        }
                        break;
                }
            },
        }
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
                            if (!run) return consolelog(chalk.redBright(`Invalid function "${runName}" in "${x.name}" (index:${index}).\nCheck the readme for a list of commands\nhttps://github.com/MrCreaper/dakedo#Shortcut-functions`));
                            await run();
                        }
                        r();
                    }
                });
            },
        };
        mainMenu.splice(index, 0, shortcut);
    });
    var selectedMenu = fs.existsSync(`${__dirname}${config.ProjectFile}`) ? mainMenu : summonMenu;

    var isGettingInput = false;
    var inputNumbersOnly = false;
    var inputCache = ``;
    var inputCacheOriginal = ``;
    var inputTitle = ``;
    var inputReturnAt = -1;
    function getInput(title = ``, numOnly = false, returnAt = -1, value = ``) {
        return new Promise(r => {
            inputTitle = title;
            inputNumbersOnly = numOnly;
            inputReturnAt = returnAt;
            inputCache = value;
            inputCacheOriginal = value;
            isGettingInput = r;
        });
    }
    function inputDone(unChange = false) {
        isGettingInput(unChange ? inputCacheOriginal : inputCache);
        inputCache = ``;
        isGettingInput = false;
        draw();
    }

    /////////////////////////// Snakee <3

    var snakeRunning = false;
    process.stdin.on('keypress', (chunk, key) => {
        if (!snakeRunning) return;
        var k = key.name || key.sequence;
        snakeBoosted = key.shift;
        switch (key.name) {
            case `space`:
                endSnake();
                break;
            case `w`:
            case `up`:
                snakeInputQueue.push(`up`);
                break;
            case `s`:
            case `down`:
                snakeInputQueue.push(`down`);
                break;
            case `a`:
            case `left`:
                snakeInputQueue.push(`left`);
                break;
            case `d`:
            case `right`:
                snakeInputQueue.push(`right`);
                break;
        }
    });

    function startSnake() {
        snakeState = [{
            type: `head`,
            x: Math.floor(process.stdout.columns / 2),
            y: Math.floor(process.stdout.rows / 2),
        }];
        snakeRunning = true;
        drawSnake()
    }

    function endSnake() {
        snakeRunning = false;
        draw();
    }

    var snakeInputQueue = [];
    var snakeState = [];
    var snakeFacing = `up`;
    function addApple() {
        var x = Math.floor(Math.random() * process.stdout.columns);
        var y = Math.floor(Math.random() * process.stdout.rows);
        if (snakeState.concat(lastHeadCords).find(z => z.x == x && z.y == y)) return addApple();
        snakeState.push({
            type: `apple`,
            x: x,
            y: y,
        });
    }
    var lastHeadCords = [];
    var snakeScore = 0;
    var snakeUpdateInterval = 100;
    var snakeBoosted = false;
    function drawSnake() {
        console.clear();
        if (!snakeRunning) return;
        else
            setTimeout(() => {
                drawSnake();
            }, snakeBoosted ? 50 : snakeUpdateInterval);

        if (!snakeState.find(x => x.type == `apple`))
            addApple();

        if (snakeInputQueue.length > 0)
            snakeFacing = snakeInputQueue.shift();

        var headI = snakeState.findIndex(x => x.type == `head`);
        var appleI = snakeState.findIndex(x => x.type == `apple`);
        if (snakeScore)
            lastHeadCords.push({
                x: snakeState[headI].x,
                y: snakeState[headI].y,
            });
        lastHeadCords = lastHeadCords.slice(-snakeScore);
        lastHeadCords.forEach(c => {
            process.stdout.cursorTo(c.x, c.y); // x=left/right y=up/down
            process.stdout.write(chalk.whiteBright(`???`));
        });

        snakeState.forEach(s => {
            process.stdout.cursorTo(s.x, s.y); // x=left/right y=up/down
            switch (s.type) {
                case `apple`:
                    process.stdout.write(chalk.redBright(`???`));
                    break;
                case `head`:
                    process.stdout.write(chalk.cyanBright(`???`));
                    break;
            }
        });

        switch (snakeFacing) {
            case `up`:
                snakeState[headI].y--;
                break;
            case `down`:
                snakeState[headI].y++;
                break;
            case `right`:
                snakeState[headI].x++;
                break;
            case `left`:
                snakeState[headI].x--;
                break;
        }
        if (snakeState[headI].x == snakeState[appleI].x && snakeState[headI].y == snakeState[appleI].y) {
            snakeState.splice(appleI, 1);
            addApple();
            snakeScore++;
        }

        snakeState.forEach((x, i) => {
            if (x.x == -1) x.x = process.stdout.columns - 1;
            if (x.x == process.stdout.columns) x.x = 0;

            if (x.y == -1) x.y = process.stdout.rows - 1;
            if (x.y == process.stdout.rows) x.y = 0;

            x.x = Math.min(Math.max(x.x, 0), process.stdout.columns);
            x.y = Math.min(Math.max(x.y, 0), process.stdout.rows);
        });

        process.stdout.cursorTo(0, 0); // x=left/right y=up/down
    }

    ////////////////////////////

    var selected = 0;
    var logPush = 0;
    var logMode = false;
    if (config.ui.enabled && process.argv.length == 2) {
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) process.stdin.setRawMode(true);
        var lastPressKey = ``;
        var lastPressDate = 0;
        var selecting = false;
        var selectedOption;// = selectedMenu[selected];
        process.stdin.on('keypress', (chunk, key) => {
            var k = key.name || key.sequence;
            const doublePress = lastPressKey == k && new Date() - lastPressDate < 1000;
            lastPressKey = k;
            lastPressDate = new Date();
            selectedMenu = selectedMenu.filter(x => x.shown ? dyn(x.shown) : true);
            //consolelog(key);
            //consolelog(k);
            if (isGettingInput) {
                if (key.ctrl && key.name == `c`) return inputDone(true);
                // return cant be "shifted"
                if ((key.name == `return` && !key.shift) || (inputReturnAt != -1 && inputCache.length >= inputReturnAt)) return inputDone();
                if (key.name == `backspace`) {
                    inputCache = inputCache.slice(0, inputCache.length - 1);
                    return draw();
                }
                if (inputNumbersOnly && isNaN(key.sequence)) return;
                if (!/^[ -~]+$/.test(key.sequence)) return;
                inputCache += key.sequence;
                return draw();
            }
            if (snakeRunning) {
                if (key.ctrl && key.name == `c`) return endSnake();
                return draw();
            }
            var back = selectedMenu.find(x => removeColor(dyn(x.name, x)) == `back`);
            if (key.name == `backspace`) {
                if (back)
                    back.run(back);
                else
                    selected = 0;
                return draw();
            }
            if (selectedOption && selectedOption.key)
                selectedOption.key(k, selectedOption);
            switch (k) {
                case `w`:
                case `up`:
                    if (logMode) return;
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
                    if (logMode) return;
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
                    if (fittedLogs.length > Math.abs(logPush - 1))
                        logPush--;
                    break;
                case `d`:
                case `right`: // up +
                    if (logPush + 1 <= 0)
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
                    return exitHandler(true);
                case `C`: // for butter/fat fingers
                case `c`:
                    if (key.ctrl)
                        return process.exit();
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
            fittedLogs = formatLogs(logHistory);
            if (fittedLogs.length + logPush > process.stdout.rows) // start pushing down only when the logs go off screen
                logPush -= fittedLogs.length - lastFittedLogsLength;
            if (-logPush > fittedLogs.length) // scroll backup (+) if cleared
                logPush = fittedLogs.length;
            if (logPush > 0) logPush = -logPush;
            lastFittedLogsLength = fittedLogs.length;
            draw();
        });
        process.stdout.on(`resize`, () => {
            //if (snakeRunning) return drawSnake();
            draw();
        });
        function draw(clean = false, options = selectedMenu) {
            console.clear();

            // bg logs
            filterOffScreenLogs(fittedLogs, logPush).forEach((x, i) => {
                process.stdout.cursorTo(0, i);
                process.stdout.write(String(x));
            });

            if (isGettingInput) {
                var Y = Math.floor(process.stdout.rows * .5);

                process.stdout.cursorTo(Math.floor(process.stdout.columns * .5 - Math.floor(removeColor(inputTitle).length * .5)), Y - 1); // x=left/right y=up/down
                process.stdout.write(inputTitle);
                process.stdout.cursorTo(Math.floor(process.stdout.columns * .5 - inputCache.length * .5), Y); // x=left/right y=up/down
                process.stdout.write(inputCache);
                return;
            }

            if (!logMode) {
                // options
                // filter hidden
                options = options.filter(x => x.shown ? dyn(x.shown) : true);

                var longestOption = 0;
                options.forEach(x => {
                    var l = removeColor(dyn(x.name, x)).length;
                    if (longestOption < l) longestOption = l;
                });

                function limitOptionsList(options = [], selected = 0, limit = process.stdout.rows || 5) {
                    var s = Math.max(0, Math.floor(selected - limit * .5)); // get the Start of the options
                    var e = Math.floor(selected + limit * .5); // get the End of the options
                    e += limit - options.slice(s, e).length; // add the missing options in the end at the start
                    s -= limit - options.slice(s, e).length; // add the missing options at the start at the end
                    s = Math.max(0, s); // limit start so it dosent loop to negative
                    return {
                        opts: options.slice(s, e), // if it works, it works
                        push: -s,
                    };
                }

                var limit = limitOptionsList(options, selected);
                options = limit.opts;
                var Selected = selected + limit.push;

                // selection arrows values
                var y = Math.floor(process.stdout.rows * .5 - options.length * .5) + Selected;
                var left = Math.floor(process.stdout.columns * .5 - longestOption * .5) - 2 + (selecting ? +1 : 0);
                var right = Math.floor(process.stdout.columns * .5 + longestOption * .5) + 1 + (selecting ? -1 : 0);

                if (config.ui.cleanSelected) {
                    process.stdout.cursorTo(left, y);
                    process.stdout.write(new Array(right - left + 1).join(` `));
                }

                options.forEach((x, i) => {
                    var name = dyn(x.name, x);
                    if (!name) return console.log(`No name for`, x);
                    var nameNC = removeColor(name);
                    if (Selected == i) selectedOption = x;
                    if (!config.ui.selectArrows && Selected == i)
                        var nameC = chalk.bgHex(dyn(x.color || `#808080`, x))(name);
                    else
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

                if (config.ui.selectArrows) {
                    process.stdout.cursorTo(left, y);
                    process.stdout.write(`>`);
                    process.stdout.cursorTo(right, y);
                    process.stdout.write(`<`);
                }
                if (selecting) setTimeout(() => draw(), 200);
                selecting = false;

                if (logPush) {
                    process.stdout.cursorTo(process.stdout.columns - String(logPush).length, process.stdout.rows);
                    process.stdout.write(chalk.gray(String(logPush)));
                } else if (process.pkg) {
                    var ver = `v${package.version}`;
                    process.stdout.cursorTo(process.stdout.columns - String(ver).length, process.stdout.rows);
                    process.stdout.write(chalk.gray(String(ver)));
                }
            }

            //${latestBackupSuffix} log
            //process.stdout.cursorTo(Math.floor(process.stdout.truecolumns * .5 -${latestBackupSuffix}Log.length * .5), process.stdout.rows - 2);
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
    if (!config.logging.file) {
        makeTemp();
        config.logging.file = `${tempFolder}backuplogs.txt`;
        logsDisabled = true;
    }

    // unpack from argument
    var unpackFile = process.argv.slice(2).join(` `);

    if (unpackFile.endsWith(`.pak`))
        if (!fs.existsSync(unpackFile)) {
            consolelog(`Invalid pakfile path\n${unpackFile}`);
            return exitHandler();
        } else {
            await unpack(unpackFile);
            consolelog(`Unpacked ${chalk.cyan(PATH.basename(unpackFile.replace(`.pak`, ``)))}`);
            return exitHandler();
        }

    if (config.logging.logConfig)
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

    if (config.logging.logConfig) consolelog();
    logFile(`${JSON.stringify(config, null, 4)}\n`);

    if (process.argv.includes(`-bu`)) return backup();

    if (process.argv.find(x => x.includes(`-listbu`))) { // list backups
        var backuppath = fs.readdirSync(config.backup.folder)
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

    function pack(ProjectFolder = ProjectPath) {
        return new Promise(async r => {
            logFile(`\n${config.cmds.Packing}\n\n`);

            var log = consolelog(`packing...`);
            await clearTemp();
            makeTemp();
            consolelog(`packing...`, undefined, undefined, undefined, log);
            fs.writeFileSync(`${tempFolder}Input.txt`, `"${W__dirname}/.temp/PackageInput/" "../../../FSD/"`);
            if (!fs.existsSync(`${ProjectFolder}Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`)) return r(consolelog(`Cook didnt cook anything :|`, undefined, undefined, undefined, log));
            fs.moveSync(`${ProjectFolder}Saved/Cooked/WindowsNoEditor/${config.ProjectName}/Content/`, `${tempFolder}PackageInput/Content/`, { overwrite: true });
            const assetRegistry = `${ProjectFolder}Saved/Cooked/WindowsNoEditor/${config.ProjectName}/AssetRegistry.bin`;
            if (!fs.existsSync(assetRegistry)) return consolelog(`FAILED TO FIND AssetRegistry.bin ${chalk.gray(assetRegistry)}`, undefined, undefined, undefined, log);
            fs.moveSync(assetRegistry, `${tempFolder}PackageInput/AssetRegistry.bin`, { overwrite: true });

            var ch = child.exec(config.cmds.Packing)
                .on('exit', async () => {
                    var d = fs.readFileSync(config.logging.file);
                    if (d.includes(`LogPakFile: Error: Failed to load `)) {
                        consolelog(`Failed to load ${d.toString().split(`\n`).find(x => x.includes(`LogPakFile: Error: Failed to load `)).replace(`LogPakFile: Error: Failed to load `, ``)}`, undefined, undefined, undefined, log);
                        return r();
                    }
                    fs.rmSync(`${config.drg}/FSD/Mods/${config.ModName}`, { recursive: true, force: true });
                    fs.mkdirSync(`${config.drg}/FSD/Mods/${config.ModName}`);
                    if (!fs.existsSync(`${tempFolder}${config.ModName}.pak`)) {
                        var wrongCook = fs.readdirSync(tempFolder).find(x => x.endsWith(`.pak`));
                        consolelog(`Failed to cook correct project :)\nYour command:\n${config.cmds.Packing.replace(wrongCook, chalk.red(wrongCook))}`, undefined, undefined, undefined, log);
                        return r();
                    }
                    fs.renameSync(`${tempFolder}${config.ModName}.pak`, `${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
                    cleanLogs();
                    consolelog(`Packed!`, undefined, undefined, undefined, log);

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

                    if (config.modio.onCompile)
                        publish();
                    else
                        if (config.modio.modid)
                            updateCache();
                    if (config.backup.onCompile) backup();
                    if (config.startDRG) startDrg();

                    consolelog(`Done in ${chalk.cyan(since(new Date() - startTime))}!`);
                    r();
                }).stdout.on('data', (d) => logFile(String(d)));
            children.push(ch);
        });
    }
    if (process.argv.includes(`-unpackdrg`)) {
        consolelog(`Unpacking ${chalk.cyan(PATH.basename(path).replace(`.pak`, ``))}`);
        await unpack(`${config.drg}/FSD/Content/Paks/FSD-WindowsNoEditor.pak`);
        consolelog(`Unpacked!`);
        return;
    }
    if (process.argv.includes(`-extract`)) return extract();
    if (process.argv.includes(`-extractFlat`)) return extract(undefined, undefined, `${__dirname}/flat/`);

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
    /*if (fs.existsSync(`${ProjectPath}Saved/Cooked/WindowsNoEditor`) && !fs.accessSync(`${ProjectPath}Saved/Cooked/WindowsNoEditor`, fs.constants.W_OK | fs.constants.R_OK)) {
        consolelog(`\nNo access to /Saved/Cooked/WindowsNoEditor`);
        if (platform == `linux`) consolelog(`Please run:\nchmod 7777 -R ${ProjectPath}Saved/Cooked/WindowsNoEditor`);
        //return exitHandler();
        //fs.chmodSync(`${ProjectPath}Saved/Cooked/WindowsNoEditor`,0777); // no access means no access, idiot
    }

    if (fs.existsSync(`${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`) && !fs.accessSync(`${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`, fs.constants.W_OK | fs.constants.R_OK)) {
        consolelog(`\nNo access to ${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
        if (platform == `linux`) consolelog(`Please run:\nchmod 7777 -R ${config.drg}/FSD/Mods/${config.ModName}/${config.ModName}.pak`);
        //return exitHandler();
        //fs.chmodSync(`${ProjectPath}Saved/Cooked/WindowsNoEditor`,0777); // no access means no access, idiot
    }*/

    if (config.startDRG && config.killDRG) // kill drg and before cooking to save ram
        await killDrg();

    function cleanLogs() {
        var d = fs.readFileSync(config.logging.file, `utf8`);
        var c = config.logging.cleaning;
        if (c.misc) {
            d = d.replace(/\\/g, `/`)
                .replace(/\[AssetLog\] /g, ``)
                .replace(/\.\.\//g, ``)
                .replace(/ The asset will be loaded but may be incompatible./g, ``)
                .replace(new RegExp(`${`Z:${ProjectPath}`}`, `g`), ``)
                .replace(/::Serialize| Loading: Property/g, ``)
                .replace(/Display: /g, ``)
        }
        if (c.removeWarnings)
            d = d
                .split(`\n`)
                .filter(x => {
                    return !x.includes(`Warning: `); // keep?
                })
                .join(`\n`);
        if (c.removeMismatches)
            d = d
                .split(`\n`)
                .filter(x => {
                    return !x.includes(`Mismatch size for type `); // keep?
                })
                .join(`\n`);
        const miscPrefixes = [
            `LogAssetRegistry: `,
            `LogCookCommandlet: `,
            `LogCook: `,
            `LogShaderLibrary: `,
            `LogAutomationTest: `,
            `LogLinker: `,
            `LogUObjectGlobals: `,
            `LogTargetPlatformManager: `,
            `LogShaders: `,
            `LogVSAccessor: `,
            `LogContentStreaming: `,
            `LogShaderCompilers: `,
            `LogAssetRegistryGenerator: `,
            `LogBlueprintCodeGen: `,
            `LogProperty: `,
            `LogAudioCaptureCore: `,
            `LogSteamShared: `,
            `LogDerivedDataCache: `,
            `LogHttp: `,
            `LogClass: `,
            `LogBlueprint: `,
            `LogWindows: `,
            `LogAudioDebug: `,
            `LogTextureFormatOodle: `,
            // thees look weird if just prefix is on
            `Considered: `,
            `File Hash missmatch: `,
            `Packages Kept: `,
            `Missing Cooked Info`,
        ];
        const allPrefixes = [
            `LogInit: `,
            `LogPython: `,
            `LogPakFile: `,
        ].concat(miscPrefixes);
        if (c.removeOther)
            d = d
                .split(`\n`)
                .filter(x => {
                    return x == x // keep?
                        // remove if includes thees
                        .replace(new RegExp(`${miscPrefixes.join(`|`)}`, `g`), ``)
                        || x.includes(`Error: `);
                })
                .join(`\n`);
        if (c.prefixes)
            d = d
                .replace(new RegExp(`${allPrefixes.join(`|`)}`, `g`), ``)
        fs.writeFileSync(config.logging.file, d);
        return d;
    }

    cook();
    var startTime = new Date();
    function cook(force = false) {
        return new Promise(r => {
            if (config.logging.cleaning.clearOnCook)
                fs.writeFileSync(config.logging.file, ``); // clear logs
            startTime = new Date();
            let cmd = config.cmds.Cooking.replace(config.ModName, config.ModName.replace(/ /g, `-`));
            refreshDirsToNeverCook(undefined, config.DirsToCook.length ? true : undefined);
            if (config.DirsToCook.length) { // copy files into a temp folder and cook that
                var isoF = `${cacheFolder}isoCham/FSD/`; // I would have this all in the "ProjectPath" but an open editor would like that I think
                fs.rmSync(isoF, { recursive: true, force: true });
                let isoLog = consolelog(`Making isolation chamber..`);
                let folders = [
                    `Plugins`,
                    `Source`,
                    `Config`,
                    `Binaries`,
                    `${config.ProjectName}.uproject`,
                ];
                var noHave = [
                    PATH.basename(config.backup.folder),
                    `compiler`,
                    `Content`,
                    `Saved`,
                    capitalize(package.name),
                ];
                //folders = fs.readdirSync(`${__dirname}${config.ProjectFile}`.replace(PATH.basename(config.ProjectFile), ``)).filter(x => !noHave.includes(x) && !x.startsWith(`.`));
                cmd = cmd.replace(`${platform.includes(`wine`) ? W__dirname : __dirname}${config.ProjectFile}`, `${isoF}${folders.find(x => x.endsWith(`.uproject`))}`);
                //folders = [];
                // update folders
                for (var i = 0; i < folders.length; i++) {
                    let f = folders[i];
                    consolelog(`Updating chamber project ${chalk.cyan(i + 1)}/${chalk.cyan(folders.length)} ${chalk.gray(f)}`, undefined, undefined, undefined, isoLog);
                    if (fs.existsSync(`${isoF}${f}`))
                        fs.rmSync(`${isoF}${f}`, { recursive: true, force: true });
                    fs.copySync(`${ProjectPath}${f}`, `${isoF}${f}`);
                }
                let isolationCount = 0;
                consolelog(`Isolating files..`, undefined, undefined, undefined, isoLog);
                for (var i = 0; i < noHave.length; i++)
                    if (fs.existsSync(`${isoF}${noHave[i]}/`))
                        fs.rmSync(`${isoF}${noHave[i]}/`, { recursive: true, force: true });
                // update /content
                //fs.rmSync(`${isoF}Content/`, { recursive: true, force: true });
                for (var i = 0; i < config.DirsToCook.length; i++) {
                    let x = `${config.DirsToCook[i]}`;
                    consolelog(`Isolating ${chalk.cyan(isolationCount)}/${chalk.cyan(config.DirsToCook.length)} ${chalk.gray(x)} ...`, undefined, undefined, undefined, isoLog);
                    try {
                        if (!fs.existsSync(`${ProjectPath}/Content/${x}`)) {
                            let f = fs.readdirSync(PATH.dirname(`${ProjectPath}/Content/${x}`))
                                //.filter(x => x.endsWith(`.uasset`))
                                .find(y => y.startsWith(PATH.basename(x)));
                            if (!f) return consolelog(`File dosent exist\n${x}`);
                            x = `${PATH.dirname(x)}/${f}`;
                        }
                        if (fs.existsSync(`${isoF}Content/${x}`))
                            fs.rmSync(`${isoF}Content/${x}`, { recursive: true, force: true });
                        fs.copySync(`${ProjectPath}/Content/${x}`, `${isoF}Content/${x}`);
                        isolationCount++;
                        consolelog(`Isolated ${chalk.cyan(isolationCount)}/${chalk.cyan(config.DirsToCook.length)} ${chalk.gray(x)}`, undefined, undefined, undefined, isoLog);
                    } catch (e) {
                        consolelog(`Isolation failed ${chalk.redBright(x)}`);
                    }
                }
                consolelog(`Isolated ${chalk.cyan(isolationCount)}/${chalk.cyan(config.DirsToCook.length)}`, undefined, undefined, undefined, isoLog);
            }
            consolelog(`Processing ${chalk.cyan(config.ModName)}`);
            var log = consolelog(`cooking...`);
            logFile(`\n${cmd}\n\n`);
            killDrg();
            var ch = child.exec(cmd);
            ch.on('exit', async () => {
                var d = cleanLogs();
                if (d.includes(`Success - 0 error(s),`) || force || config.forceCookByDefault) {
                    consolelog(chalk.greenBright(`Cooked!${!d.includes(`Success - 0 error(s),`) && (force || config.forceCookByDefault) ? ` ;)` : ``}`), undefined, undefined, undefined, log);
                    await pack(isoF ? isoF : undefined);
                    r();
                } else if (d.includes(`Failure - `)) {
                    var errs = 0;
                    var errorsLogs = ``;
                    var restart = false; // reason
                    try {
                        d.split(`Warning/Error Summary (Unique only)`)[1].split(`\n`).forEach(x => {
                            if (!x.includes(`Error: `)) return;
                            if (x.includes(`Mismatch size for type `)) restart = `Mismatch size, dissapears with recook`;
                            errs++;
                            var log = x
                                .replace(new RegExp(`Z:`, 'g'), ``)
                                .replace(new RegExp(W__dirname.replace(`/compiler/`, ``).replace(`\\compiler\\`, ``), 'g'), ``)
                                //.replace("\\LogInit: Display: .*?\\ Error: ",``) // replace everything between ...
                                .replace(/FStructProperty::Serialize Loading: Property /g, ``)
                                .replace(/StructProperty /g, ``)
                                .replace(/\/Game/g, ``) // file path start
                                .replace(/_C:/g, ` > `) // after file
                                .replace(/:CallFunc_/g, ` > ${chalk.blue(`(function)`)} `)
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
                        });
                    } catch (err) {
                        logFile(`BEAUTY ERROR:`);
                        logFile(err);
                        //errorsLogs += `${x}\n`;
                    }
                    consolelog(`Errors ${chalk.redBright(errs)}:\n\n${errorsLogs}`, undefined, undefined, undefined, log);
                    if (logsDisabled) {
                        consolelog(`${chalk.red(`Failed`)}y. Check the logs and-... oh wait, you disabled logs. Lucky for you, I make backups.`);
                        fs.renameSync(config.logging.file, `${__dirname}/logs.txt`);
                        return r();
                    }
                    consolelog(`${errs != 0 && errorsLogs.length != 0 ? `\n` : ``}${chalk.redBright(`Failed`)}. ${restart == false ? `Check the logs${errorsLogs.length != 0 ? ` (or check the above)` : ``} and fix your damn "code"` : `Recooking couse ${restart}`}`);
                    if (restart && !force) return r(await cook());
                    return r();
                } else {
                    consolelog(`Something went very wrong cooking..?`, undefined, undefined, undefined, log);
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