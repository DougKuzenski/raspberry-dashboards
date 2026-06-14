'use strict';
const $ = (sel) => document.querySelector(sel);
const HOLD_MS = 1500;

const pinInput = $('#pin');
pinInput.value = localStorage.getItem('controlPin') || '';
pinInput.addEventListener('input', () => localStorage.setItem('controlPin', pinInput.value));

function headers() {
  const h = { 'content-type': 'application/json' };
  if (pinInput.value) h['x-control-pin'] = pinInput.value;
  return h;
}

function toast(msg, kind) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast' + (kind ? ' ' + kind : '');
}

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

async function refresh() {
  try {
    const res = await fetch('./api/status');
    const s = await res.json();
    $('#sub').textContent = `${s.hostname} · up ${fmtUptime(s.uptimeSec)}`;
    $('#pin-box').open = s.authRequired && !pinInput.value;
    renderApps(s.apps);
  } catch {
    $('#sub').textContent = 'cannot reach the Pi';
  }
}

function renderApps(apps) {
  const box = $('#apps');
  box.innerHTML = '';
  for (const a of apps) {
    const btn = document.createElement('button');
    btn.className = 'app-btn' + (a.active ? ' active' : '') + (a.up ? ' up' : '');
    btn.innerHTML =
      `<span class="dot"></span><span class="name">${a.label}</span>` +
      (a.active ? `<span class="badge">ON SCREEN</span>` : a.up ? '' : `<span class="badge" style="background:#374151;color:#cbd5e1">server down</span>`);
    btn.disabled = a.active;
    btn.addEventListener('click', () => switchTo(a.id, a.label));
    box.appendChild(btn);
  }
}

async function switchTo(id, label) {
  toast(`switching to ${label}…`);
  try {
    const res = await fetch('./api/switch', { method: 'POST', headers: headers(), body: JSON.stringify({ app: id }) });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
    toast(`now showing ${label}`, 'ok');
    setTimeout(refresh, 1200);
  } catch (e) {
    toast(String(e.message || e), 'err');
  }
}

// Press-and-hold confirm for the destructive power buttons.
function wireHold(btn) {
  const action = btn.dataset.action;
  let timer = null;
  const start = (e) => {
    e.preventDefault();
    btn.classList.add('holding');
    btn.querySelector('.fill').style.transition = `right ${HOLD_MS}ms linear`;
    timer = setTimeout(() => fire(action), HOLD_MS);
  };
  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    btn.classList.remove('holding');
    const fill = btn.querySelector('.fill');
    fill.style.transition = 'right 0s';
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
}

async function fire(action) {
  toast(`${action}…`);
  try {
    const res = await fetch(`./api/${action}`, { method: 'POST', headers: headers() });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || 'failed');
    toast(action === 'reboot' ? 'rebooting — back in ~1 min' : 'shutting down', 'ok');
  } catch (e) {
    toast(String(e.message || e), 'err');
  }
}

document.querySelectorAll('.hold').forEach(wireHold);
refresh();
setInterval(refresh, 10000);
