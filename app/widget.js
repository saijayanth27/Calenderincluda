document.addEventListener("DOMContentLoaded", function () {

  // Helper function to add delay between API calls
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Global variable to store all bookings for client-side filtering
  // allBookingsCache removed to favor server-side filtering

  // Parse full datetime from Zoho format (e.g., "16-Jan-2026 14:30:00")
  function formatDateTimeForCalendar(dateTimeStr) {
    if (!dateTimeStr) return null;

    const months = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04",
      May: "05", Jun: "06", Jul: "07", Aug: "08",
      Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };

    // Split date and time parts
    const parts = dateTimeStr.trim().split(" ");
    if (parts.length < 2) return null;

    const datePart = parts[0];
    const timePart = parts[1];

    // Parse date (e.g., "16-Jan-2026")
    const dateParts = datePart.split("-");
    if (dateParts.length !== 3) return null;

    const [day, mon, year] = dateParts;
    const monthNum = months[mon];
    if (!monthNum) return null;

    // Parse time (e.g., "14:30:00")
    const timeParts = timePart.split(":");
    if (timeParts.length < 2) return null;

    const [hour, minute] = timeParts;

    // Return ISO 8601 format for FullCalendar
    return `${year}-${monthNum}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`;
  }

  // Global functions to show/hide loader
  function showLoader() {
    const loader = document.getElementById("loader");
    if (loader) loader.classList.add("active");
  }

  function hideLoader() {
    const loader = document.getElementById("loader");
    if (loader) loader.classList.remove("active");
  }

  // ---------- 1️⃣ Setup Calendar ----------
  const calendarEl = document.getElementById("calendar");

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    firstDay: 1,

    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay",
    },

    showNonCurrentDates: false,
    fixedWeekCount: false,

    // Format day headers in month view (full day names)
    dayHeaderFormat: { weekday: 'long' },

    // Prevent overcrowding in month view - show "+X more" link
    dayMaxEvents: 3,
    moreLinkClick: 'popover',

    // Format day headers in week/day view (custom formatting via CSS)
    views: {
      timeGridWeek: {
        dayHeaderFormat: { weekday: 'long', month: 'numeric', day: 'numeric' },
        firstDay: 1
      },
      timeGridDay: {
        dayHeaderFormat: { weekday: 'long', month: 'long', day: 'numeric' },
        firstDay: 1
      }
    },

    // Format time slots (e.g., "1 AM", "2 PM")
    slotLabelFormat: {
      hour: 'numeric',
      minute: '2-digit',
      omitZeroMinute: true,
      meridiem: 'short',
      hour12: true
    },

    // Hide all-day section in week/day views
    allDaySlot: false,

    // Custom day header content for Week/Day views
    dayHeaderContent: function (arg) {
      if (arg.view.type === 'timeGridWeek' || arg.view.type === 'timeGridDay') {
        const date = arg.date;
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const dateNum = date.getDate();

        return {
          html: `<div style="display: flex; flex-direction: column; align-items: flex-start; text-decoration: none;">
                   <div style="font-weight: bold; color: #000000;">${dateNum}</div>
                   <div style="font-weight: normal; color: #000000;">${dayName}</div>
                 </div>`
        };
      }
      return { html: arg.text };
    },

    // Let FullCalendar render dates normally - CSS will handle alignment
    // dayCellContent removed to allow CSS control
    // Don't display event time automatically (we'll handle it in eventContent)
    displayEventTime: false,

    // Custom event content to control time display
    eventContent: function (arg) {
      const viewType = arg.view.type;
      const event = arg.event;

      // Helper for formatting time (e.g., "2:30 PM")
      const formatTime = (date) => {
        if (!date) return "";
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
        return `${displayHours}:${displayMinutes} ${ampm}`;
      };

      // Format start time for week/day views
      let timeStr = '';
      if (viewType === 'timeGridWeek' || viewType === 'timeGridDay') {
        timeStr = formatTime(event.start);
      }

      // Format start and end times for month view
      let dateRangeStr = '';
      if (viewType === 'dayGridMonth') {
        const startTime = formatTime(event.start);
        const endTime = formatTime(event.end);

        if (startTime && endTime) {
          dateRangeStr = `<div class="fc-event-times" style="font-size: 9px; font-weight: 700; margin-bottom: 2px; opacity: 0.95;">
                            ${startTime} - ${endTime}
                          </div>`;
        } else if (startTime) {
          dateRangeStr = `<div class="fc-event-times" style="font-size: 9px; font-weight: 700; margin-bottom: 2px; opacity: 0.95;">
                            ${startTime}
                          </div>`;
        }
      }

      return {
        html: `<div class="fc-event-main-frame" style="padding: 2px 4px; height: 100%; white-space: normal; overflow: visible;">
                 ${dateRangeStr}
                 ${timeStr ? `<div class="fc-event-time" style="font-size: 10px; font-weight: 700; margin-bottom: 2px; opacity: 0.95;">${timeStr}</div>` : ''}
                 <div class="fc-event-title-container">
                   <div class="fc-event-title" style="font-size: 11px; line-height: 1.2; font-weight: 500;">${event.title || 'Untitled'}</div>
                 </div>
               </div>`
      };
    },

    dateClick: function (info) {
      // Get currently selected participant from dropdown
      const participantSearchInput = document.getElementById("participantSearch");
      const selectedParticipantName = participantSearchInput ? participantSearchInput.value.trim() : "";

      // Get participant ID from dropdown
      const participantDropdown = document.getElementById("participantFilter");
      const selectedParticipantID = participantDropdown ? participantDropdown.value : "";

      // Get currently selected support worker from dropdown
      const workerSearchInput = document.getElementById("workerSearch");
      const selectedWorkerName = workerSearchInput ? workerSearchInput.value.trim() : "";

      // Get worker value from dropdown
      const workerDropdown = document.getElementById("workerFilter");
      const selectedWorkerValue = workerDropdown ? workerDropdown.value : "";


      // Always open form with clicked date pre-filled
      // Also pre-fill participant and/or worker if selected
      openFormWithPrefilledData(selectedParticipantID, selectedWorkerValue, info.dateStr);
    },

    eventClick: function (info) {
      prefillForm(info.event);
    },

    events: [],
  });

  calendar.render();

  // ---------- 2️⃣ Load Support Workers ----------
  async function loadSupportWorkers() {
    showLoader();
    try {
      console.log("Starting to load support workers...");
      let allWorkers = [];
      const maxRecords = 200;
      let hasMoreRecords = true;
      let recordCursor = null;

      // Fetch all workers using pagination with record_cursor
      while (hasMoreRecords) {
        console.log(`Fetching workers batch... (cursor: ${recordCursor ? 'yes' : 'first'})`);

        // Add delay to avoid rate limiting (250ms between requests)
        if (recordCursor) {
          await sleep(250);
        }

        const params = {
          app_name: "calender-includa",
          report_name: "All_Support_Workers",
          max_records: maxRecords
        };

        // Add record_cursor if we have one (for subsequent pages)
        if (recordCursor) {
          params.record_cursor = recordCursor;
        }

        const response = await ZOHO.CREATOR.DATA.getRecords(params);

        console.log(`Response:`, response);

        const workerList = response.data || [];
        console.log(`Received ${workerList.length} workers`);

        // Log first worker ID to verify we're getting different records
        if (workerList.length > 0) {
          allWorkers = allWorkers.concat(workerList);
        }

        // Check if there's a record_cursor for the next page
        if (response.record_cursor && workerList.length === maxRecords) {
          recordCursor = response.record_cursor;
          console.log(`Has more records, cursor: ${recordCursor.substring(0, 20)}...`);
        } else {
          hasMoreRecords = false;
          console.log(`Finished loading workers - no more pages`);
        }
      }

      console.log(`Total support workers loaded: ${allWorkers.length}`);

      const workerDropdown = document.getElementById("workerFilter");
      if (!workerDropdown) return;

      workerDropdown.innerHTML = `<option value="">— All Workers —</option>`;

      allWorkers.forEach(w => {
        const name =
          w.Name?.first_name ||
          w.Name?.zc_display_value ||
          "Unknown";

        const opt = document.createElement("option");
        opt.value = w.ID;                // ✅ lookup ID
        opt.textContent = name;
        // Use name instead of ID for filtering
        opt.textContent = name;
        workerDropdown.appendChild(opt);
      });

      console.log("Support workers dropdown populated successfully");

    } catch (e) {
      console.error("Error loading workers:", e);
    }
  }

  // ---------- 2️⃣.5 Load Participants ----------
  async function loadParticipants() {
    showLoader();
    try {
      console.log("Starting to load participants...");
      let allParticipants = [];
      const maxRecords = 200;
      let hasMoreRecords = true;
      let recordCursor = null;

      // Fetch all participants using pagination with record_cursor
      while (hasMoreRecords) {
        console.log(`Fetching participants batch... (cursor: ${recordCursor ? 'yes' : 'first'})`);

        // Add delay to avoid rate limiting (250ms between requests)
        if (recordCursor) {
          await sleep(250);
        }

        const params = {
          app_name: "calender-includa",
          report_name: "All_Participants",
          max_records: maxRecords
        };

        // Add record_cursor if we have one (for subsequent pages)
        if (recordCursor) {
          params.record_cursor = recordCursor;
        }

        const response = await ZOHO.CREATOR.DATA.getRecords(params);

        console.log(`Response:`, response);

        const participantList = response.data || [];
        console.log(`Received ${participantList.length} participants`);

        // Log first participant ID to verify we're getting different records
        if (participantList.length > 0) {
          allParticipants = allParticipants.concat(participantList);
        }

        // Check if there's a record_cursor for the next page
        if (response.record_cursor && participantList.length === maxRecords) {
          recordCursor = response.record_cursor;
          console.log(`Has more records, cursor: ${recordCursor.substring(0, 20)}...`);
        } else {
          hasMoreRecords = false;
          console.log(`Finished loading participants - no more pages`);
        }
      }

      console.log(`Total participants loaded: ${allParticipants.length}`);

      const participantDropdown = document.getElementById("participantFilter");

      if (!participantDropdown) {
        console.error("Participant dropdown not found!");
        return;
      }

      // Reset to default option
      participantDropdown.innerHTML = `<option value="">— All Participants —</option>`;

      allParticipants.forEach(p => {
        const name =
          p.Participant_Name?.zc_display_value ||
          p.Participant_Name?.first_name ||
          p.Name?.first_name ||
          p.Name?.zc_display_value ||
          p.First_Name ||
          p.name ||
          "Unknown";

        const opt = document.createElement("option");
        opt.value = p.ID;
        opt.textContent = name;
        participantDropdown.appendChild(opt);
      });

      console.log("Participants dropdown populated successfully");

    } catch (e) {
      console.error("Error loading participants:", e);
    }
  }

  // ---------- 3️⃣ Load Bookings (Fetch from Server with Criteria) ----------
  async function loadBookings(filterParticipantID = "", filterWorkerID = "") {
    showLoader();
    try {
      console.log(`Loading bookings from server for Participant: ${filterParticipantID}, Worker: ${filterWorkerID}`);

      let allRecords = [];
      const maxRecords = 200;
      let hasMoreRecords = true;
      let recordCursor = null;

      // Build criteria string
      let criteria = "";

      // If validation in submit button set a "NONE" state, return empty immediately
      if (filterParticipantID === "NONE" || filterWorkerID === "NONE") {
        calendar.removeAllEvents();
        return;
      }

      if (filterParticipantID) {
        criteria = `Participant == ${filterParticipantID}`;
      }
      if (filterWorkerID) {
        if (criteria) criteria += " && ";
        criteria += `Support_worker2 == ${filterWorkerID}`;
      }

      // Fetch all pages of matching records
      while (hasMoreRecords) {
        if (recordCursor) {
          await sleep(250);
        }

        const params = {
          app_name: "calender-includa",
          report_name: "All_Bookings",
          max_records: maxRecords
        };

        if (criteria) {
          params.criteria = criteria;
        }

        if (recordCursor) {
          params.record_cursor = recordCursor;
        }

        const response = await ZOHO.CREATOR.DATA.getRecords(params);
        const bookingList = response.data || [];

        if (bookingList.length > 0) {
          allRecords = allRecords.concat(bookingList);
        }

        if (response.record_cursor && bookingList.length === maxRecords) {
          recordCursor = response.record_cursor;
        } else {
          hasMoreRecords = false;
        }
      }

      console.log(`Total records fetched from Zoho Creator: ${allRecords.length}`);

      // Map bookings to FullCalendar events


      // Map and add events
      const events = allRecords
        .map(rec => {

          // ✅ Participant (LOOKUP)
          const participantName =
            rec.Participant?.zc_display_value?.trim() || "No Participant";

          const participantID =
            rec.Participant?.ID || "";

          // ✅ Support Worker (LOOKUP) — MUST be declared BEFORE use
          let workerName = "No Worker";
          let workerID = "";

          if (rec.Support_worker2) {
            workerName =
              rec.Support_worker2.zc_display_value || "No Worker";

            workerID =
              rec.Support_worker2.ID || "";
          }

          // ✅ Dates
          const startDateTime = rec.Start_Date_and_Time
            ? formatDateTimeForCalendar(rec.Start_Date_and_Time)
            : null;

          const endDateTime = rec.End_Date_and_Time
            ? formatDateTimeForCalendar(rec.End_Date_and_Time)
            : null;

          // ✅ RETURN calendar event
          return {
            id: rec.ID,
            title: `${participantName} - ${workerName}`,
            start: startDateTime,
            end: endDateTime,
            backgroundColor: "#007bff",
            borderColor: "#007bff",
            extendedProps: {
              participantID,
              workerID, // ✅ lookup ID
              rawStart: rec.Start_Date_and_Time,
              rawEnd: rec.End_Date_and_Time,
              status: rec.Status || "",
              crmLink: rec.CRM_Link_URL?.url || "",
              Booking_Type: rec.Recurring1 || ""
            },
          };
        });

      calendar.removeAllEvents();
      calendar.addEventSource(events);
      console.log(`Calendar updated with ${events.length} events from server search.`);

    } catch (e) {
      console.error("Error loading bookings:", e);
      calendar.removeAllEvents();
    } finally {
      hideLoader();
    }
  }

  // ---------- 7️⃣ Initialize Dropdowns ----------
  setTimeout(async () => {
    await loadParticipants();
    await loadSupportWorkers();
    hideLoader(); // Hide loader after dropdowns are populated
  }, 200);

  // ---------- 8️⃣ Submit Filters Button ----------
  document.getElementById("submitFilters").addEventListener("click", function () {
    const participantDropdown = document.getElementById("participantFilter");
    const workerDropdown = document.getElementById("workerFilter");
    const participantSearchInput = document.getElementById("participantSearch");
    const workerSearchInput = document.getElementById("workerSearch");

    const pSearchText = participantSearchInput.value.trim();
    const wSearchText = workerSearchInput.value.trim();

    // Only search if at least one filter has been explicitly entered or selected
    if (pSearchText === "" && wSearchText === "") {
      alert("Please select at least one filter option (you can select 'All Participants' or 'All Workers' to see all bookings)");
      return;
    }

    let participantID = participantDropdown.value;
    let workerID = workerDropdown.value;

    // VALIDATION: If user typed something but it doesn't match the selected option's text, 
    // it means it's a non-existent name they've typed manually.
    const selectedParticipantText = participantDropdown.options[participantDropdown.selectedIndex]?.textContent || "";
    if (pSearchText !== "" && pSearchText !== selectedParticipantText) {
      participantID = "NONE"; // Ensure no matches found
      alert(`No participant found for: "${pSearchText}"`);
    }

    const selectedWorkerText = workerDropdown.options[workerDropdown.selectedIndex]?.textContent || "";
    if (wSearchText !== "" && wSearchText !== selectedWorkerText) {
      workerID = "NONE"; // Ensure no matches found
      alert(`No support worker found for: "${wSearchText}"`);
    }

    // Load bookings with selected filters
    loadBookings(participantID, workerID);
  });

  // ---------- 9️⃣ Clear Filters Button ----------
  document.getElementById("clearFilters").addEventListener("click", function () {
    // Reset dropdowns
    document.getElementById("participantFilter").value = "";
    document.getElementById("workerFilter").value = "";
    document.getElementById("participantSearch").value = "";
    document.getElementById("workerSearch").value = "";

    // Show all participant options
    const participantDropdown = document.getElementById("participantFilter");
    Array.from(participantDropdown.options).forEach(opt => {
      opt.style.display = "";
    });

    // Show all worker options
    const workerDropdown = document.getElementById("workerFilter");
    Array.from(workerDropdown.options).forEach(opt => {
      opt.style.display = "";
    });

    // Clear calendar
    calendar.removeAllEvents();
  });

  // ---------- 🔟 Searchable Dropdown Functionality ----------
  const participantSearchInput = document.getElementById("participantSearch");
  const participantDropdown = document.getElementById("participantFilter");
  const workerSearchInput = document.getElementById("workerSearch");
  const workerDropdown = document.getElementById("workerFilter");

  // Function to show dropdown
  function showDropdown(dropdown, searchInput) {
    dropdown.style.display = "block";
    searchInput.classList.add("dropdown-open");
  }

  // Function to hide dropdown
  function hideDropdown(dropdown, searchInput) {
    dropdown.style.display = "none";
    searchInput.classList.remove("dropdown-open");
  }

  // Participant search input - show dropdown on focus
  participantSearchInput.addEventListener("focus", function () {
    showDropdown(participantDropdown, participantSearchInput);
  });

  // Participant search - filter as you type
  participantSearchInput.addEventListener("input", function (e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    let firstVisibleOption = null;

    Array.from(participantDropdown.options).forEach(option => {
      const text = option.textContent.toLowerCase();

      // Always show the "All Participants" option
      if (option.value === "") {
        option.style.display = "";
        return;
      }

      // Filter based on search term
      if (searchTerm === "" || text.includes(searchTerm)) {
        option.style.display = "";
        if (!firstVisibleOption) {
          firstVisibleOption = option;
        }
      } else {
        option.style.display = "none";
      }
    });

    // Auto-select first match if searching
    if (searchTerm && firstVisibleOption) {
      firstVisibleOption.selected = true;
    } else if (!searchTerm) {
      participantDropdown.options[0].selected = true;
    }
  });

  // Worker search input - show dropdown on focus
  workerSearchInput.addEventListener("focus", function () {
    showDropdown(workerDropdown, workerSearchInput);
  });

  // Worker search - filter as you type
  workerSearchInput.addEventListener("input", function (e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    let firstVisibleOption = null;

    Array.from(workerDropdown.options).forEach(option => {
      const text = option.textContent.toLowerCase();

      // Always show the "All Workers" option
      if (option.value === "") {
        option.style.display = "";
        return;
      }

      // Filter based on search term
      if (searchTerm === "" || text.includes(searchTerm)) {
        option.style.display = "";
        if (!firstVisibleOption) {
          firstVisibleOption = option;
        }
      } else {
        option.style.display = "none";
      }
    });

    // Auto-select first match if searching
    if (searchTerm && firstVisibleOption) {
      firstVisibleOption.selected = true;
    } else if (!searchTerm) {
      workerDropdown.options[0].selected = true;
    }
  });

  // Click outside to close dropdowns
  document.addEventListener("click", function (e) {
    // Close participant dropdown if clicking outside
    if (!participantSearchInput.contains(e.target) && !participantDropdown.contains(e.target)) {
      hideDropdown(participantDropdown, participantSearchInput);
    }

    // Close worker dropdown if clicking outside
    if (!workerSearchInput.contains(e.target) && !workerDropdown.contains(e.target)) {
      hideDropdown(workerDropdown, workerSearchInput);
    }
  });

  // When selecting from dropdown, update search input and close dropdown
  participantDropdown.addEventListener("change", function () {
    const selectedOption = this.options[this.selectedIndex];
    // Show selected option text in search field (including "All Participants")
    participantSearchInput.value = selectedOption.textContent;
    hideDropdown(participantDropdown, participantSearchInput);
  });

  // Handle click events on dropdown options (for already-selected items)
  participantDropdown.addEventListener("click", function (e) {
    if (e.target.tagName === "OPTION") {
      const selectedOption = e.target;
      participantSearchInput.value = selectedOption.textContent;
      hideDropdown(participantDropdown, participantSearchInput);
    }
  });

  workerDropdown.addEventListener("change", function () {
    const selectedOption = this.options[this.selectedIndex];
    // Show selected option text in search field (including "All Workers")
    workerSearchInput.value = selectedOption.textContent;
    hideDropdown(workerDropdown, workerSearchInput);
  });

  // Handle click events on dropdown options (for already-selected items)
  workerDropdown.addEventListener("click", function (e) {
    if (e.target.tagName === "OPTION") {
      const selectedOption = e.target;
      workerSearchInput.value = selectedOption.textContent;
      hideDropdown(workerDropdown, workerSearchInput);
    }
  });

  // ---------- 4️⃣.5 Open Form with Pre-filled Data ----------
  function openFormWithPrefilledData(participantID, workerValue, clickedDate) {
    const iframe = document.getElementById("crmFormFrame");

    // Format clicked date to "DD-Mon-YYYY 00:00:00" format (e.g., "20-Jan-2026 00:00:00")
    const date = new Date(clickedDate);
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const formattedStartDate = `${day}-${month}-${year} 00:00:00`;

    // Build URL with pre-filled fields
    let url = "https://creatorapp.zohopublic.com/zoho_hello694/calender-includa/form-embed/Booking_Form/BHpO2XsT54Ma22NXYmxkyUJbA9FCaMFwsqDtzmsjzRpp8Zr9GtZxXHqZTSwrV5hmK29s3NtbS6qtQ8HhPNkjt9g0Nj5nbsy9Cx6M" +
      "?embed=true&hide_header=true&formAutoResize=true";

    // Add participant if selected
    if (participantID) {
      url += "&Participant=" + encodeURIComponent(participantID);
    }

    // Add support worker if selected
    if (workerValue) {
      url += "&Support_worker2=" + encodeURIComponent(workerValue);
    }

    // Add start date and time
    url += "&Start_Date_and_Time=" + encodeURIComponent(formattedStartDate);

    iframe.src = url;

    new bootstrap.Modal(
      document.getElementById("creatorFormModal")
    ).show();
  }

  // ---------- 4️⃣ Open Blank Form ----------
  function openBlankForm() {
    const iframe = document.getElementById("crmFormFrame");

    iframe.src =
      "https://creatorapp.zohopublic.com/zoho_hello694/calender-includa/form-embed/Booking_Form/BHpO2XsT54Ma22NXYmxkyUJbA9FCaMFwsqDtzmsjzRpp8Zr9GtZxXHqZTSwrV5hmK29s3NtbS6qtQ8HhPNkjt9g0Nj5nbsy9Cx6M" +
      "?embed=true&hide_header=true&formAutoResize=true";

    new bootstrap.Modal(
      document.getElementById("creatorFormModal")
    ).show();
  }

  // ---------- 5️⃣ Prefill Form ----------
  function prefillForm(event) {

    const workerValue = event.extendedProps.workerID || "";
    const participantID = event.extendedProps.participantID || "";
    const rawStart = event.extendedProps.rawStart || "";
    const rawEnd = event.extendedProps.rawEnd || "";
    const status = event.extendedProps.status || "";
    const crmLink = event.extendedProps.crmLink || "";
    const Booking_Type = event.extendedProps.Booking_Type || ""


    console.log("Prefill values:", {
      workerValue,
      participantID,
      rawStart,
      rawEnd,
      status,
      crmLink,
      Booking_Type
    });

    const iframe = document.getElementById("crmFormFrame");

    const baseUrl =
      "https://creatorapp.zohopublic.com/zoho_hello694/calender-includa/form-embed/Booking_Form/BHpO2XsT54Ma22NXYmxkyUJbA9FCaMFwsqDtzmsjzRpp8Zr9GtZxXHqZTSwrV5hmK29s3NtbS6qtQ8HhPNkjt9g0Nj5nbsy9Cx6M";

    iframe.src =
      `${baseUrl}` +
      `?Support_worker2=${encodeURIComponent(workerValue)}` +
      `&Participant=${encodeURIComponent(participantID)}` +
      `&Start_Date_and_Time=${encodeURIComponent(rawStart)}` +
      `&End_Date_and_Time=${encodeURIComponent(rawEnd)}` +
      `&Status=${encodeURIComponent(status)}` +
      `&Url.url=${encodeURIComponent(crmLink)}` +
      `&Url.title=${encodeURIComponent("Open CRM Record")}` +
      `&Recurring1=${encodeURIComponent(Booking_Type)}` +
      `&embed=true&hide_header=true&formAutoResize=true`;

    new bootstrap.Modal(
      document.getElementById("creatorFormModal")
    ).show();
  }


  // ---------- 6️⃣ Refresh Calendar After Save ----------
  document
    .getElementById("crmFormFrame")
    .addEventListener("load", function () {
      try {
        const url = this.contentWindow.location.href;
        if (url.includes("success") || url.includes("thankyou")) {
          loadBookings();
        }
      } catch (e) {
        // cross-origin ignore
      }
    });

});