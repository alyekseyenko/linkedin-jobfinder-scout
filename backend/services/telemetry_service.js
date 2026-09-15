const EventEmitter = require('events');

class TelemetryService extends EventEmitter {
    constructor() {
        super();
        this.clients = new Set();
        this.heartbeatInterval = null;
        this.startHeartbeat();
    }

    startHeartbeat() {
        if (this.heartbeatInterval) return;
        this.heartbeatInterval = setInterval(() => {
            if (this.clients.size > 0) {
                const mem = process.memoryUsage();
                this.broadcast('heartbeat', {
                    timestamp: new Date().toISOString(),
                    uptimeSeconds: Math.floor(process.uptime()),
                    activeStreams: this.clients.size,
                    memoryRssMb: (mem.rss / (1024 * 1024)).toFixed(1),
                    memoryHeapUsedMb: (mem.heapUsed / (1024 * 1024)).toFixed(1)
                });
            }
        }, 10000);
    }

    handleSSE(req, res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no'
        });

        // Send immediate connection acknowledgment
        res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: new Date().toISOString() })}\n\n`);

        this.clients.add(res);
        console.log(`[TELEMETRY SSE] Client connected. Total active streams: ${this.clients.size}`);

        req.on('close', () => {
            this.clients.delete(res);
            console.log(`[TELEMETRY SSE] Client disconnected. Total active streams: ${this.clients.size}`);
        });
    }

    broadcast(event, data) {
        if (this.clients.size === 0) return;

        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const client of this.clients) {
            try {
                client.write(payload);
            } catch (err) {
                this.clients.delete(client);
            }
        }
    }

    // Helper shortcuts
    emitMcpEvent(action, details) {
        this.broadcast('mcp', { action, details, timestamp: new Date().toISOString() });
    }

    emitAiEvent(action, details) {
        this.broadcast('ai', { action, details, timestamp: new Date().toISOString() });
    }

    emitSystemEvent(action, details) {
        this.broadcast('system', { action, details, timestamp: new Date().toISOString() });
    }
}

const telemetryService = new TelemetryService();
module.exports = telemetryService;
