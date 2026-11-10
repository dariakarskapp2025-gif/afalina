const $ = (s, r = document) => r.querySelector(s),
      $$ = (s, r = document) => [...r.querySelectorAll(s)];

// 1. Навігація та перемикачі
$('.burger')?.addEventListener('click', e => {
  const o = $('.nav').classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', o);
});

$$('.tabs button').forEach(b => b.onclick = () => {
  $$('.tabs button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
});

$$('.times button').forEach(b => b.onclick = () => {
  $$('.times button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  upd();
});

$$('.zone').forEach(z => z.onclick = () => {
  $$('.zone').forEach(x => x.classList.remove('on'));
  z.classList.add('on');
  upd();
});

let g = 4;
const gv = $('#guests');
$$('[data-g]').forEach(b => b.onclick = () => {
  g = Math.max(1, Math.min(30, g + +b.dataset.g));
  upd();
});

$('#date')?.addEventListener('change', upd);

$$('.qa button').forEach(b => b.onclick = () => {
  const t = $('#wish');
  if (t) t.value = (t.value ? t.value + ' ' : '') + b.textContent.replace('+ ', '');
});

function upd() {
  if (!gv) return;
  gv.textContent = g + (g === 1 ? ' гість' : g < 5 ? ' гостя' : ' гостей');
  const d = $('#date')?.value;
  if ($('#s-d')) $('#s-d').textContent = d ? new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  if ($('#s-t')) $('#s-t').textContent = $('.times .on')?.textContent || '—';
  if ($('#s-g')) $('#s-g').textContent = g + ' осіб';
  if ($('#s-z')) $('#s-z').textContent = $('.zone.on h3')?.textContent || '—';
}
upd();

// ======================================
// ВІДЖЕТ ПОГОДИ ДЛЯ СТОРІНКИ БРОНЮВАННЯ
// ======================================

const weatherBookingDate = document.getElementById("date");
const weatherInfo = document.getElementById("weatherInfo");

if (weatherBookingDate && weatherInfo) {
    const today = new Date();
    const todayString =
        today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");

    weatherBookingDate.min = todayString;

    if (!weatherBookingDate.value) {
        weatherBookingDate.value = todayString;
    }

    let bookingWeatherData = null;

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
            if (!response.ok) throw new Error("Не вдалося отримати прогноз");

            bookingWeatherData = await response.json();
            showBookingWeather(weatherBookingDate.value);

        } catch (error) {
            weatherInfo.textContent = "Не вдалося завантажити прогноз погоди. Спробуйте пізніше.";
        }
    }

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

    function showBookingWeather(selectedDate) {
        if (!bookingWeatherData || !selectedDate) return;

        const daily = bookingWeatherData.daily;
        const dates = daily.time;
        let index = dates.indexOf(selectedDate);

        if (index === -1) {
            index = dates.length - 1;
        }

        const forecastDate = dates[index];
        const formattedDate = new Date(forecastDate + "T12:00:00").toLocaleDateString("uk-UA", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });

        const minTemp = daily.temperature_2m_min[index];
        const maxTemp = daily.temperature_2m_max[index];
        const rain = daily.precipitation_probability_max[index];
        const description = getBookingWeatherDescription(daily.weather_code[index]);

        weatherInfo.innerHTML = `
            <p>📅 Дата прогнозу: <b>${formattedDate}</b></p>
            <h2 class="weather-temperature">${description}</h2>
            <p>🌡️ Температура: ${Math.round(minTemp)}°C – ${Math.round(maxTemp)}°C</p>
            <p>🌧️ Ймовірність опадів: ${rain === null ? "Немає даних" : rain + "%"}</p>
        `;
    }

    weatherBookingDate.addEventListener("change", function () {
        showBookingWeather(this.value);
    });

    loadBookingWeather();
}

// =========================================================
// ПЕРЕВІРКА КОРЕКТНОСТІ ДАНИХ (ВАЛІДАЦІЯ ФОРМ)
// =========================================================

// Регулярні вирази
const REGEX_PHONE = /^\+380\d{9}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Функція показу помилки
function setError(input, message) {
  if (!input) return;
  input.classList.add('border-red-500');
  input.classList.remove('border-green-500');
  input.setAttribute('aria-invalid', 'true');
  
  let errEl = document.getElementById(input.id + 'Error');
  if (errEl) {
    errEl.textContent = message;
    errEl.classList.remove('hidden');
  }
}

// Функція успішної перевірки
function setSuccess(input) {
  if (!input) return;
  input.classList.remove('border-red-500');
  input.classList.add('border-green-500');
  input.setAttribute('aria-invalid', 'false');
  
  let errEl = document.getElementById(input.id + 'Error');
  if (errEl) {
    errEl.classList.add('hidden');
    errEl.textContent = '';
  }
}

// Функція перевірки одного поля
function validateField(field) {
  const id = field.id;
  const val = field.value.trim();

  // 1. Перевірка імені (мінімум 2 символи)
  if (id === 'username' || field.name === 'username') {
    if (val.length < 2) {
      setError(field, "Ім'я має містити щонайменше 2 символи");
      return false;
    }
  } 
  // 2. Перевірка телефону (+380XXXXXXXXX та автоформат)
  else if (id === 'phone' || field.type === 'tel') {
    let cleanPhone = val.replace(/\s+/g, '').replace(/[-()]/g, '');
    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      cleanPhone = '+38' + cleanPhone;
      field.value = cleanPhone;
    }
    if (!REGEX_PHONE.test(cleanPhone)) {
      setError(field, "Введіть телефон у форматі +380XXXXXXXXX");
      return false;
    }
  } 
  // 3. Перевірка email
  else if (id === 'email' || field.type === 'email') {
    if (val && !REGEX_EMAIL.test(val)) {
      setError(field, "Введіть коректну електронну пошту");
      return false;
    }
  } 
  // 4. Перевірка чекбоксу згоди
  else if (field.type === 'checkbox') {
    if (!field.checked) {
      setError(field, "Необхідно погодитися з політикою конфіденційності");
      return false;
    }
  }

  setSuccess(field);
  return true;
}

// Підключення перевірки до всіх форм на сторінці
$$('form').forEach(form => {
  const inputs = $$('input, textarea', form);

  // Валідація при втраті фокусу (blur) та під час введення (input)
  inputs.forEach(input => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') {
        validateField(input);
      }
    });
  });

  // Перевірка при натисканні на кнопку надсилання (submit)
  form.addEventListener('submit', e => {
    e.preventDefault();
    let formIsValid = true;

    inputs.forEach(input => {
      if (!validateField(input)) {
        formIsValid = false;
      }
    });

    if (formIsValid) {
      showSuccessModal(form);
    }
  });
});

// Вікно успішного відправлення
function showSuccessModal(form) {
  let modal = $('#successModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'successModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl p-6 max-w-md w-full text-center shadow-2xl">
        <div class="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">✓</div>
        <h3 class="text-2xl font-bold text-gray-900 mb-2">Дякуємо!</h3>
        <p class="text-gray-600 text-sm mb-6">Ваші дані успішно пройшли перевірку. Адміністратор зателефонує вам найближчим часом.</p>
        <button id="closeModalBtn" class="w-full py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700">Зрозуміло</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.remove('hidden');

  const closeModal = () => {
    modal.classList.add('hidden');
    form.reset();
    if (typeof upd === 'function') upd();
    $$('.border-green-500', form).forEach(el => el.classList.remove('border-green-500'));
  };

  $('#closeModalBtn', modal).onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  document.onkeydown = (e) => { if (e.key === 'Escape') closeModal(); };
}