// ---------- AUTH STORAGE ----------
let currentUser = null;

function hashPassword(pw) {
  return btoa(pw + "fittrack_salt");
}

function userExists(username) {
  const users = JSON.parse(localStorage.getItem("fittrack_users") || "[]");
  return users.some(u => u.username === username);
}

// username only letters
function isValidUsername(username) {
  const usernameRegex = /^[A-Za-z]+$/;
  return usernameRegex.test(username);
}

function registerUser(username, password) {
  if (username.trim() === "" || password === "") return { success: false, message: "Username and password required" };
  if (!isValidUsername(username)) return { success: false, message: "Username must contain only letters (A-Z, a-z)" };
  if (userExists(username)) return { success: false, message: "Username already exists" };
  const users = JSON.parse(localStorage.getItem("fittrack_users") || "[]");
  users.push({ username, passwordHash: hashPassword(password) });
  localStorage.setItem("fittrack_users", JSON.stringify(users));
  return { success: true, message: "Account created! Please log in." };
}

function loginUser(username, password) {
  const users = JSON.parse(localStorage.getItem("fittrack_users") || "[]");
  const user = users.find(u => u.username === username && u.passwordHash === hashPassword(password));
  return !!user;
}

// Data helpers per user
function getUserKey(base) {
  if (!currentUser) return null;
  return `${base}_${currentUser}`;
}

function loadWorkouts() {
  const key = getUserKey("fittrack_workouts");
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
}
function saveWorkouts(workouts) {
  const key = getUserKey("fittrack_workouts");
  localStorage.setItem(key, JSON.stringify(workouts));
}
function loadMeals() {
  const key = getUserKey("fittrack_meals");
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
}
function saveMeals(meals) {
  const key = getUserKey("fittrack_meals");
  localStorage.setItem(key, JSON.stringify(meals));
}
function loadGoal() {
  const key = getUserKey("fittrack_goal");
  const stored = localStorage.getItem(key);
  return stored ? parseInt(stored) : 2200;
}
function saveGoal(goal) {
  const key = getUserKey("fittrack_goal");
  localStorage.setItem(key, goal);
}

// CRUD
function addWorkoutLocal(workout) {
  const w = loadWorkouts();
  const newId = w.length ? Math.max(...w.map(wk => wk.id)) + 1 : 1;
  w.push({ ...workout, id: newId });
  saveWorkouts(w);
}
function deleteWorkoutLocal(id) {
  let w = loadWorkouts();
  w = w.filter(wk => wk.id !== id);
  saveWorkouts(w);
}
function addMealLocal(meal) {
  const m = loadMeals();
  const newId = m.length ? Math.max(...m.map(ml => ml.id)) + 1 : 1;
  m.push({ ...meal, id: newId });
  saveMeals(m);
}
function deleteMealLocal(id) {
  let m = loadMeals();
  m = m.filter(ml => ml.id !== id);
  saveMeals(m);
}

let weeklyChart = null;
function getTodayDate() { return new Date().toISOString().slice(0,10); }

function renderWorkouts() {
  const workouts = loadWorkouts();
  const container = document.getElementById('workoutList');
  if (!workouts.length) { container.innerHTML = '<div class="empty-msg">🏋️ No workouts yet</div>'; return; }
  container.innerHTML = '';
  workouts.sort((a,b)=>new Date(b.date)-new Date(a.date));
  workouts.forEach(w => {
    const div = document.createElement('div'); div.className = 'entry-item';
    div.innerHTML = `<div><strong>${escapeHtml(w.type)}</strong> · ${w.duration} min · 🔥 ${w.calories} kcal<br><span style="font-size:0.75rem;">📅 ${w.date}</span></div>
                     <button class="delete-btn" data-id="${w.id}" data-type="workout">🗑️</button>`;
    container.appendChild(div);
  });
  document.querySelectorAll('.delete-btn[data-type="workout"]').forEach(btn => {
    btn.addEventListener('click', () => { deleteWorkoutLocal(parseInt(btn.dataset.id)); refreshAll(); });
  });
}

function renderMeals() {
  const meals = loadMeals();
  const container = document.getElementById('mealList');
  if (!meals.length) { container.innerHTML = '<div class="empty-msg">🥗 No meals logged</div>'; return; }
  container.innerHTML = '';
  meals.sort((a,b)=>new Date(b.date)-new Date(a.date));
  meals.forEach(m => {
    const div = document.createElement('div'); div.className = 'entry-item';
    div.innerHTML = `<div><strong>${escapeHtml(m.name)}</strong> · 🍽️ ${m.calories} kcal<br><span style="font-size:0.75rem;">📅 ${m.date}</span></div>
                     <button class="delete-btn" data-id="${m.id}" data-type="meal">🗑️</button>`;
    container.appendChild(div);
  });
  document.querySelectorAll('.delete-btn[data-type="meal"]').forEach(btn => {
    btn.addEventListener('click', () => { deleteMealLocal(parseInt(btn.dataset.id)); refreshAll(); });
  });
}

function updateTodayStats() {
  const workouts = loadWorkouts();
  const meals = loadMeals();
  const goal = loadGoal();
  const today = getTodayDate();
  const burned = workouts.filter(w=>w.date===today).reduce((s,w)=>s+w.calories,0);
  const consumed = meals.filter(m=>m.date===today).reduce((s,m)=>s+m.calories,0);
  document.getElementById('todayBurned').innerText = burned;
  document.getElementById('todayConsumed').innerText = consumed;
  const net = consumed - burned;
  const remaining = goal - net;
  document.getElementById('netStatus').innerHTML = remaining>=0 ? `${remaining} kcal left` : `${Math.abs(remaining)} kcal over`;
  const tip = document.getElementById('progressTip');
  if (net <= goal/2) tip.innerHTML = '✅ On track!';
  else if (net > goal) tip.innerHTML = '⚠️ Slightly over';
  else tip.innerHTML = '🌟 Good job!';
  document.getElementById('goalDisplay').innerText = goal;
}

function buildWeeklyChart() {
  const workouts = loadWorkouts();
  const meals = loadMeals();
  const days = [];
  const today = new Date();
  for(let i=6;i>=0;i--) { let d=new Date(today); d.setDate(today.getDate()-i); days.push(d.toISOString().slice(0,10)); }
  const data = days.map(date => ({
    date, consumed: meals.filter(m=>m.date===date).reduce((s,m)=>s+m.calories,0),
    burned: workouts.filter(w=>w.date===date).reduce((s,w)=>s+w.calories,0)
  }));
  if(weeklyChart) weeklyChart.destroy();
  const ctx = document.getElementById('weeklyChart').getContext('2d');
  weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d=>`${new Date(d.date).getMonth()+1}/${new Date(d.date).getDate()}`),
      datasets: [
        { label: '🍽️ Consumed', data: data.map(d=>d.consumed), backgroundColor: '#FFB347', borderRadius: 8 },
        { label: '🔥 Burned', data: data.map(d=>d.burned), backgroundColor: '#3a9b6e', borderRadius: 8 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
  });
}

function refreshAll() { renderWorkouts(); renderMeals(); updateTodayStats(); buildWeeklyChart(); }

function attachMainEvents() {
  // Add workout with non-negative validation
  document.getElementById('addWorkoutBtn').onclick = () => {
    const type = document.getElementById('workoutType').value;
    const dur = parseInt(document.getElementById('workoutDuration').value);
    const cal = parseInt(document.getElementById('workoutCalories').value);
    let date = document.getElementById('workoutDate').value || getTodayDate();
    
    // Validation: not NaN, positive numbers, and not under 0
    if (isNaN(dur) || dur < 0) {
      alert("Duration cannot be negative. Please enter a valid positive number or zero.");
      return;
    }
    if (isNaN(cal) || cal < 0) {
      alert("Calories burned cannot be negative. Please enter zero or a positive number.");
      return;
    }
    // Optionally allow zero duration/calories? Usually we want at least >0, but user said "dont let to under 0"
    // So zero is allowed, but for typical fitness tracker we might want >0. I'll keep zero allowed.
    if (dur === 0 && cal === 0) {
      alert("Please enter at least some duration or calories (zero not meaningful).");
      return;
    }
    
    addWorkoutLocal({ type, duration: dur, calories: cal, date });
    document.getElementById('workoutDuration').value = '';
    document.getElementById('workoutCalories').value = '';
    document.getElementById('workoutDate').value = getTodayDate();
    refreshAll();
  };
  
  // Add meal with non-negative validation
  document.getElementById('addMealBtn').onclick = () => {
    const name = document.getElementById('mealName').value.trim();
    const cal = parseInt(document.getElementById('mealCalories').value);
    let date = document.getElementById('mealDate').value || getTodayDate();
    
    if (!name) { alert("Please enter a food name."); return; }
    if (isNaN(cal) || cal < 0) {
      alert("Calories cannot be negative. Please enter zero or a positive number.");
      return;
    }
    if (cal === 0) {
      alert("Please enter a calorie amount greater than zero.");
      return;
    }
    
    addMealLocal({ name, calories: cal, date });
    document.getElementById('mealName').value = '';
    document.getElementById('mealCalories').value = '';
    document.getElementById('mealDate').value = getTodayDate();
    refreshAll();
  };
  
  document.getElementById('setGoalBtn').onclick = () => {
    let newGoal = parseInt(document.getElementById('goalInput').value);
    if (isNaN(newGoal) || newGoal < 200) { alert("Goal must be at least 200 kcal"); return; }
    saveGoal(newGoal);
    refreshAll();
  };
  
  document.getElementById('logoutMainBtn').onclick = () => {
    currentUser = null;
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('authOverlay').style.display = 'flex';
    document.getElementById('authUsername').value = '';
    document.getElementById('authPassword').value = '';
  };
}

function afterLogin(username) {
  currentUser = username;
  document.getElementById('currentUserSpan').innerHTML = `👤 ${username}`;
  document.getElementById('workoutDate').value = getTodayDate();
  document.getElementById('mealDate').value = getTodayDate();
  document.getElementById('goalInput').value = loadGoal();
  refreshAll();
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
}

// Auth UI handlers
document.getElementById('loginBtn').onclick = () => {
  const user = document.getElementById('authUsername').value.trim();
  const pwd = document.getElementById('authPassword').value;
  if(!user||!pwd) { document.getElementById('authError').innerText = 'Enter username/password'; return; }
  if(loginUser(user,pwd)) { afterLogin(user); }
  else { document.getElementById('authError').innerText = 'Invalid credentials or user does not exist'; }
};

document.getElementById('signupBtn').onclick = () => {
  const user = document.getElementById('authUsername').value.trim();
  const pwd = document.getElementById('authPassword').value;
  if(!user||!pwd) { 
    document.getElementById('authError').innerText = 'Username & password required'; 
    return; 
  }
  const result = registerUser(user, pwd);
  document.getElementById('authError').innerText = result.message;
  if (result.success) {
    document.getElementById('authUsername').value = '';
    document.getElementById('authPassword').value = '';
  }
};

function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m){
    if(m==='&') return '&amp;';
    if(m==='<') return '&lt;';
    if(m==='>') return '&gt;';
    return m;
  });
}

// Initial state
document.getElementById('mainApp').style.display = 'none';
attachMainEvents();