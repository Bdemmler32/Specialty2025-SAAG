// PDF Export functionality with improved space utilization
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
    
    // Replace the header image with the PDF-specific one
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
    
    // Get all events
    let allEvents = [...events];
    
    // Sort events chronologically by date and time
    allEvents.sort((a, b) => {
      // First compare dates
      const dateA = new Date(a.Date.split(',')[1] + ',' + a.Date.split(',')[0]);
      const dateB = new Date(b.Date.split(',')[1] + ',' + b.Date.split(',')[0]);
      
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB;
      }
      
      // If same date, sort by time
      return timeToMinutes(a["Time Start"]) - timeToMinutes(b["Time Start"]);
    });
    
    // Group events by day
    const eventsByDay = {};
    const uniqueDays = [...new Set(allEvents.map(event => event.Date))].sort((a, b) => {
      const dateA = new Date(a.split(',')[1] + ',' + a.split(',')[0]);
      const dateB = new Date(b.split(',')[1] + ',' + b.split(',')[0]);
      return dateA - dateB;
    });
    
    uniqueDays.forEach(day => {
      eventsByDay[day] = allEvents.filter(event => event.Date === day);
    });
    
    // Calculate approximate height needed for each event
    // This is an estimate - base size + extra if expanded
    function estimateEventHeight(event) {
      const baseHeight = 30; // Base height for a collapsed event
      let totalHeight = baseHeight;
      
      if (areEventsExpanded) {
        // Add extra height for expanded content
        totalHeight += 60; // Approximate height for expanded content
      }
      
      return totalHeight;
    }
    
    // Calculate total content height and determine number of columns
    let totalContentHeight = 0;
    
    // Add day headers
    totalContentHeight += uniqueDays.length * 40; // Day headers
    
    // Add events
    allEvents.forEach(event => {
      totalContentHeight += estimateEventHeight(event);
    });
    
    // Determine number of columns based on content height
    // Assuming a PDF height of about 600px for content (after header and margins)
    const pdfContentHeight = 600;
    let numColumns = Math.ceil(totalContentHeight / pdfContentHeight);
    
    // Ensure at least 2 columns and no more than 5
    numColumns = Math.max(2, Math.min(5, numColumns));
    
    // Calculate events per column for even distribution
    const eventsPerColumn = Math.ceil((uniqueDays.length + allEvents.length) / numColumns);
    
    // Clear current schedule grid and set to flex layout
    const scheduleGridPdf = pdfContainer.querySelector('#scheduleGrid');
    if (scheduleGridPdf) {
      scheduleGridPdf.innerHTML = '';
      scheduleGridPdf.style.display = 'grid';
      scheduleGridPdf.style.gridTemplateColumns = `repeat(${numColumns}, 1fr)`;
      scheduleGridPdf.style.gap = '10px';
      scheduleGridPdf.style.marginTop = '15px';
      scheduleGridPdf.style.alignItems = 'start'; // Align items to top
    }
    
    // Create columns for the continuous flow
    const columns = [];
    for (let i = 0; i < numColumns; i++) {
      const column = document.createElement('div');
      column.className = 'flow-column';
      column.style.display = 'flex';
      column.style.flexDirection = 'column';
      column.style.gap = '5px';
      column.style.width = '100%';
      
      columns.push(column);
      if (scheduleGridPdf) {
        scheduleGridPdf.appendChild(column);
      }
    }
    
    // Variables to track column distribution
    let currentDay = null;
    let currentColumnIndex = 0;
    let currentColumnHeight = 0;
    
    // Function to add a day header to a column
    function addDayHeader(day, columnIndex) {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'day-header';
      dayHeader.textContent = day;
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
      dayHeader.style.marginBottom = '5px';
      dayHeader.style.width = '100%';
      
      columns[columnIndex].appendChild(dayHeader);
      currentColumnHeight += 40; // Approximate height of day header
    }
    
    // Function to add an event to a column
    function addEventToColumn(event, columnIndex) {
      const timeCategory = getTimeCategory(event["Time Start"]);
      const isTicketed = event["Event Type"] === "Ticketed";
      const isNetworking = event["Event Type"] === "Networking";
      const isSetup = event["Event Type"] === "Setup";
      
      const eventEl = document.createElement('div');
      eventEl.className = `event-pdf ${timeCategory}`;
      if (areEventsExpanded) {
        eventEl.classList.add('expanded'); // Apply expanded state if toggled on
      }
      
      eventEl.style.padding = '6px';
      eventEl.style.borderRadius = '3px';
      eventEl.style.fontSize = '9px';
      eventEl.style.position = 'relative';
      eventEl.style.marginBottom = '4px';
      eventEl.style.lineHeight = '1.3';
      
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
        eventEl.style.paddingRight = '10px';
        
        // Add the indicator to the event
        eventEl.appendChild(indicator);
      }
      
      // Event title
      const titleEl = document.createElement('div');
      titleEl.style.fontWeight = 'bold';
      titleEl.style.marginBottom = '3px';
      
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
        detailsEl.style.marginTop = '6px';
        detailsEl.style.borderTop = '1px solid rgba(0,0,0,0.1)';
        detailsEl.style.paddingTop = '4px';
        detailsEl.style.fontSize = '7px';
        
        detailsEl.innerHTML = `
          <div><strong>Event Details:</strong> ${event["Event Details"] || 'No details available'}</div>
          <div><strong>Location:</strong> ${event.Location || 'TBD'}</div>
          <div><strong>Event Type:</strong> ${event["Event Type"]}</div>
        `;
        
        eventEl.appendChild(detailsEl);
      }
      
      columns[columnIndex].appendChild(eventEl);
      currentColumnHeight += estimateEventHeight(event);
    }
    
    // Distribute events across columns
    uniqueDays.forEach(day => {
      const dayEvents = eventsByDay[day];
      
      // If day would exceed column height, move to next column
      const dayTotalHeight = 40 + dayEvents.reduce((total, event) => total + estimateEventHeight(event), 0);
      
      // If adding this day would exceed the target height per column and we're not on the last column,
      // move to the next column
      if (currentColumnHeight > 0 && 
          currentColumnHeight + dayTotalHeight > (pdfContentHeight * 1.1) && 
          currentColumnIndex < numColumns - 1) {
        currentColumnIndex++;
        currentColumnHeight = 0;
      }
      
      // Add day header
      addDayHeader(day, currentColumnIndex);
      
      // Add events for this day
      dayEvents.forEach(event => {
        // If adding this event would exceed column height, consider moving to next column
        if (currentColumnHeight + estimateEventHeight(event) > pdfContentHeight && 
            currentColumnIndex < numColumns - 1) {
          currentColumnIndex++;
          currentColumnHeight = 0;
          
          // Add day header again in the new column if there are more events for this day
          addDayHeader(day, currentColumnIndex);
        }
        
        addEventToColumn(event, currentColumnIndex);
      });
    });
    
    // Add explanatory legend at the bottom
    const legendRow = document.createElement('div');
    legendRow.style.display = 'flex';
    legendRow.style.justifyContent = 'center';
    legendRow.style.gap = '15px';
    legendRow.style.marginTop = '15px';
    legendRow.style.fontSize = '9px';
    
    // Morning legend
    const morningLegend = document.createElement('div');
    morningLegend.style.display = 'flex';
    morningLegend.style.alignItems = 'center';
    const morningColor = document.createElement('span');
    morningColor.style.width = '12px';
    morningColor.style.height = '12px';
    morningColor.style.backgroundColor = '#e6f4ff';
    morningColor.style.border = '1px solid #b3d7ff';
    morningColor.style.display = 'inline-block';
    morningColor.style.marginRight = '4px';
    morningLegend.appendChild(morningColor);
    morningLegend.appendChild(document.createTextNode('Morning'));
    
    // Afternoon legend
    const afternoonLegend = document.createElement('div');
    afternoonLegend.style.display = 'flex';
    afternoonLegend.style.alignItems = 'center';
    const afternoonColor = document.createElement('span');
    afternoonColor.style.width = '12px';
    afternoonColor.style.height = '12px';
    afternoonColor.style.backgroundColor = '#ffede6';
    afternoonColor.style.border = '1px solid #ffcbb3';
    afternoonColor.style.display = 'inline-block';
    afternoonColor.style.marginRight = '4px';
    afternoonLegend.appendChild(afternoonColor);
    afternoonLegend.appendChild(document.createTextNode('Afternoon'));
    
    // Evening legend
    const eveningLegend = document.createElement('div');
    eveningLegend.style.display = 'flex';
    eveningLegend.style.alignItems = 'center';
    const eveningColor = document.createElement('span');
    eveningColor.style.width = '12px';
    eveningColor.style.height = '12px';
    eveningColor.style.backgroundColor = '#f0e6ff';
    eveningColor.style.border = '1px solid #d6b3ff';
    eveningColor.style.display = 'inline-block';
    eveningColor.style.marginRight = '4px';
    eveningLegend.appendChild(eveningColor);
    eveningLegend.appendChild(document.createTextNode('Evening'));
    
    // Ticketed legend
    const ticketedLegend = document.createElement('div');
    ticketedLegend.style.display = 'flex';
    ticketedLegend.style.alignItems = 'center';
    const ticketedColor = document.createElement('span');
    ticketedColor.style.width = '12px';
    ticketedColor.style.height = '12px';
    ticketedColor.style.border = '1px solid #ccc';
    ticketedColor.style.borderRightWidth = '6px';
    ticketedColor.style.borderRightColor = '#4a7aff';
    ticketedColor.style.display = 'inline-block';
    ticketedColor.style.marginRight = '4px';
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
})