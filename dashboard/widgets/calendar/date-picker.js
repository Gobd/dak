// Date Picker Component - Google Calendar style
// Mini calendar popup for date, dropdown for time

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Will be set from calendar config
let weekStartsOn = 1; // 0 = Sunday, 1 = Monday

export function setWeekStart(start) {
  weekStartsOn = start;
}

function formatDateDisplay(date) {
  const day = DAYS[date.getDay()];
  const month = MONTHS[date.getMonth()];
  const dayNum = date.getDate();
  const year = date.getFullYear();
  return `${day}, ${month} ${dayNum}, ${year}`;
}

function generateTimeOptions() {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 ? 'AM' : 'PM';
      const display = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      options.push({ display, value });
    }
  }
  return options;
}

function createMiniCalendar(selectedDate, onSelect, onClose) {
  let viewMonth = selectedDate.getMonth();
  let viewYear = selectedDate.getFullYear();

  const overlay = document.createElement('div');
  overlay.className = 'mini-cal-overlay';

  const popup = document.createElement('div');
  popup.className = 'mini-cal-popup';

  // Get weekday names in correct order based on weekStartsOn
  function getOrderedDays() {
    const ordered = [];
    for (let i = 0; i < 7; i++) {
      ordered.push(DAYS[(weekStartsOn + i) % 7]);
    }
    return ordered;
  }

  function render() {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    // Adjust for week start day
    const firstDayOffset = (firstDayOfMonth - weekStartsOn + 7) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = new Date();
    const orderedDays = getOrderedDays();

    let daysHtml = '';
    // Empty cells for days before first of month
    for (let i = 0; i < firstDayOffset; i++) {
      daysHtml += '<div class="mini-cal-day empty"></div>';
    }
    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const isSelected =
        d === selectedDate.getDate() &&
        viewMonth === selectedDate.getMonth() &&
        viewYear === selectedDate.getFullYear();
      const isToday =
        d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
      const classes = ['mini-cal-day'];
      if (isSelected) classes.push('selected');
      if (isToday) classes.push('today');
      daysHtml += `<div class="${classes.join(' ')}" data-day="${d}">${d}</div>`;
    }

    popup.innerHTML = `
      <div class="mini-cal-header">
        <button class="mini-cal-nav" data-dir="-1">&lt;</button>
        <span class="mini-cal-title">${MONTHS[viewMonth]} ${viewYear}</span>
        <button class="mini-cal-nav" data-dir="1">&gt;</button>
      </div>
      <div class="mini-cal-weekdays">
        ${orderedDays.map((d) => `<div>${d.charAt(0)}</div>`).join('')}
      </div>
      <div class="mini-cal-days">
        ${daysHtml}
      </div>
    `;
  }

  render();

  popup.addEventListener('click', (e) => {
    const nav = e.target.closest('.mini-cal-nav');
    if (nav) {
      const dir = parseInt(nav.dataset.dir);
      viewMonth += dir;
      if (viewMonth < 0) {
        viewMonth = 11;
        viewYear--;
      } else if (viewMonth > 11) {
        viewMonth = 0;
        viewYear++;
      }
      render();
      return;
    }

    const day = e.target.closest('.mini-cal-day:not(.empty)');
    if (day) {
      const d = parseInt(day.dataset.day);
      const newDate = new Date(viewYear, viewMonth, d);
      onSelect(newDate);
      overlay.remove();
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      onClose();
    }
  });

  overlay.appendChild(popup);
  return overlay;
}

export function createDateTimePicker(initialDate, onChange, options = {}) {
  const { showTime = true } = options;

  let selectedDate = initialDate ? new Date(initialDate) : new Date();
  let selectedHour = selectedDate.getHours();
  let selectedMinute = Math.floor(selectedDate.getMinutes() / 15) * 15;

  const container = document.createElement('div');
  container.className = 'datetime-picker';

  const dateBtn = document.createElement('button');
  dateBtn.type = 'button';
  dateBtn.className = 'date-picker-btn';
  dateBtn.textContent = formatDateDisplay(selectedDate);
  container.appendChild(dateBtn);

  let timeSelect = null;
  if (showTime) {
    timeSelect = document.createElement('select');
    timeSelect.className = 'time-picker-select';
    const timeOptions = generateTimeOptions();
    timeOptions.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.display;
      timeSelect.appendChild(option);
    });
    // Set initial time
    const initialTimeValue = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
    timeSelect.value = initialTimeValue;
    container.appendChild(timeSelect);

    timeSelect.addEventListener('change', () => {
      const [h, m] = timeSelect.value.split(':').map(Number);
      selectedHour = h;
      selectedMinute = m;
      emitChange();
    });
  }

  function emitChange() {
    const result = new Date(selectedDate);
    if (showTime) {
      result.setHours(selectedHour, selectedMinute, 0, 0);
    }
    onChange(result);
  }

  function updateDateDisplay() {
    dateBtn.textContent = formatDateDisplay(selectedDate);
  }

  dateBtn.addEventListener('click', () => {
    const popup = createMiniCalendar(
      selectedDate,
      (newDate) => {
        selectedDate = newDate;
        updateDateDisplay();
        emitChange();
      },
      () => {}
    );
    document.body.appendChild(popup);
  });

  // Initial emit
  setTimeout(emitChange, 0);

  // Expose method to hide time (for all-day toggle)
  container.setShowTime = (show) => {
    if (timeSelect) {
      timeSelect.style.display = show ? '' : 'none';
    }
  };

  return container;
}
