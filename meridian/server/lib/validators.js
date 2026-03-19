const { ValidationError } = require('./errors');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_MAX_LENGTH = 255;

function validateUuid(value, fieldName) {
    if (!value || typeof value !== 'string') {
        throw new ValidationError(`${fieldName} is required and must be a string`);
    }
    if (!UUID_REGEX.test(value)) {
        throw new ValidationError(`${fieldName} must be a valid UUID`);
    }
    return true;
}

function validateAllowlist(value, allowed, fieldName) {
    if (!allowed.includes(value)) {
        throw new ValidationError(`${fieldName} must be one of: ${allowed.join(', ')}`);
    }
    return true;
}

function validateString(value, fieldName, maxLength) {
    const max = maxLength || DEFAULT_MAX_LENGTH;
    if (typeof value !== 'string') {
        throw new ValidationError(`${fieldName} must be a string`);
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        throw new ValidationError(`${fieldName} must not be empty`);
    }
    if (trimmed.length > max) {
        throw new ValidationError(`${fieldName} must not exceed ${max} characters`);
    }
    return trimmed;
}

function validateBody(body, schema) {
    if (!body || typeof body !== 'object') {
        throw new ValidationError('Request body must be a JSON object');
    }
    const validated = {};
    for (const [field, rules] of Object.entries(schema)) {
        const value = body[field];
        if (value === undefined || value === null) {
            if (rules.required) {
                throw new ValidationError(`${field} is required`);
            }
            continue;
        }
        if (rules.type === 'string') {
            validated[field] = validateString(value, field, rules.maxLength);
        } else if (rules.type === 'uuid') {
            validateUuid(value, field);
            validated[field] = value;
        } else {
            validated[field] = value;
        }
    }
    return validated;
}

module.exports = { validateUuid, validateAllowlist, validateString, validateBody };
