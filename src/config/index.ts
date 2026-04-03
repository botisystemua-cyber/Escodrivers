export const CONFIG = {
  COMPANY_NAME: 'EscoExpress',
  // Apps Script — читання і запис (таблиця непублічна)
  API_URL:
    'https://script.google.com/macros/s/AKfycbxniUvCeRRGOcrbWgSYJSxvLwVUcNDrOurcByE2Cd1WKS5rpTr6JwbDoZct519CnGQJbQ/exec',
  // Маршрути (hardcoded)
  ROUTES: ['Маршрут_Цюріх', 'Маршрут_Женева', 'Маршрут_Запасний'],
  SHIPPING: [
    { name: 'Відправка_Цюріх', label: 'Відправка Цюріх' },
    { name: 'Відправка_Женева', label: 'Відправка Женева' },
    { name: 'Відправка_Запасний', label: 'Відправка Запасний' },
  ],
};
