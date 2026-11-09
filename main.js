const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
$('.burger')?.addEventListener('click',e=>{const o=$('.nav').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',o)});
$$('.tabs button').forEach(b=>b.onclick=()=>{$$('.tabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on')});
$$('.times button').forEach(b=>b.onclick=()=>{$$('.times button').forEach(x=>x.classList.remove('on'));b.classList.add('on');upd()});
$$('.zone').forEach(z=>z.onclick=()=>{$$('.zone').forEach(x=>x.classList.remove('on'));z.classList.add('on');upd()});
let g=4;const gv=$('#guests');
$$('[data-g]').forEach(b=>b.onclick=()=>{g=Math.max(1,Math.min(30,g+ +b.dataset.g));upd()});
$('#date')?.addEventListener('change',upd);
$$('.qa button').forEach(b=>b.onclick=()=>{const t=$('#wish');t.value=(t.value?t.value+' ':'')+b.textContent.replace('+ ','')});
function upd(){if(!gv)return;gv.textContent=g+(g===1?' гість':g<5?' гостя':' гостей');
const d=$('#date').value;$('#s-d').textContent=d?new Date(d).toLocaleDateString('uk-UA',{day:'numeric',month:'long',year:'numeric'}):'—';
$('#s-t').textContent=$('.times .on')?.textContent||'—';$('#s-g').textContent=g+' осіб';$('#s-z').textContent=$('.zone.on h3')?.textContent||'—'}
upd();
$$('form[data-ok]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();const b=$('button[type=submit]',f);b.textContent=f.dataset.ok;b.disabled=true}));

// ======================================
// ВІДЖЕТ ПОГОДИ ДЛЯ СТОРІНКИ БРОНЮВАННЯ
// ======================================

const weatherBookingDate = document.getElementById("date");
const weatherInfo = document.getElementById("weatherInfo");

// Перевіряємо, чи ми знаходимося на сторінці бронювання
if (weatherBookingDate && weatherInfo) {

    // Мінімальна дата бронювання — сьогодні
    const today = new Date();
    const todayString =
        today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");

    weatherBookingDate.min = todayString;

    // Якщо дата не вибрана, встановлюємо сьогоднішню
    if (!weatherBookingDate.value) {
        weatherBookingDate.value = todayString;
    }

    let bookingWeatherData = null;

    // Отримуємо прогноз погоди на 10 днів
    async function loadBookingWeather() {
        weatherInfo.textContent = "Завантаження прогнозу погоди...";

        try {
            const url =
                "https://api.open-meteo.com/v1/forecast" +
                "?latitude=46.30" +
                "&longitude=30.65" +
                "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
                "&forecast_days=10" +
                "&timezone=Europe%2FKyiv";

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error("Не вдалося отримати прогноз");
            }

            bookingWeatherData = await response.json();

            showBookingWeather(weatherBookingDate.value);

        } catch (error) {
            weatherInfo.textContent =
                "Не вдалося завантажити прогноз погоди. Спробуйте пізніше.";
        }
    }

    // Визначаємо опис погоди за кодом
    function getBookingWeatherDescription(code) {
        if (code === 0) return "☀️ Ясно";
        if (code === 1) return "🌤️ Переважно ясно";
        if (code === 2) return "⛅ Мінлива хмарність";
        if (code === 3) return "☁️ Хмарно";
        if (code === 45 || code === 48) return "🌫️ Туман";
        if (code >= 51 && code <= 67) return "🌧️ Дощ";
        if (code >= 71 && code <= 77) return "❄️ Сніг";
        if (code >= 80 && code <= 82) return "🌦️ Зливи";
        if (code >= 85 && code <= 86) return "🌨️ Снігопад";
        if (code >= 95) return "⛈️ Гроза";

        return "Погодні умови невідомі";
    }

    // Показуємо погоду для обраної дати
    function showBookingWeather(selectedDate) {

        if (!bookingWeatherData || !selectedDate) return;

        const daily = bookingWeatherData.daily;
        const dates = daily.time;

        let index = dates.indexOf(selectedDate);

        // Якщо обраної дати немає у прогнозі,
        // показуємо останній доступний день
        if (index === -1) {
            index = dates.length - 1;
        }

        const forecastDate = dates[index];

        const formattedDate = new Date(
            forecastDate + "T12:00:00"
        ).toLocaleDateString("uk-UA", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });

        const minTemp = daily.temperature_2m_min[index];
        const maxTemp = daily.temperature_2m_max[index];
        const rain = daily.precipitation_probability_max[index];

        const description = getBookingWeatherDescription(
            daily.weather_code[index]
        );

        weatherInfo.innerHTML = `
            <p>📅 Дата прогнозу: <b>${formattedDate}</b></p>

            <h2 class="weather-temperature">
                ${description}
            </h2>

            <p>
                🌡️ Температура:
                ${Math.round(minTemp)}°C – ${Math.round(maxTemp)}°C
            </p>

            <p>
                🌧️ Ймовірність опадів:
                ${rain === null ? "Немає даних" : rain + "%"}
            </p>
        `;
    }

    // Оновлюємо погоду при зміні дати
    weatherBookingDate.addEventListener("change", function () {
        showBookingWeather(this.value);
    });

    // Завантажуємо прогноз після відкриття сторінки
    loadBookingWeather();
}