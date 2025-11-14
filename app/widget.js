// var config = {
//   app_name: "calender-includa",
//   report_name: "All_Bookings"
// };
// ZOHO.CREATOR.DATA.getRecords(config).then(function (response) {
//   var recordArr = response.data;
//   console.log("recordArr",recordArr);
// });
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

  // --- 2️⃣ Load Data from Zoho Creator ---
    var config = {
      app_name: "calender-includa",
      report_name: "All_Bookings"
    };

    // 👉 Here’s your working code — just moved inside init()
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
  });

  // --- 3️⃣ Refresh after Form Submit ---
  const iframe = document.getElementById("creatorFormFrame");
  iframe.addEventListener("load", async function () {
    const currentURL = iframe.contentWindow.location.href;
    if (currentURL.includes("success") || currentURL.includes("thankyou")) {
      const modalEl = document.getElementById("creatorFormModal");
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      modalInstance.hide();
      // 🔁 Reload calendar data after form submit
      ZOHO.CREATOR.DATA.getRecords({
        app_name: "calender-includa",
        report_name: "All_Bookings"
      }).then(function (response) {
        const events = response.data.map(rec => ({
          id: rec.ID,
          title: rec.Title?.display_value || "Untitled Booking",
          start: rec.Start_Time1,
          end: rec.End_Time,
          backgroundColor: "#007bff",
          borderColor: "#007bff"
        }));
        calendar.removeAllEvents();
        calendar.addEventSource(events);
      });
    }
  });



