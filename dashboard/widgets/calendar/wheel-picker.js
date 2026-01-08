// Wheel Picker Component for Calendar
// Vanilla JS version of the health-tracker TimePicker

const ITEM_HEIGHT = 44;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Create a single wheel
function createWheel(items, selectedValue, onChange) {
  const container = document.createElement('div');
  container.className = 'wheel-container';
  container.innerHTML = `
    <div class="wheel-gradient-top"></div>
    <div class="wheel-gradient-bottom"></div>
    <div class="wheel-selection"></div>
    <div class="wheel-scroll"></div>
  `;

  const scrollEl = container.querySelector('.wheel-scroll');
  let isScrolling = false;
  let scrollTimeout = null;

  // Add padding + items
  const paddingTop = document.createElement('div');
  paddingTop.style.height = `${ITEM_HEIGHT}px`;
  scrollEl.appendChild(paddingTop);

  items.forEach((item) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'wheel-item';
    itemEl.textContent = item;
    itemEl.dataset.value = item;
    if (item === selectedValue) {
      itemEl.classList.add('selected');
    }
    itemEl.addEventListener('click', () => {
      onChange(item);
      updateSelection(item);
      scrollToItem(item);
    });
    scrollEl.appendChild(itemEl);
  });

  const paddingBottom = document.createElement('div');
  paddingBottom.style.height = `${ITEM_HEIGHT}px`;
  scrollEl.appendChild(paddingBottom);

  function updateSelection(value) {
    scrollEl.querySelectorAll('.wheel-item').forEach((el) => {
      el.classList.toggle('selected', el.dataset.value === value);
    });
  }

  function scrollToItem(value) {
    const index = items.indexOf(value);
    if (index >= 0) {
      scrollEl.scrollTop = index * ITEM_HEIGHT;
    }
  }

  function handleScroll() {
    isScrolling = true;
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const scrollTop = scrollEl.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
      scrollEl.scrollTop = clampedIndex * ITEM_HEIGHT;
      const newValue = items[clampedIndex];
      if (newValue !== selectedValue) {
        onChange(newValue);
        updateSelection(newValue);
      }
      isScrolling = false;
    }, 100);
  }

  scrollEl.addEventListener('scroll', handleScroll);

  // Initial scroll position
  setTimeout(() => scrollToItem(selectedValue), 0);

  // Method to update items (for dynamic lists like days)
  container.updateItems = (newItems, newSelected) => {
    // Clear existing items
    while (scrollEl.children.length > 2) {
      scrollEl.removeChild(scrollEl.children[1]);
    }
    // Re-add items
    newItems.forEach((item) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'wheel-item';
      itemEl.textContent = item;
      itemEl.dataset.value = item;
      if (item === newSelected) {
        itemEl.classList.add('selected');
      }
      itemEl.addEventListener('click', () => {
        onChange(item);
        updateSelection(item);
        scrollToItem(item);
      });
      scrollEl.insertBefore(itemEl, paddingBottom);
    });
    items = newItems;
    selectedValue = newSelected;
    setTimeout(() => scrollToItem(newSelected), 0);
  };

  return container;
}

// Create the full date-time picker
export function createDateTimePicker(initialDate, onChange, options = {}) {
  const { allowFuture = true, showDate = true, showTime = true } = options;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  let date = initialDate ? new Date(initialDate) : new Date();
  let year = date.getFullYear();
  let month = date.getMonth();
  let day = date.getDate();
  let hour = date.getHours();
  let minute = Math.floor(date.getMinutes() / 5) * 5;
  let isPM = hour >= 12;
  let hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  const container = document.createElement('div');
  container.className = 'wheel-picker';

  const wheelsContainer = document.createElement('div');
  wheelsContainer.className = 'wheel-picker-wheels';
  container.appendChild(wheelsContainer);

  let monthWheel, dayWheel, yearWheel, hourWheel, minuteWheel;

  function getAvailableYears() {
    if (allowFuture) {
      return [String(currentYear), String(currentYear + 1)];
    }
    return [String(currentYear - 1), String(currentYear)];
  }

  function getAvailableMonths() {
    if (allowFuture) {
      if (year === currentYear) {
        return MONTHS.slice(currentMonth);
      }
      return [...MONTHS];
    } else {
      if (year === currentYear) {
        return MONTHS.slice(0, currentMonth + 1);
      }
      return [...MONTHS];
    }
  }

  function getAvailableDays() {
    const daysInMonth = getDaysInMonth(year, month);
    const isCurrentYearMonth = year === currentYear && month === currentMonth;
    let maxDay;

    if (allowFuture) {
      maxDay = daysInMonth;
    } else {
      maxDay = isCurrentYearMonth ? currentDay : daysInMonth;
    }

    return Array.from({ length: maxDay }, (_, i) => String(i + 1));
  }

  function emitChange() {
    let h = hour12;
    if (isPM && hour12 !== 12) h = hour12 + 12;
    if (!isPM && hour12 === 12) h = 0;

    const newDate = new Date(year, month, day, h, minute, 0, 0);
    onChange(newDate);
  }

  function updateDayWheel() {
    const availableDays = getAvailableDays();
    const maxDay = Number(availableDays[availableDays.length - 1]);
    if (day > maxDay) {
      day = maxDay;
    }
    if (dayWheel) {
      dayWheel.updateItems(availableDays, String(day));
    }
  }

  function updateMonthWheel() {
    const availableMonths = getAvailableMonths();
    if (!availableMonths.includes(MONTHS[month])) {
      month = allowFuture ? MONTHS.indexOf(availableMonths[0]) : MONTHS.indexOf(availableMonths[availableMonths.length - 1]);
    }
    if (monthWheel) {
      monthWheel.updateItems(availableMonths, MONTHS[month]);
    }
    updateDayWheel();
  }

  // Build wheels
  if (showDate) {
    // Month wheel
    monthWheel = createWheel(getAvailableMonths(), MONTHS[month], (val) => {
      month = MONTHS.indexOf(val);
      updateDayWheel();
      emitChange();
    });
    monthWheel.classList.add('wheel-month');
    wheelsContainer.appendChild(monthWheel);

    // Day wheel
    dayWheel = createWheel(getAvailableDays(), String(day), (val) => {
      day = Number(val);
      emitChange();
    });
    dayWheel.classList.add('wheel-day');
    wheelsContainer.appendChild(dayWheel);

    // Year wheel
    yearWheel = createWheel(getAvailableYears(), String(year), (val) => {
      year = Number(val);
      updateMonthWheel();
      emitChange();
    });
    yearWheel.classList.add('wheel-year');
    wheelsContainer.appendChild(yearWheel);

    // Spacer
    const spacer = document.createElement('div');
    spacer.className = 'wheel-spacer';
    wheelsContainer.appendChild(spacer);
  }

  if (showTime) {
    // Hour wheel
    const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
    hourWheel = createWheel(hours, String(hour12), (val) => {
      hour12 = Number(val);
      emitChange();
    });
    hourWheel.classList.add('wheel-hour');
    wheelsContainer.appendChild(hourWheel);

    // Colon separator
    const colon = document.createElement('div');
    colon.className = 'wheel-colon';
    colon.textContent = ':';
    wheelsContainer.appendChild(colon);

    // Minute wheel
    const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
    minuteWheel = createWheel(minutes, String(minute).padStart(2, '0'), (val) => {
      minute = Number(val);
      emitChange();
    });
    minuteWheel.classList.add('wheel-minute');
    wheelsContainer.appendChild(minuteWheel);

    // AM/PM toggle
    const ampmContainer = document.createElement('div');
    ampmContainer.className = 'wheel-ampm';
    ampmContainer.innerHTML = `
      <button class="ampm-btn ${!isPM ? 'active' : ''}" data-value="am">AM</button>
      <button class="ampm-btn ${isPM ? 'active' : ''}" data-value="pm">PM</button>
    `;
    ampmContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.ampm-btn');
      if (btn) {
        isPM = btn.dataset.value === 'pm';
        ampmContainer.querySelectorAll('.ampm-btn').forEach((b) => {
          b.classList.toggle('active', b.dataset.value === (isPM ? 'pm' : 'am'));
        });
        emitChange();
      }
    });
    wheelsContainer.appendChild(ampmContainer);
  }

  // Initial emit
  setTimeout(emitChange, 0);

  return container;
}

// Create a time-only picker (for start/end times)
export function createTimePicker(initialTime, onChange) {
  // Parse time string like "09:00" or "14:30"
  let hour = 9, minute = 0;
  if (initialTime) {
    const [h, m] = initialTime.split(':').map(Number);
    hour = h;
    minute = Math.floor(m / 5) * 5;
  }

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return createDateTimePicker(date, (newDate) => {
    const h = String(newDate.getHours()).padStart(2, '0');
    const m = String(newDate.getMinutes()).padStart(2, '0');
    onChange(`${h}:${m}`);
  }, { showDate: false, showTime: true });
}
