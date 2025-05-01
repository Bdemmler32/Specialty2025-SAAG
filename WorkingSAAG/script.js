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
  
  // Render the schedule grid
  function renderSchedule() {
    scheduleGrid.innerHTML = '';
    
    if (filteredEvents.length === 0) {
      noEventsMessage.style.display = 'block';
      return;
    } else {
      noEventsMessage.style.display = 'none';
    }
    
    // Group events by day
    const eventsByDay = {};
    
    // Get all unique days from filtered events
    const uniqueDays = [...new Set(filteredEvents.map(event => event.Date))].sort((a, b) => {
      const dateA = new Date(a.split(',')[1] + ',' + a.split(',')[0]);
      const dateB = new Date(b.split(',')[1] + ',' + b.split(',')[0]);
      return dateA - dateB;
    });
    
    // Create groups of events by day
    uniqueDays.forEach(day => {
      eventsByDay[day] = filteredEvents.filter(event => event.Date === day);
    });
    
    // Create sections for days with events
    uniqueDays.forEach(day => {
      const dayEvents = eventsByDay[day];
      
      if (dayEvents.length === 0) return;
      
      // Create day section
      const section = document.createElement('div');
      section.className = 'day-section';
      
      // Create header
      const header = document.createElement('div');
      header.className = 'day-header';
      header.textContent = day;
      section.appendChild(header);
      
      // Create content container
      const content = document.createElement('div');
      content.className = 'day-content';
      
      // Sort events by time
      dayEvents.sort((a, b) => {
        return timeToMinutes(a["Time Start"]) - timeToMinutes(b["Time Start"]);
      });
      
      // Add events
      dayEvents.forEach(event => {
        const eventEl = createEventElement(event);
        content.appendChild(eventEl);
      });
      
      section.appendChild(content);
      scheduleGrid.appendChild(section);
    });
  }
  
  // Create an event element
  function createEventElement(event) {
    const timeCategory = getTimeCategory(event["Time Start"]);
    const isTicketed = event["Event Type"] === "Ticketed";
    const isNetworking = event["Event Type"] === "Networking";
    const isSetup = event["Event Type"] === "Setup";
    
    const element = document.createElement('div');
    element.className = `event ${timeCategory}`;
    if (isTicketed) {
      element.classList.add('ticketed');
    }
    if (isNetworking || isSetup) {
      element.classList.add('italic-title');
    }
    
    // Event title - this will always be shown
    const title = document.createElement('div');
    title.className = 'event-title';
    title.innerHTML = `<span>${event.Event}</span>`;
    
    // Time display - this will always be shown
    const time = document.createElement('div');
    time.className = 'event-time';
    time.textContent = `${event["Time Start"]} - ${event["Time End"]}`;
    
    element.appendChild(title);
    element.appendChild(time);
    
    // Create event details container - initially hidden, shown when expanded
    const details = document.createElement('div');
    details.className = 'event-details';
    
    // Build HTML for details
    let detailsHTML = `
      <div><strong>Event Details:</strong> ${event["Event Details"] || 'No details available'}</div>
      <div><strong>Location:</strong> ${event.Location || 'TBD'}</div>
      <div><strong>Event Type:</strong> ${event["Event Type"]}</div>
    `;
    
    // Add Keywords section if available
    if (event.Keywords) {
      detailsHTML += `<div><strong>Topics:</strong> <div class="keywords-container">`;
      
      // Split keywords by comma and create tag for each
      const keywords = event.Keywords.split(',');
      keywords.forEach(keyword => {
        const trimmedKeyword = keyword.trim();
        if (trimmedKeyword) {
          detailsHTML += `<span class="keyword-tag">${trimmedKeyword}</span>`;
        }
      });
      
      detailsHTML += `</div></div>`;
    }
    
    details.innerHTML = detailsHTML;
    element.appendChild(details);
    
    // Add ticketed badge if applicable
    if (isTicketed) {
      const badge = document.createElement('div');
      badge.className = 'ticketed-badge';
      
      const badgeText = document.createElement('div');
      badgeText.className = 'ticketed-text';
      badgeText.textContent = 'TICKETED';
      
      badge.appendChild(badgeText);
      element.appendChild(badge);
    }
    
    // Add click event to expand/collapse for all events
    element.addEventListener('click', function() {
      this.classList.toggle('expanded');
    });
    
    return element;
  }
  
  // Expand/Collapse toggle affects all events
  expandCollapseToggle.addEventListener('change', function() {
    const allEvents = document.querySelectorAll('.event');
    
    if (this.checked) {
      // Expand all events
      allEvents.forEach(event => {
        event.classList.add('expanded');
      });
    } else {
      // Collapse all events
      allEvents.forEach(event => {
        event.classList.remove('expanded');
      });
    }
  });
  
  // PDF Export functionality
  exportPdfBtn.addEventListener('click', function() {
    try {
      // Create a clone of the schedule to modify for PDF export
      const originalContainer = document.getElementById('schedule-container');
      const pdfContainer = originalContainer.cloneNode(true);
      
      // Set the container to a fixed width for PDF export
      pdfContainer.style.width = '1100px';
      pdfContainer.style.maxWidth = 'none';
      pdfContainer.style.margin = '0';
      pdfContainer.style.padding = '10px';
      pdfContainer.style.backgroundColor = 'white';
      
      // Remove filters container (keep only the header)
      const filtersContainer = pdfContainer.querySelector('.filters-container');
      if (filtersContainer) {
        filtersContainer.innerHTML = '';
        filtersContainer.style.display = 'none';
      }
      
      // Get all unique days from the events
      const uniqueDays = [...new Set(events.map(event => event.Date))];
      
      // Sort uniqueDays chronologically
      uniqueDays.sort((a, b) => {
        const dateA = new Date(a.split(',')[1] + ',' + a.split(',')[0]);
        const dateB = new Date(b.split(',')[1] + ',' + b.split(',')[0]);
        return dateA - dateB;
      });
      
      // Determine number of columns based on number of days
      const numDays = uniqueDays.length;
      
      // Clear current schedule grid and set to align at top
      const scheduleGridPdf = pdfContainer.querySelector('#scheduleGrid');
      if (scheduleGridPdf) {
        scheduleGridPdf.innerHTML = '';
        scheduleGridPdf.style.display = 'grid';
        scheduleGridPdf.style.gridTemplateColumns = `repeat(${numDays}, 1fr)`;
        scheduleGridPdf.style.gap = '5px';
        scheduleGridPdf.style.marginTop = '10px';
        scheduleGridPdf.style.alignItems = 'start'; // Align items to top
      }
      
      // Replace the header image with the PDF-specific one
      // Create a new header image for the PDF
      const headerImageContainer = pdfContainer.querySelector('.header-image');
      if (headerImageContainer) {
        // Create a new image element to avoid any caching issues
        const newHeaderImg = document.createElement('img');
        newHeaderImg.src = 'SpecialtyWebheader-ExportPDF.jpg';
        newHeaderImg.alt = 'Specialty Congress 2025 Header';
        newHeaderImg.style.width = '100%';
        newHeaderImg.style.height = 'auto';
        
        // Replace the old image with the new one
        headerImageContainer.innerHTML = '';
        headerImageContainer.appendChild(newHeaderImg);
      }
      
      // Check if the events are currently expanded or collapsed
      const areEventsExpanded = expandCollapseToggle.checked;
      
      // Group events by day
      const eventsByDay = {};
      uniqueDays.forEach(day => {
        eventsByDay[day] = events.filter(event => event.Date === day);
      });
      
      // Create a column for each day
      uniqueDays.forEach(day => {
        const dayEvents = eventsByDay[day];
        
        // Create day column
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';
        dayColumn.style.width = '100%';
        dayColumn.style.overflow = 'hidden';
        dayColumn.style.display = 'flex';
        dayColumn.style.flexDirection = 'column';
        dayColumn.style.alignItems = 'stretch'; // Make columns stretch
        
        // Create day header
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        
        // Split the date parts
        const dateParts = day.split(',');
        const dayName = dateParts[0].trim(); // Day name like "Saturday"
        const dateDetail = dateParts[1].trim(); // Date like "November 15"
        
        // Create header content with day and date on same line with comma
        dayHeader.innerHTML = `${dayName}, ${dateDetail}`;
        
        dayHeader.style.backgroundColor = '#333';
        dayHeader.style.color = 'white';
        dayHeader.style.padding = '8px 4px';
        dayHeader.style.textAlign = 'center';
        dayHeader.style.borderRadius = '5px 5px 0 0';
        dayHeader.style.fontWeight = 'bold';
        dayHeader.style.fontSize = '11px';
        dayHeader.style.height = '32px';
        dayHeader.style.display = 'flex';
        dayHeader.style.alignItems = 'center';
        dayHeader.style.justifyContent = 'center';
        
        dayColumn.appendChild(dayHeader);
        
        // Create events container
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'day-events';
        eventsContainer.style.backgroundColor = 'white';
        eventsContainer.style.padding = '4px';
        eventsContainer.style.borderRadius = '0 0 5px 5px';
        eventsContainer.style.flexGrow = '1';
        eventsContainer.style.display = 'flex';
        eventsContainer.style.flexDirection = 'column';
        eventsContainer.style.gap = '3px';
        
        // Sort events by time
        dayEvents.sort((a, b) => {
          return timeToMinutes(a["Time Start"]) - timeToMinutes(b["Time Start"]);
        });
        
        // Add events to container
        dayEvents.forEach(event => {
          const timeCategory = getTimeCategory(event["Time Start"]);
          const isTicketed = event["Event Type"] === "Ticketed";
          const isNetworking = event["Event Type"] === "Networking";
          const isSetup = event["Event Type"] === "Setup";
          
          const eventEl = document.createElement('div');
          eventEl.className = `event-pdf ${timeCategory}`;
          if (areEventsExpanded) {
            eventEl.classList.add('expanded'); // Apply expanded state if toggled on
          }
          
          eventEl.style.padding = '4px';
          eventEl.style.borderRadius = '3px';
          eventEl.style.fontSize = '8px';
          eventEl.style.position = 'relative';
          eventEl.style.marginBottom = '2px';
          eventEl.style.lineHeight = '1.2';
          
          // Set background color based on time category
          if (timeCategory === 'morning') {
            eventEl.style.backgroundColor = '#e6f4ff';
            eventEl.style.border = '1px solid #b3d7ff';
          } else if (timeCategory === 'afternoon') {
            eventEl.style.backgroundColor = '#ffede6';
            eventEl.style.border = '1px solid #ffcbb3';
          } else {
            eventEl.style.backgroundColor = '#f0e6ff';
            eventEl.style.border = '1px solid #d6b3ff';
          }
          
          // Add ticketed indicator if needed
          if (isTicketed) {
            // Create a dedicated indicator div instead of using border
            const indicator = document.createElement('div');
            indicator.style.position = 'absolute';
            indicator.style.right = '0';
            indicator.style.top = '0';
            indicator.style.bottom = '0';
            indicator.style.width = '6px';
            indicator.style.backgroundColor = '#4a7aff';
            indicator.style.borderTopRightRadius = '3px';
            indicator.style.borderBottomRightRadius = '3px';
            
            // Ensure the event has proper positioning
            eventEl.style.position = 'relative';
            eventEl.style.paddingRight = '8px';
            
            // Add the indicator to the event
            eventEl.appendChild(indicator);
          }
          
          // Event title
          const titleEl = document.createElement('div');
          titleEl.style.fontWeight = 'bold';
          titleEl.style.marginBottom = '2px';
          
          // Apply italic style for Networking and Setup events
          if (isNetworking || isSetup) {
            titleEl.style.fontStyle = 'italic';
          }
          
          titleEl.textContent = event.Event;
          
          // Event time
          const timeEl = document.createElement('div');
          timeEl.style.fontSize = '8px';
          timeEl.style.color = '#444';
          timeEl.textContent = `${event["Time Start"]} - ${event["Time End"]}`;
          
          eventEl.appendChild(titleEl);
          eventEl.appendChild(timeEl);
          
          // If expanded, add details
          if (areEventsExpanded) {
            const detailsEl = document.createElement('div');
            detailsEl.style.marginTop = '4px';
            detailsEl.style.borderTop = '1px solid rgba(0,0,0,0.1)';
            detailsEl.style.paddingTop = '4px';
            detailsEl.style.fontSize = '7px';
            
            // Build details HTML
            let detailsHTML = `
              <div><strong>Event Details:</strong> ${event["Event Details"] || 'No details available'}</div>
              <div><strong>Location:</strong> ${event.Location || 'TBD'}</div>
              <div><strong>Event Type:</strong> ${event["Event Type"]}</div>
            `;
            
            // Add Keywords if available
            if (event.Keywords) {
              detailsHTML += `<div><strong>Topics:</strong> ${event.Keywords}</div>`;
            }
            
            detailsEl.innerHTML = detailsHTML;
            eventEl.appendChild(detailsEl);
          }
          
          eventsContainer.appendChild(eventEl);
        });
        
        dayColumn.appendChild(eventsContainer);
        if (scheduleGridPdf) {
          scheduleGridPdf.appendChild(dayColumn);
        }
      });
      
      // Add explanatory legend at the bottom if there's space
      const legendRow = document.createElement('div');
      legendRow.style.display = 'flex';
      legendRow.style.justifyContent = 'center';
      legendRow.style.gap = '15px';
      legendRow.style.marginTop = '8px';
      legendRow.style.fontSize = '8px';
      
      // Morning legend
      const morningLegend = document.createElement('div');
      morningLegend.style.display = 'flex';
      morningLegend.style.alignItems = 'center';
      const morningColor = document.createElement('span');
      morningColor.style.width = '10px';
      morningColor.style.height = '10px';
      morningColor.style.backgroundColor = '#e6f4ff';
      morningColor.style.border = '1px solid #b3d7ff';
      morningColor.style.display = 'inline-block';
      morningColor.style.marginRight = '3px';
      morningLegend.appendChild(morningColor);
      morningLegend.appendChild(document.createTextNode('Morning'));
      
      // Afternoon legend
      const afternoonLegend = document.createElement('div');
      afternoonLegend.style.display = 'flex';
      afternoonLegend.style.alignItems = 'center';
      const afternoonColor = document.createElement('span');
      afternoonColor.style.width = '10px';
      afternoonColor.style.height = '10px';
      afternoonColor.style.backgroundColor = '#ffede6';
      afternoonColor.style.border = '1px solid #ffcbb3';
      afternoonColor.style.display = 'inline-block';
      afternoonColor.style.marginRight = '3px';
      afternoonLegend.appendChild(afternoonColor);
      afternoonLegend.appendChild(document.createTextNode('Afternoon'));
      
      // Evening legend
      const eveningLegend = document.createElement('div');
      eveningLegend.style.display = 'flex';
      eveningLegend.style.alignItems = 'center';
      const eveningColor = document.createElement('span');
      eveningColor.style.width = '10px';
      eveningColor.style.height = '10px';
      eveningColor.style.backgroundColor = '#f0e6ff';
      eveningColor.style.border = '1px solid #d6b3ff';
      eveningColor.style.display = 'inline-block';
      eveningColor.style.marginRight = '3px';
      eveningLegend.appendChild(eveningColor);
      eveningLegend.appendChild(document.createTextNode('Evening'));
      
      // Ticketed legend
      const ticketedLegend = document.createElement('div');
      ticketedLegend.style.display = 'flex';
      ticketedLegend.style.alignItems = 'center';
      const ticketedColor = document.createElement('span');
      ticketedColor.style.width = '10px';
      ticketedColor.style.height = '10px';
      ticketedColor.style.border = '1px solid #ccc';
      ticketedColor.style.borderRightWidth = '6px';
      ticketedColor.style.borderRightColor = '#4a7aff';
      ticketedColor.style.display = 'inline-block';
      ticketedColor.style.marginRight = '3px';
      ticketedLegend.appendChild(ticketedColor);
      ticketedLegend.appendChild(document.createTextNode('Ticketed Event'));
      
      // Add legends to row
      legendRow.appendChild(morningLegend);
      legendRow.appendChild(afternoonLegend);
      legendRow.appendChild(eveningLegend);
      legendRow.appendChild(ticketedLegend);
      
      // Add legend row to container
      pdfContainer.appendChild(legendRow);
      
      // Temporarily add the cloned container to the document for rendering
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.left = '-9999px';
      document.body.appendChild(pdfContainer);
      
      // Use html2canvas to capture the container
      html2canvas(pdfContainer, {
        scale: 2.5, // Higher scale for better text clarity
        useCORS: true,
        logging: false,
        width: 1100,
        imageTimeout: 0,
        backgroundColor: '#ffffff',
        letterRendering: true, // Improve text rendering
        allowTaint: true,
        useCORS: true
      }).then(function(canvas) {
        try {
          // Remove the temporary container
          document.body.removeChild(pdfContainer);
          
          // Create PDF in landscape orientation (11x8.5 inches)
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'in',
            format: 'letter',
            compress: true // Enable compression to reduce file size
          });
          
          // Calculate the scaling ratio to fit the canvas to the PDF
          const imgWidth = 11 - 0.4; // Landscape letter width minus margins
          const imgHeight = 8.5 - 0.4; // Landscape letter height minus margins
          const canvasRatio = canvas.height / canvas.width;
          
          let finalWidth = imgWidth;
          let finalHeight = imgWidth * canvasRatio;
          
          // Adjust if the image is too tall
          if (finalHeight > imgHeight) {
            finalHeight = imgHeight;
            finalWidth = imgHeight / canvasRatio;
          }
          
          // Position at the top of the page instead of centering vertically
          const offsetX = (11 - finalWidth) / 2; // Center horizontally
          const offsetY = 0.2; // Position at the top with a small margin
          
          // Add the image to the PDF with quality settings
          const imgData = canvas.toDataURL('image/png', 1.0); // Use PNG for best text clarity
          pdf.addImage(imgData, 'PNG', offsetX, offsetY, finalWidth, finalHeight, undefined, 'FAST');
          
          // Save the PDF - which also triggers the download dialog
          pdf.save('schedule-at-a-glance.pdf');
          
        } catch (innerError) {
          console.error("Error in PDF generation:", innerError);
          alert("Error creating PDF: " + innerError.message);
          if (document.body.contains(pdfContainer)) {
            document.body.removeChild(pdfContainer);
          }
        }
      }).catch(function(canvasError) {
        console.error("Error in html2canvas:", canvasError);
        alert("Error capturing page: " + canvasError.message);
        if (document.body.contains(pdfContainer)) {
          document.body.removeChild(pdfContainer);
        }
      });
    } catch (outerError) {
      console.error("Error in PDF export:", outerError);
      alert("Error starting PDF export: " + outerError.message);
    }
  });
  
  // Get time category based on hour with new ranges
  function getTimeCategory(timeStart) {
    if (!timeStart) return 'morning';
    
    // Handle string time format (e.g., "8:00 AM")
    let hour = 0;
    let isPM = false;
    
    if (typeof timeStart === 'string') {
      const timeParts = timeStart.split(' ');
      const hourMin = timeParts[0].split(':');
      hour = parseInt(hourMin[0]);
      isPM = timeParts[1] === 'PM';
    }
    
    let hour24 = hour;
    if (isPM && hour !== 12) hour24 = hour + 12;
    if (!isPM && hour === 12) hour24 = 0;
    
    // Morning: 4:00 AM to 11:59 AM (4-11)
    // Afternoon: 12:00 PM to 4:59 PM (12-16)
    // Evening: 5:00 PM to 3:59 AM (17-23, 0-3)
    
    if ((hour24 >= 4 && hour24 < 12)) return 'morning';
    if (hour24 >= 12 && hour24 < 17) return 'afternoon';
    return 'evening'; // 17-23, 0-3
  }
  
  // Convert time to minutes for sorting
  function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    
    const timeParts = timeStr.split(' ');
    const hourMin = timeParts[0].split(':');
    const hour = parseInt(hourMin[0]);
    const minutes = parseInt(hourMin[1]);
    const isPM = timeParts[1] === 'PM';
    
    let hour24 = hour;
    if (isPM && hour !== 12) hour24 = hour + 12;
    if (!isPM && hour === 12) hour24 = 0;
    
    return hour24 * 60 + minutes;
  }
});