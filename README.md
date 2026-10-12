# sistem belajar adaptif berbasis ai

## apa itu proyek ini?

ini adalah proyek sekolah yang menggabungkan tiga bagian:

1. **website** tempat siswa memilih mata pelajaran dan gaya belajar
2. **ai (google gemini)** yang mengajar dan membuat soal kuis
3. **alat fisik berbasis esp8266** dengan dua tombol (ya/tidak), dua lampu led (hijau/merah), dan buzzer, untuk menjawab soal benar/salah tanpa memegang mouse atau keyboard

siswa juga bisa mengunggah file pdf atau txt berisi catatan atau materi dari sekolahnya. kalau file itu diunggah, ai akan mengikuti materi tersebut saat menjelaskan dan membuat soal, bukan hanya mengandalkan pengetahuan umum.

**cara kerja singkatnya:**

- siswa membuka website, memilih mata pelajaran (misalnya biologi) dan gaya belajar (misalnya langkah demi langkah)
- di tab **learning**, siswa minta ai mengajarkan sebuah topik, ai menjelaskan sesuai gaya belajar yang dipilih
- di tab **materials**, siswa bisa unggah catatan sekolah dalam bentuk pdf/txt, opsional
- di tab **quiz**, ai membuat soal. soal pilihan ganda dijawab lewat website, soal benar/salah bisa dijawab lewat tombol fisik di alat esp8266
- server (backend python) yang memeriksa jawaban, bukan alat esp8266, alat esp8266 hanya mengirim "ya"/"tidak" dan menerima balasan "benar"/"salah", lalu menyalakan led dan buzzer yang sesuai
- semua ini dibuat supaya alat esp8266-nya tetap sederhana dan cepat, tidak pernah menunggu jawaban dari ai secara langsung

## apa saja yang kamu butuhkan?

### perangkat keras (untuk alat kuis fisik)

| barang                                   | jumlah     | keterangan                                                |
| ---------------------------------------- | ---------- | --------------------------------------------------------- |
| board esp8266 nodemcu (esp-12e)          | 1          | yang sudah kamu punya bisa dipakai                        |
| breadboard 830 titik                     | 1          |                                                           |
| push button 4 kaki                       | 2          | tombol ya dan tidak                                       |
| led hijau 5mm                            | 1          |                                                           |
| led merah 5mm                            | 1          |                                                           |
| resistor 220 ohm                         | 2          | satu untuk tiap led                                       |
| modul buzzer aktif 3 pin (vcc, gnd, i/o) | 1          | jangan pakai buzzer 2 pin biasa tanpa driver              |
| kabel jumper male to male                | sekitar 15 |                                                           |
| kabel usb yang bisa transfer data        | 1          | pastikan bukan kabel yang hanya bisa dipakai untuk charge |

### perangkat lunak

- python 3.9 atau lebih baru, untuk menjalankan server backend
- arduino ide, untuk memprogram esp8266
- browser apa saja (chrome, firefox, dll), untuk membuka website
- koneksi wifi yang sama antara komputer dan esp8266, wifi sekolah yang membatasi koneksi antar perangkat kemungkinan tidak akan berfungsi, gunakan wifi rumah atau hotspot hp untuk uji coba

### akun yang diperlukan

- akun google, untuk membuat api key gratis di [aistudio.google.com](https://aistudio.google.com). tidak perlu kartu kredit untuk paket gratisnya

## cara setup

**1. siapkan backend (server python)**

```bash
cd ai-adaptive-learning/backend
python3 -m venv venv
source venv/bin/activate
# kalau pakai windows: venv\Scripts\activate
pip install -r requirements.txt
```

**2. buat api key gemini**

buka [aistudio.google.com](https://aistudio.google.com), masuk dengan akun google, klik "get api key". gratis, tanpa kartu kredit.

**3. atur file konfigurasi**

```bash
cp .env.example .env
```

buka file `.env`, isi dengan api key kamu:

```
GEMINI_API_KEY=isi_dengan_api_key_kamu
GEMINI_MODEL=gemini-flash-latest
PORT=5000
```

catatan: google kadang mengganti nama model ai mereka. memakai `gemini-flash-latest` (bukan nama model yang spesifik seperti `gemini-2.5-flash`) lebih aman, karena otomatis mengikuti model terbaru yang disediakan google, jadi kodenya tidak perlu diubah ubah setiap ada pembaruan.

**4. cari alamat ip lokal komputer kamu**

alat esp8266 perlu tahu alamat komputer kamu di jaringan wifi yang sama.

- windows: buka command prompt, ketik `ipconfig`, cari "ipv4 address"
- mac/linux: ketik `ifconfig` atau `ip a`, cari angka seperti `192.168.x.x`

**5. atur kode esp8266**

buka file `esp8266/quiz_controller/quiz_controller.ino` dengan arduino ide, ubah bagian ini di paling atas:

```cpp
const char* WIFI_SSID = "nama_wifi_kamu";
const char* WIFI_PASSWORD = "password_wifi_kamu";
const char* SERVER_HOST = "192.168.1.100";  // alamat ip dari langkah 4
```

di arduino ide, install dukungan board esp8266 lewat boards manager (cari "esp8266", pasang yang dari "esp8266 community"), lalu pilih board "nodemcu 1.0 (esp-12e module)" di menu tools > board.

**6. rangkai alatnya**

lihat bagian "wiring diagram" di `README.md` untuk skema lengkapnya. singkatnya:

| fungsi       | pin |
| ------------ | --- |
| tombol ya    | D1  |
| tombol tidak | D2  |
| led hijau    | D5  |
| led merah    | D6  |
| buzzer       | D7  |

tombol tidak perlu resistor tambahan, kodenya sudah mengaktifkan pull up resistor internal di board.

**7. upload kode ke esp8266**

sambungkan esp8266 lewat kabel usb ke komputer, pilih port yang benar di arduino ide, klik upload.

**8. jalankan backend**

```bash
python app.py
```

**9. buka website**

buka browser, kunjungi `http://localhost:5000`

## hal penting yang perlu diingat

- esp8266 dan komputer harus terhubung ke jaringan wifi yang sama
- kalau esp8266 mati atau belum terhubung, kuis tetap bisa dijawab lewat mouse di website, jadi proyeknya tidak berhenti total
- file pdf yang diunggah di tab materials harus berisi teks asli, bukan hasil scan foto/gambar, kalau tidak ada teks yang bisa dibaca, sistem akan memberi tahu dan meminta file lain
- semua data (skor, pertanyaan saat ini, materi yang diunggah) hanya tersimpan sementara di memori komputer selama server menyala, kalau servernya dimatikan lalu dinyalakan lagi, data itu akan hilang, ini wajar untuk proyek prototipe seperti ini
- kalau ai sedang tidak bisa dihubungi (misalnya internet lambat atau kuota api habis), sistem akan otomatis memakai kumpulan soal cadangan yang sudah disiapkan, supaya kuis tidak pernah benar benar rusak
- kuis tidak akan mengulang soal yang sama selama server menyala. kalau ai sedang sibuk dan semua soal cadangan untuk mata pelajaran itu sudah pernah muncul, kamu akan melihat pesan untuk mencoba lagi sebentar lagi, riwayat soal akan kosong lagi kalau server dimatikan dan dinyalakan ulang
- kalau muncul error `ModuleNotFoundError` saat menjalankan `python app.py`, artinya `pip install -r requirements.txt` belum dijalankan (atau belum selesai) di dalam virtual environment yang aktif, pastikan ada tulisan `(venv)` di depan terminal kamu sebelum menjalankan perintah pip
- jangan pernah tempel (paste) api key kamu di chat manapun, termasuk ke claude atau chatgpt, kalau tidak sengaja ter-paste, segera hapus key itu di aistudio.google.com dan buat yang baru
