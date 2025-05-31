// script.js for Habit Tracker

document.addEventListener('DOMContentLoaded', () => {
  const habitListContainer = document.getElementById('habit-list-container');
  const addHabitForm = document.getElementById('add-habit-form');
  const settingsModal = document.getElementById('settings-modal');
  const settingsBtn = document.getElementById('settings-btn');
  const closeModalBtn = document.querySelector('.close-modal');
  const habitsSettingsList = document.getElementById('habits-settings-list');
  const habitSelect = document.getElementById('habit-select');
  let habitsChart = null;

  // Render habits in a calendar view by month/year
  function renderHabitsCalendar(habitsArray) {
    habitListContainer.innerHTML = '';
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Create calendar header
    const calendarHeader = document.createElement('div');
    calendarHeader.className = 'calendar-header';
    calendarHeader.innerHTML = `<strong>Habits for ${today.toLocaleString(
      'default',
      {
        month: 'long',
      }
    )} ${year}</strong>`;
    habitListContainer.appendChild(calendarHeader);

    // Create and render calendar table
    const table = document.createElement('table');
    table.className = 'habit-calendar-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.appendChild(document.createElement('th')); // Empty for habit name
    for (let d = 1; d <= daysInMonth; d++) {
      const th = document.createElement('th');
      th.textContent = d;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);

    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    habitsArray.forEach((habit) => {
      // Create the main habit row with checkboxes
      const row = document.createElement('tr');
      const nameCell = document.createElement('td');
      nameCell.className = 'calendar-habit-name';
      nameCell.textContent = habit.name;

      // Create info icon
      const infoIcon = document.createElement('span');
      infoIcon.className = 'info-icon';
      infoIcon.innerHTML = ' ℹ️';
      infoIcon.style.cursor = 'pointer';

      // Add click handler for popup
      infoIcon.addEventListener('click', (e) => {
        e.stopPropagation();

        // Remove any existing popups
        const existingPopup = document.querySelector('.habit-popup');
        const existingBackdrop = document.querySelector('.popup-backdrop');
        if (existingPopup) existingPopup.remove();
        if (existingBackdrop) existingBackdrop.remove();

        const { popup, backdrop } = createPopup(habit);

        // Close popup when clicking outside or pressing escape
        const closePopup = () => {
          popup.remove();
          backdrop.remove();
          document.removeEventListener('keydown', handleEscape);
        };

        const handleEscape = (e) => {
          if (e.key === 'Escape') closePopup();
        };

        document.addEventListener('keydown', handleEscape);
      });

      nameCell.appendChild(infoIcon);
      row.appendChild(nameCell);

      // Add checkbox cells
      for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'calendar-checkbox';
        checkbox.setAttribute('data-id', habit._id);
        const dateForDay = new Date(year, month, d);
        // Check if this day is in completedDates
        const completed =
          habit.completedDates &&
          habit.completedDates.some((dateStr) => {
            const date = new Date(dateStr);
            return (
              date.getFullYear() === year &&
              date.getMonth() === month &&
              date.getDate() === d
            );
          });
        checkbox.checked = completed;
        checkbox.setAttribute('data-date', dateForDay.toISOString());
        cell.appendChild(checkbox);
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    habitListContainer.appendChild(table);

    // Create Monthly Statistics Section
    const statsSection = document.createElement('div');
    statsSection.className = 'monthly-stats-section';

    const statsHeader = document.createElement('h2');
    statsHeader.className = 'monthly-stats-header';
    statsHeader.textContent = `Monthly Progress - ${today.toLocaleString(
      'default',
      {
        month: 'long',
      }
    )} ${year}`;
    statsSection.appendChild(statsHeader);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'monthly-stats-grid';

    habitsArray.forEach((habit) => {
      const monthStats = calculateMonthStats(habit, year, month);
      const statCard = document.createElement('div');
      statCard.className = 'stat-card';

      const completionClass =
        monthStats.percentage >= 80
          ? 'excellent'
          : monthStats.percentage >= 60
          ? 'good'
          : monthStats.percentage >= 40
          ? 'fair'
          : 'needs-improvement';

      statCard.innerHTML = `
        <div class="stat-card-header">
          <h3>${habit.name}</h3>
          <span class="completion-badge ${completionClass}">${
        monthStats.percentage
      }%</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar ${completionClass}" style="width: ${
        monthStats.percentage
      }%"></div>
        </div>
        <div class="stat-details">
          <span>Completed: ${monthStats.completed}/${
        monthStats.total
      } days</span>
          <span class="stat-trend">${
            monthStats.completed > 0 ? '↑' : '−'
          }</span>
        </div>
      `;

      statsGrid.appendChild(statCard);
    });

    statsSection.appendChild(statsGrid);
    habitListContainer.appendChild(statsSection);
  }

  function createPopup(habit) {
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'popup-backdrop';
    document.body.appendChild(backdrop);

    const startDate = new Date(habit.startDate);
    const today = new Date();
    const daysTracking = Math.floor(
      (today - startDate) / (1000 * 60 * 60 * 24)
    );

    const popup = document.createElement('div');
    popup.className = 'habit-popup';
    popup.innerHTML = `
      <div class="popup-content">
        <div class="popup-header">
          <h3>${habit.name}</h3>
          <button class="close-popup">&times;</button>
        </div>
        <div class="popup-body">
          <p>${habit.description || 'No description'}</p>
          <p class="tracking-info">Tracking for ${daysTracking} days</p>
          <p class="start-date">Started on ${startDate.toLocaleDateString()}</p>
          <div class="streak-info">
            <p class="current-streak">Current Streak: ${
              habit.streakCount || 0
            } days 🔥</p>
            <p class="longest-streak">Longest Streak: ${
              habit.longestStreak || 0
            } days 🏆</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    // Update the event listeners to handle both popup and backdrop
    const closePopup = () => {
      popup.remove();
      backdrop.remove();
    };

    backdrop.addEventListener('click', closePopup);
    popup.querySelector('.close-popup').addEventListener('click', closePopup);

    return { popup, backdrop };
  }

  async function fetchHabits() {
    try {
      const response = await fetch('/api/getHabits');
      if (!response.ok) throw new Error('Failed to fetch habits');
      const data = await response.json();
      renderHabitsCalendar(data.habits || []);
      updateHabitSelect(data.habits || []);
      renderHabitsGraph(data.habits || [], 'all');
    } catch (err) {
      habitListContainer.textContent = 'Error loading habits.';
      console.error(err);
    }
  }

  function updateHabitSelect(habits) {
    habitSelect.innerHTML = '<option value="all">All Habits</option>';
    habits.forEach((habit) => {
      const option = document.createElement('option');
      option.value = habit._id;
      option.textContent = habit.name;
      habitSelect.appendChild(option);
    });
  }

  function renderHabitsGraph(habits, selectedHabitId) {
    const ctx = document.getElementById('habits-chart');

    if (habitsChart) {
      habitsChart.destroy();
    }

    let data;
    if (selectedHabitId === 'all') {
      // Show data for all habits
      data = {
        labels: habits.map((h) => h.name),
        datasets: [
          {
            label: 'Completion Rate (%)',
            data: habits.map((habit) => {
              const stats = calculateHabitStats(habit);
              return parseFloat(stats.completionRate);
            }),
            backgroundColor: '#22c55e',
            borderColor: '#16a34a',
            borderWidth: 1,
          },
        ],
      };
    } else {
      // Show daily data for selected habit
      const selectedHabit = habits.find((h) => h._id === selectedHabitId);
      if (selectedHabit) {
        const today = new Date();
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(today);
          date.setDate(today.getDate() - i);
          return date;
        }).reverse();

        data = {
          labels: last7Days.map((date) =>
            date.toLocaleDateString('default', { weekday: 'short' })
          ),
          datasets: [
            {
              label: 'Daily Completion',
              data: last7Days.map((date) => {
                return selectedHabit.completedDates.some(
                  (completedDate) =>
                    new Date(completedDate).toDateString() ===
                    date.toDateString()
                )
                  ? 100
                  : 0;
              }),
              backgroundColor: '#22c55e',
              borderColor: '#16a34a',
              borderWidth: 1,
            },
          ],
        };
      }
    }

    habitsChart = new Chart(ctx, {
      type: 'bar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Completion Rate (%)',
            },
          },
        },
        plugins: {
          title: {
            display: true,
            text:
              selectedHabitId === 'all'
                ? 'Overall Habit Completion Rates'
                : 'Last 7 Days Progress',
          },
        },
      },
    });
  }

  // Add event listener for habit selection
  habitSelect.addEventListener('change', async (e) => {
    const habitId = e.target.value;
    try {
      const response = await fetch('/api/getHabits');
      if (!response.ok) throw new Error('Failed to fetch habits');
      const data = await response.json();
      renderHabitsGraph(data.habits || [], habitId);
    } catch (err) {
      console.error(err);
    }
  });

  addHabitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('habit-name');
    const descInput = document.getElementById('habit-description');
    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    if (!name) return;
    try {
      const response = await fetch('/api/addHabit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (!response.ok) throw new Error('Failed to add habit');
      nameInput.value = '';
      descInput.value = '';
      fetchHabits();
    } catch (err) {
      alert('Error adding habit.');
      console.error(err);
    }
  });

  habitListContainer.addEventListener('click', async (e) => {
    const target = e.target;
    if (target.classList.contains('complete-btn')) {
      const habitId = target.getAttribute('data-id');
      if (!habitId) return;
      try {
        const response = await fetch(`/api/completeHabit/${habitId}`, {
          method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to mark habit as complete');
        fetchHabits();
      } catch (err) {
        alert('Error marking habit as complete.');
        console.error(err);
      }
    } else if (target.classList.contains('delete-btn')) {
      const habitId = target.getAttribute('data-id');
      if (!habitId) return;
      try {
        const response = await fetch(`/api/deleteHabit/${habitId}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete habit');
        fetchHabits();
      } catch (err) {
        alert('Error deleting habit.');
        console.error(err);
      }
    }
  });

  // Add near the top of the DOMContentLoaded event listener
  habitListContainer.addEventListener('change', async (e) => {
    const target = e.target;
    if (target.classList.contains('calendar-checkbox')) {
      const habitId = target.getAttribute('data-id');
      const dateStr = target.getAttribute('data-date');

      if (!habitId || !dateStr) return;

      try {
        const response = await fetch(`/api/completeHabit/${habitId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateStr }),
        });

        if (!response.ok) throw new Error('Failed to update habit completion');

        // Update both calendar and stats
        fetchHabits();
      } catch (err) {
        // Revert checkbox state if there's an error
        target.checked = !target.checked;
        alert('Error updating habit completion.');
        console.error(err);
      }
    }
  });

  // Modal handling
  settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'block';
    fetchHabitsForSettings();
  });

  closeModalBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });

  async function fetchHabitsForSettings() {
    try {
      const response = await fetch('/api/getHabits');
      if (!response.ok) throw new Error('Failed to fetch habits');
      const data = await response.json();
      renderHabitsSettings(data.habits || []);
    } catch (err) {
      console.error(err);
      habitsSettingsList.innerHTML = 'Error loading habits.';
    }
  }

  function calculateHabitStats(habit) {
    const startDate = new Date(habit.startDate);
    const today = new Date();
    const daysTracking = Math.floor(
      (today - startDate) / (1000 * 60 * 60 * 24)
    );
    const completedCount = habit.completedDates
      ? habit.completedDates.length
      : 0;
    const completionRate =
      daysTracking > 0 ? ((completedCount / daysTracking) * 100).toFixed(1) : 0;

    return {
      daysTracking,
      completedCount,
      completionRate,
    };
  }

  function renderHabitsSettings(habits) {
    habitsSettingsList.innerHTML = '';
    habits.forEach((habit) => {
      const habitDiv = document.createElement('div');
      habitDiv.className = 'habit-settings-item';

      const stats = calculateHabitStats(habit);

      habitDiv.innerHTML = `
        <div class="habit-settings-header">
          <div class="habit-settings-name">${habit.name}</div>
          <div class="settings-actions">
            <button class="edit-btn" data-id="${habit._id}">Edit</button>
            <button class="delete-btn" data-id="${habit._id}">Delete</button>
          </div>
        </div>
        <div class="habit-settings-desc">${
          habit.description || 'No description'
        }</div>
        <div class="habit-tracking-stats">
          <div class="stats-item">
            <span class="stats-label">Started:</span>
            <span class="stats-value">${new Date(
              habit.startDate
            ).toLocaleDateString()} (${stats.daysTracking} days ago)</span>
          </div>
          <div class="stats-item">
            <span class="stats-label">Times Completed:</span>
            <span class="stats-value">${stats.completedCount} days</span>
          </div>
          <div class="stats-item">
            <span class="stats-label">Completion Rate:</span>
            <span class="stats-value">${stats.completionRate}%</span>
          </div>
        </div>
      `;

      habitsSettingsList.appendChild(habitDiv);
    });
  }

  // Event delegation for settings actions
  habitsSettingsList.addEventListener('click', async (e) => {
    const target = e.target;
    const habitId = target.getAttribute('data-id');

    if (target.classList.contains('edit-btn')) {
      const habitItem = target.closest('.habit-settings-item');
      const nameElem = habitItem.querySelector('.habit-settings-name');
      const descElem = habitItem.querySelector('.habit-settings-desc');
      const currentName = nameElem.textContent;
      const currentDesc =
        descElem.textContent === 'No description' ? '' : descElem.textContent;

      // Create edit form
      const editForm = document.createElement('div');
      editForm.className = 'edit-habit-form';
      editForm.innerHTML = `
        <div class="edit-inputs">
          <input type="text" class="edit-name" value="${currentName}" placeholder="Habit name">
          <textarea class="edit-description" placeholder="Description">${currentDesc}</textarea>
        </div>
        <div class="edit-actions">
          <button class="save-edit">Save</button>
          <button class="cancel-edit">Cancel</button>
        </div>
      `;

      const originalContent = habitItem.innerHTML;
      habitItem.innerHTML = '';
      habitItem.appendChild(editForm);

      const saveEdit = editForm.querySelector('.save-edit');
      const cancelEdit = editForm.querySelector('.cancel-edit');
      const nameInput = editForm.querySelector('.edit-name');
      const descInput = editForm.querySelector('.edit-description');

      cancelEdit.addEventListener('click', () => {
        habitItem.innerHTML = originalContent;
      });

      saveEdit.addEventListener('click', async () => {
        const newName = nameInput.value.trim();
        const newDesc = descInput.value.trim();

        if (!newName) return;

        try {
          const response = await fetch(`/api/editHabit/${habitId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: newName,
              description: newDesc,
            }),
          });
          if (!response.ok) throw new Error('Failed to edit habit');
          fetchHabitsForSettings();
          fetchHabits(); // Update main view
        } catch (err) {
          alert('Error editing habit.');
          console.error(err);
        }
      });
    }

    if (target.classList.contains('delete-btn')) {
      if (confirm('Are you sure you want to delete this habit?')) {
        try {
          const response = await fetch(`/api/deleteHabit/${habitId}`, {
            method: 'DELETE',
          });
          if (!response.ok) throw new Error('Failed to delete habit');
          fetchHabitsForSettings();
          fetchHabits(); // Update main view
        } catch (err) {
          alert('Error deleting habit.');
          console.error(err);
        }
      }
    }
  });

  // Hide the add habit form by default, show with a button
  addHabitForm.style.display = 'none';
  const showAddBtn = document.createElement('button');
  showAddBtn.textContent = 'Add New Habit';
  showAddBtn.className = 'show-add-btn';
  showAddBtn.onclick = () => {
    addHabitForm.style.display =
      addHabitForm.style.display === 'none' ? 'block' : 'none';
  };
  document.getElementById('app').insertBefore(showAddBtn, addHabitForm);

  fetchHabits();
});

function calculateMonthStats(habit, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const completedDaysInMonth = habit.completedDates
    ? habit.completedDates.filter((dateStr) => {
        const date = new Date(dateStr);
        return date.getFullYear() === year && date.getMonth() === month;
      }).length
    : 0;

  const percentage = ((completedDaysInMonth / daysInMonth) * 100).toFixed(1);
  return {
    completed: completedDaysInMonth,
    total: daysInMonth,
    percentage,
  };
}
