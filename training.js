// Each strength session alternates knee- and hip-dominant work and trains the upper body.
const trainingProfiles = {
  goal: [
    { id: 'muscle', name: 'Набрать мышцы' },
    { id: 'strength', name: 'Стать сильнее' },
    { id: 'fitness', name: 'Поддерживать форму' }
  ],
  equipment: [
    { id: 'bodyweight', name: 'Дома без инвентаря' },
    { id: 'dumbbells', name: 'Дома с гантелями' },
    { id: 'gym', name: 'В зале' }
  ],
  level: [
    { id: 'beginner', name: 'Начинаю или возвращаюсь после перерыва' },
    { id: 'regular', name: 'Тренируюсь регулярно' }
  ],
  days: Array.from({ length: 7 }, (_, i) => ({ id: String(i + 1), name: String(i + 1) }))
};
const firstTrainingProfile = { goal: 'muscle', equipment: 'bodyweight', level: 'beginner', days: '7' };

const homeSessions = [
  [
    ['Приседания', 'Сгибайте колени в направлении носков.'],
    ['Отжимания', 'Начните от стены или с колен, если от пола пока тяжело.'],
    ['Ягодичный мост', 'Сделайте паузу на секунду в верхней точке.'],
    ['Сведение лопаток лёжа на животе', 'Согните руки буквой W, слегка приподнимите их и сведите лопатки.'],
    ['Планка на предплечьях', 'Держите корпус ровно. С колен будет легче.', 'time']
  ],
  [
    ['Выпады назад', 'Для равновесия можно придерживаться стены.', 'side'],
    ['Отжимания', 'Используйте тот же вариант, что в первой тренировке.'],
    ['Наклоны с отведением таза', 'Слегка согните колени и отводите таз назад.'],
    ['Обратные «снежные ангелы»', 'Лёжа на животе, медленно проведите руками дугу вдоль пола.'],
    ['«Мёртвый жук»', 'Поочерёдно вытягивайте противоположные руку и ногу.', 'side']
  ]
];
const equipmentSessions = {
  dumbbells: [
    [['Приседания с гантелью у груди'], ['Жим гантелей лёжа на полу'], ['Румынская тяга с гантелями'], ['Тяга гантели в наклоне', '', 'side'], homeSessions[0][4]],
    [['Выпады назад с гантелями', '', 'side'], ['Жим гантелей стоя'], ['Ягодичный мост с гантелью'], ['Тяга двух гантелей в наклоне'], homeSessions[1][4]]
  ],
  gym: [
    [['Жим ногами'], ['Жим от груди в тренажёре'], ['Румынская тяга с гантелями'], ['Горизонтальная тяга блока'], homeSessions[0][4]],
    [['Приседания с гантелью у груди'], ['Жим вверх в тренажёре'], ['Сгибание ног в тренажёре'], ['Вертикальная тяга блока'], homeSessions[1][4]]
  ]
};

function buildTrainingWeek(start, profile) {
  const activeDays = {
    1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 2, 4, 6],
    5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6]
  }[profile.days];
  const strengthDays = activeDays.length < 3 ? activeDays : [0, 2, 4];
  const regular = profile.level === 'regular';
  const strength = profile.goal === 'strength';
  const sets = profile.goal === 'fitness' ? 2 : regular ? 3 : 2;
  const reps = strength ? (regular && profile.equipment !== 'bodyweight' ? '5–8' : '6–10') :
    profile.goal === 'fitness' ? '8–15' : '8–12';
  const rest = strength ? '2–3 минуты' : '60–120 секунд';
  const movements = equipmentSessions[profile.equipment] ?? homeSessions;

  return Array.from({ length: 7 }, (_, offset) => {
    const key = offsetDate(start, offset);
    const index = strengthDays.indexOf(offset);
    if (index < 0) {
      if (!activeDays.includes(offset)) return { key, title: 'Отдых', exercises: [] };
      return { key, title: 'Восстановление', exercises: [
        { name: 'Прогулка в спокойном темпе', details: '15–25 минут в темпе, в котором легко разговаривать.' }
      ] };
    }

    const variant = index % 2;
    const exercises = [{ name: 'Разминка', details: '5 минут ходьбы на месте и лёгких движений. Перед первым упражнением сделайте несколько пробных повторений.' }];
    for (const [name, tip, kind] of movements[variant]) {
      const dose = kind === 'time' ? (regular ? '20–35 секунд' : '15–25 секунд') :
        reps + ' повторений' + (kind === 'side' ? ' на сторону' : '');
      exercises.push({ name, details: sets + ' подхода × ' + dose + '. Отдых ' + rest + '.' + (tip ? ' ' + tip : '') });
    }
    return { key, title: 'Силовая ' + (variant ? 'Б' : 'А'), exercises };
  });
}

function programDateLabel(key) {
  return asDate(key).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function saveTrainingWeek(profile, week) {
  commit(next => {
    next.trainingProfile = profile;
    for (const session of week) {
      const day = dayAt(next, session.key);
      const kept = day.exercises.filter(item => !item.fromProgram || item.done);
      const scheduledNames = new Set(session.exercises.map(item => item.name));
      const scheduled = session.exercises.flatMap(item => {
        const existing = kept.filter(entry => entry.name === item.name);
        return existing.length ? existing : [{ ...item, id: unique(), done: false, fromProgram: true }];
      });
      day.exercises = [...scheduled, ...kept.filter(item => !scheduledNames.has(item.name))];
      day.trainingTitle = session.title;
      next.days[session.key] = day;
    }
  });
}

function editTrainingProgram() {
  const fields = dialog('Программа тренировок');
  const profile = { ...firstTrainingProfile, ...data.trainingProfile };
  const settings = element('div');
  const choices = {};
  const labels = { goal: 'Цель', equipment: 'Место и инвентарь', level: 'Опыт', days: 'Дней активности в неделю' };
  for (const [key, options] of Object.entries(trainingProfiles)) {
    choices[key] = field(settings, labels[key], select(options, profile[key]));
  }

  const today = dateKey(new Date());
  const start = field(settings, 'Начало программы', input(date >= today ? date : today, { type: 'date', min: today, max: '9999-12-25' }));
  fields.append(settings);
  const preview = element('div');
  preview.hidden = true;
  fields.append(preview);

  function configure() {
    preview.hidden = true;
    settings.hidden = false;
    $('error').hidden = true;
    $('save').textContent = 'Показать программу';
    action = showWeek;
  }

  function showWeek() {
    if (start.value < today || start.value > start.max || !/^\d{4}-\d{2}-\d{2}$/.test(start.value)) {
      throw new Error('Выберите дату начала, начиная с сегодняшнего дня.');
    }
    const updatedProfile = Object.fromEntries(Object.entries(choices).map(([key, control]) => [key, control.value]));
    const week = buildTrainingWeek(start.value, updatedProfile);
    const list = element('div', null, 'program-week');
    for (const session of week) {
      const detail = element('details');
      const heading = element('summary', programDateLabel(session.key) + ' · ' + session.title);
      detail.append(heading);
      if (session.exercises.length) {
        const exercises = element('ul');
        for (const item of session.exercises) {
          const entry = element('li');
          entry.append(element('strong', item.name), element('p', item.details));
          exercises.append(entry);
        }
        detail.append(exercises);
      } else {
        detail.append(element('p', 'День без запланированных упражнений.'));
      }
      list.append(detail);
    }
    const overlaps = week.some(session => dayAt(data, session.key).exercises.some(item => item.fromProgram && !item.done));
    const summary = week.filter(session => session.title.startsWith('Силовая')).length + ' силовых · ' +
      week.filter(session => session.title === 'Восстановление').length + ' дней восстановления';
    const guidance = updatedProfile.goal === 'fitness'
      ? 'Выберите вариант упражнения, который можете выполнять с ровной техникой.'
      : 'Оставляйте 2–3 повторения в запасе. Когда верхняя граница повторений даётся во всех подходах, усложните движение. Например, перейдите от отжиманий с колен к обычным или немного увеличьте вес, если он есть.';
    preview.replaceChildren(element('p', summary, 'program-summary'), element('p', guidance), list);
    if (overlaps) preview.append(element('p', 'На эти даты обновятся невыполненные упражнения из предыдущей программы.'));
    preview.append(button('Изменить параметры', configure));
    settings.hidden = true;
    preview.hidden = false;
    $('error').hidden = true;
    $('save').textContent = 'Добавить в дневник';
    const firstDate = week[0].key;
    action = () => {
      saveTrainingWeek(updatedProfile, week);
      selectDate(firstDate);
      $('status').textContent = 'Программа на неделю добавлена в дневник.';
    };
    preview.querySelector('summary').focus();
    return false;
  }

  configure();
  showEditor();
}
