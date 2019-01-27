import {append, applyTextChanges} from "./utils";

describe('append handles', () => {
    test('an undefined value', () => {
        const to = [];
        const result = append(to, undefined);
        expect(result).toBe(to);
    });

    test('an undefined to', () => {
        const value = 'test';
        const result = append(undefined, value);
        expect(result).toEqual([value]);
    });
});

describe('applyTextChange', () => {
    test('ignores empty changes', () => {
        const text = 'This is a test';
        const result = applyTextChanges(text, []);
        expect(result).toBe(text);
    });

    test('handles single change', () => {
        const text = 'This is a test';
        const change: ts.TextChange = {
            newText: 'success',
            span: {
                start: 10,
                length: 4
            }
        };
        const result = applyTextChanges(text, [change]);
        expect(result).toBe('This is a success');
    })
});
