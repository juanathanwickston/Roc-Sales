const { validateUuid, validateAllowlist, validateString, validateBody } = require('../../server/lib/validators');
const { ValidationError } = require('../../server/lib/errors');

describe('validators', () => {
    describe('validateUuid', () => {
        it('accepts a valid UUID v4', () => {
            expect(() => validateUuid('550e8400-e29b-41d4-a716-446655440000', 'id')).not.toThrow();
        });

        it('rejects an invalid UUID', () => {
            expect(() => validateUuid('not-a-uuid', 'id')).toThrow(ValidationError);
        });

        it('rejects an empty string', () => {
            expect(() => validateUuid('', 'id')).toThrow(ValidationError);
        });

        it('rejects null', () => {
            expect(() => validateUuid(null, 'id')).toThrow(ValidationError);
        });

        it('rejects undefined', () => {
            expect(() => validateUuid(undefined, 'id')).toThrow(ValidationError);
        });
    });

    describe('validateAllowlist', () => {
        const allowed = ['waiting', 'active', 'ended'];

        it('accepts a value in the allowlist', () => {
            expect(() => validateAllowlist('waiting', allowed, 'status')).not.toThrow();
        });

        it('rejects a value not in the allowlist', () => {
            expect(() => validateAllowlist('invalid', allowed, 'status')).toThrow(ValidationError);
        });
    });

    describe('validateString', () => {
        it('accepts a normal string', () => {
            expect(validateString('hello', 'name')).toBe('hello');
        });

        it('trims whitespace', () => {
            expect(validateString('  hello  ', 'name')).toBe('hello');
        });

        it('rejects empty strings', () => {
            expect(() => validateString('', 'name')).toThrow(ValidationError);
        });

        it('rejects whitespace-only strings', () => {
            expect(() => validateString('   ', 'name')).toThrow(ValidationError);
        });

        it('rejects strings exceeding max length', () => {
            const long = 'a'.repeat(256);
            expect(() => validateString(long, 'name')).toThrow(ValidationError);
        });

        it('accepts strings at custom max length', () => {
            expect(validateString('abc', 'name', 3)).toBe('abc');
        });

        it('rejects non-string types', () => {
            expect(() => validateString(123, 'name')).toThrow(ValidationError);
        });
    });

    describe('validateBody', () => {
        it('validates required fields', () => {
            const schema = { name: { type: 'string', required: true } };
            expect(() => validateBody({}, schema)).toThrow(ValidationError);
        });

        it('allows optional fields to be missing', () => {
            const schema = { name: { type: 'string', required: false } };
            const result = validateBody({}, schema);
            expect(result.name).toBeUndefined();
        });

        it('validates and returns valid body', () => {
            const schema = { name: { type: 'string', required: true } };
            const result = validateBody({ name: 'test' }, schema);
            expect(result.name).toBe('test');
        });

        it('rejects non-object bodies', () => {
            expect(() => validateBody(null, {})).toThrow(ValidationError);
        });
    });
});
