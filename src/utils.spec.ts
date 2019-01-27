import {append} from "./utils";

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
