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
      const response = await ZOHO.CREATOR.DATA.getRecords({
        app_name: "calender-includa",
        report_name: "All_Support_Workers",
      });

      const workerList = response.data || [];
      const workerDropdown = document.getElementById("workerFilter");

      if (!workerDropdown) return;

      workerDropdown.innerHTML = `<option value="">— All Workers —</option>`;

      workerList.forEach(w => {
        const name =
          w.Name?.first_name ||
          w.Name?.zc_display_value ||
          "Unknown";

        const opt = document.createElement("option");
        opt.value = w.ID;
        opt.textContent = name;
        workerDropdown.appendChild(opt);
      });

    } catch (e) {
      console.error("Error loading workers:", e);
    }
  }

  // ---------- 2️⃣.5 Load Participants ----------
  async function loadParticipants() {
    try {
      console.log("Loading participants...");
      const response = await ZOHO.CREATOR.DATA.getRecords({
        app_name: "calender-includa",
        report_name: "All_Participants",
      });

      console.log("Participants response:", response);
      const participantList = response.data || [];
      console.log("Participant count:", participantList.length);

      const participantDropdown = document.getElementById("participantFilter");

      if (!participantDropdown) {
        console.error("Participant dropdown not found!");
        return;
      }

      // Reset to default option
      participantDropdown.innerHTML = `<option value="">— All Participants —</option>`;

      participantList.forEach(p => {
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

      console.log("Participants loaded successfully. Total:", participantList.length);

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

      function formatDateForCalendar(dateStr) {
        if (!dateStr) return null;

        dateStr = dateStr.split(" ")[0];

        const months = {
          Jan: "01", Feb: "02", Mar: "03", Apr: "04",
          May: "05", Jun: "06", Jul: "07", Aug: "08",
          Sep: "09", Oct: "10", Nov: "11", Dec: "12",
        };

        const parts = dateStr.split("-");
        if (parts.length !== 3) return null;

        const [day, mon, year] = parts;
        return `${year}-${months[mon]}-${day.padStart(2, "0")}`;
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

          return {
            id: rec.ID,

            title: `${participantName} - ${workerName}`,

            start: rec.Start_Date_and_Time
              ? formatDateForCalendar(rec.Start_Date_and_Time)
              : null,
            backgroundColor: "#007bff",
            borderColor: "#007bff",
            extendedProps: {
              participantID,
              workerValue,
              rawStart: rec.Start_Date_and_Time,
              rawEnd: rec.End_Date_and_Time,
              status: rec.Status || "",
              crmLink: rec.CRM_Link2 || "",
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
    const participantID = document.getElementById("participantFilter").value;
    const workerID = document.getElementById("workerFilter").value;

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
    if (selectedOption.value !== "") {
      participantSearchInput.value = selectedOption.textContent;
    }
    hideDropdown(participantDropdown, participantSearchInput);
  });

  workerDropdown.addEventListener("change", function () {
    const selectedOption = this.options[this.selectedIndex];
    if (selectedOption.value !== "") {
      workerSearchInput.value = selectedOption.textContent;
    }
    hideDropdown(workerDropdown, workerSearchInput);
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
      `&CRM_Link2=${encodeURIComponent(crmLink)}` +
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
