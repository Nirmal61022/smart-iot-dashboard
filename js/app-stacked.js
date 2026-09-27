/**
 * SmartHome IoT Dashboard - Stacked Executive Innovation Engine
 * Stacked vertical boxes (One by one below) with semi-circular radial gauges,
 * smart bulb visualizer, toggle switch, Chart.js trends, event log table, and local auth.
 */

const STORAGE_KEYS = {
  USERS: 'smart_iot_users',
  SESSION: 'smart_iot_session',
  SETTINGS: 'smart_iot_settings',
  HISTORY: 'smart_iot_history'
};

const DEFAULT_DEMO_USER = {
  email: 'nirmal.18@proto.tech',
  password: 'password123',
  registeredAt: new Date().toISOString()
};

const state = {
  currentUser: null,
  bulbStatus: true, // Default ON to match the mockup
  operatingMode: 'AUTOMATIC',
  ldrThreshold: 400,
  currentSensors: {
    temperature: 25.7,
    humidity: 70,
    ambientLight: 353,
    timestamp: Date.now()
  },
  events: [],
  simActive: true,
  simTimer: null,
  chartInstance: null,
  searchQuery: ''
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
    let session = this.getCurrentSession();
    if (!session) {
      // Auto-establish demo session so user immediately sees the stacked dashboard!
      session = this.createSession(DEFAULT_DEMO_USER);
    }
    return session;
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
      throw new Error('Invalid email address or password.');
    }
    return this.createSession(user);
  }

  static demoLogin() {
    return this.createSession(DEFAULT_DEMO_USER);
  }

  static createSession(user) {
    const session = {
      email: user.email,
      token: 'jwt-auth-' + Math.random().toString(36).substring(2),
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
// 2. STACKED DASHBOARD CONTROLLER
// ==========================================
class StackedDashboardApp {
  static init() {
    state.currentUser = LocalAuthManager.init();

    // Load persisted settings
    try {
      const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
      if (savedSettings.ldrThreshold) state.ldrThreshold = Number(savedSettings.ldrThreshold);
      if (savedSettings.operatingMode) state.operatingMode = savedSettings.operatingMode;
      if (savedSettings.bulbStatus !== undefined) state.bulbStatus = Boolean(savedSettings.bulbStatus);
    } catch (e) {}

    // Load persisted history or seed default event trail
    try {
      const savedHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
      state.events = savedHistory;
    } catch (e) {
      state.events = [];
    }

    if (state.events.length === 0) {
      this.seedInitialEvents();
    }

    this.bindEvents();

    if (state.currentUser) {
      this.showDashboard();
    } else {
      this.showAuth();
    }
  }

  static bindEvents() {
    // Auth Modal
    const tabSignIn = document.getElementById('authTabSignIn');
    const tabSignUp = document.getElementById('authTabSignUp');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    let authMode = 'signin';

    if (tabSignIn && tabSignUp) {
      tabSignIn.addEventListener('click', () => {
        authMode = 'signin';
        tabSignIn.classList.add('active');
        tabSignUp.classList.remove('active');
        authSubmitBtn.textContent = 'Sign In';
        this.clearAuthAlert();
      });

      tabSignUp.addEventListener('click', () => {
        authMode = 'signup';
        tabSignUp.classList.add('active');
        tabSignIn.classList.remove('active');
        authSubmitBtn.textContent = 'Create Account';
        this.clearAuthAlert();
      });
    }

    const authForm = document.getElementById('authPopupForm');
    if (authForm) {
      authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmailInput').value.trim();
        const password = document.getElementById('authPasswordInput').value;

        if (!email || !password) {
          this.showAuthAlert('Please fill in both fields.', 'error');
          return;
        }

        try {
          if (authMode === 'signup') {
            LocalAuthManager.register(email, password);
            this.showToast('Account registered! Session active.', 'success');
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

    // Quick Demo Login
    const btnDemoQuick = document.getElementById('btnDemoQuick');
    if (btnDemoQuick) {
      btnDemoQuick.addEventListener('click', () => {
        LocalAuthManager.demoLogin();
        state.currentUser = LocalAuthManager.getCurrentSession();
        this.showToast('Logged in as demo user: nirmal.18@proto.tech', 'success');
        this.showDashboard();
      });
    }

    // Sign Out
    const btnSignOut = document.getElementById('btnSignOut');
    if (btnSignOut) {
      btnSignOut.addEventListener('click', () => {
        LocalAuthManager.logout();
        state.currentUser = null;
        this.showToast('Session logged out.', 'success');
        this.showAuth();
      });
    }

    // Interactive Toggle Switch
    const bigToggleWrap = document.getElementById('bigToggleWrap');
    if (bigToggleWrap) {
      bigToggleWrap.addEventListener('click', () => {
        this.setBulbState(!state.bulbStatus, 'Toggle Switch');
      });
    }

    // Turn ON & Turn OFF Buttons
    const btnTurnOn = document.getElementById('btnTurnOn');
    const btnTurnOff = document.getElementById('btnTurnOff');

    if (btnTurnOn) {
      btnTurnOn.addEventListener('click', () => {
        this.setBulbState(true, 'Bulb manually turned ON');
      });
    }

    if (btnTurnOff) {
      btnTurnOff.addEventListener('click', () => {
        this.setBulbState(false, 'Bulb manually turned OFF');
      });
    }

    // Manual / Automatic Mode Buttons
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

    // Automatic Threshold Slider
    const thresholdSlider = document.getElementById('thresholdSlider');
    if (thresholdSlider) {
      thresholdSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        state.ldrThreshold = val;
        document.getElementById('thresholdValueNum').textContent = val;
        this.persistSettings();
        if (state.operatingMode === 'AUTOMATIC') {
          this.evaluateAutomaticLighting();
        }
      });
    }

    // Event Log Search Input
    const eventSearchInput = document.getElementById('eventSearchInput');
    if (eventSearchInput) {
      eventSearchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        this.renderEventTable();
      });
    }

    // Download CSV
    const btnDownloadCsv = document.getElementById('btnDownloadCsv');
    if (btnDownloadCsv) {
      btnDownloadCsv.addEventListener('click', () => {
        this.downloadCSV();
      });
    }

    // Telemetry Simulator Toggle
    const simPill = document.getElementById('simTelemetryPill');
    if (simPill) {
      simPill.addEventListener('click', () => {
        state.simActive = !state.simActive;
        simPill.textContent = state.simActive ? 'ESP32 Simulator: Telemetry: ON' : 'ESP32 Simulator: Telemetry: PAUSED';
        simPill.style.color = state.simActive ? '#22c55e' : '#f59e0b';
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
    document.getElementById('authPopupOverlay').style.display = 'flex';
    this.stopSimulation();
  }

  static showDashboard() {
    document.getElementById('authPopupOverlay').style.display = 'none';

    // Set user email
    const emailEl = document.getElementById('userEmailDisplay');
    if (emailEl && state.currentUser) {
      emailEl.textContent = state.currentUser.email;
    }

    // Threshold values
    const thresholdSlider = document.getElementById('thresholdSlider');
    const thresholdValueNum = document.getElementById('thresholdValueNum');
    if (thresholdSlider) thresholdSlider.value = state.ldrThreshold;
    if (thresholdValueNum) thresholdValueNum.textContent = state.ldrThreshold;

    this.renderGauges();
    this.renderApplianceControls();
    this.renderEventTable();
    this.initChart();

    if (state.simActive) {
      this.startSimulation();
    }
  }

  static setBulbState(isOn, reason = '') {
    state.bulbStatus = isOn;
    this.renderApplianceControls();
    this.persistSettings();

    this.addEventRecord({
      timestamp: Date.now(),
      temperature: state.currentSensors.temperature,
      humidity: state.currentSensors.humidity,
      ldr: state.currentSensors.ambientLight,
      bulb: state.bulbStatus,
      mode: state.operatingMode,
      description: reason || (isOn ? 'Bulb turned ON' : 'Bulb turned OFF')
    });

    this.showToast(`Bulb state set to ${isOn ? 'ON' : 'OFF'} (${reason || state.operatingMode})`, 'success');
  }

  static setOperatingMode(mode) {
    state.operatingMode = mode;
    this.renderApplianceControls();
    this.renderGauges();
    this.persistSettings();

    this.addEventRecord({
      timestamp: Date.now(),
      temperature: state.currentSensors.temperature,
      humidity: state.currentSensors.humidity,
      ldr: state.currentSensors.ambientLight,
      bulb: state.bulbStatus,
      mode: state.operatingMode,
      description: `Operating Mode switched to ${mode}`
    });

    this.showToast(`Operating Mode: ${mode}`, 'success');

    if (mode === 'AUTOMATIC') {
      this.evaluateAutomaticLighting();
    }
  }

  static evaluateAutomaticLighting() {
    if (state.operatingMode !== 'AUTOMATIC') return;
    const isDark = state.currentSensors.ambientLight < state.ldrThreshold;
    if (isDark && !state.bulbStatus) {
      this.setBulbState(true, `Automatic mode triggered: LDR ${Math.round(state.currentSensors.ambientLight)} < ${state.ldrThreshold}`);
    } else if (!isDark && state.bulbStatus) {
      this.setBulbState(false, `Automatic mode triggered: LDR ${Math.round(state.currentSensors.ambientLight)} ≥ ${state.ldrThreshold}`);
    }
  }

  // --- Render Semi-Circular Gauges ---
  static renderGauges() {
    const tempText = document.getElementById('tempGaugeVal');
    const humText = document.getElementById('humGaugeVal');
    const lightText = document.getElementById('ambientLightVal');
    const modeText = document.getElementById('operatingModeDisplay');

    if (tempText) tempText.textContent = `${state.currentSensors.temperature.toFixed(1)} °C`;
    if (humText) humText.textContent = `${Math.round(state.currentSensors.humidity)} %`;
    if (lightText) lightText.textContent = Math.round(state.currentSensors.ambientLight);
    if (modeText) modeText.textContent = state.operatingMode;

    // Semi-circle arc length (r=56, circumference of semicircle is π * 56 ≈ 175.9)
    const arcLength = 175.9;
    const tempRatio = Math.min(1, Math.max(0, (state.currentSensors.temperature - 10) / 40));
    const humRatio = Math.min(1, Math.max(0, state.currentSensors.humidity / 100));

    const tempPath = document.getElementById('tempArcForeground');
    const humPath = document.getElementById('humArcForeground');

    if (tempPath) tempPath.style.strokeDashoffset = arcLength * (1 - tempRatio);
    if (humPath) humPath.style.strokeDashoffset = arcLength * (1 - humRatio);
  }

  static renderApplianceControls() {
    // Smart Bulb Hero Artwork & Badge
    const bulbSvg = document.getElementById('bulbHeroSvg');
    const bulbHalo = document.getElementById('bulbHeroHalo');
    const bulbBadge = document.getElementById('bulbPowerBadge');

    if (bulbSvg && bulbHalo && bulbBadge) {
      if (state.bulbStatus) {
        bulbSvg.classList.add('on');
        bulbHalo.classList.add('on');
        bulbBadge.textContent = 'POWER ON';
        bulbBadge.className = 'bulb-power-badge on';
      } else {
        bulbSvg.classList.remove('on');
        bulbHalo.classList.remove('on');
        bulbBadge.textContent = 'POWER OFF';
        bulbBadge.className = 'bulb-power-badge';
      }
    }

    // Big Toggle Switch
    const toggleTrack = document.getElementById('bigToggleTrack');
    const toggleCaption = document.getElementById('toggleStatusCaption');
    if (toggleTrack && toggleCaption) {
      if (state.bulbStatus) {
        toggleTrack.classList.add('on');
        toggleCaption.textContent = 'ON';
      } else {
        toggleTrack.classList.remove('on');
        toggleCaption.textContent = 'OFF';
      }
    }

    // Mode Buttons
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

  static seedInitialEvents() {
    const now = Date.now();
    const records = [
      { temp: 25.5, hum: 70, ldr: 352, bulb: true, mode: 'AUTOMATIC', desc: 'Automatic mode triggered', offset: 12 },
      { temp: 25.7, hum: 70, ldr: 345, bulb: true, mode: 'AUTOMATIC', desc: 'Automatic mode triggered', offset: 10 },
      { temp: 25.8, hum: 70, ldr: 349, bulb: true, mode: 'AUTOMATIC', desc: 'Bulb manually turned ON', offset: 8 },
      { temp: 25.8, hum: 71, ldr: 345, bulb: true, mode: 'AUTOMATIC', desc: 'Automatic mode triggered', offset: 6 },
      { temp: 25.8, hum: 71, ldr: 346, bulb: true, mode: 'AUTOMATIC', desc: 'Temperature threshold crossed', offset: 4 },
      { temp: 25.7, hum: 70, ldr: 353, bulb: true, mode: 'AUTOMATIC', desc: 'Automatic mode triggered', offset: 2 }
    ];

    state.events = records.map(p => ({
      timestamp: now - p.offset * 60 * 1000,
      temperature: p.temp,
      humidity: p.hum,
      ldr: p.ldr,
      bulb: p.bulb,
      mode: p.mode,
      description: p.desc
    }));

    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.events));
  }

  static addEventRecord(rec) {
    state.events.unshift(rec);
    if (state.events.length > 80) state.events.pop();
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.events));
    this.renderEventTable();
    this.updateChart();
  }

  static renderEventTable() {
    const tbody = document.getElementById('comprehensiveEventTableBody');
    const badge = document.getElementById('eventCountBadge');
    if (!tbody) return;

    let filtered = state.events;
    if (state.searchQuery) {
      filtered = state.events.filter(e => {
        const dt = new Date(e.timestamp).toLocaleString().toLowerCase();
        const mode = String(e.mode).toLowerCase();
        const desc = String(e.description || '').toLowerCase();
        return dt.includes(state.searchQuery) || mode.includes(state.searchQuery) || desc.includes(state.searchQuery);
      });
    }

    if (badge) badge.textContent = `${filtered.length} Events`;

    if (!filtered || filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 24px; color: #64748b;">
            ${state.searchQuery ? 'No matching logs found.' : 'No event history recorded yet.'}
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

      const bulbChip = row.bulb
        ? `<span class="chip-status on">ON</span>`
        : `<span class="chip-status off">OFF</span>`;

      const modeChip = row.mode === 'AUTOMATIC'
        ? `<span class="chip-status auto">AUTOMATIC</span>`
        : `<span class="chip-status man">MANUAL</span>`;

      rowsHtml += `
        <tr>
          <td class="font-mono">${datePart} ${timePart}</td>
          <td class="font-mono">${Number(row.temperature).toFixed(1)} °C</td>
          <td class="font-mono">${Math.round(row.humidity)} %</td>
          <td class="font-mono">${Math.round(row.ldr)}</td>
          <td>${bulbChip}</td>
          <td>${modeChip}</td>
          <td class="event-desc-cell">${row.description || 'Routine Telemetry'}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  }

  // --- Historical Analytics Chart.js ---
  static initChart() {
    const canvas = document.getElementById('stackedAnalyticsChart');
    if (!canvas || !window.Chart) return;

    if (state.chartInstance) state.chartInstance.destroy();

    const { labels, tempData, humData, ldrData } = this.getChartSeries();
    const ctx = canvas.getContext('2d');

    state.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Temperature',
            data: tempData,
            borderColor: '#3b82f6',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2.5,
            pointBackgroundColor: '#3b82f6',
            tension: 0.35
          },
          {
            label: 'Humidity',
            data: humData,
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2.5,
            pointBackgroundColor: '#10b981',
            tension: 0.35
          },
          {
            label: 'LDR/10',
            data: ldrData,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2.5,
            pointBackgroundColor: '#f59e0b',
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleFont: { size: 11 },
            bodyFont: { size: 11 },
            padding: 8
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, color: '#64748b', maxRotation: 0 }
          },
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 10, font: { size: 10 }, color: '#64748b' },
            grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }
          }
        }
      }
    });
  }

  static getChartSeries() {
    const ordered = [...state.events].reverse();
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

  // --- CSV Export ---
  static downloadCSV() {
    if (!state.events || state.events.length === 0) {
      this.showToast('No event records available to export.', 'error');
      return;
    }

    const headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'LDR', 'Bulb', 'Mode', 'Event Description'];
    const rows = state.events.map(r => {
      const dt = new Date(r.timestamp).toISOString();
      return [
        `"${dt}"`,
        r.temperature,
        r.humidity,
        r.ldr,
        r.bulb ? 'ON' : 'OFF',
        r.mode,
        `"${(r.description || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smarthome_comprehensive_events_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.showToast('CSV downloaded to device!', 'success');
  }

  // --- Live Simulation Engine ---
  static startSimulation() {
    if (state.simTimer) clearInterval(state.simTimer);
    state.simTimer = setInterval(() => {
      const tempDelta = (Math.random() - 0.5) * 0.3;
      const humDelta = (Math.random() - 0.5) * 0.8;
      const ldrDelta = (Math.random() - 0.5) * 12;

      let newTemp = Math.min(38, Math.max(18, state.currentSensors.temperature + tempDelta));
      let newHum = Math.min(95, Math.max(30, state.currentSensors.humidity + humDelta));
      let newLdr = Math.min(950, Math.max(80, state.currentSensors.ambientLight + ldrDelta));

      state.currentSensors = {
        temperature: Number(newTemp.toFixed(1)),
        humidity: Math.round(newHum),
        ambientLight: Math.round(newLdr),
        timestamp: Date.now()
      };

      this.renderGauges();

      if (state.operatingMode === 'AUTOMATIC') {
        this.evaluateAutomaticLighting();
      }

      if (Math.random() < 0.22) {
        this.addEventRecord({
          timestamp: Date.now(),
          temperature: state.currentSensors.temperature,
          humidity: state.currentSensors.humidity,
          ldr: state.currentSensors.ambientLight,
          bulb: state.bulbStatus,
          mode: state.operatingMode,
          description: state.operatingMode === 'AUTOMATIC' ? 'Automatic mode triggered' : 'Routine sensor log'
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

  static showToast(msg, type = 'success') {
    const container = document.getElementById('stackedToastHost');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'stacked-toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  static showAuthAlert(msg, type = 'error') {
    const el = document.getElementById('authAlertPopup');
    if (!el) return;
    el.textContent = msg;
    el.className = `auth-alert-popup ${type}`;
  }

  static clearAuthAlert() {
    const el = document.getElementById('authAlertPopup');
    if (!el) return;
    el.textContent = '';
    el.className = 'auth-alert-popup';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  StackedDashboardApp.init();
});
