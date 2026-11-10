const $ = (s, r = document) => r.querySelector(s),
      $$ = (s, r = document) => [...r.querySelectorAll(s)];

// =========================================================
// АДРЕСА CLOUDFLARE WORKER (токен бота більше НЕ зберігається в коді сайту)
// Встав сюди адресу свого воркера, наприклад: https://afalina-forms.твійнік.workers.dev
// =========================================================
const WORKER_URL = 'https://afalina-forms.daria-karska-pp-2025.workers.dev';

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
// 3. ВАЛІДАЦІЯ ФОРМ ТА ВІДПРАВКА В TELEGRAM (через Cloudflare Worker)
// =========================================================
// ---------- Валідація ----------
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function normPhone(v) {
  const d = v.replace(/[^\d+]/g, '');
  if (/^0\d{9}$/.test(d)) return '+38' + d;
  if (/^380\d{9}$/.test(d)) return '+' + d;
  return d;
}

const CHECKS = {
  name: v => /^\p{L}[\p{L}'’ʼ\- ]{1,59}$/u.test(v) ? '' : 'Лише літери (2–60 символів), без цифр і символів',
  phone: v => /^\+380\d{9}$/.test(normPhone(v)) ? '' : 'Формат: +380XXXXXXXXX або 0XXXXXXXXX',
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Вкажіть коректну пошту, напр. name@gmail.com',
  date: (v, el) => {
    if (!v) return 'Оберіть дату';
    const d = new Date(v + 'T00:00:00'), min = startOfToday();
    if (el.closest('form').dataset.type === 'banquet') min.setDate(min.getDate() + 1);
    if (isNaN(d)) return 'Некоректна дата';
    if (d < min) return el.closest('form').dataset.type === 'banquet' ? 'Оберіть дату не раніше завтрашньої' : 'Дата не може бути в минулому';
    if (d > addDays(startOfToday(), 365)) return 'Бронювання доступне не далі ніж на рік уперед';
    return '';
  },
  guests: v => /^\d+$/.test(v) && +v >= 5 && +v <= 200 ? '' : 'Кількість гостей: від 5 до 200',
  message: v => v.length >= 5 && v.length <= 1000 ? '' : 'Повідомлення: від 5 до 1000 символів',
  wish: v => v.length <= 500 ? '' : 'Не більше 500 символів',
  comment: v => v.length <= 1000 ? '' : 'Не більше 1000 символів'
};

function checkField(el) {
  const name = el.name, v = el.type === 'checkbox' ? '' : el.value.trim();
  let msg = '';
  if (el.type === 'checkbox') {
    if (el.required && !el.checked) msg = 'Потрібна ваша згода';
  } else if (!v) {
    if (el.required) msg = 'Заповніть це поле';
  } else if (CHECKS[name]) {
    msg = CHECKS[name](v, el);
  }
  showError(el, msg);
  return !msg;
}

function showError(el, msg) {
  const box = el.closest('.f, label') || el.parentNode;
  let err = $('.err', box);
  if (msg) {
    if (!err) { err = document.createElement('small'); err.className = 'err'; err.setAttribute('role', 'alert'); box.appendChild(err); }
    err.textContent = msg;
    el.classList.add('invalid');
    el.setAttribute('aria-invalid', 'true');
  } else {
    err?.remove();
    el.classList.remove('invalid');
    el.removeAttribute('aria-invalid');
  }
}

// ---------- Форми ----------
function setStatus(form, text, ok) {
  let s = $('.form-status', form);
  if (!s) {
    s = document.createElement('p');
    s.className = 'form-status';
    s.setAttribute('role', 'status');
    const btn = $('button[type=submit]', form);
    btn.parentNode.insertBefore(s, btn);
  }
  s.textContent = text;
  s.className = 'form-status ' + (ok ? 'ok' : 'bad');
}

const plural = n => n === 1 ? 'гість' : (n >= 2 && n <= 4) ? 'гості' : 'гостей';

$$('form[data-type]').forEach(form => {
  const type = form.dataset.type;
  form.noValidate = true;
  const fields = () => $$('input[name], select[name], textarea[name]', form).filter(e => e.name !== 'website');

  fields().forEach(el => {
    el.addEventListener('blur', () => checkField(el));
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (el.getAttribute('aria-invalid') === 'true') checkField(el);
    });
  });

  // мінімальна дата
  const dateEl = $('input[type=date]', form);
  if (dateEl) dateEl.min = iso(type === 'banquet' ? addDays(startOfToday(), 1) : startOfToday());

  // --- специфіка бронювання столика ---
  let guests = 4;
  if (type === 'booking') {
    if (dateEl && !dateEl.value) dateEl.value = iso(new Date());
    const sum = id => $('#' + id);
    const render = () => {
      $('#guests').textContent = guests + ' ' + plural(guests);
      const t = $('.times .on'), z = $('.zone.on h3');
      if (sum('s-g')) sum('s-g').textContent = guests + ' ' + plural(guests);
      if (sum('s-t')) sum('s-t').textContent = t ? t.textContent : '—';
      if (sum('s-z')) sum('s-z').textContent = z ? z.textContent : '—';
      if (sum('s-d')) sum('s-d').textContent = dateEl && dateEl.value
        ? new Date(dateEl.value + 'T12:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }) : '—';
    };
    $$('.stepper button', form).forEach(b => b.addEventListener('click', () => {
      guests = Math.min(20, Math.max(1, guests + (+b.dataset.g)));
      render();
    }));
    $$('.times button', form).forEach(b => b.addEventListener('click', () => {
      $$('.times button', form).forEach(x => x.classList.remove('on'));
      b.classList.add('on'); render();
    }));
    $$('.zone', form).forEach(b => b.addEventListener('click', () => {
      $$('.zone', form).forEach(x => x.classList.remove('on'));
      b.classList.add('on'); render();
    }));
    $$('.qa button', form).forEach(b => b.addEventListener('click', () => {
      const w = $('[name=wish]', form), t = b.textContent.replace('+', '').trim();
      if (w && !w.value.includes(t)) w.value = (w.value ? w.value + '. ' : '') + t;
    }));
    dateEl?.addEventListener('change', render);
    render();
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    let okAll = true, first = null;
    fields().forEach(el => { if (!checkField(el) && okAll) { okAll = false; first = el; } });

    // час посадки не в минулому, якщо дата — сьогодні
    if (type === 'booking' && okAll && dateEl.value === iso(new Date())) {
      const t = $('.times .on')?.textContent || '';
      const [h, m] = t.split(':').map(Number);
      const now = new Date();
      if (h * 60 + m <= now.getHours() * 60 + now.getMinutes()) {
        setStatus(form, 'Цей час уже минув. Оберіть пізніший час або іншу дату.', false);
        return;
      }
    }
    if (!okAll) { first?.focus(); setStatus(form, 'Перевірте, будь ласка, виділені поля.', false); return; }

    if (form.website?.value) { setStatus(form, form.dataset.ok || 'Дякуємо! Заявку надіслано', true); return; } // бот

    const key = 'sent_' + type;
    try {
      if (Date.now() - (+localStorage.getItem(key) || 0) < 30000) {
        setStatus(form, 'Зачекайте пів хвилини перед повторною відправкою.', false);
        return;
      }
    } catch (_) {}

    const data = {};
    fields().forEach(el => { data[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
    data.phone = normPhone(data.phone);
    if (type === 'booking') {
      data.guests = guests + ' ' + plural(guests);
      data.time = $('.times .on')?.textContent || '';
      data.zone = $('.zone.on h3')?.textContent || '';
    }

    const btn = $('button[type=submit]', form), label = btn.innerHTML;
    btn.disabled = true; btn.textContent = 'Надсилання…';
    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data, website: '' })
      });
      if (!res.ok) throw new Error(res.status);
      try { localStorage.setItem(key, Date.now()); } catch (_) {}
      setStatus(form, form.dataset.ok || 'Дякуємо! Заявку надіслано. Менеджер зв’яжеться з вами найближчим часом.', true);
      form.reset();
      if (type === 'booking') { guests = 4; $('#guests').textContent = '4 ' + plural(4); }
    } catch (err) {
      setStatus(form, 'Не вдалося надіслати. Спробуйте ще раз або зателефонуйте: +38 (048) 700–11–22', false);
    } finally {
      btn.disabled = false; btn.innerHTML = label;
    }
  });
});

// ---------- Перехід з кнопки «Розрахувати бенкет»: contacts.html?topic=banquet ----------
(function presetTopic() {
  const sel = $('form[data-type="contact"] select[name="topic"]');
  if (!sel) return;
  const map = { banquet: 'Банкет або свято', booking: 'Бронювання столика', pool: 'Басейн та шезлонги', kids: 'Дитяча кімната' };
  const want = map[new URLSearchParams(location.search).get('topic')];
  if (want) sel.value = want;
})();
