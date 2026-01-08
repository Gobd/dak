// Wheel Picker Component for Calendar
// Vanilla JS version of the health-tracker TimePicker
// Hybrid picker: mini calendar for date + wheel for time

const ITEM_HEIGHT = 44;
const COMPACT_ITEM_HEIGHT = 32;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

// Will be set from calendar config
let weekStartsOn = 1; // 0 = Sunday, 1 = Monday

export function setWeekStart(start) {
  weekStartsOn = start;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Create a single wheel (optionally compact)
function createWheel(items, selectedValue, onChange, compact = false) {
  const itemHeight = compact ? COMPACT_ITEM_HEIGHT : ITEM_HEIGHT;
  const containerHeight = itemHeight * 3;

  const container = document.createElement('div');
  container.className = 'wheel-container' + (compact ? ' wheel-compact' : '');
  container.style.height = `${containerHeight}px`;
  container.innerHTML = `
    <div class="wheel-gradient-top" style="height: ${itemHeight}px"></div>
    <div class="wheel-gradient-bottom" style="height: ${itemHeight}px"></div>
    <div class="wheel-selection" style="top: ${itemHeight}px; height: ${itemHeight}px"></div>
    <div class="wheel-scroll" style="height: ${containerHeight}px"></div>
  `;

  const scrollEl = container.querySelector('.wheel-scroll');
  let isScrolling = false;
  let scrollTimeout = null;

  // Add padding + items
  const paddingTop = document.createElement('div');
  paddingTop.style.height = `${itemHeight}px`;
  scrollEl.appendChild(paddingTop);

  items.forEach((item) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'wheel-item';
    itemEl.style.height = `${itemHeight}px`;
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
  paddingBottom.style.height = `${itemHeight}px`;
  scrollEl.appendChild(paddingBottom);

  function updateSelection(value) {
    scrollEl.querySelectorAll('.wheel-item').forEach((el) => {
      el.classList.toggle('selected', el.dataset.value === value);
    });
  }

  function scrollToItem(value) {
    const index = items.indexOf(value);
    if (index >= 0) {
      scrollEl.scrollTop = index * itemHeight;
    }
  }

  function handleScroll() {
    isScrolling = true;
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const scrollTop = scrollEl.scrollTop;
      const index = Math.round(scrollTop / itemHeight);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
      scrollEl.scrollTop = clampedIndex * itemHeight;
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
      itemEl.style.height = `${itemHeight}px`;
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

// Format date display like "Wed, Jan 8, 2026"
function formatDateDisplay(date) {
  const day = DAYS[date.getDay()];
  const month = MONTHS[date.getMonth()];
  const dayNum = date.getDate();
  const year = date.getFullYear();
  return `${day}, ${month} ${dayNum}, ${year}`;
}

// Create mini calendar popup for date selection
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
      const isSelected = d === selectedDate.getDate() &&
                         viewMonth === selectedDate.getMonth() &&
                         viewYear === selectedDate.getFullYear();
      const isToday = d === today.getDate() &&
                      viewMonth === today.getMonth() &&
                      viewYear === today.getFullYear();
      const classes = ['mini-cal-day'];
      if (isSelected) classes.push('selected');
      if (isToday) classes.push('today');
      daysHtml += `<div class="${classes.join(' ')}" data-day="${d}">${d}</div>`;
    }

    popup.innerHTML = `
      <div class="mini-cal-header">
        <button class="mini-cal-nav" data-dir="-1">&lt;</button>
        <span class="mini-cal-title">${FULL_MONTHS[viewMonth]} ${viewYear}</span>
        <button class="mini-cal-nav" data-dir="1">&gt;</button>
      </div>
      <div class="mini-cal-weekdays">
        ${orderedDays.map(d => `<div>${d.charAt(0)}</div>`).join('')}
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

// Create hybrid picker: mini calendar button for date + wheel picker for time
export function createHybridDateTimePicker(initialDate, onChange, options = {}) {
  const { showTime = true, allowFuture = true, label = '' } = options;

  let selectedDate = initialDate ? new Date(initialDate) : new Date();
  let selectedHour = selectedDate.getHours();
  let selectedMinute = Math.floor(selectedDate.getMinutes() / 5) * 5;
  let isPM = selectedHour >= 12;
  let hour12 = selectedHour === 0 ? 12 : selectedHour > 12 ? selectedHour - 12 : selectedHour;

  const container = document.createElement('div');
  container.className = 'hybrid-datetime-picker';

  // Date section with label above
  const dateSection = document.createElement('div');
  dateSection.className = 'hybrid-date-section';

  if (label) {
    const labelEl = document.createElement('div');
    labelEl.className = 'hybrid-label';
    labelEl.textContent = label;
    dateSection.appendChild(labelEl);
  }

  // Date button (opens mini calendar)
  const dateBtn = document.createElement('button');
  dateBtn.type = 'button';
  dateBtn.className = 'date-picker-btn';
  dateBtn.textContent = formatDateDisplay(selectedDate);
  dateSection.appendChild(dateBtn);
  container.appendChild(dateSection);

  // Time wheel picker (only if showTime)
  let timeContainer = null;
  let hourWheel = null;
  let minuteWheel = null;

  if (showTime) {
    timeContainer = document.createElement('div');
    timeContainer.className = 'wheel-picker time-only';

    const wheelsContainer = document.createElement('div');
    wheelsContainer.className = 'wheel-picker-wheels';
    timeContainer.appendChild(wheelsContainer);

    // Hour wheel (compact for inline layout)
    const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
    hourWheel = createWheel(hours, String(hour12), (val) => {
      hour12 = Number(val);
      emitChange();
    }, true);
    hourWheel.classList.add('wheel-hour');
    wheelsContainer.appendChild(hourWheel);

    // Colon separator
    const colon = document.createElement('div');
    colon.className = 'wheel-colon';
    colon.textContent = ':';
    wheelsContainer.appendChild(colon);

    // Minute wheel (compact for inline layout)
    const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
    minuteWheel = createWheel(minutes, String(selectedMinute).padStart(2, '0'), (val) => {
      selectedMinute = Number(val);
      emitChange();
    }, true);
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

    container.appendChild(timeContainer);
  }

  function emitChange() {
    const result = new Date(selectedDate);
    if (showTime) {
      let h = hour12;
      if (isPM && hour12 !== 12) h = hour12 + 12;
      if (!isPM && hour12 === 12) h = 0;
      result.setHours(h, selectedMinute, 0, 0);
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

  // Expose method to get/set date for sync purposes
  container.getDate = () => selectedDate;
  container.setDate = (newDate) => {
    selectedDate = new Date(newDate);
    updateDateDisplay();
    // Don't emit - caller handles that
  };

  // Expose method to hide/show time (for all-day toggle)
  container.setShowTime = (show) => {
    if (timeContainer) {
      timeContainer.style.display = show ? '' : 'none';
    }
  };

  // Initial emit
  setTimeout(emitChange, 0);

  return container;
}
