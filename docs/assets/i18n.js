/* Attendly demo — 3 til: uz (asl matn), en, ru.
   Asl matnlar o'zbekcha yozilgan; sahifa yuklanganda va DOM o'zgarganda matn tarjima qilinadi. */
(function () {
  const LANGS = { uz: "O'zbekcha", en: 'English', ru: 'Русский' };
  let lang = 'uz';
  try { lang = localStorage.getItem('attendly_lang') || 'uz'; } catch (e) {}
  if (!LANGS[lang]) lang = 'uz';
  window.LANG = lang;
  document.documentElement.lang = lang;

  /* [uz, en, ru] — to'liq tugun (butun matn shu bo'lsa) */
  const EXACT = [
    ['Umumiy', 'Overview', 'Обзор'], ['Guruhlar', 'Groups', 'Группы'], ['Jadval', 'Timetable', 'Расписание'], ['Xonalar', 'Rooms', 'Аудитории'],
    ['Fanlar', 'Subjects', 'Предметы'], ['Foydalanuvchilar', 'Users', 'Пользователи'], ['Takliflar', 'Invitations', 'Приглашения'],
    ['Hisobot', 'Report', 'Отчёт'], ['Audit log', 'Audit log', 'Журнал аудита'], ['Talabalar', 'Students', 'Студенты'],
    ["O'qituvchilar", 'Teachers', 'Преподаватели'], ['Darslar', 'Lessons', 'Занятия'], ['Davomat', 'Attendance', 'Посещаемость'],
    ['Shubhali', 'Suspicious', 'Подозрительные'], ['Talaba', 'Student', 'Студент'], ["O'qituvchi", 'Teacher', 'Преподаватель'],
    ['Starosta', 'Group leader', 'Староста'], ['Super admin', 'Super admin', 'Суперадмин'], ['Admin', 'Admin', 'Админ'],
    ['Guruh', 'Group', 'Группа'], ['Yil', 'Year', 'Год'], ['Kod', 'Code', 'Код'], ['Nomi', 'Name', 'Название'], ['Bino', 'Building', 'Корпус'],
    ['Xona', 'Room', 'Аудитория'], ['Fan', 'Subject', 'Предмет'], ['Rol', 'Role', 'Роль'], ['Login', 'Login', 'Логин'], ['Parol', 'Password', 'Пароль'],
    ['Ism', 'Name', 'Имя'], ['Izoh', 'Note', 'Заметка'], ['Havola', 'Link', 'Ссылка'], ['Holat', 'Status', 'Статус'], ['Usul', 'Method', 'Способ'],
    ['Masofa', 'Distance', 'Расстояние'], ['Vaqt', 'Time', 'Время'], ['Hodisa', 'Event', 'Событие'], ['Natija', 'Result', 'Результат'],
    ['Yozuv', 'Records', 'Записи'], ['Dars', 'Lesson', 'Занятие'], ['Sana', 'Date', 'Дата'], ['Kelgan', 'Present', 'Пришли'],
    ['Juftlik', 'Pair', 'Пара'], ['Juft.', 'Pair', 'Пара'], ['Yak', 'Sun', 'Вс'], ['Du', 'Mon', 'Пн'], ['Se', 'Tue', 'Вт'], ['Chor', 'Wed', 'Ср'],
    ['Pay', 'Thu', 'Чт'], ['Ju', 'Fri', 'Пт'], ['Sha', 'Sat', 'Сб'], ['Keldi', 'Present', 'Пришёл'], ['Kech', 'Late', 'Опоздал'],
    ['Kelmadi', 'Absent', 'Не пришёл'], ['Bekor', 'Cancel', 'Отмена'], ['Kutilmoqda', 'Waiting', 'Ожидается'], ['Faol', 'Active', 'Активно'],
    ['Ishlatilgan', 'Used', 'Использовано'], ['Yaratish', 'Create', 'Создать'], ["Qo'shish", 'Add', 'Добавить'], ["O'chirish", 'Delete', 'Удалить'],
    ['Tekshirish', 'Check', 'Проверить'], ['Tasdiqlash', 'Confirm', 'Подтвердить'], ['Kirish', 'Sign in', 'Войти'], ['Kirish →', 'Sign in →', 'Войти →'],
    ['Chiqish', 'Log out', 'Выйти'], ['Skanerlash', 'Scan', 'Сканировать'], ['Davomatim', 'My attendance', 'Моя посещаемость'], ['Profil', 'Profile', 'Профиль'],
    ['Tarix', 'History', 'История'], ['Onlayn', 'Online', 'Онлайн'], ['Laboratoriya', 'Laboratory', 'Лаборатория'], ['Asosiy bino', 'Main building', 'Главный корпус'],
    ['Zallar', 'Halls', 'Залы'], ['Prerecorded', 'Prerecorded', 'В записи'], ['Passkey', 'Passkey', 'Passkey'], ['Yuz shabloni', 'Face template', 'Шаблон лица'],
    ['Matematika 1', 'Mathematics 1', 'Математика 1'], ['Ingliz tili 1', 'English 1', 'Английский 1'], ['Fizika 1', 'Physics 1', 'Физика 1'],
    ['Dasturlash', 'Programming', 'Программирование'], ["ma'ruza", 'lecture', 'лекция'], ['amaliyot', 'practice', 'практика'],
    ['Jonli', 'Live', 'Онлайн-демо'], ['Himoya', 'Protection', 'Защита'], ['Olti qatlam', 'Six layers', 'Шесть уровней'], ['Guruhlar ', 'Groups', 'Группы'],
    ["Ro'yxatdan o'tish", 'Registration', 'Регистрация'], ['Ishga tushirish', 'Getting started', 'Запуск'], ['Test rejimi', 'Test mode', 'Тестовый режим'],
    ['demo', 'demo', 'демо'], ['1-kurs', '1st year', '1 курс'], ['2-kurs', '2nd year', '2 курс'], ['4-kurs', '4th year', '4 курс'],
    ['Aylanuvchi QR', 'Rotating QR', 'Меняющийся QR'], ['GPS geofence', 'GPS geofence', 'GPS-геозона'], ['Passkey (WebAuthn)', 'Passkey (WebAuthn)', 'Passkey (WebAuthn)'],
    ['Yuz tanish + liveness', 'Face recognition + liveness', 'Распознавание лица + liveness'], ['Qurilma barmoq izi', 'Device fingerprint', 'Отпечаток устройства'],
    ["O'qituvchi nazorati", 'Teacher oversight', 'Контроль преподавателя'], ['Sinab ko\'ring', 'Try it', 'Попробуйте'], ["Aldab ko'ring", 'Try to cheat', 'Попробуйте обмануть'],
    ['Urinishni tanlang', 'Choose an attempt', 'Выберите попытку'], ['Saytga qaytish', 'Back to the site', 'Возврат на сайт'], ['Telegram bot', 'Telegram bot', 'Telegram-бот'],
    ['va', 'and', 'и'], ['matn', 'text', 'текст'], ["o'zgartiring.", 'and change it.', 'и измените.'], ['Jonli demoni sinash', 'Try the live demo', 'Попробовать демо'],
  ];

  /* qism-matn (tugun ichida) — uzunroq iboralar birinchi bo'lib almashtiriladi */
  const PHR = [
    // umumiy
    ["DEMO — ma'lumot faqat sizning brauzeringizda saqlanadi", 'DEMO — data is stored only in your browser', 'ДЕМО — данные хранятся только в вашем браузере'],
    ['Demoni tiklash', 'Reset demo', 'Сбросить демо'],
    ["Demo ma'lumotlari boshlang'ich holatga qaytarilsinmi?", 'Reset demo data to its initial state?', 'Сбросить демо-данные в исходное состояние?'],
    ["Hozircha bo'sh", 'Nothing here yet', 'Пока пусто'],
    ['Admin panel', 'Admin panel', 'Панель администратора'], ["O'qituvchi paneli", 'Teacher panel', 'Панель преподавателя'],
    ['Starosta paneli', 'Group leader panel', 'Панель старосты'], ['Talaba paneli', 'Student panel', 'Панель студента'],
    ["O'chirilsinmi?", 'Delete?', 'Удалить?'], ['Saqlandi', 'Saved', 'Сохранено'],
    ["QR kod noto'g'ri", 'Invalid QR code', 'Неверный QR-код'], ['Dars topilmadi', 'Lesson not found', 'Занятие не найдено'],
    ["Qurilma soati noto'g'ri", 'Device clock is wrong', 'Неверное время на устройстве'],
    ['QR kod eskirgan — ekrandagi yangi kodni skanerlang', 'QR code expired — scan the new code on the screen', 'QR-код устарел — отсканируйте новый код на экране'],
    ['QR kod yaroqsiz', 'QR code is invalid', 'QR-код недействителен'],
    // admin
    ["So'nggi hodisalar", 'Recent events', 'Последние события'],
    ["Hali hodisa yo'q — talaba panelida davomat belgilab ko'ring", 'No events yet — mark attendance in the student panel', 'Событий пока нет — отметьте посещаемость в панели студента'],
    ['Qanday sinash', 'How to try it', 'Как попробовать'],
    ["→ O'qituvchi → dars oching.", '→ Teacher → open a lesson.', '→ Преподаватель → откройте занятие.'],
    ['Yangi tabda', 'In a new tab open the', 'В новой вкладке откройте'], ['kirish sahifasi', 'login page', 'страницу входа'],
    ['Yana bir tabda Talaba bilan kiring va QR ni skanerlang.', 'In another tab sign in as a Student and scan the QR.', 'В другой вкладке войдите как студент и отсканируйте QR.'],
    ["Bu yerda Hisobot va Audit logda natijani ko'ring.", 'Here, see the result in Report and Audit log.', 'Здесь смотрите результат в «Отчёте» и «Журнале аудита».'],
    ['Guruh kodi', 'Group code', 'Код группы'], ['Bu guruh bor', 'This group already exists', 'Такая группа уже есть'],
    ["Guruh qo'shildi:", 'Group added:', 'Группа добавлена:'], ['Taklif havolasi', 'Invite link', 'Ссылка-приглашение'],
    ["Xona qo'shildi:", 'Room added:', 'Аудитория добавлена:'], ['Geofence (m)', 'Geofence (m)', 'Геозона (м)'], ['Fan nomi', 'Subject name', 'Название предмета'],
    ['F.I.Sh.', 'Full name', 'Ф.И.О.'], ['Login band', 'Login is taken', 'Логин занят'], ["Foydalanuvchi qo'shildi:", 'User added:', 'Пользователь добавлен:'],
    ['Havola yaratish', 'Create link', 'Создать ссылку'], ['Taklif yaratildi:', 'Invitation created:', 'Приглашение создано:'], ["Havola yo'q", 'No links', 'Ссылок нет'],
    ["Guruhlar bo'yicha", 'By group', 'По группам'], ['Talabalar (eng past davomat birinchi)', 'Students (lowest attendance first)', 'Студенты (сначала с низкой посещаемостью)'],
    ["Hodisa yo'q", 'No events', 'Событий нет'],
    // teacher
    ['Bugungi darslar', "Today's lessons", 'Занятия сегодня'], ['Hafta jadvali', 'Weekly timetable', 'Расписание на неделю'], ['Yangi dars', 'New lesson', 'Новое занятие'],
    ['QR ekrani', 'QR screen', 'Экран QR'], ['Davomatni ochish', 'Open attendance', 'Открыть посещаемость'],
    ["Bugun darsingiz yo'q (yakshanba yoki dars tugagan). «Yangi dars» bo'limidan demo dars yarating.", 'No lessons today (Sunday or all finished). Create a demo lesson in «New lesson».', 'Сегодня занятий нет (воскресенье или всё закончилось). Создайте демо-занятие в разделе «Новое занятие».'],
    ['Dars ochildi:', 'Lesson opened:', 'Занятие открыто:'], ['Guruh(lar)', 'Group(s)', 'Группа(ы)'],
    ["— ma'ruza uchun bir nechtasini tanlang (Ctrl)", '— select several for a lecture (Ctrl)', '— для лекции выберите несколько (Ctrl)'],
    ['Kamida bitta guruh tanlang', 'Select at least one group', 'Выберите хотя бы одну группу'], ['Dars yaratildi', 'Lesson created', 'Занятие создано'],
    ['Yopilgan darslar', 'Closed lessons', 'Закрытые занятия'], ['← Darslar', '← Lessons', '← Занятия'],
    ['QR har', 'QR refreshes every', 'QR обновляется каждые'], ['soniyada yangilanadi', 'seconds', 'секунды'],
    ['Darsni yopish', 'Close lesson', 'Закрыть занятие'], ["Jonli ro'yxat", 'Live roster', 'Список в реальном времени'],
    ['Dars yopildi:', 'Lesson closed:', 'Занятие закрыто:'], ['Dars yopildi', 'Lesson closed', 'Занятие закрыто'],
    ['⚠ umumiy qurilma', '⚠ shared device', '⚠ общее устройство'], ['Bekor qilish', 'Revoke', 'Отменить'], ["Qo'lda belgilash", 'Mark manually', 'Отметить вручную'],
    ["qo'lda belgilandi", 'marked manually', 'отмечен вручную'], ['davomat bekor qilindi', 'attendance revoked', 'посещение отменено'],
    // student
    ['Davomatni belgilash', 'Mark attendance', 'Отметить посещаемость'],
    ["Haqiqiy ilovada kamera QR ni o'qiydi. Demoda ikki yo'l bor:", 'In the real app the camera reads the QR. In the demo there are two ways:', 'В настоящем приложении QR читает камера. В демо есть два способа:'],
    ["📷 Kamera bilan skanerlash (o'qituvchi tabidagi QR)", "📷 Scan with camera (QR from the teacher's tab)", '📷 Сканировать камерой (QR из вкладки преподавателя)'],
    ["Yoki kodni qo'lda kiriting (eski kodni sinab ko'rish uchun)", 'Or enter the code manually (to try an old code)', 'Или введите код вручную (чтобы проверить старый код)'],
    ["Kamera bilan bir marta skanerlang, so'ng 15 soniya kuting va «Tekshirish» ni bosing — kod eskirgan bo'ladi. Uzoqlikni «Uyda» deb tanlab ko'ring — GPS to'sadi.",
      'Scan once with the camera, wait 15 seconds, then press «Check» — the code will have expired. Choose «At home» for the location — GPS will block you.',
      'Отсканируйте один раз камерой, подождите 15 секунд и нажмите «Проверить» — код устареет. Выберите «Дома» в геопозиции — GPS не пропустит.'],
    ["O'qituvchi QR ekrani ochiq emas. Boshqa tabda o'qituvchi bilan kirib dars oching.", "The teacher's QR screen is not open. Sign in as a teacher in another tab and open a lesson.", 'Экран QR преподавателя не открыт. Войдите как преподаватель в другой вкладке и откройте занятие.'],
    ['QR rad etildi —', 'QR rejected —', 'QR отклонён —'], ['boshqa guruh darsi', "another group's lesson", 'занятие другой группы'],
    ['Bu dars sizning guruhingiz emas', 'This lesson is not for your group', 'Это занятие не для вашей группы'],
    ['Bu dars davomati yopilgan', 'Attendance for this lesson is closed', 'Посещаемость этого занятия закрыта'],
    ['Davomatingiz allaqachon belgilangan', 'Your attendance is already marked', 'Ваша посещаемость уже отмечена'],
    ['-juftlik · QR yoshi', 'th pair · QR age', '-я пара · возраст QR'], ["QR kod to'g'ri va yangi", 'QR code is valid and fresh', 'QR-код верный и свежий'],
    ['Joylashuv (GPS) — demo uchun tanlang:', 'Location (GPS) — choose for the demo:', 'Геопозиция (GPS) — выберите для демо:'],
    ['Auditoriyada (~35 m)', 'In the classroom (~35 m)', 'В аудитории (~35 м)'], ['Koridorda (~90 m)', 'In the corridor (~90 m)', 'В коридоре (~90 м)'],
    ['Uyda (~4 km)', 'At home (~4 km)', 'Дома (~4 км)'], ['Shaxsni tasdiqlash:', 'Verify identity:', 'Подтверждение личности:'],
    ['Passkey (Face ID / barmoq izi)', 'Passkey (Face ID / fingerprint)', 'Passkey (Face ID / отпечаток)'],
    ["Do'stimning yuzi (aldash)", "My friend's face (cheating)", 'Лицо друга (обман)'],
    ['geofence rad —', 'geofence rejected —', 'геозона отклонила —'], ['Siz auditoriyadan uzoqdasiz', 'You are too far from the classroom', 'Вы слишком далеко от аудитории'],
    ['🔐 Face ID tekshirilmoqda…', '🔐 Checking Face ID…', '🔐 Проверка Face ID…'],
    ['🙂 Markazga qarang… chapga buriling…', '🙂 Look straight… turn left…', '🙂 Смотрите прямо… поверните налево…'],
    ['Yuz mos kelmadi — bu sizning akkauntingiz emas', 'Face does not match — this is not your account', 'Лицо не совпало — это не ваш аккаунт'],
    ['Davomat oynasi yopildi', 'Attendance window closed', 'Окно посещаемости закрыто'], ['dars yopiq', 'lesson closed', 'занятие закрыто'],
    ['Davomatingiz belgilandi', 'Your attendance is marked', 'Ваша посещаемость отмечена'],
    ["⚠ Bu qurilmadan boshqa talaba ham belgilangan — o'qituvchiga belgi ketdi.", '⚠ Another student was marked from this device — the teacher has been flagged.', '⚠ С этого устройства уже отмечался другой студент — преподаватель получил пометку.'],
    ['— bu hafta', '— this week', '— эта неделя'], ['Davomat:', 'Attendance:', 'Посещаемость:'], ['Guruh:', 'Group:', 'Группа:'],
    ['Biriktirilgan:', 'Linked:', 'Привязано:'], ['Qurilma ID:', 'Device ID:', 'ID устройства:'],
    ["— bir brauzerdan ikki talaba belgilansa, o'qituvchiga ogohlantirish boradi.", '— if two students are marked from one browser, the teacher gets a warning.', '— если из одного браузера отметятся два студента, преподаватель получит предупреждение.'],
    ["Hali yozuv yo'q", 'No records yet', 'Записей пока нет'], ['davomat belgilandi', 'attendance marked', 'посещение отмечено'], ['(umumiy qurilma)', '(shared device)', '(общее устройство)'],
    ['QR eskirgan:', 'QR expired:', 'QR устарел:'], ["14 soniya o'tdi", '14 seconds passed', 'прошло 14 секунд'],
    // login
    ["DEMO — ro'yxatdan o'tish shart emas. Login va parol tayyor, \"Kirish\" tugmasini bosing.", 'DEMO — no registration needed. Login and password are ready, just press "Sign in".', 'ДЕМО — регистрация не нужна. Логин и пароль готовы, нажмите «Войти».'],
    ['← Bosh sahifa', '← Home', '← На главную'], ['Attendly demo', 'Attendly demo', 'Демо Attendly'],
    ["Har bir rol uchun alohida panel. O'qituvchi va talabani", 'A separate panel for each role. Open the teacher and the student', 'Отдельная панель для каждой роли. Откройте преподавателя и студента'],
    ['ikki alohida tabda', 'in two separate tabs:', 'в двух разных вкладках:'],
    ["oching: o'qituvchi QR ni ko'rsatadi, talaba uni skanerlaydi — jonli ishlaydi.", 'the teacher shows the QR, the student scans it — it works live.', 'преподаватель показывает QR, студент его сканирует — всё работает вживую.'],
    ["Guruh, xona, fan, foydalanuvchi, taklif havolalari, hisobot, audit log", 'Groups, rooms, subjects, users, invite links, reports, audit log', 'Группы, аудитории, предметы, пользователи, приглашения, отчёты, журнал аудита'],
    ["Dars ochish, aylanuvchi QR, jonli ro'yxat, bekor qilish", 'Open a lesson, rotating QR, live roster, revoke', 'Открытие занятия, меняющийся QR, живой список, отмена'],
    ['QR skanerlash, GPS, passkey/yuz, davomat tarixi', 'QR scan, GPS, passkey/face, attendance history', 'Сканирование QR, GPS, passkey/лицо, история посещений'],
    ['Login:', 'Login:', 'Логин:'], ['Parol:', 'Password:', 'Пароль:'], ['Boshqa hisob bilan kirish', 'Sign in with another account', 'Войти с другим аккаунтом'],
    ["Login yoki parol noto'g'ri", 'Wrong login or password', 'Неверный логин или пароль'],
    ["Qo'shimcha hisoblar: o'qituvchilar", 'More accounts: teachers', 'Другие аккаунты: преподаватели'], ['(parol', '(password', '(пароль'],
    ['); starosta', '); group leader', '); староста'], ["hisobi barcha darslarni ko'radi.", 'account sees all lessons.', 'видит все занятия.'],
    ['Talaba: CYB3-26 guruhi, 4 guruh, jami 113 talaba.', 'Student: group CYB3-26; 4 groups, 113 students in total.', 'Студент: группа CYB3-26; 4 группы, всего 113 студентов.'],
    // landing
    ["TTPU · Kiberxavfsizlik muhandisligi", 'TTPU · Cybersecurity Engineering', 'TTPU · Инженерия кибербезопасности'],
    ["Ro'yxatdan o'tish shart emas — login va parol kirish sahifasida tayyor.", 'No registration needed — login and password are ready on the sign-in page.', 'Регистрация не нужна — логин и пароль готовы на странице входа.'],
    ["Davomat tizimi, uning butun g'oyasi bitta jumlada:", 'An attendance system, its whole idea in one sentence:', 'Система посещаемости, вся идея в одном предложении:'],
    ['QR kod uch soniyada', 'The QR code', 'QR-код'], ["o'ladi", 'dies in three seconds', 'умирает за три секунды'],
    ["O'qituvchi ekranda kod ko'rsatadi, talaba skanerlaydi — telefon joylashuvni", 'The teacher shows a code on screen, the student scans it — the phone confirms the location', 'Преподаватель показывает код на экране, студент сканирует — телефон подтверждает геопозицию'],
    ["va shaxsni tasdiqlaydi. Do'stiga skrinshot yuborib ulgurmaydi.", "and the identity. There is no time to send a screenshot to a friend.", 'и личность. Скриншот другу отправить не успеть.'],
    ['QR haqiqatan aylanadi', 'The QR really rotates', 'QR действительно меняется'],
    ["Quyidagi kod o'qituvchi ekranidagi bilan bir xil", 'The code below is the same as on the teacher screen', 'Код ниже такой же, как на экране преподавателя'],
    ['formatda:', 'in the format:', 'в формате:'], ['dars.oyna.imzo', 'lesson.window.signature', 'занятие.окно.подпись'],
    ["Oyna raqami har uch soniyada o'sadi,", 'The window number grows every three seconds,', 'Номер окна растёт каждые три секунды,'],
    ["server esa oxirgi to'rt oynani qabul qiladi — ya'ni kod 9–12 soniya yashaydi.", 'and the server accepts the last four windows — so a code lives 9–12 seconds.', 'а сервер принимает последние четыре окна — то есть код живёт 9–12 секунд.'],
    ["O'qituvchi ekranining o'zi — ism skanerlangan zahoti shu ro'yxatda chiqadi.", "The teacher's screen itself — a name appears in this list the moment it is scanned.", 'Сам экран преподавателя — имя появляется в списке сразу после сканирования.'],
    ["To'rtta urinish — uchtasi haqiqiy tizimda ham rad etiladi. Bosing, server qanday javob berishini ko'rasiz.", 'Four attempts — three are rejected in the real system too. Click to see how the server responds.', 'Четыре попытки — три отклоняются и в настоящей системе. Нажмите, чтобы увидеть ответ сервера.'],
    ["Do'stimga skrinshot yuboraman", 'I send a screenshot to a friend', 'Отправляю скриншот другу'], ['U uyda, kodni telefonidan skanerlaydi', 'They are at home and scan the code from their phone', 'Он дома и сканирует код с телефона'],
    ['Uydan skanerlayman', 'I scan from home', 'Сканирую из дома'], ['Darsga bormay, yotgan joydan', 'Without going to class, from bed', 'Не ходя на занятие, лёжа дома'],
    ["Do'stim mening o'rnimga", 'My friend in my place', 'Друг вместо меня'], ["U auditoriyada, mening hisobimdan", 'They are in class, using my account', 'Он в аудитории, под моим аккаунтом'],
    ["O'zim, auditoriyada", "Myself, in the classroom", 'Я сам, в аудитории'], ["Qanday bo'lishi kerak bo'lsa shunday", 'The way it should work', 'Так, как должно быть'],
    ['Urinishni tanlang', 'Choose an attempt', 'Выберите попытку'],
    ["Har bir tugma haqiqiy serverning tekshiruv ketma-ketligini bosqichma-bosqich ko'rsatadi.", "Each button shows the real server's checks step by step.", 'Каждая кнопка шаг за шагом показывает проверки настоящего сервера.'],
    ["Har 3 soniyada yangi HMAC-imzolangan token, amal qilish muddati 9–12 soniya. Skrinshot yetib borguncha kod o'ladi.", 'A new HMAC-signed token every 3 seconds, valid for 9–12 seconds. The code dies before a screenshot arrives.', 'Каждые 3 секунды новый токен с HMAC-подписью, действует 9–12 секунд. Код умирает раньше, чем дойдёт скриншот.'],
    ["Auditoriya koordinatasidan belgilangan radius ichida. GPS aniqligi 100 m dan yomon bo'lsa qabul qilinmaydi; aniqlik masofadan chegiriladi, shunda adolatli bo'ladi.", 'Within the set radius of the classroom coordinates. GPS accuracy worse than 100 m is rejected; accuracy is subtracted from the distance to keep it fair.', 'В заданном радиусе от координат аудитории. Точность GPS хуже 100 м не принимается; точность вычитается из расстояния, чтобы было честно.'],
    ["Telefonning o'z Face ID / Touch ID si. Qurilmaga bog'langan, nusxalab bo'lmaydi, server hech qanday biometrik ma'lumot ko'rmaydi.", "The phone's own Face ID / Touch ID. Bound to the device, cannot be copied, the server sees no biometric data.", 'Собственные Face ID / Touch ID телефона. Привязаны к устройству, не копируются, сервер не видит биометрию.'],
    ["Telefon yo'q bo'lsa zaxira yo'l: boshqa qurilmadan o'z yuzi bilan kiradi. Tasodifiy harakat so'raladi (to'g'ri qarang → chapga buring), shuning uchun rasm ko'rsatish o'tmaydi. Rasm saqlanmaydi — faqat 512 ta son.", 'Fallback if there is no phone: sign in from another device with your own face. A random move is requested (look straight → turn left), so showing a photo fails. No image is stored — only 512 numbers.', 'Запасной путь без телефона: вход с другого устройства своим лицом. Запрашивается случайное движение (смотрите прямо → поверните налево), поэтому фото не пройдёт. Снимок не хранится — только 512 чисел.'],
    ["Bitta telefondan ikki talaba belgilansa — yozuv bayroqlanadi va o'qituvchiga ko'rinadi.", 'If two students are marked from one phone, the record is flagged and shown to the teacher.', 'Если с одного телефона отметятся два студента — запись помечается и видна преподавателю.'],
    ["Jonli ro'yxat, bir bosishda bekor qilish. Har bir urinish — muvaffaqiyatli yoki yo'q — sababi, IP si, masofasi bilan audit jurnaliga yoziladi.", 'Live roster, revoke in one click. Every attempt — successful or not — is written to the audit log with its reason, IP and distance.', 'Живой список, отмена в один клик. Каждая попытка — успешная или нет — записывается в журнал аудита с причиной, IP и расстоянием.'],
    ['Telegram orqali, bir marta', 'Via Telegram, once', 'Через Telegram, один раз'], ['Starosta havolasi', 'Group leader link', 'Ссылка старосты'], ['Botda ism-familiya', 'Full name in the bot', 'Имя и фамилия в боте'],
    ['Telefon raqam', 'Phone number', 'Номер телефона'], ["request_contact — qo'lda yozilmaydi", 'request_contact — not typed by hand', 'request_contact — не вводится вручную'],
    ['bir martalik, 10 daqiqa', 'one-time, 10 minutes', 'одноразовая, 10 минут'], ['Face ID + yuz zaxirasi', 'Face ID + face fallback', 'Face ID + запасное лицо'],
    ["Telefon raqam Telegram akkauntidan olinadi. Soxta raqam kiritib bo'lmaydi, chunki raqamni foydalanuvchi emas, Telegram yuboradi.", 'The phone number is taken from the Telegram account. A fake number cannot be entered, because Telegram sends it, not the user.', 'Номер телефона берётся из аккаунта Telegram. Ввести поддельный номер нельзя: его отправляет Telegram, а не пользователь.'],
    ["Telegram botisiz, parolsiz butun tizimni bosib ko'rish. GPS va biometrika baribir tekshiriladi — demo auditoriyani o'zingiz turgan nuqtaga ko'chirasiz.", 'Try the whole system without a Telegram bot or passwords. GPS and biometrics are still checked — you move the demo classroom to where you stand.', 'Попробуйте всю систему без Telegram-бота и паролей. GPS и биометрия всё равно проверяются — вы переносите демо-аудиторию туда, где стоите.'],
    ['Passkey va kamera HTTPS talab qiladi. Telefonda sinash uchun', 'Passkey and camera require HTTPS. To test on a phone run', 'Passkey и камера требуют HTTPS. Чтобы проверить на телефоне, запустите'],
    ["Bu sahifa — loyihaning statik ko'rgazmasi. Haqiqiy tizim", 'This page is a static showcase of the project. The real system runs on', 'Эта страница — статическая витрина проекта. Настоящая система работает на'],
    ["da ishlaydi, shuning uchun u serverga joylashtiriladi; bu yerdagi QR va tekshiruvlar brauzerda simulyatsiya qilingan.", ', so it is deployed on a server; the QR and checks here are simulated in the browser.', ', поэтому её размещают на сервере; QR и проверки здесь симулируются в браузере.'],
    ['Mamatqulov Zafar · Turin Polytechnic University in Tashkent', 'Mamatqulov Zafar · Turin Polytechnic University in Tashkent', 'Маматкулов Зафар · Туринский политехнический университет в Ташкенте'],
    ['Bekor qilindi', 'Revoked', 'Отменено'], ['Skrinshot olindi', 'Screenshot taken', 'Скриншот сделан'],
    ["Kod nusxalandi, do'stingizga yuborilmoqda…", 'The code was copied and is being sent to your friend…', 'Код скопирован и отправляется другу…'],
    ["Do'stingiz ochdi", 'Your friend opened it', 'Друг открыл'], ["Telegramda ko'rdi, skanerladi — 11 soniya o'tdi.", 'Saw it in Telegram, scanned — 11 seconds passed.', 'Увидел в Telegram, отсканировал — прошло 11 секунд.'],
    ['oyna farqi = 4 → qabul chegarasi 4', 'window difference = 4 → acceptance limit 4', 'разница окон = 4 → предел приёма 4'],
    ['Rad etildi — QR eskirgan', 'Rejected — QR expired', 'Отклонено — QR устарел'],
    ["Token oynasi serverning joriy oynasidan to'rt qadam orqada. Kod allaqachon o'lgan.", "The token window is four steps behind the server's current window. The code is already dead.", 'Окно токена отстаёт от текущего окна сервера на четыре шага. Код уже мёртв.'],
    ["«QR kod eskirgan — ekrandagi yangi kodni skanerlang»", '«QR code expired — scan the new code on the screen»', '«QR-код устарел — отсканируйте новый код на экране»'],
    ["Joylashuv so'ralmoqda", 'Requesting location', 'Запрос геопозиции'], ["Brauzer GPS ni o'qiyapti…", 'The browser is reading GPS…', 'Браузер считывает GPS…'],
    ['Koordinata olindi', 'Coordinates received', 'Координаты получены'], ["Server auditoriyagacha masofani hisoblayapti.", 'The server is calculating the distance to the classroom.', 'Сервер считает расстояние до аудитории.'],
    ['aniqlik 12 m', 'accuracy 12 m', 'точность 12 м'], ['Rad etildi — juda uzoq', 'Rejected — too far', 'Отклонено — слишком далеко'],
    ["Auditoriya A-301 dan 8 kilometr narida turibsiz. Geofence radiusi 120 metr.", 'You are 8 kilometres from classroom A-301. The geofence radius is 120 metres.', 'Вы в 8 километрах от аудитории A-301. Радиус геозоны — 120 метров.'],
    ['masofa ≈ 8025 m', 'distance ≈ 8025 m', 'расстояние ≈ 8025 м'], ["«Siz auditoriyadan uzoqdasiz (~8025 m)»", '«You are too far from the classroom (~8025 m)»', '«Вы слишком далеко от аудитории (~8025 м)»'],
    ["QR qabul qilindi", 'QR accepted', 'QR принят'], ["Do'stingiz auditoriyada, kod yangi. GPS o'tdi.", 'Your friend is in the classroom, the code is fresh. GPS passed.', 'Друг в аудитории, код свежий. GPS пройден.'],
    ['masofa ≈ 14 m · OK', 'distance ≈ 14 m · OK', 'расстояние ≈ 14 м · OK'], ['Shaxs tekshirilmoqda', 'Verifying identity', 'Проверка личности'],
    ["Bu qurilmada sizning passkey'ingiz yo'q — tizim yuz tekshiruviga o'tdi.", 'Your passkey is not on this device — the system switched to face verification.', 'На этом устройстве нет вашего passkey — система перешла к проверке лица.'],
    ["challenge: to'g'ri qarang → o'ngga buring", 'challenge: look straight → turn right', 'challenge: смотрите прямо → поверните направо'],
    ['Rad etildi — yuz mos kelmadi', 'Rejected — face does not match', 'Отклонено — лицо не совпало'],
    ["Kadrdagi yuz sizning shablonimdan uzoq. Do'stingiz o'z yuzi bilan sizning davomatingizni belgilay olmaydi.", 'The face in the frame is far from your template. Your friend cannot mark your attendance with their own face.', 'Лицо в кадре далеко от вашего шаблона. Друг не сможет отметить вашу посещаемость своим лицом.'],
    ['kosinus masofa 0.71 (chegara 0.38)', 'cosine distance 0.71 (limit 0.38)', 'косинусное расстояние 0.71 (предел 0.38)'],
    ['QR skanerlandi', 'QR scanned', 'QR отсканирован'], ["Imzo to'g'ri, oyna yangi.", 'Signature valid, window fresh.', 'Подпись верна, окно свежее.'],
    ['Joylashuv tasdiqlandi', 'Location confirmed', 'Геопозиция подтверждена'], ['A-301 dan 14 metr narida.', '14 metres from A-301.', 'В 14 метрах от A-301.'],
    ['masofa 14 m · radius 120 m · aniqlik 9 m', 'distance 14 m · radius 120 m · accuracy 9 m', 'расстояние 14 м · радиус 120 м · точность 9 м'],
    ["Face ID so'ralmoqda", 'Face ID requested', 'Запрос Face ID'], ['Telefoningiz imzolamoqda…', 'Your phone is signing…', 'Ваш телефон подписывает…'],
    ['Davomat belgilandi', 'Attendance marked', 'Посещение отмечено'], ["Ismingiz o'qituvchi ekranida paydo bo'ldi — yuqoridagi ro'yxatga qarang.", "Your name appeared on the teacher's screen — see the list above.", 'Ваше имя появилось на экране преподавателя — смотрите список выше.'],
    ['yosh 2s', 'age 2s', 'возраст 2с'], ['Dars ochildi', 'Lesson opened', 'Занятие открыто'],
  ];

  /* admin: darslar, xabarlar, chat, ro'yxatga olish */
  EXACT.push(
    ['Hammaga', 'Everyone', 'Всем'], ['Yangi', 'New', 'Новое'], ['Chat', 'Chat', 'Чат'], ['Xodimlar', 'Staff', 'Сотрудники'], ['Umumiy chat', 'General chat', 'Общий чат'],
    ['Yuborish', 'Send', 'Отправить'], ['Bugun', 'Today', 'Сегодня'], ['Yopilgan', 'Closed', 'Закрыто'], ['Ochiq', 'Open', 'Открыто'], ['Rejada', 'Planned', 'По плану'],
    ["Ro'yxat", 'Roster', 'Список'], ['Tahrirlash', 'Edit', 'Изменить'], ["Ma'ruza", 'Lecture', 'Лекция'], ['Amaliyot', 'Practice', 'Практика'], ['Turi', 'Type', 'Тип'],
    ["O'qituvchi", 'Teacher', 'Преподаватель'], ['Saqlash', 'Save', 'Сохранить'], ['Tozalash', 'Clear', 'Очистить'], ['Yopish', 'Close', 'Закрыть'], ['Kimga', 'To', 'Кому'],
    ['Sarlavha', 'Title', 'Заголовок'], ['Matn', 'Text', 'Текст'], ['Bildirishnoma', 'Notifications', 'Уведомления'], ['Yuborilganlar', 'Sent', 'Отправленные'],
    ["Ro'yxatda", 'Registered', 'В списке'], ['Chiqarish', 'Remove', 'Исключить'], ["Ro'yxatga olish", 'Register', 'Зарегистрировать'], ['Qo\'shish', 'Add', 'Добавить'],
    ['Kech', 'Late', 'Опоздал'], ['Bekor', 'Cancel', 'Отмена']);
  PHR.push(
    ['Xabarlar', 'Messages', 'Сообщения'], ["Xabarlar yo'q", 'No messages', 'Сообщений нет'], ["Hali xabar yo'q — birinchi bo'lib yozing", 'No messages yet — be the first to write', 'Сообщений пока нет — напишите первым'],
    ['Xabar yozing…', 'Write a message…', 'Напишите сообщение…'], ["Barcha o'qituvchilarga", 'All teachers', 'Всем преподавателям'], ['Guruh: ', 'Group: ', 'Группа: '],
    ["Dars o'chirilsinmi? Davomat yozuvlari ham o'chadi.", 'Delete the lesson? Attendance records will be deleted too.', 'Удалить занятие? Записи посещаемости тоже удалятся.'],
    ["Bu kunda dars yo'q — pastdagi forma yoki xona jadvalidan qo'shing", 'No lessons on this day — add one with the form or the room grid below', 'В этот день занятий нет — добавьте через форму или сетку аудиторий ниже'],
    ['Darsni tahrirlash', 'Edit lesson', 'Изменить занятие'], ["Yangi dars qo'shish", 'Add a new lesson', 'Добавить новое занятие'], ['Xona bandligi', 'Room availability', 'Занятость аудиторий'],
    ["Bo'sh katakni bosing — dars shu xona va juftlikka qo'yiladi.", 'Click an empty cell — the lesson is placed in that room and pair.', 'Нажмите на пустую ячейку — занятие будет поставлено в эту аудиторию и пару.'],
    ['Xona band:', 'Room is busy:', 'Аудитория занята:'], ["O'qituvchi band:", 'Teacher is busy:', 'Преподаватель занят:'], ['Guruh band:', 'Group is busy:', 'Группа занята:'],
    ["Dars o'chirildi:", 'Lesson deleted:', 'Занятие удалено:'], ["Dars o'zgartirildi:", 'Lesson changed:', 'Занятие изменено:'], ["Dars qo'shildi:", 'Lesson added:', 'Занятие добавлено:'],
    ['-juftlik', 'th pair', '-я пара'], ["Ro'yxat:", 'Roster:', 'Список:'], ["Hammasini ro'yxatga olish (keldi)", 'Register everyone (present)', 'Отметить всех (пришли)'],
    ["Hammasi ro'yxatga olindi", 'Everyone has been registered', 'Все отмечены'], ["ro'yxatga olindi", 'registered', 'зарегистрирован'], ["ro'yxatdan chiqarildi", 'removed from the roster', 'исключён из списка'],
    ['Bildirishnoma yuborish', 'Send a notification', 'Отправить уведомление'], ['Bildirishnoma yuborildi:', 'Notification sent:', 'Уведомление отправлено:'], ['Yuborildi ✅', 'Sent ✅', 'Отправлено ✅'],
    ['Hali xabar yuborilmagan', 'No messages sent yet', 'Сообщений пока не отправлено'],
    ["Ro'yxatda emas", 'Not registered', 'Не в списке'], ["Ro'yxatdan o'tish (passkey yaratish)", 'Register (create a passkey)', 'Зарегистрироваться (создать passkey)'],
    ["Siz ro'yxatga olinmagansiz — «Profil» bo'limida ro'yxatdan o'ting yoki admin ro'yxatga olsin", 'You are not registered — register in «Profile» or ask the admin to register you', 'Вы не зарегистрированы — зарегистрируйтесь в «Профиле» или попросите администратора'],
    ["Ro'yxatga olindingiz ✅", 'You are registered ✅', 'Вы зарегистрированы ✅'], ["ro'yxatdan o'tdi (passkey)", 'registered (passkey)', 'зарегистрировался (passkey)'],
    ["Ro'yxatga olish", 'Register', 'Зарегистрировать'], ['Admin:', 'Admin:', 'Админ:']);
  PHR.push(["ni o'zgartiring.", 'accordingly.', 'соответствующим образом.'], ['FastAPI va PostgreSQL', 'FastAPI and PostgreSQL', 'FastAPI и PostgreSQL'], ["Aldab ko'rish", 'Try to cheat', 'Попробуйте обмануть'], ['Matematika 1', 'Mathematics 1', 'Математика 1'], ['Ingliz tili 1', 'English 1', 'Английский 1'], ['Fizika 1', 'Physics 1', 'Физика 1'], ['Dasturlash', 'Programming', 'Программирование'],
    ["(ma'ruza)", '(lecture)', '(лекция)'], ['(amaliyot)', '(practice)', '(практика)'], ["guruh ro'yxatga olindi", 'groups registered', 'групп отмечено']);

  const REGEX = [
    [/([0-9]+)-para/, ['pair $1', '$1-я пара']],
    [/^(\d+) \/ (\d+) keldi$/, ['$1 / $2 present', '$1 / $2 пришли']],
    [/^(\d+) \/ (\d+) dars$/, ['$1 / $2 lessons', '$1 / $2 занятий']],
    [/^(\d+)-juftlik$/, ['pair $1', '$1-я пара']],
    [/Oqim darsi: (\d+) guruh bitta xonada — bitta QR hammaga/, ['Stream lesson: $1 groups in one room — one QR for everyone', 'Поток: $1 группы в одной аудитории — один QR на всех']],
    [/^oqim: /, ['stream: ', 'поток: ']],
    [/Siz auditoriyadan uzoqdasiz \(~(\d+) m\)/, ['You are too far from the classroom (~$1 m)', 'Вы слишком далеко от аудитории (~$1 м)']],
    [/^(\d+) soniya$/, ['$1 s', '$1 с']],
  ];

  const idx = lang === 'en' ? 1 : 2;
  const norm = s => s.replace(/[’ʻ‘`´]/g, "'").replace(/\s+/g, ' ');
  const exactMap = new Map(EXACT.map(r => [norm(r[0]).trim(), r[idx]]));
  const phr = PHR.map(r => [norm(r[0]), r[idx]]).sort((a, b) => b[0].length - a[0].length);
  const rx = REGEX.map(([re, t]) => [re, t[idx - 1]]);

  function tr(s) {
    if (lang === 'uz' || !s) return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
    let core = norm(s).trim();
    if (!core) return s;
    if (exactMap.has(core)) return lead + exactMap.get(core) + trail;
    let out = core;
    for (const [re, to] of rx) if (re.test(out)) out = out.replace(re, to);
    for (const [from, to] of phr) if (out.includes(from)) out = out.split(from).join(to);
    return out === core ? s : lead + out + trail;
  }
  window.tr = tr;

  function node(n) {
    if (n.nodeType === 3) {
      const p = n.parentNode && n.parentNode.nodeName;
      if (p === 'SCRIPT' || p === 'STYLE' || p === 'CODE' && false) return;
      if (n.__t === n.data) return;
      const v = tr(n.data); if (v !== n.data) n.data = v; n.__t = n.data;
    } else if (n.nodeType === 1) {
      if (n.nodeName === 'SCRIPT' || n.nodeName === 'STYLE') return;
      for (const a of ['placeholder', 'title', 'aria-label']) if (n.hasAttribute && n.hasAttribute(a)) { const o = n.getAttribute(a), v = tr(o); if (v !== o) n.setAttribute(a, v); }
      n.childNodes.forEach(node);
    }
  }

  if (lang !== 'uz') {
    const _c = window.confirm; window.confirm = m => _c.call(window, tr(m));
    const _a = window.alert; window.alert = m => _a.call(window, tr(m));
    const mo = new MutationObserver(ms => ms.forEach(m => {
      if (m.type === 'characterData') node(m.target);
      else m.addedNodes.forEach(node);
    }));
    const start = () => { node(document.body); document.title = tr(document.title); mo.observe(document.body, { childList: true, subtree: true, characterData: true }); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }

  /* til tanlagich */
  function widget() {
    const w = document.createElement('div');
    w.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:30;display:flex;gap:2px;background:var(--surface,#fff);border:1px solid var(--line,#ddd);border-radius:99px;padding:3px;box-shadow:0 1px 4px rgba(0,0,0,.12);font:600 12px system-ui,sans-serif';
    w.setAttribute('translate', 'no');
    Object.keys(LANGS).forEach(k => {
      const b = document.createElement('button'); b.textContent = k.toUpperCase(); b.title = LANGS[k];
      b.style.cssText = 'border:0;border-radius:99px;padding:4px 10px;cursor:pointer;font:inherit;color:' + (k === lang ? 'var(--accent-ink,#fff)' : 'var(--ink-2,#444)') + ';background:' + (k === lang ? 'var(--accent,#0f6b5f)' : 'transparent');
      b.onclick = () => { try { localStorage.setItem('attendly_lang', k); } catch (e) {} location.reload(); };
      w.appendChild(b);
    });
    document.documentElement.appendChild(w);
  }
  if (document.body) widget(); else document.addEventListener('DOMContentLoaded', widget);
})();
