/**
 * Smart Home IoT Dashboard - Single Page Application Core
 * Fast formality login (any credentials allowed) & guaranteed visible SVG analytics chart.
 */

// LocalStorage Keys
const STORAGE_KEYS = {
  USERS: 'aeterna_users',
  SESSION: 'aeterna_auth_user',
  LOGS: 'aeterna_sensor_logs',
  SETTINGS: 'aeterna_settings'
};

// Default User Profile
const DEFAULT_USER = {
  name: 'Nirmal Kumar',
  email: 'nirmal.18@proto.tech',
  password: 'password123',
  avatar: 'N',
  createdAt: '2023-11-20T08:00:00Z'
};

// Default Sensor History
const DEFAULT_LOGS = [
  { date: '2023-11-20 09:15', time: '09:15', temp: 22.1, hum: 44.8, note: 'Routine Check' },
  { date: '2023-11-20 09:15', time: '09:48', temp: 22.1, hum: 44.8, note: 'Routine Check' },
  { date: '2023-11-20 09:21', time: '09:30', temp: 22.1, hum: 44.8, note: 'Routine Check' }
];

// 24h Historical Analytics Data (Temperature & Humidity)
const ANALYTICS_DATA = {
  labels: ['0h', '2h', '4h', '6h', '8h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '24h'],
  temp:     [7,   9,  15,  13,  12,  13,  14,  16,  18,  20,  14,  17,  15],
  humidity: [12, 10,  10,  13,  14,  13,  14,  16,  18,  19,  17,  15,  13]
};

// Application State
let state = {
  user: null,
  temperature: 22.0,
  humidity: 45,
  systemMode: 'MANUAL', // 'MANUAL' or 'AUTO'
  applianceOn: true,
  simActive: true,
  simInterval: null,
  logs: []
};

/* ==========================================================================
   INITIALIZATION & STORAGE
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  initAuthUI();
  initDashboardControls();
  renderAnalyticsChart();
  renderLogsTable();
  startTelemetrySimulation();

  // Check session or prompt sign-in
  checkAuthSession();
});

function initStorage() {
  let logs = getStoredLogs();
  if (!logs || logs.length === 0) {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(DEFAULT_LOGS));
    state.logs = [...DEFAULT_LOGS];
  } else {
    state.logs = logs;
  }
}

function getStoredLogs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGS)) || [];
  } catch (e) {
    return [];
  }
}

/* ==========================================================================
   FORMALITY AUTHENTICATION (ACCEPTS ANY USERNAME & PASSWORD)
   ========================================================================== */
function initAuthUI() {
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const authForm = document.getElementById('authForm');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const nameGroup = document.getElementById('nameGroup');
  const confirmPassGroup = document.getElementById('confirmPassGroup');

  let currentTab = 'signin';

  tabSignIn.addEventListener('click', () => {
    currentTab = 'signin';
    tabSignIn.classList.add('active');
    tabSignUp.classList.remove('active');
    if (nameGroup) nameGroup.style.display = 'none';
    if (confirmPassGroup) confirmPassGroup.style.display = 'none';
    if (authSubmitBtn) authSubmitBtn.textContent = 'Sign In to Dashboard';
    hideFeedback();
  });

  tabSignUp.addEventListener('click', () => {
    currentTab = 'signup';
    tabSignUp.classList.add('active');
    tabSignIn.classList.remove('active');
    if (nameGroup) nameGroup.style.display = 'block';
    if (confirmPassGroup) confirmPassGroup.style.display = 'block';
    if (authSubmitBtn) authSubmitBtn.textContent = 'Create Account & Enter';
    hideFeedback();
  });

  // Accepts ANY username and password unconditionally (formality sign in)
  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawEmail = document.getElementById('authEmail').value;
    const rawPass = document.getElementById('authPassword').value;
    const rawName = document.getElementById('authName') ? document.getElementById('authName').value : '';

    const displayName = (rawName && rawName.trim()) 
      ? rawName.trim() 
      : ((rawEmail && rawEmail.trim()) ? rawEmail.trim().split('@')[0] : 'Nirmal Kumar');

    const displayEmail = (rawEmail && rawEmail.trim()) 
      ? rawEmail.trim() 
      : 'nirmal.18@proto.tech';

    const user = {
      name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      email: displayEmail,
      password: rawPass || 'password',
      avatar: (displayName.charAt(0) || 'U').toUpperCase(),
      createdAt: new Date().toISOString()
    };

    loginSuccess(user);
  });

  // Account dropdown toggle
  const accountBtn = document.getElementById('accountBtn');
  const accountMenu = document.getElementById('accountMenu');
  if (accountBtn && accountMenu) {
    accountBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      accountMenu.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!accountMenu.contains(e.target) && !accountBtn.contains(e.target)) {
        accountMenu.classList.remove('active');
      }
    });
  }

  // Menu items: Logout
  const btnLogout = document.getElementById('menuBtnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      logoutUser();
    });
  }

  // Menu items: Switch account
  const btnSwitch = document.getElementById('menuBtnSwitch');
  if (btnSwitch) {
    btnSwitch.addEventListener('click', () => {
      logoutUser();
    });
  }

  // Menu items: Clear data
  const btnClearData = document.getElementById('menuBtnClearData');
  if (btnClearData) {
    btnClearData.addEventListener('click', () => {
      if (confirm('Reset all localStorage data (sensor logs & saved credentials) to default?')) {
        localStorage.clear();
        initStorage();
        window.location.reload();
      }
    });
  }
}

function showFeedback(msg, type = 'success') {
  const el = document.getElementById('authFeedback');
  if (el) {
    el.textContent = msg;
    el.className = `auth-feedback-msg ${type}`;
    el.style.display = 'block';
  }
}

function hideFeedback() {
  const el = document.getElementById('authFeedback');
  if (el) {
    el.className = 'auth-feedback-msg';
    el.textContent = '';
    el.style.display = 'none';
  }
}

function loginSuccess(user) {
  state.user = user;
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
  showFeedback('Access granted. Entering dashboard...', 'success');

  setTimeout(() => {
    const authOverlay = document.getElementById('authOverlay');
    if (authOverlay) {
      authOverlay.style.opacity = '0';
      authOverlay.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        authOverlay.style.display = 'none';
        authOverlay.style.opacity = '1';
        // Ensure chart is fully rendered once dashboard is visible
        renderAnalyticsChart();
      }, 300);
    }
    updateUserUI(user);
  }, 250);
}

function checkAuthSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION));
    if (saved && (saved.email || saved.name)) {
      state.user = saved;
      const overlay = document.getElementById('authOverlay');
      if (overlay) overlay.style.display = 'none';
      updateUserUI(saved);
      renderAnalyticsChart();
      return;
    }
  } catch (e) {}

  // If no previous session, show overlay
  const overlay = document.getElementById('authOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function updateUserUI(user) {
  const avatar = document.getElementById('headerUserAvatar');
  const name = document.getElementById('menuUserName');
  const email = document.getElementById('menuUserEmail');

  if (avatar) avatar.textContent = user.avatar || user.name.charAt(0).toUpperCase();
  if (name) name.textContent = user.name;
  if (email) email.textContent = user.email;
}

function logoutUser() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
  state.user = null;
  const menu = document.getElementById('accountMenu');
  if (menu) menu.classList.remove('active');
  const overlay = document.getElementById('authOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
  }
  hideFeedback();
}

/* ==========================================================================
   DASHBOARD CONTROLS (SYSTEM MODE & APPLIANCE POWER)
   ========================================================================== */
function initDashboardControls() {
  // System Mode Option Pills (MANUAL / AUTOMATIC)
  const modePills = document.querySelectorAll('.mode-pill-opt');
  modePills.forEach(pill => {
    pill.addEventListener('click', () => {
      const mode = pill.dataset.mode;
      state.systemMode = mode;
      modePills.forEach(p => {
        const isActive = p.dataset.mode === mode;
        p.classList.toggle('active', isActive);
        p.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    });
  });

  // Appliance Power Toggle Button
  const btnAppliancePower = document.getElementById('btnAppliancePower');
  const appliancePowerLabel = document.getElementById('appliancePowerLabel');
  if (btnAppliancePower) {
    btnAppliancePower.addEventListener('click', () => {
      state.applianceOn = !state.applianceOn;
      btnAppliancePower.classList.toggle('is-on', state.applianceOn);
      btnAppliancePower.setAttribute('aria-pressed', state.applianceOn ? 'true' : 'false');
      if (appliancePowerLabel) {
        appliancePowerLabel.textContent = state.applianceOn ? 'ON' : 'OFF';
      }
    });
  }

  // Notifications Bell
  const btnNotifications = document.getElementById('btnNotifications');
  if (btnNotifications) {
    btnNotifications.addEventListener('click', () => {
      alert('Smart Home Notifications:\n• Temperature optimal: 22.0°C\n• Humidity stable: 45%\n• Appliance relay operating normally');
    });
  }

  // Settings Gear
  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      const newRate = prompt('Simulation telemetry refresh interval in seconds (default: 4):', '4');
      if (newRate && !isNaN(newRate) && Number(newRate) >= 1) {
        clearInterval(state.simInterval);
        state.simInterval = setInterval(updateLiveTelemetry, Number(newRate) * 1000);
        alert(`Telemetry interval updated to ${newRate} seconds.`);
      }
    });
  }

  // Table buttons: Add Log
  const btnAddLog = document.getElementById('btnAddLog');
  if (btnAddLog) {
    btnAddLog.addEventListener('click', () => {
      const note = prompt('Enter note for new log entry:', 'Manual Inspection');
      if (note !== null) {
        addSensorLog(note.trim() || 'Manual Check');
      }
    });
  }

  // Table buttons: Export CSV
  const btnExportCsv = document.getElementById('btnExportCsv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      exportLogsToCSV();
    });
  }
}

/* ==========================================================================
   METRICS RENDERING (GAUGE & WATER TANK)
   ========================================================================== */
function renderMetricsUI() {
  const tempDisplay = document.getElementById('tempValueDisplay');
  if (tempDisplay) {
    tempDisplay.textContent = `${state.temperature.toFixed(0)}°C`;
  }
  const gaugeArc = document.getElementById('gaugeArcProgress');
  if (gaugeArc) {
    const minT = 10, maxT = 35;
    const clamped = Math.min(Math.max(state.temperature, minT), maxT);
    const pct = (clamped - minT) / (maxT - minT);
    const offset = 200 - (pct * 140);
    gaugeArc.style.strokeDashoffset = offset;
  }

  const humDisplay = document.getElementById('humidityValueDisplay');
  if (humDisplay) {
    humDisplay.textContent = `${Math.round(state.humidity)}%`;
  }
  const tankFill = document.getElementById('humidityTankFill');
  if (tankFill) {
    tankFill.style.height = `${Math.min(Math.max(state.humidity, 10), 95)}%`;
  }
}

/* ==========================================================================
   TELEMETRY REAL-TIME SIMULATION
   ========================================================================== */
function startTelemetrySimulation() {
  renderMetricsUI();
  state.simInterval = setInterval(updateLiveTelemetry, 4000);
}

function updateLiveTelemetry() {
  if (!state.simActive) return;

  const deltaTemp = (Math.random() - 0.5) * 0.4;
  const deltaHum = (Math.random() - 0.5) * 1.0;

  state.temperature = Math.round((state.temperature + deltaTemp) * 10) / 10;
  state.humidity = Math.round(state.humidity + deltaHum);

  if (state.temperature < 21) state.temperature = 21.4;
  if (state.temperature > 23) state.temperature = 22.2;
  if (state.humidity < 42) state.humidity = 43;
  if (state.humidity > 48) state.humidity = 46;

  renderMetricsUI();
}

/* ==========================================================================
   GUARANTEED VISIBLE SVG ANALYTICS GRAPH
   ========================================================================== */
function renderAnalyticsChart() {
  const container = document.getElementById('chartContainer');
  if (!container) return;

  const w = 720;
  const h = 180;
  const padLeft = 32;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 26;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;
  const yMax = 25;
  const ySteps = [0, 5, 10, 15, 20, 25];

  const pointsCount = ANALYTICS_DATA.labels.length;
  const stepX = chartW / (pointsCount - 1);

  // Build grid lines and labels
  let gridLinesSvg = '';
  ySteps.forEach(val => {
    const y = padTop + chartH - (val / yMax) * chartH;
    gridLinesSvg += `
      <line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="rgba(249, 115, 22, 0.16)" stroke-width="1" />
      <text x="${padLeft - 8}" y="${y + 4}" fill="#78716c" font-size="11" font-family="'Plus Jakarta Sans', sans-serif" font-weight="600" text-anchor="end">${val}</text>
    `;
  });

  // Build X-axis time marks
  let xLabelsSvg = '';
  ANALYTICS_DATA.labels.forEach((lbl, i) => {
    const x = padLeft + i * stepX;
    xLabelsSvg += `
      <text x="${x}" y="${padTop + chartH + 18}" fill="#78716c" font-size="11" font-family="'Plus Jakarta Sans', sans-serif" font-weight="600" text-anchor="middle">${lbl}</text>
    `;
  });

  // Helper to generate smooth curve path and point circles
  function generateCurveAndDots(data, strokeColor, fillColor, seriesName, unit) {
    let d = '';
    let dots = '';

    data.forEach((val, i) => {
      const x = padLeft + i * stepX;
      const y = padTop + chartH - (val / yMax) * chartH;

      if (i === 0) {
        d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        const prevX = padLeft + (i - 1) * stepX;
        const prevVal = data[i - 1];
        const prevY = padTop + chartH - (prevVal / yMax) * chartH;
        const cpX1 = prevX + stepX * 0.45;
        const cpX2 = x - stepX * 0.45;
        d += ` C ${cpX1.toFixed(1)} ${prevY.toFixed(1)}, ${cpX2.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
      }

      dots += `
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${fillColor}" stroke="#ffffff" stroke-width="1.8" style="cursor: pointer;">
          <title>${seriesName}: ${val}${unit} at ${ANALYTICS_DATA.labels[i]}</title>
        </circle>
      `;
    });

    return { pathD: d, dotsSvg: dots };
  }

  const tempCurve = generateCurveAndDots(ANALYTICS_DATA.temp, '#ea580c', '#fbbf24', 'Temperature', '°C');
  const humCurve = generateCurveAndDots(ANALYTICS_DATA.humidity, '#6366f1', '#818cf8', 'Humidity', '%');

  const svgContent = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glowOrange" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="rgba(234, 88, 12, 0.45)" />
        </filter>
        <filter id="glowBlue" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="rgba(99, 102, 241, 0.45)" />
        </filter>
      </defs>

      <!-- Grid & Axes -->
      ${gridLinesSvg}
      ${xLabelsSvg}

      <!-- Humidity Series (Indigo/Blue Curve) -->
      <path d="${humCurve.pathD}" fill="none" stroke="#6366f1" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowBlue)" />
      ${humCurve.dotsSvg}

      <!-- Temperature Series (Orange Curve) -->
      <path d="${tempCurve.pathD}" fill="none" stroke="#ea580c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowOrange)" />
      ${tempCurve.dotsSvg}
    </svg>
  `;

  container.innerHTML = svgContent;
}

// Window resize listener to keep chart razor sharp
window.addEventListener('resize', renderAnalyticsChart);

/* ==========================================================================
   SENSOR LOG TABLE & CSV EXPORT
   ========================================================================== */
function renderLogsTable() {
  const tbody = document.getElementById('sensorLogTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  state.logs.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${log.date}</td>
      <td>${log.time}</td>
      <td>${Number(log.temp).toFixed(1)}</td>
      <td>${Number(log.hum).toFixed(1)}</td>
      <td>${log.note || 'Routine Check'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function addSensorLog(note = 'Routine Check') {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);

  const newEntry = {
    date: `${dateStr} ${timeStr}`,
    time: timeStr,
    temp: state.temperature,
    hum: state.humidity,
    note: note
  };

  state.logs.unshift(newEntry);
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(state.logs));
  renderLogsTable();
}

function exportLogsToCSV() {
  const headers = ['Date', 'Time', 'Temperature (C)', 'Humidity (%)', 'Notes'];
  const rows = state.logs.map(l => [
    `"${l.date}"`,
    `"${l.time}"`,
    l.temp,
    l.hum,
    `"${l.note}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + 
    [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `smarthome_sensor_log_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
