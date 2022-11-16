const exe = require('@angablue/exe');
const pkg = require(`./package.json`);

require(`fs-extra`).rmSync(`./${pkg.main.split(`.`)[0]}-win.exe`);
const build = exe({
    entry: `./${pkg.main}`,
    out: `./${pkg.main.split(`.`)[0]}-win.exe`,
    pkg: ['-C', 'GZip'], // Specify extra pkg arguments
    version: pkg.version,
    target: 'latest-win-x64',
    icon: './creaper.ico', // Application icons must be in .ico format (save as png, rename to ico)
    properties: {
        FileDescription: pkg.description,
        ProductName: 'Compiler',
        LegalCopyright: 'Mr.Creaper https://github.com/MrCreaper/drg-modding-compiler/blob/master/LICENSE',
        OriginalFilename: 'Compiler.exe'
    }
});

build.then(() => console.log('Build completed!'));