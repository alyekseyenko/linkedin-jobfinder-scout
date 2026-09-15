const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'system.log');

if (!fs.existsSync(logDir)) {
    try {
        fs.mkdirSync(logDir, { recursive: true });
    } catch (e) {
        console.error('[LOGGER INIT ERROR]', e.message);
    }
}

const maxMemoryLogs = 200;
const memoryLogs = [];

function formatMessage(level, moduleName, message, data) {
    const timestamp = new Date().toISOString();
    
    // Auto-resolve active transaction Correlation ID if present
    const correlationId = data?.correlationId || global.activeCorrelationId || 'system-bootstrap';
    
    let dataStr = '';
    if (data !== undefined && data !== null) {
        if (data instanceof Error) {
            dataStr = ` | Error: ${data.message}${data.stack ? '\n' + data.stack : ''}`;
        } else if (typeof data === 'object') {
            try {
                const cleanedData = { ...data };
                delete cleanedData.correlationId; // Prevent redundancy
                dataStr = Object.keys(cleanedData).length > 0 ? ` | ${JSON.stringify(cleanedData)}` : '';
            } catch (e) {
                dataStr = ` | [Object]`;
            }
        } else {
            dataStr = ` | ${data}`;
        }
    }

    const formatted = `[${timestamp}] [${level}] [${moduleName.toUpperCase()}] [CID: ${correlationId}]: ${message}${dataStr}`;
    return { formatted, entry: { timestamp, level, module: moduleName, message, correlationId, dataStr } };
}

function writeLog(level, moduleName, message, data) {
    const { formatted, entry } = formatMessage(level, moduleName, message, data);

    // 1. Console Output
    if (level === 'ERROR') {
        console.error(formatted);
    } else if (level === 'WARN') {
        console.warn(formatted);
    } else {
        console.log(formatted);
    }

    // 2. Memory Ring Buffer
    memoryLogs.push(entry);
    if (memoryLogs.length > maxMemoryLogs) {
        memoryLogs.shift();
    }

    // 3. File Stream Append
    try {
        fs.appendFile(logFile, formatted + '\n', 'utf8', () => {});
    } catch (e) {}
}

module.exports = {
    info: (moduleName, message, data) => writeLog('INFO', moduleName, message, data),
    warn: (moduleName, message, data) => writeLog('WARN', moduleName, message, data),
    error: (moduleName, message, data) => writeLog('ERROR', moduleName, message, data),
    debug: (moduleName, message, data) => writeLog('DEBUG', moduleName, message, data),
    getRecentLogs: (limit = 50) => memoryLogs.slice(-limit)
};
