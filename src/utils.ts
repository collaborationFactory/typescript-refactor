import * as ts from 'typescript';

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
    return { pos, end };
}

export function removeQuotes(value: string) {
    if(value.startsWith('"') || value.startsWith("'")) {
        return value.substring(1, value.length - 2);
    }
    return value
}