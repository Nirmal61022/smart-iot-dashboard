/**
 * SmartHome IoT Dashboard - Ultra-Modern Professional SPA Engine
 * Implements LocalStorage Auth, Real-Time Controls, Animated Visual Bulb,
 * Dynamic Multi-Line Chart.js, History Table with Search, and CSV Exporter.
 */

const STORAGE_KEYS = {
  USERS: 'smart_iot_users',
  SESSION: 'smart_iot_session',
  SETTINGS: 'smart_iot_settings',
  HISTORY: 'smart_iot_history',
  THEME: 'smart_iot_theme'
};

const DEFAULT_DEMO_USER = {
  email: 'nirmal.18@proto.tech',
  password: 'password123',
  registeredAt: new Date().toISOString()
};

// Global App State
const state = {
  currentUser: null,
  activeView: 'both', // 'both', 'controls', 'history'
  theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark',
  bulbStatus: false,
  operatingMode: 'AUTOMATIC',
  ldrThreshold: 400,
  currentSensors: {
    temperature: 25.7,
    humidity: 70,
    ambientLight: 353,
    timestamp: Date.now()
  },
  history: [],
  simActive: true,
  simTimer: null,
  chartInstance: null,
  tableFilterQuery: ''
};

// ==========================================
// 1. LOCAL STORAGE AUTHENTICATION
// ==========================================
class LocalAuthManager {
  static init() {
    let users = this.getUsers();
    if (users.length === 0) {
      users = [DEFAULT_DEMO_USER];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }
    return this.getCurrentSession();
  }

  static getUsers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    } catch (e) {
      return [];
    }
  }

  static register(email, password) {
    email = email.trim().toLowerCase();
    const users = this.getUsers();
    if (users.some(u => u.email.toLowerCase() === email)) {
      throw new Error('An account with this email address already exists.');
    }
    const newUser = {
      email,
      password,
      registeredAt: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return this.createSession(newUser);
  }

  static login(email, password) {
    email = email.trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email && u.password === password);
    if (!user) {
      if (email === DEFAULT_DEMO_USER.email.toLowerCase() && password === DEFAULT_DEMO_USER.password) {
        return this.createSession(DEFAULT_DEMO_USER);
      }
      throw new Error('Incorrect email address or password.');
    }
    return this.createSession(user);
  }

  static demoLogin() {
    return this.createSession(DEFAULT_DEMO_USER);
  }

  static createSession(user) {
    const session = {
      email: user.email,
      token: 'jwt-mock-' + Math.random().toString(36).substring(2),
      loginAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    return session;
  }

  static getCurrentSession() {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.SESSION);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  static logout() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }
}

// ==========================================
// 2. DASHBOARD APPLICATION CONTROLLER
// ==========================================
class ProDashboardApp {
  static init() {
    // Apply initial theme
    document.documentElement.dataset.theme = state.theme;

    // Check user authentication
    state.currentUser = LocalAuthManager.init();

    // Load persisted settings
    try {
      const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
      if (savedSettings.ldrThreshold) state.ldrThreshold = Number(savedSettings.ldrThreshold);
      if (savedSettings.operatingMode) state.operatingMode = savedSettings.operatingMode;
      if (savedSettings.bulbStatus !== undefined) state.bulbStatus = Boolean(savedSettings.bulbStatus);
    } catch (e) {}

    // Load persisted history or seed initial data
    try {
      const savedHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
      state.history = savedHistory;
    } catch (e) {
      state.history = [];
    }

    if (state.history.length === 0) {
      this.seedInitialHistory();
    }

    // Attach Event Listeners
    this.bindEvents();

    // Render appropriate screen
    if (state.currentUser) {
      this.showDashboard();
    } else {
      this.showAuth();
    }
  }

  static bindEvents() {
    // --- Auth Tab Switching ---
    const tabSignIn = document.getElementById('tabSignIn');
    const tabSignUp = document.getElementById('tabSignUp');
    const authHeadline = document.getElementById('authHeadline');
    const authSubheadline = document.getElementById('authSubheadline');
    const btnSubmitAuth = document.getElementById('btnSubmitAuth');
    let authMode = 'signin';

    if (tabSignIn && tabSignUp) {
      tabSignIn.addEventListener('click', () => {
        authMode = 'signin';
        tabSignIn.classList.add('active');
        tabSignUp.classList.remove('active');
        authHeadline.textContent = 'Welcome Back';
        authSubheadline.textContent = 'Sign in to access your IoT Dashboard.';
        btnSubmitAuth.innerHTML = '<span>Sign In to Dashboard</span> →';
        this.clearAuthFeedback();
      });

      tabSignUp.addEventListener('click', () => {
        authMode = 'signup';
        tabSignUp.classList.add('active');
        tabSignIn.classList.remove('active');
        authHeadline.textContent = 'Create Access';
        authSubheadline.textContent = 'Your credentials will be stored securely in localStorage.';
        btnSubmitAuth.innerHTML = '<span>Register & Access</span> →';
        this.clearAuthFeedback();
      });
    }

    // Toggle Password Visibility
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const proPasswordInput = document.getElementById('proPasswordInput');
    if (togglePasswordBtn && proPasswordInput) {
      togglePasswordBtn.addEventListener('click', () => {
        const isPass = proPasswordInput.type === 'password';
        proPasswordInput.type = isPass ? 'text' : 'password';
        togglePasswordBtn.textContent = isPass ? 'Hide' : 'Show';
      });
    }

    // Auth Form Submission
    const proAuthForm = document.getElementById('proAuthForm');
    if (proAuthForm) {
      proAuthForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('proEmailInput').value.trim();
        const password = proPasswordInput.value;

        if (!email || !password) {
          this.showAuthFeedback('Please enter both email and password.', 'error');
          return;
        }

        if (password.length < 6) {
          this.showAuthFeedback('Password must be at least 6 characters.', 'error');
          return;
        }

        try {
          if (authMode === 'signup') {
            LocalAuthManager.register(email, password);
            this.showToast('Account registered and session created!', 'success');
          } else {
            LocalAuthManager.login(email, password);
            this.showToast('Authentication verified!', 'success');
          }
          state.currentUser = LocalAuthManager.getCurrentSession();
          this.showDashboard();
        } catch (err) {
          this.showAuthFeedback(err.message, 'error');
        }
      });
    }

    // Quick Demo Sign In
    const demoQuickBtn = document.getElementById('demoQuickBtn');
    if (demoQuickBtn) {
      demoQuickBtn.addEventListener('click', () => {
        LocalAuthManager.demoLogin();
        state.currentUser = LocalAuthManager.getCurrentSession();
        this.showToast('Authenticated as demo user: nirmal.18@proto.tech', 'success');
        this.showDashboard();
      });
    }

    // Sign Out
    const btnSignOut = document.getElementById('btnSignOut');
    if (btnSignOut) {
      btnSignOut.addEventListener('click', () => {
        LocalAuthManager.logout();
        state.currentUser = null;
        this.showToast('Session terminated.', 'success');
        this.showAuth();
      });
    }

    // Theme Switcher
    const btnThemeSwitch = document.getElementById('btnThemeSwitch');
    if (btnThemeSwitch) {
      btnThemeSwitch.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = state.theme;
        localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
        btnThemeSwitch.textContent = state.theme === 'dark' ? '🌙' : '☀️';
        this.updateChartTheme();
      });
    }

    // SPA View Switcher
    document.querySelectorAll('[data-view-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-view-target]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeView = btn.dataset.viewTarget;
        this.applyViewLayout();
      });
    });

    // Appliance Controls: Turn ON / OFF
    const btnBulbOn = document.getElementById('btnBulbOn');
    const btnBulbOff = document.getElementById('btnBulbOff');

    if (btnBulbOn) {
      btnBulbOn.addEventListener('click', () => {
        this.setBulbState(true, 'Manual switch');
      });
    }

    if (btnBulbOff) {
      btnBulbOff.addEventListener('click', () => {
        this.setBulbState(false, 'Manual switch');
      });
    }

    // Operating Mode Switcher
    const btnModeManual = document.getElementById('btnModeManual');
    const btnModeAuto = document.getElementById('btnModeAuto');

    if (btnModeManual) {
      btnModeManual.addEventListener('click', () => {
        this.setOperatingMode('MANUAL');
      });
    }

    if (btnModeAuto) {
      btnModeAuto.addEventListener('click', () => {
        this.setOperatingMode('AUTOMATIC');
      });
    }

    // Automatic LDR Threshold Slider
    const thresholdRange = document.getElementById('thresholdRange');
    if (thresholdRange) {
      thresholdRange.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        state.ldrThreshold = val;
        document.getElementById('thresholdValDisplay').textContent = val;
        this.persistSettings();
        if (state.operatingMode === 'AUTOMATIC') {
          this.evaluateAutomaticLighting();
        }
      });
    }

    // Telemetry Simulator Toggle
    const simHudToggle = document.getElementById('simHudToggle');
    if (simHudToggle) {
      simHudToggle.addEventListener('click', () => {
        state.simActive = !state.simActive;
        simHudToggle.classList.toggle('paused', !state.simActive);
        simHudToggle.textContent = state.simActive ? 'Telemetry: LIVE' : 'Telemetry: PAUSED';
        if (state.simActive) {
          this.startSimulation();
          this.showToast('ESP32 telemetry simulator active.', 'success');
        } else {
          this.stopSimulation();
          this.showToast('ESP32 telemetry paused.', 'success');
        }
      });
    }

    // Table Search Filter
    const tableSearch = document.getElementById('tableSearch');
    if (tableSearch) {
      tableSearch.addEventListener('input', (e) => {
        state.tableFilterQuery = e.target.value.toLowerCase().trim();
        this.renderHistoryTable();
      });
    }

    // CSV Download
    const btnExportCsv = document.getElementById('btnExportCsv');
    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', () => {
        this.exportCSV();
      });
    }

    // Aux: Add Sample Log
    const btnAddSampleLog = document.getElementById('btnAddSampleLog');
    if (btnAddSampleLog) {
      btnAddSampleLog.addEventListener('click', () => {
        this.addHistoryRecord({
          timestamp: Date.now(),
          temperature: state.currentSensors.temperature,
          humidity: state.currentSensors.humidity,
          ldr: state.currentSensors.ambientLight,
          bulb: state.bulbStatus,
          mode: state.operatingMode
        });
        this.showToast('Current telemetry captured to history.', 'success');
      });
    }

    // Aux: Clear Table
    const btnClearTable = document.getElementById('btnClearTable');
    if (btnClearTable) {
      btnClearTable.addEventListener('click', () => {
        if (confirm('Clear all recorded sensor history?')) {
          state.history = [];
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));
          this.renderHistoryTable();
          this.renderChart();
          this.showToast('History table cleared.', 'success');
        }
      });
    }
  }

  static showAuth() {
    document.getElementById('proAuthView').style.display = 'flex';
    document.getElementById('proAppView').style.display = 'none';
    this.stopSimulation();
  }

  static showDashboard() {
    document.getElementById('proAuthView').style.display = 'none';
    document.getElementById('proAppView').style.display = 'block';

    // Set user email in top bar
    const emailEl = document.getElementById('navbarUserEmail');
    if (emailEl && state.currentUser) {
      emailEl.textContent = state.currentUser.email;
    }

    // Threshold setup
    const thresholdRange = document.getElementById('thresholdRange');
    const thresholdValDisplay = document.getElementById('thresholdValDisplay');
    if (thresholdRange) thresholdRange.value = state.ldrThreshold;
    if (thresholdValDisplay) thresholdValDisplay.textContent = state.ldrThreshold;

    this.renderMetrics();
    this.renderControlUI();
    this.renderHistoryTable();
    this.initChart();
    this.applyViewLayout();

    if (state.simActive) {
      this.startSimulation();
    }
  }

  static applyViewLayout() {
    const page1 = document.getElementById('pageRealtimeHub');
    const page2 = document.getElementById('pageHistoricalHub');
    if (!page1 || !page2) return;

    if (state.activeView === 'controls') {
      page1.style.display = 'flex';
      page2.style.display = 'none';
    } else if (state.activeView === 'history') {
      page1.style.display = 'none';
      page2.style.display = 'flex';
    } else {
      page1.style.display = 'flex';
      page2.style.display = 'flex';
    }
  }

  static setBulbState(isOn, reason = '') {
    state.bulbStatus = isOn;
    this.renderControlUI();
    this.persistSettings();

    // Log state change to history
    this.addHistoryRecord({
      timestamp: Date.now(),
      temperature: state.currentSensors.temperature,
      humidity: state.currentSensors.humidity,
      ldr: state.currentSensors.ambientLight,
      bulb: state.bulbStatus,
      mode: state.operatingMode
    });

    this.showToast(`Bulb turned ${isOn ? 'ON' : 'OFF'} (${reason || state.operatingMode})`, 'success');
  }

  static setOperatingMode(mode) {
    state.operatingMode = mode;
    this.renderControlUI();
    this.renderMetrics();
    this.persistSettings();
    this.showToast(`Operating mode switched to ${mode}`, 'success');

    if (mode === 'AUTOMATIC') {
      this.evaluateAutomaticLighting();
    }
  }

  static evaluateAutomaticLighting() {
    if (state.operatingMode !== 'AUTOMATIC') return;
    // ESP32 Automatic logic: Ambient light below threshold means darkness -> turn Bulb ON
    const isDark = state.currentSensors.ambientLight < state.ldrThreshold;
    if (isDark && !state.bulbStatus) {
      this.setBulbState(true, 'Auto: LDR < Threshold');
    } else if (!isDark && state.bulbStatus) {
      this.setBulbState(false, 'Auto: LDR ≥ Threshold');
    }
  }

  static renderMetrics() {
    const elTemp = document.getElementById('valTemperature');
    const elHum = document.getElementById('valHumidity');
    const elLight = document.getElementById('valAmbientLight');
    const elMode = document.getElementById('valOperatingMode');

    if (elTemp) elTemp.textContent = `${state.currentSensors.temperature.toFixed(1)} °C`;
    if (elHum) elHum.textContent = `${Math.round(state.currentSensors.humidity)} %`;
    if (elLight) elLight.textContent = Math.round(state.currentSensors.ambientLight);
    if (elMode) elMode.textContent = state.operatingMode;
  }

  static renderControlUI() {
    // Main Bulb Status Badge
    const statusBadge = document.getElementById('mainBulbStatusBadge');
    if (statusBadge) {
      statusBadge.textContent = `Status: ${state.bulbStatus ? 'ON' : 'OFF'}`;
      statusBadge.className = `device-status-badge ${state.bulbStatus ? 'on' : 'off'}`;
    }

    // 3D Animated Visual Bulb
    const bulbSvg = document.getElementById('bulbSvgIcon');
    const bulbHalo = document.getElementById('bulbGlowHalo');
    const bulbCaption = document.getElementById('bulbStateCaption');

    if (bulbSvg && bulbHalo && bulbCaption) {
      if (state.bulbStatus) {
        bulbSvg.classList.add('on');
        bulbHalo.classList.add('on');
        bulbCaption.innerHTML = `<h3>Smart Bulb: Energized</h3><p>Relay Pin 26 Active · Emitting warm ambient lighting.</p>`;
      } else {
        bulbSvg.classList.remove('on');
        bulbHalo.classList.remove('on');
        bulbCaption.innerHTML = `<h3>Smart Bulb: Standby</h3><p>Relay Pin 26 Disengaged · Energy saver mode.</p>`;
      }
    }

    // Mode Buttons
    const btnManual = document.getElementById('btnModeManual');
    const btnAuto = document.getElementById('btnModeAuto');
    if (btnManual && btnAuto) {
      if (state.operatingMode === 'MANUAL') {
        btnManual.classList.add('active', 'manual');
        btnAuto.classList.remove('active', 'auto');
      } else {
        btnManual.classList.remove('active', 'manual');
        btnAuto.classList.add('active', 'auto');
      }
    }
  }

  static seedInitialHistory() {
    const now = Date.now();
    const records = [];
    const samplePoints = [
      { temp: 25.8, hum: 71, ldr: 346, bulb: true, mode: 'AUTOMATIC', offset: 12 },
      { temp: 25.8, hum: 71, ldr: 345, bulb: true, mode: 'AUTOMATIC', offset: 10 },
      { temp: 25.5, hum: 70, ldr: 352, bulb: true, mode: 'AUTOMATIC', offset: 8 },
      { temp: 25.7, hum: 70, ldr: 345, bulb: true, mode: 'AUTOMATIC', offset: 6 },
      { temp: 25.8, hum: 70, ldr: 349, bulb: true, mode: 'AUTOMATIC', offset: 4 },
      { temp: 25.8, hum: 70, ldr: 364, bulb: true, mode: 'AUTOMATIC', offset: 2 }
    ];

    samplePoints.forEach(p => {
      records.push({
        timestamp: now - p.offset * 60 * 1000,
        temperature: p.temp,
        humidity: p.hum,
        ldr: p.ldr,
        bulb: p.bulb,
        mode: p.mode
      });
    });

    state.history = records;
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history));
  }

  static addHistoryRecord(record) {
    state.history.unshift(record);
    if (state.history.length > 80) {
      state.history.pop();
    }
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history));
    this.renderHistoryTable();
    this.updateChart();
  }

  static renderHistoryTable() {
    const tbody = document.getElementById('proHistoryTableBody');
    const countEl = document.getElementById('historyCountBadge');
    if (!tbody) return;

    let filtered = state.history;
    if (state.tableFilterQuery) {
      filtered = state.history.filter(r => {
        const dateStr = new Date(r.timestamp).toLocaleString().toLowerCase();
        const modeStr = String(r.mode).toLowerCase();
        const bulbStr = r.bulb ? 'on' : 'off';
        const tempStr = String(r.temperature);
        return dateStr.includes(state.tableFilterQuery) ||
               modeStr.includes(state.tableFilterQuery) ||
               bulbStr.includes(state.tableFilterQuery) ||
               tempStr.includes(state.tableFilterQuery);
      });
    }

    if (countEl) {
      countEl.textContent = `${filtered.length} logs`;
    }

    if (!filtered || filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="table-empty-notice">
            ${state.tableFilterQuery ? 'No matching sensor records found.' : 'No sensor data available.'}
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    filtered.forEach(row => {
      const dt = new Date(row.timestamp);
      const datePart = dt.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timePart = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const bulbBadge = row.bulb
        ? `<span class="table-pill-badge bulb-on">● ON</span>`
        : `<span class="table-pill-badge bulb-off">○ OFF</span>`;

      const modeBadge = row.mode === 'AUTOMATIC'
        ? `<span class="table-pill-badge mode-auto">AUTOMATIC</span>`
        : `<span class="table-pill-badge mode-manual">MANUAL</span>`;

      rowsHtml += `
        <tr>
          <td class="font-mono">${datePart} ${timePart}</td>
          <td class="font-mono"><strong>${Number(row.temperature).toFixed(1)}</strong> °C</td>
          <td class="font-mono"><strong>${Math.round(row.humidity)}</strong> %</td>
          <td class="font-mono">${Math.round(row.ldr)}</td>
          <td>${bulbBadge}</td>
          <td>${modeBadge}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  }

  // --- Dynamic Multi-Line Chart.js ---
  static initChart() {
    const canvas = document.getElementById('proHistoricalChart');
    if (!canvas || !window.Chart) return;

    if (state.chartInstance) {
      state.chartInstance.destroy();
    }

    const { labels, tempData, humData, ldrData } = this.getChartSeries();
    const isDark = state.theme === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const ctx = canvas.getContext('2d');
    state.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Temperature (°C)',
            data: tempData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#3b82f6',
            tension: 0.38,
            fill: true
          },
          {
            label: 'Humidity (%)',
            data: humData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#10b981',
            tension: 0.38,
            fill: true
          },
          {
            label: 'LDR / 10',
            data: ldrData,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#f59e0b',
            tension: 0.38,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false // Centered custom UI legend matches exact request
          },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: '700' },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: function(ctx) {
                const label = ctx.dataset.label || '';
                const val = ctx.parsed.y;
                if (label.includes('LDR / 10')) {
                  return ` ${label}: ${val} (Raw Lux: ${Math.round(val * 10)})`;
                }
                return ` ${label}: ${val}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: { family: 'JetBrains Mono', size: 11 },
              color: textColor,
              maxRotation: 0
            }
          },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            grid: {
              color: gridColor,
              drawBorder: false
            },
            ticks: {
              font: { family: 'JetBrains Mono', size: 11 },
              color: textColor
            }
          }
        }
      }
    });
  }

  static getChartSeries() {
    const ordered = [...state.history].reverse();
    const labels = ordered.map(r => new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const tempData = ordered.map(r => Number(r.temperature));
    const humData = ordered.map(r => Number(r.humidity));
    const ldrData = ordered.map(r => Number((r.ldr / 10).toFixed(1)));
    return { labels, tempData, humData, ldrData };
  }

  static updateChart() {
    if (!state.chartInstance) {
      this.initChart();
      return;
    }
    const { labels, tempData, humData, ldrData } = this.getChartSeries();
    state.chartInstance.data.labels = labels;
    state.chartInstance.data.datasets[0].data = tempData;
    state.chartInstance.data.datasets[1].data = humData;
    state.chartInstance.data.datasets[2].data = ldrData;
    state.chartInstance.update();
  }

  static updateChartTheme() {
    if (state.chartInstance) {
      this.initChart();
    }
  }

  // --- CSV Exporter ---
  static exportCSV() {
    if (!state.history || state.history.length === 0) {
      this.showToast('No sensor history available to export.', 'error');
      return;
    }

    const headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'LDR', 'Bulb', 'Mode'];
    const rows = state.history.map(r => {
      const dateStr = new Date(r.timestamp).toISOString();
      return [
        `"${dateStr}"`,
        r.temperature,
        r.humidity,
        r.ldr,
        r.bulb ? 'ON' : 'OFF',
        r.mode
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smarthome_iot_sensor_history_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.showToast('CSV downloaded to your device!', 'success');
  }

  // --- Telemetry Simulation Engine ---
  static startSimulation() {
    if (state.simTimer) clearInterval(state.simTimer);
    state.simTimer = setInterval(() => {
      const tempDelta = (Math.random() - 0.5) * 0.35;
      const humDelta = (Math.random() - 0.5) * 0.8;
      const ldrDelta = (Math.random() - 0.5) * 14;

      let newTemp = Math.min(38, Math.max(18, state.currentSensors.temperature + tempDelta));
      let newHum = Math.min(92, Math.max(35, state.currentSensors.humidity + humDelta));
      let newLdr = Math.min(950, Math.max(80, state.currentSensors.ambientLight + ldrDelta));

      state.currentSensors = {
        temperature: Number(newTemp.toFixed(1)),
        humidity: Math.round(newHum),
        ambientLight: Math.round(newLdr),
        timestamp: Date.now()
      };

      this.renderMetrics();

      if (state.operatingMode === 'AUTOMATIC') {
        this.evaluateAutomaticLighting();
      }

      // Automatically push periodic telemetry snapshot
      if (Math.random() < 0.25) {
        this.addHistoryRecord({
          timestamp: Date.now(),
          temperature: state.currentSensors.temperature,
          humidity: state.currentSensors.humidity,
          ldr: state.currentSensors.ambientLight,
          bulb: state.bulbStatus,
          mode: state.operatingMode
        });
      }
    }, 2400);
  }

  static stopSimulation() {
    if (state.simTimer) {
      clearInterval(state.simTimer);
      state.simTimer = null;
    }
  }

  static persistSettings() {
    const s = {
      ldrThreshold: state.ldrThreshold,
      operatingMode: state.operatingMode,
      bulbStatus: state.bulbStatus
    };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s));
  }

  // --- Notifications & Feedback ---
  static showToast(message, type = 'success') {
    const container = document.getElementById('proToastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `pro-toast-card ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  static showAuthFeedback(message, type = 'error') {
    const el = document.getElementById('authFeedbackBox');
    if (!el) return;
    el.textContent = message;
    el.className = `auth-feedback-box ${type}`;
  }

  static clearAuthFeedback() {
    const el = document.getElementById('authFeedbackBox');
    if (!el) return;
    el.textContent = '';
    el.className = 'auth-feedback-box';
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  ProDashboardApp.init();
});
