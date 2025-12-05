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
      
      // proper Zoho date formatter
      function formatDate(dateStr) {
        if (!dateStr) return null;

        // strip time if exists
        dateStr = dateStr.split(" ")[0];

        const months = {
          Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
          Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
        };

        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;

        const [day, mon, year] = parts;
        const month = months[mon];

        return `${year}-${month}-${day.padStart(2, '0')}`;
      }

      // Map Creator data to FullCalendar format
      const events = recordArr.map(rec => ({
        id: rec.ID,
        
        title:
          (rec.Participant_Name || rec.Participant_Name?.first_name || "No Participant")
          + " - " +
          (rec.Support_Worker?.zc_display_value || rec.Support_Worker?.first_name || "No Worker"),

        start: rec.Start_Date_and_Time ? formatDate(rec.Start_Date_and_Time) : null,

        backgroundColor: "#007bff",
        borderColor: "#007bff",

        extendedProps: {
          Support_Worker: rec.Support_Worker?.zc_display_value || "Not Assigned",
          Participant: rec.Participant_Name|| "Not Assigned",
          Repeat: rec.Repeat
        }
      }));

      calendar.removeAllEvents();
      calendar.addEventSource(events);

      console.log("✅ Calendar updated with Creator data:", events);
    });
  }

  // Load data with slight delay
  setTimeout(() => {
    loadSupportWorkers();
    loadBookings();
  }, 200);

  // --- 4️⃣ Refresh after CRM form submit ---
  const iframe = document.getElementById("crmFormFrame");
  iframe.addEventListener("load", async function () {
    try {
      const url = iframe.contentWindow.location.href;
      console.log("iframe URL:", url);

      if (url.includes("success") || url.includes("thankyou")) {
        const modalEl = document.getElementById("creatorFormModal");
        const modalInstance = bootstrap.Modal.getInstance(modalEl);

        if (modalInstance) {
          modalInstance.hide();
        }

        loadBookings();
      }

    } catch (e) {
      console.log("⚠️ Cross origin - skipping iframe URL check");
    }
  });

});
