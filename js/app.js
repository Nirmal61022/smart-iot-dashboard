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
  humidity: [12, 10,  10,  13,  14,  13,  14,  16,  18,  19,  17,  15,  13],
  ph:       [6,   7,   8,   6,   7,   8,   7,   6,   6,   7,   6,   8,   6]
};

// App State
let state = {
  user: null,
  temperature: 22.0,
  humidity: 45,
  ph: 7.2,
  systemMode: 'MANUAL',
  lightOn: true,
  fanOn: true,
  fanSpeed: 'LOW',
  automationEnabled: false,
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
      ph: Number.isFinite(Number(log.ph)) ? Number(log.ph) : 7.2,
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
    window.dispatchEvent(new Event('resize'));
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
  const systemModeButton = document.getElementById('btnSystemMode');
  systemModeButton.addEventListener('click', () => {
    state.systemMode = state.systemMode === 'MANUAL' ? 'AUTOMATIC' : 'MANUAL';
    state.automationEnabled = state.systemMode === 'AUTOMATIC';
    renderAutomationState();
    renderSystemMode();
  });

  ['btnLightPower', 'btnLightTile'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => setLightPower(!state.lightOn));
  });
  ['btnFanPower', 'btnFanTile'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => setFanPower(!state.fanOn));
  });

  document.querySelectorAll('[data-fan-speed]').forEach(button => {
    button.addEventListener('click', () => setFanSpeed(button.dataset.fanSpeed));
  });

  const automationButton = document.getElementById('btnAutomation');
  automationButton.addEventListener('click', () => {
    state.automationEnabled = !state.automationEnabled;
    state.systemMode = state.automationEnabled ? 'AUTOMATIC' : 'MANUAL';
    renderAutomationState();
    renderSystemMode();
  });

  const sceneModal = document.getElementById('sceneModal');
  const closeSceneModal = () => {
    sceneModal.classList.remove('active');
    sceneModal.setAttribute('aria-hidden', 'true');
  };
  document.getElementById('btnSceneSelect').addEventListener('click', () => {
    sceneModal.classList.add('active');
    sceneModal.setAttribute('aria-hidden', 'false');
  });
  document.getElementById('btnCloseSceneModal').addEventListener('click', closeSceneModal);
  sceneModal.addEventListener('click', event => {
    if (event.target === sceneModal) closeSceneModal();
  });
  document.querySelectorAll('[data-scene]').forEach(button => {
    button.addEventListener('click', () => {
      applyScene(button.dataset.scene);
      closeSceneModal();
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sceneModal.classList.contains('active')) closeSceneModal();
  });

  // Top header quick notification bell
  const btnNotifications = document.getElementById('btnNotifications');
  btnNotifications.addEventListener('click', () => {
    alert(`System notifications:\n• Temperature optimal: ${state.temperature.toFixed(1)}°C\n• Humidity stable: ${state.humidity}%\n• pH level stable: ${state.ph.toFixed(1)}\n• Appliance relays operating normally`);
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

function renderSystemMode() {
  const isAutomatic = state.systemMode === 'AUTOMATIC';
  const button = document.getElementById('btnSystemMode');
  document.getElementById('systemModeValue').textContent = state.systemMode;
  button.classList.toggle('is-on', isAutomatic);
  button.setAttribute('aria-checked', String(isAutomatic));
  button.setAttribute('aria-label', isAutomatic ? 'Switch to manual mode' : 'Switch to automatic mode');
}

function renderAutomationState() {
  const button = document.getElementById('btnAutomation');
  button.classList.toggle('is-on', state.automationEnabled);
  button.setAttribute('aria-checked', String(state.automationEnabled));
  button.setAttribute('aria-label', state.automationEnabled ? 'Disable automation' : 'Enable automation');
}

function setLightPower(isOn) {
  state.lightOn = isOn;
  const toggle = document.getElementById('btnLightPower');
  const tile = document.getElementById('btnLightTile');
  toggle.classList.toggle('is-on', isOn);
  toggle.setAttribute('aria-checked', String(isOn));
  toggle.setAttribute('aria-label', isOn ? 'Turn lights off' : 'Turn lights on');
  tile.classList.toggle('light-active', isOn);
  tile.setAttribute('aria-pressed', String(isOn));
  document.getElementById('lightStatusLabel').textContent = isOn ? 'ON' : 'OFF';
}

function setFanPower(isOn) {
  state.fanOn = isOn;
  const toggle = document.getElementById('btnFanPower');
  const tile = document.getElementById('btnFanTile');
  toggle.classList.toggle('is-on', isOn);
  toggle.setAttribute('aria-checked', String(isOn));
  toggle.setAttribute('aria-label', isOn ? 'Turn fan off' : 'Turn fan on');
  tile.classList.toggle('fan-active', isOn);
  tile.setAttribute('aria-pressed', String(isOn));
  document.getElementById('fanStatusLabel').textContent = isOn ? state.fanSpeed : 'OFF';
}

function setFanSpeed(speed) {
  if (!['LOW', 'MED', 'HIGH', 'AUTO'].includes(speed)) return;
  state.fanSpeed = speed;
  document.getElementById('fanStatusLabel').textContent = state.fanOn ? speed : 'OFF';
  document.querySelectorAll('[data-fan-speed]').forEach(button => {
    const selected = button.dataset.fanSpeed === speed;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const fanIcon = document.querySelector('#btnFanTile .fan-spinner');
  fanIcon.classList.remove('speed-low', 'speed-med', 'speed-high', 'speed-auto');
  fanIcon.classList.add(`speed-${speed.toLowerCase()}`);
}

function applyScene(scene) {
  const scenes = {
    focus: { light: true, fan: true, speed: 'LOW', automatic: false },
    relax: { light: true, fan: true, speed: 'MED', automatic: false },
    away: { light: false, fan: false, speed: 'AUTO', automatic: false },
    auto: { light: state.lightOn, fan: state.fanOn, speed: state.fanSpeed, automatic: true }
  };
  const selected = scenes[scene];
  if (!selected) return;
  setLightPower(selected.light);
  setFanPower(selected.fan);
  setFanSpeed(selected.speed);
  state.automationEnabled = selected.automatic;
  state.systemMode = selected.automatic ? 'AUTOMATIC' : 'MANUAL';
  renderAutomationState();
  renderSystemMode();
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
  document.getElementById('phValueDisplay').textContent = state.ph.toFixed(1);
  document.getElementById('phRangeMarker').style.left = `${Math.min(Math.max(state.ph / 14 * 100, 0), 100)}%`;
  renderSystemMode();
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
  const deltaPh = (Math.random() - 0.5) * 0.08;
  state.temperature = Math.round((state.temperature + deltaTemp) * 10) / 10;
  state.humidity = Math.round(state.humidity + deltaHum);
  state.ph = Math.round((state.ph + deltaPh) * 10) / 10;

  // Keep in plausible bounds
  if (state.temperature < 21) state.temperature = 21.4;
  if (state.temperature > 23) state.temperature = 22.2;
  if (state.humidity < 42) state.humidity = 43;
  if (state.humidity > 48) state.humidity = 46;
  if (state.ph < 6.8) state.ph = 6.9;
  if (state.ph > 7.5) state.ph = 7.4;
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
    const ySteps = [0, 5, 10, 15, 20, 25];

    // Grid Lines & Y-axis labels
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.fillStyle = '#758198';
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
        ctx.strokeStyle = '#171d29';
        ctx.stroke();
      });

      ctx.restore();
    }

    drawSeries(ANALYTICS_DATA.humidity, '#6366f1', '#818cf8');
    drawSeries(ANALYTICS_DATA.temp, '#f59e0b', '#fbbf24');
    drawSeries(ANALYTICS_DATA.ph, '#14b8a6', '#2dd4bf');

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
      <td>${Number(log.ph).toFixed(1)}</td>
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
    ph: state.ph,
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
  const headers = ['Date', 'Time', 'Temperature (C)', 'Humidity (%)', 'pH', 'Notes'];
  const rows = state.logs.map(l => [
    `"${l.date}"`,
    `"${l.time}"`,
    l.temp,
    l.hum,
    l.ph,
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
