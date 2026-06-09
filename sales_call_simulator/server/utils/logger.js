/**
 * Structured logger CommonJS adapter — aligns with shared logger standards.
 */

const ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = ENV === 'production' || ENV === 'staging';

function buildEntry(level, message, context = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    environment: ENV,
    message,
    ...context,
  };
}

function emit(level, entry) {
  if (IS_PRODUCTION) {
    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  } else {
    const ts = entry.timestamp.slice(11, 23); // HH:MM:SS.mmm
    const prefix = `[${ts}] [${level.toUpperCase().padEnd(5)}]`;
    const context = { ...entry };
    delete context.timestamp;
    delete context.level;
    delete context.environment;
    delete context.message;

    const extras = Object.keys(context).length
      ? ' ' + JSON.stringify(context)
      : '';

    const out = `${prefix} ${entry.message}${extras}\n`;
    if (level === 'error') {
      process.stderr.write(out);
    } else {
      process.stdout.write(out);
    }
  }
}

const logger = {
  debug(message, context) {
    if (!IS_PRODUCTION) {
      emit('debug', buildEntry('debug', message, context));
    }
  },
  info(message, context) {
    emit('info', buildEntry('info', message, context));
  },
  warn(message, context) {
    emit('warn', buildEntry('warn', message, context));
  },
  error(message, context) {
    emit('error', buildEntry('error', message, context));
  },
};

module.exports = logger;
