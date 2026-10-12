# pemetaan proyek terhadap bidang riset komputer

dokumen ini memetakan sistem belajar adaptif berbasis ai ke cakupan "bidang komputer": pengembangan algoritma, proses aljabar, simulasi, manipulasi/rekayasa data, pemrosesan, pengenalan pola, penyimpanan, komunikasi jaringan, keamanan data dan informasi, serta aplikasi informatika terkait.

## ringkasan pemetaan

| faktor yang diminta | implementasi di proyek ini | lokasi di kode |
|---|---|---|
| pengembangan algoritma | model bayesian knowledge tracing untuk estimasi pemahaman, algoritma penghindaran soal berulang, validasi skema json, logika retry untuk kegagalan ai | `backend/app.py` |
| proses aljabar | update probabilistik bkt (perkalian, pembagian, normalisasi per jawaban), perhitungan akurasi dan rata rata penguasaan topik, pencocokan jawaban numerik langsung tanpa ai | `bkt_update()`, `recommend_difficulty()`, `try_numeric_match()` |
| simulasi | esp8266 mensimulasikan kontroler kuis fisik yang independen dari AI, dengan feedback led dan buzzer yang meniru alat ujian fisik sungguhan | `esp8266/quiz_controller/quiz_controller.ino` |
| manipulasi / rekayasa data | ekstraksi teks dari file pdf/txt yang diunggah siswa, pemotongan dan penyuntikan teks tersebut ke dalam prompt ai | `extract_pdf_text()`, `material_context()` |
| pemrosesan dan pengolahan | validasi dan transformasi respons json dari ai, pipeline markdown dan latex menjadi html yang aman untuk ditampilkan | `validate_question()`, `renderFormattedText()` di `frontend/app.js` |
| pengenalan pola | pelacakan pola kesalahan siswa per topik dari waktu ke waktu, menghasilkan daftar "topics to review" berdasarkan topik dengan skor penguasaan terendah | `record_performance()`, endpoint `/api/progress` |
| penyimpanan | bank soal cadangan lokal (json), status permainan dan riwayat performa disimpan di memori server selama sesi berjalan | `fallback_questions.json`, dictionary `state`, `performance`, `materials` |
| komunikasi jaringan | komunikasi http antara esp8266, backend flask, dan browser melalui wifi lokal, termasuk heartbeat untuk status koneksi | endpoint `/answer`, `/esp/ping`, seluruh arsitektur proyek |
| keamanan data dan informasi | api key hanya disimpan di `.env` sisi server, tidak pernah dikirim ke browser, serta sanitasi html (dompurify) terhadap semua teks yang dihasilkan ai atau diunggah pengguna sebelum ditampilkan, untuk mencegah injeksi skrip | `backend/.env`, `DOMPurify.sanitize()` di `frontend/app.js` |
| aplikasi informatika terkait | keseluruhan sistem: aplikasi web, integrasi api ai, dan perangkat iot yang saling terhubung | seluruh proyek |

## tentang "kapan siswa dianggap memahami sesuatu"

ini adalah pertanyaan inti dari seluruh sistem adaptif, dan jawabannya tidak boleh sekadar "jika persentase jawaban benar di atas angka tertentu." persentase jawaban benar mencampurkan tiga hal yang sebenarnya berbeda:

1. siswa benar benar paham
2. siswa menebak dengan benar tanpa paham
3. siswa paham tapi melakukan kesalahan ceroboh (slip)

karena itu proyek ini menggunakan **bayesian knowledge tracing (bkt)**, model dari corbett dan anderson (1994) yang menjadi standar dalam penelitian intelligent tutoring systems. alih alih menghitung rata rata skor, bkt memperlakukan "siswa paham topik ini" sebagai sebuah probabilitas tersembunyi yang diperbarui setelah setiap jawaban, dengan mempertimbangkan dua kemungkinan kesalahan pengukuran:

- **p(guess)**: peluang siswa menjawab benar padahal tidak paham (lebih tinggi untuk soal ya/tidak dibanding pilihan ganda, karena menebak 1 dari 2 pilihan jauh lebih mudah daripada 1 dari 4)
- **p(slip)**: peluang siswa menjawab salah padahal sebenarnya paham

rumus pembaruannya, untuk setiap jawaban:

jika jawaban benar:

```
p(paham | benar) = [p(paham) x (1 - p(slip))] / [p(paham) x (1 - p(slip)) + (1 - p(paham)) x p(guess)]
```

jika jawaban salah:

```
p(paham | salah) = [p(paham) x p(slip)] / [p(paham) x p(slip) + (1 - p(paham)) x (1 - p(guess))]
```

lalu ditambahkan kemungkinan belajar dari pengalaman menjawab itu sendiri:

```
p(paham_baru) = p(paham | observasi) + (1 - p(paham | observasi)) x p(learn)
```

### kapan dianggap "paham"

proyek ini memakai dua ambang batas, keduanya diambil dari literatur, bukan angka sembarangan:

- **0.80 (80%)** — ambang batas mastery learning dari bloom (1968), dipakai di sini sebagai titik ketika soal berikutnya boleh dibuat lebih sulit
- **0.95 (95%)** — ambang batas mastery dari penelitian cognitive tutor milik corbett dan anderson, dipakai di sini sebagai titik ketika sebuah topik secara resmi dianggap "sudah dikuasai" dan ditampilkan sebagai demikian di daftar topics to review

pengujian terhadap implementasi ini (lihat percakapan pengembangan) menunjukkan perilaku yang sesuai harapan: siswa yang menjawab benar 3 kali berturut turut lalu sekali salah (slip) hanya turun dari estimasi 0.986 ke 0.912, bukan anjlok drastis seperti jika dihitung dengan persentase mentah. ini karena satu kesalahan di tengah tren yang kuat secara statistik lebih mungkin merupakan slip, bukan bukti ketidakpahaman.

### keterbatasan yang jujur untuk dilaporkan

untuk laporan ilmiah, bagian ini penting disebutkan secara eksplisit, karena kejujuran soal batasan adalah bagian dari sikap ilmiah:

- parameter bkt (p_init 0.3, p_learn 0.15, p_slip 0.1) pada proyek ini memakai nilai umum dari literatur, bukan dikalibrasi dari data siswa sungguhan. kalibrasi yang tepat membutuhkan data historis dalam jumlah besar yang tidak tersedia untuk prototipe sekolah
- model ini diterapkan per topik per siswa dalam satu sesi, bukan per siswa yang terdaftar dan dilacak lintas waktu, karena proyek sengaja tidak memakai sistem login atau basis data
- alternatif yang lebih presisi secara akademis adalah item response theory (irt), yang dipakai pada ujian adaptif terkomputerisasi sungguhan, namun irt membutuhkan kalibrasi parameter kesulitan dan daya beda untuk setiap butir soal, jauh melampaui kebutuhan dan kompleksitas yang wajar untuk prototipe tingkat sekolah ini

## implementasi tambahan yang relevan

- **try_numeric_match()**: untuk jawaban matematika berupa angka, sistem melakukan perbandingan numerik langsung di backend (termasuk mendukung koma sebagai pemisah desimal) sebelum memanggil ai, ini adalah proses aljabar nyata yang dijalankan sistem sendiri, bukan sekadar didelegasikan ke ai
- **sanitasi html**: karena aplikasi menampilkan teks yang dihasilkan ai dan isi file yang diunggah pengguna sebagai html (untuk mendukung format markdown dan rumus matematika), semua keluaran tersebut disaring lewat dompurify sebelum ditampilkan, mencegah kemungkinan suntikan skrip berbahaya
