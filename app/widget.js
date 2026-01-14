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

  // ---------- 3️⃣ Load Bookings ----------
  function loadBookings() {
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

      const events = recordArr.map(rec => {

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
          },
        };
      });

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

    const workerValue = event.extendedProps.workerValue || "";
    const participantID = event.extendedProps.participantID || "";
    const rawStart = event.extendedProps.rawStart || "";
    const rawEnd = event.extendedProps.rawEnd || "";

    console.log("Prefill Support Worker VALUE:", workerValue);

    const iframe = document.getElementById("crmFormFrame");

    const baseUrl =
      "https://creatorapp.zohopublic.com/zoho_hello694/calender-includa/form-embed/Booking_Form/BHpO2XsT54Ma22NXYmxkyUJbA9FCaMFwsqDtzmsjzRpp8Zr9GtZxXHqZTSwrV5hmK29s3NtbS6qtQ8HhPNkjt9g0Nj5nbsy9Cx6M";

    iframe.src =
      `${baseUrl}` +
      `?Support_worker2=${encodeURIComponent(workerValue)}` +
      `&Participant=${encodeURIComponent(participantID)}` +
      `&Start_Date_and_Time=${encodeURIComponent(rawStart)}` +
      `&End_Date_and_Time=${encodeURIComponent(rawEnd)}` +
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
