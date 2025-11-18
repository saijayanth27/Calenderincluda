document.addEventListener("DOMContentLoaded", function () {

  // --- 1️⃣ Setup Calendar ---
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
    dateClick: function (info) {
      const modal = new bootstrap.Modal(
        document.getElementById("creatorFormModal")
      );
      modal.show();
    },
    events: [] 
  });

  calendar.render();

  // --- 2️⃣ Load Support Workers ---
  async function loadSupportWorkers() {
    try {
      const response = await ZOHO.CREATOR.DATA.getRecords({
        app_name: "calender-includa",
        report_name: "All_Support_Workers"
      });

      const workerList = response.data;
      console.log("Workers:", workerList);

      const workerDropdown = document.getElementById("workerFilter");
      const reassignDropdown = document.getElementById("reassignTo");

      // Clear existing
      workerDropdown.innerHTML = `<option value="">— All Workers —</option>`;
      if (reassignDropdown) {
        reassignDropdown.innerHTML = `<option value="">— Reassign to —</option>`;
      }

      workerList.forEach(w => {
        const name = w.Name?.first_name || w.Name?.zc_display_value || "Unknown";
        
        // Add to filter dropdown
        const opt1 = document.createElement("option");
        opt1.value = w.ID;
        opt1.textContent = name;
        workerDropdown.appendChild(opt1);
        
        // Add to reassign dropdown
        if (reassignDropdown) {
          const opt2 = document.createElement("option");
          opt2.value = w.ID;
          opt2.textContent = name;
          reassignDropdown.appendChild(opt2);
        }
      });

      console.log("✅ Worker dropdown populated");

    } catch (e) {
      console.error("Error loading workers", e);
    }
  }

  // --- 3️⃣ Load Bookings ---
  function loadBookings() {
    var config = {
      app_name: "calender-includa",
      report_name: "All_Bookings"
    };

    ZOHO.CREATOR.DATA.getRecords(config).then(function (response) {
      var recordArr = response.data;
      console.log("recordArr", recordArr);
      
      // robust date parser / formatter for FullCalendar
      function formatDate(dateStr) {
        if (!dateStr) return null;

        // Example input: "10-Nov-2025"
        const months = {
          Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
          Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
        };

        const [day, mon, year] = dateStr.split('-');
        const month = months[mon];

        // Output: YYYY-MM-DD
        return `${year}-${month}-${day.padStart(2, '0')}`;
      }

      // ✅ Map Creator data to FullCalendar format
      const events = recordArr.map(rec => ({
        id: rec.ID,
        title: rec.Title || "Untitled Booking",  
        start: formatDate(rec.Start_Time1),              
        backgroundColor: "#007bff",
        borderColor: "#007bff",
        extendedProps: {
            Support_Worker: rec.Support_Worker?.display_value || "Not Assigned",
            Participant: rec.Participant?.display_value || "Not Assigned",
            Repeat: rec.Repeat
        }
      }));

      // ✅ Load events into the calendar
      calendar.removeAllEvents();
      calendar.addEventSource(events);
      console.log("✅ Calendar updated with Creator data:", events);
    });
  }

  // Load data with small delay
  setTimeout(() => {
    loadSupportWorkers();
    loadBookings();
  }, 100);

  // --- 4️⃣ Refresh after Form Submit ---
  const iframe = document.getElementById("creatorFormFrame");
  iframe.addEventListener("load", async function () {
    try {
      const currentURL = iframe.contentWindow.location.href;
      if (currentURL.includes("success") || currentURL.includes("thankyou")) {
        const modalEl = document.getElementById("creatorFormModal");
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) {
          modalInstance.hide();
        }
        loadBookings();
      }
    } catch (e) {
      // Cross-origin iframe access might fail, that's okay
      console.log("iframe check skipped (cross-origin)");
    }
  });

});