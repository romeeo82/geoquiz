// Mapping from ISO3 (geojson) to ISO2 (flagcdn.com)
const iso3to2 = {
  AFG: "af", ALB: "al", DZA: "dz", AND: "ad", AGO: "ao", ATG: "ag", ARG: "ar", ARM: "am",
  AUS: "au", AUT: "at", AZE: "az", BHS: "bs", BHR: "bh", BGD: "bd", BRB: "bb", BLR: "by",
  BEL: "be", BLZ: "bz", BEN: "bj", BTN: "bt", BOL: "bo", BIH: "ba", BWA: "bw", BRA: "br",
  BRN: "bn", BGR: "bg", BFA: "bf", BDI: "bi", KHM: "kh", CMR: "cm", CAN: "ca", CPV: "cv",
  CAF: "cf", TCD: "td", CHL: "cl", CHN: "cn", COL: "co", COM: "km", COG: "cg", COD: "cd",
  CRI: "cr", HRV: "hr", CUB: "cu", CYP: "cy", CZE: "cz", DNK: "dk", DJI: "dj", DMA: "dm",
  DOM: "do", ECU: "ec", EGY: "eg", SLV: "sv", GNQ: "gq", ERI: "er", EST: "ee", SWZ: "sz",
  ETH: "et", FJI: "fj", FIN: "fi", FRA: "fr", GAB: "ga", GMB: "gm", GEO: "ge", DEU: "de",
  GHA: "gh", GRC: "gr", GRD: "gd", GTM: "gt", GIN: "gn", GNB: "gw", GUY: "gy", HTI: "ht",
  HND: "hn", HUN: "hu", ISL: "is", IND: "in", IDN: "id", IRN: "ir", IRQ: "iq", IRL: "ie",
  ISR: "il", ITA: "it", JAM: "jm", JPN: "jp", JOR: "jo", KAZ: "kz", KEN: "ke", KIR: "ki",
  PRK: "kp", KOR: "kr", KWT: "kw", KGZ: "kg", LAO: "la", LVA: "lv", LBN: "lb", LSO: "ls",
  LBR: "lr", LBY: "ly", LIE: "li", LTU: "lt", LUX: "lu", MDG: "mg", MWI: "mw", MYS: "my",
  MDV: "mv", MLI: "ml", MLT: "mt", MHL: "mh", MRT: "mr", MUS: "mu", MEX: "mx", FSM: "fm",
  MDA: "md", MCO: "mc", MNG: "mn", MNE: "me", MAR: "ma", MOZ: "mz", MMR: "mm", NAM: "na",
  NRU: "nr", NPL: "np", NLD: "nl", NZL: "nz", NIC: "ni", NER: "ne", NGA: "ng", MKD: "mk",
  NOR: "no", OMN: "om", PAK: "pk", PLW: "pw", PAN: "pa", PNG: "pg", PRY: "py", PER: "pe",
  PHL: "ph", POL: "pl", PRT: "pt", QAT: "qa", ROU: "ro", RUS: "ru", RWA: "rw", KNA: "kn",
  LCA: "lc", VCT: "vc", WSM: "ws", SMR: "sm", STP: "st", SAU: "sa", SEN: "sn", SRB: "rs",
  SYC: "sc", SLE: "sl", SGP: "sg", SVK: "sk", SVN: "si", SLB: "sb", SOM: "so", ZAF: "za",
  SSD: "ss", ESP: "es", LKA: "lk", SDN: "sd", SUR: "sr", SWE: "se", CHE: "ch", SYR: "sy",
  TWN: "tw", TJK: "tj", TZA: "tz", THA: "th", TLS: "tl", TGO: "tg", TON: "to", TTO: "tt",
  TUN: "tn", TUR: "tr", TKM: "tm", TUV: "tv", UGA: "ug", UKR: "ua", ARE: "ae", GBR: "gb",
  USA: "us", URY: "uy", UZB: "uz", VUT: "vu", VAT: "va", VEN: "ve", VNM: "vn", YEM: "ye",
  ZMB: "zm", ZWE: "zw"
};

// Init map with world bounds so min zoom never shows top/bottom gaps
const map = L.map('map', {
  minZoom: 2,
  maxBounds: [[-90, -180], [90, 180]],
  maxBoundsViscosity: 1.0
});

// Country names map
const kidsLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 18
  }
);

// Physical map
const adultLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
  {
    attribution: 'Tiles © Esri'
  }
);

// Start with adult layer
let currentBaseLayer = adultLayer.addTo(map);

let geojsonLayer, countries = [], remainingCountries = [], currentCountry;
let totalQuestions = 0, total = 0, correct = 0, wrong = 0;

// Load GeoJSON with all countries
fetch("https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json")
  .then(res => res.json())
  .then(data => {
    countries = data.features;
    remainingCountries = [...countries]; // copy for questions
    totalQuestions = countries.length;

    geojsonLayer = L.geoJSON(countries, {
      style: { color: "#555", weight: 1, fillOpacity: 0.2 },
      onEachFeature: onEachFeature
    }).addTo(map);

    nextQuestion();
    updateCounters();
  });

// --- Custom control for question on the map (top-center) ---
const QuestionControl = L.Control.extend({
  options: { position: 'topcenter' }, // custom slot we style via CSS
  onAdd: function () {
    const div = L.DomUtil.create('div', 'question-box');
    // no default text here; we'll set it from JS after DOM exists
    div.innerHTML = `
      <img id="flag" src="" alt="Flag">
      <span id="question"></span>
    `;
    // prevent map drag when interacting with the box (optional)
    L.DomEvent.disableClickPropagation(div);
    return div;
  }
});

// register custom corner and add control
map._controlCorners['topcenter'] =
  L.DomUtil.create('div', 'leaflet-top leaflet-center', map._controlContainer);
map.addControl(new QuestionControl());

function zoomInCountry(l) {
  map.fitBounds(l.getBounds(), { padding: [20, 20], maxZoom: 5 });
}

function zoomOutToGlobalView(zoomLevel = 2) {
  map.setView([20, 0], zoomLevel, { animate: true, duration: 1 });
}

zoomOutToGlobalView();

// Grab DOM refs after control is mounted
const questionEl = document.getElementById("question");
const flagEl = document.getElementById("flag");
const feedbackEl = document.getElementById("feedback");
const questionBoxEl = document.querySelector(".question-box");

// Initial placeholder and hide flag until real image loads
questionEl.textContent = "Loading…";
flagEl.style.display = "none";

// Kids Mode toggle
let kidsMode = false;
document.getElementById("kidsModeCheckbox").addEventListener("change", e => {
  kidsMode = e.target.checked;

  if (currentBaseLayer) {
    map.removeLayer(currentBaseLayer);
  }

  if (kidsMode) {
    currentBaseLayer = kidsLayer.addTo(map);
  }
  else {
    currentBaseLayer = adultLayer.addTo(map);
  }
});

// Per-country click handler
let isClickLocked = false;
const timeOut = 1000;
function onEachFeature(feature, layer) {
  layer.on('click', () => {
    if (!currentCountry ||
      isClickLocked ||
      (!remainingCountries.some(c => c.id === feature.id) && currentCountry.id !== feature.id))
      return;

    isClickLocked = true;
    total++;
    const isCorrect = feature.id === currentCountry.id;

    if (isCorrect) {
      correct++;
      addHistory(currentCountry.properties.name, true);
      layer.setStyle({ fillColor: "green", fillOpacity: 0.6 });

      showFeedback(true);
      // Delay 1s, then reset map and show next question
      setTimeout(() => {
        zoomOutToGlobalView();
        updateCounters();
        isClickLocked = false;
        // Show reward every 3 correct answers if enabled
        if (document.getElementById('rewardCheckbox').checked && correct % 3 === 0)
          showReward();
      }, timeOut);
    }
    else {
      wrong++;
      addHistory(currentCountry.properties.name, false);

      // Highlight and zoom to the correct country
      geojsonLayer.eachLayer(l => {
        if (l.feature.id === currentCountry.id) {
          l.setStyle({ fillColor: "red", fillOpacity: 0.6 });
          zoomInCountry(l);

          showFeedback(false);
          // After 1 second, reset to global view
          setTimeout(() => {
            zoomOutToGlobalView();
            updateCounters();
            isClickLocked = false;
          }, timeOut);
        }
      });
    }
  });
}

// Reward
async function showReward() {
  const imageUrl = await fetchRewardImage();

  let modal = document.getElementById('rewardModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rewardModal';
    modal.className = 'reward-modal';

    modal.innerHTML = `
      <div class="reward-modal-content">
        <span class="reward-close">&times;</span>
        <p class="reward-text">🎉Well Done!</p>
        <img id="rewardImage" src="" alt="Reward!" />
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.reward-close').onclick = () => {
      modal.style.display = "none";
    };

    // Close when clicking outside the modal content
    // window.onclick = (event) => {
    //   if (event.target === modal) {
    //     modal.style.display = "none";
    //   }
    // };
  }

  const img = modal.querySelector('#rewardImage');
  img.src = imageUrl;

  modal.style.display = "block";
}

let usedUrls = new Set();
async function fetchRewardImage() {
  const gifAPIs = [
    'https://cataas.com/cat/gif?json=true',
    'https://api.thecatapi.com/v1/images/search?mime_types=gif'
  ];

  while (true) {
    const api = gifAPIs[Math.floor(Math.random() * gifAPIs.length)];
    const res = await fetch(api);
    const data = await res.json();
    let url = '';

    if (api.includes('cataas')) url = data.url.startsWith('http') ? data.url : 'https://cataas.com' + data.url;
    else if (api.includes('thecatapi')) url = data[0].url;

    if (url && !url.match(/\.(mp4|webm|avi|mov)$/i) && !usedUrls.has(url)) {
      usedUrls.add(url);
      return url;
    }
  }
}

function nextQuestion() {
  // If no countries left → give a meessage and stop
  if (remainingCountries.length === 0) {
    questionEl.textContent = "🎉 Quiz completed! Reload the page to play again.";
    flagEl.style.display = "none";
    showReward();
    return;
  }

  // Pick a random country from the remaining list
  const idx = Math.floor(Math.random() * remainingCountries.length);
  currentCountry = remainingCountries[idx];

  // Remove the chosen country so it won't repeat
  remainingCountries.splice(idx, 1);

  const iso3 = currentCountry.id || currentCountry.properties?.iso_a3;
  const iso2 = iso3to2[iso3];

  // Fade out the whole question box (for smooth transition)
  questionBoxEl.classList.remove("visible");

  setTimeout(() => {
    // Update question text
    questionEl.textContent = "Where is " + currentCountry.properties.name + "?";

    // Update flag (show only if available)
    if (iso2) {
      flagEl.style.display = "none";
      flagEl.onload = () => {
        flagEl.style.display = "inline-block";
      };
      flagEl.onerror = () => {
        flagEl.style.display = "none";
      };
      flagEl.src = "https://flagcdn.com/w80/" + iso2 + ".png";
    } else {
      flagEl.style.display = "none";
      flagEl.removeAttribute("src");
    }

    // Fade in the updated question box
    questionBoxEl.classList.add("visible");
  }, 300); // match CSS fade-out duration
}

// Update counters panel
function updateCounters() {
  document.getElementById("total").textContent = total;
  document.getElementById("correct").textContent = correct;
  document.getElementById("wrong").textContent = wrong;
  document.getElementById("remaining").textContent = remainingCountries.length;
}

// History item: colored icon + plain text
function addHistory(countryName, isCorrect) {
  const li = document.createElement("li");

  const icon = document.createElement("span");
  icon.textContent = isCorrect ? "✔" : "✘";
  icon.className = isCorrect ? "correct" : "wrong";

  const text = document.createElement("span");
  text.textContent = " " + countryName;

  li.appendChild(icon);
  li.appendChild(text);
  document.getElementById("history").prepend(li);
}

// Feedback inside counters, then auto-next
function showFeedback(isCorrect) {
  feedbackEl.textContent = isCorrect ? "✔" : "✘";
  feedbackEl.style.color = isCorrect ? "green" : "red";
  feedbackEl.style.opacity = 1;
  feedbackEl.style.transform = "translateY(-55%) scale(1.2)";

  setTimeout(() => {
    feedbackEl.style.opacity = 0;
    feedbackEl.style.transform = "translateY(-55%) scale(1)";
    nextQuestion();
  }, 1000);
}
