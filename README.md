# Araç Görsel Analizi — Hasar Değerlendirme

Bu repo, araç fotoğraflarının analizi ve plaka maskeleme üzerine geliştirdiğim iki bölümlü projenin analiz kısmı. Amaç, bir araca ait fotoğrafları marka, model ve plaka bilgileriyle birlikte değerlendirip görünür hasarlar hakkında Türkçe bir özet almak.

Projenin diğer bölümü olan `yolofinetune`, fotoğraflardaki plakaları tespit edip kapatıyor. İki bölüm ayrı servisler olarak çalışıyor; aralarında otomatik bir aktarım yok. Plaka üzerinden analiz yapılacaksa bu aşamada henüz maskelenmemiş görseller kullanılmalı.

## Yapay zekâyı nasıl kullandım?

Görselleri yorumlamak için OpenAI API üzerinden GPT-4o kullandım. Uygulama, verilen araç bilgilerine göre sorular hazırlıyor: Görsellerde ilgili araç var mı, hangi parçalarında hasar görünüyor, iç mekânda hava yastığı veya kırık cam gibi bulgular var mı? Kaza anına ait bir fotoğraf varsa bunun için de değerlendirme istiyor.

Fotoğraflar beşli gruplar halinde modele gönderiliyor. Grup yanıtları daha sonra ayrı bir istekte birleştirilerek tek bir özet oluşturuluyor. Bu bölümde mevcut modeli API üzerinden uygulamaya bağladım. Dönen metin, fotoğraflara dayalı bir model yorumu; doğrulanmış bir ekspertiz raporu değil.

Servisi **Node.js ve Express** ile yazdım. API çağrıları için **Axios**, ortam değişkenleri için **dotenv** kullandım.

## Kurulum

Node.js ve npm ile bir OpenAI API anahtarı gerekiyor. Proje klasöründe bağımlılıkları kurun:

```sh
npm ci
```

Repo içindeki `node_modules.zip` dosyasını açmaya gerek yok.

Proje kökündeki `.env` dosyasını düzenleyin:

```dotenv
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
PORT=3001
```

Burada `3001` kullanmamın nedeni, plaka maskeleme servisinin `3000` portunda çalışması. `PORT` belirtilmezse bu servis de `3000` portunu kullanır. Kendi API anahtarınızı GitHub'a yüklemeyin.

Servisi proje kökünden başlatın:

```sh
node app.js
```

## Kullanım

Postman üzerinden `http://localhost:3001/analyze-images` adresine **POST** isteği gönderin. **Body → raw → JSON** seçip aşağıdaki gövdeyi kullanabilirsiniz:

```json
{
  "directoryPath": "C:/data/vehicle-images",
  "vehicleInfo": {
    "brand": "Renault",
    "model": "Megane",
    "plate": "34ABC123"
  }
}
```

`directoryPath` değerini fotoğraflarınızın bulunduğu klasörle değiştirin. Bu yol, servisin çalıştığı bilgisayardaki bir klasör olmalı. İstekle dosya yüklenmiyor. Marka, model ve plaka alanlarının tamamı gerekli.

Terminalden denemek için aynı JSON'u `request.json` dosyasına kaydedin:

```sh
curl -X POST http://localhost:3001/analyze-images -H "Content-Type: application/json" --data-binary "@request.json"
```

PowerShell'de gerekirse `curl.exe` kullanın.

Yanıtın biçimi şöyle; aşağıdaki metin yalnızca yer tutucu:

```json
{
  "analysis": "Görsellerden oluşturulan Türkçe değerlendirme özeti..."
}
```

Sonuç ayrıca terminale yazdırılır. Uygulama rapor dosyası oluşturmaz.

## Kod hakkında birkaç not

İşlemler `app.js` içinde yer alıyor. `generateDynamicQuestions()` araç bilgilerine göre soruları hazırlıyor, `analyzeImageGroup()` her görsel grubunu API'ye gönderiyor, `analyzeImagesInDirectory()` ise grupları oluşturup son özeti alıyor.

Klasördeki `.jpg`, `.jpeg` ve `.png` dosyaları okunuyor; alt klasörlere girilmiyor. Grup büyüklüğü kodda `5`, her API yanıtının sınırı `300` token olarak ayarlı. Örneğin 12 fotoğraf için üç analiz isteği ve bir özetleme isteği yapılıyor. Görseller OpenAI API'ye gönderildiği için denemeler gerçek API kullanımı oluşturuyor.

## Mevcut durum

API hata yönetimi ve büyük görsel gruplarının işlenmesi geliştirilebilir. Bazı API hatalarında servis `200` durumuyla `analysis: null` döndürebiliyor; grup hatalarında da özet eksik kalabiliyor. Böyle bir durumda terminal kayıtlarını, API anahtarını ve kotayı kontrol edin.

Kod dosya uzantılarını filtreliyor, ancak tüm görselleri API'ye PNG MIME türüyle gönderiyor; JPEG dosyaları için bu kısmın dosya türüne göre düzenlenmesi gerekiyor. Boş klasör kontrolü ve istekleri sınırlandıran bir kuyruk da henüz yok.

Serviste kimlik doğrulama ve erişilebilir klasör sınırı bulunmadığından mevcut hali yerel denemeler için uygun.
