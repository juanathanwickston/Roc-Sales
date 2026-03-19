class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.status = 400;
    }
}

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        this.status = 404;
    }
}

class ExternalApiError extends Error {
    constructor(message, service) {
        super(message);
        this.name = 'ExternalApiError';
        this.status = 502;
        this.service = service;
    }
}

module.exports = { ValidationError, NotFoundError, ExternalApiError };
