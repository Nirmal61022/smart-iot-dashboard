/**
 * Smart Home IoT Dashboard - Single Page Application Core
 * Client-side state, LocalStorage authentication & real-time telemetry controls.
 */

// LocalStorage Keys
const STORAGE_KEYS = {
  USERS: 'aeterna_users',
  SESSION: 'aeterna_auth_user',
  LOGS: 'aeterna_sensor_logs',
  SETTINGS: 'aeterna_settings'
};

// Default User for quick sign in
const DEFAULT_DEMO_USER = {
  name: 'Nirmal Kumar',
  email: 'nirmal.18@proto.tech',
  password: 'password123',
  avatar: 'N',
  createdAt: '2023-11-20T08:00:00Z'
};

// Default Sensor History matching the table
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

// App State
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
   INITIALIZATION & LOCALSTORAGE MANAGEMENT
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  initAuthUI();
  initDashboardControls();
  initChart();
  renderLogsTable();
  startTelemetrySimulation();

  // Check existing session
  checkAuthSession();
});

function initStorage() {
  // Ensure default users list exists
  let users = getStoredUsers();
  if (!users || users.length === 0) {
    users = [DEFAULT_DEMO_USER];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  // Ensure default logs exist
  let logs = getStoredLogs();
  if (!logs || logs.length === 0) {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(DEFAULT_LOGS));
    state.logs = [...DEFAULT_LOGS];
  } else {
    state.logs = logs;
  }
}

function getStoredUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];
  } catch (e) {
    return [];
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
   AUTHENTICATION LOGIC (LOCALSTORAGE BASED)
   ========================================================================== */
function initAuthUI() {
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const authForm = document.getElementById('authForm');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const nameGroup = document.getElementById('nameGroup');
  const confirmPassGroup = document.getElementById('confirmPassGroup');

  let currentTab = 'signin'; // 'signin' or 'signup'

  // Tab switching
  tabSignIn.addEventListener('click', () => {
    currentTab = 'signin';
    tabSignIn.classList.add('active');
    tabSignUp.classList.remove('active');
    nameGroup.style.display = 'none';
    confirmPassGroup.style.display = 'none';
    authSubmitBtn.textContent = 'Sign In to Dashboard';
    hideFeedback();
  });

  tabSignUp.addEventListener('click', () => {
    currentTab = 'signup';
    tabSignUp.classList.add('active');
    tabSignIn.classList.remove('active');
    nameGroup.style.display = 'block';
    confirmPassGroup.style.display = 'block';
    authSubmitBtn.textContent = 'Create Local Account';
    hideFeedback();
  });

  // Form Submission
  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;

    if (currentTab === 'signin') {
      authenticateUser(email, password);
    } else {
      const name = document.getElementById('authName').value.trim();
      const confirmPass = document.getElementById('authConfirmPass').value;

      if (!name) {
        showFeedback('Please enter your full name', 'error');
        return;
      }
      if (password.length < 6) {
        showFeedback('Password must be at least 6 characters long', 'error');
        return;
      }
      if (password !== confirmPass) {
        showFeedback('Passwords do not match', 'error');
        return;
      }

      registerUser(name, email, password);
    }
  });

  // Account dropdown toggle
  const accountBtn = document.getElementById('accountBtn');
  const accountMenu = document.getElementById('accountMenu');
  accountBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    accountMenu.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!accountMenu.contains(e.target) && !accountBtn.contains(e.target)) {
      accountMenu.classList.remove('active');
    }
  });

  // Menu items: Logout
  document.getElementById('menuBtnLogout').addEventListener('click', () => {
    logoutUser();
  });

  // Menu items: Switch account
  document.getElementById('menuBtnSwitch').addEventListener('click', () => {
    logoutUser();
  });

  // Menu items: Clear data
  document.getElementById('menuBtnClearData').addEventListener('click', () => {
    if (confirm('Reset all localStorage data (sensor logs & saved credentials) to default?')) {
      localStorage.clear();
      initStorage();
      alert('Local storage reset. Reloading application...');
      window.location.reload();
    }
  });
}

function showFeedback(msg, type = 'error') {
  const el = document.getElementById('authFeedback');
  el.textContent = msg;
  el.className = `auth-feedback-msg ${type}`;
}

function hideFeedback() {
  const el = document.getElementById('authFeedback');
  el.className = 'auth-feedback-msg';
  el.textContent = '';
}

function authenticateUser(email, password) {
  const users = getStoredUsers();
  const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

  if (matched) {
    showFeedback('Sign in successful! Entering dashboard...', 'success');
    loginSuccess(matched);
  } else {
    showFeedback('Invalid credentials. Check email & password.', 'error');
  }
}

function registerUser(name, email, password) {
  const users = getStoredUsers();
  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (existing) {
    showFeedback('An account with this email already exists in localStorage.', 'error');
    return;
  }

  const newUser = {
    name,
    email,
    password,
    avatar: name.charAt(0).toUpperCase() || 'U',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  showFeedback('Account created & stored in browser! Loading...', 'success');
  loginSuccess(newUser);
}

function loginSuccess(user) {
  state.user = user;
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));

  setTimeout(() => {
    const authOverlay = document.getElementById('authOverlay');
    authOverlay.style.opacity = '0';
    authOverlay.style.transition = 'opacity 0.4s ease';
    setTimeout(() => {
      authOverlay.style.display = 'none';
      authOverlay.style.opacity = '1';
    }, 400);

    updateUserUI(user);
  }, 400);
}

function checkAuthSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION));
    if (saved && saved.email) {
      state.user = saved;
      document.getElementById('authOverlay').style.display = 'none';
      updateUserUI(saved);
      return;
    }
  } catch (e) {}

  // If no session, show auth overlay
  document.getElementById('authOverlay').style.display = 'flex';
}

function updateUserUI(user) {
  document.getElementById('headerUserAvatar').textContent = user.avatar || user.name.charAt(0).toUpperCase();
  document.getElementById('menuUserName').textContent = user.name;
  document.getElementById('menuUserEmail').textContent = user.email;
}

function logoutUser() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
  state.user = null;
  document.getElementById('accountMenu').classList.remove('active');
  const authOverlay = document.getElementById('authOverlay');
  authOverlay.style.display = 'flex';
  authOverlay.style.opacity = '1';
  hideFeedback();
}

/* ==========================================================================
   DASHBOARD METRICS & CONTROLS INTERACTION
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

  // Appliance Control Power Toggle
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

  // Top header quick notification bell
  const btnNotifications = document.getElementById('btnNotifications');
  if (btnNotifications) {
    btnNotifications.addEventListener('click', () => {
      alert('Smart Home Notifications:\n• Temperature optimal: 22.0°C\n• Humidity stable: 45%\n• Appliance relay operating normally');
    });
  }

  // Settings button
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

  // Table buttons
  const btnAddLog = document.getElementById('btnAddLog');
  if (btnAddLog) {
    btnAddLog.addEventListener('click', () => {
      const note = prompt('Enter note for new log entry:', 'Manual Inspection');
      if (note !== null) {
        addSensorLog(note.trim() || 'Manual Check');
      }
    });
  }

  const btnExportCsv = document.getElementById('btnExportCsv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      exportLogsToCSV();
    });
  }
}

/* ==========================================================================
   METRICS RENDERING (GAUGE, RESERVOIR)
   ========================================================================== */
function renderMetricsUI() {
  // 1. Temperature Gauge
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

  // 2. Humidity Reservoir
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

  // Realistic micro variations
  const deltaTemp = (Math.random() - 0.5) * 0.4;
  const deltaHum = (Math.random() - 0.5) * 1.0;

  state.temperature = Math.round((state.temperature + deltaTemp) * 10) / 10;
  state.humidity = Math.round(state.humidity + deltaHum);

  // Keep in plausible bounds
  if (state.temperature < 21) state.temperature = 21.4;
  if (state.temperature > 23) state.temperature = 22.2;
  if (state.humidity < 42) state.humidity = 43;
  if (state.humidity > 48) state.humidity = 46;

  renderMetricsUI();
}

/* ==========================================================================
   HISTORICAL PERFORMANCE & ANALYTICS CANVAS CHART
   ========================================================================== */
function initChart() {
  const canvas = document.getElementById('analyticsChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  function resizeAndDraw() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    drawChart(rect.width, rect.height, 1);
  }

  function drawChart(w, h, progress = 1) {
    ctx.clearRect(0, 0, w, h);

    const padLeft = 28;
    const padRight = 16;
    const padTop = 14;
    const padBottom = 26;

    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    const yMax = 25;
    const ySteps = [0, 5, 10, 12, 15, 20, 25];

    // Grid Lines & Y-axis labels
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.16)';
    ctx.fillStyle = '#78716c';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    ySteps.forEach(val => {
      const y = padTop + chartH - (val / yMax) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();
      ctx.fillText(val, padLeft - 8, y);
    });

    // X-axis labels
    const pointsCount = ANALYTICS_DATA.labels.length;
    const stepX = chartW / (pointsCount - 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ANALYTICS_DATA.labels.forEach((lbl, i) => {
      const x = padLeft + i * stepX;
      ctx.fillText(lbl, x, padTop + chartH + 8);
    });

    // Helper to draw series curve
    function drawSeries(data, strokeColor, dotColor) {
      ctx.save();
      ctx.beginPath();

      data.forEach((val, i) => {
        const x = padLeft + i * stepX;
        const targetY = padTop + chartH - (val / yMax) * chartH;
        const y = padTop + chartH - ((val / yMax) * chartH * progress);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevX = padLeft + (i - 1) * stepX;
          const prevVal = data[i - 1];
          const prevY = padTop + chartH - ((prevVal / yMax) * chartH * progress);
          const cpX1 = prevX + stepX * 0.45;
          const cpX2 = x - stepX * 0.45;
          ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
        }
      });

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.4;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 4;
      ctx.stroke();

      // Draw point markers
      data.forEach((val, i) => {
        const x = padLeft + i * stepX;
        const y = padTop + chartH - ((val / yMax) * chartH * progress);
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      });

      ctx.restore();
    }

    // 1. Humidity (Purple/Indigo)
    drawSeries(ANALYTICS_DATA.humidity, '#6366f1', '#818cf8');

    // 2. Temperature (Warm Amber / Orange)
    drawSeries(ANALYTICS_DATA.temp, '#f59e0b', '#fbbf24');
  }

  window.addEventListener('resize', resizeAndDraw);
  setTimeout(resizeAndDraw, 100);
}

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
