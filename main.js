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

// =========================================================
// 4. ІНІЦІАЛІЗАЦІЯ VANILLA JS БІБЛІОТЕК (Swiper, Fancybox, Typed)
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Swiper.js v11 (Слайдер відгуків гостей)
  if (document.querySelector('.reviews-swiper') && typeof Swiper !== 'undefined') {
    new Swiper('.reviews-swiper', {
      loop: true,
      spaceBetween: 24,
      autoplay: {
        delay: 3500,
        disableOnInteraction: false,
        pauseOnMouseEnter: true
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true
      },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev'
      },
      breakpoints: {
        320: { slidesPerView: 1 },
        768: { slidesPerView: 2 },
        1024: { slidesPerView: 3 }
      }
    });
  }

  // 2. Fancybox v5 (Модальна галерея атмосфери комплексу)
  if (document.querySelector('[data-fancybox="afalina-gallery"]') && typeof Fancybox !== 'undefined') {
    Fancybox.bind('[data-fancybox="afalina-gallery"]', {
      Carousel: { Transition: 'fade' },
      Images: { Panzoom: { maxScale: 3 } }
    });
  }

  // 3. Typed.js (Ефект друкування слоганів у Hero-секції)
  const typedTarget = document.getElementById('typed-slogan');
  if (typedTarget && typeof Typed !== 'undefined') {
    typedTarget.textContent = '';
    new Typed('#typed-slogan', {
      strings: [
        'Море поруч. Смак у кожній миті. Ваш відпочинок на узбережжі Чорного моря.',
        'Свіжі чорноморські морепродукти, панорамна тераса та відкритий басейн.',
        'Ідеальне місце для сімейного вікенду, романтичної вечері або банкету.'
      ],
      typeSpeed: 45,
      backSpeed: 25,
      backDelay: 2500,
      loop: true
    });
  }
});
// =========================================================
// 5. ІНТЕРАКТИВНА СХЕМА ЗАЛУ ТА ВИБІР СТОЛИКА + EDGE CASES (ЛР №11)
// =========================================================
(function initInteractiveHallMap() {
  function runHallWidget() {
    const tablesGrid = document.getElementById('tablesGrid');
    const guestsInput = document.getElementById('guestsInput');
    const edgeErrorEl = document.getElementById('guestsEdgeError');
    const hallLandmarkEl = document.getElementById('hallLandmark');
    const onlyWindowCheck = document.getElementById('onlyWindowFilter');
    const summaryTableEl = document.getElementById('s-table');
    const summaryGuestsEl = document.getElementById('s-g');
    const hiddenTableInput = document.getElementById('selectedTableInput');
    const submitBtn = document.getElementById('bookingSubmitBtn');
    const zoneButtons = document.querySelectorAll('.zones .zone');
    const stepperBtns = document.querySelectorAll('.stepper button[data-g]');

    // Захист: якщо ми не на сторінці booking.html, безпечно виходимо
    if (!tablesGrid || !guestsInput || !edgeErrorEl) return;

    const HALL_CONFIG = {
      terrace: {
        landmark: '🌊 Перша лінія • Панорама Чорного моря',
        tables: [
          { num: 1, seats: 2, busy: false, panorama: true },
          { num: 2, seats: 2, busy: true,  panorama: true },
          { num: 3, seats: 4, busy: false, panorama: true },
          { num: 4, seats: 4, busy: false, panorama: false },
          { num: 5, seats: 6, busy: false, panorama: true },
          { num: 6, seats: 8, busy: false, panorama: false },
          { num: 7, seats: 4, busy: false, panorama: false },
          { num: 8, seats: 10, busy: false, panorama: true },
          { num: 9, seats: 12, busy: false, panorama: false }
        ]
      },
      hall: {
        landmark: '🍽️ Основна зала • Камін, жива музика та панорамні вікна',
        tables: [
          { num: 10, seats: 2, busy: false, panorama: true },
          { num: 11, seats: 4, busy: false, panorama: true },
          { num: 12, seats: 4, busy: true,  panorama: false },
          { num: 13, seats: 6, busy: false, panorama: true },
          { num: 14, seats: 6, busy: false, panorama: false },
          { num: 15, seats: 8, busy: false, panorama: false },
          { num: 16, seats: 10, busy: false, panorama: true },
          { num: 17, seats: 12, busy: false, panorama: false },
          { num: 18, seats: 4, busy: false, panorama: false }
        ]
      },
      pool: {
        landmark: '☀️ Лаунж біля басейну • Літній бар та м’які дивани',
        tables: [
          { num: 19, seats: 2, busy: false, panorama: true },
          { num: 20, seats: 4, busy: false, panorama: true },
          { num: 21, seats: 4, busy: false, panorama: false },
          { num: 22, seats: 6, busy: true,  panorama: true },
          { num: 23, seats: 6, busy: false, panorama: true },
          { num: 24, seats: 8, busy: false, panorama: false },
          { num: 25, seats: 10, busy: false, panorama: true },
          { num: 26, seats: 4, busy: false, panorama: false },
          { num: 27, seats: 12, busy: false, panorama: false }
        ]
      }
    };

    let activeZoneKey = 'terrace';
    let selectedTableNum = 3;

    function showEdgeError(message) {
      edgeErrorEl.textContent = message;
      if (message) {
        guestsInput.classList.add('is-invalid');
        guestsInput.setAttribute('aria-invalid', 'true');
        if (submitBtn) submitBtn.disabled = true;
      } else {
        guestsInput.classList.remove('is-invalid');
        guestsInput.removeAttribute('aria-invalid');
        if (submitBtn) submitBtn.disabled = false;
      }
    }

    function updateHallMap() {
      const zoneObj = HALL_CONFIG[activeZoneKey] || HALL_CONFIG.terrace;
      if (hallLandmarkEl) hallLandmarkEl.textContent = zoneObj.landmark;

      const rawValue = guestsInput.value.trim();
      const parsedGuests = Number(rawValue);
      let isValid = true;

      // Обробка Edge Cases: порожнє поле, NaN/Infinity, дроби, вихід за межі 1..12
      if (rawValue === '') {
        showEdgeError('Вкажіть кількість гостей (від 1 до 12 осіб).');
        isValid = false;
      } else if (!Number.isFinite(parsedGuests) || !Number.isInteger(parsedGuests)) {
        showEdgeError('Кількість гостей має бути цілим числом без літер та дробів.');
        isValid = false;
      } else if (parsedGuests < 1 || parsedGuests > 12) {
        showEdgeError('Допустима кількість гостей за одним столиком — від 1 до 12.');
        isValid = false;
      } else {
        showEdgeError('');
      }

      const panoramaOnly = Boolean(onlyWindowCheck && onlyWindowCheck.checked);

      // Автопідбір доступного столика, якщо поточний не підходить
      const currentTable = zoneObj.tables.find(t => t.num === selectedTableNum);
      const isCurrentAvailable = currentTable &&
        !currentTable.busy &&
        (!panoramaOnly || currentTable.panorama) &&
        (!isValid || currentTable.seats >= parsedGuests);

      if (!isCurrentAvailable) {
        const autoPick = zoneObj.tables.find(t =>
          !t.busy &&
          (!panoramaOnly || t.panorama) &&
          (!isValid || t.seats >= parsedGuests)
        );
        selectedTableNum = autoPick ? autoPick.num : null;
      }

      // Генерація кнопок столиків на схемі
      tablesGrid.innerHTML = '';
      zoneObj.tables.forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'table-node';

        const tooSmall = isValid && t.seats < parsedGuests;
        const hiddenByPanorama = panoramaOnly && !t.panorama;
        btn.disabled = !isValid || t.busy || tooSmall || hiddenByPanorama;

        if (t.num === selectedTableNum && !btn.disabled) {
          btn.classList.add('active');
        }

        const titleEl = document.createElement('strong');
        titleEl.textContent = `Стіл №${t.num}` + (t.panorama ? ' ★' : '');
        const descEl = document.createElement('span');
        descEl.textContent = t.busy ? 'Зайнятий' : `до ${t.seats} місць`;

        btn.appendChild(titleEl);
        btn.appendChild(descEl);

        btn.addEventListener('click', () => {
          selectedTableNum = t.num;
          updateHallMap();
        });

        tablesGrid.appendChild(btn);
      });

      // Оновлення блоку деталей бронювання справа
      if (!isValid || !selectedTableNum) {
        if (summaryTableEl) summaryTableEl.textContent = 'Не обрано';
        if (summaryGuestsEl && !isValid) summaryGuestsEl.textContent = '—';
        if (hiddenTableInput) hiddenTableInput.value = '';
        if (submitBtn) submitBtn.disabled = true;
        return;
      }

      const finalTable = zoneObj.tables.find(t => t.num === selectedTableNum);
      const labelText = `Стіл №${finalTable.num} (до ${finalTable.seats} місць)`;
      if (summaryTableEl) summaryTableEl.textContent = labelText;
      if (summaryGuestsEl) summaryGuestsEl.textContent = `${parsedGuests} ос.`;
      if (hiddenTableInput) hiddenTableInput.value = labelText;
    }

    guestsInput.addEventListener('input', updateHallMap);

    stepperBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.getAttribute('data-g'), 10) || 0;
        const current = parseInt(guestsInput.value, 10);
        const safeBase = Number.isInteger(current) ? current : 2;
        const nextVal = Math.min(12, Math.max(1, safeBase + delta));
        guestsInput.value = String(nextVal);
        updateHallMap();
      });
    });

    zoneButtons.forEach(zBtn => {
      zBtn.addEventListener('click', () => {
        zoneButtons.forEach(b => b.classList.remove('on'));
        zBtn.classList.add('on');
        activeZoneKey = zBtn.getAttribute('data-zone-key') || 'terrace';
        updateHallMap();
      });
    });

    if (onlyWindowCheck) {
      onlyWindowCheck.addEventListener('change', updateHallMap);
    }

    updateHallMap();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runHallWidget);
  } else {
    runHallWidget();
  }
})();