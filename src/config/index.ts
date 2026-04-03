export const CONFIG = {
  COMPANY_NAME: 'EscoExpress',
  // Apps Script — читання і запис (таблиця непублічна)
  API_URL:
    'https://script.google.com/macros/s/AKfycbw0IXZEdC5k_oCM65OBvh6YOO1Qms8ygO4O77X7xu8IZ-eFP5Mt-tJafRl7oCJ96SkHVw/exec',
  // Маршрути (hardcoded)
  ROUTES: ['Маршрут_Цюріх', 'Маршрут_Женева', 'Маршрут_Запасний'],
  SHIPPING: [
    { name: 'Відправка_Цюріх', label: 'Відправка Цюріх' },
    { name: 'Відправка_Женева', label: 'Відправка Женева' },
    { name: 'Відправка_Запасний', label: 'Відправка Запасний' },
  ],
};
