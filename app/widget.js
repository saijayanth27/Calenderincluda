document.addEventListener("DOMContentLoaded", function () {

  // Helper function to add delay between API calls
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Global variable to store all bookings for client-side filtering
  // allBookingsCache removed to favor server-side filtering
  let allSupportWorkersCache = [];
  let allParticipantsCache = [];

  // Helper function to render a dropdown from cached data
  function renderDropdown(elementId, items, defaultOptionText) {
    const dropdown = document.getElementById(elementId);
    if (!dropdown) return;

    dropdown.innerHTML = `<option value="">${defaultOptionText}</option>`;
    items.forEach(item => {
      const name = item.Participant_Name?.zc_display_value || 
                   item.Participant_Name?.first_name || 
                   item.Name?.first_name || 
                   item.Name?.zc_display_value || 
                   item.First_Name || 
                   item.name || 
                   "Unknown";
      const id = item.ID;

      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      dropdown.appendChild(opt);
    });
  }

  function formatDateTimeForCalendar(dateTimeStr) {
    if (!dateTimeStr) return null;

    const months = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04",
      May: "05", Jun: "06", Jul: "07", Aug: "08",
      Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };

    const parts = dateTimeStr.trim().split(" ");
    if (parts.length < 2) return null;

    const datePart = parts[0];
    const timePart = parts[1];

    const dateParts = datePart.split("-");
    if (dateParts.length !== 3) return null;

    const [day, mon, year] = dateParts;
    const monthNum = months[mon];
    if (!monthNum) return null;

    const timeParts = timePart.split(":");
    if (timeParts.length < 2) return null;

    const [hour, minute] = timeParts;

    return `${year}-${monthNum}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  }

  // Convert "yyyy-MM-ddTHH:mm" (input) to "DD-Mon-YYYY HH:mm:ss" (Zoho)
  function formatDateTimeForZoho(dateTimeStr) {
    if (!dateTimeStr) return "";
    const date = new Date(dateTimeStr);
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = "00";
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  }

  // Convert "yyyy-MM-dd" to "DD-Mon-YYYY" for Zoho Date fields
  function formatDateForZoho(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
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

  // ---------- 2.1 Fetch Support Workers for Specific Participant ----------
  async function fetchSupportWorkersForParticipant(participantID) {
    console.log("========== FETCH SUPPORT WORKERS START ==========");
    console.log("Step 1: participantID received:", participantID);

    if (!participantID) {
      console.log("Step 2: No participantID — loading ALL support workers");
      await loadSupportWorkers();
      console.log("========== FETCH SUPPORT WORKERS END ==========");
      return;
    }

    showLoader();
    try {
      console.log("Step 2: Building config for custom API...");

      const config = {
        api_name: "Fetch_the_supp_workers",
        http_method: "POST",
        content_type: "application/json",
        payload: {
          "participant_name": participantID
        }
      };
      console.log("Step 3: Config object:", JSON.stringify(config, null, 2));

      console.log("Step 4: Calling ZOHO.CREATOR.DATA.invokeCustomApi...");
      const response = await ZOHO.CREATOR.DATA.invokeCustomApi(config);

      console.log("Step 5: Raw response:", JSON.stringify(response, null, 2));
      console.log("Step 5a: response.data:", JSON.stringify(response.data, null, 2));
      console.log("Step 5b: response type:", typeof response);
      console.log("Step 5c: response.code:", response.code);

      const data = response.result || response.data || response;

      console.log("Step 6: Data to process:", JSON.stringify(data, null, 2));
      console.log("Step 6a: Is Array?", Array.isArray(data));
      console.log("Step 6b: Data length:", data?.length);

      const workerDropdown = document.getElementById("workerFilter");

      if (workerDropdown) {
        workerDropdown.innerHTML = `<option value="">— All Workers —</option>`;
      }

      if (data && Array.isArray(data)) {
        data.forEach((w) => {
          const name = typeof w === 'string' ? w : (w.display_value || w.zc_display_value || w.name || "Unknown");
          let id = w.ID || w.id || "";

          if (!id && allSupportWorkersCache.length > 0) {
            const matchedWorker = allSupportWorkersCache.find(sw => {
              const swName = sw.Name?.zc_display_value || sw.Name?.first_name || "";
              return swName === name;
            });
            if (matchedWorker) id = matchedWorker.ID;
          }

          if (!id) id = name;

          if (workerDropdown) {
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = name;
            workerDropdown.appendChild(opt);
          }
        });
      }

      console.log("Step 8: Dropdown now has", workerDropdown.options.length, "options");
      console.log("========== FETCH SUPPORT WORKERS SUCCESS ==========");

    } catch (e) {
      console.error("========== FETCH SUPPORT WORKERS ERROR ==========");
      console.error("Error message:", e.message);
      console.error("Error details:", JSON.stringify(e, null, 2));
      console.error("Full error:", e);
      console.log("Falling back to loading all support workers...");
      await loadSupportWorkers();
    } finally {
      hideLoader();
    }
  }

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
          app_name: "calendar-includa",
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
      allSupportWorkersCache = allWorkers; // Cache for lookup

      // Render the dropdown using the newly cached data
      renderDropdown("workerFilter", allSupportWorkersCache, "— All Workers —");

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
          app_name: "calendar-includa",
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
      allParticipantsCache = allParticipants; // Save to global cache

      // Render the dropdown using the newly cached data
      renderDropdown("participantFilter", allParticipantsCache, "— All Participants —");

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
          app_name: "calendar-includa",
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
            backgroundColor: "#9BD8D9",
            borderColor: "#9BD8D9",
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

    // Show all options by restoring from cache (very fast!)
    renderDropdown("participantFilter", allParticipantsCache, "— All Participants —");
    renderDropdown("workerFilter", allSupportWorkersCache, "— All Workers —");

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

  // When selecting from dropdown, update search input, close dropdown AND fetch associated workers
  participantDropdown.addEventListener("change", async function () {
    const selectedOption = this.options[this.selectedIndex];
    const participantName = selectedOption.textContent;
    const participantID = selectedOption.value;

    // Show selected option text in search field (including "All Participants")
    participantSearchInput.value = participantName;
    hideDropdown(participantDropdown, participantSearchInput);

    // Fetch support workers for this participant using their ID
    await fetchSupportWorkersForParticipant(participantID);
  });

  // Handle click events on dropdown options (for already-selected items)
  participantDropdown.addEventListener("click", async function (e) {
    if (e.target.tagName === "OPTION") {
      const selectedOption = e.target;
      const participantName = selectedOption.textContent;
      const participantID = selectedOption.value;

      participantSearchInput.value = participantName;
      hideDropdown(participantDropdown, participantSearchInput);

      // Fetch support workers for this participant using their ID
      await fetchSupportWorkersForParticipant(participantID);
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

  // Helper to get ISO string in local timezone (YYYY-MM-DDTHH:mm)
  function getLocalIsoString(date) {
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().slice(0, 16);
  }

  // ---------- 4️⃣.5 Open Form with Pre-filled Data ----------
  function openFormWithPrefilledData(participantID, workerValue, clickedDate) {
    const iframe = document.getElementById("crmFormFrame");

    // Format clicked date to "DD-Mon-YYYY 00:00:00" format
    const date = new Date(clickedDate);
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const formattedStartDate = `${day}-${month}-${year} 00:00:00`;

    // Build URL with pre-filled fields
    let url = "https://creatorapp.zohopublic.com/zoho_hello694/calendar-includa/form-embed/Booking_Form/zSqPnOQpPg6MYUR8NSeXX4AafJr0hz5wqy5aT0XnYsJFx04Xy1dOqUa53wGYXt18FCAXz17fsnmpkJHWSbkGUreBDZZYKBWZ3mTm" +
      "?embed=true&hide_header=true&formAutoResize=true";

    if (participantID) {
      url += "&Participant=" + encodeURIComponent(participantID);
    }
    if (workerValue) {
      url += "&Support_worker2=" + encodeURIComponent(workerValue);
    }
    url += "&Start_Date_and_Time=" + encodeURIComponent(formattedStartDate);

    iframe.src = url;

    new bootstrap.Modal(document.getElementById("creatorFormModal")).show();
  }

  // ---------- 5️⃣ Prefill Form (Edit Mode) ----------
  function prefillForm(event) {
    const props = event.extendedProps;
    const iframe = document.getElementById("crmFormFrame");

    const baseUrl = "https://creatorapp.zohopublic.com/zoho_hello694/calendar-includa/form-embed/Booking_Form/zSqPnOQpPg6MYUR8NSeXX4AafJr0hz5wqy5aT0XnYsJFx04Xy1dOqUa53wGYXt18FCAXz17fsnmpkJHWSbkGUreBDZZYKBWZ3mTm";

    let url = `${baseUrl}?embed=true&hide_header=true&formAutoResize=true` +
      `&Support_worker2=${encodeURIComponent(props.workerID || "")}` +
      `&Participant=${encodeURIComponent(props.participantID || "")}` +
      `&Start_Date_and_Time=${encodeURIComponent(props.rawStart || "")}` +
      `&End_Date_and_Time=${encodeURIComponent(props.rawEnd || "")}` +
      `&Status=${encodeURIComponent(props.status || "")}` +
      `&Recurring1=${encodeURIComponent(props.Booking_Type || "")}`;

    if (props.crmLink) {
      url += `&Url.url=${encodeURIComponent(props.crmLink)}` +
             `&Url.title=${encodeURIComponent("Open CRM Record")}`;
    }

    iframe.src = url;

    new bootstrap.Modal(document.getElementById("creatorFormModal")).show();
  }

  // ---------- 6️⃣ Refresh Calendar After Save ----------
  document.getElementById("crmFormFrame").addEventListener("load", function () {
    try {
      const url = this.contentWindow.location.href;
      if (url.includes("success") || url.includes("thankyou")) {
        // Success! Hide modal and refresh
        bootstrap.Modal.getInstance(document.getElementById("creatorFormModal")).hide();
        loadBookings();
      }
    } catch (e) {
      // Cross-origin ignore
    }
  });

});