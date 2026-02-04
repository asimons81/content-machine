const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const WORKSPACE = path.join(process.cwd());
const IDEAS_DIR = path.join(WORKSPACE, 'second-brain', 'content', 'ideas');
const QUEUE_FILE = path.join(WORKSPACE, 'tools', 'render_queue.json');
const PORT = 3001;

if (!fs.existsSync(IDEAS_DIR)) {
    fs.mkdirSync(IDEAS_DIR, { recursive: true });
}

// Helper to read render queue
function loadQueue() {
    try {
        if (fs.existsSync(QUEUE_FILE)) {
            return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        }
    } catch (e) {}
    return [];
}

// Helper to save render queue
function saveQueue(queue) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

module.exports = (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // GET /api/ideas - List all ideas
    if (req.url.includes('/api/ideas') && req.method === 'GET') {
        const files = fs.readdirSync(IDEAS_DIR).filter(f => f.endsWith('.json'));
        const ideas = files.map(f => {
            try {
                return JSON.parse(fs.readFileSync(path.join(IDEAS_DIR, f)));
            } catch (e) {
                return null;
            }
        }).filter(Boolean);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(ideas));
    }
    
    // POST /api/ideas - Create/update idea
    else if (req.url.includes('/api/ideas') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const idea = JSON.parse(body);
                if (!idea.id) idea.id = Date.now();
                const filePath = path.join(IDEAS_DIR, `idea-${idea.id}.json`);
                fs.writeFileSync(filePath, JSON.stringify(idea, null, 2));
                
                // Also create a markdown version for the Second Brain
                const mdPath = path.join(IDEAS_DIR, `idea-${idea.id}.md`);
                const mdContent = `# ${idea.title}\n\n**Type:** ${idea.type}\n**Date:** ${idea.date}\n**Status:** ${idea.status}\n\n## Notes\n${idea.notes || ''}`;
                fs.writeFileSync(mdPath, mdContent);

                // Notify Ozzy via signal file
                const signalPath = path.join(WORKSPACE, '.new_idea_signal');
                fs.writeFileSync(signalPath, `New Idea: ${idea.title}`);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, idea }));
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    }
    
    // GET /api/render/queue - Get render queue status
    else if (req.url.includes('/api/render/queue') && req.method === 'GET') {
        const queue = loadQueue();
        const pending = queue.filter(q => q.status === 'pending').length;
        const complete = queue.filter(q => q.status === 'complete').length;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            pending, 
            complete, 
            total: queue.length,
            items: queue.slice(-10) // Last 10 items
        }));
    }
    
    // POST /api/render/add - Add to render queue
    else if (req.url.includes('/api/render/add') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { idea, template = 'ReviewerUltra', priority = 1 } = JSON.parse(body);
                
                if (!idea || !idea.title) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Idea with title required' }));
                    return;
                }
                
                const queue = loadQueue();
                const item = {
                    id: Date.now().toString(),
                    idea,
                    template,
                    priority,
                    added: new Date().toISOString(),
                    status: 'pending'
                };
                
                queue.push(item);
                saveQueue(queue);
                
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, item }));
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    }
    
    // POST /api/render/process - Trigger queue processing
    else if (req.url.includes('/api/render/process') && req.method === 'POST') {
        // This triggers the Python script asynchronously
        const pythonScript = path.join(WORKSPACE, 'tools', 'auto_render.py');
        
        exec(`python3 ${pythonScript} --queue --limit 1`, { cwd: WORKSPACE }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Render error: ${error.message}`);
            }
            console.log(`Render output: ${stdout}`);
        });
        
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            message: 'Render process triggered. Check queue for status.' 
        }));
    }
    
    // GET /api/stats - Pipeline stats
    else if (req.url.includes('/api/stats') && req.method === 'GET') {
        const files = fs.readdirSync(IDEAS_DIR).filter(f => f.endsWith('.json'));
        const ideas = files.map(f => {
            try {
                return JSON.parse(fs.readFileSync(path.join(IDEAS_DIR, f)));
            } catch (e) {
                return null;
            }
        }).filter(Boolean);
        
        const stats = {
            ideas: ideas.filter(i => i.status === 'ideas').length,
            drafts: ideas.filter(i => i.status === 'drafts').length,
            scheduled: ideas.filter(i => i.status === 'scheduled').length,
            posted: ideas.filter(i => i.status === 'posted').length,
            total: ideas.length
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
    }
    
    // 404 fallback
    else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
};

if (require.main === module) {
    const http = require('http');
    const server = http.createServer(module.exports);
    server.listen(PORT, () => console.log(`🚀 API running on port ${PORT}`));
}
