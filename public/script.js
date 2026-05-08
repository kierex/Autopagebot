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

// ---------- THEME MANAGEMENT ----------
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
window.toggleTheme = function() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    applyTheme();
};
document.getElementById('themeToggleBtn').addEventListener('click', window.toggleTheme);

// ---------- SIDEBAR FIXED + SMOOTH TRANSITION (MOBILE TOGGLE) ----------
const sidebar = document.getElementById('sidebar');
const mobileToggle = document.getElementById('mobileMenuToggle');
window.toggleMobileMenu = function() {
    sidebar.classList.toggle('open');
};
mobileToggle.addEventListener('click', window.toggleMobileMenu);
// Close sidebar when clicking menu item on mobile
document.querySelectorAll('.menu-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
        }
    });
});
// Adjust on resize to avoid stuck transforms
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('open');
    } else {
        // ensure visibility state
    }
});

// ---------- NAVIGATION (SECTIONS) ----------
document.querySelectorAll('.menu-item[data-section]').forEach(item => {
    item.addEventListener('click', (e) => {
        const sectionId = item.getAttribute('data-section');
        document.querySelectorAll('.menu-item[data-section]').forEach(m => m.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active-section'));
        document.getElementById(`${sectionId}-section`).classList.add('active-section');
    });
});

// ---------- UTILITIES ----------
function showMessage(msg, type) {
    const msgDiv = document.getElementById('message');
    msgDiv.innerHTML = msg;
    msgDiv.className = `message ${type}`;
    setTimeout(() => { msgDiv.style.display = 'none'; msgDiv.className = 'message'; }, 5000);
}
function copyToClipboardText(text) {
    navigator.clipboard.writeText(text);
    showMessage('📋 Copied to clipboard!', 'success');
}
// copy buttons
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const copyId = btn.getAttribute('data-copy');
        if (copyId) {
            const textElem = document.getElementById(copyId);
            if (textElem) copyToClipboardText(textElem.textContent);
        } else {
            const staticText = btn.getAttribute('data-copy-text');
            if (staticText) copyToClipboardText(staticText);
        }
    });
});
function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, function(m){ if(m === '&') return '&amp;'; if(m === '<') return '&lt;'; if(m === '>') return '&gt;'; return m;}); }

// ---------- DASHBOARD INFO ----------
function updateDateTime() {
    document.getElementById('datetime').textContent = new Date().toLocaleString();
}
setInterval(updateDateTime, 1000);
updateDateTime();
if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
        const update = () => {
            document.getElementById('battery').textContent = `${Math.round(battery.level*100)}% ${battery.charging ? '⚡ Charging' : '🔋'}`;
        };
        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
    });
} else { document.getElementById('battery').textContent = 'Not supported'; }
fetch('https://api.ipify.org?format=json').then(r=>r.json()).then(d=>document.getElementById('ip').textContent=d.ip).catch(()=>document.getElementById('ip').textContent='unavailable');
document.getElementById('useragent').textContent = navigator.userAgent.slice(0,50)+'...';

// Webhook url
const webhookUrl = `${window.location.origin}/webhook`;
document.getElementById('webhookUrl').textContent = webhookUrl;
document.getElementById('tutorialWebhookUrl').textContent = webhookUrl;

// ---------- CONNECT PAGE LOGIC ----------
const agreeCheckbox = document.getElementById('agreeTerms');
const connectBtn = document.getElementById('connectBtn');
agreeCheckbox.addEventListener('change', () => { connectBtn.disabled = !agreeCheckbox.checked; });
document.getElementById('connectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!agreeCheckbox.checked) { showMessage('Please accept Privacy Policy', 'error'); return; }
    const pageToken = document.getElementById('pageToken').value;
    if (!pageToken) { showMessage('Page token required', 'error'); return; }
    const payload = {
        userName: document.getElementById('userName').value,
        pageName: document.getElementById('pageName').value,
        pageToken: pageToken
    };
    showMessage('<i class="fas fa-spinner fa-spin"></i> Connecting...', 'info');
    connectBtn.disabled = true;
    try {
        const res = await fetch(`${window.location.origin}/api/connect`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showMessage(`✅ ${data.message}`, 'success');
            document.getElementById('pageToken').value = '';
            document.getElementById('userName').value = '';
            document.getElementById('pageName').value = '';
            loadSessions();
            document.querySelector('.menu-item[data-section="sessions"]').click();
        } else {
            showMessage(`❌ ${data.error}`, 'error');
        }
    } catch(err) { showMessage(`Connection failed: ${err.message}`, 'error'); }
    finally { connectBtn.disabled = false; }
});

// ---------- SESSIONS & COMMANDS LOADER ----------
let sessionStartTimes = new Map();
let uptimeIntervalGlobal;
function formatUptime(sec) {
    if(sec<0) sec=0;
    let d=Math.floor(sec/86400), h=Math.floor((sec%86400)/3600), m=Math.floor((sec%3600)/60), s=sec%60;
    if(d>0) return `${d}d ${h}h`;
    if(h>0) return `${h}h ${m}m`;
    if(m>0) return `${m}m ${s}s`;
    return `${s}s`;
}
async function loadSessions() {
    try {
        const res = await fetch(`${window.location.origin}/api/sessions`);
        const data = await res.json();
        document.getElementById('menuBadgeCount').textContent = data.count;
        document.getElementById('statusActiveSessions').textContent = data.count;
        if (!data.sessions || data.sessions.length === 0) {
            document.getElementById('sessionsList').innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-plug"></i> No active sessions.</div>';
            return;
        }
        data.sessions.forEach(s => { if(!sessionStartTimes.has(s.id)) sessionStartTimes.set(s.id, new Date(s.connectedAt)); });
        const now = Date.now();
        const html = data.sessions.map(s => {
            const uptimeSec = Math.floor((now - new Date(s.connectedAt).getTime())/1000);
            return `<div class="session-card">
                        <div class="session-header"><span class="session-name"><i class="fas fa-rocket"></i> ${escapeHtml(s.name)}</span><span class="session-badge">● Online</span></div>
                        <div class="session-details"><div><i class="fas fa-id-card"></i> ID: ${s.id}</div>
                        <div><i class="fas fa-user"></i> Owner: ${escapeHtml(s.owner || 'Unknown')}</div>
                        <div><i class="fas fa-calendar-plus"></i> Connected: ${new Date(s.connectedAt).toLocaleString()}</div>
                        <div><i class="fas fa-chart-line"></i> Uptime: <span class="uptime-value session-uptime" data-sid="${s.id}">${formatUptime(uptimeSec)}</span></div>
                        <div><i class="fab fa-facebook-messenger"></i> <a href="${s.messengerLink}" target="_blank" style="color:#667eea;">Open Messenger →</a></div></div>
                    </div>`;
        }).join('');
        document.getElementById('sessionsList').innerHTML = html;
        if(window.uptimeIntervalSessions) clearInterval(window.uptimeIntervalSessions);
        window.uptimeIntervalSessions = setInterval(() => {
            document.querySelectorAll('.session-uptime').forEach(el => {
                const sid = el.getAttribute('data-sid');
                const start = sessionStartTimes.get(sid);
                if(start) {
                    const upt = Math.floor((Date.now() - new Date(start).getTime())/1000);
                    el.textContent = formatUptime(upt);
                }
            });
        }, 1000);
    } catch(e) { console.error(e); document.getElementById('sessionsList').innerHTML = '<div>Error loading sessions</div>'; }
}
async function loadCommands() {
    try {
        const res = await fetch(`${window.location.origin}/api/commands`);
        const data = await res.json();
        document.getElementById('commandsBadgeCount').textContent = data.count;
        if(!data.commands || data.commands.length === 0) { document.getElementById('commandsList').innerHTML = '<div>No commands</div>'; return; }
        const cats = {};
        const catNames = { ai:'🤖 AI', music:'🎧 Music', images:'🖼️ Images', search:'🔍 Search', tools:'⚒️ Tools', uploader:'📥 Uploader', system:'⚙️ System', fun:'🎮 Fun', education:'📚 Education', canvas:'🎨 Canvas', others:'🗂️ Others' };
        data.commands.forEach(cmd => { let c = cmd.category || 'others'; if(!cats[c]) cats[c]=[]; cats[c].push(cmd); });
        let html = '<div class="commands-container">';
        for(let [cat, cmds] of Object.entries(cats)) {
            html += `<div class="commands-category"><div class="category-header"><i class="fas fa-folder"></i> ${catNames[cat] || cat.toUpperCase()}</div><div class="commands-grid">`;
            cmds.forEach(cmd => {
                html += `<div class="command-item"><div class="command-name"><i class="fas fa-hashtag"></i> ${escapeHtml(cmd.name)}</div><div class="command-usage">${escapeHtml(cmd.usage)}</div>${cmd.cooldown>0?`<div class="command-cooldown"><i class="fas fa-hourglass-half"></i> Cooldown: ${cmd.cooldown}s</div>`:''}</div>`;
            });
            html += `</div></div>`;
        }
        html += `</div>`;
        document.getElementById('commandsList').innerHTML = html;
    } catch(e) { document.getElementById('commandsList').innerHTML = '<div>Failed to load</div>'; }
}
async function loadServerInfo() {
    try {
        const res = await fetch(`${window.location.origin}/api/server/info`);
        const data = await res.json();
        document.getElementById('serverUptime').textContent = formatUptime(data.uptime);
        document.getElementById('serverStartTime').textContent = new Date(data.startTime).toLocaleString();
        if(window.serverUptimeTimer) clearInterval(window.serverUptimeTimer);
        window.serverUptimeTimer = setInterval(async () => {
            try {
                const uptRes = await fetch(`${window.location.origin}/api/server/uptime`);
                const uptData = await uptRes.json();
                document.getElementById('serverUptime').textContent = formatUptime(uptData.uptime);
            } catch(e) {}
        }, 1000);
    } catch(e) {}
}

// Privacy Modal
let privacyAccepted = localStorage.getItem('privacyAccepted');
const modal = document.getElementById('privacyModal');
function acceptPrivacy() { localStorage.setItem('privacyAccepted', 'true'); modal.style.display = 'none'; showMessage('🎉 Welcome to AutoPageBot!', 'success'); }
function declinePrivacy() { localStorage.setItem('privacyAccepted', 'false'); modal.style.display = 'none'; showMessage('You must accept Privacy Policy to connect.', 'error'); }
function showPrivacy() { modal.style.display = 'flex'; }
document.getElementById('acceptPrivacyBtn').addEventListener('click', acceptPrivacy);
document.getElementById('declinePrivacyBtn').addEventListener('click', declinePrivacy);
document.getElementById('privacyPolicyBtn').addEventListener('click', showPrivacy);
document.getElementById('privacyLink')?.addEventListener('click', (e) => { e.preventDefault(); showPrivacy(); });
document.getElementById('refreshBtn').addEventListener('click', () => window.location.reload());
if (!privacyAccepted) { setTimeout(() => { modal.style.display = 'flex'; }, 300); }

loadServerInfo();
loadSessions();
loadCommands();
setInterval(loadSessions, 30000);