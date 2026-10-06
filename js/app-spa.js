/**
 * SmartHome IoT Dashboard - SPA Core Application Logic
 * Implements LocalStorage Auth, Real-Time Controls, Sensor Simulation,
 * Chart.js Historical Data, History Table & CSV Export.
 */

// ==========================================
// 1. STATE & STORAGE MANAGEMENT
// ==========================================
const STORAGE_KEYS = {
  USERS: 'smart_iot_users',
  SESSION: 'smart_iot_session',
  SETTINGS: 'smart_iot_settings',
  HISTORY: 'smart_iot_history'
};

// Initial default user for instant access/testing
const DEFAULT_DEMO_USER = {
  email: 'nirmal.18@proto.tech',
  password: 'password123',
  registeredAt: new Date().toISOString()
};

// Application State
const state = {
  currentUser: null,
  activeView: 'both', // 'controls', 'history', 'both'
  isConnected: true,
  bulbStatus: false, // false = OFF, true = ON
  operatingMode: 'MANUAL', // 'MANUAL' or 'AUTOMATIC'
  ldrThreshold: 400,
  currentSensors: {
    temperature: 26.4,
    humidity: 62,
    ambientLight: 385,
    timestamp: Date.now()
  },
  history: [],
  simActive: true,
  simTimer: null,
  chartInstance: null
};

// ==========================================
// 2. AUTHENTICATION MODULE (LocalStorage)
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
      throw new Error('An account with this email already exists.');
    }
    const newUser = {
      email,
      password,
      registeredAt: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.createSession(newUser);
    return newUser;
  }

  static login(email, password) {
    email = email.trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email && u.password === password);
    if (!user) {
      // If user tries demo account password or demo user
      if (email === DEFAULT_DEMO_USER.email.toLowerCase() && password === DEFAULT_DEMO_USER.password) {
        this.createSession(DEFAULT_DEMO_USER);
        return DEFAULT_DEMO_USER;
      }
      throw new Error('Invalid email or password.');
    }
    this.createSession(user);
    return user;
  }

  static demoLogin() {
    this.createSession(DEFAULT_DEMO_USER);
    return DEFAULT_DEMO_USER;
  }

  static createSession(user) {
    const session = {
      email: user.email,
      token: 'mock-firebase-token-' + Math.random().toString(36).substring(2),
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
// 3. UI RENDERING & CONTROLLER
// ==========================================
class DashboardApp {
  static init() {
    // Check Authentication
    state.currentUser = LocalAuthManager.init();

    // Load persisted settings
    try {
      const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
      if (savedSettings.ldrThreshold) state.ldrThreshold = Number(savedSettings.ldrThreshold);
      if (savedSettings.operatingMode) state.operatingMode = savedSettings.operatingMode;
      if (savedSettings.bulbStatus !== undefined) state.bulbStatus = Boolean(savedSettings.bulbStatus);
    } catch (e) {}

    // Load persisted history (or initialize with a few sample entries)
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

    // Check if user is logged in
    if (state.currentUser) {
      this.showDashboard();
    } else {
      this.showAuth();
    }
  }

  static bindEvents() {
    // --- Auth Tab Switching ---
    const signinTabBtn = document.getElementById('tabSignIn');
    const signupTabBtn = document.getElementById('tabSignUp');
    const authForm = document.getElementById('authForm');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    let currentAuthMode = 'signin';

    if (signinTabBtn && signupTabBtn) {
      signinTabBtn.addEventListener('click', () => {
        currentAuthMode = 'signin';
        signinTabBtn.classList.add('active');
        signupTabBtn.classList.remove('active');
        authTitle.textContent = 'Welcome back';
        authSubtitle.textContent = 'Sign in to access your IoT Dashboard.';
        authSubmitBtn.textContent = 'Sign In';
        this.clearAuthAlert();
      });

      signupTabBtn.addEventListener('click', () => {
        currentAuthMode = 'signup';
        signupTabBtn.classList.add('active');
        signinTabBtn.classList.remove('active');
        authTitle.textContent = 'Create an Account';
        authSubtitle.textContent = 'Credentials will be saved in your browser storage.';
        authSubmitBtn.textContent = 'Create Account';
        this.clearAuthAlert();
      });
    }

    // Password visibility toggle
    const togglePassBtn = document.getElementById('togglePassword');
    const passInput = document.getElementById('authPassword');
    if (togglePassBtn && passInput) {
      togglePassBtn.addEventListener('click', () => {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        togglePassBtn.textContent = isPass ? 'Hide' : 'Show';
      });
    }

    // Auth Form Submit
    if (authForm) {
      authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;

        if (!email || !password) {
          this.showAuthAlert('Please enter both email and password.', 'error');
          return;
        }

        if (password.length < 6) {
          this.showAuthAlert('Password must be at least 6 characters.', 'error');
          return;
        }

        try {
          if (currentAuthMode === 'signup') {
            LocalAuthManager.register(email, password);
            this.showToast('Account registered successfully!', 'success');
          } else {
            LocalAuthManager.login(email, password);
            this.showToast('Signed in successfully!', 'success');
          }
          state.currentUser = LocalAuthManager.getCurrentSession();
          this.showDashboard();
        } catch (err) {
          this.showAuthAlert(err.message, 'error');
        }
      });
    }

    // Quick Demo Sign In Button
    const demoBtn = document.getElementById('demoSignInBtn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        LocalAuthManager.demoLogin();
        state.currentUser = LocalAuthManager.getCurrentSession();
        this.showToast('Logged in as demo user: nirmal.18@proto.tech', 'success');
        this.showDashboard();
      });
    }

    // Sign Out Button
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => {
        LocalAuthManager.logout();
        state.currentUser = null;
        this.showToast('Signed out.', 'success');
        this.showAuth();
      });
    }

    // --- Navigation Tabs (SPA View Switching) ---
    document.querySelectorAll('[data-spa-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-spa-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeView = btn.dataset.spaView;
        this.applyViewFilter();
      });
    });

    // --- Appliance Controls ---
    const btnTurnOn = document.getElementById('btnTurnOn');
    const btnTurnOff = document.getElementById('btnTurnOff');
    const btnModeManual = document.getElementById('btnModeManual');
    const btnModeAuto = document.getElementById('btnModeAuto');

    if (btnTurnOn) {
      btnTurnOn.addEventListener('click', () => {
        this.setBulbState(true, 'Manual override');
      });
    }

    if (btnTurnOff) {
      btnTurnOff.addEventListener('click', () => {
        this.setBulbState(false, 'Manual override');
      });
    }

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

    // Threshold Slider
    const thresholdSlider = document.getElementById('thresholdSlider');
    if (thresholdSlider) {
      thresholdSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        state.ldrThreshold = val;
        document.getElementById('thresholdVal').textContent = val;
        document.getElementById('thresholdSliderVal').textContent = val;
        this.persistSettings();
        if (state.operatingMode === 'AUTOMATIC') {
          this.evaluateAutomaticLighting();
        }
      });
    }

    // CSV Download
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    if (downloadCsvBtn) {
      downloadCsvBtn.addEventListener('click', () => {
        this.downloadCSV();
      });
    }

    // Aux Action: Clear History
    const btnClearHistory = document.getElementById('btnClearHistory');
    if (btnClearHistory) {
      btnClearHistory.addEventListener('click', () => {
        if (confirm('Clear all historical sensor records?')) {
          state.history = [];
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));
          this.renderHistoryTable();
          this.renderChart();
          this.showToast('Sensor history cleared.', 'success');
        }
      });
    }

    // Aux Action: Seed Sample History
    const btnSeedHistory = document.getElementById('btnSeedHistory');
    if (btnSeedHistory) {
      btnSeedHistory.addEventListener('click', () => {
        this.seedInitialHistory();
        this.renderHistoryTable();
        this.renderChart();
        this.showToast('Sample sensor history generated.', 'success');
      });
    }

    // Simulation Toggle
    const simToggleBtn = document.getElementById('simToggleBtn');
    if (simToggleBtn) {
      simToggleBtn.addEventListener('click', () => {
        state.simActive = !state.simActive;
        simToggleBtn.classList.toggle('active', state.simActive);
        simToggleBtn.textContent = state.simActive ? 'Telemetry: ON' : 'Telemetry: PAUSED';
        if (state.simActive) {
          this.startSimulation();
          this.showToast('ESP32 telemetry simulator active.', 'success');
        } else {
          this.stopSimulation();
          this.showToast('ESP32 telemetry paused.', 'success');
        }
      });
    }
  }

  static showAuth() {
    document.getElementById('authView').style.display = 'flex';
    document.getElementById('appView').style.display = 'none';
    this.stopSimulation();
  }

  static showDashboard() {
    document.getElementById('authView').style.display = 'none';
    document.getElementById('appView').style.display = 'block';

    // Set user email in navbar
    const emailEl = document.getElementById('navbarUserEmail');
    if (emailEl && state.currentUser) {
      emailEl.textContent = state.currentUser.email;
    }

    // Update threshold elements
    const thresholdValEl = document.getElementById('thresholdVal');
    const thresholdSlider = document.getElementById('thresholdSlider');
    const thresholdSliderVal = document.getElementById('thresholdSliderVal');
    if (thresholdValEl) thresholdValEl.textContent = state.ldrThreshold;
    if (thresholdSlider) thresholdSlider.value = state.ldrThreshold;
    if (thresholdSliderVal) thresholdSliderVal.textContent = state.ldrThreshold;

    this.renderMetrics();
    this.renderControlUI();
    this.renderHistoryTable();
    this.initChart();
    this.applyViewFilter();

    if (state.simActive) {
      this.startSimulation();
    }
  }

  static applyViewFilter() {
    const page1 = document.getElementById('pageRealtimeSection');
    const page2 = document.getElementById('pageHistoricalSection');
    if (!page1 || !page2) return;

    if (state.activeView === 'controls') {
      page1.style.display = 'flex';
      page2.style.display = 'none';
    } else if (state.activeView === 'history') {
      page1.style.display = 'none';
      page2.style.display = 'flex';
    } else {
      // 'both'
      page1.style.display = 'flex';
      page2.style.display = 'flex';
    }
  }

  static setBulbState(isOn, reason = '') {
    state.bulbStatus = isOn;
    this.renderControlUI();
    this.persistSettings();
    
    // Log event in history
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
    this.showToast(`Operating mode set to ${mode}`, 'success');

    if (mode === 'AUTOMATIC') {
      this.evaluateAutomaticLighting();
    }
  }

  static evaluateAutomaticLighting() {
    if (state.operatingMode !== 'AUTOMATIC') return;
    // Automatic decision: if LDR < Threshold (Dark environment) -> Turn bulb ON
    // If LDR >= Threshold (Bright environment) -> Turn bulb OFF
    const isDark = state.currentSensors.ambientLight < state.ldrThreshold;
    if (isDark && !state.bulbStatus) {
      this.setBulbState(true, 'Auto: LDR < Threshold');
    } else if (!isDark && state.bulbStatus) {
      this.setBulbState(false, 'Auto: LDR >= Threshold');
    }
  }

  static renderMetrics() {
    const tempEl = document.getElementById('metricTemp');
    const humEl = document.getElementById('metricHum');
    const lightEl = document.getElementById('metricLight');
    const modeEl = document.getElementById('metricMode');

    if (tempEl) tempEl.textContent = `${state.currentSensors.temperature.toFixed(1)} °C`;
    if (humEl) humEl.textContent = `${Math.round(state.currentSensors.humidity)} %`;
    if (lightEl) lightEl.textContent = Math.round(state.currentSensors.ambientLight);
    if (modeEl) modeEl.textContent = state.operatingMode;
  }

  static renderControlUI() {
    const statusText = document.getElementById('bulbStatusText');
    if (statusText) {
      statusText.textContent = state.bulbStatus ? 'ON' : 'OFF';
      statusText.className = 'control-status-text ' + (state.bulbStatus ? 'on' : 'off');
    }

    const btnManual = document.getElementById('btnModeManual');
    const btnAuto = document.getElementById('btnModeAuto');
    if (btnManual && btnAuto) {
      if (state.operatingMode === 'MANUAL') {
        btnManual.classList.add('active');
        btnAuto.classList.remove('active');
      } else {
        btnManual.classList.remove('active');
        btnAuto.classList.add('active');
      }
    }
  }

  static seedInitialHistory() {
    const now = Date.now();
    const records = [];
    const samplePoints = [
      { temp: 25.8, hum: 60, ldr: 430, bulb: false, mode: 'MANUAL', offset: 12 },
      { temp: 26.0, hum: 61, ldr: 425, bulb: false, mode: 'MANUAL', offset: 10 },
      { temp: 26.2, hum: 62, ldr: 410, bulb: false, mode: 'MANUAL', offset: 8 },
      { temp: 26.4, hum: 62, ldr: 395, bulb: true,  mode: 'AUTOMATIC', offset: 6 },
      { temp: 26.5, hum: 63, ldr: 380, bulb: true,  mode: 'AUTOMATIC', offset: 4 },
      { temp: 26.4, hum: 62, ldr: 385, bulb: true,  mode: 'AUTOMATIC', offset: 2 }
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
    if (state.history.length > 50) {
      state.history.pop();
    }
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history));
    this.renderHistoryTable();
    this.updateChart();
  }

  static renderHistoryTable() {
    const tbody = document.getElementById('sensorHistoryBody');
    if (!tbody) return;

    if (!state.history || state.history.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="table-empty-row">No sensor data available.</td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    state.history.forEach(row => {
      const dateStr = new Date(row.timestamp).toLocaleDateString([], {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timeStr = new Date(row.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const fullDate = `${dateStr} ${timeStr}`;

      const bulbBadge = row.bulb
        ? `<span class="status-badge on">ON</span>`
        : `<span class="status-badge off">OFF</span>`;

      const modeBadge = row.mode === 'AUTOMATIC'
        ? `<span class="mode-badge automatic">AUTOMATIC</span>`
        : `<span class="mode-badge manual">MANUAL</span>`;

      rowsHtml += `
        <tr>
          <td>${fullDate}</td>
          <td>${Number(row.temperature).toFixed(1)}</td>
          <td>${Math.round(row.humidity)}</td>
          <td>${Math.round(row.ldr)}</td>
          <td>${bulbBadge}</td>
          <td>${modeBadge}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  }

  // --- Historical Chart (Chart.js) ---
  static initChart() {
    const canvas = document.getElementById('historicalSensorChart');
    if (!canvas || !window.Chart) return;

    if (state.chartInstance) {
      state.chartInstance.destroy();
    }

    const { labels, tempData, humData, ldrData } = this.getChartData();

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
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.35,
            fill: false
          },
          {
            label: 'Humidity (%)',
            data: humData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.35,
            fill: false
          },
          {
            label: 'LDR / 10',
            data: ldrData,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.35,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false // Using our custom centered legend to match Screenshot 1!
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { family: 'Inter', size: 12 },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                let val = context.parsed.y;
                if (label.includes('LDR / 10')) {
                  return `LDR: ${val * 10} (${label}: ${val})`;
                }
                return `${label}: ${val}`;
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
              font: { family: 'Inter', size: 11 },
              color: '#94a3b8'
            }
          },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            grid: {
              color: 'rgba(226, 232, 240, 0.8)',
              drawBorder: false
            },
            ticks: {
              font: { family: 'Inter', size: 11 },
              color: '#94a3b8'
            }
          }
        }
      }
    });
  }

  static getChartData() {
    // Reverse historical records to display chronologically (oldest -> newest)
    const records = [...state.history].reverse();
    const labels = records.map(r => new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const tempData = records.map(r => Number(r.temperature));
    const humData = records.map(r => Number(r.humidity));
    const ldrData = records.map(r => Number((r.ldr / 10).toFixed(1)));
    return { labels, tempData, humData, ldrData };
  }

  static updateChart() {
    if (!state.chartInstance) {
      this.initChart();
      return;
    }
    const { labels, tempData, humData, ldrData } = this.getChartData();
    state.chartInstance.data.labels = labels;
    state.chartInstance.data.datasets[0].data = tempData;
    state.chartInstance.data.datasets[1].data = humData;
    state.chartInstance.data.datasets[2].data = ldrData;
    state.chartInstance.update();
  }

  // --- CSV Exporter ---
  static downloadCSV() {
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
    link.setAttribute('href', url);
    link.setAttribute('download', `smart_iot_sensor_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.showToast('CSV downloaded successfully!', 'success');
  }

  // --- Real-Time Telemetry Simulation ---
  static startSimulation() {
    if (state.simTimer) clearInterval(state.simTimer);
    state.simTimer = setInterval(() => {
      // Simulate natural small variations
      const tempDelta = (Math.random() - 0.5) * 0.4;
      const humDelta = (Math.random() - 0.5) * 1.2;
      const ldrDelta = (Math.random() - 0.5) * 12;

      let newTemp = Math.min(40, Math.max(15, state.currentSensors.temperature + tempDelta));
      let newHum = Math.min(95, Math.max(30, state.currentSensors.humidity + humDelta));
      let newLdr = Math.min(1024, Math.max(50, state.currentSensors.ambientLight + ldrDelta));

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

      // Periodically append a historical entry every ~20 seconds
      if (Math.random() < 0.2) {
        this.addHistoryRecord({
          timestamp: Date.now(),
          temperature: state.currentSensors.temperature,
          humidity: state.currentSensors.humidity,
          ldr: state.currentSensors.ambientLight,
          bulb: state.bulbStatus,
          mode: state.operatingMode
        });
      }
    }, 2500);
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

  // --- Toast Alerts ---
  static showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  static showAuthAlert(message, type = 'error') {
    const alertEl = document.getElementById('authAlert');
    if (!alertEl) return;
    alertEl.textContent = message;
    alertEl.className = `auth-alert ${type}`;
  }

  static clearAuthAlert() {
    const alertEl = document.getElementById('authAlert');
    if (!alertEl) return;
    alertEl.textContent = '';
    alertEl.className = 'auth-alert';
  }
}

// Bootstrap Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  DashboardApp.init();
});
