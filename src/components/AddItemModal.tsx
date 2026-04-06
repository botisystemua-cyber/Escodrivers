import { useState, useEffect, useRef, useCallback } from 'react';
import { X, UserPlus, Package, Send, Hash, Search } from 'lucide-react';
import { useApp } from '../store/useAppStore';
import { addRouteItem, fetchPackages, fetchShippingItems } from '../api';

// Predefined cargo descriptions for autocomplete
const CARGO_SUGGESTIONS = [
  'Крафтова коробка',
  'Дві крафтові коробки',
  'Три крафтові коробки',
  'Синя сумка IKEA',
  'Польська чорна клітка',
  'Білий пакет',
  'Чорна сумка',
  'Біла коробка',
  'Червона торба Деннер',
  'Сіра валіза',
  'Синя дорожня сумка',
  'Чорна валіза',
  'Торба Мігрос',
  'Червона сумка',
  'Голуба торба Алді',
];

// localStorage helpers for recipient contacts
const CONTACTS_KEY = 'recipientContacts';

function loadContacts(): Record<string, { name: string; addr: string }> {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '{}'); }
  catch { return {}; }
}

function saveContact(phone: string, name: string, addr: string) {
  if (!phone.trim()) return;
  const contacts = loadContacts();
  contacts[phone.trim()] = { name: name.trim(), addr: addr.trim() };
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export function AddItemModal({ onClose, onAdded }: Props) {
  const { currentSheet, isUnifiedView, routes, driverName, shippingRoutes, showToast } = useApp();

  const [itemType, setItemType] = useState<'пасажир' | 'посилка'>('посилка');
  const [selectedRoute, setSelectedRoute] = useState(isUnifiedView ? routes[0]?.name || '' : currentSheet);
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState<'отримання' | 'відправка'>('відправка');

  // Common fields
  const [dateTrip, setDateTrip] = useState('');
  const [city, setCity] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('UAH');
  const [payForm, setPayForm] = useState('Готівка');
  const [note, setNote] = useState('');

  // Passenger fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addrFrom, setAddrFrom] = useState('');
  const [addrTo, setAddrTo] = useState('');
  const [seatsCount, setSeatsCount] = useState('1');
  const [baggageWeight, setBaggageWeight] = useState('');
  const [timing, setTiming] = useState('');

  // Package fields (shared between отримання and відправка)
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddr, setRecipientAddr] = useState('');
  const [pkgDesc, setPkgDesc] = useState('');
  const [pkgWeight, setPkgWeight] = useState('');
  const [ttn, setTtn] = useState('');

  // Відправка-specific fields
  const [internalNum, setInternalNum] = useState('');
  const [lastInternalNum, setLastInternalNum] = useState<string>('');
  const [loadingNum, setLoadingNum] = useState(false);
  const [pkgPieces, setPkgPieces] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositCurrency, setDepositCurrency] = useState('UAH');

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [contactLoaded, setContactLoaded] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const isShipping = itemType === 'посилка' && direction === 'відправка';

  // Fetch last internal number when in shipping mode
  const loadLastInternalNum = useCallback(async () => {
    setLoadingNum(true);
    try {
      const routeName = selectedRoute;
      const routeNum = routeName.replace('Маршрут_', '');
      const shipSheetName = shippingRoutes.find((s) => s.name === 'Відправка_' + routeNum)?.name || 'Відправка_' + routeNum;

      const [pkgs, shipItems] = await Promise.allSettled([
        fetchPackages(routeName),
        fetchShippingItems(shipSheetName),
      ]);

      const nums: number[] = [];

      if (pkgs.status === 'fulfilled') {
        pkgs.value.forEach((p) => {
          const n = parseInt(p.internalNum);
          if (!isNaN(n)) nums.push(n);
        });
      }

      if (shipItems.status === 'fulfilled') {
        shipItems.value.forEach((s) => {
          const n = parseInt(s.internalNum);
          if (!isNaN(n)) nums.push(n);
        });
      }

      const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
      setLastInternalNum(String(maxNum));
    } catch {
      // ignore fetch errors
    } finally {
      setLoadingNum(false);
    }
  }, [selectedRoute, shippingRoutes]);

  useEffect(() => {
    if (isShipping) {
      loadLastInternalNum();
    }
  }, [isShipping, loadLastInternalNum]);

  // Recipient phone autocomplete from localStorage
  const handleRecipientPhoneBlur = () => {
    if (!recipientPhone.trim() || contactLoaded) return;
    const contacts = loadContacts();
    const saved = contacts[recipientPhone.trim()];
    if (saved) {
      if (!recipientName.trim()) setRecipientName(saved.name);
      if (!recipientAddr.trim()) setRecipientAddr(saved.addr);
      setContactLoaded(true);
      showToast('Контакт знайдено');
    }
  };

  // Reset contact loaded flag when phone changes
  useEffect(() => { setContactLoaded(false); }, [recipientPhone]);

  // Filtered cargo suggestions
  const filteredSuggestions = pkgDesc.trim()
    ? CARGO_SUGGESTIONS.filter((s) => s.toLowerCase().includes(pkgDesc.toLowerCase().trim()))
    : CARGO_SUGGESTIONS;

  const handleSubmit = async () => {
    // Validation
    if (itemType === 'пасажир') {
      if (!name.trim()) { showToast('Введи ПІБ'); return; }
    } else if (isShipping) {
      if (!internalNum.trim()) { showToast('Введи внутрішній номер'); return; }
      if (!recipientPhone.trim()) { showToast('Введи тел. отримувача'); return; }
      if (!senderPhone.trim()) { showToast('Введи тел./ІД відправника'); return; }
      if (!amount.trim()) { showToast('Введи оціночну вартість'); return; }
      // Check for duplicate internal number
      if (lastInternalNum && internalNum.trim() === lastInternalNum) {
        showToast('Цей номер вже існує! Попередній: ' + lastInternalNum);
        return;
      }
    } else {
      if (!recipientName.trim()) { showToast('Введи отримувача'); return; }
    }
    if (!selectedRoute) { showToast('Обери маршрут'); return; }

    setSubmitting(true);
    try {
      const data: Record<string, string> = {
        routeName: selectedRoute,
        itemType: itemType === 'пасажир' ? 'пасажир' : 'посилка',
        driverName,
      };

      if (itemType === 'пасажир') {
        data.dateTrip = dateTrip;
        data.city = city;
        data.amount = amount;
        data.currency = currency;
        data.payForm = payForm;
        data.note = note;
        data.name = name;
        data.phone = phone;
        data.addrFrom = addrFrom;
        data.addrTo = addrTo;
        data.seatsCount = seatsCount;
        data.baggageWeight = baggageWeight;
        data.timing = timing;
      } else if (isShipping) {
        data.direction = 'відправка';
        data.internalNum = internalNum;
        data.recipientName = recipientName;
        data.recipientPhone = recipientPhone;
        data.recipientAddr = recipientAddr;
        data.pkgDesc = pkgDesc;
        data.pkgPieces = pkgPieces;
        data.pkgWeight = pkgWeight;
        data.senderPhone = senderPhone;
        data.amount = amount;
        data.currency = currency;
        data.payForm = payForm;
        data.deposit = depositAmount;
        data.depositCurrency = depositCurrency;
        // Save recipient contact for future autocomplete
        saveContact(recipientPhone, recipientName, recipientAddr);
      } else {
        data.direction = 'отримання';
        data.dateTrip = dateTrip;
        data.city = city;
        data.amount = amount;
        data.currency = currency;
        data.payForm = payForm;
        data.note = note;
        data.senderName = senderName;
        data.senderPhone = senderPhone;
        data.recipientName = recipientName;
        data.recipientPhone = recipientPhone;
        data.recipientAddr = recipientAddr;
        data.pkgDesc = pkgDesc;
        data.pkgWeight = pkgWeight;
        data.ttn = ttn;
      }

      const result = await addRouteItem(data);
      if (result.success) {
        showToast(result.message || 'Додано!');
        onAdded();
        onClose();
      } else {
        showToast('Помилка: ' + result.error);
      }
    } catch (err) {
      showToast('Помилка: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col animate-[slideUp_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
          <h2 className="text-base font-bold text-text">Додати запис</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 cursor-pointer">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Type toggle */}
          <div className="flex gap-2">
            <button onClick={() => setItemType('пасажир')}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-center cursor-pointer transition-all ${
                itemType === 'пасажир' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
              }`}>
              <UserPlus className="w-4 h-4 inline mr-1.5 -mt-0.5" />Пасажир
            </button>
            <button onClick={() => setItemType('посилка')}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-center cursor-pointer transition-all ${
                itemType === 'посилка' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
              }`}>
              <Package className="w-4 h-4 inline mr-1.5 -mt-0.5" />Посилка
            </button>
          </div>

          {/* Route selector (unified view) */}
          {isUnifiedView && (
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Маршрут</label>
              <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text focus:outline-none focus:border-brand">
                {routes.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
              </select>
            </div>
          )}

          {/* ===== PASSENGER FORM ===== */}
          {itemType === 'пасажир' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Дата рейсу" value={dateTrip} onChange={setDateTrip} type="date" />
                <Field label="Місто" value={city} onChange={setCity} placeholder="Київ" />
              </div>
              <Field label="ПІБ *" value={name} onChange={setName} placeholder="Іванов Іван" />
              <Field label="Телефон" value={phone} onChange={setPhone} placeholder="+380..." type="tel" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Звідки" value={addrFrom} onChange={setAddrFrom} placeholder="Адреса" />
                <Field label="Куди" value={addrTo} onChange={setAddrTo} placeholder="Адреса" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Місць" value={seatsCount} onChange={setSeatsCount} type="number" />
                <Field label="Вага багажу" value={baggageWeight} onChange={setBaggageWeight} placeholder="кг" type="number" />
                <Field label="Таймінг" value={timing} onChange={setTiming} placeholder="08:00" />
              </div>

              {/* Payment section */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Сума" value={amount} onChange={setAmount} placeholder="0" type="number" />
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Форма оплати</label>
                  <select value={payForm} onChange={(e) => setPayForm(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text focus:outline-none focus:border-brand">
                    <option value="">—</option>
                    <option value="Готівка">Готівка</option>
                    <option value="Картка">Картка</option>
                    <option value="Переказ">Переказ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Валюта</label>
                <div className="flex gap-1.5">
                  {['UAH', 'EUR', 'CHF', 'PLN', 'USD'].map((c) => (
                    <button key={c} onClick={() => setCurrency(c)}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                        currency === c ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                      }`}>{c}</button>
                  ))}
                </div>
              </div>

              <Field label="Примітка" value={note} onChange={setNote} placeholder="Додаткова інформація" />
            </>
          )}

          {/* ===== PACKAGE FORM ===== */}
          {itemType === 'посилка' && (
            <>
              {/* Direction toggle */}
              <div className="flex gap-2">
                <button onClick={() => setDirection('отримання')}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-bold text-center cursor-pointer transition-all ${
                    direction === 'отримання' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                  }`}>
                  <Package className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Отримання
                </button>
                <button onClick={() => setDirection('відправка')}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-bold text-center cursor-pointer transition-all ${
                    direction === 'відправка' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                  }`}>
                  <Send className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Відправка
                </button>
              </div>

              {/* ===== ВІДПРАВКА FORM ===== */}
              {isShipping ? (
                <>
                  {/* 1. Internal number */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-muted uppercase">
                        <Hash className="w-3 h-3 inline mr-0.5 -mt-0.5" />Внутрішній номер *
                      </label>
                      <span className="text-[10px] text-blue-500 font-semibold">
                        {loadingNum ? 'Завантаження...' : lastInternalNum ? `Попередній: ${lastInternalNum}` : 'Немає записів'}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={internalNum}
                      onChange={(e) => setInternalNum(e.target.value)}
                      placeholder={lastInternalNum ? String(Number(lastInternalNum) + 1) : '1'}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text placeholder:text-gray-300 focus:outline-none focus:border-brand font-bold text-center text-lg"
                    />
                  </div>

                  {/* 2. Recipient data */}
                  <div className="bg-blue-50/50 rounded-xl p-2.5 space-y-2">
                    <label className="text-[11px] font-semibold text-blue-600 uppercase">Отримувач</label>
                    <Field label="ПІБ" value={recipientName} onChange={setRecipientName} placeholder="ПІБ отримувача" />
                    <div className="relative">
                      <Field label="Телефон *" value={recipientPhone} onChange={setRecipientPhone} placeholder="+380..." type="tel" onBlur={handleRecipientPhoneBlur} />
                      {recipientPhone.trim() && !contactLoaded && (
                        <button onClick={handleRecipientPhoneBlur}
                          className="absolute right-2 top-6 p-1 rounded-lg hover:bg-blue-100 cursor-pointer">
                          <Search className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                      )}
                    </div>
                    <Field label="Адреса" value={recipientAddr} onChange={setRecipientAddr} placeholder="Місто, вулиця..." />
                  </div>

                  {/* 3. Cargo description with autocomplete */}
                  <div className="relative" ref={suggestionsRef}>
                    <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Опис вантажу</label>
                    <input
                      type="text"
                      value={pkgDesc}
                      onChange={(e) => { setPkgDesc(e.target.value); setShowSuggestions(true); }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      placeholder="Почніть вводити..."
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text placeholder:text-gray-300 focus:outline-none focus:border-brand"
                    />
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                        {filteredSuggestions.map((s) => (
                          <button key={s}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setPkgDesc(s); setShowSuggestions(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-text hover:bg-blue-50 cursor-pointer first:rounded-t-xl last:rounded-b-xl">
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4-5. Pieces + Weight */}
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="К-сть місць" value={pkgPieces} onChange={setPkgPieces} placeholder="1" type="number" />
                    <Field label="Вага (кг)" value={pkgWeight} onChange={setPkgWeight} placeholder="кг" type="number" />
                  </div>

                  {/* 6. Sender */}
                  <div className="bg-emerald-50/50 rounded-xl p-2.5 space-y-2">
                    <label className="text-[11px] font-semibold text-emerald-600 uppercase">Відправник</label>
                    <Field label="Тел. або ІД *" value={senderPhone} onChange={setSenderPhone} placeholder="+380... або ID" />
                  </div>

                  {/* 7. Оціночна вартість + оплата */}
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Оціночна вартість *" value={amount} onChange={setAmount} placeholder="0" type="number" />
                    <div>
                      <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Форма оплати</label>
                      <select value={payForm} onChange={(e) => setPayForm(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text focus:outline-none focus:border-brand">
                        <option value="Готівка">Готівка</option>
                        <option value="Картка">Картка</option>
                        <option value="Переказ">Переказ</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Валюта</label>
                    <div className="flex gap-1.5">
                      {['UAH', 'EUR', 'CHF', 'PLN', 'USD'].map((c) => (
                        <button key={c} onClick={() => setCurrency(c)}
                          className={`flex-1 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                            currency === c ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                          }`}>{c}</button>
                      ))}
                    </div>
                  </div>

                  {/* 8. Пакетик (cash envelope) */}
                  <div className="bg-amber-50/50 rounded-xl p-2.5 space-y-2">
                    <label className="text-[11px] font-semibold text-amber-600 uppercase">Пакетик (готівка)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Сума" value={depositAmount} onChange={setDepositAmount} placeholder="0" type="number" />
                      <div>
                        <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Валюта</label>
                        <div className="flex gap-1">
                          {['UAH', 'EUR', 'CHF', 'USD'].map((c) => (
                            <button key={c} onClick={() => setDepositCurrency(c)}
                              className={`flex-1 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                                depositCurrency === c ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                              }`}>{c}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* ===== ОТРИМАННЯ FORM (existing) ===== */
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Дата рейсу" value={dateTrip} onChange={setDateTrip} type="date" />
                    <Field label="Місто" value={city} onChange={setCity} placeholder="Київ" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Відправник" value={senderName} onChange={setSenderName} placeholder="ПІБ" />
                    <Field label="Тел. відправника" value={senderPhone} onChange={setSenderPhone} placeholder="+380..." type="tel" />
                  </div>
                  <Field label="Отримувач *" value={recipientName} onChange={setRecipientName} placeholder="ПІБ" />
                  <Field label="Тел. отримувача" value={recipientPhone} onChange={setRecipientPhone} placeholder="+380..." type="tel" />
                  <Field label="Адреса отримувача" value={recipientAddr} onChange={setRecipientAddr} placeholder="Місто, вулиця..." />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Опис" value={pkgDesc} onChange={setPkgDesc} placeholder="Що відправляється" />
                    <Field label="Вага (кг)" value={pkgWeight} onChange={setPkgWeight} type="number" />
                  </div>
                  <Field label="ТТН" value={ttn} onChange={setTtn} placeholder="Номер ТТН" />

                  {/* Payment section */}
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Сума" value={amount} onChange={setAmount} placeholder="0" type="number" />
                    <div>
                      <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Форма оплати</label>
                      <select value={payForm} onChange={(e) => setPayForm(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text focus:outline-none focus:border-brand">
                        <option value="">—</option>
                        <option value="Готівка">Готівка</option>
                        <option value="Картка">Картка</option>
                        <option value="Переказ">Переказ</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted uppercase mb-1">Валюта</label>
                    <div className="flex gap-1.5">
                      {['UAH', 'EUR', 'CHF', 'PLN', 'USD'].map((c) => (
                        <button key={c} onClick={() => setCurrency(c)}
                          className={`flex-1 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                            currency === c ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-400'
                          }`}>{c}</button>
                      ))}
                    </div>
                  </div>

                  <Field label="Примітка" value={note} onChange={setNote} placeholder="Додаткова інформація" />
                </>
              )}
            </>
          )}
        </div>

        {/* Submit */}
        <div className="px-3 py-3 border-t border-gray-100 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={handleSubmit} disabled={submitting}
            className={`w-full py-3 rounded-xl text-sm font-bold text-center cursor-pointer transition-all ${
              submitting ? 'bg-gray-300 text-gray-500' : 'bg-brand text-white shadow-sm active:scale-[0.98]'
            }`}>
            <Send className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {submitting ? 'Відправка...' : 'Додати'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type, onBlur }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; onBlur?: () => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted uppercase mb-1">{label}</label>
      <input type={type || 'text'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onBlur={onBlur}
        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-text placeholder:text-gray-300 focus:outline-none focus:border-brand" />
    </div>
  );
}
