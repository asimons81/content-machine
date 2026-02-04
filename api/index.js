const path = require('path');
const fs = require('fs');

const IDEAS_DIR = path.join(__dirname, '..', 'second-brain', 'content', 'ideas');
const PORT = 3001;

if (!fs.existsSync(IDEAS_DIR)) {
    fs.mkdirSync(IDEAS_DIR, { recursive: true });
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

    if (req.url.includes('/api/ideas') && req.method === 'GET') {
        const files = fs.readdirSync(IDEAS_DIR).filter(f => f.endsWith('.json'));
        const ideas = files.map(f => JSON.parse(fs.readFileSync(path.join(IDEAS_DIR, f))));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(ideas));
    } else if (req.url.includes('/api/ideas') && req.method === 'POST') {
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

                // Notify Ozzy (me) via a temporary signal file
                fs.writeFileSync(path.join(__dirname, '..', '..', '.new_idea_signal'), `New Idea: ${idea.title}`);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, idea }));
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
};
