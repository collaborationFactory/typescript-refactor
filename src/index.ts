import Refactor from "./refactor";
const fs = require('fs');

function refactor(dataByLine: Array<string>) {
    var totalLines = dataByLine.length;
    let candidate = false;
    if (totalLines > 0 && dataByLine[0].indexOf('///') !== 0) {
        return dataByLine;
    }

    let refactored: Array<string> = [];


    for (let i = 1; i < totalLines; i++) {
        let line = dataByLine[i];

        if (!isTSDirective(line)
            && !isModuleDef(line)
            && !isStrict(line)) {
            refactored[i] = line;
        } else {
            console.log('removed line', line);
        }
    }

    return refactored;
}

function isTSDirective(line: string) {
    return line.indexOf('///') === 0;
}

function isModuleDef(line: string) {
    return line.indexOf('module ') === 0;
}

function isStrict(line: string) {
    let re = /\s*[\'\"]use strict[\'\"];/;
    return line
        .trim()
        .match(re);
}

function traverseDirectory(dir: string) {
    console.log('traversing directory', dir);
    fs.readdir(dir, (err, list) => {
        if (err) {
            console.log(err);
            return;
        }
        let dirname = fs.realpathSync(dir);
        var totalItems = list.length;

        list.forEach((file) => {
            let filePath = dirname + '/' + file;
            fs.stat(filePath, (err, stat) => {
                if (stat && stat.isDirectory()) {
                    traverseDirectory(filePath)
                } else {
                    let extPos = file.length - 3;
                    let idx = file.lastIndexOf('.ts', extPos);
                    if (idx != -1 && idx === extPos) {
                        let refactor = new Refactor(filePath);
                    }
                }
            });
        });
    });
}


(function () {
    let argv = process.argv;
    // let path = argv[2] + '/ts';
    let path = '/Users/pragatisureka/Desktop/SearchCtrl.ts';
    new Refactor(path);

    // traverseDirectory(path);
})();


