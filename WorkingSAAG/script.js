document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const dayButtonsContainer = document.getElementById('dayButtons');
  const scheduleGrid = document.getElementById('scheduleGrid');
  const noEventsMessage = document.getElementById('noEvents');
  const dateInfo = document.getElementById('date-info');
  const loadingIndicator = document.getElementById('loading');
  const errorMessage = document.getElementById('errorMessage');
  const expandCollapseToggle = document.getElementById('expandCollapseToggle');
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  
  // Search-related DOM elements
  const searchIcon = document.getElementById('searchIcon');
  const searchContainer = document.getElementById('searchContainer');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const searchResultsInfo = document.getElementById('searchResultsInfo');
  
  // State variables
  let events = [];
  let filteredEvents = [];
  let selectedDay = null;
  let lastUpdated = '';
  let isSearchActive = false;
  let prevFilterState = null;
  
  // Initialize
  fetchScheduleData();
  
  // Fetch schedule data from Excel file
  async function fetchScheduleData() {
    // Show loading indicator
    loadingIndicator.style.display = 'block';
    noEventsMessage.style.display = 'none';
    scheduleGrid.style.display = 'none';
    errorMessage.style.display = 'none';
    
    try {
      // Fetch the Excel file
      const response = await fetch('Specialty2025SAAG.xlsx');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const excelData = await response.arrayBuffer();
      
      // Parse the Excel file
      const workbook = XLSX.read(new Uint8Array(excelData), {
        cellDates: true
      });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Get the title and update date from first row
      const updateDateCell = worksheet['B1'];
      lastUpdated = updateDateCell ? updateDateCell.v.replace('Updated - ', '') : '';
      
      // Get the data starting from row 3 (header row)
      events = XLSX.utils.sheet_to_json(worksheet, {
        range: 2 // Start from row 3 (index 2)
      });
      
      // Format time fields
      events = events.map(event => ({
        ...event,
        "Time Start": formatExcelTime(event["Time Start"]),
        "Time End": formatExcelTime(event["Time End"])
      }));
      
      // Sort events chronologically by date and time
      events.sort((a, b) => {
        // First compare dates
        const dateA = new Date(a.Date.split(',')[1] + ',' + a.Date.split(',')[0]);
        const dateB = new Date(b.Date.split(',')[1] + ',' + b.Date.split(',')[0]);
        
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA - dateB;
        }
        
        // If same date, sort by time
        return timeToMinutes(a["Time Start"]) - timeToMinutes(b["Time Start"]);
      });
      
      filteredEvents = [...events];
      
      // Update date info
      dateInfo.textContent = `Current as of ${lastUpdated}`;
      
      // Hide loading indicator
      loadingIndicator.style.display = 'none';
      scheduleGrid.style.display = 'flex';
      
      // Initialize UI
      createDayButtons();
      renderSchedule();
      setupSearchFunctionality();
    } catch (error) {
      // Show error message
      loadingIndicator.style.display = 'none';
      errorMessage.style.display = 'block';
      console.error('Error fetching schedule data:', error);
    }
  }
  
  // Format Excel date/time to 12-hour format (1:00 PM)
  function formatExcelTime(excelTime) {
    if (!excelTime) return '';
    
    // Check if it's already a string (properly formatted)
    if (typeof excelTime === 'string' && !excelTime.includes('T')) {
      return excelTime;
    }
    
    let date;
    if (typeof excelTime === 'string' && excelTime.includes('T')) {
      // ISO string format
      date = new Date(excelTime);
    } else if (excelTime instanceof Date) {
      date = excelTime;
    } else {
      return excelTime; // Return as is if we can't handle it
    }
    
    // Format to 12-hour time
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    
    return `${hours}:${minutesStr} ${ampm}`;
  }
  
  // Create day filter buttons
  function createDayButtons() {
    // Clear container
    dayButtonsContainer.innerHTML = '';
    
    // All days button
    const allDaysBtn = document.createElement('button');
    allDaysBtn.className = 'day-button active';
    allDaysBtn.textContent = 'All Days';
    allDaysBtn.addEventListener('click', function() {
      setActiveDay(null, this);
    });
    dayButtonsContainer.appendChild(allDaysBtn);
    
    // Get all unique days from the events
    const uniqueDays = [...new Set(events.map(event => event.Date))];
    
    // Sort uniqueDays chronologically
    uniqueDays.sort((a, b) => {
      const dateA = new Date(a.split(',')[1] + ',' + a.split(',')[0]);
      const dateB = new Date(b.split(',')[1] + ',' + b.split(',')[0]);
      return dateA - dateB;
    });
    
    // Day-specific buttons
    uniqueDays.forEach(day => {
      const btn = document.createElement('button');
      btn.className = 'day-button';
      btn.textContent = day.split(',')[0]; // Just the day name
      btn.addEventListener('click', function() {
        setActiveDay(day, this);
      });
      dayButtonsContainer.appendChild(btn);
    });
  }
  
  // Set active day
  function setActiveDay(day, button) {
    selectedDay = day;
    
    // Update button styles
    const buttons = dayButtonsContainer.querySelectorAll('.day-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    if (isSearchActive) {
      // If search is active, apply both day and search filters
      performSearch(searchInput.value);
    } else {
      // Otherwise just apply day filter
      applyFilters();
    }
  }
  
  // Apply day filters
  function applyFilters() {
    let filtered = [...events];
    
    if (selectedDay) {
      filtered = filtered.filter(event => event.Date === selectedDay);
    }
    
    filteredEvents = filtered;
    renderSchedule();
  }
  
  // Set up search functionality
  function setupSearchFunctionality() {
    // Toggle search container visibility
    searchIcon.addEventListener('click', toggleSearch);
    
    // Close search when X button is clicked
    clearSearchBtn.addEventListener('click', clearSearch);
    
    // Perform search as user types
    searchInput.addEventListener('input', function() {
      performSearch(this.value);
    });
    
    // Focus input when search is opened
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        clearSearch();
      }
    });
  }
  
  // Toggle search container visibility
  function toggleSearch() {
    if (!isSearchActive) {
      // Opening search - save current state
      prevFilterState = {
        selectedDay: selectedDay,
        filteredEvents: [...filteredEvents]
      };
      
      // Show search container with animation
      searchContainer.style.display = 'block';
      searchInput.focus();
      isSearchActive = true;
    } else {
      clearSearch();
    }
  }
  
  // Clear search and close search container
  function clearSearch() {
    // Clear input
    searchInput.value = '';
    searchResultsInfo.textContent = '';
    
    // Hide search container
    searchContainer.style.display = 'none';
    isSearchActive = false;
    
    // Restore previous state
    if (prevFilterState) {
      selectedDay = prevFilterState.selectedDay;
      
      // Update day button selection
      const buttons = dayButtonsContainer.querySelectorAll('.day-button');
      buttons.forEach(btn => btn.classList.remove('active'));
      
      // Find the correct button to activate
      if (selectedDay === null) {
        // Activate "All Days" button
        buttons[0].classList.add('active');
      } else {
        // Find and activate the correct day button
        const dayButtonText = selectedDay.split(',')[0];
        for (let i = 1; i < buttons.length; i++) {
          if (buttons[i].textContent === dayButtonText) {
            buttons[i].classList.add('active');
            break;
          }
        }
      }
      
      // Apply the restored filter state
      applyFilters();
    }
  }
  
  // Perform search on events
  function performSearch(query) {
    if (!query.trim()) {
      // If search query is empty, just apply day filter
      if (isSearchActive) {
        searchResultsInfo.textContent = '';
        applyFilters();
      }
      return;
    }
    
    // Start with all events or day-filtered events
    let baseEvents = [...events];
    if (selectedDay) {
      baseEvents = baseEvents.filter(event => event.Date === selectedDay);
    }
    
    // Convert query to lowercase for case-insensitive search
    const searchTerms = query.toLowerCase().trim();
    
    // Filter events based on search terms
    const results = baseEvents.filter(event => {
      // Search in event title
      const titleMatch = event.Event && event.Event.toString().toLowerCase().includes(searchTerms);
      
      // Search in event details
      const detailsMatch = event["Event Details"] && 
        event["Event Details"].toString().toLowerCase().includes(searchTerms);
      
      // Search in location
      const locationMatch = event.Location && 
        event.Location.toString().toLowerCase().includes(searchTerms);
      
      // Search in event type
      const typeMatch = event["Event Type"] && 
        event["Event Type"].toString().toLowerCase().includes(searchTerms);
      
      // Search in keywords (if the column exists)
      let keywordsMatch = false;
      if (event.Keywords) {
        // Split keywords by comma and check each one
        const keywords = event.Keywords.toString().split(',').map(k => k.trim().toLowerCase());
        keywordsMatch = keywords.some(keyword => keyword.includes(searchTerms) || searchTerms.includes(keyword));
      }
      
      // Return true if any field matches
      return titleMatch || detailsMatch || locationMatch || typeMatch || keywordsMatch;
    });
    
    // Update results info
    if (isSearchActive) {
      searchResultsInfo.textContent = `Showing ${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`;
    }
    
    // Update filtered events and render
    filteredEvents = results;
    renderSchedule();
    
    // Show message if no results
    if (results.length === 0) {
      noEventsMessage.style.display = 'block';
    } else {
      noEventsMessage.style.display = 'none';
    }
  }