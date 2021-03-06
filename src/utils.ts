import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import * as ts from 'typescript/lib/tsserverlibrary';
import {Logger} from './logger';

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
    for (let i = 0, fromCopy = from; i < fromCopy.length; i++) {
        let v = fromCopy[i];
        to = append(to, v);
    }
    return to;
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

export function removeFileIfExists(...segments: string[]) {
    const filePath = path.join(...segments);
    if (fs.existsSync(filePath)) {
        if (fs.lstatSync(filePath).isDirectory()) {
            Logger.error('Cannot remove - is directory:', filePath);
            return;
        }
        fs.unlinkSync(filePath);
    }
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
