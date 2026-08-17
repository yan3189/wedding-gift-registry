'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULT_HERO_BG = 'https://deqzuvxmsmltrcuutxst.supabase.co/storage/v1/object/public/bghero/PYG-70-FAM05529.jpg';
const RECIPIENT_NAME = 'Gracia Gita';
const RECIPIENT_PHONE = '081944971533';
const SHIPPING_ADDRESS = 'Jl. Magnesium No.25, Purwantoro, Kec. Blimbing, Kota Malang, Jawa Timur 65126';

const CATEGORIES = [
  'Semua',
  'Ruang Tamu',
  'Dapur',
  'Kamar Mandi',
  'Kamar Tidur',
  'Lainnya',
];

type Claim = {
  buyer_name: string;
  greeting_message: string;
  is_anonymous: boolean;
};

type Product = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  price: number;
  category: string;
  shopee_url: string;
  is_claimed: boolean;
  quantity_expected: number;
  quantity_fulfilled: number;
  claims?: Claim[];
};

type WeddingConfig = {
  couple_names: string;
  hero_title: string;
  background_url: string;
};

type ShopeeFlowStep = 'education' | 'confirm' | 'form' | 'no_reason';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<WeddingConfig>({
    couple_names: 'Yanuar & Gracia',
    hero_title: 'Wishlist Wedding Gift',
    background_url: DEFAULT_HERO_BG,
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [copied, setCopied] = useState(false);

  // Flow Shopee & Modal State
  const [shopeeProduct, setShopeeProduct] = useState<Product | null>(null);
  const [shopeeStep, setShopeeStep] = useState<ShopeeFlowStep | null>(null);
  const [showRedirectNotice, setShowRedirectNotice] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [noReasonOption, setNoReasonOption] = useState<'browsing' | 'unavailable'>('browsing');

  // Form Klaim State
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [greeting, setGreeting] = useState('');
  const [claimQty, setClaimQty] = useState(1);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Ref Timer
  const timer3sRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 120);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);

    const { data: configData } = await supabase.from('wedding_config').select('*').single();
    if (configData) {
      setConfig({
        couple_names: configData.couple_names || 'Yanuar & Gracia',
        hero_title: configData.hero_title || 'Wishlist Wedding Gift',
        background_url: configData.background_url || DEFAULT_HERO_BG,
      });
    }

    const { data: productData, error } = await supabase
      .from('products')
      .select('*, claims(buyer_name, greeting_message, is_anonymous)')
      .order('created_at', { ascending: false });

    if (!error && productData) {
      setProducts(productData as unknown as Product[]);
    }
    setLoading(false);
  };

  const filteredProducts = products.filter((p) => {
    if (selectedCategory === 'Semua') return true;
    return (p.category || 'Lainnya') === selectedCategory;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => Number(a.is_claimed) - Number(b.is_claimed));

  const handleCopyAddress = () => {
    const fullAddressText = `Penerima: ${RECIPIENT_NAME} (${RECIPIENT_PHONE})\nAlamat: ${SHIPPING_ADDRESS}`;
    navigator.clipboard.writeText(fullAddressText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const clearShopeeTimers = () => {
    if (timer3sRef.current) clearTimeout(timer3sRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  const handleCloseShopeeModal = () => {
    clearShopeeTimers();
    setShopeeProduct(null);
    setShopeeStep(null);
    setShowRedirectNotice(false);
    setCountdown(5);
    setErrorMsg('');
  };

  const handleStartShopeeFlow = (product: Product) => {
    clearShopeeTimers();
    setShopeeProduct(product);
    setShopeeStep('education');
    setShowRedirectNotice(false);
    setCountdown(5);

    timer3sRef.current = setTimeout(() => {
      setShowRedirectNotice(true);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 3000);
  };

  const handleProceedToShopee = () => {
    if (!shopeeProduct) return;
    clearShopeeTimers();
    window.open(shopeeProduct.shopee_url, '_blank');
    setShopeeStep('confirm');
  };

  const handleOpenDirectClaimModal = (product: Product) => {
    setShopeeProduct(product);
    setShopeeStep('form');
    setBuyerName('');
    setBuyerPhone('');
    setGreeting('');
    setClaimQty(1);
    setIsAnonymous(false);
    setErrorMsg('');
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopeeProduct) return;

    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;
    if (!phoneRegex.test(buyerPhone.replace(/\s+/g, ''))) {
      setErrorMsg('Masukkan nomor HP yang valid (contoh: 081234567890).');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const currentFulfilled = shopeeProduct.quantity_fulfilled || 0;
    const targetQty = shopeeProduct.quantity_expected || 1;
    const newFulfilled = currentFulfilled + claimQty;
    const isFullyClaimed = newFulfilled >= targetQty;

    const { error: claimError } = await supabase.from('claims').insert({
      product_id: shopeeProduct.id,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      greeting_message: greeting + (claimQty > 1 ? ` (Membeli ${claimQty} unit)` : ''),
      is_anonymous: isAnonymous,
    });

    if (claimError) {
      setErrorMsg('Gagal menyimpan konfirmasi: ' + claimError.message);
      setSubmitting(false);
      return;
    }

    const { error: productError } = await supabase
      .from('products')
      .update({
        quantity_fulfilled: newFulfilled,
        is_claimed: isFullyClaimed,
      })
      .eq('id', shopeeProduct.id);

    if (productError) {
      setErrorMsg('Gagal memperbarui status kado.');
    } else {
      handleCloseShopeeModal();
      fetchInitialData();
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-rose-50/30 text-black pb-28 font-sans">
      {/* Import Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Tangerine:wght@400;700&display=swap" rel="stylesheet" />

      {/* 1. Header Hero Minimalis & Elegan */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 bg-cover bg-[center_43%] transition-all duration-500 ease-out shadow-md ${
          isScrolled ? 'h-16 sm:h-20' : 'h-screen'
        }`}
        style={{ backgroundImage: `url('${config.background_url || DEFAULT_HERO_BG}')` }}
      >
        <div className="w-full h-full bg-black/70 backdrop-blur-[1px] flex flex-col justify-start pt-60 items-center text-center px-4 transition-all duration-500">
          <div className="max-w-2xl text-white space-y-2">
            {!isScrolled && (
              <h2
                style={{ fontFamily: "'Tangerine', cursive" }}
                className="text-4xl sm:text-5xl text-orange-300 mb-0 drop-shadow-md"
              >
                {config.couple_names}
              </h2>
            )}

            <h1
              className={`font-bold transition-all duration-500 tracking-wide font-serif ${
                isScrolled ? 'text-base sm:text-xl text-rose-100' : 'text-2xl sm:text-4xl text-orange-200'
              }`}
            >
              {config.hero_title}
            </h1>

            {!isScrolled && (
              <>
                <p className="text-orange-200 text-xs sm:text-sm max-w-lg mt-6 leading-relaxed font-light mx-auto">
                  Kehadiran serta doa restu anda adalah hadiah terindah dan paling bermakna bagi perjalanan baru kami.
<br /><br />
Bagi keluarga dan sahabat yang berencana memberikan tanda kasih berbentuk kado, kami menyiapkan Wedding Registry sederhana ini sebagai panduan kecil agar lebih praktis.
<br /><br />
Daftar ini sekadar referensi terbuka. Anda sangat bebas memilih bentuk tanda kasih apa pun, karena kebersamaan anda lah kebahagiaan terbesar bagi kami.

                </p>
                <div className="pt-50 animate-bounce">
                  <span className="text-xs text-rose-200 border border-white/20 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm">
                    Eksplor Wishlist Kado ↓
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="h-screen w-full pointer-events-none" />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4 sm:p-8 relative z-10 -mt-12 sm:-mt-20">
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-rose-100 mb-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            🏷️ Filter Kategori:
          </span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full sm:w-64 p-2.5 bg-rose-50/50 border border-rose-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-rose-400"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'Semua' ? '🎁 Semua Kategori' : cat}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500 bg-white rounded-3xl shadow-sm">
            Menyiapkan daftar wishlist...
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl shadow-sm p-8 text-gray-500">
            Tidak ada wishlist untuk kategori ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProducts.map((item) => {
              const targetQty = item.quantity_expected || 1;
              const fulfilledQty = item.quantity_fulfilled || 0;
              const remainingQty = targetQty - fulfilledQty;
              const isFullyClaimed = item.is_claimed || fulfilledQty >= targetQty;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm border transition flex flex-col justify-between ${
                    isFullyClaimed ? 'border-gray-100 bg-gray-50/50 opacity-75' : 'border-rose-100 hover:shadow-md'
                  }`}
                >
                  <div>
                    <div className="relative h-48 w-full bg-gray-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className={`w-full h-full object-cover ${isFullyClaimed ? 'grayscale-[30%]' : ''}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                          Foto Produk
                        </div>
                      )}

                      <div className="absolute top-3 left-3">
                        <span className="bg-black/50 backdrop-blur text-white text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                          {item.category || 'Lainnya'}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3">
                        {isFullyClaimed ? (
                          <span className="bg-gray-800/80 backdrop-blur text-white text-[11px] px-3 py-1 rounded-full font-medium">
                            Telah Dihadiahkan ✨
                          </span>
                        ) : fulfilledQty > 0 ? (
                          <span className="bg-amber-600 text-white text-[11px] px-3 py-1 rounded-full font-medium shadow-sm">
                            Tersisa {remainingQty} dari {targetQty}
                          </span>
                        ) : (
                          <span className="bg-emerald-600 text-white text-[11px] px-3 py-1 rounded-full font-medium shadow-sm">
                            Tersedia {targetQty > 1 ? `(${targetQty} unit)` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-5 space-y-2">
                      <h3 className="font-bold text-gray-800 text-base leading-snug line-clamp-2">{item.title}</h3>
                      <p className="text-rose-600 font-bold text-base">
                        Rp {item.price ? item.price.toLocaleString('id-ID') : '0'}
                      </p>

                      {/* Baris Informasi Kuantitas / Progress */}
                      {targetQty > 1 && (
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden my-1">
                          <div
                            className="bg-rose-500 h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (fulfilledQty / targetQty) * 100)}%` }}
                          />
                        </div>
                      )}

                      {item.description && <p className="text-gray-500 text-xs line-clamp-2">{item.description}</p>}

                      {item.claims && item.claims.length > 0 && (
                        <div className="mt-4 p-3 bg-rose-50/60 rounded-xl border border-rose-100 text-xs space-y-1">
                          <p className="text-gray-700 font-medium">🎁 Kontributor Kado:</p>
                          {item.claims.map((c, idx) => (
                            <div key={idx} className="text-[11px] text-gray-600 border-t border-rose-100/60 pt-1 mt-1">
                              • <span className="font-bold">{c.is_anonymous ? 'Sahabat Anonim' : c.buyer_name}</span>
                              {c.greeting_message && <span className="italic text-gray-500"> — "{c.greeting_message}"</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 pt-0 space-y-2">
                    {!isFullyClaimed ? (
                      <>
                        <button
                          onClick={() => handleStartShopeeFlow(item)}
                          className="w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1"
                        >
                          Hadiahkan via Shopee ↗
                        </button>
                        <button
                          onClick={() => handleOpenDirectClaimModal(item)}
                          className="w-full text-center bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium py-2.5 rounded-xl text-xs transition border border-rose-200"
                        >
                          Saya Sudah Membelikan Ini
                        </button>
                      </>
                    ) : (
                      <button
                        disabled
                        className="w-full text-center bg-gray-100 text-gray-400 font-medium py-2.5 rounded-xl text-xs cursor-not-allowed border border-gray-200/60"
                      >
                        Telah Dihadiahkan Tamu Lain ♡
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Address Bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-rose-200 p-3 sm:p-4 shadow-lg transition-all duration-500 transform ${
          isScrolled ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base sm:text-lg shrink-0">📍</span>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-bold text-gray-800 truncate">
                Alamat Kirim: {RECIPIENT_NAME} ({RECIPIENT_PHONE})
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">{SHIPPING_ADDRESS}</p>
            </div>
          </div>

          <button
            onClick={handleCopyAddress}
            className={`shrink-0 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs font-bold transition shadow-sm ${
              copied ? 'bg-emerald-600 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {copied ? '✓ Tersalin!' : '📋 Salin Alamat'}
          </button>
        </div>
      </div>

      {/* MODAL SERBAGUNA */}
      {shopeeProduct && shopeeStep && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          {/* A. HALAMAN EDUKASI */}
          {shopeeStep === 'education' && (
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-gray-100 relative text-center">
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                🛒
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-800">Petunjuk Singkat Kado</h3>
                <p className="text-xs text-gray-500 leading-relaxed">Ikuti langkah mudah ini sebelum menuju Shopee:</p>
              </div>

              <div className="bg-orange-50/50 rounded-2xl p-4 text-left space-y-3.5 border border-orange-100">
                <div className="flex items-start gap-3">
                  <span className="bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p className="text-xs text-gray-700 leading-snug pt-0.5">
                    Pilih kado dan beli seperti biasa di <strong>Shopee</strong>.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="space-y-2 flex-1">
                    <p className="text-xs text-gray-700 leading-snug pt-0.5">Gunakan alamat pengiriman ini saat Checkout:</p>
                    <div
                      onClick={handleCopyAddress}
                      className="bg-white border border-orange-200/80 rounded-xl p-3 text-left shadow-sm cursor-pointer hover:border-orange-400 transition relative"
                    >
                      <div className="pr-16">
                        <p className="text-[11px] font-bold text-gray-800">
                          {RECIPIENT_NAME} ({RECIPIENT_PHONE})
                        </p>
                        <p className="text-[10px] text-gray-600 leading-relaxed mt-0.5 line-clamp-2">
                          {SHIPPING_ADDRESS}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`absolute right-2 top-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          copied ? 'bg-emerald-600 text-white' : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {copied ? '✓ Tersalin' : '📋 Salin'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <p className="text-xs text-gray-700 leading-snug pt-0.5">
                    <strong>Kembali ke website ini</strong> untuk konfirmasi agar tidak dibeli tamu lain.
                  </p>
                </div>
              </div>

              <div className="min-h-[42px] flex items-center justify-center">
                {showRedirectNotice ? (
                  <div className="text-xs font-semibold text-orange-800 bg-orange-100/90 border border-orange-200 py-2.5 px-4 rounded-xl w-full">
                    {countdown > 0 ? (
                      <span>Menyiapkan tautan Shopee ({countdown} dtk)...</span>
                    ) : (
                      <span className="font-bold">Klik tombol di bawah untuk lanjut ke Shopee!</span>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 italic">Memuat petunjuk pengiriman...</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCloseShopeeModal}
                  className="w-1/3 py-3 border rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleProceedToShopee}
                  className="w-2/3 py-3 text-white rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 shadow-md"
                >
                  Lanjut ke Shopee ↗
                </button>
              </div>
            </div>
          )}

          {/* B. HALAMAN KONFIRMASI */}
          {shopeeStep === 'confirm' && (
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-gray-100 relative">
              <button onClick={handleCloseShopeeModal} className="absolute top-4 right-4 text-gray-400 text-lg">
                ✕
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="bg-gray-50 rounded-2xl p-4 border text-center space-y-3">
                  <div className="h-44 w-full bg-white rounded-xl overflow-hidden shadow-inner">
                    {shopeeProduct.image_url ? (
                      <img src={shopeeProduct.image_url} alt={shopeeProduct.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Foto</div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm line-clamp-2">{shopeeProduct.title}</h4>
                    <p className="text-rose-600 font-bold text-sm mt-1">
                      Rp {shopeeProduct.price ? shopeeProduct.price.toLocaleString('id-ID') : '0'}
                    </p>
                  </div>
                </div>

                <div className="space-y-6 text-center md:text-left">
                  <div className="space-y-2">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-800">Apakah Anda jadi menghadiahkan kado ini?</h3>
                    <p className="text-xs text-gray-500">Konfirmasi Anda sangat membantu agar tamu lain tidak memilih kado yang sama ♡</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShopeeStep('form')}
                      className="flex-1 py-3 px-6 rounded-full border-2 border-rose-600 text-rose-600 hover:bg-rose-600 hover:text-white font-bold text-xs"
                    >
                      Ya, Sudah Membeli
                    </button>
                    <button
                      onClick={() => setShopeeStep('no_reason')}
                      className="flex-1 py-3 px-6 rounded-full border-2 border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-xs"
                    >
                      Belum / Batal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* C. FORM ISI NAMA & KUANTITAS */}
          {shopeeStep === 'form' && (
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4 border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-gray-800">Konfirmasi Kado</h3>
                  <p className="text-xs text-gray-500 line-clamp-1">{shopeeProduct.title}</p>
                </div>
                <button onClick={handleCloseShopeeModal} className="text-gray-400 text-base">
                  ✕
                </button>
              </div>

              {errorMsg && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs text-center">{errorMsg}</div>}

              <form onSubmit={handleSubmitClaim} className="space-y-3">
                {/* Pilihan Kuantitas yang Dibelikan jika sisa > 1 */}
                {((shopeeProduct.quantity_expected || 1) - (shopeeProduct.quantity_fulfilled || 0)) > 1 && (
                  <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3">
                    <label className="block text-xs font-bold text-rose-800 mb-1">
                      Berapa unit yang kamu belikan?
                    </label>
                    <select
                      value={claimQty}
                      onChange={(e) => setClaimQty(parseInt(e.target.value) || 1)}
                      className="w-full p-2 bg-white border border-rose-200 rounded-lg text-xs font-semibold outline-none"
                    >
                      {Array.from(
                        { length: (shopeeProduct.quantity_expected || 1) - (shopeeProduct.quantity_fulfilled || 0) },
                        (_, i) => i + 1
                      ).map((num) => (
                        <option key={num} value={num}>
                          {num} unit
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Anda *</label>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Contoh: Sarah & Partner"
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nomor WhatsApp / HP *</label>
                  <input
                    type="tel"
                    required
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pesan & Doa (Opsional)</label>
                  <textarea
                    rows={2}
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    placeholder="Selamat menempuh hidup baru ya!"
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="anon"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded"
                  />
                  <label htmlFor="anon" className="text-xs text-gray-700 select-none cursor-pointer">
                    Sembunyikan nama dari tamu lain (Anonim)
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShopeeStep('confirm')}
                    className="flex-1 py-2.5 border rounded-xl text-xs text-gray-600"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-medium"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan Konfirmasi'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* D. RADIO BUTTON ALASAN */}
          {shopeeStep === 'no_reason' && (
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-gray-800">Tidak Apa-apa! 😊</h3>
                  <p className="text-xs text-gray-500">Boleh tahu kendalanya?</p>
                </div>
                <button onClick={handleCloseShopeeModal} className="text-gray-400">
                  ✕
                </button>
              </div>

              <div className="space-y-3 pt-2">
                <label
                  onClick={() => setNoReasonOption('browsing')}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer ${
                    noReasonOption === 'browsing' ? 'border-rose-500 bg-rose-50/50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="no_reason"
                    checked={noReasonOption === 'browsing'}
                    onChange={() => setNoReasonOption('browsing')}
                  />
                  <span className="text-xs">Hanya ingin melihat-lihat dulu</span>
                </label>

                <label
                  onClick={() => setNoReasonOption('unavailable')}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer ${
                    noReasonOption === 'unavailable' ? 'border-rose-500 bg-rose-50/50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="no_reason"
                    checked={noReasonOption === 'unavailable'}
                    onChange={() => setNoReasonOption('unavailable')}
                  />
                  <span className="text-xs">Stok barang di Shopee habis / tidak tersedia</span>
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button onClick={handleCloseShopeeModal} className="w-full py-2.5 bg-gray-800 text-white rounded-xl text-xs font-bold">
                  Selesai
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}