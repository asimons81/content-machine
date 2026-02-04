const API_URL = '/api/ideas';
let ideas = [];

async function loadIdeas() {
    const statusEl = document.getElementById('sync-status');
    try {
        const res = await fetch(API_URL);
        if (res.ok) {
            ideas = await res.json();
            if (statusEl) {
                statusEl.innerText = '● Server Sync Active';
                statusEl.className = 'sync-badge sync-active';
            }
        } else {
            throw new Error();
        }
    } catch (e) {
        ideas = JSON.parse(localStorage.getItem('contentIdeas')) || [];
        if (statusEl) {
            statusEl.innerText = '○ Local Mode (Offline)';
            statusEl.className = 'sync-badge sync-offline';
        }
    }
    render();
    updateStats();
}

async function saveIdea(idea) {
    // Save locally first
    const existingIdx = ideas.findIndex(i => i.id === idea.id);
    if (existingIdx > -1) {
        ideas[existingIdx] = idea;
    } else {
        ideas.push(idea);
    }
    localStorage.setItem('contentIdeas', JSON.stringify(ideas));

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(idea)
        });
    } catch (e) {
        console.error('Failed to sync with server:', e);
    }
    render();
    updateStats();
}

function updateStats() {
    const counts = { ideas: 0, drafts: 0, scheduled: 0, posted: 0 };
    ideas.forEach(i => {
        if (counts[i.status] !== undefined) {
            counts[i.status]++;
        }
    });
    
    // Update header stats
    document.getElementById('stat-ideas').textContent = counts.ideas;
    document.getElementById('stat-drafts').textContent = counts.drafts;
    document.getElementById('stat-scheduled').textContent = counts.scheduled;
    document.getElementById('stat-posted').textContent = counts.posted;
    
    // Update column counts
    document.getElementById('count-ideas').textContent = counts.ideas > 0 ? `(${counts.ideas})` : '';
    document.getElementById('count-drafts').textContent = counts.drafts > 0 ? `(${counts.drafts})` : '';
    document.getElementById('count-scheduled').textContent = counts.scheduled > 0 ? `(${counts.scheduled})` : '';
    document.getElementById('count-posted').textContent = counts.posted > 0 ? `(${counts.posted})` : '';
}

function getScoreBadge(score) {
    if (!score || score === 0) return '';
    
    let color = '#666';
    if (score >= 500) color = '#f59e0b'; // gold
    else if (score >= 200) color = '#3b82f6'; // blue
    else if (score >= 100) color = '#22c55e'; // green
    
    return `<span class="score-badge" style="background: ${color}">${score} pts</span>`;
}

function render() {
    ['ideas', 'drafts', 'scheduled', 'posted'].forEach(status => {
        const list = document.getElementById(`list-${status}`);
        list.innerHTML = '';
        
        // Sort by score descending for ideas column
        let filteredIdeas = ideas.filter(i => i.status === status);
        if (status === 'ideas') {
            filteredIdeas.sort((a, b) => (b.score || 0) - (a.score || 0));
        }
        
        filteredIdeas.forEach(idea => {
            const el = document.createElement('div');
            el.className = 'card';
            el.draggable = true;
            el.ondragstart = (e) => e.dataTransfer.setData('text/plain', idea.id);
            
            const scoreBadge = getScoreBadge(idea.score);
            const sourceIcon = idea.source === 'hn' ? '🔶' : '';
            
            el.innerHTML = `
                <div class="card-top-row">
                    <span class="card-tag tag-${idea.type}">${idea.type}</span>
                    ${scoreBadge}
                </div>
                ${idea.date ? `<span class="card-date">${idea.date}</span>` : ''}
                <div class="card-title">${sourceIcon} ${idea.title}</div>
                <div class="card-actions">
                    <button class="card-btn" onclick="event.stopPropagation(); openInAmplify('${encodeURIComponent(idea.title)}')">⚡</button>
                    <button class="card-btn" onclick="event.stopPropagation(); showDetail(${idea.id})">👁️</button>
                    <button class="card-btn card-btn-advance" onclick="event.stopPropagation(); advanceCard(${idea.id})">→</button>
                </div>
            `;
            el.onclick = () => showDetail(idea.id);
            list.appendChild(el);
        });
    });
}

function openInAmplify(title) {
    // Open X-Amplify with the title pre-filled (via URL param if supported, otherwise just open)
    const url = `https://x-amplify.streamlit.app/`;
    window.open(url, '_blank');
    // Copy title to clipboard for easy paste
    navigator.clipboard.writeText(decodeURIComponent(title)).then(() => {
        showToast('📋 Title copied! Paste in X-Amplify');
    });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showDetail(id) {
    const idea = ideas.find(i => i.id == id);
    if (!idea) return;
    
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('detail-content');
    
    content.innerHTML = `
        <h2>${idea.title}</h2>
        <div class="detail-meta">
            <span class="card-tag tag-${idea.type}">${idea.type}</span>
            ${idea.score ? `<span class="score-badge">${idea.score} pts</span>` : ''}
            ${idea.date ? `<span class="detail-date">📅 ${idea.date}</span>` : ''}
            <span class="detail-status">Status: ${idea.status}</span>
        </div>
        ${idea.url ? `<p><a href="${idea.url}" target="_blank" class="detail-link">🔗 ${idea.url}</a></p>` : ''}
        ${idea.notes ? `<div class="detail-notes"><h3>Notes</h3><p>${idea.notes}</p></div>` : ''}
        <div class="detail-actions">
            <button onclick="openInAmplify('${encodeURIComponent(idea.title)}')" class="btn-primary">⚡ Generate Posts</button>
            <button onclick="advanceCard(${idea.id}); closeDetailModal();" class="btn-secondary">→ Move Forward</button>
            <button onclick="deleteCard(${idea.id})" class="btn-danger">🗑️ Delete</button>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function closeDetailModal() {
    document.getElementById('detail-modal').classList.add('hidden');
}

async function deleteCard(id) {
    if (!confirm('Delete this idea?')) return;
    ideas = ideas.filter(i => i.id !== id);
    localStorage.setItem('contentIdeas', JSON.stringify(ideas));
    // TODO: Add delete API endpoint
    render();
    updateStats();
    closeDetailModal();
}

function advanceCard(id) {
    const idea = ideas.find(i => i.id == id);
    if (!idea) return;
    
    const flow = ['ideas', 'drafts', 'scheduled', 'posted'];
    const idx = flow.indexOf(idea.status);
    if (idx < flow.length - 1) {
        idea.status = flow[idx + 1];
        saveIdea(idea);
    }
}

// Drag and Drop Logic
document.querySelectorAll('.column').forEach(col => {
    col.ondragover = (e) => e.preventDefault();
    col.ondrop = (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const idea = ideas.find(i => i.id == id);
        if (idea) {
            idea.status = col.id;
            saveIdea(idea);
        }
    };
});

// Modal Logic
const modal = document.getElementById('modal');
const btn = document.getElementById('add-idea-btn');
const close = document.getElementsByClassName('close')[0];

btn.onclick = () => modal.classList.remove('hidden');
close.onclick = () => modal.classList.add('hidden');
window.onclick = (e) => { 
    if (e.target == modal) modal.classList.add('hidden'); 
    if (e.target == document.getElementById('detail-modal')) closeDetailModal();
}

document.getElementById('content-form').onsubmit = (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value;
    const type = document.getElementById('type').value;
    const date = document.getElementById('date').value;
    const notes = document.getElementById('notes').value;

    const newIdea = {
        id: Date.now(),
        title,
        type,
        date,
        notes,
        status: 'ideas'
    };

    saveIdea(newIdea);
    modal.classList.add('hidden');
    document.getElementById('content-form').reset();
};

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        modal.classList.add('hidden');
        closeDetailModal();
    }
    if (e.key === 'n' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        modal.classList.remove('hidden');
        document.getElementById('title').focus();
    }
});

// Init
loadIdeas();
