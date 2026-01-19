document.addEventListener("DOMContentLoaded", function () {

  // Helper function to add delay between API calls
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // ---------- 1️⃣ Setup Calendar ----------
  const calendarEl = document.getElementById("calendar");

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",

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
        dayHeaderFormat: { weekday: 'long', month: 'numeric', day: 'numeric' }
      },
      timeGridDay: {
        dayHeaderFormat: { weekday: 'long', month: 'long', day: 'numeric' }
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

    // Custom dayCellContent to align dates in month view
    // Custom dayCellContent to align dates in top-right corner
   // Custom dayCellContent to align dates in top-left corner
    dayCellContent: function (arg) {
      const dateNum = arg.date.getDate();
      return {
        html: `<div style="text-align: left; padding: 4px 160px;">${dateNum}</div>`
      };
    },

    // Don't display event time automatically (we'll handle it in eventContent)
    displayEventTime: false,

    // Custom event content to control time display
    eventContent: function (arg) {
      const viewType = arg.view.type;
      const event = arg.event;

      // Format start time (e.g., "2:30 PM")
      let timeStr = '';
      if (event.start && (viewType === 'timeGridWeek' || viewType === 'timeGridDay')) {
        const hours = event.start.getHours();
        const minutes = event.start.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
        timeStr = `${displayHours}:${displayMinutes} ${ampm}`;
      }

      return {
        html: `<div class="fc-event-main-frame" style="padding: 5px 6px; height: 100%;">
                 ${timeStr ? `<div class="fc-event-time" style="font-size: 10px; font-weight: 700; margin-bottom: 3px; opacity: 0.95;">${timeStr}</div>` : ''}
                 <div class="fc-event-title-container">
                   <div class="fc-event-title fc-sticky" style="font-size: 12px; line-height: 1.3; font-weight: 500;">${event.title || 'Untitled'}</div>
                 </div>
               </div>`
      };
    },

    dateClick: function () {
      openBlankForm();
    },

    eventClick: function (info) {
      prefillForm(info.event);
    },

    events: [],
  });

  calendar.render();

  // ---------- 2️⃣ Load Support Workers ----------
  async function loadSupportWorkers() {
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
          console.log(`First worker ID in this batch: ${workerList[0].ID}`);
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
        opt.value = name;  // Use name instead of ID for filtering
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
          console.log(`First participant ID in this batch: ${participantList[0].ID}`);
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

  // ---------- 3️⃣ Load Bookings ----------
  function loadBookings(filterParticipantID = "", filterWorkerID = "") {
    const config = {
      app_name: "calender-includa",
      report_name: "All_Bookings",
    };

    ZOHO.CREATOR.DATA.getRecords(config).then(function (response) {
      const recordArr = response.data || [];

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

      const events = recordArr
        .filter(rec => {
          // Apply filters
          let matchesParticipant = true;
          let matchesWorker = true;

          if (filterParticipantID) {
            const participantID = rec.Participant?.ID || "";
            matchesParticipant = participantID === filterParticipantID;
          }

          if (filterWorkerID) {
            let workerValue = "";
            if (rec.Support_worker2) {
              if (typeof rec.Support_worker2 === "object") {
                workerValue = rec.Support_worker2.value || "";
              } else if (typeof rec.Support_worker2 === "string") {
                workerValue = rec.Support_worker2;
              }
            }
            matchesWorker = workerValue === filterWorkerID;
          }

          return matchesParticipant && matchesWorker;
        })
        .map(rec => {
          console.log("rec:" + rec);

          // ✅ Participant (LOOKUP)
          const participantName =
            rec.Participant?.zc_display_value?.trim() || "No Participant";

          const participantID =
            rec.Participant?.ID || "";

          // ✅ Support Worker (DROPDOWN – CORRECT)
          let workerName = "No Worker";
          let workerValue = "";

          if (rec.Support_worker2) {
            if (typeof rec.Support_worker2 === "object") {
              workerName =
                rec.Support_worker2.zc_display_value || "No Worker";

              // 🔑 MUST be dropdown VALUE
              workerValue =
                rec.Support_worker2.value || "";
            }
            else if (typeof rec.Support_worker2 === "string") {
              workerName = rec.Support_worker2;
              workerValue = rec.Support_worker2;
            }
          }

          // Calculate end time as 1 hour after start for proper rendering
          const startDateTime = rec.Start_Date_and_Time
            ? formatDateTimeForCalendar(rec.Start_Date_and_Time)
            : null;

          let endDateTime = null;
          if (startDateTime) {
            // Add 1 hour to start time for display purposes
            const startDate = new Date(startDateTime);
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
            endDateTime = endDate.toISOString().slice(0, 19);
          }

          return {
            id: rec.ID,

            title: `${participantName} - ${workerName}`,

            start: startDateTime,
            end: endDateTime, // Set to 1 hour after start for proper rendering
            backgroundColor: "#007bff",
            borderColor: "#007bff",
            extendedProps: {
              participantID,
              workerValue,
              rawStart: rec.Start_Date_and_Time,
              rawEnd: rec.End_Date_and_Time,
              status: rec.Status || "",
              crmLink: rec.CRM_Link_URL.url || "",
              Booking_Type: rec.Recurring1 || ""
            },
          };
        });

      calendar.removeAllEvents();
      calendar.addEventSource(events);
    });
  }

  // ---------- 7️⃣ Initialize Dropdowns (Calendar Starts Empty) ----------
  setTimeout(() => {
    loadParticipants();
    loadSupportWorkers();
    // Don't load bookings automatically - calendar starts empty
  }, 200);

  // ---------- 8️⃣ Submit Filters Button ----------
  document.getElementById("submitFilters").addEventListener("click", function () {
    const participantDropdown = document.getElementById("participantFilter");
    const workerDropdown = document.getElementById("workerFilter");
    const participantSearchInput = document.getElementById("participantSearch");
    const workerSearchInput = document.getElementById("workerSearch");

    // Check if user has made a selection (either specific or "All")
    const participantSelected = participantSearchInput.value.trim() !== "";
    const workerSelected = workerSearchInput.value.trim() !== "";

    // Only search if at least one filter has been explicitly selected
    if (!participantSelected && !workerSelected) {
      alert("Please select at least one filter option (you can select 'All Participants' or 'All Workers' to see all bookings)");
      return;
    }

    const participantID = participantDropdown.value;
    const workerID = workerDropdown.value;

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

    const workerValue = event.extendedProps.workerValue || "";
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