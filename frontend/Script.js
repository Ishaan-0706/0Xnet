// ============================================
//  OXNET — script.js
//  Uses IPC (window.oxnet) when in Electron,
//  falls back to direct fetch when in browser.
// ============================================

const API_BASE = 'http://localhost:8080';

// Helper: use IPC if available, else direct fetch
async function apiGetDevices() {
  if (window.oxnet) {
    const res = await window.oxnet.getDevices();
    if (res.ok) return res.data;
    throw new Error(res.error);
  }
  const r = await fetch(`${API_BASE}/devices`);
  return r.json();
}

async function apiGetSessions() {
  if (window.oxnet) {
    const res = await window.oxnet.getSessions();
    if (res.ok) return res.data;
    throw new Error(res.error);
  }
  const r = await fetch(`${API_BASE}/session/list`);
  return r.json();
}

async function apiCreateSession(data) {
  if (window.oxnet) {
    const res = await window.oxnet.createSession(data);
    if (res.ok) return res.data;
    throw new Error(res.error);
  }
  const r = await fetch(`${API_BASE}/session/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

document.addEventListener('DOMContentLoaded', () => {

  // ---- Fetch real Device ID & LAN from backend ----
  const deviceIdEl = document.getElementById('deviceId');
  const lanEl = document.getElementById('lanAddress');
  const statusDot = document.getElementById('profileStatusDot');

  async function fetchDeviceInfo() {
    try {
      const devices = await apiGetDevices();

      // The first device is "Me"
      const me = devices.find(d => d.device_id && d.device_id.includes('(Me)'));
      if (me && deviceIdEl) {
        const rawId = me.device_id.replace(' (Me)', '');
        deviceIdEl.textContent = rawId.length > 16 ? rawId.substring(0, 16) + '…' : rawId;
      }

      if (lanEl) {
        if (me && me.host) {
          lanEl.textContent = me.host;
        } else {
          lanEl.textContent = window.location.hostname || 'localhost';
        }
      }

      if (statusDot) statusDot.style.background = '#6E6189';
    } catch (err) {
      if (deviceIdEl) deviceIdEl.textContent = 'Offline';
      if (lanEl) lanEl.textContent = 'Not connected';
      if (statusDot) {
        statusDot.style.background = '#664040';
        statusDot.style.boxShadow = '0 0 7px #664040';
      }
    }
  }

  fetchDeviceInfo();

  // ---- Profile Dropdown ----
  const profileBtn = document.getElementById('profileBtn');
  const profileDropdown = document.getElementById('profileDropdown');
  const profileBtnName = document.getElementById('profileBtnName');
  const profileAvatar = document.getElementById('profileAvatar');
  const profileDropdownAvatar = document.getElementById('profileDropdownAvatar');
  const profileNameInput = document.getElementById('profileNameInput');
  const profileSaveBtn = document.getElementById('profileSaveBtn');

  function getInitial(name) {
    return (name || 'A').trim()[0].toUpperCase();
  }

  function toggleDropdown(forceClose = false) {
    const isOpen = profileDropdown.classList.contains('open');
    if (forceClose || isOpen) {
      profileDropdown.classList.remove('open');
      profileBtn.classList.remove('open');
      profileBtn.setAttribute('aria-expanded', 'false');
    } else {
      profileDropdown.classList.add('open');
      profileBtn.classList.add('open');
      profileBtn.setAttribute('aria-expanded', 'true');
      setTimeout(() => profileNameInput?.focus(), 150);
    }
  }

  profileBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!document.getElementById('profileMenuWrap')?.contains(e.target)) {
      toggleDropdown(true);
    }
  });

  // Save username
  function saveUsername() {
    const val = profileNameInput.value.trim() || 'Anonymous';
    profileNameInput.value = val;
    profileBtnName.textContent = val;
    profileAvatar.textContent = getInitial(val);
    profileDropdownAvatar.textContent = getInitial(val);
    profileSaveBtn.classList.add('saved');
    setTimeout(() => profileSaveBtn.classList.remove('saved'), 1200);
    showToast(`Username saved — ${val}`);
  }

  profileSaveBtn?.addEventListener('click', saveUsername);
  profileNameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveUsername();
  });

  // ---- Settings Side Panel ----
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsClose = document.getElementById('settingsClose');
  const settingsSave = document.getElementById('settingsSave');

  function openSettings() {
    toggleDropdown(true);
    settingsPanel.classList.add('open');
    settingsOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSettings() {
    settingsPanel.classList.remove('open');
    settingsOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  settingsToggle?.addEventListener('click', (e) => {
    e.preventDefault();
    openSettings();
  });

  settingsClose?.addEventListener('click', closeSettings);
  settingsOverlay?.addEventListener('click', closeSettings);

  settingsSave?.addEventListener('click', () => {
    showToast('Settings saved successfully.');
    closeSettings();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettings();
      toggleDropdown(true);
    }
  });

  // ---- Fetch & Render Sessions from Backend ----
  const sessionsGrid = document.getElementById('sessionsGrid');
  const sessionsLoading = document.getElementById('sessionsLoading');
  const sessionsEmpty = document.getElementById('sessionsEmpty');
  const scrollWrap = document.getElementById('sessionsScrollWrap');
  const viewMoreBtn = document.getElementById('viewMoreBtn');
  const viewMoreLabel = document.getElementById('viewMoreLabel');

  async function fetchAndRenderSessions() {
    try {
      const data = await apiGetSessions();

      // Remove loading skeleton
      if (sessionsLoading) sessionsLoading.remove();

      // Clear existing session rows
      sessionsGrid.querySelectorAll('.session-row').forEach(el => el.remove());

      if (!data || data.length === 0) {
        sessionsEmpty.classList.remove('hidden');
        scrollWrap.style.display = 'none';
        if (viewMoreBtn) viewMoreBtn.parentElement.style.display = 'none';
        return;
      }

      sessionsEmpty.classList.add('hidden');
      scrollWrap.style.display = '';
      if (viewMoreBtn) viewMoreBtn.parentElement.style.display = '';

      data.forEach((session, i) => {
        const name = session.name || session.session_name || `Session ${i + 1}`;
        const host = session.host_name || session.device_id?.substring(0, 12) || 'Unknown';
        const users = session.user_count || session.device_count || 1;
        const sessionId = session.id || session.session_id || name;

        const row = document.createElement('div');
        row.className = 'session-row';
        if (i >= 4) row.classList.add('extra-session');
        row.dataset.session = sessionId;
        row.innerHTML = `
          <div class="session-indicator"></div>
          <div class="session-main-info">
            <span class="session-name">${escHtml(name)}</span>
            <span class="session-host">Host: ${escHtml(host)}</span>
          </div>
          <div class="session-divider"></div>
          <div class="session-users">
            <span class="session-users-icon">⊹</span>
            <span class="session-users-count">${users} user${users !== 1 ? 's' : ''}</span>
          </div>
          <button class="btn-join">Join →</button>
        `;

        row.style.opacity = '0';
        row.style.transform = 'translateX(-8px)';
        sessionsGrid.appendChild(row);

        setTimeout(() => {
          row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          row.style.opacity = '1';
          row.style.transform = 'translateX(0)';
        }, 50 * i);
      });

      const hasExtra = data.length > 4;
      if (viewMoreBtn) viewMoreBtn.parentElement.style.display = hasExtra ? '' : 'none';

    } catch (err) {
      if (sessionsLoading) sessionsLoading.remove();
      sessionsEmpty.classList.remove('hidden');
      const emptyTitle = sessionsEmpty.querySelector('.empty-title');
      const emptySub = sessionsEmpty.querySelector('.empty-sub');
      if (emptyTitle) emptyTitle.textContent = 'Backend Offline';
      if (emptySub) emptySub.textContent = 'Start the Go server to see sessions. Run: go run main.go';
      scrollWrap.style.display = 'none';
      if (viewMoreBtn) viewMoreBtn.parentElement.style.display = 'none';
    }
  }

  fetchAndRenderSessions();
  setInterval(fetchAndRenderSessions, 10000);

  // ---- Create Session Modal ----
  const createBtn = document.getElementById('createSessionBtn');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');

  createBtn?.addEventListener('click', () => {
    modalOverlay.classList.add('open');
  });

  modalClose?.addEventListener('click', () => {
    modalOverlay.classList.remove('open');
  });

  modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('open');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modalOverlay.classList.remove('open');
    }
  });

  // ---- Launch session from modal ----
  const launchBtn = document.getElementById('launchSessionBtn');
  launchBtn?.addEventListener('click', async () => {
    const nameInput = document.getElementById('sessionNameInput');
    const name = nameInput?.value.trim() || 'New Session';

    try {
      await apiCreateSession({ name });
    } catch (err) {
      console.warn('Could not create session on backend:', err);
    }

    modalOverlay.classList.remove('open');

    setTimeout(() => {
      window.location.href = `session.html?session=${encodeURIComponent(name)}`;
    }, 300);
  });

  // ---- View More Sessions ----
  let sessionsExpanded = false;

  viewMoreBtn?.addEventListener('click', () => {
    sessionsExpanded = !sessionsExpanded;

    if (sessionsExpanded) {
      scrollWrap.classList.add('expanded');
      viewMoreLabel.textContent = 'Show Less';
      viewMoreBtn.classList.add('active');
      setTimeout(() => {
        scrollWrap.scrollTo({ top: scrollWrap.scrollHeight, behavior: 'smooth' });
      }, 200);
    } else {
      scrollWrap.classList.remove('expanded');
      viewMoreLabel.textContent = 'View More Sessions';
      viewMoreBtn.classList.remove('active');
      scrollWrap.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // ---- Session card join buttons (event delegation) ----
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-join')) {
      const row = e.target.closest('.session-row');
      const name = row?.querySelector('.session-name')?.textContent || 'Session';
      showToast(`Joining ${name}…`);
      setTimeout(() => {
        window.location.href = `session.html?session=${encodeURIComponent(name)}&role=guest`;
      }, 500);
    }
  });

  // ---- HTML Escape Utility ----
  function escHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- Toast Notification ----
  function showToast(msg, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '1.5rem',
      left: '50%',
      transform: 'translateX(-50%) translateY(20px)',
      background: type === 'warn' ? '#443A67' : '#211E46',
      color: '#CBC9CC',
      border: '1px solid rgba(110,97,137,0.3)',
      padding: '0.7rem 1.4rem',
      borderRadius: '100px',
      fontFamily: "'Sora', sans-serif",
      fontSize: '0.8rem',
      zIndex: '999',
      opacity: '0',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
      whiteSpace: 'nowrap',
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(10px)';
      setTimeout(() => toast.remove(), 350);
    }, 2500);
  }
});