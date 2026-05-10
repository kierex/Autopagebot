// particlesJS configuration
particlesJS("particles-js", {
    particles: {
        number: { value: 55, density: { enable: true, value_area: 800 } },
        color: { value: "#667eea" },
        shape: { type: "circle" },
        opacity: { value: 0.4, random: true },
        size: { value: 2.5, random: true },
        line_linked: { enable: true, distance: 140, color: "#667eea", opacity: 0.28, width: 1 },
        move: { enable: true, speed: 1.2, direction: "none", random: false, straight: false, out_mode: "out" }
    },
    interactivity: { detect_on: "canvas", events: { onhover: { enable: true, mode: "repulse" }, onclick: { enable: true, mode: "push" } } }
});

// Theme Management
let isDarkMode = localStorage.getItem('theme') === 'dark';
function applyTheme() {
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
        document.querySelector('#themeToggleBtn i').className = 'fas fa-moon';
    } else {
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
        document.querySelector('#themeToggleBtn i').className = 'fas fa-sun';
    }
}
applyTheme();
document.getElementById('themeToggleBtn').addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    applyTheme();
});

// Sidebar Mobile Toggle
const sidebar = document.getElementById('sidebar');
document.getElementById('mobileMenuToggle').addEventListener('click', () => sidebar.classList.toggle('open'));
document.querySelectorAll('.menu-item[data-section]').forEach(item => {
    item.addEventListener('click', () => { if (window.innerWidth <= 768) sidebar.classList.remove('open'); });
});

// Navigation
document.querySelectorAll('.menu-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
        const sectionId = item.getAttribute('data-section');
        document.querySelectorAll('.menu-item[data-section]').forEach(m => m.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active-section'));
        document.getElementById(`${sectionId}-section`).classList.add('active-section');
    });
});

// Utilities
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }
function showMessage(msg, type) {
    const msgDiv = document.getElementById('message');
    msgDiv.innerHTML = msg;
    msgDiv.className = `message ${type}`;
    setTimeout(() => { msgDiv.style.display = 'none'; msgDiv.className = 'message'; }, 5000);
}
function copyToClipboardText(text) {
    navigator.clipboard.writeText(text);
    showMessage('📋 Copied!', 'success');
}
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const copyId = btn.getAttribute('data-copy');
        if (copyId) copyToClipboardText(document.getElementById(copyId).textContent);
        else copyToClipboardText(btn.getAttribute('data-copy-text'));
    });
});

// Dashboard Info
function updateDateTime() { document.getElementById('datetime').textContent = new Date().toLocaleString(); }
setInterval(updateDateTime, 1000);
updateDateTime();
if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
        const update = () => document.getElementById('battery').textContent = `${Math.round(b.level*100)}% ${b.charging ? '⚡' : '🔋'}`;
        update();
        b.addEventListener('levelchange', update);
    });
} else { document.getElementById('battery').textContent = 'Not supported'; }
fetch('https://api.ipify.org?format=json').then(r=>r.json()).then(d=>document.getElementById('ip').textContent=d.ip).catch(()=>document.getElementById('ip').textContent='unavailable');
document.getElementById('useragent').textContent = navigator.userAgent.slice(0,50)+'...';

const webhookUrl = `${window.location.origin}/webhook`;
document.getElementById('webhookUrl').textContent = webhookUrl;
document.getElementById('tutorialWebhookUrl').textContent = webhookUrl;

// Connect & Disconnect Page
const agreeCheckbox = document.getElementById('agreeTerms');
const connectBtn = document.getElementById('connectBtn');
agreeCheckbox.addEventListener('change', () => { connectBtn.disabled = !agreeCheckbox.checked; });

document.getElementById('connectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!agreeCheckbox.checked) { showMessage('Please accept Privacy Policy', 'error'); return; }
    const pageToken = document.getElementById('pageToken').value;
    if (!pageToken) { showMessage('Page token required', 'error'); return; }
    showMessage('<i class="fas fa-spinner fa-spin"></i> Connecting...', 'info');
    connectBtn.disabled = true;
    try {
        const res = await fetch('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pageToken: pageToken,
                userName: document.getElementById('userName').value,
                pageName: document.getElementById('pageName').value
            })
        });
        const data = await res.json();
        if (data.success) {
            showMessage(`✅ ${data.message}`, 'success');
            document.getElementById('pageToken').value = '';
            loadSessions();
        } else {
            showMessage(`❌ ${data.error}`, 'error');
        }
    } catch(err) { showMessage(`Failed: ${err.message}`, 'error'); }
    finally { connectBtn.disabled = false; }
});

document.getElementById('disconnectByTokenBtn').addEventListener('click', async () => {
    const pageToken = document.getElementById('pageToken').value;
    if (!pageToken) { showMessage('Please enter the Page Token to disconnect', 'error'); return; }
    showMessage('<i class="fas fa-spinner fa-spin"></i> Disconnecting...', 'info');
    try {
        const res = await fetch('/api/disconnect-by-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageToken: pageToken })
        });
        const data = await res.json();
        if (data.success) {
            showMessage(`✅ ${data.message}`, 'success');
            document.getElementById('pageToken').value = '';
            loadSessions();
        } else {
            showMessage(`❌ ${data.error}`, 'error');
        }
    } catch(err) { showMessage(`Failed: ${err.message}`, 'error'); }
});

// Sessions Loader
let sessionStartTimes = new Map();
function formatUptime(sec) {
    if(sec<0) sec=0;
    let d=Math.floor(sec/86400), h=Math.floor((sec%86400)/3600), m=Math.floor((sec%3600)/60);
    if(d>0) return `${d}d ${h}h`;
    if(h>0) return `${h}h ${m}m`;
    return `${m}m`;
}

async function loadSessions() {
    try {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        document.getElementById('menuBadgeCount').textContent = data.count;
        document.getElementById('statusActiveSessions').textContent = data.count;
        
        if (!data.sessions || data.sessions.length === 0) {
            document.getElementById('sessionsList').innerHTML = '<div class="loading"><i class="fas fa-plug"></i> No active sessions. Connect a page to get started!</div>';
            return;
        }
        data.sessions.forEach(s => { if(!sessionStartTimes.has(s.id)) sessionStartTimes.set(s.id, new Date(s.connectedAt)); });
        const now = Date.now();
        const html = data.sessions.map(s => {
            const uptimeSec = Math.floor((now - new Date(s.connectedAt).getTime())/1000);
            return `<div class="session-card">
                        <div class="session-header">
                            <span class="session-name"><i class="fas fa-rocket"></i> ${escapeHtml(s.name)}</span>
                            <span class="session-badge">● Online</span>
                        </div>
                        <div class="session-details">
                            <div><i class="fas fa-id-card"></i> ID: ${s.id}</div>
                            <div><i class="fas fa-user"></i> Owner: ${escapeHtml(s.owner || 'Unknown')}</div>
                            <div><i class="fas fa-calendar-plus"></i> Connected: ${new Date(s.connectedAt).toLocaleString()}</div>
                            <div><i class="fas fa-chart-line"></i> Uptime: <span class="uptime-value session-uptime" data-sid="${s.id}">${formatUptime(uptimeSec)}</span></div>
                            <div><i class="fab fa-facebook-messenger"></i> <a href="${s.messengerLink}" target="_blank" style="color:#667eea;">Open Messenger →</a></div>
                        </div>
                    </div>`;
        }).join('');
        document.getElementById('sessionsList').innerHTML = html;
        
        if(window.uptimeInterval) clearInterval(window.uptimeInterval);
        window.uptimeInterval = setInterval(() => {
            document.querySelectorAll('.session-uptime').forEach(el => {
                const start = sessionStartTimes.get(el.dataset.sid);
                if(start) el.textContent = formatUptime(Math.floor((Date.now() - new Date(start).getTime())/1000));
            });
        }, 1000);
    } catch(e) { console.error(e); }
}

// Commands Loader
async function loadCommands() {
    try {
        const res = await fetch('/api/commands');
        const data = await res.json();
        document.getElementById('commandsBadgeCount').textContent = data.count;
        document.getElementById('totalCommandsCount').textContent = data.count;
        if(!data.commands || data.commands.length === 0) { document.getElementById('commandsList').innerHTML = '<div class="loading">No commands</div>'; return; }
        const cats = {};
        const catNames = { system:' System', fun:' Fun', ai:' AI', tools:' Tools', others:' Others' };
        data.commands.forEach(cmd => { let c = cmd.category || 'others'; if(!cats[c]) cats[c]=[]; cats[c].push(cmd); });
        let html = '<div class="commands-container">';
        for(let [cat, cmds] of Object.entries(cats)) {
            html += `<div class="commands-category"><div class="category-header">${catNames[cat] || cat.toUpperCase()} (${cmds.length})</div><div class="commands-grid">`;
            cmds.forEach(cmd => {
                html += `<div class="command-item">
                            <div class="command-name"><i class="fas fa-hashtag"></i> ${escapeHtml(cmd.name)}</div>
                            <div class="command-usage">${escapeHtml(cmd.usage)}</div>
                            ${cmd.cooldown>0?`<div class="command-cooldown"><i class="fas fa-hourglass-half"></i> ${cmd.cooldown}s</div>`:''}
                        </div>`;
            });
            html += `</div></div>`;
        }
        html += `</div>`;
        document.getElementById('commandsList').innerHTML = html;
    } catch(e) { console.error(e); }
}

// Server Info
async function loadServerInfo() {
    try {
        const res = await fetch('/api/server/info');
        const data = await res.json();
        document.getElementById('serverUptime').textContent = formatUptime(data.uptime);
        document.getElementById('serverStartTime').textContent = new Date(data.startTime).toLocaleString();
        setInterval(async () => {
            try {
                const upt = await fetch('/api/server/uptime');
                const u = await upt.json();
                document.getElementById('serverUptime').textContent = formatUptime(u.uptime);
            } catch(e) {}
        }, 1000);
    } catch(e) {}
}

// Privacy Modal
let privacyAccepted = localStorage.getItem('privacyAccepted');
const modal = document.getElementById('privacyModal');
function acceptPrivacy() { localStorage.setItem('privacyAccepted', 'true'); modal.style.display = 'none'; showMessage('🎉 Welcome to AutoPageBot!', 'success'); }
function declinePrivacy() { localStorage.setItem('privacyAccepted', 'false'); modal.style.display = 'none'; showMessage('Accept policy to connect', 'error'); }
document.getElementById('acceptPrivacyBtn')?.addEventListener('click', acceptPrivacy);
document.getElementById('declinePrivacyBtn')?.addEventListener('click', declinePrivacy);
document.getElementById('privacyPolicyBtn')?.addEventListener('click', () => modal.style.display = 'flex');
document.getElementById('privacyLink')?.addEventListener('click', (e) => { e.preventDefault(); modal.style.display = 'flex'; });
document.getElementById('refreshBtn')?.addEventListener('click', () => location.reload());
if (!privacyAccepted) setTimeout(() => modal.style.display = 'flex', 300);

// Initialize
loadServerInfo();
loadSessions();
loadCommands();