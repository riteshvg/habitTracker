# Functions Documentation

## Frontend Functions

### Calendar Management

#### `renderCalendar(year, month)`

- Renders the calendar grid for the specified year and month
- Highlights weekends and current date
- Marks completed habits

#### `calculateMonthStats(habit, year, month)`

- Calculates completion statistics for a specific habit in given month
- Logs detailed debug information about calculations
- Returns completion rate and streak information

### Habit Management

#### `addHabit(habitData)`

- Creates a new habit with provided data
- Validates input data
- Updates UI and database

#### `completeHabit(habitId, date)`

- Marks a habit as complete for specified date
- Prevents future date completion
- Updates statistics and UI

### UI Controls

#### `initializeMonthSelector()`

- Sets up month/year selection controls
- Handles navigation between months
- Updates calendar view

#### `setupHeaderControls()`

- Initializes header icons and buttons
- Manages settings and add habit modals
- Handles UI state

## Backend Functions

### Data Operations

#### `getHabits`

- Retrieves all habits from database
- Formats data for frontend use
- Includes completion data

#### `completeHabit`

- Updates habit completion status
- Supports bulk completion
- Validates date inputs

### Statistics

#### `calculateStats`

- Processes habit data for statistics
- Generates completion rates
- Calculates streaks

#### `generateReport`

- Creates detailed habit reports
- Aggregates monthly data
- Formats for frontend display

## Utility Functions

### Date Handling

#### `formatDate(date)`

- Converts dates to consistent format
- Handles timezone differences
- Returns ISO string format

#### `isWeekend(date)`

- Checks if given date is weekend
- Used for calendar highlighting
- Returns boolean

### Data Validation

#### `validateHabitData(data)`

- Validates habit input data
- Checks required fields
- Returns validation result

#### `sanitizeInput(input)`

- Cleans user input
- Prevents XSS attacks
- Returns sanitized data
