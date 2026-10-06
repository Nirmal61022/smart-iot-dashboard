/**
 * Smart Home IoT Dashboard - Single Page Application Core
 * Complete client-side state, LocalStorage authentication & telemetry simulation.
 */

// LocalStorage Keys
const STORAGE_KEYS = {
  USERS: 'aeterna_users',
  SESSION: 'aeterna_auth_user',
  LOGS: 'aeterna_sensor_logs',
  SETTINGS: 'aeterna_settings',
  CONTROLS: 'aeterna_controls_state'
};

// 24h Historical Analytics Data matching screenshot
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
  systemMode: 'MANUAL',
  applianceOn: true,
  simActive: true,
  simInterval: null,
  logInterval: null,
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
  getStoredUsers();
  state.logs = getStoredLogs();
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(state.logs));
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
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGS)) || [];
    return Array.isArray(logs)
      ? logs.filter(log =>
        !['2023-11-20 09:15', '2023-11-20 09:21'].includes(log.date) &&
        !(log.note === 'Live reading' && log.date.includes(' '))
      ).map(log => ({
      date: log.date,
      time: log.time,
      temp: log.temp,
      hum: log.hum,
      note: log.note
      }))
      : [];
  } catch (e) {
    return [];
  }
}

/* ==========================================================================
   AUTHENTICATION LOGIC (LOCALSTORAGE BASED)
   ========================================================================== */
function initAuthUI() {
  const authOverlay = document.getElementById('authOverlay');
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const authForm = document.getElementById('authForm');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const nameGroup = document.getElementById('nameGroup');
  const confirmPassGroup = document.getElementById('confirmPassGroup');
  const authFeedback = document.getElementById('authFeedback');

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
    if (confirm('Reset all local storage data, including saved accounts and sensor history?')) {
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
    showFeedback('Invalid credentials. Check email & password or use Demo Sign In.', 'error');
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
  document.body.classList.add('is-authenticated');
  startLiveLogUpdates();

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
  state.user = null;
  document.body.classList.remove('is-authenticated');
  document.getElementById('authOverlay').style.display = 'flex';
}

function updateUserUI(user) {
  document.getElementById('headerUserAvatar').textContent = user.avatar || user.name.charAt(0).toUpperCase();
  document.getElementById('menuUserName').textContent = user.name;
  document.getElementById('menuUserEmail').textContent = user.email;
}

function logoutUser() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
  clearInterval(state.logInterval);
  state.logInterval = null;
  state.user = null;
  document.body.classList.remove('is-authenticated');
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
  document.querySelectorAll('.mode-pill-opt').forEach(button => {
    button.addEventListener('click', () => {
      state.systemMode = button.dataset.mode;
      document.querySelectorAll('.mode-pill-opt').forEach(option => {
        const isActive = option === button;
        option.classList.toggle('active', isActive);
        option.setAttribute('aria-pressed', String(isActive));
      });
    });
  });

  const appliancePowerButton = document.getElementById('btnAppliancePower');
  const appliancePowerLabel = document.getElementById('appliancePowerLabel');
  appliancePowerButton.addEventListener('click', () => {
    state.applianceOn = !state.applianceOn;
    appliancePowerButton.classList.toggle('is-on', state.applianceOn);
    appliancePowerButton.setAttribute('aria-pressed', String(state.applianceOn));
    appliancePowerLabel.textContent = state.applianceOn ? 'ON' : 'OFF';
  });

  // Top header quick notification bell
  const btnNotifications = document.getElementById('btnNotifications');
  btnNotifications.addEventListener('click', () => {
    alert('System notifications:\n• Temperature optimal: 22.0°C\n• Humidity stable: 45%\n• Appliance relays operating normally');
  });

  // Settings button
  const btnSettings = document.getElementById('btnSettings');
  btnSettings.addEventListener('click', () => {
    const newRate = prompt('Simulation telemetry refresh interval in seconds (default: 4):', '4');
    if (newRate && !isNaN(newRate) && Number(newRate) >= 1) {
      clearInterval(state.simInterval);
      state.simInterval = setInterval(updateLiveTelemetry, Number(newRate) * 1000);
      alert(`Telemetry interval updated to ${newRate} seconds.`);
    }
  });

  // Table buttons
  document.getElementById('btnAddLog').addEventListener('click', () => {
    const note = prompt('Enter note for new log entry:', 'Manual Inspection');
    if (note !== null) {
      addSensorLog(note.trim() || 'Manual Check');
    }
  });

  document.getElementById('btnExportCsv').addEventListener('click', () => {
    exportLogsToCSV();
  });
}

/* ==========================================================================
   METRICS RENDERING (GAUGE, RESERVOIR)
   ========================================================================== */
function renderMetricsUI() {
  // 1. Temperature Gauge
  document.getElementById('tempValueDisplay').textContent = `${state.temperature.toFixed(0)}°C`;
  const gaugeArc = document.getElementById('gaugeArcProgress');
  if (gaugeArc) {
    // Calculate arc offset: 200 is full, range ~15°C to 35°C
    const minT = 10, maxT = 35;
    const clamped = Math.min(Math.max(state.temperature, minT), maxT);
    const pct = (clamped - minT) / (maxT - minT);
    const offset = 200 - (pct * 140);
    gaugeArc.style.strokeDashoffset = offset;
  }

  // 2. Humidity Reservoir
  document.getElementById('humidityValueDisplay').textContent = `${Math.round(state.humidity)}%`;
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
  let animationProgress = 0;

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
    ctx.strokeStyle = 'rgba(121, 99, 77, 0.18)';
    ctx.fillStyle = '#796351';
    ctx.font = '10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    ySteps.forEach(val => {
      const y = padTop + chartH - (val / yMax) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();
      ctx.fillText(val, padLeft - 6, y);
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
          // Smooth curve using bezier
          const prevX = padLeft + (i - 1) * stepX;
          const prevVal = data[i - 1];
          const prevY = padTop + chartH - ((prevVal / yMax) * chartH * progress);
          const cpX1 = prevX + stepX * 0.45;
          const cpX2 = x - stepX * 0.45;
          ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
        }
      });

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 6;
      ctx.stroke();

      // Draw point markers
      data.forEach((val, i) => {
        const x = padLeft + i * stepX;
        const y = padTop + chartH - ((val / yMax) * chartH * progress);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#fffaf5';
        ctx.stroke();
      });

      ctx.restore();
    }

    // 1. Humidity (Purple-Indigo)
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
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const newEntry = {
    date: dateStr,
    time: timeStr,
    temp: state.temperature,
    hum: state.humidity,
    note: note
  };

  state.logs.unshift(newEntry);
  state.logs = state.logs.slice(0, 100);
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(state.logs));
  renderLogsTable();
}

function startLiveLogUpdates() {
  clearInterval(state.logInterval);
  addSensorLog('Live reading');
  state.logInterval = setInterval(() => addSensorLog('Live reading'), 60_000);
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
  link.setAttribute('download', `smart_home_sensor_log_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
