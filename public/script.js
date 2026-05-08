let isDarkMode = localStorage.getItem("theme") === "dark";

/* Theme */

if (isDarkMode) {
  document.body.classList.add("dark-mode");
  document.querySelector(".theme-toggle i").className = "fas fa-moon";
} else {
  document.body.classList.add("light-mode");
}

function toggleTheme() {

  isDarkMode = !isDarkMode;

  if (isDarkMode) {

    document.body.classList.remove("light-mode");
    document.body.classList.add("dark-mode");

    document.querySelector(".theme-toggle i").className =
      "fas fa-moon";

    localStorage.setItem("theme", "dark");

  } else {

    document.body.classList.remove("dark-mode");
    document.body.classList.add("light-mode");

    document.querySelector(".theme-toggle i").className =
      "fas fa-sun";

    localStorage.setItem("theme", "light");
  }
}

/* Mobile Menu */

function toggleMobileMenu() {
  document.getElementById("sidebar").classList.toggle("open");
}

/* Navigation */

document.querySelectorAll(".menu-item[data-section]").forEach(item => {

  item.addEventListener("click", () => {

    document
      .querySelectorAll(".menu-item")
      .forEach(menu => menu.classList.remove("active"));

    item.classList.add("active");

    document
      .querySelectorAll(".section")
      .forEach(section => section.classList.remove("active-section"));

    document
      .getElementById(`${item.dataset.section}-section`)
      .classList.add("active-section");

    if (window.innerWidth <= 600) {
      document.getElementById("sidebar").classList.remove("open");
    }

  });

});

/* Date & Time */

function updateDateTime() {

  const now = new Date();

  document.getElementById("datetime").textContent =
    now.toLocaleString();

}

setInterval(updateDateTime, 1000);
updateDateTime();

/* Battery */

if ("getBattery" in navigator) {

  navigator.getBattery().then(battery => {

    function updateBattery() {

      const percent = Math.round(battery.level * 100);

      document.getElementById("battery").textContent =
        `${percent}% ${battery.charging ? "⚡ Charging" : "🔋 Discharging"}`;
    }

    updateBattery();

    battery.addEventListener("levelchange", updateBattery);
    battery.addEventListener("chargingchange", updateBattery);

  });

} else {

  document.getElementById("battery").textContent =
    "Not supported";
}

/* IP Address */

fetch("https://api.ipify.org?format=json")
  .then(res => res.json())
  .then(data => {
    document.getElementById("ip").textContent = data.ip;
  })
  .catch(() => {
    document.getElementById("ip").textContent =
      "Unable to fetch";
  });

/* User Agent */

const ua = navigator.userAgent;

document.getElementById("useragent").textContent =
  ua.length > 45 ? ua.slice(0, 45) + "..." : ua;

/* Privacy Modal */

let privacyAccepted = localStorage.getItem("privacyAccepted");

if (!privacyAccepted) {

  setTimeout(() => {
    document.getElementById("privacyModal").style.display = "flex";
  }, 500);

}

function acceptPrivacy() {

  localStorage.setItem("privacyAccepted", "true");

  document.getElementById("privacyModal").style.display = "none";
}

function declinePrivacy() {

  localStorage.setItem("privacyAccepted", "false");

  document.getElementById("privacyModal").style.display = "none";
}

function showPrivacy() {

  document.getElementById("privacyModal").style.display = "flex";
}

/* Particles */

particlesJS("particles-js", {
  particles: {
    number: {
      value: 60,
      density: {
        enable: true,
        value_area: 800
      }
    },

    color: {
      value: "#667eea"
    },

    shape: {
      type: "circle"
    },

    opacity: {
      value: 0.4
    },

    size: {
      value: 2,
      random: true
    },

    line_linked: {
      enable: true,
      distance: 150,
      color: "#667eea",
      opacity: 0.3,
      width: 1
    },

    move: {
      enable: true,
      speed: 1.5
    }
  }
});