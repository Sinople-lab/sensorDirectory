const SHELLY_STATUS_URL = "https://shelly-266-eu.shelly.cloud/device/status";

const params = new URLSearchParams(window.location.search);
const DEVICE_ID = params.get("id");
const AUTH_KEY = params.get("auth_key");
const DEVICE_LOCATION = params.get("location");

const $ = (id) => document.getElementById(id);

const fmt = (val, decimals = 1) => {
  if (val === null || val === undefined) return "—";
  return Number(val).toFixed(decimals);
};

const showToast = (msg, type = "") => {
  const toast = $("toast");
  toast.textContent = msg;
  toast.className = "toast show " + type;
  setTimeout(() => toast.classList.remove("show"), 1000);
};

const setStatus = (online) => {
  const pill = $("statusPill");
  const label = pill.querySelector(".status-label");
  const alarm = $("alarm");
  const alarmLabel = $("alarmLabel");
  if (online) {
    pill.className = "status-pill online";
    label.textContent = "Online";
    alarm.className = "alarm online";
    alarmLabel.textContent = "ONLINE";
  } else {
    pill.className = "status-pill offline";
    label.textContent = "Offline";
    alarm.className = "alarm offline";
    alarmLabel.textContent = "OFFLINE";
  }
};

const renderHero = (em, emdata) => {
  $("totalPower").textContent = fmt(em.total_act_power / 1000, 2);
  $("totalCurrent").textContent = `${fmt(em.total_current, 3)} A Corriente total`;
  $("totalAprt").textContent = fmt(em.total_aprt_power / 1000, 2);
  $("totalEnergy").textContent = fmt(emdata.total_act / 1000, 2);
  $("totalReturned").textContent = fmt(emdata.total_act_ret, 0);
};

const renderPhase = (phase, label) => {
  const card = document.createElement("div");
  card.className = "phase-card";
  card.dataset.phase = phase;
  card.innerHTML = `
    <div class="phase-header">
      <span class="phase-name">Fase ${label}</span>
      <span><span class="phase-power">${fmt(em[`${phase}_act_power`], 2)}</span><span class="phase-power-unit"> W</span></span>
    </div>
    <div class="phase-metrics">
      <div class="metric">
        <span class="metric-label">Voltaje</span>
        <span class="metric-value">${fmt(em[`${phase}_voltage`], 1)} V</span>
      </div>
      <div class="metric">
        <span class="metric-label">Corriente</span>
        <span class="metric-value">${fmt(em[`${phase}_current`], 3)} A</span>
      </div>
      <div class="metric">
        <span class="metric-label">Factor de Potencia</span>
        <span class="metric-value">${fmt(em[`${phase}_pf`], 2)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Frecuencia</span>
        <span class="metric-value">${fmt(em[`${phase}_freq`], 0)} Hz</span>
      </div>
      <div class="metric">
        <span class="metric-label">Aparente</span>
        <span class="metric-value">${fmt(em[`${phase}_aprt_power`] / 1000, 2)} kVA</span>
      </div>
      <div class="metric">
        <span class="metric-label">Consumo</span>
        <span class="metric-value">${fmt(emdata[`${phase}_total_act_energy`] / 1000, 2)} kWh</span>
      </div>
    </div>
  `;
  return card;
};

let em, emdata;

const renderPhases = (emData, emdataData) => {
  em = emData;
  emdata = emdataData;
  const grid = $("phaseGrid");
  grid.innerHTML = "";
  grid.appendChild(renderPhase("a", "A"));
  grid.appendChild(renderPhase("b", "B"));
  grid.appendChild(renderPhase("c", "C/Fuente pro 3EM"));
};

const renderInfo = (data) => {
  const ds = data.device_status;

  const deviceRows = [
    ["Device ID", ds.id, ""],
    ["Model", ds.code, ""],
    ["MAC", ds.sys?.mac, ""],
    ["Serial", ds.serial, ""],
    ["Temperature", ds["temperature:0"] ? `${fmt(ds["temperature:0"].tC, 1)} °C` : "—", "warn"],
    ["Uptime", ds.sys ? `${ds.sys.uptime} s` : "—", ""],
  ];

  const netRows = [
    ["WiFi Status", ds.wifi?.status, "good"],
    ["SSID", ds.wifi?.ssid, ""],
    ["IP Address", ds.wifi?.sta_ip, ""],
    ["Signal (RSSI)", ds.wifi ? `${ds.wifi.rssi} dBm` : "—", ds.wifi && ds.wifi.rssi > -60 ? "good" : "warn"],
    ["Ethernet", ds.eth?.ip, ""],
    ["MQTT", ds.mqtt ? (ds.mqtt.connected ? "Connected" : "Disconnected") : "—", ds.mqtt?.connected ? "good" : "muted"],
  ];

  const sysRows = [
    ["Firmware", ds.sys?.available_updates?.stable?.version, ""],
    ["Beta Available", ds.sys?.available_updates?.beta?.version, "muted"],
    ["Time", ds.sys?.time, ""],
    ["Config Rev", ds.sys?.cfg_rev, ""],
    ["RAM Free", ds.sys ? `${(ds.sys.ram_free / 1024).toFixed(0)} KB` : "—", ""],
    ["FS Free", ds.sys ? `${(ds.sys.fs_free / 1024).toFixed(0)} KB` : "—", ""],
  ];

  const buildList = (rows, container) => {
    container.innerHTML = rows.map(([k, v, cls]) => `
      <div class="info-row">
        <span class="info-key">${k}</span>
        <span class="info-val ${cls}">${v ?? "—"}</span>
      </div>
    `).join("");
  };

  buildList(deviceRows, $("deviceInfo"));
  buildList(netRows, $("networkInfo"));
  buildList(sysRows, $("systemInfo"));
};

const fetchData = async () => {
  const btn = $("refreshBtn");
  btn.classList.add("spinning");
  try {
    const url = `${SHELLY_STATUS_URL}?id=${encodeURIComponent(DEVICE_ID)}&auth_key=${encodeURIComponent(AUTH_KEY)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.isok || !json.data) throw new Error("API returned error");

    const data = json.data;
    setStatus(data.online);

    const ds = data.device_status;
    renderHero(ds["em:0"], ds["emdata:0"]);
    renderPhases(ds["em:0"], ds["emdata:0"]);
    renderInfo(data);

    showToast("Actualizado", "success");
  } catch (err) {
    setStatus(false);
    showToast(`Load error: ${err.message}`, "error");
  } finally {
    setTimeout(() => btn.classList.remove("spinning"), 800);
  }
};

if (!DEVICE_ID || !AUTH_KEY) {
  setStatus(false);
  showToast("ID o auth key no encontrado en URL", "error");
} else {
  $("deviceTitle").textContent = DEVICE_ID;
  $("deviceLocation").textContent = DEVICE_LOCATION;
  $("refreshBtn").addEventListener("click", fetchData);
  fetchData();
  setInterval(fetchData, 30000);
}
