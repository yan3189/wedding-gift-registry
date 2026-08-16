'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

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
};

type WeddingConfig = {
  couple_names: string;
  hero_title: string;
  background_url: string;
};

const CATEGORIES = [
  'Ruang Tamu',
  'Dapur',
  'Kamar Mandi',
  'Kamar Tidur',
  'Lainnya',
];

export default function AdminPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Config State
  const [config, setConfig] = useState<WeddingConfig>({
    couple_names: 'Yanuar & Gracia',
    hero_title: 'Wishlist Wedding Gift',
    background_url: '',
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Form State Kado Baru
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [quantityExpected, setQuantityExpected] = useState('1');
  const [category, setCategory] = useState('Perlengkapan Rumah');
  const [imageUrl, setImageUrl] = useState('');
  const [shopeeUrl, setShopeeUrl] = useState('');
  const [description, setDescription] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);

  // Modal Edit State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [updatingProduct, setUpdatingProduct] = useState(false);

  // Cek Autentikasi terlebih dahulu
  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      setCheckingAuth(false);
      fetchData();
    };

    checkAuthAndFetch();
  }, [router]);

  const fetchData = async () => {
    setLoading(true);

    const { data: configData } = await supabase.from('wedding_config').select('*').single();
    if (configData) {
      setConfig({
        couple_names: configData.couple_names || '',
        hero_title: configData.hero_title || '',
        background_url: configData.background_url || '',
      });
    }

    const { data: productData } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (productData) {
      setProducts(productData as Product[]);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);

    const { error } = await supabase.from('wedding_config').upsert({
      id: 1,
      couple_names: config.couple_names,
      hero_title: config.hero_title,
      background_url: config.background_url,
      updated_at: new Date().toISOString(),
    });

    if (error) alert('Gagal menyimpan konfigurasi: ' + error.message);
    else alert('✨ Konfigurasi Header & Background berhasil diperbarui!');

    setSavingConfig(false);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingProduct(true);

    const { error } = await supabase.from('products').insert({
      title,
      price: parseInt(price) || 0,
      quantity_expected: parseInt(quantityExpected) || 1,
      quantity_fulfilled: 0,
      category,
      image_url: imageUrl,
      shopee_url: shopeeUrl,
      description,
      is_claimed: false,
    });

    if (error) {
      alert('Gagal menambah kado: ' + error.message);
    } else {
      alert('🎉 Kado berhasil ditambahkan!');
      setTitle('');
      setPrice('');
      setQuantityExpected('1');
      setImageUrl('');
      setShopeeUrl('');
      setDescription('');
      fetchData();
    }
    setAddingProduct(false);
  };

  // TOMBOL DUPLIKASI KADO
  const handleDuplicateProduct = async (product: Product) => {
    if (!confirm(`Duplikasi kado "${product.title}"?`)) return;

    const { error } = await supabase.from('products').insert({
      title: product.title,
      price: product.price,
      quantity_expected: product.quantity_expected || 1,
      quantity_fulfilled: 0,
      category: product.category,
      image_url: product.image_url,
      shopee_url: product.shopee_url,
      description: product.description,
      is_claimed: false,
    });

    if (error) alert('Gagal menduplikasi: ' + error.message);
    else fetchData();
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setUpdatingProduct(true);

    const isFullyClaimed = (editingProduct.quantity_fulfilled || 0) >= (editingProduct.quantity_expected || 1);

    const { error } = await supabase
      .from('products')
      .update({
        title: editingProduct.title,
        price: editingProduct.price,
        quantity_expected: editingProduct.quantity_expected,
        category: editingProduct.category,
        image_url: editingProduct.image_url,
        shopee_url: editingProduct.shopee_url,
        description: editingProduct.description,
        is_claimed: isFullyClaimed,
      })
      .eq('id', editingProduct.id);

    if (error) {
      alert('Gagal mengupdate kado: ' + error.message);
    } else {
      alert('✅ Data kado berhasil diperbarui!');
      setEditingProduct(null);
      fetchData();
    }
    setUpdatingProduct(false);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Yakin ingin menghapus kado ini?')) return;

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert('Gagal menghapus: ' + error.message);
    else fetchData();
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<any>(ws);

        if (rawData.length === 0) {
          alert('File Excel kosong!');
          return;
        }

        const formattedProducts = rawData.map((item) => ({
          title: item.title || item.Judul || 'Kado Tanpa Nama',
          price: parseInt(item.price || item.Harga || 0),
          quantity_expected: parseInt(item.quantity_expected || item.Jumlah || 1),
          quantity_fulfilled: 0,
          category: item.category || item.Kategori || 'Perlengkapan Rumah',
          image_url: item.image_url || item['URL Gambar'] || '',
          shopee_url: item.shopee_url || item['URL Shopee'] || '',
          description: item.description || item.Deskripsi || '',
          is_claimed: false,
        }));

        if (confirm(`Impor ${formattedProducts.length} kado sekaligus dari Excel?`)) {
          const { error } = await supabase.from('products').insert(formattedProducts);
          if (error) alert('Gagal bulk insert: ' + error.message);
          else {
            alert(`🎉 Berhasil mengimpor ${formattedProducts.length} kado!`);
            fetchData();
          }
        }
      } catch (err) {
        alert('Gagal membaca file Excel. Pastikan format file sesuai.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Tampilkan layar loading saat memeriksa sesi login
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-xs text-gray-500 font-sans">
        Memeriksa hak akses...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Admin */}
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard - Wedding Gift</h1>
            <p className="text-xs text-gray-500">Kelola informasi pasangan, background, dan daftar kado.</p>
          </div>
          <div className="flex items-center space-x-4">
            <a href="/" target="_blank" className="text-xs font-semibold text-rose-600 hover:underline">
              Lihat Halaman Utama ↗
            </a>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-semibold transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* SECTION 1: Config Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
          <h2 className="text-base font-bold text-gray-900">1. Pengaturan Header & Background</h2>
          <form onSubmit={handleSaveConfig} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Pasangan</label>
              <input
                type="text"
                required
                value={config.couple_names}
                onChange={(e) => setConfig({ ...config, couple_names: e.target.value })}
                placeholder="Yanuar & Gracia"
                className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Judul Wishlist</label>
              <input
                type="text"
                required
                value={config.hero_title}
                onChange={(e) => setConfig({ ...config, hero_title: e.target.value })}
                placeholder="Wishlist Wedding Gift"
                className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">URL Background Image (HD)</label>
              <input
                type="url"
                value={config.background_url}
                onChange={(e) => setConfig({ ...config, background_url: e.target.value })}
                placeholder="https://..."
                className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={savingConfig}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {savingConfig ? 'Menyimpan...' : 'Simpan Pengaturan Header'}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION 2: Import Excel */}
        <div className="bg-amber-50/50 rounded-2xl p-6 shadow-sm border border-amber-200/80 space-y-2">
          <h2 className="text-base font-bold text-amber-900">2. Import Massal via Excel (.xlsx)</h2>
          <p className="text-xs text-amber-700">
            Kolom Excel pendukung: <b>title</b>, <b>price</b>, <b>quantity_expected</b>, <b>category</b>, <b>image_url</b>, <b>shopee_url</b>, <b>description</b>.
          </p>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleExcelUpload}
            className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer pt-2"
          />
        </div>

        {/* SECTION 3: Tambah Kado Baru */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
          <h2 className="text-base font-bold text-gray-900">3. Tambah Kado Baru</h2>
          <form onSubmit={handleAddProduct} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Judul Kado *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Misal: Coffee Maker"
                className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Harga (Estimasi Rp) *</label>
              <input
                type="number"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="350000"
                className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Jumlah Diharapkan *</label>
              <input
                type="number"
                min="1"
                required
                value={quantityExpected}
                onChange={(e) => setQuantityExpected(e.target.value)}
                placeholder="1"
                className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500 bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">URL Foto Produk</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">URL Produk Shopee</label>
              <input
                type="url"
                value={shopeeUrl}
                onChange={(e) => setShopeeUrl(e.target.value)}
                placeholder="https://shopee.co.id/..."
                className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Deskripsi / Catatan Tambahan</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Misal: Warna hitam / kapasitas 1 Liter"
                className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={addingProduct}
                className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {addingProduct ? 'Menambahkan...' : 'Tambah Kado ke List'}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION 4: Daftar Kado */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-gray-900">Daftar Kado ({products.length})</h2>
          </div>

          {loading ? (
            <div className="text-center py-8 text-xs text-gray-400">Memuat data kado...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600">
                    <th className="p-3">Foto</th>
                    <th className="p-3">Judul</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Harga</th>
                    <th className="p-3">Kuantitas</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((item) => {
                    const targetQty = item.quantity_expected || 1;
                    const fulfilledQty = item.quantity_fulfilled || 0;
                    const isFullyClaimed = item.is_claimed || fulfilledQty >= targetQty;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/80">
                        <td className="p-3">
                          <img
                            src={item.image_url || 'https://via.placeholder.com/50'}
                            alt={item.title}
                            className="w-10 h-10 object-cover rounded-lg border bg-gray-100"
                          />
                        </td>
                        <td className="p-3 font-semibold text-gray-900">{item.title}</td>
                        <td className="p-3 text-gray-500">{item.category || 'Lainnya'}</td>
                        <td className="p-3 text-rose-600 font-bold">
                          Rp {item.price ? item.price.toLocaleString('id-ID') : '0'}
                        </td>
                        <td className="p-3 font-semibold text-gray-700">
                          {fulfilledQty} / {targetQty} unit
                        </td>
                        <td className="p-3">
                          {isFullyClaimed ? (
                            <span className="bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              Dihadiahkan ✨
                            </span>
                          ) : fulfilledQty > 0 ? (
                            <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              Terbeli Sebagian
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              Tersedia
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-1.5">
                          {/* TOMBOL DUPLIKASI */}
                          <button
                            onClick={() => handleDuplicateProduct(item)}
                            className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-[11px] font-medium"
                            title="Duplikasi Kado Ini"
                          >
                            📋 Duplikasi
                          </button>
                          <button
                            onClick={() => setEditingProduct(item)}
                            className="px-2.5 py-1.5 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg text-[11px] font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(item.id)}
                            className="px-2.5 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-[11px] font-medium"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* MODAL EDIT PRODUK */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-gray-100">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-gray-800">Edit Kado</h3>
              <button onClick={() => setEditingProduct(null)} className="text-gray-400">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Judul Kado</label>
                <input
                  type="text"
                  required
                  value={editingProduct.title}
                  onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                  className="w-full p-2 border rounded-xl text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Harga (Rp)</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseInt(e.target.value) || 0 })}
                    className="w-full p-2 border rounded-xl text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Unit</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingProduct.quantity_expected || 1}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, quantity_expected: parseInt(e.target.value) || 1 })
                    }
                    className="w-full p-2 border rounded-xl text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori</label>
                  <select
                    value={editingProduct.category || 'Lainnya'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full p-2 border rounded-xl text-xs outline-none bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">URL Gambar</label>
                <input
                  type="url"
                  value={editingProduct.image_url}
                  onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                  className="w-full p-2 border rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">URL Shopee</label>
                <input
                  type="url"
                  value={editingProduct.shopee_url}
                  onChange={(e) => setEditingProduct({ ...editingProduct, shopee_url: e.target.value })}
                  className="w-full p-2 border rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full p-2 border rounded-xl text-xs outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-2 border rounded-xl text-xs text-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updatingProduct}
                  className="flex-1 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold"
                >
                  {updatingProduct ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}