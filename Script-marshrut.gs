// ============================================
// BOTILOGISTICS DRIVERS CRM v2.1
// Єдиний Apps Script для драйверської апки
// ============================================
//
// ПІДКЛЮЧЕНІ ТАБЛИЦІ:
//   MARHRUT    — маршрути водіїв (Маршрут_*, Відправка_*, Витрати_*)
//   POSYLKI    — база посилок (Реєстрація ТТН УК-єв, Виклик Курєра ЄВ-ук)
//   PASSENGERS — база пасажирів (Україна-ЄВ, Європа-УК, Автопарк, Календар)
//   KLIYENTU   — клієнти + Відгуки + Чат + Бронювання + Замовлення
//   FINANCE    — платежі, зведення рейсів, розподіл, аналітика
//   ARCHIVE    — архів пасажирів/посилок/маршрутів + центральні Логи
//   CONFIG     — користувачі, персонал, доступи, налаштування
//
// СТРУКТУРА MARHRUT:
//   Маршрут_*    — пасажири + посилки (поле "Тип запису")
//   Відправка_*  — відправлення (read-only для водія крім додавання)
//   Витрати_*    — витрати водія
//   *_Шаблон     — шаблони, ігноруються
//   Зведення рейсів — ігнорується
// ============================================

// --- ID усіх таблиць ---
var SS = {
  MARHRUT:    '10SZhKV08BJyvWoMwhT0iddtWzYrDYFjCM8xgqViuE3Y',
  POSYLKI:    '1_vfEhdLEM2SVTBiu_3eDilMs1HlKxvPrJBbiHYjgrJo',
  PASSENGERS: '1lgaCHqWBIa6oFjFWfD8m58sLwbvQjmeje2gx3YAnBCo',
  KLIYENTU:   '1KW2Vh_E7OxggNB_NOzWmVM8siHzHr_mG8C939YXDC38',
  FINANCE:    '1AhID7Ust45sA4PCAUjWJz515qnxzQGSj5wGQ7K8Jbu0',
  ARCHIVE:    '19Ftljah5eX07RLHJaBrvYV7hStxspxcJVi6VATGZvF0',
  CONFIG:     '1hZ67tuQYukugO_TjNsOS3IjovBR5hWMg-JmGAq5udBE'
};

// Зворотна сумісність (використовується в існуючих функціях)
var SPREADSHEET_ID = SS.MARHRUT;

// Локальний лог-аркуш в MARHRUT (історія дій водія по рейсу — залишаємо для UI)
var SHEET_LOGS = 'Логи водіїв';
// Центральний аудит-лог в ARCHIVE (всі дії всіх користувачів)
var ARCHIVE_LOG_SHEET = 'Логи';

// Кеш відкритих таблиць у межах одного виклику
var _ssCache = {};
function openSS_(key) {
  if (_ssCache[key]) return _ssCache[key];
  var id = SS[key];
  if (!id) throw new Error('Unknown spreadsheet key: ' + key);
  _ssCache[key] = SpreadsheetApp.openById(id);
  return _ssCache[key];
}

var STATUS_COLORS = {
  'pending':     { bg: '#fffbf0', border: '#ffc107', font: '#ffc107' },
  'in-progress': { bg: '#e3f2fd', border: '#2196F3', font: '#2196F3' },
  'completed':   { bg: '#e8f5e9', border: '#4CAF50', font: '#4CAF50' },
  'cancelled':   { bg: '#ffebee', border: '#dc3545', font: '#dc3545' }
};

// ============================================
// КОЛОНКИ — Маршрут (50 колонок, A-AX)
// Пасажири та посилки в одному листі
// ============================================
var COL = {
  RTE_ID: 0,            // A
  TYPE: 1,              // B — "Пасажир" або "Посилка"
  DIRECTION: 2,         // C — Напрям
  SOURCE_SHEET: 3,      // D
  ITEM_ID: 4,           // E — PAX_ID / PKG_ID
  DATE_CREATED: 5,      // F
  DATE_TRIP: 6,         // G — Дата рейсу
  TIMING: 7,            // H
  AUTO_ID: 8,           // I
  AUTO_NUM: 9,          // J — Номер авто
  DRIVER: 10,           // K — Водій
  DRIVER_PHONE: 11,     // L
  CITY: 12,             // M — Місто
  SEAT: 13,             // N — Місце в авто
  PAX_NAME: 14,         // O — Піб пасажира
  PAX_PHONE: 15,        // P — Телефон пасажира
  ADDR_FROM: 16,        // Q — Адреса відправки
  ADDR_TO: 17,          // R — Адреса прибуття
  SEATS_COUNT: 18,      // S — Кількість місць
  BAGGAGE_WEIGHT: 19,   // T — Вага багажу
  SENDER_NAME: 20,      // U — Піб відправника
  RECIPIENT_NAME: 21,   // V — Піб отримувача
  RECIPIENT_PHONE: 22,  // W — Телефон отримувача
  RECIPIENT_ADDR: 23,   // X — Адреса отримувача
  INTERNAL_NUM: 24,     // Y — Внутрішній №
  TTN: 25,              // Z — Номер ТТН
  PKG_DESC: 26,         // AA — Опис посилки
  PKG_WEIGHT: 27,       // AB — Кг посилки
  AMOUNT: 28,           // AC — Сума
  CURRENCY: 29,         // AD — Валюта
  DEPOSIT: 30,          // AE — Завдаток
  DEPOSIT_CURRENCY: 31, // AF — Валюта завдатку
  PAY_FORM: 32,         // AG — Форма оплати
  PAY_STATUS: 33,       // AH — Статус оплати
  DEBT: 34,             // AI — Борг
  PAY_NOTE: 35,         // AJ — Примітка оплати
  STATUS: 36,           // AK — Статус (водій змінює)
  STATUS_CRM: 37,       // AL — Статус CRM
  TAG: 38,              // AM — Тег
  RATING_DRIVER: 39,    // AN
  COMMENT_DRIVER: 40,   // AO
  RATING_MANAGER: 41,   // AP
  COMMENT_MANAGER: 42,  // AQ
  NOTE: 43,             // AR — Примітка
  SMS_NOTE: 44,         // AS — Примітка СМС
  CLI_ID: 45,           // AT
  DATE_ARCHIVE: 46,     // AU
  ARCHIVED_BY: 47,      // AV
  ARCHIVE_REASON: 48,   // AW
  ARCHIVE_ID: 49        // AX
};
var TOTAL_COLS = 50;

// ============================================
// КОЛОНКИ — Відправка (28 колонок)
// ============================================
var COL_SHIP = {
  DISPATCH_ID: 0,       // A
  DATE_CREATED: 1,      // B
  RTE_ID: 2,            // C
  DATE_TRIP: 3,         // D
  AUTO_ID: 4,           // E
  AUTO_NUM: 5,          // F
  DRIVER: 6,            // G
  CLI_ID: 7,            // H
  SMART_ID: 8,          // I
  SENDER_PHONE: 9,      // J
  SENDER_NAME: 10,      // K
  RECIPIENT_NAME: 11,   // L
  RECIPIENT_PHONE: 12,  // M
  RECIPIENT_ADDR: 13,   // N
  INTERNAL_NUM: 14,     // O
  WEIGHT: 15,           // P
  DESCRIPTION: 16,      // Q
  PHOTO: 17,            // R
  AMOUNT: 18,           // S
  CURRENCY: 19,         // T
  DEPOSIT: 20,          // U
  DEPOSIT_CURRENCY: 21, // V
  PAY_FORM: 22,         // W
  PAY_STATUS: 23,       // X
  DEBT: 24,             // Y
  STATUS: 25,           // Z
  PKG_ID: 26,           // AA
  NOTE: 27              // AB
};
var TOTAL_COLS_SHIP = 28;

// ============================================
// КОЛОНКИ — Витрати (26 колонок)
// ============================================
var COL_EXP = {
  EXP_ID: 0,             // A
  RTE_ID: 1,             // B
  DATE_TRIP: 2,          // C
  AUTO_ID: 3,            // D
  AUTO_NUM: 4,           // E
  DRIVER: 5,             // F
  ADVANCE_CASH: 6,       // G — Аванс готівка
  ADVANCE_CASH_CUR: 7,   // H — Валюта авансу готівка
  ADVANCE_CARD: 8,       // I — Аванс картка
  ADVANCE_CARD_CUR: 9,   // J — Валюта авансу картка
  ADVANCE_REMAINING: 10,  // K — Залишок авансу
  FUEL: 11,              // L — Бензин
  FOOD: 12,              // M — Їжа
  PARKING: 13,           // N — Паркування
  TOLL: 14,              // O — Толл на дорозі
  FINE: 15,              // P — Штраф
  CUSTOMS: 16,           // Q — Митниця
  TOP_UP: 17,            // R — Поповнення рахунку
  OTHER: 18,             // S — Інше
  OTHER_DESC: 19,        // T — Опис інше
  PHOTO: 20,             // U — Фото чеків
  EXPENSE_CUR: 21,       // V — Валюта витрат
  TOTAL: 22,             // W — Всього витрат
  TIPS: 23,              // X — Чайові
  TIPS_CUR: 24,          // Y — Валюта чайових
  NOTE: 25               // Z — Примітка
};
var TOTAL_COLS_EXP = 26;

// Ігноровані листи
var EXCLUDE_PATTERNS = ['шаблон', 'зведення', 'логи', 'template'];

// ============================================
// doGet
// ============================================
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'health';
    var sheet = (e && e.parameter) ? (e.parameter.sheet || '') : '';

    switch (action) {
      case 'health':
        return respond({ success: true, version: '2.0', service: 'BotiLogistics Drivers CRM', timestamp: new Date().toISOString() });
      case 'getAvailableRoutes':
        return respond(getAvailableRoutes());
      case 'getPassengers':
        if (!sheet) return respond({ success: false, error: 'Не вказано sheet' });
        return respond(getPassengers(sheet));
      case 'getPackages':
        if (!sheet) return respond({ success: false, error: 'Не вказано sheet' });
        return respond(getPackages(sheet));
      case 'getShippingItems':
        if (!sheet) return respond({ success: false, error: 'Не вказано sheet' });
        return respond(getShippingItems(sheet));
      case 'getExpenses':
        if (!sheet) return respond({ success: false, error: 'Не вказано sheet' });
        return respond(getExpenses(sheet));
      default:
        return respond({ success: false, error: 'Невідома GET дія: ' + action });
    }
  } catch (err) {
    return respond({ success: false, error: err.toString() });
  }
}

// ============================================
// doPost
// ============================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respond({ success: false, error: 'Порожній запит (немає postData)' });
    }
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var payload = data.payload || data;

    switch (action) {
      case 'getAvailableRoutes':
        return respond(getAvailableRoutes());
      case 'getPassengers':
        return respond(getPassengers(payload.sheetName || ''));
      case 'getPackages':
        return respond(getPackages(payload.sheetName || ''));
      case 'getShippingItems':
        return respond(getShippingItems(payload.sheetName || ''));
      case 'updateDriverStatus':
        return respond(handleDriverStatusUpdate(data));
      case 'addRouteItem':
        return respond(handleAddRouteItem(data));
      case 'updateDriverFields':
        return respond(handleUpdateDriverFields(data));
      case 'getExpenses':
        return respond(getExpenses(payload.sheetName || ''));
      case 'addExpense':
        return respond(handleAddExpense(data));
      case 'deleteExpense':
        return respond(handleDeleteExpense(data));
      case 'updateAdvance':
        return respond(handleUpdateAdvance(data));
      case 'recordPayment':
        return respond(handleRecordPayment(data));
      case 'rateClient':
        return respond(handleRateClient(data));
      default:
        return respond({ success: false, error: 'Невідома дія: ' + action });
    }
  } catch (err) {
    return respond({ success: false, error: err.toString() });
  }
}

// ============================================
// getAvailableRoutes — динамічний список
// ============================================
// Маршрути відомі заздалегідь — не скануємо таблицю (занадто повільно)
var KNOWN_ROUTES = ['Маршрут_1', 'Маршрут_2', 'Маршрут_3'];
var KNOWN_SHIPPING = [
  { name: 'Відправка_1', label: 'Відправка 1' },
  { name: 'Відправка_2', label: 'Відправка 2' },
  { name: 'Відправка_3', label: 'Відправка 3' },
];

function getAvailableRoutes() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var routes = [];
  for (var i = 0; i < KNOWN_ROUTES.length; i++) {
    var count = 0, paxCount = 0, pkgCount = 0;
    try {
      var sheet = ss.getSheetByName(KNOWN_ROUTES[i]);
      if (sheet) {
        var lastRow = sheet.getLastRow();
        count = Math.max(0, lastRow - 1);
        if (count > 0) {
          var types = sheet.getRange(2, COL.TYPE + 1, count, 1).getValues();
          for (var t = 0; t < types.length; t++) {
            var tv = String(types[t][0] || '').toLowerCase();
            if (tv.indexOf('пасажир') >= 0) paxCount++;
            else if (tv.indexOf('посилк') >= 0) pkgCount++;
          }
        }
      }
    } catch (e) { /* sheet not found */ }
    routes.push({ name: KNOWN_ROUTES[i], count: count, paxCount: paxCount, pkgCount: pkgCount });
  }
  var shipping = [];
  for (var j = 0; j < KNOWN_SHIPPING.length; j++) {
    var sCount = 0;
    try {
      var sSheet = ss.getSheetByName(KNOWN_SHIPPING[j].name);
      if (sSheet) sCount = Math.max(0, sSheet.getLastRow() - 1);
    } catch (e) { /* sheet not found */ }
    shipping.push({ name: KNOWN_SHIPPING[j].name, label: KNOWN_SHIPPING[j].label, count: sCount });
  }
  return { success: true, routes: routes, shipping: shipping };
}

// ============================================
// Допоміжна — читає рядки одного типу з маршрутного листа
// typeFilter: 'пасажир' або 'посилка'
// ============================================
function isExcludedSheet_(name) {
  var lower = name.toLowerCase();
  for (var i = 0; i < EXCLUDE_PATTERNS.length; i++) {
    if (lower.indexOf(EXCLUDE_PATTERNS[i]) !== -1) return true;
  }
  return false;
}

function readRouteByType_(sheetName, typeFilter) {
  if (!sheetName) return { success: false, error: 'Не вказано маршрут' };
  if (isExcludedSheet_(sheetName)) return { success: false, error: 'Аркуш заборонено читати: ' + sheetName };

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Аркуш не знайдено: ' + sheetName };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, items: [], sheetName: sheetName };

  var readCols = Math.min(sheet.getLastColumn(), TOTAL_COLS);
  var data = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();
  var items = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var type = str(row[COL.TYPE]).toLowerCase();
    if (type !== typeFilter) continue;

    var itemId = str(row[COL.ITEM_ID]);
    if (!itemId) continue;

    var item = {
      rowNum: i + 2,
      rteId: str(row[COL.RTE_ID]),
      type: str(row[COL.TYPE]),
      direction: str(row[COL.DIRECTION]),
      itemId: itemId,
      dateCreated: str(row[COL.DATE_CREATED]),
      dateTrip: str(row[COL.DATE_TRIP]),
      timing: str(row[COL.TIMING]),
      autoNum: str(row[COL.AUTO_NUM]),
      driver: str(row[COL.DRIVER]),
      city: str(row[COL.CITY]),
      amount: str(row[COL.AMOUNT]),
      currency: str(row[COL.CURRENCY]),
      deposit: str(row[COL.DEPOSIT]),
      depositCurrency: str(row[COL.DEPOSIT_CURRENCY]),
      payForm: str(row[COL.PAY_FORM]),
      payStatus: str(row[COL.PAY_STATUS]),
      debt: str(row[COL.DEBT]),
      payNote: str(row[COL.PAY_NOTE]),
      status: str(row[COL.STATUS]) || 'pending',
      statusCrm: str(row[COL.STATUS_CRM]),
      tag: str(row[COL.TAG]),
      note: str(row[COL.NOTE]),
      smsNote: str(row[COL.SMS_NOTE]),
      sheet: sheetName
    };

    if (typeFilter === 'пасажир') {
      item.name = str(row[COL.PAX_NAME]);
      item.phone = str(row[COL.PAX_PHONE]);
      item.addrFrom = str(row[COL.ADDR_FROM]);
      item.addrTo = str(row[COL.ADDR_TO]);
      item.seatsCount = str(row[COL.SEATS_COUNT]);
      item.baggageWeight = str(row[COL.BAGGAGE_WEIGHT]);
      item.seat = str(row[COL.SEAT]);
    } else {
      item.senderName = str(row[COL.SENDER_NAME]);
      item.recipientName = str(row[COL.RECIPIENT_NAME]);
      item.recipientPhone = str(row[COL.RECIPIENT_PHONE]);
      item.recipientAddr = str(row[COL.RECIPIENT_ADDR]);
      item.internalNum = str(row[COL.INTERNAL_NUM]);
      item.ttn = str(row[COL.TTN]);
      item.pkgDesc = str(row[COL.PKG_DESC]);
      item.pkgWeight = str(row[COL.PKG_WEIGHT]);
    }

    items.push(item);
  }

  return { success: true, items: items, count: items.length, sheetName: sheetName };
}

function getPassengers(sheetName) {
  return readRouteByType_(sheetName, 'пасажир');
}

function getPackages(sheetName) {
  return readRouteByType_(sheetName, 'посилка');
}

// ============================================
// getShippingItems — відправка (read-only)
// ============================================
function getShippingItems(sheetName) {
  try {
    if (!sheetName) return { success: false, error: 'Не вказано маршрут' };
    if (isExcludedSheet_(sheetName)) return { success: false, error: 'Аркуш заборонено читати: ' + sheetName };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, error: 'Аркуш не знайдено: ' + sheetName };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, items: [], count: 0, sheetName: sheetName };

    // Знаходимо реальний останній рядок через DISPATCH_ID (A)
    var idCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var realLast = 0;
    for (var t = 0; t < idCol.length; t++) {
      if (String(idCol[t][0] || '').trim()) realLast = t + 1;
    }
    if (realLast === 0) return { success: true, items: [], count: 0, sheetName: sheetName };

    var readCols = Math.min(sheet.getLastColumn(), TOTAL_COLS_SHIP);
    var data = sheet.getRange(2, 1, realLast, readCols).getValues();
    var items = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var senderName = str(row[COL_SHIP.SENDER_NAME]);
      var dispatchId = str(row[COL_SHIP.DISPATCH_ID]);
      if (!senderName && !dispatchId) continue;

      items.push({
        rowNum: i + 2,
        dispatchId: dispatchId,
        dateCreated: str(row[COL_SHIP.DATE_CREATED]),
        dateTrip: str(row[COL_SHIP.DATE_TRIP]),
        autoNum: str(row[COL_SHIP.AUTO_NUM]),
        driver: str(row[COL_SHIP.DRIVER]),
        senderPhone: str(row[COL_SHIP.SENDER_PHONE]),
        senderName: senderName,
        recipientName: str(row[COL_SHIP.RECIPIENT_NAME]),
        recipientPhone: str(row[COL_SHIP.RECIPIENT_PHONE]),
        recipientAddr: str(row[COL_SHIP.RECIPIENT_ADDR]),
        internalNum: str(row[COL_SHIP.INTERNAL_NUM]),
        weight: str(row[COL_SHIP.WEIGHT]),
        description: str(row[COL_SHIP.DESCRIPTION]),
        photo: str(row[COL_SHIP.PHOTO]),
        amount: str(row[COL_SHIP.AMOUNT]),
        currency: str(row[COL_SHIP.CURRENCY]),
        deposit: str(row[COL_SHIP.DEPOSIT]),
        depositCurrency: str(row[COL_SHIP.DEPOSIT_CURRENCY]),
        payForm: str(row[COL_SHIP.PAY_FORM]),
        payStatus: str(row[COL_SHIP.PAY_STATUS]),
        debt: str(row[COL_SHIP.DEBT]),
        status: str(row[COL_SHIP.STATUS]),
        pkgId: str(row[COL_SHIP.PKG_ID]),
        note: str(row[COL_SHIP.NOTE]),
        sheet: sheetName
      });
    }

    return { success: true, items: items, count: items.length, sheetName: sheetName };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// handleDriverStatusUpdate — водій змінює "Статус" (col AK)
// Шукає за ITEM_ID (PAX_ID / PKG_ID)
// ============================================
var VALID_STATUSES = ['pending', 'in-progress', 'completed', 'cancelled'];

function handleDriverStatusUpdate(data) {
  try {
    // Валідація статусу
    if (!data.status || VALID_STATUSES.indexOf(data.status) === -1) {
      return { success: false, error: 'Невалідний статус: ' + (data.status || '(пусто)') + '. Допустимі: ' + VALID_STATUSES.join(', ') };
    }

    // Валідація маршруту — дозволяємо Маршрут_* та Відправка_*
    var routeName = data.routeName || '';
    var isShipping = routeName.indexOf('Відправка_') === 0;
    if (!routeName || (!isShipping && !/^Маршрут_\d+$/.test(routeName))) {
      return { success: false, error: 'Невалідний маршрут: ' + (routeName || '(пусто)') };
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var now = new Date();

    // Логуємо
    var logSheet = ss.getSheetByName(SHEET_LOGS);
    if (!logSheet) {
      logSheet = ss.insertSheet(SHEET_LOGS);
      logSheet.getRange(1, 1, 1, 9).setValues([[
        'Дата', 'Час', 'Водій', 'Маршрут', 'ID запису',
        'Тип', 'Статус', 'Причина', 'Телефон'
      ]]);
      logSheet.getRange(1, 1, 1, 9)
        .setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }

    logSheet.appendRow([
      Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd'),
      Utilities.formatDate(now, 'Europe/Kiev', 'HH:mm:ss'),
      data.driverId || '',
      routeName,
      data.itemId || '',
      data.itemType || '',
      data.status || '',
      data.cancelReason || '',
      data.phone || ''
    ]);
    writeAuditLog_({
      who: data.driverId || data.driverName || '', role: 'driver',
      action: 'updateStatus', table: 'MARHRUT', sheet: routeName,
      recordId: data.itemId || '', field: 'Статус',
      newValue: data.status || '',
      note: data.cancelReason || ''
    });

    var targetSheet = ss.getSheetByName(routeName);
    if (!targetSheet) return { success: true, message: 'Логовано (аркуш не знайдено)' };

    var allData = targetSheet.getDataRange().getValues();
    var rowsUpdated = 0;
    var targetId = str(data.itemId);

    // Для Відправка шукаємо по DISPATCH_ID (col A), для Маршрут — по ITEM_ID (col E)
    var idCol = isShipping ? COL_SHIP.DISPATCH_ID : COL.ITEM_ID;
    var statusCol = isShipping ? COL_SHIP.STATUS : COL.STATUS;
    var noteCol = isShipping ? COL_SHIP.NOTE : COL.NOTE;
    var totalCols = isShipping ? TOTAL_COLS_SHIP : TOTAL_COLS;

    for (var i = 1; i < allData.length; i++) {
      var rowId = str(allData[i][idCol]);
      if (rowId === targetId) {
        var rowNum = i + 1;

        targetSheet.getRange(rowNum, statusCol + 1).setValue(data.status);

        if (data.status === 'cancelled' && data.cancelReason) {
          var currentNote = str(targetSheet.getRange(rowNum, noteCol + 1).getValue());
          var newNote = 'Скасовано: ' + data.cancelReason + (currentNote ? ' | ' + currentNote : '');
          targetSheet.getRange(rowNum, noteCol + 1).setValue(newNote);
        }

        var colors = STATUS_COLORS[data.status];
        if (colors) {
          var readCols = Math.min(targetSheet.getLastColumn(), totalCols);
          var rangeToColor = targetSheet.getRange(rowNum, 1, 1, readCols);
          rangeToColor.setBackground(colors.bg);
          rangeToColor.setBorder(true, true, true, true, true, true, colors.border, SpreadsheetApp.BorderStyle.SOLID);
          var statusCell = targetSheet.getRange(rowNum, statusCol + 1);
          statusCell.setFontColor(colors.font);
          statusCell.setFontWeight('bold');
        }

        rowsUpdated++;
        break;
      }
    }

    if (rowsUpdated === 0) return { success: true, message: 'Логовано (запис не знайдено)' };
    return { success: true, message: 'Статус записано', updatedRows: rowsUpdated };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// handleAddRouteItem — водій додає пасажира або посилку
// ============================================
function handleAddRouteItem(data) {
  try {
    var routeName = data.routeName;
    if (!routeName || !/^Маршрут_\d+$/.test(routeName)) {
      return { success: false, error: 'Невалідний маршрут: ' + (routeName || '(пусто)') };
    }

    var itemType = (data.itemType || '').toLowerCase();
    if (itemType !== 'пасажир' && itemType !== 'посилка') {
      return { success: false, error: 'Невалідний тип: ' + (data.itemType || '(пусто)') };
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    var now = new Date();
    var dateStr = Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd');
    var timeStr = Utilities.formatDate(now, 'Europe/Kiev', 'HH:mm:ss');

    var direction = (data.direction || '').toLowerCase();
    var isShipping = itemType === 'посилка' && direction === 'відправка';

    if (isShipping) {
      // Пишемо у Відправка_N
      var shipSheetName = routeName.replace('Маршрут_', 'Відправка_');
      var shipSheet = ss.getSheetByName(shipSheetName);
      if (!shipSheet) return { success: false, error: 'Аркуш не знайдено: ' + shipSheetName };

      var dispatchId = 'DISP_' + dateStr.replace(/-/g, '') + '_' + timeStr.replace(/:/g, '');

      var shipRow = new Array(TOTAL_COLS_SHIP).fill('');
      shipRow[COL_SHIP.DISPATCH_ID] = dispatchId;
      shipRow[COL_SHIP.DATE_CREATED] = dateStr;
      shipRow[COL_SHIP.DATE_TRIP] = data.dateTrip || '';
      shipRow[COL_SHIP.DRIVER] = data.driverName || '';
      shipRow[COL_SHIP.SENDER_PHONE] = data.senderPhone || '';
      shipRow[COL_SHIP.SENDER_NAME] = data.senderName || '';
      shipRow[COL_SHIP.RECIPIENT_NAME] = data.recipientName || '';
      shipRow[COL_SHIP.RECIPIENT_PHONE] = data.recipientPhone || '';
      shipRow[COL_SHIP.RECIPIENT_ADDR] = data.recipientAddr || '';
      shipRow[COL_SHIP.INTERNAL_NUM] = data.internalNum || '';
      shipRow[COL_SHIP.WEIGHT] = data.pkgWeight || '';
      shipRow[COL_SHIP.DESCRIPTION] = data.pkgDesc || '';
      shipRow[COL_SHIP.AMOUNT] = data.amount || '';
      shipRow[COL_SHIP.CURRENCY] = data.currency || 'CHF';
      shipRow[COL_SHIP.DEPOSIT] = data.deposit || '';
      shipRow[COL_SHIP.DEPOSIT_CURRENCY] = data.depositCurrency || 'CHF';
      shipRow[COL_SHIP.PAY_FORM] = data.payForm || '';
      shipRow[COL_SHIP.DEBT] = data.paymentAmount || '';
      shipRow[COL_SHIP.STATUS] = 'pending';
      // Compose note: include pieces count if provided
      var shipNote = data.note || '';
      if (data.pkgPieces) {
        shipNote = 'К-сть місць: ' + data.pkgPieces + (shipNote ? ' | ' + shipNote : '');
      }
      shipRow[COL_SHIP.NOTE] = shipNote;

      shipSheet.appendRow(shipRow);

      // Логуємо
      var logSheet = ss.getSheetByName(SHEET_LOGS);
      if (logSheet) {
        logSheet.appendRow([
          dateStr, timeStr, data.driverName || '', routeName, dispatchId,
          'відправка', 'added', '', ''
        ]);
      }
      writeAuditLog_({
        who: data.driverName || '', role: 'driver', action: 'addShipping',
        table: 'MARHRUT', sheet: shipSheetName, recordId: dispatchId,
        newValue: (data.internalNum || '') + ' ' + (data.recipientName || '')
      });

      return { success: true, message: 'Додано відправку', itemId: dispatchId };
    }

    // Стандартний запис у Маршрут_N (пасажир або посилка-отримання)
    var sheet = ss.getSheetByName(routeName);
    if (!sheet) return { success: false, error: 'Аркуш не знайдено: ' + routeName };

    var prefix = itemType === 'пасажир' ? 'PAX' : 'PKG';
    var itemId = prefix + '_' + dateStr.replace(/-/g, '') + '_' + timeStr.replace(/:/g, '');

    var row = new Array(TOTAL_COLS).fill('');
    row[COL.TYPE] = itemType === 'пасажир' ? 'Пасажир' : 'Посилка';
    row[COL.DIRECTION] = data.direction || '';
    row[COL.ITEM_ID] = itemId;
    row[COL.DATE_CREATED] = dateStr;
    row[COL.DATE_TRIP] = data.dateTrip || '';
    row[COL.DRIVER] = data.driverName || '';
    row[COL.CITY] = data.city || '';
    row[COL.AMOUNT] = data.amount || '';
    row[COL.CURRENCY] = data.currency || 'UAH';
    row[COL.PAY_FORM] = data.payForm || '';
    row[COL.STATUS] = 'pending';
    row[COL.NOTE] = data.note || '';

    if (itemType === 'пасажир') {
      row[COL.PAX_NAME] = data.name || '';
      row[COL.PAX_PHONE] = data.phone || '';
      row[COL.ADDR_FROM] = data.addrFrom || '';
      row[COL.ADDR_TO] = data.addrTo || '';
      row[COL.SEATS_COUNT] = data.seatsCount || '1';
      row[COL.BAGGAGE_WEIGHT] = data.baggageWeight || '';
      row[COL.TIMING] = data.timing || '';
    } else {
      row[COL.SENDER_NAME] = data.senderName || '';
      row[COL.RECIPIENT_NAME] = data.recipientName || '';
      row[COL.RECIPIENT_PHONE] = data.recipientPhone || '';
      row[COL.RECIPIENT_ADDR] = data.recipientAddr || '';
      row[COL.PKG_DESC] = data.pkgDesc || '';
      row[COL.PKG_WEIGHT] = data.pkgWeight || '';
      row[COL.TTN] = data.ttn || '';
    }

    sheet.appendRow(row);

    var logSheet2 = ss.getSheetByName(SHEET_LOGS);
    if (logSheet2) {
      logSheet2.appendRow([
        dateStr, timeStr, data.driverName || '', routeName, itemId,
        data.itemType || '', 'added', '', ''
      ]);
    }
    writeAuditLog_({
      who: data.driverName || '', role: 'driver', action: 'addItem',
      table: 'MARHRUT', sheet: routeName, recordId: itemId,
      newValue: itemType + ' ' + (data.name || data.senderName || data.recipientName || ''),
      note: data.direction || ''
    });

    return { success: true, message: 'Додано ' + (itemType === 'пасажир' ? 'пасажира' : 'посилку'), itemId: itemId };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// handleUpdateDriverFields — водій редагує поля запису (batch)
// ============================================
function handleUpdateDriverFields(data) {
  try {
    var routeName = String(data.routeName || '').trim();
    var isShipping = routeName.indexOf('Відправка_') === 0;
    var isRoute = routeName.indexOf('Маршрут_') === 0;
    if (!routeName || (!isRoute && !isShipping)) {
      return { success: false, error: 'Невалідний маршрут: ' + (routeName || '(пусто)') };
    }

    var itemId = data.itemId;
    if (!itemId) return { success: false, error: 'itemId обов\'язковий' };

    var fields = data.fields;
    if (!fields || typeof fields !== 'object') return { success: false, error: 'fields обов\'язкові' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(routeName);
    if (!sheet) return { success: false, error: 'Аркуш не знайдено: ' + routeName };

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) return { success: false, error: 'Аркуш порожній' };

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
      return String(h).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    });

    // Шукаємо рядок: для Відправка по DISPATCH_ID (col A), для Маршрут по ITEM_ID (col E)
    var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var rowNum = -1;
    for (var i = 0; i < allData.length; i++) {
      if (isShipping) {
        if (str(allData[i][COL_SHIP.DISPATCH_ID]) === str(itemId)) { rowNum = i + 2; break; }
      } else {
        if (str(allData[i][COL.ITEM_ID]) === str(itemId) || str(allData[i][COL.RTE_ID]) === str(itemId)) { rowNum = i + 2; break; }
      }
    }
    if (rowNum === -1) return { success: false, error: 'Запис не знайдено: ' + itemId };

    var updated = 0;
    for (var col in fields) {
      var colIdx = headers.indexOf(col);
      if (colIdx !== -1) {
        sheet.getRange(rowNum, colIdx + 1).setValue(fields[col]);
        updated++;
      }
    }

    // Логуємо
    var now = new Date();
    var logSheet = ss.getSheetByName(SHEET_LOGS);
    if (logSheet) {
      logSheet.appendRow([
        Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd'),
        Utilities.formatDate(now, 'Europe/Kiev', 'HH:mm:ss'),
        data.driverId || '', routeName, itemId,
        data.itemType || '', 'edited', 'fields: ' + updated, ''
      ]);
    }
    writeAuditLog_({
      who: data.driverId || data.driverName || '', role: 'driver',
      action: 'editFields', table: 'MARHRUT', sheet: routeName,
      recordId: itemId, field: Object.keys(fields).join(', '),
      note: 'updated ' + updated + ' fields'
    });

    return { success: true, message: 'Оновлено ' + updated + ' полів', updated: updated };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// getExpenses — витрати водія (читає всі рядки)
// Кожен рядок = одна витрата. Категорія визначається по заповненій колонці.
// ============================================
var CATEGORY_COLS = {
  'fuel': COL_EXP.FUEL, 'food': COL_EXP.FOOD, 'parking': COL_EXP.PARKING,
  'toll': COL_EXP.TOLL, 'fine': COL_EXP.FINE, 'customs': COL_EXP.CUSTOMS,
  'topUp': COL_EXP.TOP_UP, 'other': COL_EXP.OTHER, 'tips': COL_EXP.TIPS
};

function detectCategory_(row) {
  for (var key in CATEGORY_COLS) {
    var val = parseFloat(row[CATEGORY_COLS[key]]) || 0;
    if (val > 0) return { category: key, amount: val };
  }
  return { category: 'other', amount: 0 };
}

function getExpenses(sheetName) {
  try {
    if (!sheetName) return { success: false, error: 'Не вказано аркуш витрат' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: true, items: [], advance: null, count: 0, sheetName: sheetName };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, items: [], advance: null, count: 0, sheetName: sheetName };

    var readCols = Math.min(sheet.getLastColumn(), TOTAL_COLS_EXP);
    var data = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();
    var items = [];

    // Перший рядок може мати аванс (заповнюється менеджером)
    var firstRow = data[0];
    var advance = null;
    var advCash = parseFloat(firstRow[COL_EXP.ADVANCE_CASH]) || 0;
    var advCard = parseFloat(firstRow[COL_EXP.ADVANCE_CARD]) || 0;
    if (advCash > 0 || advCard > 0) {
      advance = {
        cash: advCash,
        cashCurrency: str(firstRow[COL_EXP.ADVANCE_CASH_CUR]) || 'UAH',
        card: advCard,
        cardCurrency: str(firstRow[COL_EXP.ADVANCE_CARD_CUR]) || 'UAH'
      };
    }

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var expId = str(row[COL_EXP.EXP_ID]);
      var driver = str(row[COL_EXP.DRIVER]);
      if (!expId && !driver) continue;

      var detected = detectCategory_(row);
      if (detected.amount === 0 && !str(row[COL_EXP.OTHER_DESC])) continue; // порожній рядок

      items.push({
        rowNum: i + 2,
        expId: expId,
        dateTrip: str(row[COL_EXP.DATE_TRIP]),
        driver: driver,
        category: detected.category,
        amount: detected.amount,
        currency: str(row[COL_EXP.EXPENSE_CUR]) || 'CHF',
        description: str(row[COL_EXP.OTHER_DESC]) || str(row[COL_EXP.NOTE]) || ''
      });
    }

    return { success: true, items: items, advance: advance, count: items.length, sheetName: sheetName };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// addExpense — водій додає одну витрату (новий рядок)
// ============================================
function handleAddExpense(data) {
  try {
    var routeName = data.routeName;
    if (!routeName || !/^Маршрут_\d+$/.test(routeName)) {
      return { success: false, error: 'Невалідний маршрут: ' + (routeName || '(пусто)') };
    }

    var category = data.category;
    if (!category || !CATEGORY_COLS[category]) {
      return { success: false, error: 'Невалідна категорія: ' + (category || '(пусто)') };
    }

    var amount = parseFloat(data.amount);
    if (!amount || amount <= 0) {
      return { success: false, error: 'Невалідна сума' };
    }

    var expSheetName = routeName.replace('Маршрут_', 'Витрати_');
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(expSheetName);
    if (!sheet) return { success: false, error: 'Аркуш не знайдено: ' + expSheetName };

    var now = new Date();
    var dateStr = Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd');
    var timeStr = Utilities.formatDate(now, 'Europe/Kiev', 'HH:mm:ss');
    var expId = 'EXP-' + dateStr.replace(/-/g, '') + '-' + timeStr.replace(/:/g, '');

    // Створюємо рядок (26 колонок, заповнюємо тільки потрібні)
    var row = new Array(TOTAL_COLS_EXP).fill('');
    row[COL_EXP.EXP_ID] = expId;
    row[COL_EXP.DATE_TRIP] = dateStr;
    row[COL_EXP.DRIVER] = data.driverName || '';
    row[CATEGORY_COLS[category]] = amount;
    row[COL_EXP.EXPENSE_CUR] = data.currency || 'CHF';
    row[COL_EXP.OTHER_DESC] = data.description || '';
    row[COL_EXP.TOTAL] = amount;

    sheet.appendRow(row);

    // Логуємо
    var logSheet = ss.getSheetByName(SHEET_LOGS);
    if (logSheet) {
      logSheet.appendRow([
        dateStr, timeStr, data.driverName || '', routeName, expId,
        'витрати', 'added', category + ': ' + amount + ' ' + (data.currency || 'CHF'), ''
      ]);
    }
    writeAuditLog_({
      who: data.driverName || '', role: 'driver', action: 'addExpense',
      table: 'MARHRUT', sheet: expSheetName, recordId: expId,
      field: category, newValue: amount + ' ' + (data.currency || 'CHF'),
      note: data.description || ''
    });

    return { success: true, message: 'Витрату додано', expId: expId };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// deleteExpense — видалити витрату по rowNum
// ============================================
function handleDeleteExpense(data) {
  try {
    var routeName = data.routeName;
    if (!routeName || !/^Маршрут_\d+$/.test(routeName)) {
      return { success: false, error: 'Невалідний маршрут: ' + (routeName || '(пусто)') };
    }

    var rowNum = parseInt(data.rowNum);
    if (!rowNum || rowNum < 2) {
      return { success: false, error: 'Невалідний номер рядка' };
    }

    var expSheetName = routeName.replace('Маршрут_', 'Витрати_');
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(expSheetName);
    if (!sheet) return { success: false, error: 'Аркуш не знайдено: ' + expSheetName };

    // Перевіряємо що рядок належить цьому водію
    var driver = str(sheet.getRange(rowNum, COL_EXP.DRIVER + 1).getValue());
    if (data.driverName && driver !== data.driverName) {
      return { success: false, error: 'Це не ваша витрата' };
    }

    sheet.deleteRow(rowNum);

    var now = new Date();
    var logSheet = ss.getSheetByName(SHEET_LOGS);
    if (logSheet) {
      logSheet.appendRow([
        Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd'),
        Utilities.formatDate(now, 'Europe/Kiev', 'HH:mm:ss'),
        data.driverName || '', routeName, '',
        'витрати', 'deleted', 'row ' + rowNum, ''
      ]);
    }
    writeAuditLog_({
      who: data.driverName || '', role: 'driver', action: 'deleteExpense',
      table: 'MARHRUT', sheet: expSheetName, recordId: 'row ' + rowNum
    });

    return { success: true, message: 'Витрату видалено' };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// updateAdvance — водій оновлює кошти на поїздку (перший рядок Витрати_*)
// ============================================
function handleUpdateAdvance(data) {
  try {
    var routeName = data.routeName;
    if (!routeName || routeName.indexOf('Маршрут_') !== 0) {
      return { success: false, error: 'Невалідний маршрут: ' + (routeName || '(пусто)') };
    }

    var expSheetName = routeName.replace('Маршрут_', 'Витрати_');
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(expSheetName);
    if (!sheet) return { success: false, error: 'Аркуш не знайдено: ' + expSheetName };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, error: 'Аркуш порожній' };

    // Пишемо аванс у перший рядок даних (row 2)
    var cash = parseFloat(data.cash) || 0;
    var cashCurrency = data.cashCurrency || 'UAH';
    var card = parseFloat(data.card) || 0;
    var cardCurrency = data.cardCurrency || 'UAH';

    sheet.getRange(2, COL_EXP.ADVANCE_CASH + 1).setValue(cash);
    sheet.getRange(2, COL_EXP.ADVANCE_CASH_CUR + 1).setValue(cashCurrency);
    sheet.getRange(2, COL_EXP.ADVANCE_CARD + 1).setValue(card);
    sheet.getRange(2, COL_EXP.ADVANCE_CARD_CUR + 1).setValue(cardCurrency);

    // Логуємо
    var now = new Date();
    var logSheet = ss.getSheetByName(SHEET_LOGS);
    if (logSheet) {
      logSheet.appendRow([
        Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd'),
        Utilities.formatDate(now, 'Europe/Kiev', 'HH:mm:ss'),
        data.driverName || '', routeName, '',
        'витрати', 'advance_updated',
        'cash: ' + cash + ' ' + cashCurrency + ', card: ' + card + ' ' + cardCurrency, ''
      ]);
    }
    writeAuditLog_({
      who: data.driverName || '', role: 'driver', action: 'updateAdvance',
      table: 'MARHRUT', sheet: expSheetName,
      newValue: 'cash: ' + cash + ' ' + cashCurrency + ', card: ' + card + ' ' + cardCurrency
    });

    return { success: true, message: 'Кошти оновлено' };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// ЦЕНТРАЛЬНИЙ АУДИТ-ЛОГ (ARCHIVE.Логи)
// Колонки: A LOG_ID, B Дата і час, C Хто, D Роль, E Дія,
//          F Таблиця, G Аркуш, H ID запису, I Поле,
//          J Значення БУЛО, K Значення СТАЛО, L IP, M Пристрій,
//          N Підтверджено власником, O Дата підтв., P Підозріло, Q Примітка
// ============================================
function writeAuditLog_(entry) {
  try {
    var ss = openSS_('ARCHIVE');
    var sheet = ss.getSheetByName(ARCHIVE_LOG_SHEET);
    if (!sheet) return; // не створюємо автоматично, щоб не зіпсувати структуру архіву
    var now = new Date();
    var logId = 'LOG_' + Utilities.formatDate(now, 'Europe/Kiev', 'yyyyMMdd_HHmmss') + '_' + Math.floor(Math.random() * 1000);
    sheet.appendRow([
      logId,
      Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd HH:mm:ss'),
      entry.who || '',
      entry.role || 'driver',
      entry.action || '',
      entry.table || '',
      entry.sheet || '',
      entry.recordId || '',
      entry.field || '',
      entry.oldValue || '',
      entry.newValue || '',
      entry.ip || '',
      entry.device || '',
      '', '', '',
      entry.note || ''
    ]);
  } catch (e) {
    // Не ламаємо основну дію через помилку логування
  }
}

// ============================================
// FINANCE.Платежі — водій записує отриману оплату
// Колонки (21): A PAY_ID, B Дата створення, C Хто вніс, D Роль,
//   E CLI_ID, F PAX_ID, G PKG_ID, H RTE_ID, I CAL_ID, J Ід_смарт,
//   K Тип платежу, L Сума, M Валюта, N Форма оплати, O Статус платежу,
//   P Борг сума, Q Борг валюта, R Дата погашення, S Примітка, T DATE_ARCHIVE, U ARCHIVED_BY
// ============================================
function handleRecordPayment(data) {
  try {
    var amount = parseFloat(data.amount);
    if (!amount || amount <= 0) return { success: false, error: 'Невалідна сума' };
    if (!data.driverName) return { success: false, error: 'Не вказано водія' };

    var ss = openSS_('FINANCE');
    var sheet = ss.getSheetByName('Платежі');
    if (!sheet) return { success: false, error: 'Аркуш Платежі не знайдено у FINANCE' };

    var now = new Date();
    var dateStr = Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd HH:mm:ss');
    var payId = 'PAY_' + Utilities.formatDate(now, 'Europe/Kiev', 'yyyyMMdd_HHmmss') + '_' + Math.floor(Math.random() * 1000);

    var row = new Array(21).fill('');
    row[0]  = payId;
    row[1]  = dateStr;
    row[2]  = data.driverName;
    row[3]  = 'driver';
    row[4]  = data.cliId || '';
    row[5]  = data.paxId || '';
    row[6]  = data.pkgId || '';
    row[7]  = data.rteId || '';
    row[8]  = data.calId || '';
    row[9]  = data.smartId || '';
    row[10] = data.paymentType || 'готівка водій';
    row[11] = amount;
    row[12] = data.currency || 'CHF';
    row[13] = data.payForm || 'Готівка';
    row[14] = data.payStatus || 'Оплачено';
    row[15] = data.debtAmount || '';
    row[16] = data.debtCurrency || '';
    row[17] = data.settleDate || '';
    row[18] = data.note || '';
    sheet.appendRow(row);

    writeAuditLog_({
      who: data.driverName, role: 'driver', action: 'recordPayment',
      table: 'FINANCE', sheet: 'Платежі', recordId: payId,
      field: 'amount', newValue: amount + ' ' + (data.currency || 'CHF'),
      note: (data.rteId ? 'RTE:' + data.rteId + ' ' : '') + (data.paxId || data.pkgId || '')
    });

    return { success: true, message: 'Оплату записано', payId: payId };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ============================================
// KLIYENTU.Відгуки клієнтів — водій ставить оцінку клієнту
// Колонки (26): A REVIEW_ID, B Дата відгуку, C Статус відгуку,
//   D RTE_ID, E PAX_ID, F PKG_ID, G Дата рейсу, H Напрям,
//   I Номер авто, J Водій, K CLIENT_ID, L Ід_смарт/CRM,
//   M Телефон клієнта, N Піб клієнта, O Тип запису,
//   P Оцінка водія, Q Бал водія, R Коментар про водія,
//   S Оцінка менеджера, T Бал менеджера, U Коментар про менеджера,
//   V Загальний відгук, W Опрацьовано, X Хто опрацював, Y Дата опрацювання, Z Результат
// ============================================
function handleRateClient(data) {
  try {
    var rating = parseFloat(data.rating);
    if (!rating || rating < 1 || rating > 5) return { success: false, error: 'Оцінка 1-5' };
    if (!data.driverName) return { success: false, error: 'Не вказано водія' };
    if (!data.cliId && !data.clientPhone) return { success: false, error: 'Потрібен CLI_ID або телефон' };

    var ss = openSS_('KLIYENTU');
    var sheet = ss.getSheetByName('Відгуки клієнтів');
    if (!sheet) return { success: false, error: 'Аркуш "Відгуки клієнтів" не знайдено у KLIYENTU' };

    var now = new Date();
    var dateStr = Utilities.formatDate(now, 'Europe/Kiev', 'yyyy-MM-dd HH:mm:ss');
    var reviewId = 'REV_' + Utilities.formatDate(now, 'Europe/Kiev', 'yyyyMMdd_HHmmss') + '_' + Math.floor(Math.random() * 1000);

    var row = new Array(26).fill('');
    row[0]  = reviewId;
    row[1]  = dateStr;
    row[2]  = 'Новий';
    row[3]  = data.rteId || '';
    row[4]  = data.paxId || '';
    row[5]  = data.pkgId || '';
    row[6]  = data.dateTrip || '';
    row[7]  = data.direction || '';
    row[8]  = data.autoNum || '';
    row[9]  = data.driverName;
    row[10] = data.cliId || '';
    row[11] = data.smartId || '';
    row[12] = data.clientPhone || '';
    row[13] = data.clientName || '';
    row[14] = data.itemType || ''; // "Пасажир" / "Посилка"
    row[15] = rating;               // Оцінка водія (1-5)
    row[16] = rating;               // Бал водія
    row[17] = data.comment || '';   // Коментар про водія
    row[21] = data.comment || '';   // Загальний відгук
    sheet.appendRow(row);

    // Оновлюємо агрегати в аркуші Клієнти (якщо є CLI_ID)
    try {
      if (data.cliId) updateClientRating_(ss, data.cliId, rating, data.comment || '');
    } catch (e) { /* не критично */ }

    writeAuditLog_({
      who: data.driverName, role: 'driver', action: 'rateClient',
      table: 'KLIYENTU', sheet: 'Відгуки клієнтів', recordId: reviewId,
      field: 'rating', newValue: String(rating),
      note: (data.cliId || data.clientPhone || '') + ' ' + (data.comment || '')
    });

    return { success: true, message: 'Оцінку збережено', reviewId: reviewId };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// Оновлює агрегати рейтингу в аркуші Клієнти
function updateClientRating_(ss, cliId, rating, comment) {
  var sheet = ss.getSheetByName('Клієнти');
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(cliId)) {
      var rowNum = i + 2;
      // W Рейт. водія (23), X Оцінок від водія (24), Y Сума балів водія (25)
      var drCount = parseFloat(sheet.getRange(rowNum, 24).getValue()) || 0;
      var drSum   = parseFloat(sheet.getRange(rowNum, 25).getValue()) || 0;
      drCount += 1;
      drSum   += rating;
      var drAvg = drSum / drCount;
      sheet.getRange(rowNum, 23).setValue(Math.round(drAvg * 100) / 100);
      sheet.getRange(rowNum, 24).setValue(drCount);
      sheet.getRange(rowNum, 25).setValue(drSum);
      if (comment) {
        // AK (37) Останній відгук, AL (38) Дата останнього відгуку
        sheet.getRange(rowNum, 37).setValue(comment);
        sheet.getRange(rowNum, 38).setValue(new Date());
      }
      return;
    }
  }
}

// ============================================
// ДОПОМІЖНІ
// ============================================
function str(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, 'Europe/Kiev', 'yyyy-MM-dd');
  }
  return String(value).trim();
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('BotiLogistics CRM')
    .addItem('Список маршрутів', 'menuRoutes')
    .addToUi();
}

function menuRoutes() {
  var r = getAvailableRoutes();
  var msg = 'Маршрути: ' + r.routes.length + '\n';
  for (var i = 0; i < r.routes.length; i++) msg += '  ' + r.routes[i].name + ' — ' + r.routes[i].count + '\n';
  msg += '\nВідправки: ' + r.shipping.length + '\n';
  for (var j = 0; j < r.shipping.length; j++) msg += '  ' + r.shipping[j].name + ' — ' + r.shipping[j].count + '\n';
  SpreadsheetApp.getUi().alert('Маршрути', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}
