const ideas = JSON.parse(localStorage.getItem('contentIdeas')) || [];

function saveIdeas() {
    localStorage.setItem('contentIdeas', JSON.stringify(ideas));
    render();
}

function render() {
    ['ideas', 'drafts', 'scheduled', 'posted'].forEach(status => {
        const list = document.getElementById(`list-${status}`);
        list.innerHTML = '';
        ideas.filter(i => i.status === status).forEach(idea => {
            const el = document.createElement('div');
            el.className = 'card';
            el.draggable = true;
            el.ondragstart = (e) => e.dataTransfer.setData('text/plain', idea.id);
            el.innerHTML = `
                <span class="card-tag tag-${idea.type}">${idea.type}</span>
                ${idea.date ? `<span class="card-date">${idea.date}</span>` : ''}
                <div>${idea.title}</div>
            `;
            // Simple click to move forward for now (mobile friendly)
            el.onclick = () => advanceCard(idea.id);
            list.appendChild(el);
        });
    });
}

function advanceCard(id) {
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;
    
    const flow = ['ideas', 'drafts', 'scheduled', 'posted'];
    const idx = flow.indexOf(idea.status);
    if (idx < flow.length - 1) {
        idea.status = flow[idx + 1];
        saveIdeas();
    }
}

// Drag and Drop Logic
document.querySelectorAll('.column').forEach(col => {
    col.ondragover = (e) => e.preventDefault();
    col.ondrop = (e) => {
        e.preventDefault();
        const id = parseInt(e.dataTransfer.getData('text/plain'));
        const idea = ideas.find(i => i.id === id);
        if (idea) {
            idea.status = col.id; // column id matches status
            saveIdeas();
        }
    };
});

// Modal Logic
const modal = document.getElementById('modal');
const btn = document.getElementById('add-idea-btn');
const close = document.getElementsByClassName('close')[0];

btn.onclick = () => modal.classList.remove('hidden');
close.onclick = () => modal.classList.add('hidden');
window.onclick = (e) => { if (e.target == modal) modal.classList.add('hidden'); }

document.getElementById('content-form').onsubmit = (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value;
    const type = document.getElementById('type').value;
    const date = document.getElementById('date').value;
    const notes = document.getElementById('notes').value;

    ideas.push({
        id: Date.now(),
        title,
        type,
        date,
        notes,
        status: 'ideas'
    });

    saveIdeas();
    modal.classList.add('hidden');
    document.getElementById('content-form').reset();
};

// Init
render();
