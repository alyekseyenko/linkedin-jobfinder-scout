// ============================================================
// 📚 OPENAPI 3.0 & INTERACTIVE SWAGGER UI ROUTES
// Enterprise Living API Documentation & Contract Discovery
// ============================================================

const express = require('express');
const router = express.Router();

const openApiSpec = {
    openapi: "3.0.3",
    info: {
        title: "Neural LinkedIn Bot Enterprise API",
        version: "2.0.0",
        description: "Autonomous Agentic LinkedIn Job Hunter & Neural Matching Architecture (Staff Principal 2026)",
        contact: {
            name: "Neural Scout Core Team"
        }
    },
    servers: [
        {
            url: "http://localhost:3001",
            description: "Local Node.js Development Server"
        }
    ],
    tags: [
        { name: "System & Health", description: "Diagnostics, observability, and sanity checks" },
        { name: "Session & Auth", description: "Zero-Trust credential vault and login handshakes" },
        { name: "Profile & Identity", description: "Candidate memory, CV parsing and neural DNA" },
        { name: "Jobs & CRM", description: "Job discovery, forensic matching, and application pipeline" },
        { name: "Autopilot", description: "Autonomous hunting daemon and scheduling" },
        { name: "Neural Vision", description: "Visual inspection and Stagehand automation" }
    ],
    paths: {
        "/api/health": {
            get: {
                tags: ["System & Health"],
                summary: "Health Check",
                responses: {
                    "200": {
                        description: "Service healthy",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        status: { type: "string", example: "ok" },
                                        connected: { type: "boolean" },
                                        proxyActive: { type: "boolean" }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "/api/system/sanity": {
            get: {
                tags: ["System & Health"],
                summary: "Comprehensive System Sanity Diagnostic",
                responses: {
                    "200": {
                        description: "Health status of all subsystems (DB, AI, MCP, Proxy, Queue)"
                    }
                }
            }
        },
        "/api/queue/status": {
            get: {
                tags: ["System & Health"],
                summary: "Transactional Job Queue Status",
                responses: {
                    "200": {
                        description: "Count of jobs grouped by status (pending, active, completed, failed, quarantined)"
                    }
                }
            }
        },
        "/api/config/cookie": {
            post: {
                tags: ["Session & Auth"],
                summary: "Inject LinkedIn Cookie into Zero-Trust Vault",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    cookie: { type: "string", description: "Full raw cookie string or li_at token" },
                                    li_at: { type: "string", description: "Direct li_at session cookie" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": { description: "Cookie safely encrypted in AES-256-GCM vault and engine reconnected" },
                    "422": { description: "Invalid cookie payload" }
                }
            }
        },
        "/api/jobs/import": {
            post: {
                tags: ["Jobs & CRM"],
                summary: "Import Job Opportunity",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    url: { type: "string", format: "uri" },
                                    title: { type: "string" },
                                    company: { type: "string" },
                                    description: { type: "string" },
                                    location: { type: "string" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": { description: "Job imported and ingested into market memory" },
                    "422": { description: "Schema validation failure (missing url or description)" }
                }
            }
        },
        "/api/jobs": {
            get: {
                tags: ["Jobs & CRM"],
                summary: "Search & Deep Score LinkedIn Jobs",
                parameters: [
                    { name: "keywords", in: "query", schema: { type: "string", default: "Creative Technologist" } },
                    { name: "location", in: "query", schema: { type: "string", default: "Remote" } },
                    { name: "limit", in: "query", schema: { type: "integer", default: 10 } }
                ],
                responses: {
                    "200": { description: "Ranked jobs with forensic match scores" }
                }
            }
        },
        "/api/autopilot/config": {
            post: {
                tags: ["Autopilot"],
                summary: "Configure Autonomous Hunting Frequency & Quota",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    dailyLimit: { type: "integer", minimum: 1, maximum: 10, default: 3 },
                                    intervalHours: { type: "integer", minimum: 1, maximum: 24, default: 6 },
                                    maxPages: { type: "integer", minimum: 1, maximum: 10, default: 1 }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": { description: "Autopilot configuration updated" },
                    "422": { description: "Validation failure (e.g. dailyLimit > 10)" }
                }
            }
        },
        "/api/cv/neural": {
            get: {
                tags: ["Profile & Identity"],
                summary: "Retrieve Tailored Neural Identity CV",
                responses: {
                    "200": { description: "Full synchronized candidate profile schema" }
                }
            }
        }
    }
};

// 1. JSON Specification Endpoint
router.get('/api/openapi.json', (req, res) => {
    res.json(openApiSpec);
});

// 2. Interactive Swagger UI Standalone
router.get('/api/docs', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Neural LinkedIn Bot — OpenAPI 3.0 Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #0b0f19; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .topbar { display: none !important; }
        .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .info .title { color: #0f172a; }
        .header-banner {
            padding: 16px 24px;
            background: linear-gradient(90deg, #1e1b4b, #312e81);
            color: #ffffff;
            border-bottom: 1px solid #4338ca;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .header-banner h1 { margin: 0; font-size: 1.25rem; font-weight: 700; letter-spacing: -0.025em; }
        .header-banner .badge { background: #10b981; color: #022c22; font-size: 0.75rem; font-weight: 700; padding: 4px 8px; border-radius: 9999px; }
    </style>
</head>
<body>
    <div class="header-banner">
        <div>
            <h1>🧠 Neural LinkedIn Bot — Interactive API Docs</h1>
            <small style="opacity: 0.8;">OpenAPI 3.0.3 Contract Discovery & Live Probes</small>
        </div>
        <span class="badge">Staff Principal v2.0</span>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
    window.onload = function() {
        window.ui = SwaggerUIBundle({
            url: "/api/openapi.json",
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
            ],
            layout: "BaseLayout"
        });
    };
    </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

module.exports = router;
