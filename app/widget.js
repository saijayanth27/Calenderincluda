document.addEventListener("DOMContentLoaded", function () {

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
      openBlankForm(); // open new booking form
    },

    eventClick: function (info) {
      prefillForm(info.event); // open event data in form
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
      console.log("Workers:", workerList);

      const workerDropdown = document.getElementById("workerFilter");
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

  // ---------- 3️⃣ Load Bookings ----------
  function loadBookings() {
    const config = {
      app_name: "calender-includa",
      report_name: "All_Bookings",
    };

    ZOHO.CREATOR.DATA.getRecords(config).then(function (response) {
      const recordArr = response.data || [];
      console.log("Bookings (raw):", recordArr);

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

      const events = recordArr.map(rec => {
        // ✅ Participant (Lookup)
        const participantName =
          rec.Participant?.zc_display_value?.trim() || "No Participant";
        const participantID = rec.Participant?.ID || "";

        // ✅ Support Worker (Lookup)
        const workerName =
          rec.Support_Worker1?.zc_display_value?.trim() || "No Worker";
        const workerID = rec.Support_Worker1?.ID || "";

        return {
          id: rec.ID,

          // ✅ Participant FIRST
          title: `${participantName} - ${workerName}`,

          start: rec.Start_Date_and_Time
            ? formatDateForCalendar(rec.Start_Date_and_Time)
            : null,

          backgroundColor: "#007bff",
          borderColor: "#007bff",

          extendedProps: {
            participantName,
            participantID,
            workerName,
            workerID,
            rawStart: rec.Start_Date_and_Time,
            rawEnd: rec.End_Date_and_Time,
          },
        };
      });

      console.log("Calendar events:", events);

      calendar.removeAllEvents();
      calendar.addEventSource(events);
    });
  }

  setTimeout(() => {
    loadSupportWorkers();
    loadBookings();
  }, 200);

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
    const workerID = event.extendedProps.workerID || "";
    const participantID = event.extendedProps.participantID || "";
    const rawStart = event.extendedProps.rawStart || "";
    const rawEnd = event.extendedProps.rawEnd || "";

    const iframe = document.getElementById("crmFormFrame");

    const baseUrl =
      "https://creatorapp.zohopublic.com/zoho_hello694/calender-includa/form-embed/Booking_Form/BHpO2XsT54Ma22NXYmxkyUJbA9FCaMFwsqDtzmsjzRpp8Zr9GtZxXHqZTSwrV5hmK29s3NtbS6qtQ8HhPNkjt9g0Nj5nbsy9Cx6M";

    iframe.src =
      `${baseUrl}` +
      `?Support_Worker=${encodeURIComponent(workerID)}` +
      `&Participant=${encodeURIComponent(participantID)}` +
      `&Start_Date_and_Time=${encodeURIComponent(rawStart)}` +
      `&End_Date_and_Time=${encodeURIComponent(rawEnd)}` +
      `&embed=true&hide_header=true&formAutoResize=true`;

    new bootstrap.Modal(
      document.getElementById("creatorFormModal")
    ).show();
  }

  // ---------- 6️⃣ Refresh Calendar After Form Save ----------
  document
    .getElementById("crmFormFrame")
    .addEventListener("load", function () {
      try {
        const url = this.contentWindow.location.href;
        if (url.includes("success") || url.includes("thankyou")) {
          loadBookings();
        }
      } catch (e) {
        console.log("Cross-origin iframe skip");
      }
    });

});
