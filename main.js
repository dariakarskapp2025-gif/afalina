const $ = (s, r = document) => r.querySelector(s),
      $$ = (s, r = document) => [...r.querySelectorAll(s)];

// =========================================================
// ДАНІ ТЕЛЕГРАМ-БОТА ДЛЯ СПОВІЩЕНЬ
// =========================================================
const TELEGRAM_BOT_TOKEN = '9177271367:AAGsoDJ8jK9s6pF3tr-MVJHkrrSsV4SWtDQ';
const TELEGRAM_CHAT_ID = '1121199482';

// 1. Інтерактив меню
$('.burger')?.addEventListener('click', e => {
  const o = $('.nav').classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', o);
});

// =========================================================
// 2. ВІДЖЕТ ПОГОДИ (Open-Meteo API)
// =========================================================
const weatherBookingDate = document.getElementById("date");
const weatherInfo = document.getElementById("weatherInfo");

if (weatherBookingDate && weatherInfo) {
    const today = new Date();
    const todayString = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    weatherBookingDate.min = todayString;

    if (!weatherBookingDate.value) weatherBookingDate.value = todayString;

    let bookingWeatherData = null;

    async function loadBookingWeather() {
        weatherInfo.textContent = "Завантаження прогнозу погоди...";
        try {
            const url = "https://api.open-meteo.com/v1/forecast?latitude=46.30&longitude=30.65&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=10&timezone=Europe%2FKyiv";
            const response = await fetch(url);
            if (!response.ok) throw new Error("Помилка API");
            bookingWeatherData = await response.json();
            showBookingWeather(weatherBookingDate.value);
        } catch (error) {
            weatherInfo.textContent = "Прогноз погоди тимчасово недоступний.";
        }
    }

    function getBookingWeatherDescription(code) {
        if (code === 0) return "☀️ Ясно";
        if (code === 1) return "🌤️ Переважно ясно";
        if (code === 2) return "⛅ Мінлива хмарність";
        if (code === 3) return "☁️ Хмарно";
        if (code >= 51 && code <= 67) return "🌧️ Дощ";
        if (code >= 95) return "⛈️ Гроза";
        return "Погода сприятлива";
    }

    function showBookingWeather(selectedDate) {
        if (!bookingWeatherData || !selectedDate) return;
        const daily = bookingWeatherData.daily;
        const dates = daily.time;
        let index = dates.indexOf(selectedDate);
        if (index === -1) index = dates.length - 1;

        const forecastDate = dates[index];
        const formattedDate = new Date(forecastDate + "T12:00:00").toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
        const minTemp = daily.temperature_2m_min[index];
        const maxTemp = daily.temperature_2m_max[index];
        const description = getBookingWeatherDescription(daily.weather_code[index]);

        weatherInfo.innerHTML = `📅 Прогноз на ${formattedDate}: <b>${description}</b> (${Math.round(minTemp)}°C – ${Math.round(maxTemp)}°C)`;
    }

    weatherBookingDate.addEventListener("change", function () { showBookingWeather(this.value); });
    loadBookingWeather();
}

// =========================================================
// 3. ВАЛІДАЦІЯ ТА ВІДПРАВКА В TELEGRAM
// =========================================================

const REGEX_PHONE = /^\+380\d{9}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setError(input, message) {
  if (!input) return;
  input.classList.add('border-red-500', 'bg-red-50');
  input.classList.remove('border-green-500', 'bg-green-50');
  input.setAttribute('aria-invalid', 'true');
  
  const errEl = document.getElementById(input.id + 'Error');
  if (errEl) {
    errEl.textContent = message;
    errEl.classList.remove('hidden');
  }
}

function setSuccess(input) {
  if (!input) return;
  input.classList.remove('border-red-500', 'bg-red-50');
  input.classList.add('border-green-500', 'bg-green-50');
  input.setAttribute('aria-invalid', 'false');
  
  const errEl = document.getElementById(input.id + 'Error');
  if (errEl) {
    errEl.classList.add('hidden');
    errEl.textContent = '';
  }
}

function validateField(field) {
  const id = field.id;
  const val = field.value.trim();

  // 1. Перевірка імені (min 2 символи)
  if (id === 'username' || field.name === 'username') {
    if (val.length < 2) {
      setError(field, "Введіть ім'я та прізвище (не менше 2 символів)");
      return false;
    }
  } 
  // 2. Перевірка телефону (+380XXXXXXXXX)
  else if (id === 'phone' || field.type === 'tel') {
    let cleanPhone = val.replace(/\s+/g, '').replace(/[-()]/g, '');
    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      cleanPhone = '+38' + cleanPhone;
      field.value = cleanPhone;
    }
    if (!REGEX_PHONE.test(cleanPhone)) {
      setError(field, "Номер має бути у форматі +380XXXXXXXXX");
      return false;
    }
  } 
  // 3. Перевірка Email
  else if (id === 'email' || field.type === 'email') {
    if (!REGEX_EMAIL.test(val)) {
      setError(field, "Вкажіть коректну електронну пошту");
      return false;
    }
  } 
  // 4. Перевірка текстового повідомлення
  else if (id === 'message' || field.tagName === 'TEXTAREA') {
    if (val.length < 5) {
      setError(field, "Введіть повідомлення (не менше 5 символів)");
      return false;
    }
  }
  // 5. Перевірка чекбоксу згоди
  else if (field.type === 'checkbox') {
    if (!field.checked) {
      setError(field, "Необхідно погодитися з політикою конфіденційності");
      return false;
    }
  }

  setSuccess(field);
  return true;
}

const form = document.querySelector('form');

if (form) {
  const inputs = $$('input, textarea', form);

  inputs.forEach(input => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') validateField(input);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let isValid = true;

    // Перевіряємо всі поля перед відправкою
    inputs.forEach(input => {
      if (!validateField(input)) isValid = false;
    });

    if (!isValid) return;

    const submitBtn = $('#submitBtn') || $('button[type=submit]', form);
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Надсилання...';
    }

    const username = $('#username')?.value.trim() || '—';
    const phone = $('#phone')?.value.trim() || '—';
    const email = $('#email')?.value.trim() || '—';
    const date = $('#date')?.value || '—';
    const message = $('#message')?.value.trim() || '—';

    const textMessage = `
🔔 <b>НОВА ЗАЯВКА З САЙТУ «АФАЛІНА»!</b>

👤 <b>Гість:</b> ${username}
📞 <b>Телефон:</b> ${phone}
📧 <b>Email:</b> ${email}
📅 <b>Дата візиту:</b> ${date}
💬 <b>Повідомлення:</b>
${message}
    `;

    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: textMessage,
          parse_mode: 'HTML'
        })
      });

      if (response.ok) {
        alert('✅ Дякуємо! Ваша заявка успішно надіслана в Telegram!');
        form.reset();
        $$('.border-green-500', form).forEach(el => el.classList.remove('border-green-500', 'bg-green-50'));
      } else {
        alert('❌ Не вдалося надіслати. Перевірте, чи ви натиснули START у своєму боті в Telegram.');
      }
    } catch (err) {
      alert('❌ Збій мережі під час з’єднання з Telegram.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Надіслати повідомлення ↗';
      }
    }
  });
}
