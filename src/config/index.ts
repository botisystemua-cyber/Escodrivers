export const CONFIG = {
  COMPANY_NAME: 'BotiLogistics',
  // Google Sheets ID для прямого читання через gviz API
  SPREADSHEET_ID: '10SZhKV08BJyvWoMwhT0iddtWzYrDYFjCM8xgqViuE3Y',
  // Apps Script — тільки для запису (updateDriverStatus)
  API_URL:
    'https://script.google.com/macros/s/AKfycbzIXx_hizxLfUFaqdgaR9bkkvNnN2Bvmvvh7_wFin80HcQbbW-AUK_iKHYQiQsgNzP1Gw/exec',
  // Маршрути (hardcoded)
  ROUTES: ['Маршрут_1', 'Маршрут_2', 'Маршрут_3'],
  SHIPPING: [
    { name: 'Відправка_1', label: 'Відправка 1' },
    { name: 'Відправка_2', label: 'Відправка 2' },
    { name: 'Відправка_3', label: 'Відправка 3' },
  ],
};
