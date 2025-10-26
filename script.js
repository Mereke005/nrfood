/* Keys */
const USERS_KEY = 'neon_users_v3'; // { username: { hash, role } }
const LS_SHIFTS_PREFIX = 'shifts_user_';
const CURRENT_USER_KEY = 'neon_current_user_v3';

/* DOM */
const authView = document.getElementById('authView');
const appView = document.getElementById('appView');
const authLogin = document.getElementById('authLogin');
const authPass = document.getElementById('authPass');
const authRole = document.getElementById('authRole');
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');

const welcome = document.getElementById('welcome');
const roleLabel = document.getElementById('roleLabel');
const exportBtnTop = document.getElementById('exportBtnTop');
const exportAllBtn = document.getElementById('exportAllBtn');
const logoutBtn = document.getElementById('logoutBtn');
const usersListEl = document.getElementById('usersList');
const adminPanel = document.getElementById('adminPanel');
const refreshStatsBtn = document.getElementById('refreshStatsBtn');

const nameInput = document.getElementById('name');
const dateInput = document.getElementById('date');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const notesInput = document.getElementById('notes');
const listEl = document.getElementById('list');
const totalHoursEl = document.getElementById('total-hours');
const abListEl = document.getElementById('ab-list');
const elListEl = document.getElementById('el-list');
const clearMyBtn = document.getElementById('clearMyBtn');
const importBtn = document.getElementById('importBtn');
const modalRoot = document.getElementById('modalRoot');

const locEls = document.querySelectorAll('.loc');
locEls.forEach(el=> el.addEventListener('click', ()=>{ locEls.forEach(x=>x.classList.remove('active')); el.classList.add('active'); }));

/* Helpers for localStorage */
function getUsers(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch(e){ return {}; } }
function saveUsers(u){ localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function getShiftsFor(user){ try{ return JSON.parse(localStorage.getItem(LS_SHIFTS_PREFIX + user) || '[]'); } catch(e){ return []; } }
function saveShiftsFor(user, arr){ localStorage.setItem(LS_SHIFTS_PREFIX + user, JSON.stringify(arr)); }
function setCurrentUser(user){ localStorage.setItem(CURRENT_USER_KEY, user); }
function clearCurrentUser(){ localStorage.removeItem(CURRENT_USER_KEY); }
function getCurrentUser(){ return localStorage.getItem(CURRENT_USER_KEY) || null; }

/* SHA-256 helper to store passwords more safely */
async function sha256hex(str){
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

/* time helpers */
function parseTimeToMinutes(t){ const [hh,mm] = (t||'00:00').split(':').map(Number); return hh*60 + mm; }
function computeDurationMinutes(start, end){ const s = parseTimeToMinutes(start); const e = parseTimeToMinutes(end); if(isNaN(s)||isNaN(e)) return 0; let diff = e - s; if(diff <= 0) diff += 24*60; return diff; }
function minutesToHoursRounded(min){ return Math.round((min/60)*10)/10; }
function formatMinutes(min){ const h = Math.floor(min/60); const m = min%60; return `${h}ч ${m}м`; }

/* Auth: register/login */

// Registration: async because we hash password
btnRegister.addEventListener('click', async ()=>{
  const username = authLogin.value.trim();
  const password = authPass.value;
  const role = authRole.value;
  if(!username || !password){ alert('Введите логин и пароль для регистрации.'); return; }
  const users = getUsers();

  // prevent duplicate username
  if(users[username]){ alert('Пользователь уже зарегистрирован. Войдите.'); return; }

  // if registering as chef, ensure no other chef exists
  if(role === 'chef'){
    const chefExists = Object.values(users).some(u => u.role === 'chef');
    if(chefExists){ alert('Шеф-повар уже зарегистрирован. Нельзя создать второго шефа.'); return; }
  }

  const hash = await sha256hex(password);
  users[username] = { hash, role };
  saveUsers(users);
  alert('Регистрация успешна. Теперь войдите.');
});

// Login: async to hash provided password and compare
btnLogin.addEventListener('click', async ()=>{
  const username = authLogin.value.trim();
  const password = authPass.value;
  const wantedRole = authRole.value;
  if(!username || !password){ alert('Введите логин и пароль.'); return; }
  const users = getUsers();
  const rec = users[username];
  if(!rec){ alert('Пользователь не найден.'); return; }
  if(rec.role !== wantedRole){ alert('Неверная роль для этого аккаунта. Проверьте выбранную роль.'); return; }
  const given = await sha256hex(password);
  if(given !== rec.hash){ alert('Неверный пароль.'); return; }
  setCurrentUser(username);
  showAppForUser(username);
});

/* logout */
logoutBtn.addEventListener('click', ()=>{ clearCurrentUser(); location.reload(); });

/* show app */
let currentUser = getCurrentUser();
let currentRole = null;
function showAppForUser(username){
  const users = getUsers();
  const role = users[username]?.role || 'cook';
  currentUser = username;
  currentRole = role;
  authView.style.display = 'none';
  appView.style.display = 'block';
  welcome.textContent = `Привет, ${username}`;
  roleLabel.textContent = `Роль: ${role === 'chef' ? 'Шеф' : 'Повар'}`;
  document.getElementById('name').value = username;
  // role UI
  if(role === 'chef'){
    adminPanel.style.display = 'block';
    exportAllBtn.style.display = 'inline-block';
  } else {
    adminPanel.style.display = 'none';
    exportAllBtn.style.display = 'none';
  }
  renderMyShifts();
  renderAdminIfNeeded();
}

/* on load if have session */
if(currentUser){ showAppForUser(currentUser); }

/* save shift */
document.getElementById('saveBtn').addEventListener('click', ()=>{
  if(!currentUser){ alert('Сначала войдите.'); return; }
  const name = nameInput.value.trim();
  const date = dateInput.value;
  const start = startInput.value;
  const end = endInput.value;
  const notes = notesInput.value.trim();
  const locEl = document.querySelector('.loc.active');
  const location = locEl ? locEl.dataset.loc : 'Аблайхана';
  if(!name || !date || !start || !end){ alert('Укажите имя, дату и время начала/конца.'); return; }
  const minutes = computeDurationMinutes(start, end);
  if(minutes <= 0){ alert('Неверное время смены.'); return; }
  const arr = getShiftsFor(currentUser);
  arr.push({ name, date, start, end, notes, location });
  saveShiftsFor(currentUser, arr);
  renderMyShifts();
  renderAdminIfNeeded();
  const btn = document.getElementById('saveBtn'); const old = btn.textContent;
  btn.textContent = '✅ Сохранено'; setTimeout(()=>btn.textContent = old, 900);
});

/* render my shifts (for normal user shows only their shifts; for chef shows own too but chef has admin panel) */
function renderMyShifts(){
  if(!currentUser) return;
  const arr = getShiftsFor(currentUser);
  listEl.innerHTML = '';
  if(arr.length === 0){
    listEl.innerHTML = '<div class="muted">Пока нет смен — добавьте первую</div>';
    totalHoursEl.textContent = '0';
    abListEl.textContent = '—';
    elListEl.textContent = '—';
    return;
  }
  let totalMin = 0;
  const stats = { 'Аблайхана': {}, 'Елемесова': {} };

  arr.slice().reverse().forEach((s, idxReverse) => {
    const minutes = computeDurationMinutes(s.start, s.end);
    totalMin += minutes;
    const wrapper = document.createElement('div'); wrapper.className = 'shift';
    const left = document.createElement('div');
    left.innerHTML = `<div style="font-weight:700">${s.name}</div><div class="meta">${s.date} • ${s.start}—${s.end} • ${s.location}</div><div class="muted">${s.notes || ''}</div>`;
    const right = document.createElement('div');
    const delBtn = document.createElement('button'); delBtn.className = 'ghost'; delBtn.textContent = 'Удалить';
    const editBtn = document.createElement('button'); editBtn.className = 'ghost'; editBtn.textContent = 'Изменить';
    // compute real index
    const realIndex = arr.length - 1 - idxReverse;

    delBtn.addEventListener('click', ()=>{
      if(!confirm('Удалить эту смену?')) return;
      const a = getShiftsFor(currentUser);
      a.splice(realIndex, 1);
      saveShiftsFor(currentUser, a);
      renderMyShifts();
      renderAdminIfNeeded();
    });

    editBtn.addEventListener('click', ()=>{
      const a = getShiftsFor(currentUser);
      const item = a[realIndex];
      nameInput.value = item.name;
      dateInput.value = item.date;
      startInput.value = item.start;
      endInput.value = item.end;
      notesInput.value = item.notes || '';
      document.querySelectorAll('.loc').forEach(x=>x.classList.remove('active'));
      document.querySelector(`.loc[data-loc="${item.location}"]`)?.classList.add('active');
      a.splice(realIndex, 1);
      saveShiftsFor(currentUser, a);
      renderMyShifts();
      renderAdminIfNeeded();
    });

    right.appendChild(editBtn);
    right.appendChild(delBtn);
    wrapper.appendChild(left);
    wrapper.appendChild(right);
    listEl.appendChild(wrapper);

    // stats
    const map = stats[s.location] || (stats[s.location] = {});
    if(!map[s.name]) map[s.name] = { shifts:0, minutes:0 };
    map[s.name].shifts += 1;
    map[s.name].minutes += minutes;
  });

  totalHoursEl.textContent = minutesToHoursRounded(totalMin);
  abListEl.textContent = renderPoint(stats, 'Аблайхана');
  elListEl.textContent = renderPoint(stats, 'Елемесова');
}

function renderPoint(stats, point){
  const map = stats[point] || {};
  const entries = Object.entries(map).sort((a,b)=> b[1].minutes - a[1].minutes);
  if(entries.length === 0) return '—';
  return entries.map(([name, v]) => `${name} — ${v.shifts} смен, ${minutesToHoursRounded(v.minutes)} ч (${formatMinutes(v.minutes)})`).join('\n');
}

/* clear my shifts */
clearMyBtn.addEventListener('click', ()=>{
  if(!currentUser){ alert('Войдите.'); return; }
  if(!confirm('Удалить все ваши смены?')) return;
  saveShiftsFor(currentUser, []);
  renderMyShifts();
  renderAdminIfNeeded();
});

/* import JSON into current user */
importBtn.addEventListener('click', ()=>{
  if(!currentUser){ alert('Войдите.'); return; }
  const txt = prompt('Вставьте JSON-массив смен для текущего пользователя (пример: [{"name":"Иван","date":"2025-10-20","start":"22:00","end":"01:00","location":"Аблайхана","notes":""}])');
  if(!txt) return;
  try{
    const data = JSON.parse(txt);
    if(!Array.isArray(data)) throw 0;
    const arr = getShiftsFor(currentUser).concat(data);
    saveShiftsFor(currentUser, arr);
    renderMyShifts();
    renderAdminIfNeeded();
    alert('Импортировано: ' + data.length);
  }catch(e){
    alert('Неверный формат JSON.');
  }
});

/* export CSV personal */
exportBtnTop.addEventListener('click', ()=>{
  if(!currentUser){ alert('Войдите.'); return; }
  const arr = getShiftsFor(currentUser);
  if(arr.length === 0){ alert('Нет смен для экспорта.'); return; }
  const header = ['date','location','name','start','end','duration_minutes','notes'];
  const lines = arr.map(r=>{
    const m = computeDurationMinutes(r.start, r.end);
    const esc = s => '"' + String(s || '').replace(/"/g, '""') + '"';
    return [r.date, r.location, r.name, r.start, r.end, m, r.notes || ''].map(esc).join(',');
  });
  const csv = [header.join(',')].concat(lines).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = currentUser + '_shifts.csv'; a.click(); URL.revokeObjectURL(url);
});

/* ADMIN (chef) */
function renderAdminIfNeeded(){
  const users = getUsers();
  if(!currentUser) return;
  const role = users[currentUser]?.role;
  if(role !== 'chef'){
    adminPanel.style.display = 'none';
    exportAllBtn.style.display = 'none';
    return;
  }
  adminPanel.style.display = 'block';
  exportAllBtn.style.display = 'inline-block';
  usersListEl.innerHTML = '';

  const overall = {};
  Object.keys(users).forEach(u=>{
    const arr = getShiftsFor(u);
    let totalMin = 0;
    const perPoint = {'Аблайхана':0, 'Елемесова':0};
    arr.forEach(s=>{
      const m = computeDurationMinutes(s.start, s.end);
      totalMin += m;
      perPoint[s.location] = (perPoint[s.location] || 0) + m;
    });
    overall[u] = { totalMin, perPoint, shifts: arr.length };
  });

  const entries = Object.entries(overall).sort((a,b)=> b[1].totalMin - a[1].totalMin);
  entries.forEach(([u, data])=>{
    const div = document.createElement('div');
    div.className = 'user-row';
    div.innerHTML = `<div><strong>${u}</strong><div class="muted">${data.shifts} смен(ы)</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <div class="muted">${minutesToHoursRounded(data.totalMin)} ч</div>
        <button class="ghost" data-user="${u}">Просмотр</button>
      </div>`;
    usersListEl.appendChild(div);
    div.querySelector('button').addEventListener('click', ()=>{ openUserModal(u); });
  });
}

/* modal to view/edit user's shifts (chef only) */
function openUserModal(username){
  const arr = getShiftsFor(username);
  const modal = document.createElement('div'); modal.className = 'modal';
  const panel = document.createElement('div'); panel.className = 'panel';
  const title = document.createElement('div'); title.style.marginBottom = '8px'; title.innerHTML = `<strong>Смены ${username}</strong>`;
  const content = document.createElement('div');

  if(arr.length === 0) content.innerHTML = '<div class="muted">Нет смен.</div>';
  else {
    arr.slice().reverse().forEach((s, idxRev)=>{
      const idx = arr.length - 1 - idxRev;
      const m = computeDurationMinutes(s.start, s.end);
      const row = document.createElement('div');
      row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems = 'center';
      row.style.padding = '8px'; row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
      row.innerHTML = `<div><div style="font-weight:700">${s.date} • ${s.location} • ${s.start}-${s.end}</div><div class="muted">${s.notes || ''}</div></div>`;
      const controls = document.createElement('div');
      const edit = document.createElement('button'); edit.className = 'ghost'; edit.textContent = 'Изменить';
      const del = document.createElement('button'); del.className = 'ghost'; del.textContent = 'Удалить';
      edit.addEventListener('click', ()=>{
        openEditShiftModal(username, idx);
        modal.remove();
      });
      del.addEventListener('click', ()=>{
        if(!confirm('Шеф удаляет смену. Продолжить?')) return;
        const cur = getShiftsFor(username);
        cur.splice(idx, 1);
        saveShiftsFor(username, cur);
        panel.remove();
        modal.remove();
        openUserModal(username);
        renderAdminIfNeeded();
        if(username === currentUser) renderMyShifts();
      });
      controls.appendChild(edit);
      controls.appendChild(del);
      row.appendChild(controls);
      content.appendChild(row);
    });
  }

  const closeRow = document.createElement('div'); closeRow.style.marginTop = '10px'; closeRow.style.display = 'flex'; closeRow.style.justifyContent = 'flex-end';
  const closeBtn = document.createElement('button'); closeBtn.className = 'ghost'; closeBtn.textContent = 'Закрыть';
  closeBtn.addEventListener('click', ()=>{ modal.remove(); });
  closeRow.appendChild(closeBtn);
  panel.appendChild(title); panel.appendChild(content); panel.appendChild(closeRow);
  modal.appendChild(panel); modalRoot.appendChild(modal);
}

function openEditShiftModal(username, idx){
  const arr = getShiftsFor(username);
  const item = arr[idx];
  if(!item) return alert('Элемент не найден.');
  const modal = document.createElement('div'); modal.className = 'modal';
  const panel = document.createElement('div'); panel.className = 'panel';
  panel.innerHTML = `<div style="font-weight:700;margin-bottom:8px">Редактировать смену — ${username}</div>`;
  const form = document.createElement('div');
  form.innerHTML = `
    <div class="field"><label>Имя повара</label><input id="m_name" type="text" value="${item.name}"></div>
    <div class="row"><div class="field col"><label>Дата</label><input id="m_date" type="date" value="${item.date}"></div>
    <div class="field col"><label>Начало</label><input id="m_start" type="time" value="${item.start}"></div>
    <div class="field col"><label>Конец</label><input id="m_end" type="time" value="${item.end}"></div></div>
    <div class="field"><label>Точка</label>
      <select id="m_loc"><option>Аблайхана</option><option>Елемесова</option></select>
    </div>
    <div class="field"><label>Примечание</label><textarea id="m_notes">${item.notes || ''}</textarea></div>
    <div style="display:flex;gap:8px">
      <button id="m_save" class="ghost">Сохранить</button>
      <button id="m_cancel" class="ghost">Отмена</button>
    </div>
  `;
  panel.appendChild(form);
  modal.appendChild(panel);
  modalRoot.appendChild(modal);

  panel.querySelector('#m_loc').value = item.location;

  panel.querySelector('#m_cancel').addEventListener('click', ()=> modal.remove());
  panel.querySelector('#m_save').addEventListener('click', ()=>{
    const newItem = {
      name: panel.querySelector('#m_name').value.trim(),
      date: panel.querySelector('#m_date').value,
      start: panel.querySelector('#m_start').value,
      end: panel.querySelector('#m_end').value,
      notes: panel.querySelector('#m_notes').value.trim(),
      location: panel.querySelector('#m_loc').value
    };
    const m = computeDurationMinutes(newItem.start, newItem.end);
    if(!newItem.name || !newItem.date || !newItem.start || !newItem.end){ alert('Заполните обязательные поля.'); return; }
    if(m <= 0){ if(!confirm('Продолжить с нулевой/отрицательной длительностью?')) return; }
    const cur = getShiftsFor(username);
    cur[idx] = newItem;
    saveShiftsFor(username, cur);
    modal.remove();
    renderAdminIfNeeded();
    if(username === currentUser) renderMyShifts();
  });
}

/* export all (chef) */
exportAllBtn.addEventListener('click', ()=>{
  const users = getUsers();
  const header = ['user','date','location','name','start','end','duration_minutes','notes'];
  const lines = [];
  Object.keys(users).forEach(u=>{
    const arr = getShiftsFor(u);
    arr.forEach(r=>{
      const m = computeDurationMinutes(r.start, r.end);
      const esc = s => '"' + String(s || '').replace(/"/g,'""') + '"';
      lines.push([u, r.date, r.location, r.name, r.start, r.end, m, r.notes || ''].map(esc).join(','));
    });
  });
  if(lines.length === 0){ alert('Нет данных для экспорта.'); return; }
  const csv = [header.join(',')].concat(lines).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'all_shifts.csv'; a.click(); URL.revokeObjectURL(url);
});

/* refresh */
refreshStatsBtn?.addEventListener('click', ()=>{ renderAdminIfNeeded(); alert('Статистика обновлена.'); });

/* helper show if current session exists */
if(getCurrentUser()){
  showAppForUser(getCurrentUser());
}

/* initialize default date/time */
(function initDefaults(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;
  startInput.value = '10:00';
  endInput.value = '01:00';
})();
