const $ = id => document.getElementById(id);
const storageKey = 'ritm-diary-v1';
const defaults = () => ({
  goal: null,
  meals: [
    { id: 'breakfast', name: 'Завтрак', time: '09:00' },
    { id: 'lunch', name: 'Обед', time: '13:00' },
    { id: 'dinner', name: 'Ужин', time: '19:00' }
  ],
  days: {}
});
function readDiary() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : defaults();
  } catch {
    $('status').textContent = 'Хранилище недоступно. Проверьте настройки Safari.';
    return defaults();
  }
}
let data = readDiary();
let date = dateKey(new Date());
let openedOn = date;
let action = null;
let removal = null;

function dateKey(value) {
  return [value.getFullYear(), value.getMonth() + 1, value.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('-');
}
function asDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  const value = new Date(0);
  value.setFullYear(year, month - 1, day);
  value.setHours(12, 0, 0, 0);
  return value;
}
function offsetDate(key, amount) {
  const value = asDate(key);
  value.setDate(value.getDate() + amount);
  return dateKey(value);
}
const format = number => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(number);
const kcal = number => format(number) + ' ккал';
const sortedMeals = list => [...list].sort((a, b) => a.time.localeCompare(b.time));
const unique = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

function dayAt(source, key) {
  return source.days[key] ?? { foods: [], exercises: [] };
}
function changeDay(key, change) {
  commit(next => {
    const day = dayAt(next, key);
    change(day);
    if (day.foods.length || day.exercises.length || day.trainingTitle) next.days[key] = day;
    else delete next.days[key];
  });
}
function commit(change) {
  const next = JSON.parse(JSON.stringify(data));
  change(next);
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    throw new Error('Не удалось сохранить изменения. Проверьте место и настройки Safari.');
  }
  data = next;
  render();
}
function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value != null) node.textContent = value;
  if (className) node.className = className;
  return node;
}
function button(value, handler, className = 'quiet') {
  const node = element('button', value, className);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}

function selectDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || dateKey(asDate(value)) !== value) return;
  date = value;
  $('status').textContent = '';
  render();
}
const xpPerExercise = 10;
const xpPerQuest = 30;
const xpPerLevel = 100;
const ranks = [[19, 'S'], [14, 'A'], [10, 'B'], [7, 'C'], [4, 'D'], [1, 'E']];

function questProgress(exercises) {
  const done = exercises.filter(item => item.done).length;
  const complete = done > 0 && done === exercises.length;
  return { done, complete, xp: done * xpPerExercise + (complete ? xpPerQuest : 0) };
}

function renderPlayer(day) {
  const totalXp = Object.values(data.days).reduce((sum, entry) => sum + questProgress(entry.exercises).xp, 0);
  const level = 1 + Math.floor(totalXp / xpPerLevel);
  const rank = ranks.find(([minimum]) => level >= minimum)[1];
  const progress = totalXp % xpPerLevel;
  $('player-level').textContent = level;
  $('rank-letter').textContent = rank;
  $('rank-letter').parentElement.setAttribute('aria-label', 'Ранг ' + rank);
  $('xp-earned').textContent = progress + ' / ' + xpPerLevel + ' XP';
  $('xp-next').textContent = (xpPerLevel - progress) + ' XP до уровня ' + (level + 1);
  $('xp-bar').value = progress;

  const quest = questProgress(day.exercises);
  const state = $('quest-state');
  state.hidden = !day.exercises.length;
  state.textContent = quest.complete ? 'Выполнено · +' + quest.xp + ' XP' :
    '+' + (day.exercises.length * xpPerExercise + xpPerQuest) + ' XP за задание';
}
function render() {
  const today = dateKey(new Date());
  const day = dayAt(data, date);
  $('date').value = date;
  $('day-title').textContent = date === today ? 'Сегодня' :
    date === offsetDate(today, 1) ? 'Завтра' : date === offsetDate(today, -1) ? 'Вчера' : 'Дневник';
  $('date-label').textContent = asDate(date).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  $('today').hidden = date === today;
  const total = day.foods.reduce((sum, item) => sum + item.tenths, 0) / 10;
  $('total').replaceChildren(document.createTextNode(format(total) + ' '), element('small', 'ккал'));
  const goal = data.goal;
  const left = goal - total;
  const percent = goal ? Math.round(100 * total / goal) : 0;
  $('goal-line').textContent = goal ? 'Цель ' + kcal(goal) + ' · ' +
    (left > 0 ? 'осталось ' + kcal(left) : left < 0 ? 'сверх цели ' + kcal(-left) : 'цель достигнута') : 'Цель можно задать в настройках';
  $('ring').hidden = !goal || percent > 999;
  $('ring').style.setProperty('--fill', Math.min(100, percent) + '%');
  $('percent').textContent = percent + '%';
  renderMeals(day.foods);
  renderPlayer(day);
  $('training-title').textContent = day.trainingTitle ?? '';
  $('training-title').hidden = !day.trainingTitle;
  renderExercises(day.exercises, day.trainingTitle);
}
function renderMeals(foods) {
  const groups = sortedMeals(data.meals);
  for (const entry of foods) {
    if (!groups.some(group => group.id === entry.mealId)) {
      groups.push({ id: entry.mealId, name: entry.mealName });
    }
  }
  $('meals').replaceChildren(...groups.map(group => {
    const items = foods.filter(food => food.mealId === group.id);
    const card = element('article', null, 'card');
    const head = element('div', null, 'card-head');
    const title = element('h3');
    if (group.time) title.append(element('span', group.time, 'time'));
    title.append(group.name);
    head.append(title);
    if (items.length) head.append(element('small', kcal(items.reduce((sum, item) => sum + item.tenths, 0) / 10)));
    if (group.time) {
      const add = button(items.length ? '＋' : 'Добавить', () => editFood(null, group.id));
      add.setAttribute('aria-label', 'Добавить продукт · ' + group.name);
      head.append(add);
    }
    card.append(head);
    for (const food of items) {
      const row = element('div', null, 'row');
      const text = element('div');
      text.append(element('strong', food.name), element('p', kcal(food.tenths / 10)));
      const edit = button('Изменить', () => editFood(food, food.mealId));
      edit.setAttribute('aria-label', 'Изменить · ' + food.name);
      row.append(text, edit);
      card.append(row);
    }
    return card;
  }));
  if (!groups.length) $('meals').append(element('p', 'Добавьте продукт или настройте расписание питания.', 'empty'));
}
function renderExercises(exercises, trainingTitle) {
  $('completion').textContent = exercises.length ? 'Выполнено ' + questProgress(exercises).done + ' из ' + exercises.length : '';
  if (!exercises.length) {
    $('exercises').replaceChildren(element('p', trainingTitle === 'Отдых' ? 'На этот день запланирован отдых.' : 'Составьте программу, чтобы получить задание на этот день.', 'empty'));
    return;
  }
  const key = date;
  const card = element('div', null, 'card');
  for (const exercise of exercises) {
    const row = element('div', null, exercise.done ? 'row done' : 'row');
    const check = element('input');
    check.type = 'checkbox';
    check.checked = exercise.done;
    check.setAttribute('aria-label', 'Выполнено · ' + exercise.name);
    check.addEventListener('change', () => {
      const before = questProgress(dayAt(data, key).exercises).xp;
      try {
        changeDay(key, day => { day.exercises.find(item => item.id === exercise.id).done = check.checked; });
        const gained = questProgress(dayAt(data, key).exercises).xp - before;
        $('status').textContent = gained > 0 ? 'Получено +' + gained + ' XP' : 'Отметка снята.';
        for (const control of $('exercises').querySelectorAll('input')) {
          if (control.getAttribute('aria-label') === check.getAttribute('aria-label')) { control.focus(); break; }
        }
      } catch (error) {
        check.checked = !check.checked;
        $('status').textContent = error.message;
      }
    });
    const text = element('div');
    text.append(element('strong', exercise.name));
    if (exercise.details) text.append(element('p', exercise.details));
    const edit = button('Изменить', () => editExercise(exercise));
    edit.setAttribute('aria-label', 'Изменить · ' + exercise.name);
    row.append(check, text, edit);
    card.append(row);
  }
  $('exercises').replaceChildren(card);
}
function dialog(title, remove) {
  action = null;
  $('save').textContent = 'Сохранить';
  removal = remove;
  $('editor-title').textContent = title;
  $('fields').replaceChildren();
  $('error').hidden = true;
  $('remove').hidden = !remove;
  return $('fields');
}
function field(panel, label, control) {
  const wrapper = element('label', label);
  wrapper.append(control);
  panel.append(wrapper);
  return control;
}
function input(value = '', attributes = {}) {
  return Object.assign(element('input'), { value }, attributes);
}
function select(options, value) {
  const control = element('select');
  control.append(...options.map(({ id, name }) => Object.assign(element('option', name), { value: id })));
  control.value = value;
  return control;
}
function number(value) {
  const text = value.trim().replace(',', '.');
  if (!/^\d{1,5}(?:\.\d{1,3})?$/.test(text)) return null;
  const result = Number(text);
  return result <= 99999 ? result : null;
}
function editFood(item, mealId) {
  const key = date;
  const fields = dialog(item ? 'Изменить продукт' : 'Добавить продукт',
    item && (() => changeDay(key, day => { day.foods = day.foods.filter(food => food.id !== item.id); })));
  const name = field(fields, 'Продукт или блюдо', input(item?.name, { maxLength: 100 }));
  const options = [...sortedMeals(data.meals), { id: 'other', name: 'Без привязки' }];
  if (item && !options.some(meal => meal.id === item.mealId)) options.push({ id: item.mealId, name: item.mealName });
  const meal = field(fields, 'Приём пищи', select(options, mealId ?? data.meals[0]?.id ?? 'other'));
  const mode = field(fields, 'Способ подсчёта', select([
    { id: 'portion', name: 'Калории порции' }, { id: 'weight', name: 'По весу и калорийности на 100 г' }
  ], item?.per100 != null ? 'weight' : 'portion'));
  const direct = element('div');
  const calc = element('div');
  const portion = field(direct, 'Калории порции, ккал', input(item ? String(item.tenths / 10) : '', { inputMode: 'decimal' }));
  const energy = field(calc, 'Калорийность на 100 г, ккал', input(item?.per100 ?? '', { inputMode: 'decimal' }));
  const grams = field(calc, 'Вес порции, г', input(item?.grams ?? '', { inputMode: 'decimal' }));
  const preview = element('p');
  calc.append(preview);
  fields.append(direct, calc);
  const refresh = () => {
    direct.hidden = mode.value === 'weight';
    calc.hidden = !direct.hidden;
    const e = number(energy.value), g = number(grams.value);
    preview.textContent = e != null && g > 0 ? 'В порции ' + kcal(portionTenths(e, g) / 10) : '';
  };
  for (const control of [mode, energy, grams]) control.addEventListener('input', refresh);
  refresh();
  action = () => {
    const title = name.value.trim();
    if (!title) throw new Error('Укажите название продукта или блюда.');
    const food = { id: item?.id ?? unique(), name: title, mealId: meal.value, mealName: meal.selectedOptions[0].textContent };
    if (mode.value === 'weight') {
      food.per100 = number(energy.value);
      food.grams = number(grams.value);
      if (food.per100 == null || !(food.grams > 0)) throw new Error('Укажите калорийность на 100 г и вес больше нуля.');
      food.tenths = portionTenths(food.per100, food.grams);
    } else {
      const calories = number(portion.value);
      if (calories == null) throw new Error('Введите калории порции числом от 0 до 99 999.');
      food.tenths = Math.round(Math.round(calories * 1000) / 100);
    }
    changeDay(key, day => {
      if (item) day.foods[day.foods.findIndex(entry => entry.id === item.id)] = food;
      else day.foods.push(food);
    });
  };
  showEditor();
}
function portionTenths(energy, grams) {
  return Number((BigInt(Math.round(energy * 1000)) * BigInt(Math.round(grams * 1000)) + 5000000n) / 10000000n);
}
function editExercise(item) {
  const key = date;
  const fields = dialog(item ? 'Изменить упражнение' : 'Добавить упражнение',
    item && (() => changeDay(key, day => { day.exercises = day.exercises.filter(entry => entry.id !== item.id); })));
  const name = field(fields, 'Название', input(item?.name, { maxLength: 100 }));
  const details = field(fields, 'Подходы, повторения, вес или время',
    Object.assign(element('textarea'), { value: item?.details ?? '', maxLength: 400 }));
  action = () => {
    const title = name.value.trim();
    if (!title) throw new Error('Укажите название упражнения.');
    const exercise = { id: item?.id ?? unique(), name: title, details: details.value.trim(), done: item?.done ?? false };
    changeDay(key, day => {
      if (item) day.exercises[day.exercises.findIndex(entry => entry.id === item.id)] = exercise;
      else day.exercises.push(exercise);
    });
  };
  showEditor();
}
function showEditor() {
  $('close-editor').setAttribute('autofocus', '');
  $('editor').showModal();
}
function editSettings() {
  const fields = dialog('Настройки');
  const goal = field(fields, 'Дневная цель, ккал (необязательно)', input(data.goal ?? '', { inputMode: 'numeric', maxLength: 5 }));
  fields.append(element('p', 'Расписание повторяется каждый день.'));
  const schedule = element('div');
  schedule.id = 'schedule';
  fields.append(schedule);
  function mealRow(item) {
    const row = element('div', null, 'label-row');
    row.dataset.id = item.id;
    const name = input(item.name, { maxLength: 48 });
    name.setAttribute('aria-label', 'Название приёма пищи');
    const time = input(item.time, { type: 'time' });
    time.setAttribute('aria-label', 'Время приёма пищи');
    const remove = button('×', () => row.remove(), 'danger square');
    remove.setAttribute('aria-label', 'Убрать приём из расписания');
    row.append(name, time, remove);
    schedule.append(row);
    return name;
  }
  for (const meal of sortedMeals(data.meals)) mealRow(meal);
  fields.append(button('＋ Приём пищи', () => mealRow({ id: unique(), name: '', time: '' }).focus()));
  fields.append(element('p', 'Чтобы получать оповещения при закрытом дневнике, импортируйте расписание в «Календарь» Apple. После изменения времени обновите события в календаре.'));
  const exportButton = button('Сохранить расписание для «Календаря»', () => {
    try { exportCalendar(settingsValue().meals).catch(showError); }
    catch (error) { showError(error); }
  }, 'secondary');
  exportButton.id = 'export';
  fields.append(exportButton);
  function settingsValue() {
    const text = goal.value.trim();
    const target = text === '' ? null : Number(text);
    if (text && (!/^\d+$/.test(text) || target < 1 || target > 99999)) throw new Error('Введите целую цель от 1 до 99 999 или оставьте поле пустым.');
    const meals = Array.from(schedule.children, row => ({
      id: row.dataset.id, name: row.children[0].value.trim(), time: row.children[1].value
    }));
    if (meals.some(meal => !meal.name || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(meal.time))) {
      throw new Error('Укажите название и время каждого приёма пищи.');
    }
    return { goal: target, meals };
  }
  action = () => { const settings = settingsValue(); commit(next => Object.assign(next, settings)); };
  showEditor();
}

function calendarText(meals, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ritm//Meal reminders//RU', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Ритм — питание'];
  const escape = value => value.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replace(/\r?\n/g, '\\n');
  for (const meal of sortedMeals(meals)) {
    const [hours, minutes] = meal.time.split(':').map(Number);
    const start = new Date(now);
    start.setHours(hours, minutes, 0, 0);
    if (start <= now) start.setDate(start.getDate() + 1);
    const time = meal.time.replace(':', '') + '00';
    lines.push('BEGIN:VEVENT', 'UID:' + meal.id + '@ritm-diary', 'DTSTAMP:' + stamp,
      'DTSTART:' + dateKey(start).replaceAll('-', '') + 'T' + time, 'DURATION:PT1M', 'RRULE:FREQ=DAILY', 'SUMMARY:' + escape(meal.name),
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Время поесть', 'END:VALARM', 'END:VEVENT');
  }
  const encoder = new TextEncoder();
  return lines.map(line => {
    let result = '', size = 0;
    for (const char of line) {
      const length = encoder.encode(char).length;
      if (size + length > 75) { result += '\r\n '; size = 1; }
      result += char;
      size += length;
    }
    return result;
  }).join('\r\n') + '\r\n';
}
async function exportCalendar(meals) {
  if (meals.length === 0) { showError(new Error('Добавьте хотя бы один приём пищи.')); return; }
  const file = new File([calendarText(meals)], 'ritm-pitanie.ics', { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const link = Object.assign(element('a'), { href: url, download: file.name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
function showError(error) {
  $('error').textContent = error.message;
  $('error').hidden = false;
}

$('settings').addEventListener('click', editSettings);
$('previous').addEventListener('click', () => selectDate(offsetDate(date, -1)));
$('next').addEventListener('click', () => selectDate(offsetDate(date, 1)));
$('today').addEventListener('click', () => selectDate(dateKey(new Date())));
$('date').addEventListener('change', event => selectDate(event.target.value));
$('add-food').addEventListener('click', () => editFood());
$('add-exercise').addEventListener('click', () => editExercise());
$('plan-training').addEventListener('click', editTrainingProgram);
for (const section of ['nutrition', 'training']) {
  $(section + '-tab').addEventListener('click', () => {
    for (const id of ['nutrition', 'training']) {
      $(id + '-tab').setAttribute('aria-pressed', String(id === section));
      $(id).hidden = id !== section;
    }
  });
}
$('close-editor').addEventListener('click', () => $('editor').close());
$('edit-form').addEventListener('submit', event => {
  event.preventDefault();
  try { if (action() !== false) $('editor').close(); }
  catch (error) { showError(error); }
});
$('remove').addEventListener('click', () => {
  if (!confirm('Удалить эту запись?')) return;
  try { removal(); $('editor').close(); }
  catch (error) { showError(error); }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const today = dateKey(new Date());
  if (openedOn !== today && date === openedOn) selectDate(today);
  openedOn = today;
});
window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  data = readDiary();
  render();
});
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
