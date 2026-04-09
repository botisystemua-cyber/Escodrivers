export const CONFIG = {
  COMPANY_NAME: 'BotiLogistics',
  // Google Sheets ID — залишено лише як довідкове значення, фронт більше
  // не читає таблицю напряму (див. fetchSheet у src/api/index.ts).
  SPREADSHEET_ID: '10SZhKV08BJyvWoMwhT0iddtWzYrDYFjCM8xgqViuE3Y',
  // Apps Script Web App — ЄДИНА точка входу (читання + запис).
  // Читання приватної таблиці проксюється через apiGetSheetRows у бекенді.
  API_URL:
    'https://script.google.com/macros/s/AKfycbyDFpJzq2e7qzQXmy9ecB4C95jchHpjb2hejK5S44Jdq_bbAgJ-pG2c2NwP4zI-MhT25g/exec',
  // Fallback маршрути — використовуються лише якщо Apps Script недоступний.
  // Реальний список повертає GAS getAvailableRoutes (динамічне сканування).
  ROUTES: ['Маршрут_Цюріх', 'Маршрут_Женева', 'Маршрут_Запасний'],
  SHIPPING: [
    { name: 'Відправка_Цюріх', label: 'Відправка Цюріх' },
    { name: 'Відправка_Женева', label: 'Відправка Женева' },
    { name: 'Відправка_Запасний', label: 'Відправка Запасний' },
  ],
};
