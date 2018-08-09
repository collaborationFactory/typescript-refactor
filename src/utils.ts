import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as mkdirp from 'mkdirp';


export function append(to, value) {
    if (value === undefined)
        return to;
    if (to === undefined)
        return [value];
    to.push(value);
    return to;
}

export function addRange(to, from) {
    if (from === undefined)
        return to;
    for (var _i = 0, from_1 = from; _i < from_1.length; _i++) {
        var v = from_1[_i];
        to = append(to, v);
    }
    return to;
}

export function moveRangePos(range: ts.TextRange, pos: number): ts.TextRange {
    return createRange(pos, range.end);
}

export function createRange(pos: number, end: number): ts.TextRange {
    return {pos, end};
}

export function removeQuotes(value: string) {
    if (value.startsWith('"') || value.startsWith('\'')) {
        return value.substring(1, value.length - 2);
    }
    return value
}

export function applyTextChanges(text: string, changes: ts.TextChange[]) {
    let updatedText = text;

    for (let i = changes.length - 1; i >= 0; i--) {
        let change = changes[i];
        let before = updatedText.slice(0, change.span.start);
        let after = updatedText.slice(change.span.start + change.span.length);
        updatedText = before + change.newText + after;
    }

    return updatedText;
}

export function saveFile(fileName, text) {
    ensureDirExists(path.dirname(fileName));
    fs.writeFileSync(fileName, text);
}

export function ensureDirExists(path: string) {
    mkdirp.sync(path);
}

export function getRelativeImportPath() {

}


function copyFileSync(source: string, target: string) {
    let targetFile = target;
    //if target is a directory a new file with the same name will be created
    if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isDirectory()) {
            targetFile = path.join(target, path.basename(source));
        }
    }

    fs.writeFileSync(targetFile, fs.readFileSync(source));
}

export function copyFolderRecursiveSync(source: string, target: string) {
    let files = [];
    const targetFolder = path.join(target, path.basename(source));
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder);
    }

    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(function (file) {
            const curSource = path.join(source, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, targetFolder);
            } else {
                copyFileSync(curSource, targetFolder);
            }
        });
    }
}
