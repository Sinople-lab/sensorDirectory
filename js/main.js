const APPWRITE_ENDPOINT = "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = "6a5525270020504ee725";
const APPWRITE_DATABASE_ID = "6a55267f0015c007d7eb";
const APPWRITE_TABLE_ID = "01";
const SHELLY_STATUS_URL = "https://shelly-266-eu.shelly.cloud/device/status";

const tableBody = document.getElementById("tableBody");
const errorBanner = document.getElementById("errorBanner");

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.hidden = true;
  errorBanner.textContent = "";
}

function renderLoadingRow() {
  tableBody.innerHTML =
    '<tr class="loading-row"><td colspan="3">Loading devices…</td></tr>';
}

function renderErrorRow(message) {
  tableBody.innerHTML = `<tr class="error-row"><td colspan="3">${message}</td></tr>`;
}

function statusBadge(status) {
  const label = status === "online" ? "Online" : status === "offline" ? "Offline" : "Checking…";
  return `
    <span class="status-badge status-${status}">
      <span class="status-dot"></span>${label}
    </span>`;
}

function renderRows(devices) {
  tableBody.innerHTML = devices
    .map((d) => {
      const params = new URLSearchParams({ id: d.id,location:d.location, auth_key: d.auth_key || "" });
      return `
      <tr class="device-row" data-href="device.html?${params.toString()}" data-device-id="${d.id}">
        <td class="id-cell">${d.id}</td>
        <td id="location">${d.location ?? "—"}</td>
        <td id="status-${d.id}">${statusBadge("loading")}</td>
      </tr>`;
    })
    .join("");

  tableBody.querySelectorAll(".device-row").forEach((row) => {
    row.addEventListener("click", () => {
      window.location.href = row.dataset.href;
    });
  });
}

function updateStatusCell(deviceId, status) {
  const cell = document.getElementById(`status-${deviceId}`);
  if (cell) cell.innerHTML = statusBadge(status);
}

async function fetchDevices() {
  const url = `${APPWRITE_ENDPOINT}/databases/${APPWRITE_DATABASE_ID}/collections/${APPWRITE_TABLE_ID}/documents`;
  const res = await fetch(url, {
    headers: {
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Appwrite request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const documents = data.documents ?? [];

  return documents.map((doc) => ({
    id: doc.id,
    location: doc.location ?? doc.Location ?? null,
    auth_key: doc.auth_key ?? doc.token ?? doc.token_key ?? null,
  }));
}

async function fetchShellyStatus(deviceId, authKey) {
  const url = `${SHELLY_STATUS_URL}?id=${encodeURIComponent(deviceId)}&auth_key=${encodeURIComponent(authKey)}`;
  const res = await fetch(url);
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  if (!data) return false;
  return Boolean(data.online ?? data.is_online ?? (data.data && data.data.online));
}

async function init() {
  console.log("init()", new Date().toLocaleTimeString());

  renderLoadingRow();
  clearError();

  let devices;
  try {
    devices = await fetchDevices();
  } catch (err) {
    renderErrorRow("Failed to load devices.");
    showError(err.message);
    return;
  }

  if (devices.length === 0) {
    renderErrorRow("No devices found.");
    return;
  }

  renderRows(devices);

  /* const statusPromises = devices.map(async (device) => {
    if (!device.auth_key) {
      updateStatusCell(device.id, "offline");
      return;
    }
    try {
      const isOnline = await fetchShellyStatus(device.id, device.auth_key);
      updateStatusCell(device.id, isOnline ? "online" : "offline");
    } catch {
      updateStatusCell(device.id, "offline");
    }
  });

  await Promise.allSettled(statusPromises); */

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  for (const device of devices) {
      if (!device.auth_key) {
          updateStatusCell(device.id, "offline");
          continue;
      }

      try {
          const isOnline = await fetchShellyStatus(device.id, device.auth_key);
          updateStatusCell(
              device.id,
              isOnline ? "online" : "offline"
          );
      } catch {
          updateStatusCell(device.id, "offline");
      }

      await sleep(900);   // <- important
  }
}

init();
setInterval(init, 30000);
