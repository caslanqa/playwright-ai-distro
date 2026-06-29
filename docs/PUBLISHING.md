# NPM'e Yayınlama Kılavuzu

Bu dokümanda `create-playwright-ai-distro` paketini npm'e nasıl yayınlayacağınız ve başka bir makinede nasıl kullanacağınız anlatılmaktadır.

## 🚀 GitHub Actions ile Otomatik Yayınlama (Önerilen)

### 1. NPM Token Oluşturma

1. [npmjs.com](https://www.npmjs.com) → Avatar → Access Tokens
2. "Generate New Token" → "Classic Token" → "Automation"
3. Token'ı kopyalayın

### 2. GitHub Secret Ekleme

1. GitHub repo → Settings → Secrets and variables → Actions
2. "New repository secret" tıklayın
3. Name: `NPM_TOKEN`
4. Value: npm token'ınızı yapıştırın
5. "Add secret" tıklayın

### 3. Yayınlama (Manuel Trigger)

1. GitHub repo → Actions → "Publish to npm"
2. "Run workflow" tıklayın
3. Seçenekleri belirleyin:
   - **version_type**: `patch` / `minor` / `major`
   - **dry_run**: Test için `true`, gerçek yayın için `false`
   - **tag**: `latest` / `beta` / `next`
4. "Run workflow" tıklayın

```
patch: 1.0.0 → 1.0.1 (bug fix)
minor: 1.0.0 → 1.1.0 (yeni özellik)
major: 1.0.0 → 2.0.0 (breaking change)
```

### Workflow Ne Yapar?

1. ✅ Testleri çalıştırır
2. ✅ Lint kontrolü yapar
3. ✅ Versiyon numarasını artırır
4. ✅ CHANGELOG.md günceller
5. ✅ Git commit + tag oluşturur
6. ✅ npm'e yayınlar
7. ✅ GitHub Release oluşturur

---

## 📦 Manuel Yayınlama (Alternatif)

### NPM Hesabı

```bash
# npm hesabı oluştur (veya npmjs.com'dan kayıt olun)
npm adduser
```

### NPM'e Giriş

```bash
npm login
# Kullanıcı adı, şifre ve email girmeniz istenecek
```

### Yayınlamadan Önce Test

```bash
# Paket içeriğini kontrol et
npm pack --dry-run
```

### NPM'e Yayınlama

```bash
# Versiyon artır ve yayınla
npm version patch  # veya minor / major
npm publish --access public
```

---

## 🖥️ Başka Makinede Kurulum

Yayınladıktan sonra herhangi bir makinede:

### Yöntem 1: npx (Önerilen)

```bash
# Yeni proje oluştur
npx create-playwright-ai-distro my-test-project

# Klasöre gir ve bağımlılıkları yükle
cd my-test-project
npm install
npx playwright install --with-deps

# Test çalıştır
npm test
```

### Yöntem 2: npm init

```bash
npm init playwright-ai-distro my-test-project
cd my-test-project
npm install
npx playwright install --with-deps
```

### Yöntem 3: Global Kurulum

```bash
# Global olarak kur
npm install -g create-playwright-ai-distro

# Artık her yerde kullanabilirsin
create-playwright-ai-distro my-project
```

## 6. Versiyon Yönetimi

```bash
# Mevcut versiyonu gör
npm view create-playwright-ai-distro version

# Tüm versiyonları gör
npm view create-playwright-ai-distro versions

# Beta yayınlama
npm version prerelease --preid=beta
npm publish --tag beta

# Beta kurulum
npx create-playwright-ai-distro@beta my-project
```

## 7. Özel/Private Registry (Opsiyonel)

GitHub Packages veya özel npm registry kullanmak için:

### GitHub Packages

```bash
# .npmrc dosyası oluştur
echo "@datanoesiscp:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc

# package.json'da name'i güncelle
# "name": "@datanoesiscp/create-playwright-ai-distro"

# Yayınla
npm publish
```

### Kurulum (GitHub Packages)

```bash
# .npmrc ayarla
echo "@datanoesiscp:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc

# Kur
npx @datanoesiscp/create-playwright-ai-distro my-project
```

## 📌 Hızlı Başlangıç Özeti

### GitHub Actions ile (Önerilen)

1. GitHub'a `NPM_TOKEN` secret ekle
2. Actions → "Publish to npm" → Run workflow
3. Version type seç → Run

### Manuel

```bash
npm login
npm version patch
npm publish --access public
```

### Başka Makinede Kullan

```bash
npx create-playwright-ai-distro my-project
cd my-project
npm install
npx playwright install --with-deps
npm test
```

---

## ❓ Sorun Giderme

### "Package name already exists"

```bash
npm publish --access public
```

### "You must be logged in"

```bash
npm login
npm whoami  # Giriş kontrolü
```

### "Permission denied"

```bash
# Scoped package için
npm publish --access public
```
